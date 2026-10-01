// World geometry: builds a per-pixel mask (water / solid / air) from data/world.js and answers
// spatial queries. Rendering of the terrain lives in terrain.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.World = (function () {
  const WATER = 0, SOLID = 1, AIR = 2;
  const U = AQ.U;
  const W = {
    WATER, SOLID, AIR,
    w: 0, h: 0, sea: 0, mask: null, dist: null, biomes: [], biomeGrid: null, biomeById: {}, data: null
  };
  const CELL = 8;

  W.build = function (data) {
    W.data = data;
    W.w = data.width; W.h = data.height; W.sea = data.seaLevel;
    W.biomes = data.biomes;
    W.biomes.forEach((b, i) => { b.index = i; W.biomeById[b.id] = b; });
    buildBiomeGrid();
    const mask = new Uint8Array(W.w * W.h);
    W.mask = mask;
    W.mat = new Uint8Array(W.w * W.h);          // material id per pixel (0 = biome default)
    W.materials = ['default'].concat(Object.keys(data.materials || {}));
    W.vents = [];
    // 1) floor polyline
    const floor = floorProfile(data.floor, data.seed || 1);
    W.floorY = floor;
    for (let x = 0; x < W.w; x++) {
      const fy = floor[x];
      for (let y = 0; y < W.h; y++) mask[y * W.w + x] = y >= fy ? SOLID : (y < W.sea ? AIR : WATER);
    }
    // 2) shapes in order
    (data.shapes || []).forEach((s, i) => { curMat = s.mat ? W.materials.indexOf(s.mat) : 0; applyShape(s, (data.seed || 1) + i * 31); });
    curMat = 0;
    buildPools(data.pools || []);
    // 3) distance-to-open transform (used for terrain shading & spawning)
    W.dist = distanceTransform();
  };

  function floorProfile(points, seed) {
    const out = new Float32Array(W.w);
    let j = 0;
    for (let x = 0; x < W.w; x++) {
      while (j < points.length - 2 && x > points[j + 1][0]) j++;
      const a = points[j], b = points[Math.min(j + 1, points.length - 1)];
      const t = b[0] === a[0] ? 0 : U.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
      const st = U.smooth(t) * 0.7 + t * 0.3;
      const y = U.lerp(a[1], b[1], st);
      const rough = U.lerp(a[2] || 0, b[2] === undefined ? (a[2] || 0) : b[2], t);
      out[x] = Math.round(y + (U.noise1(x * 0.035, seed) - 0.5) * rough * 2 + (U.noise1(x * 0.21, seed + 3) - 0.5) * rough * 0.5);
    }
    return out;
  }

  let curMat = 0;
  function setPx(x, y, op) {
    if (x < 0 || y < 0 || x >= W.w || y >= W.h) return;
    const i = y * W.w + x, m = W.mask[i];
    switch (op) {
      case 'solid': W.mask[i] = SOLID; W.mat[i] = curMat; break;
      case 'carve': W.mask[i] = y < W.sea ? AIR : WATER; break;
      case 'pool': W.mask[i] = WATER; break;
      case 'air': if (m !== SOLID) W.mask[i] = AIR; break;
      case 'clear': W.mask[i] = AIR; break;
      case 'water': if (m !== SOLID) W.mask[i] = WATER; break;
    }
  }

  function jitterPoly(pts, jitter, seed) {
    if (!jitter) return pts;
    const out = [];
    let k = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 5));
      const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
      for (let s = 0; s < n; s++) {
        const t = s / n, off = s === 0 ? 0 : (U.noise1(k++ * 0.45, seed) - 0.5) * 2 * jitter;
        out.push([U.lerp(a[0], b[0], t) + nx * off, U.lerp(a[1], b[1], t) + ny * off]);
      }
    }
    return out;
  }

  function fillPoly(pts, op) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W.w - 1, Math.ceil(x1)); y1 = Math.min(W.h - 1, Math.ceil(y1));
    // scanline fill
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > yc) !== (yj > yc)) xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(x0, Math.ceil(xs[k] - 0.5)), b = Math.min(x1, Math.floor(xs[k + 1] - 0.5));
        for (let x = a; x <= b; x++) setPx(x, y, op);
      }
    }
  }

  function applyShape(s, seed) {
    const op = s.op || 'solid';
    switch (s.shape) {
      case 'poly': fillPoly(jitterPoly(s.pts, s.jitter, seed), op); break;
      case 'rect': fillPoly(jitterPoly([[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]], s.jitter, seed), op); break;
      case 'circle': {
        const pts = [];
        const n = Math.max(12, Math.round(s.r * 1.2));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([s.x + Math.cos(a) * (s.rx || s.r), s.y + Math.sin(a) * (s.ry || s.r)]); }
        fillPoly(jitterPoly(pts, s.jitter, seed), op); break;
      }
      case 'tunnel': {
        const path = s.path, jit = s.jitter || 0;
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i], b = path[i + 1];
          const ra = a[2] || s.r, rb = b[2] || s.r, rm = Math.max(ra, rb) * (1 + jit) + 2;
          const x0 = Math.floor(Math.min(a[0], b[0]) - rm), x1 = Math.ceil(Math.max(a[0], b[0]) + rm);
          const y0 = Math.floor(Math.min(a[1], b[1]) - rm), y1 = Math.ceil(Math.max(a[1], b[1]) + rm);
          const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const t = U.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / L2, 0, 1);
            const d = Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
            const r = U.lerp(ra, rb, t) * (1 + (U.fbm2(x * 0.045, y * 0.045, seed) - 0.5) * 2 * jit);
            if (d <= r) setPx(x, y, op);
          }
        }
        break;
      }
      case 'spikes': {
        const r = U.rng(seed);
        const dir = s.dir === 'down' ? 1 : -1;
        for (let i = 0; i < s.n; i++) {
          const cx = s.x + (i + 0.5) * (s.w / s.n) + r.range(-3, 3);
          const hw = r.range(s.base ? s.base[0] : 5, s.base ? s.base[1] : 10);
          const h = r.range(s.h[0], s.h[1]);
          fillPoly(jitterPoly([[cx - hw, s.y], [cx + hw, s.y], [cx + r.range(-2, 2), s.y + dir * h]], s.jitter || 0, seed + i), op);
        }
        break;
      }
      case 'chimney': {
        const hw = s.w / 2, top = s.y - s.h;
        fillPoly(jitterPoly([[s.x - hw - 6, s.y + 4], [s.x - hw * 0.45, top], [s.x + hw * 0.45, top], [s.x + hw + 6, s.y + 4]], 1.5, seed), 'solid');
        fillPoly([[s.x - 2, top - 1], [s.x + 2, top - 1], [s.x + 1, top + 6], [s.x - 1, top + 6]], 'carve');
        W.vents.push({ x: s.x, y: top + 2, t: 0 });
        break;
      }
    }
  }

  // Tide pools: little basins of water carved into rock above the sea surface.
  function buildPools(list) {
    W.pools = [];
    list.forEach((p) => {
      let surf = -Infinity;
      for (let x = p.x - p.w / 2; x <= p.x + p.w / 2; x++) surf = Math.max(surf, W.floorY[Math.round(x)] || 0);
      surf = Math.round(surf) + 1;
      const rx = p.w / 2, d = p.d || 6;
      for (let y = surf - 12; y <= surf + d; y++) for (let x = Math.floor(p.x - rx - 2); x <= Math.ceil(p.x + rx + 2); x++) {
        const dx = (x + 0.5 - p.x) / rx, dy = (y + 0.5 - surf) / d;
        if (y >= surf && dx * dx + dy * dy <= 1) setPx(x, y, 'pool');
        else if (y < surf && Math.abs(dx) <= 1 && W.at(x, y) === SOLID && y < W.sea) setPx(x, y, 'clear');
      }
      // raised rims on both sides
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const x = Math.round(p.x + side * (rx + k));
        for (let y = surf - 3 + k; y <= surf + 1; y++) setPx(x, y, 'solid');
      }
      W.pools.push({ x: p.x, y: surf + 2, w: p.w, surface: surf, id: W.pools.length });
    });
  }

  function distanceTransform() {
    const w = W.w, h = W.h, m = W.mask, d = new Uint8Array(w * h);
    for (let i = 0; i < d.length; i++) d[i] = m[i] === SOLID ? 255 : 0;
    // 2-pass chamfer (1 for orthogonal, ~1 for diagonal using max-norm style 1/1 gives square dist; use 2/3 for nicer circle)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 2);
      if (y > 0) { v = Math.min(v, d[i - w] + 2); if (x > 0) v = Math.min(v, d[i - w - 1] + 3); if (x < w - 1) v = Math.min(v, d[i - w + 1] + 3); }
      d[i] = Math.min(255, v);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; if (!d[i]) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 2);
      if (y < h - 1) { v = Math.min(v, d[i + w] + 2); if (x < w - 1) v = Math.min(v, d[i + w + 1] + 3); if (x > 0) v = Math.min(v, d[i + w - 1] + 3); }
      d[i] = Math.min(255, v);
    }
    return d; // value / 2 ~= pixel distance to nearest open pixel
  }

  function buildBiomeGrid() {
    const gw = Math.ceil(W.w / CELL), gh = Math.ceil(W.h / CELL);
    W.biomeGrid = new Uint8Array(gw * gh);
    W.gridW = gw;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
      let idx = 255;
      for (let i = 0; i < W.biomes.length; i++) { const r = W.biomes[i].rect; if (x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3]) { idx = i; break; } }
      W.biomeGrid[gy * gw + gx] = idx;
    }
  }

  // ---------- queries ----------
  W.at = function (x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W.w || y >= W.h) return SOLID;
    if (y < 0) return AIR;
    return W.mask[y * W.w + x];
  };
  W.solid = (x, y) => W.at(x, y) === SOLID;
  W.water = (x, y) => W.at(x, y) === WATER;
  W.air = (x, y) => W.at(x, y) === AIR;
  W.open = (x, y) => W.at(x, y) !== SOLID;
  W.depthDist = (x, y) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W.w || y >= W.h) return 255; return W.dist[y * W.w + x]; };

  W.biomeAt = function (x, y) {
    const gx = U.clamp(Math.floor(x / CELL), 0, W.gridW - 1), gy = U.clamp(Math.floor(y / CELL), 0, Math.ceil(W.h / CELL) - 1);
    const i = W.biomeGrid[gy * W.gridW + gx];
    return i === 255 ? W.biomes[0] : W.biomes[i];
  };
  W.zoneName = function (x, y) {
    const b = W.biomeAt(x, y);
    if (b.zones) for (const z of b.zones) if (x >= z.x0 && x < z.x1) return b.name + ' - ' + z.name;
    return b.name;
  };

  // y of first solid pixel at or below (x, y), within max px; null if none
  W.groundBelow = function (x, y, max = 400) {
    for (let i = 0; i <= max; i++) if (W.solid(x, y + i)) return y + i;
    return null;
  };
  W.ceilingAbove = function (x, y, max = 400) {
    for (let i = 0; i <= max; i++) if (W.solid(x, y - i)) return y - i;
    return null;
  };
  // Box collision test (centered box)
  W.boxHits = function (cx, cy, hw, hh) {
    const x0 = Math.floor(cx - hw), x1 = Math.floor(cx + hw - 0.001), y0 = Math.floor(cy - hh), y1 = Math.floor(cy + hh - 0.001);
    for (let x = x0; x <= x1; x += 2) { if (W.solid(x, y0) || W.solid(x, y1)) return true; }
    if (W.solid(x1, y0) || W.solid(x1, y1)) return true;
    for (let y = y0; y <= y1; y += 2) { if (W.solid(x0, y) || W.solid(x1, y)) return true; }
    return false;
  };
  // Raycast-ish: is the straight segment clear of solids?
  W.lineClear = function (ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
    for (let i = 1; i < n; i++) { const t = i / n; if (W.solid(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  };

  return W;
})();
