// Procedural placeholder pixel art. Shared by tools/gen-placeholders.js (writes PNGs)
// and the browser (fallback when a sprite file is missing). Real art replaces the PNGs.
(function (root) {
  const PH = {};

  // ---------- pixel buffer ----------
  // w/h = the drawing size shapes see; `pad` adds a hidden margin around it so nothing drawn
  // slightly outside the frame is lost (buildSheet then fits the result back into the frame).
  function Pix(w, h, pad = 0) {
    this.w = w; this.h = h; this.pad = pad; this.bw = w + pad * 2; this.bh = h + pad * 2;
    this.d = new Uint8ClampedArray(this.bw * this.bh * 4);
  }
  Pix.prototype.idx = function (x, y) {
    x = Math.round(x) + this.pad; y = Math.round(y) + this.pad;
    return (x < 0 || y < 0 || x >= this.bw || y >= this.bh) ? -1 : (y * this.bw + x) * 4;
  };
  Pix.prototype.get = function (x, y) { const i = this.idx(x, y); return i < 0 ? null : [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; };
  Pix.prototype.a = function (x, y) { const i = this.idx(x, y); return i < 0 ? 0 : this.d[i + 3]; };
  Pix.prototype.set = function (x, y, c) {
    if (!c) return;
    const i = this.idx(x + (this.ox || 0), y + (this.oy || 0));   // ox/oy: drawing offsets
    if (i < 0) return;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3] === undefined ? 255 : c[3];
  };
  Pix.prototype.ellipse = function (cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
  };
  Pix.prototype.circle = function (cx, cy, r, c) { this.ellipse(cx, cy, Math.max(0.6, r), Math.max(0.6, r), c); };
  Pix.prototype.rect = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); };
  Pix.prototype.line = function (x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 500; n++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  Pix.prototype.tri = function (a, b, c, col) {
    const minX = Math.floor(Math.min(a[0], b[0], c[0])), maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
    const minY = Math.floor(Math.min(a[1], b[1], c[1])), maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
    const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];
      const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) this.set(x, y, col);
    }
  };
  // Light top edges, darken bottom edges -> instant pixel-art volume. (Works on the padded buffer.)
  Pix.prototype.shade = function (amt = 0.22) {
    const src = new Uint8ClampedArray(this.d), W = this.bw, H = this.bh;
    const A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : src[(y * W + x) * 4 + 3];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!src[i + 3]) continue;
      let f = 1;
      if (!A(x, y - 1)) f = 1 + amt; else if (!A(x, y + 1)) f = 1 - amt; else if (!A(x, y + 2)) f = 1 - amt * 0.5;
      if (f !== 1) { this.d[i] = Math.min(255, src[i] * f); this.d[i + 1] = Math.min(255, src[i + 1] * f); this.d[i + 2] = Math.min(255, src[i + 2] * f); }
    }
  };
  Pix.prototype.outline = function (f = 0.35) {
    const src = new Uint8ClampedArray(this.d), W = this.bw, H = this.bh;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? -1 : (y * W + x) * 4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = at(x, y);
      if (src[i + 3]) continue;
      let n = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = at(x + dx, y + dy); if (j >= 0 && src[j + 3] > 100) { n = j; break; } }
      if (n >= 0) { this.d[i] = src[n] * f; this.d[i + 1] = src[n + 1] * f; this.d[i + 2] = src[n + 2] * f + 8; this.d[i + 3] = 255; }
    }
  };
  // Copies src's buffer region (sx,sy,w,h) into this pix at (dx,dy) (both in raw buffer coords).
  Pix.prototype.copyFrom = function (src, sx, sy, w, h, dx, dy) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = sx + x, Y = sy + y;
      if (X < 0 || Y < 0 || X >= src.bw || Y >= src.bh) continue;
      const i = (Y * src.bw + X) * 4;
      if (!src.d[i + 3]) continue;
      const j = ((dy + y) * this.bw + (dx + x)) * 4;
      this.d[j] = src.d[i]; this.d[j + 1] = src.d[i + 1]; this.d[j + 2] = src.d[i + 2]; this.d[j + 3] = src.d[i + 3];
    }
  };
  PH.Pix = Pix;

  // ---------- color helpers ----------
  const hex = (h) => { h = String(h || '#ff00ff').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]; };
  const mul = (c, f) => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f), c[3]];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255];
  const alpha = (c, a) => [c[0], c[1], c[2], a];
  const WHITE = [255, 255, 255, 255], BLACK = [20, 18, 30, 255];
  PH.hex = hex;

  function eye(p, x, y, big) {
    if (big) { p.set(x, y, WHITE); p.set(x + 1, y, BLACK); p.set(x + 1, y - 1, WHITE); }
    else p.set(x, y, BLACK);
  }

  // ---------- creature shapes (all face RIGHT) ----------
  const S = {};

  S.fish = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const len = W * 0.58 * (o.long || 1), h = H * 0.34 * (o.tall || 1);
    const wig = Math.round(Math.sin(ph) * (o.moving ? 1.6 : 0.8));
    const bob = Math.round(Math.sin(ph) * 0.5);
    const cx = W / 2 + W * 0.07, cy = H / 2 + bob;
    const tailX = cx - len / 2 + 1, tailL = len * (o.shark ? 0.42 : 0.34);
    p.tri([tailX + 1, cy], [tailX - tailL, cy - h * 0.62 + wig], [tailX - tailL * 0.7, cy + wig * 0.5], o.a);
    p.tri([tailX + 1, cy], [tailX - tailL, cy + h * 0.62 + wig], [tailX - tailL * 0.7, cy + wig * 0.5], o.a);
    const dh = o.shark ? h * 0.9 : h * 0.45;
    p.tri([cx - len * 0.2, cy - h / 2 + 1], [cx + len * 0.12, cy - h / 2 + 1], [cx - len * 0.22, cy - h / 2 - dh], o.shark ? o.c : o.a);
    p.ellipse(cx, cy, len / 2, h / 2, o.c);
    if (o.shark || o.dolphin) p.tri([cx + len / 2 - 3, cy - h * 0.3], [cx + len / 2 - 3, cy + h * 0.25], [cx + len / 2 + (o.dolphin ? 4 : 3), cy + 1], o.c);
    p.ellipse(cx + 1, cy + h * 0.22, len / 2 - 2, h / 4, mix(o.c, WHITE, o.belly === false ? 0 : 0.4));
    if (o.stripes) for (let i = -1; i <= 1; i++) for (let y = -h / 2; y < h / 2; y++) if (p.a(Math.round(cx + i * len * 0.22), Math.round(cy + y))) p.set(cx + i * len * 0.22, cy + y, mul(o.c, 0.7));
    if (o.fan) { p.tri([cx - 2, cy + 1], [cx - 7, cy + h * 0.9 + wig], [cx + 2, cy + h * 0.7], o.a); p.tri([cx - 4, cy - h / 2], [cx + 4, cy - h / 2], [cx - 2, cy - h * 1.2], o.a); }
    p.shade();
    if (o.wing) { p.line(cx - 1, cy, cx - 6, cy - h * 0.8 - wig, alpha(WHITE, 200)); p.line(cx, cy, cx - 5, cy - h * 0.7 - wig, alpha(WHITE, 160)); }
    if (o.starry) {                     // a row of tiny belly lamps + a twinkle on the tail (Starfall Minnow)
      for (let i = -1; i <= 1; i++) p.set(Math.round(cx + i * len * 0.2), Math.round(cy + h * 0.28), (o.frame + i + 3) % 4 === 0 ? WHITE : o.a);
      p.set(Math.round(tailX - tailL * 0.8), Math.round(cy + wig * 0.5), o.frame % 2 ? WHITE : o.a);
    }
    if (o.blackEye) { const ex = Math.round(cx + len * 0.27), ey = Math.round(cy - h * 0.12); p.rect(ex, ey, W >= 20 ? 2 : 1, W >= 20 ? 2 : 1, BLACK); }
    else if (!o.eyeless) eye(p, Math.round(cx + len * 0.27), Math.round(cy - h * 0.12), W >= 20);
    p.outline();
    if (o.lure) {
      const lx = cx + len * 0.32, ly = cy - h / 2;
      p.line(lx, ly, lx + W * 0.12, ly - H * 0.16, mul(o.c, 0.6));
      p.circle(lx + W * 0.14, ly - H * 0.18, 1.2, o.glow || [180, 255, 240, 255]);
    }
  };

  S.eel = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, N = 14;
    const cy = H / 2, amp = H * (o.moving ? 0.16 : 0.1), th = H * 0.12 * (o.thick || 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = 2 + u * (W - 6), y = cy + Math.sin(u * 5 + ph) * amp * (1 - u * 0.6);
      const band = o.bands && i % 3 === 0;
      p.circle(x, y, 0.8 + th * Math.min(1, u * 1.4), band ? o.a : o.c);
    }
    const hy = cy + Math.sin(5 + ph) * amp * 0.4;
    p.ellipse(W - 5, hy, th * 1.4 + 0.5, th + 0.6, o.c);
    p.shade();
    eye(p, W - 4, Math.round(hy - 1), false);
    p.outline();
  };

  S.crab = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, step = o.moving ? Math.round(Math.sin(ph * 2)) : 0;
    const cx = W / 2, cy = H * 0.64, rx = W * 0.27 * (o.wide || 1), ry = H * 0.17;
    const legL = o.spindly ? W * 0.2 : W * 0.12;
    for (let i = 0; i < 3; i++) {
      const lx = cx - rx * 0.5 + i * rx * 0.5, s = (i % 2 ? step : -step);
      p.line(lx - rx * 0.6, cy, lx - rx * 0.6 - legL, cy + H * 0.14 + s, mul(o.c, 0.8));
      p.line(lx + rx * 0.6, cy, lx + rx * 0.6 + legL, cy + H * 0.14 - s, mul(o.c, 0.8));
    }
    p.ellipse(cx, cy, rx, ry, o.c);
    const claw = W * 0.09 * (o.bigclaw ? 1.6 : 1);
    p.line(cx + rx * 0.7, cy - 1, cx + rx + 1, cy - H * 0.16, o.c);
    p.circle(cx + rx + 1, cy - H * 0.18, claw, o.a);
    p.line(cx - rx * 0.7, cy - 1, cx - rx - 1, cy - H * 0.16, o.c);
    p.circle(cx - rx - 1, cy - H * 0.18, W * 0.09, o.a);
    p.shade();
    p.line(cx - 2, cy - ry, cx - 2, cy - ry - 2, o.c); p.line(cx + 2, cy - ry, cx + 2, cy - ry - 2, o.c);
    p.set(cx - 2, cy - ry - 3, BLACK); p.set(cx + 2, cy - ry - 3, BLACK);
    if (o.rocky) {                      // a pitted space-rock shell with faint glowing cracks (Aerolite Crab)
      p.ellipse(cx, cy - ry * 0.55, rx * 0.95, ry * 1.25, mix(o.c, WHITE, 0.08));
      [[-0.45, -0.5], [0.3, -0.75], [0.05, -0.15], [0.55, -0.25]].forEach(([u, v]) => p.set(Math.round(cx + u * rx), Math.round(cy + v * ry * 1.4), mul(o.c, 0.62)));
      p.line(cx - rx * 0.5, cy - ry * 0.3, cx - rx * 0.05, cy - ry * 0.9, o.a); p.set(Math.round(cx + rx * 0.25), Math.round(cy - ry * 0.4), o.a);
    }
    if (o.bell) {
      // a bell-shaped shell with a little hollow (and a tiny clapper)
      const top = cy - ry - H * 0.24, bw = rx * 0.75;
      for (let y = Math.round(top); y <= cy - 1; y++) { const u = (y - top) / (cy - 1 - top), w = bw * (0.45 + 0.55 * u * u); p.rect(Math.round(cx - w), y, Math.round(w * 2), 1, mix(o.a, WHITE, 0.15)); }
      p.rect(Math.round(cx - bw - 1), cy - 1, Math.round(bw * 2 + 2), 1, mul(o.a, 0.8));
      p.ellipse(cx, cy - 2, bw * 0.5, 1.4, mul(o.c, 0.45)); p.set(cx, cy - 1, hex('#f2c14e'));
      p.set(cx, Math.round(top) - 1, mul(o.a, 0.8));
    }
    p.outline();
  };

  S.hermit = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, step = o.moving ? Math.round(Math.sin(ph * 2)) : 0;
    p.line(W * 0.62, H * 0.75, W * 0.56, H * 0.9 + step, o.c); p.line(W * 0.72, H * 0.75, W * 0.78, H * 0.9 - step, o.c);
    p.ellipse(W * 0.7, H * 0.68, W * 0.13, H * 0.11, o.c);
    p.circle(W * 0.86, H * 0.62, W * 0.08, o.c);
    p.circle(W * 0.42, H * 0.56, W * 0.27, o.a);
    p.shade();
    for (let a = 0; a < 9; a += 0.25) { const r = W * 0.22 * (1 - a / 10); p.set(W * 0.42 + Math.cos(a) * r * 0.9, H * 0.56 + Math.sin(a) * r * 0.9, mul(o.a, 0.7)); }
    p.set(W * 0.78, H * 0.52, BLACK);
    p.outline();
  };

  S.isopod = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, step = o.moving ? Math.round(Math.sin(ph * 2)) : 0;
    const cx = W / 2, cy = H * 0.58;
    for (let i = 0; i < 5; i++) p.line(cx - W * 0.28 + i * W * 0.14, cy + H * 0.12, cx - W * 0.3 + i * W * 0.14 + step, cy + H * 0.24, mul(o.c, 0.7));
    p.ellipse(cx, cy, W * 0.38, H * 0.18, o.c);
    p.shade(0.3);
    for (let i = -2; i <= 2; i++) for (let y = -4; y < 4; y++) if (p.a(Math.round(cx + i * W * 0.13), Math.round(cy + y))) p.set(cx + i * W * 0.13, cy + y, mul(o.c, 0.75));
    p.line(cx + W * 0.36, cy - 1, cx + W * 0.48, cy - H * 0.14, mul(o.c, 0.7));
    p.set(cx + W * 0.3, cy - 1, BLACK);
    p.outline();
  };

  S.snail = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, stretch = o.moving ? Math.round(Math.sin(ph)) : 0;
    p.ellipse(W * 0.52 + stretch * 0.5, H * 0.8, W * 0.38 + stretch * 0.5, H * 0.1, o.c);
    p.line(W * 0.8 + stretch, H * 0.74, W * 0.86 + stretch, H * 0.56, o.c);
    p.line(W * 0.74 + stretch, H * 0.74, W * 0.76 + stretch, H * 0.58, o.c);
    p.circle(W * 0.44, H * 0.54, W * 0.27, o.a);
    p.shade();
    for (let a = 0; a < 10; a += 0.2) { const r = W * 0.24 * (1 - a / 11); p.set(W * 0.44 + Math.cos(a) * r, H * 0.54 + Math.sin(a) * r, mul(o.a, 0.68)); }
    p.set(W * 0.86 + stretch, H * 0.54, BLACK);
    p.outline();
    if (o.glass) for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) p.d[i + 3] = 170;
  };

  S.limpet = function (p, o) {
    const W = p.w, H = p.h;
    for (let y = 0; y < H * 0.4; y++) { const w = W * 0.42 * Math.sqrt(1 - Math.pow(y / (H * 0.4), 2)); p.rect(Math.round(W / 2 - w), Math.round(H * 0.85 - y), Math.round(w * 2), 1, o.c); }
    p.shade(0.3);
    for (let i = -2; i <= 2; i++) p.line(W / 2, H * 0.47, W / 2 + i * W * 0.17, H * 0.84, mul(o.c, 0.75));
    p.set(W / 2, H * 0.47, o.a);
    p.outline();
  };

  S.barnacles = function (p, o) {
    const W = p.w, H = p.h;
    [[0.3, 0.7, 0.16], [0.6, 0.66, 0.2], [0.45, 0.48, 0.13], [0.78, 0.75, 0.11]].forEach(([x, y, r]) => {
      p.tri([W * (x - r), H * (y + r * 0.8)], [W * (x + r), H * (y + r * 0.8)], [W * x, H * (y - r * 0.9)], o.c);
    });
    p.ellipse(W * 0.5, H * 0.86, W * 0.4, H * 0.08, o.a);
    p.shade(0.3);
    [[0.3, 0.6], [0.6, 0.55], [0.45, 0.4]].forEach(([x, y]) => p.set(W * x, H * y, mul(o.c, 0.4)));
    p.outline();
  };

  S.squid = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const mx = W * 0.6, my = H / 2;
    for (let k = -1.5; k <= 1.5; k++) {
      for (let i = 0; i < 10; i++) {
        const u = i / 10, x = mx - W * 0.16 - u * W * 0.4, y = my + k * H * 0.06 + Math.sin(u * 6 + ph + k) * H * 0.06 * u;
        p.set(x, y, o.a);
      }
    }
    p.ellipse(mx, my, W * 0.24, H * 0.16, o.c);
    p.tri([mx + W * 0.14, my], [mx + W * 0.3, my - H * 0.16], [mx + W * 0.3, my + H * 0.16], mul(o.c, 0.9));
    p.shade();
    eye(p, Math.round(mx - W * 0.12), Math.round(my - 1), W >= 20);
    p.outline();
    if (o.veins) {
      // glowing veins along the mantle that pulse brighter frame by frame
      const glow = mix(o.a, WHITE, 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ph)));
      for (let k = -1; k <= 1; k++) for (let i = 0; i < 8; i++) {
        const u = i / 8, x = mx - W * 0.18 + u * W * 0.4, y = my + k * H * 0.07 + Math.sin(u * 7 + k) * 1;
        if (p.a(Math.round(x), Math.round(y))) p.set(x, y, glow);
      }
    }
    if (o.ghost) for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) p.d[i + 3] = 200;
  };

  // Octopus (like the reference photos): round mantle on top, big ringed eyes at its base, and
  // eight thick arms spreading out to both sides and curling up at the tips, with pale suckers.
  S.octopus = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const bx = W * 0.5, by = H * 0.52;                 // where the arms meet
    const sucker = mix(o.a, WHITE, 0.35);
    // 4 arms per side: start angle below horizontal, then walk outward along a path whose heading
    // bends upward more and more -> tips curl back up like the photo.
    const arms = [];
    for (const side of [-1, 1]) [[1.4, 0.75, 1.3], [0.95, 0.9, 1.5], [0.5, 1.0, 1.7], [0.08, 1.0, 1.9]].forEach(([a0, len, curl], k) => arms.push({ side, a0, len, curl, k, back: k === 0 || k === 2 }));
    arms.sort((p1, p2) => (p2.back ? 1 : 0) - (p1.back ? 1 : 0));   // back arms first
    for (const A of arms) {
      const col = A.back ? mul(o.c, 0.72) : o.c;
      const L = W * 0.5 * A.len, N = 28, ds = L / N;
      let x = bx + A.side * (0.5 + A.k * 1.1), y = by - 1 + A.k * 0.4;
      let head = A.a0 + Math.sin(ph + A.k + (A.side > 0 ? 0 : 2)) * (o.moving ? 0.22 : 0.1);
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        p.set(x, y, col);
        if (u < 0.65) p.set(x, y + 1, col);                                   // 2px thick near the body
        if (!A.back && i > 4 && i % 3 === 0 && u < 0.8) p.set(x, y + (u < 0.65 ? 2 : 1), sucker);   // suckers underneath
        head -= A.curl * u * u * 0.22;                                        // tip curls back up
        x += A.side * Math.cos(head) * ds; y += Math.sin(head) * ds;
      }
    }
    // mantle (head) with speckles
    p.ellipse(W * 0.5, H * 0.28, W * 0.18, H * 0.22, o.c);
    p.ellipse(W * 0.5, H * 0.43, W * 0.13, H * 0.09, o.c);
    p.shade(0.2);
    for (let i = 0; i < 9; i++) { const x = W * 0.36 + ((i * 37) % 10) / 10 * W * 0.28, y = H * 0.14 + ((i * 53) % 10) / 10 * H * 0.26; if (p.a(Math.round(x), Math.round(y))) p.set(x, y, mix(o.c, WHITE, 0.4)); }
    // eyes: orange rim, dark pupil
    const eyeC = hex('#f2a23a');
    for (const ex of [W * 0.41, W * 0.59]) { p.circle(ex, H * 0.44, 1.4, eyeC); p.set(ex, H * 0.44, BLACK); }
    p.outline();
  };

  // Axolotl (blocky, friendly): square head with feathery gill fronds, small dark eyes, stubby
  // legs and a long finned tail.
  S.axolotl = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const wig = Math.sin(ph) * (o.moving ? 1.6 : 0.8);
    const gillC = o.a, gillD = mul(o.a, 0.75), fin = mix(o.c, WHITE, 0.35);
    // tail with top/bottom fin, wiggling
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, x = W * 0.36 - u * W * 0.32, y = H * 0.58 + Math.sin(u * 3 + ph) * wig * u;
      const th = H * 0.1 * (1 - u * 0.7);
      p.rect(Math.round(x), Math.round(y - th), 1, Math.round(th * 2), o.c);
      p.set(x, y - th - 1, fin); p.set(x, y + th, fin);
    }
    // legs
    const step = o.moving ? Math.round(Math.sin(ph * 2)) : 0;
    p.rect(Math.round(W * 0.38) + step, Math.round(H * 0.68), 2, 2, mul(o.c, 0.85));
    p.rect(Math.round(W * 0.62) - step, Math.round(H * 0.68), 2, 2, mul(o.c, 0.85));
    // body + head blocks
    p.rect(Math.round(W * 0.34), Math.round(H * 0.47), Math.round(W * 0.34), Math.round(H * 0.22), o.c);
    p.rect(Math.round(W * 0.6), Math.round(H * 0.36), Math.round(W * 0.32), Math.round(H * 0.32), o.c);
    p.shade(0.15);
    // gill fronds: three on the back of the head, each with little side feathers
    const gx = W * 0.62, gy = H * 0.38;
    [[-0.3, 0.32], [-0.9, 0.36], [-1.5, 0.3]].forEach(([ang, len], k) => {
      const L = H * len, a = ang - Math.PI / 2 + Math.sin(ph + k) * 0.08;
      for (let i = 0; i <= 5; i++) {
        const u = i / 5, x = gx + Math.cos(a) * L * u + (k === 2 ? 0 : 0), y = gy + k * 1.5 + Math.sin(a) * L * u;
        p.set(x, y, gillC);
        if (i > 1 && i % 2 === 0) { p.set(x - 1, y - 1, gillD); p.set(x + 1, y - 1, gillD); }
      }
    });
    // face: small dark eye, blush, smile
    const ex = Math.round(W * 0.8), ey = Math.round(H * 0.46);
    p.rect(ex, ey, 2, 2, BLACK);
    p.set(ex + 2, ey + 3, mix(o.a, o.c, 0.4));
    p.rect(Math.round(W * 0.78), Math.round(H * 0.6), 3, 1, mul(o.c, 0.75));
    p.outline(0.5);
  };

  // Crocodile: long low body, long flat snout with teeth, raised eye knob, ridged back + tail,
  // splayed legs, pale belly, darker cross bands.
  S.croc = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const sway = Math.sin(ph) * (o.moving ? 1.5 : 0.6), step = o.moving ? Math.round(Math.sin(ph * 2)) : 0;
    const cy = H * 0.6, dark = mul(o.c, 0.72), belly = o.a, teeth = hex('#f2efe0');
    // tail (thick -> thin) with ridge scutes
    for (let i = 0; i <= 18; i++) {
      const u = i / 18, x = W * 0.3 - u * W * 0.28, y = cy + Math.sin(u * 3 + ph) * sway * u;
      const th = H * 0.13 * (1 - u * 0.8) + 0.5;
      p.ellipse(x, y, 1.2, th, i % 4 < 2 ? o.c : dark);
      if (i % 2 === 0) p.set(x, y - th - 1, dark);
    }
    // legs (splayed, with toes)
    for (const [lx, sgn] of [[0.36, 1], [0.6, -1]]) {
      const x = W * lx + step * sgn;
      p.rect(Math.round(x), Math.round(cy + H * 0.08), 2, Math.round(H * 0.16), dark);
      p.rect(Math.round(x) - 1, Math.round(cy + H * 0.23), 4, 1, dark);
    }
    // body
    p.ellipse(W * 0.47, cy, W * 0.2, H * 0.16, o.c);
    p.ellipse(W * 0.47, cy + H * 0.08, W * 0.17, H * 0.07, belly);
    for (let i = -3; i <= 3; i++) p.line(W * 0.47 + i * W * 0.05, cy - H * 0.14, W * 0.47 + i * W * 0.05, cy + H * 0.02, dark);
    // head + long flat snout
    p.ellipse(W * 0.69, cy - H * 0.02, W * 0.06, H * 0.12, o.c);
    for (let x = W * 0.7; x < W * 0.97; x++) {
      const u = (x - W * 0.7) / (W * 0.27), top = cy - H * 0.09 + u * H * 0.04, bot = cy + H * 0.06 - u * H * 0.01;
      for (let y = top; y <= bot; y++) p.set(x, y, y > cy ? mul(o.c, 0.9) : o.c);
    }
    p.shade(0.18);
    // jaw line + teeth, nostril, eye knob
    for (let x = W * 0.72; x < W * 0.96; x++) { p.set(x, cy, mul(o.c, 0.5)); if (Math.round(x) % 3 === 0) p.set(x, cy - 1, teeth); }
    p.set(W * 0.95, cy - H * 0.08, mul(o.c, 0.5));
    p.ellipse(W * 0.7, cy - H * 0.13, 2, 1.6, o.c);
    p.set(W * 0.71, cy - H * 0.14, hex('#e8d03a')); p.set(W * 0.72, cy - H * 0.14, BLACK);
    // back scutes
    for (let i = -4; i <= 3; i++) p.set(W * 0.47 + i * W * 0.045, cy - H * 0.16 - 1, i % 2 ? dark : mix(o.c, WHITE, 0.2));
    p.outline();
  };

  S.jelly = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const pulse = Math.sin(ph) * 0.06;
    const cx = W / 2, cy = H * 0.4;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 12; i++) {
      const u = i / 12;
      p.set(cx - W * 0.22 + k * W * 0.15 + Math.sin(u * 6 + ph + k) * 1.5, cy + 2 + u * H * 0.5, alpha(o.a, 210));
    }
    for (let y = 0; y < H * 0.24; y++) {
      const w = W * (0.34 + pulse) * Math.sqrt(1 - Math.pow(y / (H * 0.24), 2));
      p.rect(Math.round(cx - w), Math.round(cy - y), Math.round(w * 2), 1, alpha(o.c, 220));
    }
    p.ellipse(cx, cy - H * 0.06, W * 0.12, H * 0.07, alpha(o.a, 230));
    p.shade(0.25);
    p.outline(0.55);
  };

  S.nautilus = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const cx = W * 0.42, cy = H / 2, r = W * 0.3;
    for (let k = 0; k < 4; k++) p.line(cx + r * 0.7, cy + 1, cx + r + W * 0.18, cy - 2 + k * 2 + Math.sin(ph + k), mul(o.c, 0.9));
    p.circle(cx, cy, r, o.c);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const a = Math.atan2(y, x);
      if (p.a(Math.round(cx + x), Math.round(cy + y)) && Math.sin(a * 5) > 0.55 && Math.hypot(x, y) > r * 0.4) p.set(cx + x, cy + y, o.a);
    }
    p.shade();
    for (let a = 0; a < 9; a += 0.2) { const rr = r * 0.8 * (1 - a / 10); p.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, mul(o.c, 0.6)); }
    p.set(cx + r * 0.85, cy - 1, BLACK);
    p.outline();
  };

  S.lizard = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const step = o.moving ? Math.round(Math.sin(ph * 2) * 1.2) : 0;
    const cy = o.neck ? H * 0.64 : H * 0.58, body = W * (o.croc ? 0.26 : 0.22);
    for (let i = 0; i < 12; i++) {
      const u = i / 12;
      p.circle(W * 0.5 - body - u * W * 0.3, cy + Math.sin(u * 4 + ph) * (o.moving ? 1.6 : 0.8), H * 0.09 * (1 - u * 0.8) + 0.4, o.c);
    }
    p.line(W * 0.5 - body * 0.6, cy + 1, W * 0.5 - body * 0.8 - step, cy + H * 0.15, mul(o.c, 0.85));
    p.line(W * 0.5 + body * 0.6, cy + 1, W * 0.5 + body * 0.8 + step, cy + H * 0.15, mul(o.c, 0.85));
    p.ellipse(W * 0.5, cy, body, H * 0.11 * (o.thick || 1), o.c);
    let hx = W * 0.5 + body + W * 0.06, hy = cy - 1;
    if (o.neck) {
      for (let i = 0; i < 8; i++) { const u = i / 8; p.circle(W * 0.5 + body * 0.7 + u * W * 0.16, cy - u * H * 0.32, H * 0.06, o.c); }
      hx = W * 0.5 + body * 0.7 + W * 0.2; hy = cy - H * 0.36;
    }
    p.ellipse(hx, hy, W * (o.croc ? 0.14 : 0.08), H * 0.08, o.c);
    if (o.croc) p.rect(Math.round(hx), Math.round(hy + 1), Math.round(W * 0.16), 2, mul(o.c, 0.9));
    if (o.belly) p.ellipse(W * 0.5, cy + H * 0.05, body * 0.8, H * 0.04, o.a);
    p.shade();
    if (o.ridge || o.croc) for (let i = -2; i <= 2; i++) p.set(W * 0.5 + i * body * 0.4, cy - H * 0.11 - 1, o.a);
    if (o.spots) for (let i = -1; i <= 1; i++) p.set(W * 0.5 + i * body * 0.5, cy - 1, o.a);
    if (o.gills) for (let s = -1; s <= 1; s += 2) for (let k = 0; k < 3; k++) p.line(hx - W * 0.04, hy + s, hx - W * 0.1 - k, hy + s * (3 + k), o.a);
    eye(p, Math.round(hx + W * 0.03), Math.round(hy - 1), false);
    p.outline();
  };

  S.frog = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const leap = o.moving ? Math.max(0, Math.sin(ph)) : 0;
    p.ellipse(W * 0.32 - leap * 3, H * 0.72 + leap, W * 0.16 + leap * 2, H * 0.1, mul(o.c, 0.9));
    p.ellipse(W * 0.52, H * 0.6 - leap * 2, W * 0.26, H * 0.2, o.c);
    p.circle(W * 0.66, H * 0.42 - leap * 2, W * 0.08, o.c);
    p.ellipse(W * 0.54, H * 0.68 - leap * 2, W * 0.18, H * 0.08, o.a);
    p.shade();
    eye(p, Math.round(W * 0.68), Math.round(H * 0.4 - leap * 2), false);
    p.outline();
    if (o.glow) [[0.42, 0.5], [0.52, 0.46], [0.6, 0.5], [0.36, 0.6]].forEach(([x, y], i) => p.set(W * x, H * y - leap * 2, i % 2 ? WHITE : o.a));
  };

  S.otter = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, b = Math.round(Math.sin(ph) * (o.moving ? 1 : 0.5));
    for (let i = 0; i < 8; i++) { const u = i / 8; p.circle(W * 0.22 - u * W * 0.16, H * 0.58 + b * u, H * 0.08 * (1 - u * 0.6), o.c); }
    p.ellipse(W * 0.48, H * 0.56 + b, W * 0.3 * (o.plump ? 1.05 : 1), H * (o.plump ? 0.22 : 0.15), o.c);
    p.circle(W * 0.78, H * 0.48, H * (o.plump ? 0.16 : 0.13), o.c);
    p.ellipse(W * 0.82, H * 0.53, H * 0.08, H * 0.06, o.a);
    p.ellipse(W * 0.48, H * 0.62 + b, W * 0.22, H * 0.06, o.a);
    if (!o.plump) { p.set(W * 0.73, H * 0.35, o.c); p.set(W * 0.78, H * 0.34, o.c); }
    p.ellipse(W * 0.4, H * 0.7 + b, W * 0.07, H * 0.05, mul(o.c, 0.8));
    p.shade();
    eye(p, Math.round(W * 0.83), Math.round(H * 0.45), false);
    p.set(W * 0.9, H * 0.5, BLACK);
    p.outline();
  };

  S.dolphin = function (p, o) { S.fish(p, Object.assign({}, o, { dolphin: true, long: 1.15, tall: 0.85 })); };
  S.shark = function (p, o) { S.fish(p, Object.assign({}, o, { shark: true, long: 1.2, tall: 0.8 })); };

  // ---------- plants (anchored bottom-centre) ----------
  S.saltbloom = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      const bx = W * 0.2 + k * W * 0.15, top = H * (0.35 + (k % 2) * 0.15), sway = Math.sin(ph + k) * 1;
      p.line(bx, H - 1, bx + sway, top, mul(o.c, 0.7));
      p.circle(bx + sway, top, 1.5, k % 2 ? o.a : o.c);
    }
    p.shade(); p.outline(0.4);
  };
  S.kelp = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let y = H - 1; y > 2; y--) {
      const u = 1 - y / H, x = W / 2 + Math.sin(u * 4 + ph) * u * 3;
      p.set(x, y, o.c); p.set(x + 1, y, mul(o.c, 0.8));
      if (y % 7 === 0) { p.ellipse(x + (y % 14 ? 3 : -2), y, 2.4, 1.6, o.a); }
      if (y % 5 === 0) p.line(x, y, x + (y % 10 ? 4 : -4), y - 3, mul(o.c, 1.1));
    }
    p.shade(0.15); p.outline(0.4);
  };
  S.branchcoral = function (p, o) {
    const W = p.w, H = p.h, r = mkRand(o.seed || 3);
    const grow = (x, y, a, len, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      p.line(x, y, x2, y2, o.c); p.line(x + 1, y, x2 + 1, y2, o.c);
      if (d > 0) { grow(x2, y2, a - 0.5 - r() * 0.3, len * 0.7, d - 1); grow(x2, y2, a + 0.5 + r() * 0.3, len * 0.7, d - 1); }
      else p.set(x2, y2, o.a);
    };
    grow(W / 2, H - 1, -Math.PI / 2, H * 0.32, 3);
    p.shade(); p.outline(0.4);
  };
  S.braincoral = function (p, o) {
    const W = p.w, H = p.h;
    for (let y = 0; y < H * 0.5; y++) { const w = W * 0.44 * Math.sqrt(1 - Math.pow(y / (H * 0.5), 2)); p.rect(Math.round(W / 2 - w), H - 1 - y, Math.round(w * 2), 1, o.c); }
    p.shade(0.25);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.a(x, y) && Math.sin(x * 1.3 + Math.sin(y * 0.9) * 2.5) > 0.6) p.set(x, y, o.a);
    p.outline(0.4);
  };
  S.tuft = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const bx = W * 0.2 + k * W * 0.12, top = H * (0.3 + ((k * 7) % 4) * 0.1), sway = Math.sin(ph + k * 0.8) * 1.3;
      p.line(bx, H - 1, bx + sway, top, o.c);
    }
    p.shade(); p.outline(0.4);
    for (let k = 0; k < 6; k++) { const bx = W * 0.2 + k * W * 0.12, top = H * (0.3 + ((k * 7) % 4) * 0.1), sway = Math.sin(ph + k * 0.8) * 1.3; p.circle(bx + sway, top, 1.2, o.a); }
  };
  S.crystals = function (p, o) {
    const W = p.w, H = p.h;
    [[0.5, 0.15, 0.12], [0.3, 0.4, 0.1], [0.7, 0.35, 0.1], [0.18, 0.62, 0.07], [0.82, 0.6, 0.08]].forEach(([x, t, w], i) => {
      p.tri([W * (x - w), H - 1], [W * (x + w), H - 1], [W * x, H * t], i % 2 ? o.a : o.c);
    });
    p.shade(0.35); p.outline(0.4);
  };
  S.mat = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let i = 0; i < 26; i++) { const u = i / 26; p.circle(W * 0.1 + u * W * 0.8, H / 2 + Math.sin(u * 9 + ph) * 1.5, 1.5 + (i % 3) * 0.6, i % 4 ? o.c : o.a); }
    p.shade(); p.outline(0.4);
  };
  S.frond = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let k = 0; k < 4; k++) {
      const bx = W * 0.3 + k * W * 0.13;
      for (let y = H - 1; y > H * (0.15 + (k % 2) * 0.15); y--) {
        const u = 1 - y / H; const x = bx + Math.sin(u * 5 + ph + k) * u * 2.5;
        p.set(x, y, k % 2 ? o.a : o.c); p.set(x + 1, y, mul(k % 2 ? o.a : o.c, 0.8));
      }
    }
    p.shade(0.15); p.outline(0.4);
  };
  S.moss = function (p, o) {
    const W = p.w, H = p.h, r = mkRand(5);
    for (let y = 0; y < H * 0.4; y++) { const w = W * 0.45 * Math.sqrt(1 - Math.pow(y / (H * 0.4), 2)); p.rect(Math.round(W / 2 - w), H - 1 - y, Math.round(w * 2), 1, o.c); }
    for (let i = 0; i < 20; i++) { const x = Math.round(W * 0.1 + r() * W * 0.8), y = Math.round(H * 0.6 + r() * H * 0.4); if (p.a(x, y)) p.set(x, y, o.a); }
    for (let i = 0; i < 8; i++) { const x = W * 0.15 + r() * W * 0.7; p.line(x, H * 0.66, x + (r() - 0.5) * 2, H * 0.5, o.c); }
    p.shade(0.25); p.outline(0.4);
  };
  S.tangle = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 30; i++) {
      const u = i / 30;
      p.set(W * 0.15 + u * W * 0.7, H * 0.85 - Math.abs(Math.sin(u * 3 + k * 1.3)) * H * 0.5 * (0.5 + k * 0.15), o.c);
    }
    for (let k = 0; k < 6; k++) p.ellipse(W * 0.2 + k * W * 0.12, H * 0.35 + Math.sin(ph + k) + (k % 2) * 4, 1.6, 1, o.a);
    p.shade(); p.outline(0.4);
  };

  // ---------- player ----------
  // ---------- player: white humanoid robot diver ----------
  // Palette from the reference: white armour, grey shading, dark joints/chest plate,
  // navy face visor + shoulder pad, cyan trim and accent lights.
  const ROBO = {
    w: hex('#eef1f7'), g: hex('#c3cad6'), gd: hex('#8f98a8'), k: hex('#3b4352'), kd: hex('#262c37'),
    n: hex('#26389a'), nl: hex('#4a63c9'), c: hex('#6ef0ef'), cd: hex('#2fb8c0')
  };

  // Swimming pose (horizontal, facing right). Anchor = frame centre (12,12).
  // Flutter kick: both legs pivot at the hip in a smooth scissor motion (feet move most,
  // knees about half), the torso stays steady, the arm only reaches out for the net.
  S.diver = function (p, o) {
    if (o.anim === 'stand' || o.anim === 'walk' || o.anim === 'jump' || o.anim === 'standnet' || o.anim === 'climb') return S.diverUpright(p, o);
    p.oy = p.h / 2 - 12; p.ox = p.w / 2 - 12;   // 28x40 frame: swim art drawn in 24x24 coords, centred on the anchor (14,20)
    const R = ROBO, ph = o.t * Math.PI * 2;
    const swim = o.anim === 'swim';
    const amp = swim ? 2.7 : o.anim === 'net' ? 0.6 : 1.2;
    const bob = o.anim === 'idle' ? (o.frame === 1 || o.frame === 2 ? 1 : 0) : 0;   // slow 1px breathing bob
    const y = 11 + bob;
    const hipX = 9, hipY = y + 2;
    // phase offset so all 6 frames differ; the knee lags the foot for a whip-like kick
    const leg = (phase, gain, base, shin, boot) => {
      const footY = hipY + Math.sin(ph + phase + Math.PI / 6) * amp * gain;
      const kneeY = hipY + Math.sin(ph + phase + Math.PI / 6 - 0.9) * amp * gain * 0.5;
      const kx = 4, fx = 1;           // legs reach 1px further back than before
      for (let i = 0; i <= 4; i++) { const t = i / 4, xx = hipX - t * (hipX - kx), yy = hipY + t * (kneeY - hipY); p.set(xx, yy, base); p.set(xx, yy + 1, base); }
      for (let i = 1; i <= 3; i++) { const t = i / 3, xx = kx - t * (kx - fx), yy = kneeY + t * (footY - kneeY); p.set(xx, yy, shin); p.set(xx, yy + 1, shin); }
      p.set(kx, kneeY, R.k); p.set(kx, kneeY + 1, R.k);
      p.rect(Math.round(fx - 2), Math.round(footY), 2, 2, boot);          // boot
    };
    leg(Math.PI, 0.65, R.gd, R.g, R.k);   // back leg (behind, in shadow, smaller kick)
    // hips + torso: white back, dark segmented chest plate facing down, cyan trim
    p.rect(8, y, 9, 2, R.w);
    p.rect(8, y + 2, 9, 2, R.k);
    for (let x = 10; x < 17; x += 3) p.set(x, y + 2, R.kd);
    p.rect(9, y + 4, 7, 1, R.c);
    p.set(8, y + 2, R.c);
    leg(0, 1, R.w, R.w, R.g);          // front leg (on top, white)
    p.set(7, y + 2, R.c);                // cyan thigh light
    // navy shoulder pad
    p.rect(14, y - 1, 3, 2, R.n); p.set(14, y - 1, R.nl);
    // head: white helmet with a big navy visor facing forward, cyan ear light
    p.rect(17, y - 1, 4, 5, R.w); p.rect(18, y - 2, 3, 1, R.w);
    p.rect(19, y, 3, 3, R.n); p.set(20, y, R.nl);
    p.set(18, y + 1, R.c);
    // arm: tucked along the body while swimming, reaching forward during a net swing
    if (o.anim !== 'net') p.rect(12, y + 4, 3, 1, R.g);   // during a swing the game draws the reaching arm
    p.outline(0.28);
  };

  // Upright pose for walking on land, the same size as the swimming pose (~22px head to toe).
  // Anchor = (14,20) in the 28x40 frame; feet stand on row 24 (= the bottom of the collision box).
  S.diverUpright = function (p, o) {
    p.oy = 0; p.ox = p.w / 2 - 12;
    const R = ROBO;
    const climb = o.anim === 'climb';
    const walk = o.anim === 'walk' || climb, jump = o.anim === 'jump', noArm = o.anim === 'standnet';
    const step = climb ? [1, -1][o.frame] : walk ? [0, 1, 0, -1][o.frame] : 0;
    const t = 3 + (walk && o.frame % 2 ? 1 : 0) + (jump ? -2 : 0);
    // legs (2px each, 5px long + feet): back leg grey, front leg white, dark knees, cyan thigh light
    if (jump) {
      p.rect(10, t + 16, 2, 3, R.g); p.set(10, t + 17, R.k); p.set(11, t + 17, R.k); p.rect(8, t + 19, 4, 1, R.gd);
      p.rect(12, t + 16, 2, 3, R.w); p.set(12, t + 17, R.k); p.set(13, t + 17, R.k); p.rect(12, t + 19, 4, 1, R.g);
    } else {
      const bx = 10 - step, fx = 12 + step, feet = 24;
      p.rect(bx, t + 16, 2, feet - (t + 16), R.g); p.rect(bx, t + 18, 2, 1, R.k);
      p.rect(fx, t + 16, 2, feet - (t + 16), R.w); p.rect(fx, t + 18, 2, 1, R.k); p.set(fx + 1, t + 16, R.c);
      p.rect(bx - 1, feet, 3, 1, R.gd); p.rect(fx, feet, 3, 1, R.g);
    }
    // hips + dark waist band
    p.rect(10, t + 15, 4, 1, R.w); p.rect(10, t + 14, 4, 1, R.k);
    // torso: slim dark chest plate with cyan trim
    p.rect(10, t + 9, 4, 5, R.k); p.set(11, t + 10, R.kd); p.set(12, t + 12, R.kd);
    p.rect(9, t + 9, 1, 5, R.c); p.rect(14, t + 9, 1, 5, R.c);
    // shoulders + navy pad on the front shoulder
    p.rect(8, t + 7, 8, 2, R.w);
    p.rect(13, t + 7, 3, 2, R.n); p.set(13, t + 7, R.nl);
    // arms (1px): back arm grey, front arm white; dark elbows + hands; swing while walking
    const sw = walk && !climb ? step : 0;
    if (climb) {
      // reaching up the ladder, hands taking turns
      const a1 = o.frame ? 2 : 0, a2 = o.frame ? 0 : 2;
      p.rect(7, t + 2 + a1, 1, 6, R.g); p.set(7, t + 5 + a1, R.k); p.set(7, t + 1 + a1, R.kd);
      p.rect(16, t + 2 + a2, 1, 6, R.w); p.set(16, t + 5 + a2, R.k); p.set(16, t + 1 + a2, R.k);
    } else {
      p.rect(7, t + 8, 1, 6, R.g); p.set(7, t + 10, R.k); p.set(7 - Math.max(0, sw), t + 14, R.kd);
      if (!noArm) { p.rect(16, t + 8, 1, 6, R.w); p.set(16, t + 10, R.k); p.set(16 + Math.max(0, -sw), t + 14, R.k); }
    }
    // neck + head: white helmet, navy visor facing right, cyan ear light
    p.rect(11, t + 6, 2, 1, R.k);
    p.rect(10, t, 4, 1, R.w); p.rect(9, t + 1, 6, 4, R.w); p.rect(10, t + 5, 4, 1, R.w);
    p.rect(12, t + 1, 3, 4, R.n); p.set(13, t + 1, R.nl); p.set(12, t + 1, R.nl);
    p.set(10, t + 3, R.c);
    p.outline(0.28);
  };

  S.chest = function (p, o) {
    const W = p.w, H = p.h, wood = hex('#9b5a2e'), gold = hex('#f2c14e');
    const open = o.anim === 'open';
    p.rect(2, 7, W - 4, H - 9, wood);
    p.rect(2, 7, W - 4, 1, gold); p.rect(W / 2 - 1, 8, 2, 3, gold);
    if (open) { p.rect(2, 2, W - 4, 3, mul(wood, 0.8)); p.rect(4, 6, W - 8, 1, hex('#fff6b0')); }
    else { p.rect(2, 4, W - 4, 3, mul(wood, 1.1)); p.rect(2, 4, W - 4, 1, gold); }
    p.shade(); p.outline();
  };
  S.bait = function (p, o) {
    const c = hex('#e8873a');
    p.circle(3, 4, 1.6, c); p.circle(5, 3, 1.3, mul(c, 1.1)); p.circle(5, 5, 1.2, mul(c, 0.9));
    p.shade(); p.outline();
    if (o.frame % 2) p.set(5, 2, WHITE);
  };

  // ---------- decorations ----------
  S.rock = function (p, o) {
    const W = p.w, H = p.h, r = mkRand(o.seed || 1);
    p.ellipse(W / 2, H * 0.68, W * 0.44, H * 0.32, o.c);
    p.ellipse(W * 0.4, H * 0.55, W * 0.24, H * 0.24, mul(o.c, 1.05));
    p.shade(0.25);
    for (let i = 0; i < W; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * H); if (p.a(x, y)) p.set(x, y, mul(o.c, 0.85)); }
    p.outline();
  };
  S.shell = function (p, o) {
    const W = p.w, H = p.h;
    for (let y = 0; y < H * 0.5; y++) { const w = W * 0.4 * Math.sqrt(1 - Math.pow(y / (H * 0.5), 2)); p.rect(Math.round(W / 2 - w), H - 2 - y, Math.round(w * 2), 1, o.c); }
    p.shade(0.25);
    for (let i = -2; i <= 2; i++) p.line(W / 2, H * 0.5, W / 2 + i * W * 0.15, H - 2, mul(o.c, 0.8));
    p.outline();
  };
  S.starfish = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, cy = H / 2 + 1;
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; p.tri([cx, cy], [cx + Math.cos(a - 0.4) * 2.5, cy + Math.sin(a - 0.4) * 2.5], [cx + Math.cos(a) * W * 0.45, cy + Math.sin(a) * H * 0.45], o.c); p.tri([cx, cy], [cx + Math.cos(a + 0.4) * 2.5, cy + Math.sin(a + 0.4) * 2.5], [cx + Math.cos(a) * W * 0.45, cy + Math.sin(a) * H * 0.45], o.c); }
    p.shade(0.2); p.set(cx, cy, o.a); p.outline();
  };
  S.driftwood = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.7, W * 0.46, H * 0.16, o.c);
    p.line(W * 0.3, H * 0.6, W * 0.2, H * 0.25, o.c); p.line(W * 0.31, H * 0.6, W * 0.21, H * 0.25, o.c);
    p.line(W * 0.7, H * 0.62, W * 0.82, H * 0.4, o.c);
    p.shade(0.25);
    p.line(W * 0.1, H * 0.7, W * 0.9, H * 0.7, mul(o.c, 0.8));
    p.outline();
  };
  S.amphora = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.6, W * 0.3, H * 0.3, o.c);
    p.rect(Math.round(W / 2 - 2), 2, 4, Math.round(H * 0.4), o.c);
    p.rect(Math.round(W / 2 - 3), 1, 6, 2, o.c);
    p.line(W / 2 - 3, 4, W / 2 - 5, H * 0.45, o.c); p.line(W / 2 + 2, 4, W / 2 + 4, H * 0.45, o.c);
    p.shade(0.3);
    p.rect(Math.round(W / 2 - W * 0.28), Math.round(H * 0.58), Math.round(W * 0.56), 1, o.a);
    p.outline();
  };
  S.castle = function (p, o) {
    const W = p.w, H = p.h;
    p.rect(4, H * 0.4, W - 8, H * 0.6 - 1, o.c);
    p.rect(2, H * 0.2, 7, H * 0.8 - 1, o.c); p.rect(W - 9, H * 0.2, 7, H * 0.8 - 1, o.c);
    p.rect(W / 2 - 4, H * 0.08, 8, H * 0.92 - 1, o.c);
    for (const bx of [2, W - 9, W / 2 - 4]) for (let i = 0; i < 4; i += 2) p.rect(bx + i * 2, (bx === W / 2 - 4 ? H * 0.08 : H * 0.2) - 2, 2, 2, o.c);
    p.shade(0.2);
    p.rect(W / 2 - 3, H - 9, 6, 8, mul(o.c, 0.4)); p.rect(W / 2 - 1, H * 0.25, 2, 3, mul(o.c, 0.4));
    p.outline();
  };
  S.arch = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.6, W * 0.46, H * 0.55, o.c);
    p.ellipse(W / 2, H * 0.8, W * 0.26, H * 0.45, [0, 0, 0, 0]);
    p.rect(0, H - 1, W, 1, [0, 0, 0, 0]);
    p.shade(0.25); p.outline();
  };
  S.treasure = function (p, o) { S.chest(p, { anim: 'open' }); for (let i = 0; i < 6; i++) p.set(4 + i * 1.5, 6 - (i % 2), hex('#ffe26b')); };
  S.barrel = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.58, W * 0.32, H * 0.4, o.c);
    p.shade(0.25);
    for (const f of [0.32, 0.8]) p.rect(Math.round(W * 0.2), Math.round(H * f), Math.round(W * 0.6), 1, [90, 90, 96, 255]);
    p.rect(Math.round(W / 2 - 2), Math.round(H * 0.5), 4, 3, [30, 20, 18, 255]);
    p.outline();
  };
  S.bubbler = function (p, o) {
    const W = p.w, H = p.h;
    p.rect(2, H - 5, W - 4, 4, o.c); p.rect(W / 2 - 1, H - 7, 2, 2, mul(o.c, 0.8));
    p.shade(0.3); p.outline();
  };
  S.pillar = function (p, o) {
    const W = p.w, H = p.h;
    p.rect(W / 2 - 4, 3, 8, H - 4, o.c); p.rect(W / 2 - 6, 1, 12, 3, o.c); p.rect(W / 2 - 6, H - 3, 12, 2, o.c);
    p.shade(0.2);
    for (let x = -2; x <= 2; x += 2) p.line(W / 2 + x, 4, W / 2 + x, H - 4, mul(o.c, 0.85));
    p.rect(W / 2 + 1, H * 0.3, 3, 2, [0, 0, 0, 0]);
    p.outline();
  };
  S.anchor = function (p, o) {
    const W = p.w, H = p.h;
    p.rect(W / 2 - 1, 3, 2, H - 6, o.c); p.rect(W / 2 - 4, 5, 8, 2, o.c);
    p.circle(W / 2, 2.5, 1.6, o.c);
    for (let a = 0.3; a < Math.PI - 0.3; a += 0.1) p.set(W / 2 + Math.cos(a) * W * 0.36, H - 6 + Math.sin(a) * 4, o.c);
    p.shade(0.2); p.outline();
  };

  // ---------- new creatures (day & night update) ----------
  // Seahorse-like: upright curled body, long snout, flowing ribbon mane.
  // A ray seen from the side-ish: wide flat wings that flap slowly, a small head and a long glowing
  // comet tail trailing behind (Comet Ray). Faces right like every creature.
  S.ray = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, flap = Math.sin(ph) * (o.moving ? 3 : 1.6);
    const cx = W * 0.6, cy = H * 0.5, bw = W * 0.24, bh = H * 0.16;
    // the long tail: a thin line that fades to a glowing tip
    const tail = hex('#bfe8ff');
    for (let i = 0; i < W * 0.5; i++) {
      const x = cx - bw - i, y = cy + Math.sin(ph + i * 0.25) * (i / (W * 0.5)) * 1.5;
      p.set(x, y, i < W * 0.12 ? mul(o.c, 0.9) : mix(o.c, tail, Math.min(1, i / (W * 0.4))));
    }
    p.circle(cx - bw - W * 0.5, cy + Math.sin(ph + W * 0.125) * 1.5, 1, WHITE);
    // wings (up and down) and the body disc
    p.tri([cx - bw * 0.6, cy], [cx + bw * 0.5, cy], [cx - bw * 0.1, cy - H * 0.36 - flap], o.c);
    p.tri([cx - bw * 0.6, cy], [cx + bw * 0.5, cy], [cx - bw * 0.1, cy + H * 0.3 + flap * 0.6], mul(o.c, 0.85));
    p.ellipse(cx, cy, bw, bh, o.c);
    p.ellipse(cx + 1, cy + bh * 0.4, bw - 2, bh * 0.45, mix(o.c, WHITE, 0.35));
    p.ellipse(cx + bw * 0.85, cy, bw * 0.35, bh * 0.75, mul(o.c, 1.08));           // head
    p.shade();
    for (let i = 0; i < 4; i++) p.set(Math.round(cx - bw * 0.5 + i * bw * 0.35), Math.round(cy - bh * 0.3), (o.frame + i) % 4 === 0 ? WHITE : o.a);   // star spots
    eye(p, Math.round(cx + bw * 0.95), Math.round(cy - bh * 0.25), W >= 20);
    p.outline();
  };
  // ---- Starfall tank decor
  S.stardust = function (p, o) {                // a low mound of dark sand sprinkled with glinting dust
    const W = p.w, H = p.h, r = mkRand(7);
    p.ellipse(W / 2, H - 2.5, W * 0.45, 2.6, o.c);
    p.shade(0.2); p.outline();
    for (let i = 0; i < 10; i++) { const x = Math.round(W * 0.15 + r() * W * 0.7), y = Math.round(H - 2 - r() * 3); if (p.a(x, y)) p.set(x, y, i % 3 ? o.a : WHITE); }
    p.set(Math.round(W * 0.35), H - 7, o.a); p.set(Math.round(W * 0.62), H - 8, WHITE); p.set(Math.round(W * 0.5), H - 10, alpha(o.a, 180));
  };
  S.meteorite = function (p, o) {               // a dark pitted space rock with warm glowing cracks
    const W = p.w, H = p.h, r = mkRand(13);
    p.ellipse(W / 2, H * 0.66, W * 0.4, H * 0.32, o.c);
    p.ellipse(W * 0.42, H * 0.52, W * 0.24, H * 0.22, mul(o.c, 1.08));
    p.shade(0.22);
    for (let i = 0; i < 7; i++) { const x = Math.round(W * 0.2 + r() * W * 0.6), y = Math.round(H * 0.45 + r() * H * 0.4); if (p.a(x, y) && p.a(x + 1, y)) { p.set(x, y, mul(o.c, 0.65)); p.set(x + 1, y, mul(o.c, 0.8)); } }
    p.line(W * 0.3, H * 0.62, W * 0.48, H * 0.78, o.a); p.line(W * 0.48, H * 0.78, W * 0.62, H * 0.66, mul(o.a, 0.85));
    p.set(Math.round(W * 0.66), H * 0.5, o.a);
    p.outline();
  };
  S.crater = function (p, o) {                  // a shallow crater bowl: a raised rim with a dark hollow
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H - 4, W * 0.46, H * 0.3, o.c);
    p.shade(0.25); p.outline();
    p.ellipse(W / 2, H - 5, W * 0.3, H * 0.14, mul(o.c, 0.45));
    p.ellipse(W / 2, H - 4.5, W * 0.24, H * 0.08, mul(o.c, 0.32));
    for (const u of [0.22, 0.5, 0.78]) p.set(Math.round(W * u), Math.round(H - 4 - H * 0.26), o.a);
  };
  S.starlantern = function (p, o) {             // a slim post holding a glowing five-point star
    const W = p.w, H = p.h, cx = Math.floor(W / 2), metal = o.c;
    p.rect(cx - 3, H - 2, 6, 2, metal); p.rect(cx, H * 0.4, 1, H * 0.6, metal);
    const sy = Math.round(H * 0.28), star = o.a;
    p.rect(cx - 1, sy - 1, 3, 3, star); p.set(cx, sy - 3, star); p.set(cx, sy - 2, star);
    p.set(cx - 3, sy, star); p.set(cx - 2, sy, star); p.set(cx + 2, sy, star); p.set(cx + 3, sy, star);
    p.set(cx - 2, sy + 2, star); p.set(cx + 2, sy + 2, star); p.set(cx - 2, sy + 3, star); p.set(cx + 2, sy + 3, star);
    p.outline(0.3);
    p.set(cx, sy, WHITE);
  };
  S.seahorse = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const spine = [[0.56, 0.24], [0.52, 0.34], [0.48, 0.45], [0.5, 0.57], [0.55, 0.67], [0.52, 0.77], [0.44, 0.83], [0.38, 0.78], [0.41, 0.71]];
    const rad = [0.11, 0.1, 0.12, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04];
    // ribbons trail behind (left) and sway
    for (let k = 0; k < 3; k++) for (let i = 0; i < 9; i++) {
      const u = i / 9, x = W * (0.46 - u * 0.32), y = H * (0.22 + k * 0.1) + u * H * 0.18 + Math.sin(u * 5 + ph + k) * H * 0.05;
      p.set(x, y, k === 1 ? mul(o.a, 1.1) : o.a);
    }
    spine.forEach(([x, y], i) => p.circle(W * x, H * y, Math.max(0.8, W * rad[i]), o.c));
    p.line(W * 0.62, H * 0.24, W * 0.84, H * 0.27, o.c); p.line(W * 0.62, H * 0.26, W * 0.84, H * 0.28, mul(o.c, 0.9));   // snout
    p.shade(0.25);
    for (let i = 0; i < 4; i++) p.set(W * (0.47 + (i % 2) * 0.04), H * (0.4 + i * 0.08), mul(o.c, 0.8));   // belly rings
    eye(p, Math.round(W * 0.58), Math.round(H * 0.22), false);
    p.outline(0.4);
  };
  // Candle-like polyps: stalks with glowing blooms at night; closed buds by day (o.closed).
  S.candlepolyp = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    p.ellipse(W / 2, H - 2, W * 0.36, 2.2, mul(o.c, 0.8));
    [[0.3, 0.42], [0.45, 0.22], [0.6, 0.32], [0.74, 0.5]].forEach(([x, t], i) => {
      const sway = o.closed ? 0 : Math.sin(ph + i) * 0.8, tx = W * x + sway, ty = H * t;
      p.line(W * x, H - 2, tx, ty, o.c); p.line(W * x + 1, H - 2, tx + 1, ty, mul(o.c, 0.85));
      if (o.closed) { p.ellipse(tx + 0.5, ty, 1.6, 2.2, mul(o.c, 1.2)); }
      else { p.circle(tx + 0.5, ty - 1, 2.2, o.a); p.set(tx + 0.5, ty - 1, WHITE); p.set(tx - 1.5, ty - 2, mix(o.a, WHITE, 0.4)); p.set(tx + 2.5, ty - 2, mix(o.a, WHITE, 0.4)); }
    });
    p.shade(0.2); p.outline(0.4);
  };
  // Flying fish: slim body with big wing-fins that flap.
  S.flyfish = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, flap = Math.sin(ph) * (o.moving ? 1 : 0.5);
    p.tri([W * 0.2, H * 0.5], [W * 0.04, H * 0.3], [W * 0.04, H * 0.7], mul(o.c, 0.9));   // forked tail
    p.ellipse(W * 0.5, H * 0.52, W * 0.32, H * 0.14, o.c);
    p.tri([W * 0.52, H * 0.46], [W * 0.26, H * (0.12 - flap * 0.08)], [W * 0.36, H * 0.48], o.a);   // wing
    p.tri([W * 0.5, H * 0.6], [W * 0.3, H * (0.82 + flap * 0.06)], [W * 0.4, H * 0.58], mul(o.a, 0.85));
    p.ellipse(W * 0.5, H * 0.58, W * 0.24, H * 0.05, mix(o.c, WHITE, 0.5));             // pale belly
    p.shade(0.25);
    eye(p, Math.round(W * 0.74), Math.round(H * 0.48), W >= 20);
    p.outline();
  };
  // Turtle side view. o.sail: a tall sail-like fin on the shell; o.dome: a heavy tortoise dome.
  S.turtle = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2, paddle = Math.sin(ph) * (o.moving ? 1 : 0.4);
    const cx = W * 0.47, cy = H * (o.dome ? 0.62 : 0.6), rx = W * (o.dome ? 0.3 : 0.32), ry = H * (o.dome ? 0.3 : 0.22);
    // flippers / legs
    if (o.dome) { p.rect(Math.round(cx - rx * 0.6), Math.round(cy + ry * 0.4), 4, Math.round(H * 0.16), mul(o.c, 0.8)); p.rect(Math.round(cx + rx * 0.4), Math.round(cy + ry * 0.4), 4, Math.round(H * 0.16), mul(o.c, 0.8)); }
    else {
      p.tri([cx + rx * 0.4, cy], [cx + rx * 0.9, cy + ry * (1.6 + paddle * 0.6)], [cx + rx * 0.1, cy + ry * 0.8], mul(o.c, 0.85));
      p.tri([cx - rx * 0.5, cy + ry * 0.2], [cx - rx * 1.05, cy + ry * (1.2 - paddle * 0.5)], [cx - rx * 0.2, cy + ry * 0.7], mul(o.c, 0.8));
    }
    // head + neck
    p.ellipse(cx + rx + W * 0.06, cy - ry * (o.dome ? 0.1 : 0.2), W * 0.08, H * 0.1, mix(o.c, WHITE, 0.15));
    // shell: dome on top, flat belly
    for (let y = -ry; y <= 0; y++) { const w = rx * Math.sqrt(1 - (y * y) / (ry * ry)); p.rect(Math.round(cx - w), Math.round(cy + y), Math.round(w * 2), 1, o.a); }
    p.rect(Math.round(cx - rx), Math.round(cy), Math.round(rx * 2), Math.max(2, Math.round(H * 0.08)), mix(o.c, WHITE, 0.3));
    for (let i = -2; i <= 2; i++) p.line(cx + i * rx * 0.36, cy - 1, cx + i * rx * 0.26, cy - ry * 0.8, mul(o.a, 0.75));   // scutes
    if (o.sail) p.tri([cx - rx * 0.4, cy - ry * 0.8], [cx + rx * 0.5, cy - ry * 0.8], [cx - rx * 0.05, cy - ry - H * 0.38], mix(o.a, WHITE, 0.35));
    p.shade(0.2);
    eye(p, Math.round(cx + rx + W * 0.09), Math.round(cy - ry * (o.dome ? 0.15 : 0.25)), false);
    p.outline();
  };

  // ---------- themed decorations (aquarium stage 4) ----------
  const CLEAR = [0, 0, 0, 0];
  S.anemonerock = function (p, o) {          // tide-pool rock with anemones + barnacles
    const W = p.w, H = p.h;
    S.rock(p, Object.assign({}, o, { seed: 7 }));
    for (const [x, c] of [[0.3, o.a], [0.62, mul(o.a, 0.85)]]) {
      const cx = W * x, cy = H * 0.42;
      for (let k = -2; k <= 2; k++) p.line(cx, cy + 2, cx + k * 1.2, cy - 2 + Math.abs(k) * 0.5, c);
      p.set(cx, cy + 2, mul(c, 0.7));
    }
    for (let i = 0; i < 5; i++) p.set(W * (0.2 + i * 0.15), H * 0.7 + (i % 2), [236, 228, 214, 255]);
  };
  S.sanddollar = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H - 3, W * 0.42, 2.2, o.c); p.shade(0.2);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 1.2566; p.set(W / 2 + Math.cos(a) * 2.5, H - 3 + Math.sin(a) * 1.1, mul(o.c, 0.75)); }
    p.outline();
  };
  S.pail = function (p, o) {                 // a lost sand pail on its side - a cosy hideout
    const W = p.w, H = p.h;
    p.tri([2, H - 2], [W - 3, H - 4], [W - 3, H - 1], o.c);
    p.rect(3, H - 10, W - 6, 8, o.c);
    p.ellipse(3, H - 6, 2, 4.5, mul(o.c, 0.5)); p.ellipse(3, H - 6, 1.2, 3.4, [20, 18, 30, 255]);
    p.rect(5, H - 9, W - 9, 1, o.a);
    p.line(W - 4, H - 10, W - 1, H - 13, [90, 90, 96, 255]); p.line(W - 1, H - 13, W - 1, H - 4, [90, 90, 96, 255]);
    p.shade(0.2); p.outline();
  };
  S.lighthouse = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    for (let y = 6; y < H - 1; y++) { const w = Math.round((y - 6) / (H - 7) * 4.5) + 1; const band = Math.floor((y - 6) / 4) % 2; p.rect(cx - w, y, w * 2, 1, band ? o.a : o.c); }
    p.rect(cx - 2, 3, 4, 3, [255, 236, 140, 255]); p.rect(cx - 3, 2, 6, 1, [60, 60, 70, 255]); p.set(cx, 1, [60, 60, 70, 255]);
    p.shade(0.15); p.outline();
  };
  S.flatrock = function (p, o) {
    const W = p.w, H = p.h, r = mkRand(o.seed || 4);
    p.ellipse(W / 2, H * 0.72, W * 0.46, H * 0.26, o.c);
    p.rect(Math.round(W * 0.14), Math.round(H * 0.5), Math.round(W * 0.72), 2, mul(o.c, 1.06));
    p.shade(0.25);
    for (let i = 0; i < W; i++) { const x = Math.floor(r() * W), y = Math.floor(H * 0.55 + r() * H * 0.4); if (p.a(x, y)) p.set(x, y, mul(o.c, 0.86)); }
    if (o.moss) for (let x = W * 0.15; x < W * 0.85; x++) if (p.a(x, H * 0.5)) p.set(x, H * 0.5 - (x % 3 ? 0 : 1), hex(o.moss));
    p.outline();
  };
  S.urchin = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, cy = H - 5;
    for (let k = 0; k < 14; k++) { const a = Math.PI + k * Math.PI / 13; p.line(cx, cy, cx + Math.cos(a) * W * 0.46, cy + Math.sin(a) * H * 0.55, mul(o.c, 0.8)); }
    p.ellipse(cx, cy, W * 0.26, 3.6, o.c); p.rect(cx - W * 0.26, cy + 2, W * 0.52, 3, CLEAR);
    p.shade(0.25); p.outline(0.3); p.set(cx - 1, cy - 2, o.a);
  };
  S.kelparch = function (p, o) {
    const W = p.w, H = p.h;
    S.arch(p, Object.assign({}, o));
    const g = hex(o.kelp || '#4f8a43');
    for (let k = 0; k < 5; k++) { const x0 = W * (0.12 + k * 0.19); for (let y = H * 0.12; y < H * 0.6; y++) if (p.a(x0, y) || y > H * 0.2) p.set(x0 + Math.sin(y * 0.5 + k) * 1.2, y + (k % 2) * 3, k % 2 ? g : mul(g, 1.2)); }
  };
  S.clam = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.ellipse(cx, H - 4, W * 0.45, 4, o.c);                                    // lower shell
    p.ellipse(cx, H - 9, W * 0.44, 5, mul(o.c, 1.08)); p.rect(1, H - 8, W - 2, 3, CLEAR);   // open lid
    for (let i = -3; i <= 3; i++) p.line(cx, H - 2, cx + i * W * 0.12, H - 7, mul(o.c, 0.8));
    p.ellipse(cx, H - 6.5, W * 0.3, 1.4, o.a); p.circle(cx, H - 6.5, 1.2, [250, 246, 236, 255]);   // pearl
    p.shade(0.2); p.outline();
  };
  S.seafan = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, base = H - 1;
    for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.92 + k * Math.PI * 0.84 / 8; p.line(cx, base, cx + Math.cos(a) * W * 0.46, base + Math.sin(a) * H * 0.9, o.c); }
    for (let r = 4; r < H * 0.9; r += 3) for (let a = -Math.PI * 0.9; a < -Math.PI * 0.1; a += 0.06) p.set(cx + Math.cos(a) * r * (W / H) * 1.0, base + Math.sin(a) * r, mul(o.c, 0.9));
    p.shade(0.2); p.outline(0.4);
    for (let i = 0; i < 6; i++) p.set(cx + (i - 3) * W * 0.12, base - H * (0.4 + (i % 3) * 0.15), o.a);
  };
  S.glowstone = function (p, o) {
    const W = p.w, H = p.h;
    S.rock(p, Object.assign({}, o, { seed: 9 }));
    const gl = hex(o.glow || '#7ff6ff');
    [[0.3, 0.6], [0.58, 0.5], [0.7, 0.74], [0.42, 0.8]].forEach(([x, y], i) => { p.set(W * x, H * y, gl); p.set(W * x + 1, H * y, mul(gl, 0.8)); if (i % 2 === 0) { p.set(W * x, H * y + 1, mul(gl, 0.8)); p.set(W * x + 1, H * y + 1, mul(gl, 0.6)); } });
  };
  S.tubeworms = function (p, o) {
    const W = p.w, H = p.h;
    [[0.25, 0.45], [0.42, 0.2], [0.58, 0.32], [0.74, 0.5], [0.36, 0.6]].forEach(([x, t]) => {
      p.rect(W * x - 1, H * t, 3, H * (1 - t), o.c); p.rect(W * x - 1, H * t, 1, H * (1 - t), mul(o.c, 1.1));
    });
    p.shade(0.2); p.outline(0.4);
    [[0.25, 0.45], [0.42, 0.2], [0.58, 0.32], [0.74, 0.5], [0.36, 0.6]].forEach(([x, t]) => { p.rect(W * x - 2, H * t - 2, 5, 2, o.a); p.set(W * x, H * t - 3, o.a); });
  };
  S.ribs = function (p, o) {                 // old whale bones: a ribcage arch
    const W = p.w, H = p.h;
    p.rect(1, H - 3, W - 2, 2, o.c);
    for (let k = 0; k < 4; k++) {
      const x0 = 4 + k * (W - 8) / 3, h = H * (0.75 - Math.abs(k - 1.5) * 0.1);
      for (let y = 0; y < h; y++) { const bend = Math.sin(y / h * Math.PI * 0.9) * 4; p.set(x0 + bend * (k < 2 ? 1 : -1) * 0.6, H - 3 - y, o.c); p.set(x0 + 1 + bend * (k < 2 ? 1 : -1) * 0.6, H - 3 - y, mul(o.c, 0.85)); }
    }
    p.shade(0.2); p.outline();
  };
  S.lantern = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, metal = hex(o.metal || '#4a4a52');
    p.rect(cx - 4, H - 3, 8, 2, metal);
    p.rect(cx - 3, H - 11, 6, 8, o.a); p.rect(cx - 2, H - 10, 4, 6, mul(o.a, 1.2));
    p.rect(cx - 4, H - 12, 8, 1, metal); p.rect(cx - 3, H - 13, 6, 1, metal); p.set(cx, H - 14, metal);
    p.rect(cx - 4, H - 11, 1, 8, metal); p.rect(cx + 3, H - 11, 1, 8, metal);
    p.outline();
  };
  S.stalagmite = function (p, o) {
    const W = p.w, H = p.h, r = mkRand(o.seed || 2);
    for (let y = 1; y < H; y++) {
      const u = y / H, w = Math.max(0.6, Math.pow(u, 0.85) * W * 0.46 + (r() - 0.5) * 0.8);
      p.rect(Math.round(W / 2 - w), y, Math.round(w * 2), 1, o.c);
    }
    p.tri([W * 0.02, H - 1], [W * 0.36, H - 1], [W * 0.16, H * 0.62], mul(o.c, 0.92));
    p.shade(0.25);
    for (let y = 6; y < H - 2; y += 5) p.rect(Math.round(W / 2 - Math.pow(y / H, 0.85) * W * 0.3), y, 2, 1, mul(o.c, 0.82));
    p.line(W / 2 + 1, 3, W / 2 + 3, H - 3, mul(o.c, 1.15));
    p.outline();
  };
  S.den = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.7, W * 0.47, H * 0.42, o.c);
    p.rect(0, H - 1, W, 1, CLEAR);
    p.shade(0.25);
    p.ellipse(W * 0.5, H - 3, W * 0.17, H * 0.22, [24, 22, 30, 255]);
    p.outline();
  };
  S.geode = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.ellipse(cx, H - 2, W * 0.45, H * 0.6, o.c); p.rect(0, H - 1, W, 2, CLEAR);
    p.shade(0.2);
    p.ellipse(cx, H - 2, W * 0.32, H * 0.42, [40, 30, 60, 255]);
    for (let i = 0; i < 7; i++) { const x = cx - W * 0.26 + i * W * 0.087; p.tri([x - 1.5, H - 2], [x + 1.5, H - 2], [x, H - 2 - H * (0.18 + (i % 3) * 0.08)], i % 2 ? o.a : mul(o.a, 1.25)); }
    p.rect(0, H - 1, W, 2, CLEAR); p.outline();
  };
  S.buoy = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.rect(cx - 1, 0, 2, 4, [70, 70, 80, 255]); p.set(cx, 0, [255, 236, 140, 255]);
    p.ellipse(cx, H * 0.45, W * 0.32, H * 0.3, o.c);
    p.rect(cx - W * 0.32, H * 0.42, W * 0.64, 2, o.a);
    p.line(cx, H * 0.72, cx, H - 1, [70, 70, 80, 255]);
    p.shade(0.25); p.outline();
  };
  S.bottle = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W * 0.45, H - 4, W * 0.32, 3, o.c);
    p.rect(W * 0.72, H - 5, 3, 2, o.c); p.rect(W * 0.72 + 3, H - 5, 1, 2, [150, 100, 60, 255]);
    p.rect(W * 0.3, H - 5, W * 0.28, 2, [240, 228, 196, 255]);
    p.shade(0.3); p.outline(0.5);
  };
  S.glassfloat = function (p, o) {
    const W = p.w, H = p.h;
    [[0.32, 0.45, 0.24, o.c], [0.66, 0.55, 0.2, o.a]].forEach(([x, y, r, c]) => {
      p.circle(W * x, H * y, W * r, c);
      for (let a = 0; a < 6.28; a += 0.5) p.set(W * x + Math.cos(a) * W * r, H * y + Math.sin(a) * W * r, [150, 110, 70, 255]);
      p.set(W * x - W * r * 0.4, H * y - W * r * 0.4, WHITE);
    });
    p.outline(0.5);
  };
  S.wheel = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, cy = H / 2;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; p.line(cx, cy, cx + Math.cos(a) * W * 0.46, cy + Math.sin(a) * H * 0.46, o.c); }
    for (let a = 0; a < 6.28; a += 0.08) { p.set(cx + Math.cos(a) * W * 0.32, cy + Math.sin(a) * H * 0.32, o.c); p.set(cx + Math.cos(a) * W * 0.28, cy + Math.sin(a) * H * 0.28, mul(o.c, 0.8)); }
    p.circle(cx, cy, 2, o.a);
    p.shade(0.2); p.outline();
  };
  S.brokencolumn = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.rect(cx - 6, H - 3, 12, 2, o.c); p.rect(cx - 4, H * 0.35, 8, H * 0.65 - 3, o.c);
    p.tri([cx - 4, H * 0.35], [cx + 4, H * 0.35], [cx + 4, H * 0.22], o.c);
    p.shade(0.2);
    for (let x = -2; x <= 2; x += 2) p.line(cx + x, H * 0.38, cx + x, H - 4, mul(o.c, 0.85));
    p.rect(cx + 5, H - 5, 3, 2, o.c);
    p.outline();
  };
  S.statuehead = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.ellipse(cx, H * 0.55, W * 0.34, H * 0.42, o.c);
    p.rect(cx - W * 0.4, H - 4, W * 0.8, 3, mul(o.c, 0.9));
    p.shade(0.25);
    const d = mul(o.c, 0.6);
    p.rect(cx - 4, H * 0.45, 3, 1, d); p.rect(cx + 2, H * 0.45, 3, 1, d);   // closed eyes
    p.rect(cx, H * 0.48, 1, 4, d); p.rect(cx - 2, H * 0.68, 4, 1, d);
    p.ellipse(cx, H * 0.2, W * 0.3, H * 0.1, o.a);                          // a little moss cap
    p.outline();
  };
  S.cannon = function (p, o) {
    const W = p.w, H = p.h, wood = hex('#7a5232');
    p.rect(3, H * 0.35, W * 0.78, H * 0.3, o.c); p.rect(W * 0.8, H * 0.3, 3, H * 0.4, o.c);
    p.ellipse(W * 0.82 + 2, H * 0.5, 1.2, 2, [20, 18, 30, 255]);
    p.rect(2, H * 0.62, W * 0.55, H * 0.2, wood);
    p.circle(W * 0.18, H - 3, 2.5, mul(wood, 0.8)); p.circle(W * 0.48, H - 3, 2.5, mul(wood, 0.8));
    p.shade(0.25); p.outline();
  };
  S.idol = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.rect(cx - 5, H - 3, 10, 2, hex('#6d6b5c'));
    p.ellipse(cx, H * 0.6, W * 0.26, H * 0.28, o.c); p.circle(cx, H * 0.26, W * 0.2, o.c);
    p.shade(0.3);
    p.set(cx - 1, H * 0.24, [60, 30, 10, 255]); p.set(cx + 1, H * 0.24, [60, 30, 10, 255]);
    p.set(cx, H * 0.1, WHITE); p.set(cx + 2, H * 0.5, [255, 250, 200, 255]);
    p.outline();
  };
  S.chimney = function (p, o) {              // a tiny vent chimney that puffs bubbles
    const W = p.w, H = p.h, cx = W / 2;
    p.tri([cx - W * 0.4, H - 1], [cx + W * 0.4, H - 1], [cx - 1, H * 0.15], o.c);
    p.rect(cx - 2, H * 0.12, 4, H * 0.3, o.c);
    p.shade(0.25);
    p.rect(cx - 1, H * 0.12, 2, 1, hex(o.glow || '#ffb060'));
    for (let y = H * 0.5; y < H - 2; y += 3) p.set(cx + ((y | 0) % 2 ? 1 : -2), y, hex(o.glow || '#ff8a3a'));
    p.outline();
  };
  S.basalt = function (p, o) {
    const W = p.w, H = p.h;
    [[0.08, 0.5], [0.3, 0.2], [0.52, 0.35], [0.74, 0.55]].forEach(([x, t], i) => {
      p.rect(W * x, H * t, W * 0.2, H * (1 - t), i % 2 ? o.c : mul(o.c, 0.88));
      p.rect(W * x, H * t, W * 0.2, 1, mul(o.c, 1.25));
    });
    p.shade(0.15); p.outline();
  };
  S.magmarock = function (p, o) {
    const W = p.w, H = p.h, gl = hex(o.glow || '#ff7a2a');
    S.rock(p, Object.assign({}, o, { seed: 3 }));
    p.line(W * 0.3, H * 0.5, W * 0.45, H * 0.75, gl); p.line(W * 0.45, H * 0.75, W * 0.62, H * 0.6, gl); p.line(W * 0.62, H * 0.6, W * 0.72, H * 0.8, mul(gl, 0.85));
    p.set(W * 0.45, H * 0.75, [255, 230, 140, 255]);
  };
  S.roots = function (p, o) {                // arching mangrove prop roots
    const W = p.w, H = p.h;
    for (let k = 0; k < 4; k++) {
      const x0 = W * (0.1 + k * 0.27), top = H * (0.2 + (k % 2) * 0.12);
      for (let y = top; y < H; y++) { const u = (y - top) / (H - top); const x = x0 + Math.sin(u * 2.4) * W * 0.12 * (k % 2 ? 1 : -1); p.set(x, y, o.c); p.set(x + 1, y, mul(o.c, 0.85)); }
    }
    p.rect(W * 0.08, H * 0.18, W * 0.84, 3, o.c);
    p.shade(0.2); p.outline();
    for (let i = 0; i < 4; i++) p.set(W * (0.2 + i * 0.2), H * 0.18 - 1, o.a);
  };
  S.lilypad = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2;
    p.ellipse(cx, 3, W * 0.45, 2.2, o.c); p.tri([cx, 3], [cx + 3, 0], [cx + 5, 1], CLEAR);
    p.line(cx, 4, cx, H - 1, mul(o.c, 0.7));
    p.shade(0.2); p.outline();
    if (o.flower) { p.set(cx - 3, 1, hex(o.flower)); p.set(cx - 2, 0, hex(o.flower)); p.set(cx - 4, 0, hex(o.flower)); }
  };
  S.log = function (p, o) {                  // hollow log
    const W = p.w, H = p.h;
    p.rect(3, H * 0.35, W - 8, H * 0.6, o.c); p.ellipse(W - 5, H * 0.65, 2.5, H * 0.3, mul(o.c, 1.15));
    p.ellipse(4, H * 0.65, 3, H * 0.3, mul(o.c, 0.8)); p.ellipse(4, H * 0.65, 1.8, H * 0.2, [24, 20, 18, 255]);
    p.shade(0.2);
    for (let x = 8; x < W - 8; x += 5) p.line(x, H * 0.45, x + 3, H * 0.45, mul(o.c, 0.8));
    p.set(W * 0.6, H * 0.35 - 1, o.a); p.set(W * 0.6 + 1, H * 0.35 - 2, o.a);
    p.outline();
  };
  S.icechunk = function (p, o) {
    const W = p.w, H = p.h;
    p.tri([1, H - 1], [W - 1, H - 1], [W * 0.62, H * 0.2], o.c);
    p.tri([1, H - 1], [W * 0.5, H - 1], [W * 0.25, H * 0.42], mul(o.c, 0.94));
    p.shade(0.15);
    p.line(W * 0.62, H * 0.24, W * 0.5, H * 0.7, WHITE); p.line(W * 0.25, H * 0.48, W * 0.3, H * 0.75, mul(o.a, 1.1));
    p.outline(0.55);
  };
  S.icecave = function (p, o) {
    const W = p.w, H = p.h;
    p.ellipse(W / 2, H * 0.72, W * 0.48, H * 0.66, o.c); p.rect(0, H - 1, W, 2, CLEAR);
    p.shade(0.15);
    for (let a = Math.PI; a < Math.PI * 2; a += 0.35) p.line(W / 2 + Math.cos(a) * W * 0.47, H * 0.72 + Math.sin(a) * H * 0.65, W / 2 + Math.cos(a) * W * 0.3, H * 0.72 + Math.sin(a) * H * 0.42, mul(o.c, 0.9));
    p.ellipse(W / 2, H - 2, W * 0.2, H * 0.32, [40, 70, 100, 255]); p.ellipse(W / 2, H - 2, W * 0.14, H * 0.24, [24, 44, 70, 255]);
    p.rect(0, H - 1, W, 2, CLEAR); p.outline(0.55);
  };
  S.mushroom = function (p, o) {
    const W = p.w, H = p.h;
    [[0.35, 0.3, 0.3], [0.68, 0.55, 0.2]].forEach(([x, t, r]) => {
      p.rect(W * x - 1, H * t, 2, H * (1 - t), [230, 222, 200, 255]);
      p.ellipse(W * x, H * t, W * r, H * r * 0.55, o.c); p.rect(W * x - W * r, H * t + 1, W * r * 2, H * r, CLEAR);
      p.rect(W * x - 1, H * t + 1, 2, H * (1 - t) - 1, [230, 222, 200, 255]);
    });
    p.shade(0.25); p.outline(0.4);
    p.set(W * 0.3, H * 0.2, o.a); p.set(W * 0.4, H * 0.24, o.a); p.set(W * 0.66, H * 0.5, o.a);
  };
  S.florarch = function (p, o) {
    const W = p.w, H = p.h;
    S.arch(p, Object.assign({}, o));
    const leaf = hex(o.leaf || '#4f8a43'), r = mkRand(5);
    for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 0.12) {
      const x = W / 2 + Math.cos(a) * W * 0.44, y = H * 0.6 + Math.sin(a) * H * 0.53;
      p.set(x, y, leaf); p.set(x, y + 1, mul(leaf, 0.8));
      if (r() < 0.35) p.set(x + (r() < 0.5 ? 1 : -1), y - 1, r() < 0.5 ? o.a : hex(o.flower2 || '#fff1a8'));
    }
  };

  // ---------- scene pieces: the hill, the UFO + beam, the aquarium building in space ----------
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255];
  // dithered multi-stop gradient colour at t (0..1) for pixel (x, y)
  const gradAt = (stops, t, x, y) => {
    const n = stops.length - 1, f = Math.max(0, Math.min(0.9999, t)) * n, i = Math.floor(f), u = f - i;
    const q = Math.floor(u * 4 + BAY[y & 3][x & 3] / 16) / 4;   // 4 dithered steps between stops
    return lerpC(stops[i], stops[i + 1], Math.min(1, q));
  };
  const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  S.signpost = function (p, o) {
    const W = p.w, H = p.h, wood = hex('#9b6a3e'), dark = hex('#6e4526'), paint = hex('#fff1c4');
    p.rect(7, 6, 2, H - 6, wood); p.rect(7, 6, 1, H - 6, mul(wood, 1.15));
    // arrow board pointing left (the way up the hill)
    p.rect(3, 4, 12, 6, wood); p.tri([0, 7], [3, 3], [3, 11], wood);
    p.rect(3, 9, 12, 1, dark);
    p.line(4, 7, 11, 7, paint); p.line(4, 7, 6, 5, paint); p.line(4, 7, 6, 9, paint);
    p.rect(6, H - 2, 4, 2, mul(wood, 0.8));
    p.outline();
    p.set(14, 2, hex('#fff6a0')); p.set(14, 3, hex('#ffd25a'));   // a tiny lantern
  };
  // A subtle saucer: a thin, flat dark-navy disc with a soft light edge on top and a glowing ring of
  // pale lavender light underneath (no dome, no coloured bulbs).
  S.ufo = function (p, o) {
    const cx = 32, cy = 14, rx = 29, ry = 4.2;
    const top = hex('#24408a'), mid = hex('#132658'), bot = hex('#0a1636'), edge = hex('#8eaef0');
    for (let y = -5; y <= 5; y++) for (let x = -30; x <= 30; x++) {
      const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (e > 1) continue;
      const t = (y + ry) / (2 * ry);
      p.set(cx + x, cy + y, t < 0.35 ? lerpC(top, mid, t / 0.35) : lerpC(mid, bot, (t - 0.35) / 0.65));
    }
    // the light edge along the top of the rim, brightest in the middle
    for (let x = -27; x <= 27; x++) {
      const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx))));
      p.set(cx + x, y, lerpC(edge, top, Math.abs(x) / 30));
    }
    // glowing ring underneath (slowly breathing)
    const glow = 0.85 + 0.15 * Math.sin(o.frame / 4 * Math.PI * 2);
    const rr = 17, rry = 2.4, gy = cy + 3;
    for (let y = -4; y <= 4; y++) for (let x = -22; x <= 22; x++) {
      const e = Math.sqrt((x * x) / (rr * rr) + (y * y) / (rry * rry));
      const ring = Math.max(0, 1 - Math.abs(e - 1) * 2.2), inner = e < 1 ? 0.35 : 0;
      const a = Math.min(1, ring + inner) * glow;
      if (a < 0.08) continue;
      const c = ring > 0.6 ? [244, 240, 255] : ring > 0.25 ? [196, 186, 255] : [170, 168, 240];
      p.set(cx + x, gy + y, [c[0], c[1], c[2], Math.round(a * 255)]);
    }
  };
  // The beam: a soft lavender cone that widens downward, with faint brighter blue edges, fading out
  // towards the ground. Drawn additively, stretched to the beam's size.
  S.beam = function (p, o) {
    const W = p.w, H = p.h;
    for (let y = 0; y < H; y++) {
      const v = y / H, half = 7 + v * (W / 2 - 7.5);
      const fade = (1 - v * 0.55) * Math.min(1, (H - y) / (H * 0.3));
      const ripple = 1 + 0.08 * Math.sin((y + o.frame * 6) * 0.26);
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x + 0.5 - W / 2) / half;
        if (d > 1) continue;
        const core = (1 - d * d) * 80, rim = d > 0.78 ? (1 - Math.abs(d - 0.9) / 0.12) * 90 : 0;
        const a = Math.max(0, (core + Math.max(0, rim)) * fade * ripple);
        const c = d > 0.75 ? [150, 178, 255] : [220, 206, 255];
        if (a >= 4) p.set(x, y, [c[0], c[1], c[2], Math.min(255, Math.round(a))]);
      }
    }
    for (let i = 0; i < 4; i++) {                                                             // a few slow motes
      const sy = Math.floor((hash(i, 1, 7) * H + H - o.frame * 5) % H), sx = Math.round(W / 2 + (hash(i, 2, 7) - 0.5) * (8 + sy / H * 16));
      p.set(sx, sy, [240, 236, 255, 140]);
    }
  };
  // Message bottle (upright; the game tips it over or bobs it): pale sea-glass, a cork, a rolled note
  // inside, and a small glint that slides down the glass frame by frame.
  S.bottle = function (p, o) {
    const W = p.w, H = p.h, cx = Math.floor(W / 2), glass = [150, 214, 200, 210], edge = [96, 168, 160, 255];
    p.rect(cx - 3, H - 9, 6, 8, glass); p.rect(cx - 2, H - 10, 4, 1, glass);           // body + shoulder
    p.rect(cx - 1, H - 12, 2, 2, glass);                                                 // neck
    p.rect(cx - 1, H - 13, 2, 1, hex('#a9774a')); p.set(cx - 1, H - 13, hex('#c99566'));  // cork
    for (let y = H - 9; y < H - 1; y++) { p.set(cx - 3, y, edge); p.set(cx + 2, y, edge); }
    p.rect(cx - 3, H - 1, 6, 1, edge);
    p.rect(cx - 1, H - 8, 2, 5, hex('#f2e6c4')); p.set(cx, H - 7, hex('#c9b78f'));       // the rolled note
    const gy = H - 9 + (o.frame * 2) % 8;                                                // glint
    p.set(cx + 1, gy, WHITE); if (gy + 1 < H - 1) p.set(cx + 1, gy + 1, [255, 255, 255, 170]);
  };
  // Small UI icons for the tutorial tips, one per frame (12 x 12): 0 alert (!), 1 moon, 2 star, 3 heart,
  // 4 open book, 5 footprints (sneak), 6 sparkle. Soft, bright colours with a dark outline.
  S.uiicons = function (p, o) {
    const W = p.w, cx = Math.floor(W / 2), Y = hex('#ffe9a8'), B = hex('#d8e4ff'), P = hex('#ff9fc0');
    const f = o.frame;
    if (f === 0) { p.rect(cx - 1, 1, 2, 7, Y); p.rect(cx - 1, 9, 2, 2, Y); }
    else if (f === 1) { p.circle(cx, 6, 4.5, B); p.circle(cx + 2, 4.5, 3.6, [0, 0, 0, 0]); for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const i = p.idx(x, y); if (i >= 0 && p.d[i + 3] && p.d[i] === 0 && p.d[i + 1] === 0) p.d[i + 3] = 0; } }
    else if (f === 2) { p.tri([cx, 0], [cx - 2, 5], [cx + 2, 5], Y); p.tri([0, 4], [W - 1, 4], [cx, 8], Y); p.tri([cx, 6], [2, 11], [cx - 1, 7], Y); p.tri([cx, 6], [W - 2, 11], [cx + 1, 7], Y); }
    else if (f === 3) { p.circle(cx - 2, 4, 2.6, P); p.circle(cx + 2, 4, 2.6, P); p.tri([1, 5], [W - 1, 5], [cx, 11], P); }
    else if (f === 4) { p.rect(1, 2, 4, 8, hex('#f2e6c4')); p.rect(7, 2, 4, 8, hex('#f2e6c4')); p.rect(5, 2, 2, 9, hex('#c9a46a')); for (let y = 4; y < 9; y += 2) { p.rect(2, y, 2, 1, hex('#8a7a5a')); p.rect(8, y, 2, 1, hex('#8a7a5a')); } }
    else if (f === 5) { p.ellipse(3.5, 7.5, 1.6, 2.4, B); p.ellipse(8, 4, 1.6, 2.4, B); p.set(3, 4, B); p.set(8, 1, B); }
    else { p.rect(cx, 0, 1, 12, Y); p.rect(0, 6, 12, 1, Y); p.rect(cx - 1, 5, 3, 3, hex('#ffffff')); p.set(2, 2, B); p.set(9, 9, B); p.set(9, 2, B); }
    p.outline(0.3);
  };
  // Guided-dive markers: a soft glowing ring that pulses (16 x 16, 4 frames) and a small arrow that bobs
  // (8 x 8, 4 frames), both a pale warm gold.
  S.uimarker = function (p, o) {
    const W = p.w, c = W / 2, r = 4.5 + [0, 0.8, 1.6, 0.8][o.frame], col = hex('#fff1b0');
    // a dark edge just outside and inside the bright ring, so it reads on bright sand and sky as well as at night
    for (const rr of [r - 1, r + 1]) for (let a = 0; a < Math.PI * 2; a += 0.05) p.set(c + Math.cos(a) * rr - 0.5, c + Math.sin(a) * rr - 0.5, [40, 34, 24, 170]);
    for (let a = 0; a < Math.PI * 2; a += 0.05) p.set(c + Math.cos(a) * r - 0.5, c + Math.sin(a) * r - 0.5, col);
  };
  S.uiarrow = function (p, o) {
    const dy = [0, 1, 2, 1][o.frame], col = hex('#fff1b0');
    p.tri([0, 2 + dy], [p.w, 2 + dy], [p.w / 2, p.h - 1 + dy * 0], col);
    p.rect(p.w / 2 - 1, dy, 2, 3, col);
    p.outline(0.35);
  };
  S.beampad = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, metal = hex('#8a96a6');
    p.ellipse(cx, H - 4, W / 2 - 1, 3.6, metal);
    p.rect(2, H - 4, W - 4, 3, mul(metal, 0.7));
    p.ellipse(cx, H - 5, W / 2 - 1, 3.2, mul(metal, 1.12));
    p.outline(0.3);
    for (let i = 0; i < 12; i++) {                                                            // glowing ring + chase lights
      const a = i / 12 * Math.PI * 2, on = (i + o.frame * 3) % 12 < 3;
      p.set(cx + Math.cos(a) * (W / 2 - 5), H - 5 + Math.sin(a) * 1.8, on ? hex('#ffffff') : hex('#5fe0f0'));
    }
    p.ellipse(cx, H - 5, 5, 1.2, hex('#bff6ff'));
    for (let i = 0; i < 4; i++) p.set(4 + i * (W - 9) / 3, H - 2, i % 2 ? hex('#ffd25a') : hex('#2a2a32'));   // hazard dots
  };
  S.console = function (p, o) {
    const W = p.w, H = p.h, body = hex('#5a6a7a');
    p.rect(6, 12, 8, H - 12, body); p.rect(3, H - 3, 14, 3, mul(body, 0.8));
    p.rect(1, 1, W - 2, 12, mul(body, 1.1));
    p.shade(0.2); p.outline(0.3);
    p.rect(3, 3, W - 6, 8, hex('#0e2a3a'));
    for (let r = 0; r < 3; r++) {                                                             // scrolling "tank list"
      const len = 3 + ((r + o.frame) * 5) % 9;
      p.rect(4, 4 + r * 2 + 1, len, 1, r === o.frame % 3 ? hex('#ffe08a') : hex('#5fe0f0'));
    }
    p.set(W - 5, 4, o.frame % 2 ? hex('#7ef0c0') : hex('#2a6a5a'));
  };
  S.tankframe = function (p, o) {
    const W = p.w, H = p.h, m = hex('#5a6a7a'), hl = hex('#8fa2b4'), dk = hex('#33404c');
    p.rect(0, 0, W, 4, m); p.rect(0, 0, 4, H - 8, m); p.rect(W - 4, 0, 4, H - 8, m);
    p.rect(0, H - 8, W, 8, dk); p.rect(0, H - 8, W, 1, hl);
    p.rect(0, 0, W, 1, hl); p.rect(0, 0, 1, H - 8, hl);
    p.rect(3, 3, W - 6, 1, dk); p.rect(3, 3, 1, H - 11, dk); p.rect(W - 4, 3, 1, H - 11, dk);
    for (let x = 8; x < W - 8; x += 3) p.set(x, 1, hex('#bff6ff'));                           // lamp strip
    p.rect(W / 2 - 14, H - 6, 28, 5, hex('#1c2733'));                                       // name plate
    for (const x of [3, W - 4]) p.set(x, H - 4, hex('#9fe8a0'));
  };
  S.hillsky = function (p, o) {
    const W = p.w, H = p.h, stops = [hex('#2b3466'), hex('#5a4f8a'), hex('#c47f8e'), hex('#f2b48a'), hex('#ffe0a8')];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, gradAt(stops, y / (H * 0.82), x, y));
    for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i, 3, 1) * W), y = Math.floor(hash(i, 4, 1) * H * 0.45); p.set(x, y, hash(i, 5, 1) < 0.2 ? WHITE : [230, 225, 255, 150 + Math.floor(hash(i, 6, 1) * 100)]); }
    p.circle(236, 128, 15, hex('#fff1c8')); p.circle(236, 128, 11, hex('#fffbe8'));          // low sun
    for (let x = 0; x < W; x++) {                                                            // far hills
      const h1 = 136 + Math.sin(x * 0.021) * 6 + Math.sin(x * 0.07 + 1) * 3, h2 = 146 + Math.sin(x * 0.03 + 2) * 5;
      for (let y = Math.floor(h1); y < H; y++) p.set(x, y, hex('#8a6f9a'));
      for (let y = Math.floor(h2); y < H; y++) p.set(x, y, hex('#6d5a84'));
    }
    for (let y = 156; y < H; y++) for (let x = 0; x < W; x++) {                              // the sea far below
      const c = gradAt([hex('#6aa8c8'), hex('#3f7aa0')], (y - 156) / (H - 156), x, y);
      p.set(x, y, (y % 4 === 1 && Math.sin(x * 0.13 + y) + Math.sin(x * 0.041 - y * 0.5) > 1.75) ? hex('#ffe9c8') : c);
    }
  };
  S.hilltile = function (p, o) {
    const W = p.w, H = p.h;
    const g1 = hex('#9ad874'), g2 = hex('#73b552'), g3 = hex('#5a9a44'), d1 = hex('#9a744e'), d2 = hex('#7d5c3c'), d3 = hex('#5f442c');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash(x, y, 11), edge = 5 + Math.round(hash(x, 0, 12) * 2);
      let c = y < 1 ? g1 : y < 3 ? g2 : y < edge ? g3 : y < 22 ? d1 : y < 36 ? d2 : d3;
      if (y >= edge && n < 0.06) c = mul(c, 0.8);                                            // pebbles
      if (y >= edge && n > 0.97) c = hex('#c9b494');
      if (y === edge && n < 0.5) c = g3;                                                    // ragged turf edge
      if (y >= 22 && y < 24 && n < 0.5) c = d1; if (y >= 36 && y < 38 && n < 0.5) c = d2;    // soft strata
      p.set(x, y, c);
    }
  };
  S.spacebg = function (p, o) {
    const W = p.w, H = p.h;
    const per = (x, y, f, s) => Math.sin((x / W) * Math.PI * 2 * f + s) * Math.cos((y / H) * Math.PI * 2 * (f - 1) + s * 1.7);   // tileable waves
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = gradAt([hex('#0b0f26'), hex('#141a3a'), hex('#0e1230')], ((y / H) + 0.15 * per(x, y, 1, 0.3) + 0.5) % 1, x, y);
      const neb = per(x, y, 2, 1.1) * 0.6 + per(x, y, 3, 2.3) * 0.4;                           // soft nebula
      if (neb > 0.35) c = lerpC(c, hex('#3a2a6a'), Math.min(0.5, (neb - 0.35) * 1.4) * ((BAY[y & 3][x & 3] / 16) < 0.6 ? 1 : 0.6));
      if (neb < -0.55) c = lerpC(c, hex('#1a4a5a'), Math.min(0.4, (-0.55 - neb) * 1.4) * ((BAY[y & 3][x & 3] / 16) < 0.5 ? 1 : 0.5));
      p.set(x, y, c);
    }
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(hash(i, 1, 21) * W), y = Math.floor(hash(i, 2, 21) * H), b = hash(i, 3, 21);
      p.set(x, y, b > 0.9 ? WHITE : b > 0.6 ? [200, 215, 255, 255] : [140, 150, 200, 255]);
      if (b > 0.97) { p.set(x - 1, y, [170, 190, 255, 255]); p.set(x + 1, y, [170, 190, 255, 255]); p.set(x, y - 1, [170, 190, 255, 255]); p.set(x, y + 1, [170, 190, 255, 255]); }
    }
  };
  S.planet = function (p, o) {
    const W = p.w, H = p.h, cx = W / 2, cy = H / 2, r = Math.min(W, H) * (o.ring ? 0.32 : 0.45);
    const ring = (front) => { for (let a = 0; a < Math.PI * 2; a += 0.01) { const x = cx + Math.cos(a) * W * 0.47, y = cy + Math.sin(a) * H * 0.16; if ((Math.sin(a) > 0) === front) { p.set(x, y, o.a); p.set(x, y + 1, mul(o.a, 0.8)); } } };
    if (o.ring) ring(false);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y) / r; if (d > 1) continue;
      let c = o.c;
      if (o.ring && Math.sin((y / r) * 7) > 0.5) c = mul(c, 0.88);                            // bands
      if (!o.ring && hash(Math.round(x + 40), Math.round(y + 40), 31) < 0.06) c = mul(c, 0.82);   // craters
      const lit = (x + y) / r;                                                                // lit from the top-left
      c = mul(c, lit < -0.6 ? 1.15 : lit > 0.7 ? 0.6 : lit > 0.3 ? 0.8 : 1);
      p.set(cx + x, cy + y, c);
    }
    if (o.ring) ring(true);
  };
  S.stationwall = function (p, o) {
    const W = p.w, H = p.h, a = hex('#2c3e52'), seam = hex('#1f2c3b'), hl = hex('#3b536b');
    p.rect(0, 0, W, H, a);
    p.rect(0, 0, W, 1, hl); p.rect(0, 0, 1, H, hl); p.rect(0, H - 1, W, 1, seam); p.rect(W - 1, 0, 1, H, seam);
    p.rect(0, 15, W, 1, seam); p.rect(0, 16, W, 1, hl);
    for (const [x, y] of [[3, 3], [W - 4, 3], [3, H - 4], [W - 4, H - 4]]) p.set(x, y, hl);
    for (let y = 2; y < H - 2; y++) if (hash(7, y, 3) < 0.5) p.set(W / 2, y, mul(a, 0.93));
  };
  S.stationfloor = function (p, o) {
    const W = p.w, H = p.h;
    p.rect(0, 0, W, H, hex('#4a5866'));
    p.rect(0, 0, W, 1, hex('#d8e2ea')); p.rect(0, 1, W, 2, hex('#9aa8b4'));
    for (let x = 1; x < W; x += 4) p.set(x, 2, hex('#6a7886'));
    p.rect(0, H - 1, W, 1, hex('#2a3440'));
    for (let x = 0; x < W; x += 8) p.set(x + 4, 5, hex('#ffd25a'));                           // little guide lights
  };
  S.stationhull = function (p, o) {
    const W = p.w, H = p.h, a = hex('#8a96a6');
    p.rect(0, 0, W, H, a);
    p.rect(0, 0, W, 1, mul(a, 1.2)); p.rect(0, H - 1, W, 1, mul(a, 0.7)); p.rect(W - 1, 0, 1, H, mul(a, 0.75)); p.rect(0, 0, 1, H, mul(a, 1.1));
    p.rect(0, 10, W, 1, mul(a, 0.8)); p.rect(0, 21, W, 1, mul(a, 0.8));
    for (let x = 2; x < W; x += 6) { p.set(x, 2, mul(a, 0.7)); p.set(x, 13, mul(a, 0.7)); p.set(x, 24, mul(a, 0.7)); }
  };
  S.laddertile = function (p, o) {
    const W = p.w, H = p.h, rail = hex('#c8a050'), rung = hex('#e6c070');
    p.rect(2, 0, 2, H, rail); p.rect(W - 4, 0, 2, H, rail); p.rect(2, 0, 1, H, mul(rail, 1.15));
    p.rect(4, 3, W - 8, 2, rung); p.rect(4, 5, W - 8, 1, mul(rung, 0.6));
  };

  function mkRand(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  // Male variant marking: a small bright cyan spot on top of the body (same spot on every frame shape),
  // so ♂ and ♀ read at a glance. Works on any shape by finding the top of the drawn body.
  function maleMark(p) {
    const W = p.bw, H = p.bh, d = p.d, A = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
    let x0 = W, x1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (x1 < 0) return;
    const cx = Math.round((x0 + x1) / 2);
    let top = -1;
    for (let y = 0; y < H && top < 0; y++) for (let dx = -1; dx <= 1; dx++) if (A(cx + dx, y)) { top = y; break; }
    if (top < 0) return;
    // painted onto the top of the body (never outside it), so males stay exactly the female's size
    const put = (x, y, c) => { if (!A(x, y)) return; const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; };
    const crest = [95, 224, 255], tip = [235, 255, 255];
    put(cx - 1, top + 1, crest); put(cx, top + 1, crest); put(cx + 1, top + 1, crest); put(cx, top, tip); put(cx, top + 2, crest);
  }

  // Rare colour variants (bred babies only): every colour rotated around the colour wheel by `deg`.
  function hueShift(p, deg) {
    const d = p.d, k = deg / 360;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      if (mx - mn < 0.04) continue;                                 // greys / outlines stay
      const dd = mx - mn, s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      let h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
      h = (h / 6 + k) % 1;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, pp = 2 * l - q;
      const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? pp + (q - pp) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? pp + (q - pp) * (2 / 3 - t) * 6 : pp; };
      d[i] = f(h + 1 / 3) * 255; d[i + 1] = f(h) * 255; d[i + 2] = f(h - 1 / 3) * 255;
    }
  }
  PH.hueShift = hueShift;
  // Pattern variants (e.g. the rare axolotl): small speckles sprinkled over the body, never on the
  // outline. Placed by a fixed hash so the speckles don't flicker between frames.
  function speckle(p, col) {
    for (let y = 1; y < p.bh - 1; y++) for (let x = 1; x < p.bw - 1; x++) {
      const i = (y * p.bw + x) * 4;
      if (!p.d[i + 3]) continue;
      const edge = !p.d[i + 7] || !p.d[i - 1] || !p.d[i + p.bw * 4 + 3] || !p.d[i - p.bw * 4 + 3];
      if (edge || p.d[i] + p.d[i + 1] + p.d[i + 2] < 120) continue;          // keep outline + eyes
      if (hash(x >> 1, y >> 1, 3) < 0.16 && (x + y) % 2 === 0) { p.d[i] = col[0]; p.d[i + 1] = col[1]; p.d[i + 2] = col[2]; }
    }
  }
  PH.speckle = speckle;

  // Juveniles: a lighter, softer version of the adult colours.
  function lighten(p, k) {
    const d = p.d;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] += (255 - d[i]) * k; d[i + 1] += (255 - d[i + 1]) * k; d[i + 2] += (255 - d[i + 2]) * k; }
  }

  // ---------- sheet builder ----------
  // entry: { fw, fh, anims: { name: {row, col?, frames, fps} }, art: { shape, color, accent, ...opts } }
  // Renders every frame with a hidden margin, measures the union of all frames, and fits it into
  // the frame: one constant shift for the whole sheet (so animation never jitters); if it still
  // doesn't fit, the drawing area is shrunk a little and it's redrawn. No more cut-off sprites.
  PH.buildSheet = function (entry) {
    const anims = entry.anims, fw = entry.fw, fh = entry.fh;
    let cols = 1, rows = 1;
    for (const k in anims) { const a = anims[k]; cols = Math.max(cols, (a.col || 0) + a.frames); rows = Math.max(rows, a.row + 1); }
    const art = entry.art || {};
    const fn = S[art.shape] || S.fish;
    const bottomAnchored = entry.anchor && entry.anchor[1] === fh - 1;
    const babyK = art.baby ? 2 * Math.round(Math.min(fw, fh) * 0.2) : 0;   // juveniles: ~60% size
    const M = 8;
    const render = (k) => {
      const frames = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const name in anims) {
        const a = anims[name];
        for (let f = 0; f < a.frames; f++) {
          const kk = k + babyK;                      // babies are drawn smaller in the same frame
          const vw = fw - kk, vh = fh - (bottomAnchored ? Math.round(kk / 2) : kk);
          const p = new Pix(vw, vh, M);
          const opts = Object.assign({}, art, {
            c: hex(art.color), a: hex(art.accent || art.color), glow: art.glow ? hex(art.glow) : undefined,
            t: f / a.frames, frame: f, anim: name, moving: name === 'move' || name === 'swim'
          });
          fn(p, opts);
          if (art.male) maleMark(p);
          if (art.baby) lighten(p, 0.3);
          if (art.speckle) speckle(p, hex(art.speckle));
          if (art.hue) hueShift(p, art.hue);
          // offset of the frame's origin inside this padded buffer (drawing area centred / bottom-aligned)
          const fx0 = M - Math.floor((fw - vw) / 2), fy0 = M - (bottomAnchored ? fh - vh : Math.floor((fh - vh) / 2));
          for (let y = 0; y < p.bh; y++) for (let x = 0; x < p.bw; x++) if (p.d[(y * p.bw + x) * 4 + 3]) {
            x0 = Math.min(x0, x - fx0); x1 = Math.max(x1, x - fx0); y0 = Math.min(y0, y - fy0); y1 = Math.max(y1, y - fy0);
          }
          frames.push({ p, a, f, fx0, fy0 });
        }
      }
      return { frames, x0, y0, x1, y1 };
    };
    let r = render(0);
    if (art.fit !== false) {
      // keep a 1px clear margin (except under bottom-anchored art, whose base sits on the last row)
      const tooBig = (q) => q.x1 - q.x0 + 1 > fw - 2 || q.y1 - q.y0 + 1 > fh - (bottomAnchored ? 1 : 2);
      for (let k = 2; k <= Math.floor(Math.min(fw, fh) / 2) && tooBig(r); k += 2) r = render(k);
    }
    // constant shift that brings the union inside the frame (bottom-anchored art keeps its base)
    let sx = 0, sy = 0;
    if (art.fit !== false) {
      if (r.x0 < 1) sx = 1 - r.x0; else if (r.x1 > fw - 2) sx = fw - 2 - r.x1;
      if (r.y0 < 1) sy = 1 - r.y0; else if (r.y1 > fh - 2 && !bottomAnchored) sy = fh - 2 - r.y1;
    }
    const sheet = new Pix(cols * fw, rows * fh);
    for (const { p, a, f, fx0, fy0 } of r.frames) {
      sheet.copyFrom(p, fx0 - sx, fy0 - sy, fw, fh, ((a.col || 0) + f) * fw, a.row * fh);
    }
    return sheet;
  };
  PH.shapes = Object.keys(S);

  if (typeof module !== 'undefined' && module.exports) module.exports = PH;
  else { root.AQ = root.AQ || {}; root.AQ.PH = PH; }
})(typeof window !== 'undefined' ? window : globalThis);
