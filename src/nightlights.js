// Night lights: glowing plankton. In the dark (at night in the sunlit sea, and always in caves and the deep)
// swimming stirs up tiny blue-green sparks in your wake, a swing of the net throws a little cloud of them,
// and creatures that glow (`glow` in data/creatures.js) leave a soft trail of their own colour as they move.
// The darker it is, the brighter they are; clouds and rain dim them a little (clear nights are best).
//
// Every graphics level: the sparks are drawn over the darkness (CLASSIC / LOW), and on MEDIUM / HIGH a soft
// real light follows your wake so the shader's darkness lifts around it. REDUCE FLASHING: no twinkle, just
// a steady, gentler glow that fades. LOW EFFECTS: half as many. Tuning: AQ.TUNING.nightLights.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.NightLights = (function () {
  const U = AQ.U;
  const N = { specks: [], wakeT: 0, k: 0, trailT: new Map(), wake: null };
  const cfg = () => AQ.TUNING.nightLights;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // how much glow shows now (0 - 1): the darkness where you are, less under clouds
  function glowNow() {
    const C = cfg(), dark = AQ.Render.darkness || 0;
    const cloud = AQ.Weather ? Math.min(1, AQ.Weather.mix.cloud) : 0;
    return U.clamp((dark - C.minDark) / (C.fullDark - C.minDark), 0, 1) * (1 - C.cloudDim * cloud);
  }
  const room = () => Math.round(cfg().max * (U.lowFx() ? 0.5 : 1)) - N.specks.length;
  function add(x, y, c, life, vx = 0, vy = 0) {
    if (room() <= 0) return;
    N.specks.push({ x, y, vx, vy, t: 0, life, c, s: Math.random() * 6 });
  }

  N.update = function (dt, game) {
    const on = cfg().enabled && game.scene === 'world' && (game.state === 'play' || game.state === 'pause' || game.state === 'map');
    N.k += ((on ? glowNow() : 0) - N.k) * Math.min(1, dt * 2);
    for (let i = N.specks.length - 1; i >= 0; i--) {
      const s = N.specks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - dt * 1.5; s.vy *= 1 - dt * 1.5; s.y -= 1.5 * dt;
      if (s.t > s.life) N.specks.splice(i, 1);
    }
    if (!on || N.k < 0.03 || game.state !== 'play') { N.wake = null; return; }
    const C = cfg(), P = game.player, W = AQ.World;
    // your wake: sparks where you've just been, more the faster you swim
    const speed = Math.hypot(P.vx || 0, P.vy || 0);
    if (P.mode === 'swim' && speed > C.minSpeed && W.water(P.x, P.y)) {
      N.wakeT += dt * C.wakePerSecond * Math.min(1.5, speed / 60) * N.k;
      for (; N.wakeT >= 1; N.wakeT--) add(P.x - Math.sign(P.vx || P.facing || 1) * rnd(2, 8) + rnd(-3, 3), P.y + rnd(-4, 4), C.color, rnd(C.life[0], C.life[1]), -(P.vx || 0) * 0.1 + rnd(-4, 4), -(P.vy || 0) * 0.1 + rnd(-4, 4));
      N.wake = { x: P.x - Math.sign(P.vx || P.facing || 1) * 8, y: P.y };
    } else N.wake = null;
    // a swing of the net stirs up a little cloud of them
    const K = AQ.Catching;
    if (K && K.swinging() && !N.swung) {
      N.swung = true;
      const n = Math.round(C.swingBurst * N.k), x = P.x + (P.facing || 1) * 12;
      for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), v = rnd(6, 22); add(x + rnd(-4, 4), P.y + rnd(-4, 4), C.color, rnd(C.life[0], C.life[1]), Math.cos(a) * v, Math.sin(a) * v); }
    } else if (!K || !K.swinging()) N.swung = false;
    // glowing creatures leave a soft trail of their own colour as they move
    if (AQ.Creatures) {
      const cam = AQ.Camera, l = cam.left(), t = cam.top();
      for (const c of AQ.Creatures.list) {
        const g = c.def.glow;
        if (!g || c.hidden || c.alpha < 0.3 || c.x < l - 20 || c.x > l + cam.w + 20 || c.y < t - 20 || c.y > t + cam.h + 20) continue;
        const moved = Math.hypot(c.vx || 0, c.vy || 0);
        if (moved < 4) continue;
        const next = (N.trailT.get(c) || 0) - dt;
        if (next > 0) { N.trailT.set(c, next); continue; }
        N.trailT.set(c, C.trailEvery);
        add(c.x + rnd(-2, 2), c.y + rnd(-2, 2), g.color, rnd(C.life[0], C.life[1]) * 1.2, rnd(-2, 2), rnd(-2, 2));
      }
      if (N.trailT.size > 200) N.trailT.clear();
    }
  };

  // over the darkness (after the world's light and shade): each spark a soft dot, the brightest a small cross
  N.draw = function (ctx, cam) {
    if (!N.specks.length || N.k < 0.02) return;
    const l = cam.left(), t = cam.top(), calm = U.calm(), time = AQ.Render.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of N.specks) {
      const x = Math.round(s.x - l), y = Math.round(s.y - t);
      if (x < -2 || y < -2 || x > cam.w + 2 || y > cam.h + 2) continue;
      const fade = Math.min(1, s.t / 0.15, (s.life - s.t) / (s.life * 0.6));
      const tw = calm ? 0.75 : 0.7 + 0.3 * Math.sin(time * 9 + s.s * 7);      // (REDUCE FLASHING: no twinkle)
      const a = Math.max(0, fade) * tw * N.k * (calm ? 0.8 : 1);
      ctx.globalAlpha = a; ctx.fillStyle = s.c; ctx.fillRect(x, y, 1, 1);
      if (a > 0.55 && !calm) { ctx.globalAlpha = a * 0.35; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
    ctx.restore();
  };
  // MEDIUM / HIGH: a soft real light where your wake glows (so the shader's darkness lifts around it)
  N.lights = function (L) {
    if (!N.wake || N.k < 0.05) return;
    const C = cfg();
    L.push({ x: N.wake.x, y: N.wake.y, r: C.wakeLight, color: C.color, power: 0.5 * N.k });
  };
  return N;
})();
