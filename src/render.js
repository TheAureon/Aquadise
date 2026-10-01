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
    for (let i = 0; i < 70; i++) R.snow.push({ x: Math.random() * 400, y: Math.random() * 220, s: 0.3 + Math.random() * 0.5, v: 2 + Math.random() * 4 });
  };

  function depthColor(depth) {
    for (let i = 0; i < DEPTH_STOPS.length - 1; i++) {
      const a = DEPTH_STOPS[i], b = DEPTH_STOPS[i + 1];
      if (depth <= b[0]) return U.mix(a[1], b[1], (depth - a[0]) / (b[0] - a[0]));
    }
    return DEPTH_STOPS[DEPTH_STOPS.length - 1][1];
  }

  R.waterCss = function (worldY, biome) {
    const band = Math.floor(worldY / 6);
    const key = biome.index * 10000 + band;
    let c = bandCache.get(key);
    if (!c) {
      const y = band * 6, W = AQ.World;
      let col;
      if (y < W.sea) col = U.mix(SKY[0], SKY[1], U.clamp(y / W.sea, 0, 1));
      else {
        col = depthColor(y - W.sea);
        if (biome.water) col = U.mix(col, U.hex(biome.water), biome.waterMix || 0.3);
      }
      c = U.css(col);
      bandCache.set(key, c);
    }
    return c;
  };

  R.background = function (cam) {
    const ctx = R.ctx, W = AQ.World;
    const left = cam.left(), top = cam.top();
    const COL = 16;
    const first = Math.floor(left / COL) * COL;
    for (let wx = first; wx < left + cam.w; wx += COL) {
      // biome is sampled on world-aligned columns so tints don't swim with the camera
      const off = wx - left;
      for (let sy = -(top % 6) - 6; sy < cam.h; sy += 6) {
        const wy = top + sy;
        const b = W.biomeAt(wx + 8, Math.max(wy, W.sea + 1));
        ctx.fillStyle = R.waterCss(wy, b);
        ctx.fillRect(off, sy, COL, 6);
      }
    }
    // light shafts near the surface
    const seaY = W.sea - top;
    if (seaY > -260 && seaY < cam.h) {
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#e8fbff';
      for (let i = 0; i < 9; i++) {
        const span = 520, x = ((i * 137 - left * 0.7 + Math.sin(R.t * 0.3 + i) * 12) % span + span) % span - 80;
        const w = 10 + (i % 3) * 7;
        ctx.beginPath();
        ctx.moveTo(x, seaY); ctx.lineTo(x + w, seaY); ctx.lineTo(x + w + 70, seaY + 230); ctx.lineTo(x + 70 - w * 0.5, seaY + 230);
        ctx.fill();
      }
      ctx.restore();
    }
    // drifting marine snow (parallax)
    ctx.fillStyle = 'rgba(220,240,255,0.35)';
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
      if (W.solid(wx, W.sea) || W.solid(wx, W.sea - 1)) continue;
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
      [[1, 0.35], [0.72, 0.4], [0.45, 0.6]].forEach(([f, a]) => {
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
