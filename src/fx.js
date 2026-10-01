// Lightweight particles + floating text (bubbles, sparkles, hearts, "!" popups).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.FX = (function () {
  const U = AQ.U;
  const list = [];
  const FX = { list };

  FX.add = function (p) { if (list.length < 600) list.push(Object.assign({ t: 0, vx: 0, vy: 0, life: 1 }, p)); };
  FX.bubble = (x, y, big) => FX.add({ type: 'bubble', x, y, vy: -U.R.range(14, 24), life: 4, r: big ? 2 : U.R.chance(0.3) ? 1.5 : 1, ph: U.R() * 6 });
  FX.sparkle = (x, y, color = '#fff7c2', n = 6) => { for (let i = 0; i < n; i++) { const a = U.R() * Math.PI * 2, s = U.R.range(10, 34); FX.add({ type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.R.range(0.35, 0.7), color }); } };
  FX.text = (x, y, str, color = '#fff') => FX.add({ type: 'text', x, y, vy: -12, life: 1.3, str, color });
  FX.puff = (x, y, color = 'rgba(220,230,240,0.6)', n = 8) => { for (let i = 0; i < n; i++) FX.add({ type: 'puff', x: x + U.R.range(-4, 4), y: y + U.R.range(-3, 3), vx: U.R.range(-6, 6), vy: -U.R.range(4, 16), life: U.R.range(0.8, 1.6), color, r: U.R.range(1, 3) }); };
  FX.trail = (x, y, color) => FX.add({ type: 'trail', x, y, life: 2.5, color });

  FX.update = function (dt, world) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;
      if (p.type === 'bubble') {
        p.x += Math.sin(p.t * 5 + p.ph) * 6 * dt;
        p.y += p.vy * dt;
        if (!world.water(p.x, p.y - 1)) p.t = p.life;
      } else if (p.type === 'spark') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (p.t >= p.life) list.splice(i, 1);
    }
  };

  FX.draw = function (ctx) {
    for (const p of list) {
      const k = 1 - p.t / p.life;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.type === 'bubble') {
        ctx.fillStyle = 'rgba(220,250,255,0.75)';
        if (p.r >= 2) { ctx.fillRect(x - 1, y - 2, 2, 1); ctx.fillRect(x - 2, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); ctx.fillRect(x - 1, y + 1, 2, 1); }
        else if (p.r > 1) { ctx.fillRect(x, y, 2, 2); }
        else ctx.fillRect(x, y, 1, 1);
      } else if (p.type === 'spark') {
        ctx.fillStyle = p.color; ctx.globalAlpha = k; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1;
      } else if (p.type === 'trail') {
        ctx.fillStyle = p.color; ctx.globalAlpha = k * 0.8; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1;
      } else if (p.type === 'puff') {
        ctx.fillStyle = p.color; ctx.globalAlpha = k; const r = Math.round(p.r); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
      } else if (p.type === 'text') {
        ctx.globalAlpha = Math.min(1, k * 2);
        AQ.Font.draw(ctx, p.str, x, y, p.color, { align: 'center' });
        ctx.globalAlpha = 1;
      }
    }
  };

  return FX;
})();
