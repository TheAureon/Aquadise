// Frame composition on the low-res canvas: sky/water backdrop -> terrain bitmaps -> entities
// -> particles -> surface -> lighting. Everything is drawn at integer pixel offsets.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Render = (function () {
  const U = AQ.U;
  const R = { ctx: null, light: null, lctx: null, darkness: 0, t: 0 };

  const DEPTH_STOPS = [
    [0, '#62c6d6'], [140, '#3497bd'], [380, '#1f6a9a'], [650, '#164a7a'], [900, '#0d2d55'], [1300, '#06142a']
  ].map(([d, c]) => [d, U.hex(c)]);
  const SKY = [U.hex('#78c3e6'), U.hex('#cdeff2')];
  const bandCache = new Map();

  R.init = function (canvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d');
    R.ctx.imageSmoothingEnabled = false;
    R.light = document.createElement('canvas');
    R.light.width = canvas.width; R.light.height = canvas.height;
    R.lctx = R.light.getContext('2d');
    R.snow = [];
    for (let i = 0; i < 32; i++) R.snow.push({ x: Math.random() * 400, y: Math.random() * 220, s: 0.3 + Math.random() * 0.5, v: 2 + Math.random() * 4 });
  };

  function depthColor(depth) {
    for (let i = 0; i < DEPTH_STOPS.length - 1; i++) {
      const a = DEPTH_STOPS[i], b = DEPTH_STOPS[i + 1];
      if (depth <= b[0]) return U.mix(a[1], b[1], (depth - a[0]) / (b[0] - a[0]));
    }
    return DEPTH_STOPS[DEPTH_STOPS.length - 1][1];
  }

  // Smoothed biome tint field (32px cells, blurred) so water colour blends between biomes.
  const TC = 32;
  R.buildTintField = function () {
    const W = AQ.World, gw = Math.ceil(W.w / TC), gh = Math.ceil(W.h / TC);
    const raw = new Float32Array(gw * gh * 4);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const b = W.biomeAt(gx * TC + TC / 2, gy * TC + TC / 2), c = U.hex(b.water || '#2a7fa8'), i = (gy * gw + gx) * 4;
      raw[i] = c[0]; raw[i + 1] = c[1]; raw[i + 2] = c[2]; raw[i + 3] = b.waterMix || 0;
    }
    const out = new Float32Array(raw.length), R2 = 3;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      let n = 0; const acc = [0, 0, 0, 0];
      for (let dy = -R2; dy <= R2; dy++) for (let dx = -R2; dx <= R2; dx++) {
        const x = U.clamp(gx + dx, 0, gw - 1), y = U.clamp(gy + dy, 0, gh - 1), i = (y * gw + x) * 4;
        for (let k = 0; k < 4; k++) acc[k] += raw[i + k];
        n++;
      }
      const o = (gy * gw + gx) * 4;
      for (let k = 0; k < 4; k++) out[o + k] = acc[k] / n;
    }
    R.tint = { gw, gh, f: out };
  };

  R.waterCss = function (wx, wy) {
    const W = AQ.World;
    const band = Math.floor(wy / 6) * 6;
    if (band < W.sea) return U.css(U.mix(SKY[0], SKY[1], U.clamp(band / W.sea, 0, 1)));
    const t = R.tint, gx = U.clamp(Math.floor(wx / TC), 0, t.gw - 1), gy = U.clamp(Math.floor(wy / TC), 0, t.gh - 1), i = (gy * t.gw + gx) * 4;
    const key = (Math.round(t.f[i] / 6) << 24) ^ (Math.round(t.f[i + 1] / 6) << 16) ^ (Math.round(t.f[i + 2] / 6) << 8) ^ Math.round(t.f[i + 3] * 40) ^ (band << 2) * 7919;
    let c = bandCache.get(key);
    if (!c) {
      c = U.css(U.mix(depthColor(band - W.sea), [t.f[i], t.f[i + 1], t.f[i + 2]], t.f[i + 3]));
      if (bandCache.size > 20000) bandCache.clear();
      bandCache.set(key, c);
    }
    return c;
  };

  R.background = function (cam) {
    const ctx = R.ctx;
    const left = cam.left(), top = cam.top();
    const COL = 8;
    const first = Math.floor(left / COL) * COL;
    for (let wx = first; wx < left + cam.w; wx += COL) {
      const off = wx - left;
      for (let sy = -(((top % 6) + 6) % 6); sy < cam.h; sy += 6) {
        ctx.fillStyle = R.waterCss(wx, top + sy);
        ctx.fillRect(off, sy, COL, 6);
      }
    }
    const W = AQ.World;
  // light shafts near the surface
    const seaY = W.sea - top;
    if (seaY > -260 && seaY < cam.h) {
      ctx.save();
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = '#e8fbff';
      for (let i = 0; i < 6; i++) {
        const span = 520, x = ((i * 89 - left * 0.7 + Math.sin(R.t * 0.3 + i) * 12) % span + span) % span - 80;
        const w = 10 + (i % 3) * 7;
        ctx.beginPath();
        ctx.moveTo(x, seaY); ctx.lineTo(x + w, seaY); ctx.lineTo(x + w + 70, seaY + 230); ctx.lineTo(x + 70 - w * 0.5, seaY + 230);
        ctx.fill();
      }
      ctx.restore();
    }
    // drifting marine snow (parallax)
    ctx.fillStyle = 'rgba(220,240,255,0.22)';
    for (const s of R.snow) {
      const x = ((s.x - left * s.s) % 400 + 400) % 400 - 40;
      const y = ((s.y - top * s.s + R.t * s.v) % 220 + 220) % 220 - 20;
      if (top + y > W.sea) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };

  R.surface = function (cam) {
    const ctx = R.ctx, W = AQ.World;
    const left = cam.left(), seaY = W.sea - cam.top();
    if (seaY < -4 || seaY > cam.h + 4) return;
    for (let x = 0; x < cam.w; x++) {
      const wx = left + x;
      if (W.solid(wx, W.sea) || W.solid(wx, W.sea - 1) || W.poolAt(wx, W.sea)) continue;
      const o = Math.round(Math.sin(wx * 0.09 + R.t * 2.2) * 0.8 + Math.sin(wx * 0.031 - R.t * 1.3) * 0.7);
      ctx.fillStyle = 'rgba(240,255,255,0.85)'; ctx.fillRect(x, seaY + o - 1, 1, 1);
      ctx.fillStyle = 'rgba(150,225,240,0.6)'; ctx.fillRect(x, seaY + o, 1, 1);
    }
  };

  // lights: [{x, y, r, color?}] in world coords
  R.lighting = function (cam, lights, target) {
    R.darkness += (target - R.darkness) * 0.04;
    if (R.darkness < 0.02) return;
    const l = R.lctx, left = cam.left(), top = cam.top();
    l.globalCompositeOperation = 'source-over';
    l.clearRect(0, 0, cam.w, cam.h);
    l.fillStyle = `rgba(3,6,18,${R.darkness.toFixed(3)})`;
    l.fillRect(0, 0, cam.w, cam.h);
    l.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const x = Math.round(L.x - left), y = Math.round(L.y - top);
      if (x < -L.r || y < -L.r || x > cam.w + L.r || y > cam.h + L.r) continue;
      // stepped rings instead of smooth gradients keep it pixel-art
      const flick = L.flicker ? Math.sin(R.t * 3 + L.x) * 1.5 : 0;
      [[1, 0.1], [0.9, 0.12], [0.8, 0.14], [0.7, 0.17], [0.6, 0.2], [0.5, 0.24], [0.4, 0.3], [0.3, 0.4]].forEach(([f, a]) => {
        l.globalAlpha = a * (L.power || 1);
        l.beginPath(); l.arc(x, y, Math.max(1, Math.round(L.r * f + flick)), 0, Math.PI * 2); l.fill();
      });
    }
    l.globalAlpha = 1;
    l.globalCompositeOperation = 'source-over';
    R.ctx.drawImage(R.light, 0, 0);
    // coloured glow on top
    R.ctx.save();
    R.ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.color) continue;
      const x = Math.round(L.x - left), y = Math.round(L.y - top);
      if (x < -20 || y < -20 || x > cam.w + 20 || y > cam.h + 20) continue;
      R.ctx.globalAlpha = 0.12 * R.darkness * (L.power || 1);
      R.ctx.fillStyle = L.color;
      R.ctx.beginPath(); R.ctx.arc(x, y, Math.round(L.r * 0.4), 0, Math.PI * 2); R.ctx.fill();
    }
    R.ctx.restore();
  };

  return R;
})();
