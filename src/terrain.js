// Terrain-first pixel art: every biome is painted into its own low-res bitmap (plus an optional
// foreground bitmap) from the world mask, palettes and prop lists in data/world.js.
// Entities are composited on top at runtime.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Terrain = (function () {
  const U = AQ.U;
  const T = { chunks: [], lights: [], emitters: [] };
  const hex = U.hex;

  // ---------------------------------------------------------------- painter
  function Painter(x0, y0, w, h) {
    this.x0 = x0; this.y0 = y0; this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  Painter.prototype.set = function (wx, wy, c, a = 255) {
    const x = Math.round(wx) - this.x0, y = Math.round(wy) - this.y0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return; }
    const k = a / 255, ia = this.d[i + 3] / 255, oa = k + ia * (1 - k);
    if (oa <= 0) return;
    for (let j = 0; j < 3; j++) this.d[i + j] = (c[j] * k + this.d[i + j] * ia * (1 - k)) / oa;
    this.d[i + 3] = oa * 255;
  };
  // only paint where the world is open (water/air) -> props never cover the seabed
  Painter.prototype.setOpen = function (wx, wy, c, a) { if (!AQ.World.solid(wx, wy)) this.set(wx, wy, c, a); };
  Painter.prototype.has = function (wx, wy) {
    const x = Math.round(wx) - this.x0, y = Math.round(wy) - this.y0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.d[(y * this.w + x) * 4 + 3] > 0;
  };
  Painter.prototype.line = function (x0, y0, x1, y1, c, open, a) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) { const t = i / n; (open ? this.setOpen : this.set).call(this, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, a); }
  };
  Painter.prototype.ellipse = function (cx, cy, rx, ry, colorFn, open) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, q = dx * dx + dy * dy;
      if (q <= 1) { const c = typeof colorFn === 'function' ? colorFn(dx, dy, q, x, y) : colorFn; if (c) (open ? this.setOpen : this.set).call(this, x, y, c); }
    }
  };
  Painter.prototype.toCanvas = function () {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  };

  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => v / 16));

  // ---------------------------------------------------------------- build
  T.build = function (W) {
    T.chunks = []; T.lights = []; T.emitters = [];
    const data = W.data;
    const mats = data.materials || {};
    const matPal = W.materials.map((m) => (m === 'default' ? null : prepPalette(mats[m])));
    W.biomes.forEach((b) => {
      const crop = cropFor(W, b);
      if (!crop) return;
      const [x0, y0, x1, y1] = crop;
      const back = new Painter(x0, y0, x1 - x0, y1 - y0);
      let front = null;
      const pal = prepPalette(b.palette);
      paintTerrain(W, b, back, pal, matPal);
      const surf = scanSurfaces(W, b, x0, y0, x1, y1);
      const rng = U.rng((data.seed || 1) * 1000 + b.index * 77);
      (b.props || []).forEach((spec) => {
        const layer = spec.layer === 'front' ? (front = front || new Painter(x0, y0, x1 - x0, y1 - y0)) : back;
        placeProps(W, b, spec, surf, rng).forEach((pt) => {
          const fn = PROPS[spec.type];
          if (fn) fn(layer, pt[0], pt[1], rng, b, pal, spec, T);
          else console.warn('[terrain] unknown prop', spec.type);
        });
      });
      T.chunks.push({ biome: b.id, x: x0, y: y0, w: x1 - x0, h: y1 - y0, canvas: back.toCanvas(), front: front && front.toCanvas() });
    });
    W.vents.forEach((v) => T.lights.push({ x: v.x, y: v.y - 4, r: 36, color: '#ff8a3a', flicker: true }));
    buildMinimap(W);
  };

  // Fireflies drifting in the lush cave's air pocket (they glow through the darkness).
  T.fireflies = [];
  T.updateFireflies = function (dt, cam) {
    const W = AQ.World, b = W.biomeById.lush_cave, R = U.R;
    if (!b) return;
    const [rx, ry, rw, rh] = b.rect;
    const near = cam.x > rx - 200 && cam.x < rx + rw + 200 && cam.y > ry - 200 && cam.y < ry + rh + 200;
    if (!near) { T.fireflies.length = 0; return; }
    while (T.fireflies.length < 18) {
      const x = R.range(rx, rx + rw), y = R.range(ry, ry + rh);
      if (W.air(x, y) && y > W.sea) T.fireflies.push({ x, y, hx: x, hy: y, t: R.range(0, 9), s: R.range(0.6, 1.4) });
      else if (R.chance(0.02)) break;
    }
    for (const f of T.fireflies) {
      f.t += dt * f.s;
      f.x = f.hx + Math.sin(f.t * 0.7) * 10 + Math.sin(f.t * 1.9) * 3;
      f.y = f.hy + Math.cos(f.t * 0.9) * 6;
    }
  };
  T.drawGlow = function (ctx, cam) {
    const l = cam.left(), tp = cam.top();
    for (const f of T.fireflies) {
      const a = 0.55 + Math.sin(f.t * 4) * 0.45;
      if (a < 0.15) continue;
      ctx.globalAlpha = a; ctx.fillStyle = '#fff3a0';
      ctx.fillRect(Math.round(f.x - l), Math.round(f.y - tp), 1, 1);
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffe36b';
      ctx.fillRect(Math.round(f.x - l) - 1, Math.round(f.y - tp), 3, 1); ctx.fillRect(Math.round(f.x - l), Math.round(f.y - tp) - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  };

  // Hydrothermal vents puff smoke + bubbles (only near the camera).
  T.update = function (dt, cam) {
    const W = AQ.World, R = U.R;
    T.updateFireflies(dt, cam);
    for (const v of W.vents) {
      if (Math.abs(v.x - cam.x) > 260 || Math.abs(v.y - cam.y) > 200) continue;
      v.t -= dt;
      if (v.t <= 0) {
        v.t = R.range(0.16, 0.3);
        AQ.FX.add({ type: 'puff', x: v.x + R.range(-2, 2), y: v.y, vx: R.range(-4, 4), vy: -R.range(14, 26), life: R.range(1.5, 2.6), color: R.chance(0.3) ? 'rgba(255,150,80,0.3)' : 'rgba(70,60,66,0.45)', r: R.range(1.2, 2.6) });
        if (R.chance(0.25)) AQ.FX.bubble(v.x + R.range(-3, 3), v.y - 2);
      }
    }
  };

  function prepPalette(p) {
    if (!p) return null;
    return {
      top: p.top.map(hex), rock: p.rock.map(hex), accent: hex(p.accent || p.rock[0]),
      style: p.style || '', air: hex(p.air || '#1e2a2c'), backwall: p.backwall, embers: !!p.embers
    };
  }

  // Organic biome ownership for painting: the rect boundaries are wobbled with noise.
  const JIT = 14;
  function ownerAt(W, x, y) {
    return W.biomeAt(x + (U.noise2(x * 0.05, y * 0.05, 11) - 0.5) * JIT * 2, y + (U.noise2(x * 0.05, y * 0.05, 23) - 0.5) * JIT * 2);
  }
  T.ownerAt = ownerAt;

  function cropFor(W, b) {
    const [rx, ry, rw, rh] = b.rect;
    const M = JIT + 2;
    const bx0 = Math.max(0, rx - M), by0 = Math.max(0, ry - M), bx1 = Math.min(W.w, rx + rw + M), by1 = Math.min(W.h, ry + rh + M);
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let y = by0; y < by1; y += 4) for (let x = bx0; x < bx1; x += 4) {
      if (W.biomeAt(x, y) !== b) continue;
      if (W.open(x, y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    }
    if (minY === Infinity) return null;
    return [bx0, Math.max(by0, minY - 200), bx1, Math.min(by1, maxY + 200)];
  }

  function paintTerrain(W, b, P, pal, matPal) {
    const seed = b.index * 101 + 13, sea = W.sea, ww = W.w;
    for (let y = P.y0; y < P.y0 + P.h; y++) {
      const depthF = 1 - U.clamp((y - sea) / 1250, 0, 1) * 0.42;
      for (let x = P.x0; x < P.x0 + P.w; x++) {
        const i = y * ww + x, m = W.mask[i];
        if (ownerAt(W, x, y) !== b) continue;
        if (m !== 1) {
          // open pixels: tide-pool water above the sea, air pockets below it, optional cave back-wall
          const pool = m === 0 ? W.poolAt(x, y) : null;
          if (pool || (m === 0 && y < sea)) {
            // tide-pool water: banded + ordered-dithered by depth below the rim (prototype palette)
            const k = y - (pool ? pool.surface : y), POOL = [[214, 248, 250], [143, 216, 224], [102, 194, 206], [67, 161, 186], [44, 127, 159]];
            const pos = k === 0 ? 0 : Math.min(4, 1 + (k - 1) / 3), i = Math.floor(pos);
            const th = [[0, 0.5], [0.75, 0.25]][y & 1][x & 1];
            P.set(x, y, POOL[Math.min(4, i + (pos - i > th ? 1 : 0))]);
          }
          else if (m === 2 && y > sea) {
            const n = U.fbm2(x * 0.05, y * 0.05, seed);
            P.set(x, y, U.scale(pal.air, 0.8 + n * 0.4 + (((x + y) & 1) && n > 0.6 ? 0.08 : 0)));
          } else if (pal.backwall && m === 0) {
            // faint, large-scale back wall so enclosed water reads as a cave without getting busy
            const n = U.noise2(x * 0.02, y * 0.03, seed + 5);
            if (n > 0.55) P.set(x, y, U.scale(pal.rock[2], 0.75 * depthF), 50);
          }
          continue;
        }
        const mp = W.mat[i] ? matPal[W.mat[i]] : pal;
        const d = W.dist[i] / 2;
        let td = 8;
        if (d < 9) { td = 0; while (td < 8 && W.mask[i - (td + 1) * ww] === 1 && y - td - 1 >= 0) td++; }
        const n = U.fbm2(x * 0.07, y * 0.09, seed);
        const h = U.hash2(x, y, seed);
        const sandT = 3 + Math.floor(U.noise1(x * 0.1, seed) * 4);
        let c;
        if (td < sandT) {
          if (td === 0) c = U.scale(mp.top[0], 1.08);
          else {
            const k = td + (((x + y) & 1) && n > 0.5 ? 1 : 0);
            c = mp.top[k < sandT * 0.5 ? 0 : k < sandT ? 1 : 2] || mp.top[1];
            if (td === sandT - 1 && ((x + y) & 1)) c = mp.rock[0];
          }
          if (mp.style === 'mossy' && td < 2) c = mp.accent;
        } else {
          // Calm cross-section: a few depth bands (distance from open water/air) with softly
          // wobbling, ordered-dithered boundaries. Detail lives at the surface, the body stays quiet.
          let dw = d + (U.noise2(x * 0.035, y * 0.035, seed) - 0.5) * 7;
          if (mp.style === 'strata' || mp.style === 'ice') dw += Math.sin(y * 0.28 + U.noise1(x * 0.02, seed) * 3) * 2.2;
          const th = BAYER[y & 3][x & 3];
          const band = (lim) => dw + (th - 0.5) * 3 < lim;
          c = band(7) ? mp.rock[0] : band(16) ? mp.rock[1] : band(30) ? mp.rock[2] : U.scale(mp.rock[2], mp.style === 'ice' ? 0.9 : 0.66);
          if (d <= 1) c = W.mask[i + ww] !== 1 ? U.scale(mp.rock[2], 0.82) : U.scale(mp.rock[0], 1.08);
          if (mp.style === 'ice' && ((x * 2 + y) % 13 === 0) && d < 10) c = U.scale(mp.rock[0], 1.12);
          if (mp.style === 'wood' && y % 5 === 0) c = U.scale(mp.rock[2], 0.85);
          if (mp.style === 'wood' && (x * 7 + Math.floor(y / 5) * 13) % 23 === 0) c = U.scale(mp.rock[2], 0.7);
          if (mp.style === 'metal' && x % 9 === 0 && y % 4 === 0) c = U.scale(mp.rock[0], 1.2);
          if (mp.embers && h < 0.006 && d < 20) c = mp.accent;
          else if (h < 0.004 && d < 14) c = U.scale(c, 1.12);
        }
        P.set(x, y, U.scale(c, depthF));
      }
    }
  }

  // Surface points (open pixel directly above/below solid) owned by the biome.
  function scanSurfaces(W, b, x0, y0, x1, y1) {
    const floors = [], ceilings = [];
    for (let x = x0; x < x1; x++) for (let y = y0 + 1; y < y1 - 1; y++) {
      if (W.solid(x, y)) continue;
      if (W.solid(x, y + 1) && W.biomeAt(x, y) === b) floors.push([x, y]);
      if (W.solid(x, y - 1) && W.biomeAt(x, y) === b) ceilings.push([x, y]);
    }
    return { floors, ceilings };
  }

  function placeProps(W, b, spec, surf, rng) {
    const out = [];
    const inArea = (p) => (!spec.area || (p[0] >= spec.area[0] && p[0] < spec.area[1])) &&
      (!spec.y || (p[1] >= spec.y[0] && p[1] < spec.y[1])) &&
      (spec.air ? true : spec.airOnly ? W.air(p[0], p[1]) : (W.water(p[0], p[1]) && p[1] >= W.sea));
    if (spec.at === 'points') return spec.points.slice();
    if (spec.at === 'waterline') {
      const [rx, ry, rw, rh] = b.rect;
      for (let i = 0; i < (spec.n || 10) * 40 && out.length < (spec.n || 10); i++) {
        const x = Math.floor(rng.range(rx, rx + rw));
        for (let y = Math.max(ry, W.sea + 1); y < ry + rh; y++) if (W.water(x, y) && W.air(x, y - 1) && W.biomeAt(x, y) === b) { out.push([x, y]); break; }
      }
      return out;
    }
    let pool = spec.at === 'ceiling' ? surf.ceilings : surf.floors;
    if (spec.at === 'water') {
      for (let i = 0; i < (spec.n || 10) * 20 && out.length < (spec.n || 10); i++) {
        const [rx, ry, rw, rh] = b.rect;
        const p = [Math.floor(rng.range(rx, rx + rw)), Math.floor(rng.range(Math.max(ry, W.sea), ry + rh))];
        if (W.biomeAt(p[0], p[1]) === b && inArea(p) && W.depthDist(p[0], p[1]) === 0) out.push(p);
      }
      return out;
    }
    pool = pool.filter(inArea);
    if (!pool.length) return out;
    if (spec.every) {
      // roughly even spacing along x
      const byX = new Map();
      pool.forEach((p) => { const k = Math.floor(p[0] / spec.every); if (!byX.has(k) || rng() < 0.3) byX.set(k, p); });
      byX.forEach((p) => { if (rng() < (spec.chance === undefined ? 1 : spec.chance)) out.push(p); });
      return out;
    }
    for (let i = 0; i < (spec.n || 10); i++) out.push(pool[Math.floor(rng() * pool.length)]);
    return out;
  }

  // ---------------------------------------------------------------- props
  const C = (h) => hex(h);
  const PROPS = {};

  PROPS.seagrass = function (P, x, y, r, b, pal, s) {
    const cols = (s.colors || ['#5f9a3e', '#4b8133', '#78b04a']).map(C);
    const n = r.int(3, 6), H = s.h || [6, 15];
    for (let k = 0; k < n; k++) {
      const bx = x + k * 2 - n, h = r.range(H[0], H[1]), lean = r.range(-0.25, 0.25), c = cols[k % cols.length];
      for (let j = 0; j < h; j++) P.setOpen(bx + Math.sin(j * 0.35 + k) * j * 0.08 + lean * j, y - j, c);
    }
  };
  PROPS.algae = function (P, x, y, r, b, pal, s) {
    const c = C(s.color || '#5d9440');
    for (let i = 0; i < 6; i++) { const dx = r.int(-4, 4); P.setOpen(x + dx, y - r.int(0, 2), r.chance(0.5) ? c : U.scale(c, 1.2)); }
  };
  PROPS.rock = function (P, x, y, r, b, pal, s) {
    const rx = r.range(s.r ? s.r[0] : 3, s.r ? s.r[1] : 7), ry = rx * r.range(0.55, 0.8);
    const base = s.color ? C(s.color) : U.scale(pal.rock[0], 1.05);
    P.ellipse(x, y - ry * 0.5 + 1, rx, ry, (dx, dy, q) => {
      if (q > 0.78) return U.scale(base, 0.62);
      return dy < -0.35 && dx < 0.3 ? U.scale(base, 1.18) : dy > 0.35 ? U.scale(base, 0.82) : base;
    });
    if (s.barnacles) for (let i = 0; i < 4; i++) P.set(x + r.range(-rx * 0.6, rx * 0.6), y - ry * r.range(0.5, 1.1), [230, 225, 205]);
  };
  PROPS.pebbles = function (P, x, y, r, b, pal) {
    for (let i = 0; i < 4; i++) P.setOpen(x + r.int(-5, 5), y, U.scale(pal.rock[r.int(0, 2)], 1.2));
  };
  PROPS.anemone = function (P, x, y, r, b, pal, s) {
    const c = C(r.pick(s.colors || ['#e86fa8', '#b56fe8', '#f29a5c', '#5fd6c4'])), tip = U.scale(c, 1.35);
    P.line(x, y, x, y - 2, U.scale(c, 0.7), true); P.line(x + 1, y, x + 1, y - 2, U.scale(c, 0.6), true);
    for (let k = -3; k <= 4; k++) { const h = 3 + (Math.abs(k) < 2 ? 2 : 0); P.line(x, y - 3, x + k, y - 3 - h, c, true); P.setOpen(x + k, y - 3 - h, tip); }
  };
  PROPS.urchin = function (P, x, y, r) {
    const c = [70, 40, 90];
    P.ellipse(x, y - 2, 2.5, 2, c);
    for (let a = 0; a < 8; a++) { const ang = Math.PI + (a / 7) * Math.PI; P.line(x + Math.cos(ang) * 2, y - 2 + Math.sin(ang) * 2, x + Math.cos(ang) * 5, y - 2 + Math.sin(ang) * 5, [110, 70, 140], true); }
  };
  PROPS.starfish = function (P, x, y, r) {
    const c = C(r.pick(['#f08a3c', '#e8604a', '#f2c14e']));
    P.set(x, y, c); P.set(x - 1, y, c); P.set(x + 1, y, c); P.set(x - 2, y + 1, c); P.set(x + 2, y + 1, c); P.set(x, y - 1, c); P.set(x, y - 2, U.scale(c, 1.1));
  };
  PROPS.shell = function (P, x, y, r) {
    const c = C(r.pick(['#f4e6d0', '#e9c7b0', '#f0d9a8']));
    P.set(x, y, c); P.set(x + 1, y, c); P.set(x - 1, y, U.scale(c, 0.8)); P.set(x, y - 1, U.scale(c, 1.1));
  };
  PROPS.coral = function (P, x, y, r, b, pal, s) {
    const kinds = s.kinds || ['branch', 'fan', 'brain', 'tube', 'table'];
    const kind = r.pick(kinds);
    const c = C(r.pick(s.colors || ['#f58a78', '#f2b05e', '#c99ae0', '#6fcfc0'])), hi = U.scale(c, 1.25), lo = U.scale(c, 0.7);
    const sc = r.range(0.8, 1.5) * (s.scale || 1);
    if (kind === 'branch') {
      const grow = (gx, gy, a, len, d) => {
        const x2 = gx + Math.cos(a) * len, y2 = gy + Math.sin(a) * len;
        P.line(gx, gy, x2, y2, c, true); P.line(gx + 1, gy, x2 + 1, y2, lo, true);
        if (d > 0) { grow(x2, y2, a - r.range(0.35, 0.7), len * 0.72, d - 1); grow(x2, y2, a + r.range(0.35, 0.7), len * 0.72, d - 1); }
        else P.setOpen(x2, y2, hi);
      };
      grow(x, y, -Math.PI / 2 + r.range(-0.2, 0.2), 6 * sc, 3);
    } else if (kind === 'fan') {
      const R = 8 * sc;
      for (let a = -Math.PI; a <= 0; a += 0.16) P.line(x, y, x + Math.cos(a) * R, y + Math.sin(a) * R * 1.1, (Math.round(a * 10) % 2) ? c : lo, true);
      for (let rr = 3; rr < R; rr += 3) for (let a = -Math.PI; a <= 0; a += 0.08) P.setOpen(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 1.1, hi);
    } else if (kind === 'brain') {
      const R = 5 * sc;
      P.ellipse(x, y, R, R * 0.8, (dx, dy) => (dy > 0 ? null : Math.sin((x + dx * R) * 1.4 + Math.sin((y + dy * R) * 1.1) * 2.5) > 0.5 ? hi : dy < -0.6 ? hi : c));
    } else if (kind === 'tube') {
      for (let k = 0; k < r.int(3, 6); k++) {
        const tx = x + k * 3 - 6, th = r.range(4, 11) * sc;
        P.line(tx, y, tx, y - th, c, true); P.line(tx + 1, y, tx + 1, y - th, lo, true);
        P.setOpen(tx, y - th - 1, hi); P.setOpen(tx + 1, y - th - 1, hi);
      }
    } else if (kind === 'table') {
      const th = r.range(4, 8) * sc, tw = r.range(5, 10) * sc;
      P.line(x, y, x, y - th, lo, true);
      for (let i = -tw; i <= tw; i++) { P.setOpen(x + i, y - th, c); P.setOpen(x + i, y - th - 1, Math.abs(i) < tw - 1 ? hi : c); }
    }
  };
  PROPS.kelp = function (P, x, y, r, b, pal, s) {
    const shade = r.range(0.7, 1.1);
    const cols = (s.colors || ['#6b8a2c', '#557024', '#87a63a']).map((h) => U.scale(C(h), shade)), bl = U.scale(C('#b5a83a'), shade);
    const top = AQ.World.sea + r.range(s.topGap ? s.topGap[0] : 4, s.topGap ? s.topGap[1] : 150);
    const ph = r.range(0, 6), amp = r.range(2, 5), freq = r.range(0.025, 0.05);
    let px = x, k = 0;
    for (let yy = y; yy > top; yy--) {
      px = x + Math.sin((y - yy) * freq + ph) * amp;
      P.setOpen(px, yy, cols[1], s.alpha); P.setOpen(px + 1, yy, cols[0], s.alpha);
      if ((y - yy) % 9 === 4 && !s.sparse) {
        const dir = (k++ % 2) ? 1 : -1, len = r.int(5, 9), droop = r.range(0.2, 0.6);
        for (let j = 1; j <= len; j++) {
          const lx = px + dir * j, ly = yy - j * 0.7 + j * j * droop * 0.12;
          P.setOpen(lx, ly, j > len - 2 ? cols[2] : cols[0], s.alpha);
          if (j > 1 && j < len - 1) P.setOpen(lx, ly + 1, cols[1], s.alpha);
        }
        P.setOpen(px + dir, yy + 1, bl, s.alpha); P.setOpen(px + dir * 2, yy + 1, bl, s.alpha);
      }
    }
    for (let j = -4; j <= 4; j++) P.setOpen(px + j, top - Math.abs(j) * 0.6 + (j > 0 ? 1 : 0), cols[2], s.alpha);
  };
  // Mangrove (like the real thing): a short trunk standing on a cage of arching prop roots that
  // reach out and down into the mud, a dense rounded crown of small leaves, and pencil-like
  // breathing roots (pneumatophores) poking up from the mud around it.
  PROPS.mangrove = function (P, x, y, r, b, pal, s, T) {
    const W = AQ.World, sea = W.sea;
    const bark = C('#6b4b2f'), barkL = C('#8a6644'), barkD = C('#4a3220');
    const leaf = [C('#2f6b2c'), C('#3f8236'), C('#58a046'), C('#24522a')];
    const ground = (gx) => W.groundBelow(Math.round(gx), sea - 4, 300) || (sea + 90);
    const base = sea - r.range(10, 16);                 // where the trunk splits into roots
    const top = sea - r.range(44, 54);
    // prop roots: arcs from the trunk out and down into the mud, front and back
    const nRoots = r.int(9, 13);
    for (let k = 0; k < nRoots; k++) {
      // deeper mud -> the roots splay wider (a tall cage of roots instead of thin strings)
      const side = k % 2 ? 1 : -1, depth = Math.max(0, (ground(x) - sea) - 90), reach = r.range(8, 38) + depth * r.range(0.25, 0.5), ex = x + side * reach, gy = ground(ex);
      const sy = base + r.range(-6, 6), sx = x + side * r.range(0, 2);
      const cx = x + side * reach * r.range(0.45, 0.7), cy = sy - r.range(6, 16);   // arch up, then down
      const steps = Math.ceil((reach + (gy - sy)) * 1.6);
      const col = k % 3 === 0 ? barkD : bark;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = (1 - t) * (1 - t), bb = 2 * (1 - t) * t, c2 = t * t;
        const px = a * sx + bb * cx + c2 * ex, py = a * sy + bb * cy + c2 * gy;
        P.set(px, py, col); P.set(px, py + 1, t < 0.5 ? barkL : col);
        if (depth > 0 && t > 0.35) P.set(px + side, py, t > 0.75 ? barkD : col);       // thicker lower down
        if (depth > 0 && t > 0.8) P.set(px - side, py, barkD);
      }
    }
    // trunk
    for (let yy = base + 4; yy > top; yy--) { P.set(x - 1, yy, barkD); P.set(x, yy, bark); P.set(x + 1, yy, barkL); P.set(x + 2, yy, bark); }
    for (let k = 0; k < 3; k++) { const dir = k - 1; for (let i = 0; i < 10; i++) P.set(x + dir * i * 0.9, top + 6 - i * 0.6, bark); }
    // crown: many small leaf clusters, darker underneath, a few light highlights on top
    const cw = r.range(26, 34);
    for (let k = 0; k < 60; k++) {
      const ang = r.range(Math.PI, Math.PI * 2), rad = Math.sqrt(r()) ;
      const lx = x + Math.cos(ang) * cw * rad, ly = top - 2 + Math.sin(ang) * 16 * rad + 6;
      const rr = r.range(2.5, 4.5);
      P.ellipse(lx, ly, rr, rr * 0.75, (dx, dy) => leaf[dy > 0.35 ? 3 : dy < -0.4 ? 2 : (U.hash2(Math.round(lx + dx * 9), Math.round(ly + dy * 9), 5) < 0.3 ? 1 : 0)]);
    }
    for (let k = 0; k < 14; k++) P.set(x + r.range(-cw * 0.8, cw * 0.8), top - 14 + r.range(0, 8), leaf[2]);
    // pneumatophores on the mud
    for (let k = 0; k < 10; k++) {
      const px = x + r.range(-44, 44), gy = ground(px), h = r.int(3, 7);
      if (gy > sea + 120) continue;
      for (let j = 1; j <= h; j++) P.setOpen(px, gy - j, j === h ? barkL : barkD);
    }
  };
  PROPS.lilypad = function (P, x, y, r) {
    const c = C(r.pick(['#4f9a48', '#5fae52', '#468a40'])), d = U.scale(c, 0.75), w = r.int(3, 5);
    for (let i = -w; i <= w; i++) P.set(x + i, y - 1, Math.abs(i) === w ? d : c);
    P.set(x + 1, y - 1, d);                                   // the notch
    if (r.chance(0.35)) { const f = C(r.pick(['#ffb3d1', '#ffffff', '#f2d16b'])); P.set(x - 1, y - 2, f); P.set(x, y - 3, f); P.set(x + 1, y - 2, f); P.set(x, y - 2, C('#f2d16b')); }
  };
  PROPS.flowerbed = function (P, x, y, r) {
    const cols = ['#ff9fc8', '#c9a2ff', '#ffd27a', '#9ff0d0'].map(C);
    for (let k = 0; k < r.int(4, 7); k++) {
      const fx = x + r.int(-5, 5), h = r.int(1, 4), c = r.pick(cols);
      for (let j = 0; j < h; j++) P.setOpen(fx, y - j, C('#4f9440'));
      P.setOpen(fx, y - h, c); P.setOpen(fx - 1, y - h, U.scale(c, 0.85)); P.setOpen(fx + 1, y - h, U.scale(c, 0.85)); P.setOpen(fx, y - h - 1, U.scale(c, 1.15));
    }
  };
  PROPS.glowvine = function (P, x, y, r, b, pal, s, T) {
    const len = r.range(10, 30), cols = [C('#4f9440'), C('#6fb556')], bulb = C(r.pick(['#a8ffe0', '#ffe9a0', '#d9b8ff']));
    for (let j = 0; j < len; j++) P.setOpen(x + Math.sin(j * 0.3) * 1.2, y + j, cols[j % 4 === 0 ? 1 : 0]);
    const ex = x + Math.sin(len * 0.3) * 1.2, ey = y + len;
    P.setOpen(ex, ey, bulb); P.setOpen(ex - 1, ey + 1, bulb); P.setOpen(ex + 1, ey + 1, bulb); P.setOpen(ex, ey + 1, U.scale(bulb, 1.2)); P.setOpen(ex, ey + 2, bulb);
    T.lights.push({ x: ex, y: ey + 1, r: 14, color: U.css(bulb), power: 0.6 });
  };
  PROPS.plank = function (P, x, y, r) {
    const c = C('#7a5432'), d = U.scale(c, 0.7), len = r.int(8, 18), a = r.range(-0.3, 0.3);
    for (let i = 0; i < len; i++) { P.setOpen(x + i * Math.cos(a) - len / 2, y - 1 + i * Math.sin(a), c); P.setOpen(x + i * Math.cos(a) - len / 2, y + i * Math.sin(a), d); }
  };
  // Background mast (scenery only: you swim in front of it). y = its foot, s.h = height.
  PROPS.mast = function (P, x, y, r, b, pal, s) {
    const c = C('#7a5636'), hl = U.scale(c, 1.15), dk = U.scale(c, 0.7), h = (s && s.h) || 60;
    for (let j = 0; j < h; j++) for (let i = 0; i < 4; i++) {
      const band = j % 10 === 6;
      P.set(x - 2 + i, y - j, band ? dk : i === 0 ? hl : i === 3 ? dk : c);
    }
    for (let i = -1; i < 5; i++) P.set(x - 2 + i, y - h, U.scale(c, 0.9));   // cap
  };
  PROPS.flag = function (P, x, y, r) {
    const c = C('#d94a3a'), d = U.scale(c, 0.75);
    for (let j = 0; j < 9; j++) for (let i = 0; i < 12 - j * 1.2; i++) P.set(x + 2 + i, y + j - Math.round(Math.sin(i * 0.5) * 0.8), (i + j) % 5 === 0 ? d : c);
  };
  PROPS.barrel = function (P, x, y, r) {
    const c = C('#8a5b33');
    P.ellipse(x, y - 5, 4, 5, (dx, dy) => (Math.abs(dy) > 0.55 && Math.abs(dy) < 0.75 ? [90, 90, 96] : dx < -0.4 ? U.scale(c, 1.15) : dx > 0.5 ? U.scale(c, 0.75) : c));
  };
  PROPS.crate = function (P, x, y, r) {
    const c = C('#8a6a3a'), s = r.int(5, 8);
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) P.set(x - s / 2 + i, y - j, (i === 0 || j === 0 || i === s - 1 || j === s - 1 || i === j) ? U.scale(c, 0.7) : c);
  };
  PROPS.chain = function (P, x, y, r) {
    const c = [110, 100, 92], len = r.int(10, 30);
    for (let i = 0; i < len; i++) P.setOpen(x + Math.sin(i * 0.2) * 2, y - i, i % 3 ? c : [70, 64, 60]);
  };
  PROPS.anchor = function (P, x, y) {
    const c = [96, 90, 86];
    P.line(x, y - 2, x, y - 16, c); P.line(x - 4, y - 13, x + 4, y - 13, c);
    for (let a = 0.2; a < Math.PI - 0.2; a += 0.15) P.set(x + Math.cos(a) * 6, y - 3 + Math.sin(a) * 3 - 3, c);
  };
  PROPS.tubeworms = function (P, x, y, r) {
    for (let k = 0; k < r.int(3, 7); k++) {
      const tx = x + k * 2 - 5, th = r.int(4, 11);
      P.line(tx, y, tx, y - th, [225, 220, 210], true);
      P.setOpen(tx, y - th - 1, [230, 60, 60]); P.setOpen(tx, y - th - 2, [255, 110, 90]);
    }
  };
  PROPS.ventcrack = function (P, x, y, r, b, pal, s, T) {
    const c1 = C('#ff8a3a'), c2 = C('#ffd27a');
    let cx = x - 6;
    for (let i = 0; i < 12; i++) { cx += 1; P.set(cx, y + 1 + Math.round(Math.sin(i * 1.3)), i % 3 ? c1 : c2); }
    T.lights.push({ x, y: y - 2, r: 30, color: '#ff7a2a', flicker: true, power: 0.9 });
  };
  PROPS.bones = function (P, x, y, r) {
    const c = [214, 210, 196];
    for (let k = 0; k < 5; k++) for (let a = Math.PI; a < Math.PI * 2; a += 0.2) P.setOpen(x + k * 3 + Math.cos(a) * 2, y + Math.sin(a) * (6 - k), c);
    P.line(x - 2, y - 1, x + 16, y - 1, c, true);
  };
  PROPS.spire = function (P, x, y, r, b, pal) {
    const h = r.range(14, 40), c = U.scale(pal.rock[0], 0.9);
    for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((1 - j / h) * 3)); for (let i = -w; i <= w; i++) P.set(x + i, y - j, i === -w ? U.scale(c, 1.2) : c); }
  };
  PROPS.stalactite = function (P, x, y, r, b, pal) {
    const h = r.range(5, 16), c = U.scale(pal.rock[0], 1.05);
    for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((1 - j / h) * 2.5)); for (let i = -w; i <= w; i++) P.setOpen(x + i, y + j, i === -w ? U.scale(c, 1.2) : c); }
  };
  PROPS.stalagmite = function (P, x, y, r, b, pal) {
    const h = r.range(4, 12), c = U.scale(pal.rock[0], 1.05);
    for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((1 - j / h) * 3)); for (let i = -w; i <= w; i++) P.setOpen(x + i, y - j, i === -w ? U.scale(c, 1.2) : c); }
  };
  PROPS.icicle = function (P, x, y, r) {
    const h = r.range(3, 9);
    for (let j = 0; j < h; j++) { P.setOpen(x, y + j, j < h - 2 ? [200, 235, 250] : [240, 252, 255]); if (j < h / 2) P.setOpen(x + 1, y + j, [160, 210, 235]); }
  };
  PROPS.crystal = function (P, x, y, r, b, pal, s, T) {
    const c = C(r.pick(s.colors || ['#9f7fe8', '#6fd6e8', '#e87fd0'])), hi = U.scale(c, 1.35);
    for (let k = 0; k < r.int(2, 4); k++) {
      const cx = x + r.range(-4, 4), h = r.range(4, 10), lean = r.range(-0.4, 0.4), dir = s.at === 'ceiling' ? 1 : -1;
      for (let j = 0; j < h; j++) { P.setOpen(cx + lean * j, y + dir * j, j > h - 2 ? hi : c); P.setOpen(cx + lean * j + 1, y + dir * j, U.scale(c, 0.75)); }
    }
    T.lights.push({ x, y: y - 4, r: 24, color: s.light || '#9fd8ff', power: 0.8 });
  };
  PROPS.vine = function (P, x, y, r) {
    const len = r.range(8, 34), cols = [C('#4f9440'), C('#6fb556'), C('#3c7a33')];
    for (let j = 0; j < len; j++) {
      const px = x + Math.sin(j * 0.25) * 1.5;
      P.setOpen(px, y + j, cols[j % 3 === 0 ? 1 : 0]);
      if (j % 4 === 2) P.setOpen(px + (j % 8 === 2 ? 1 : -1), y + j, cols[2]);
    }
    if (r.chance(0.4)) P.setOpen(x + Math.sin(len * 0.25) * 1.5, y + len, C('#ff9fd0'));
  };
  PROPS.fern = function (P, x, y, r) {
    const cols = [C('#5aa04a'), C('#7cc25e'), C('#3f7f37')];
    for (let k = -2; k <= 2; k++) for (let j = 0; j < 8 - Math.abs(k) * 1.2; j++) P.setOpen(x + k * j * 0.5, y - j, cols[(j + k + 9) % 3]);
  };
  PROPS.glowshroom = function (P, x, y, r, b, pal, s, T) {
    const cap = C(r.pick(['#8ff0c8', '#c9a2ff', '#9fe0ff'])), stem = [220, 225, 210];
    const h = r.int(2, 5);
    P.line(x, y, x, y - h, stem, true);
    for (let i = -2; i <= 2; i++) P.setOpen(x + i, y - h - 1, cap);
    for (let i = -1; i <= 1; i++) P.setOpen(x + i, y - h - 2, U.scale(cap, 1.2));
    T.lights.push({ x, y: y - h - 1, r: 16, color: U.css(cap), power: 0.7 });
  };
  PROPS.snow = function (P, x, y, r) {
    for (let i = -4; i <= 4; i++) P.setOpen(x + i, y, [245, 252, 255]);
  };
  PROPS.poolrim = function (P, x, y, r) {
    // little algae/barnacle fringe used around tide pools
    for (let i = 0; i < 3; i++) P.set(x + r.int(-2, 2), y + r.int(0, 1), r.chance(0.5) ? [93, 148, 64] : [230, 225, 205]);
  };

  // ---------------------------------------------------------------- draw
  T.draw = function (ctx, cam) {
    const l = cam.left(), t = cam.top();
    for (const c of T.chunks) {
      if (c.x > l + cam.w || c.x + c.w < l || c.y > t + cam.h || c.y + c.h < t) continue;
      ctx.drawImage(c.canvas, c.x - l, c.y - t);
    }
  };
  T.drawFront = function (ctx, cam) {
    const l = cam.left(), t = cam.top();
    for (const c of T.chunks) {
      if (!c.front || c.x > l + cam.w || c.x + c.w < l || c.y > t + cam.h || c.y + c.h < t) continue;
      ctx.drawImage(c.front, c.x - l, c.y - t);
    }
  };

  // Minimap: 1 px per 16 world px
  function buildMinimap(W) {
    const S = 22, mw = Math.ceil(W.w / S), mh = Math.ceil(W.h / S);
    const c = document.createElement('canvas'); c.width = mw; c.height = mh;
    const x = c.getContext('2d'), img = x.createImageData(mw, mh);
    for (let my = 0; my < mh; my++) for (let mx = 0; mx < mw; mx++) {
      const wx = mx * S + S / 2, wy = my * S + S / 2, m = W.at(wx, wy), i = (my * mw + mx) * 4;
      let col;
      if (m === 1) { const d = W.depthDist(wx, wy) / 2; col = d < S ? U.scale(hex(W.biomeAt(wx, wy).palette.top[1]), 0.85) : U.scale([78, 70, 66], 1 - Math.min(0.5, d / 200)); }
      else if (m === 2) col = wy < W.sea ? [150, 210, 230] : [60, 70, 70];
      else col = U.scale(hex(W.biomeAt(wx, wy).water || '#2a7fa8'), 0.55 + 0.45 * (1 - U.clamp((wy - W.sea) / 1200, 0, 1)));
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // label anchor = centroid of each biome's open water
    const labels = W.biomes.map((b) => {
      let sx = 0, sy = 0, n = 0;
      for (let y = Math.max(W.sea, b.rect[1]); y < b.rect[1] + b.rect[3]; y += 8) for (let xx = b.rect[0]; xx < b.rect[0] + b.rect[2]; xx += 8) if (W.water(xx, y) && W.biomeAt(xx, y) === b) { sx += xx; sy += y; n++; }
      return { b, x: n ? sx / n / S : (b.rect[0] + b.rect[2] / 2) / S, y: n ? sy / n / S : 10 };
    });
    T.minimap = { canvas: c, scale: S, labels };
  }

  return T;
})();
