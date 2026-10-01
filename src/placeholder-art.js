// Procedural placeholder pixel art. Shared by tools/gen-placeholders.js (writes PNGs)
// and the browser (fallback when a sprite file is missing). Real art replaces the PNGs.
(function (root) {
  const PH = {};

  // ---------- pixel buffer ----------
  function Pix(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  Pix.prototype.get = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; };
  Pix.prototype.a = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; };
  Pix.prototype.set = function (x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
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
  // Light top edges, darken bottom edges -> instant pixel-art volume.
  Pix.prototype.shade = function (amt = 0.22) {
    const src = new Uint8ClampedArray(this.d);
    const A = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : src[(y * this.w + x) * 4 + 3];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      if (!src[i + 3]) continue;
      let f = 1;
      if (!A(x, y - 1)) f = 1 + amt; else if (!A(x, y + 1)) f = 1 - amt; else if (!A(x, y + 2)) f = 1 - amt * 0.5;
      if (f !== 1) { this.d[i] = Math.min(255, src[i] * f); this.d[i + 1] = Math.min(255, src[i + 1] * f); this.d[i + 2] = Math.min(255, src[i + 2] * f); }
    }
  };
  Pix.prototype.outline = function (f = 0.35) {
    const src = new Uint8ClampedArray(this.d);
    const at = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h) ? -1 : (y * this.w + x) * 4;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = at(x, y);
      if (src[i + 3]) continue;
      let n = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = at(x + dx, y + dy); if (j >= 0 && src[j + 3] > 100) { n = j; break; } }
      if (n >= 0) { this.d[i] = src[n] * f; this.d[i + 1] = src[n + 1] * f; this.d[i + 2] = src[n + 2] * f + 8; this.d[i + 3] = 255; }
    }
  };
  Pix.prototype.blit = function (src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.d[i + 3]) this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
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
    if (!o.eyeless) eye(p, Math.round(cx + len * 0.27), Math.round(cy - h * 0.12), W >= 20);
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
    if (o.ghost) for (let i = 0; i < p.d.length; i += 4) if (p.d[i + 3]) p.d[i + 3] = 200;
  };

  S.octopus = function (p, o) {
    const W = p.w, H = p.h, ph = o.t * Math.PI * 2;
    const hx = W / 2, hy = H * 0.38;
    for (let k = 0; k < 5; k++) {
      const bx = hx - W * 0.2 + k * W * 0.1;
      for (let i = 0; i < 9; i++) {
        const u = i / 9;
        p.circle(bx + Math.sin(u * 4 + ph + k) * W * 0.06 * u + (k - 2) * u * W * 0.06, hy + H * 0.12 + u * H * 0.4, 1.2 * (1 - u * 0.6), o.c);
      }
    }
    p.ellipse(hx, hy, W * 0.24, H * 0.24, o.c);
    p.shade();
    for (let i = 0; i < 4; i++) p.set(hx - W * 0.1 + i * 3, hy - H * 0.12 + (i % 2), mul(o.a, 1));
    eye(p, Math.round(hx + W * 0.06), Math.round(hy + 1), false); eye(p, Math.round(hx - W * 0.08), Math.round(hy + 1), false);
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
    if (o.anim === 'stand' || o.anim === 'walk' || o.anim === 'jump') return S.diverUpright(p, o);
    const R = ROBO, ph = o.t * Math.PI * 2;
    const swim = o.anim === 'swim';
    const amp = swim ? 2.7 : o.anim === 'net' ? 0.6 : 1.2;
    const bob = o.anim === 'idle' ? (o.frame === 1 || o.frame === 2 ? 1 : 0) : 0;   // slow 1px breathing bob
    const y = 11 + bob;
    const hipX = 9, hipY = y + 2.5;
    // phase offset so all 6 frames differ; the knee lags the foot for a whip-like kick
    const leg = (phase, gain, base, shin, boot) => {
      const footY = hipY + Math.sin(ph + phase + Math.PI / 6) * amp * gain;
      const kneeY = hipY + Math.sin(ph + phase + Math.PI / 6 - 0.9) * amp * gain * 0.5;
      const kx = 5, fx = 2;
      for (let i = 0; i <= 4; i++) { const t = i / 4, xx = hipX - t * (hipX - kx), yy = hipY + t * (kneeY - hipY); p.set(xx, yy - 0.5, base); p.set(xx, yy + 0.5, base); }
      for (let i = 1; i <= 3; i++) { const t = i / 3, xx = kx - t * (kx - fx), yy = kneeY + t * (footY - kneeY); p.set(xx, yy, shin); }
      p.set(kx, kneeY, R.k);
      p.set(fx - 1, footY, boot); p.set(fx - 2, footY, boot);           // boot / sole
    };
    leg(Math.PI, 0.65, R.gd, R.g, R.k);   // back leg (behind, in shadow, smaller kick)
    // hips + torso: white back, dark segmented chest plate facing down, cyan trim
    p.rect(8, y, 9, 2, R.w);
    p.rect(8, y + 2, 9, 3, R.k);
    for (let x = 10; x < 17; x += 3) p.set(x, y + 3, R.kd);
    p.rect(9, y + 5, 7, 1, R.c);
    p.set(8, y + 2, R.c); p.set(8, y + 3, R.c);
    leg(0, 1, R.w, R.w, R.g);          // front leg (on top, white)
    p.set(7, y + 2, R.c);                // cyan thigh light
    // navy shoulder pad
    p.rect(14, y - 1, 3, 2, R.n); p.set(14, y - 1, R.nl);
    // head: white helmet with a big navy visor facing forward, cyan ear light
    p.rect(17, y - 1, 4, 5, R.w); p.rect(18, y - 2, 3, 1, R.w);
    p.rect(19, y, 3, 3, R.n); p.set(20, y, R.nl);
    p.set(18, y + 1, R.c);
    // arm: tucked along the body while swimming, reaching forward during a net swing
    if (o.anim === 'net') {
      const ext = [1, 3, 5, 4][o.frame] || 0;
      p.rect(15, y + 4, 2 + ext, 1, R.g); p.set(16 + ext, y + 4, R.k); p.set(16 + ext, y + 3, R.k);
    } else p.rect(12, y + 5, 3, 1, R.g);
    p.outline(0.28);
  };

  // Upright pose for walking on land. Anchor = (12,12); feet sit on row 16.
  S.diverUpright = function (p, o) {
    const R = ROBO;
    const walk = o.anim === 'walk', jump = o.anim === 'jump';
    const step = walk ? [0, 1, 0, -1][o.frame] : 0;
    const top = (walk && o.frame % 2 ? 1 : 0) + (jump ? -1 : 0) + (o.anim === 'stand' && o.frame ? 0 : 0);
    // legs: back leg grey, front leg white, dark knees, cyan thigh stripe
    if (jump) {
      p.rect(10, top + 12, 2, 3, R.g); p.set(10, top + 13, R.k);
      p.rect(13, top + 12, 2, 3, R.w); p.set(14, top + 13, R.k); p.rect(12, top + 15, 4, 1, R.g); p.rect(9, top + 15, 3, 1, R.gd);
    } else {
      const bx = 10 - step, fx = 13 + step;
      p.rect(bx, top + 12, 2, 16 - (top + 12), R.g); p.set(bx, top + 14, R.k); p.set(bx + 1, top + 14, R.k);
      p.rect(fx, top + 12, 2, 16 - (top + 12), R.w); p.set(fx, top + 14, R.k); p.set(fx + 1, top + 14, R.k);
      p.set(fx + 1, top + 12, R.c);
      p.rect(bx - 1, 16, 3, 1, R.gd); p.rect(fx, 16, 3, 1, R.g);   // feet
    }
    // hips + dark waist band
    p.rect(10, top + 11, 5, 1, R.w); p.rect(10, top + 10, 5, 1, R.k);
    // torso: dark chest plate with cyan trim
    p.rect(10, top + 6, 5, 4, R.k); p.set(12, top + 7, R.kd); p.set(12, top + 9, R.kd);
    p.rect(9, top + 6, 1, 4, R.c); p.rect(15, top + 6, 1, 4, R.c);
    // broad white shoulders + navy pad on the front shoulder
    p.rect(8, top + 5, 9, 1, R.w); p.rect(9, top + 4, 7, 1, R.w);
    p.rect(14, top + 4, 3, 2, R.n); p.set(14, top + 4, R.nl);
    // arms: back arm grey, front arm white with dark elbow + hand (swings while walking)
    p.rect(8, top + 6, 1, 5, R.g); p.set(8, top + 8, R.k); p.set(8, top + 11, R.kd);
    p.rect(16 + (walk ? Math.max(0, step) : 0), top + 6, 1, 5, R.w); p.set(16 + (walk ? Math.max(0, step) : 0), top + 8, R.k); p.set(16 + (walk ? Math.max(0, step) : 0), top + 11, R.k);
    // neck + head with navy visor facing right, cyan ear light
    p.set(12, top + 3, R.k);
    p.rect(10, top, 5, 3, R.w); p.rect(11, top - 1, 3, 1, R.w);
    p.rect(13, top, 2, 3, R.n); p.set(14, top, R.nl); p.set(15, top + 1, R.n);
    p.set(11, top + 1, R.c);
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

  function mkRand(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  // ---------- sheet builder ----------
  // entry: { fw, fh, anims: { name: {row, col?, frames, fps} }, art: { shape, color, accent, ...opts } }
  PH.buildSheet = function (entry) {
    const anims = entry.anims;
    let cols = 1, rows = 1;
    for (const k in anims) { const a = anims[k]; cols = Math.max(cols, (a.col || 0) + a.frames); rows = Math.max(rows, a.row + 1); }
    const sheet = new Pix(cols * entry.fw, rows * entry.fh);
    const art = entry.art || {};
    const fn = S[art.shape] || S.fish;
    for (const k in anims) {
      const a = anims[k];
      for (let f = 0; f < a.frames; f++) {
        const p = new Pix(entry.fw, entry.fh);
        const opts = Object.assign({}, art, {
          c: hex(art.color), a: hex(art.accent || art.color), glow: art.glow ? hex(art.glow) : undefined,
          t: f / a.frames, frame: f, anim: k, moving: k === 'move' || k === 'swim'
        });
        fn(p, opts);
        sheet.blit(p, ((a.col || 0) + f) * entry.fw, a.row * entry.fh);
      }
    }
    return sheet;
  };
  PH.shapes = Object.keys(S);

  if (typeof module !== 'undefined' && module.exports) module.exports = PH;
  else { root.AQ = root.AQ || {}; root.AQ.PH = PH; }
})(typeof window !== 'undefined' ? window : globalThis);
