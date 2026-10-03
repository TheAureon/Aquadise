// Shooting stars: scenery only (nothing to catch here). At night a thin bright streak with a short
// fading trail now and then crosses the sky wherever the sky shows: the sea surface + Tide Pools shore
// (the sea world) and the hill. Under the surface you only see a faint glow sliding through the water.
// In the aquarium building (in space) a streak occasionally passes outside a porthole, day or night.
// Every streak has a very soft whoosh (ambience bus). Tuning: AQ.TUNING.shootingStars.
//   AQ.ShootingStars.update(dt, game)        called every frame while playing
//   AQ.ShootingStars.draw(ctx, game, bottom) sky streaks, screen space, above y = bottom (after the sky)
//   AQ.ShootingStars.drawWater(ctx, game)    the underwater glow (after lighting)
//   AQ.ShootingStars.drawSpace(ctx, l, t)    building streaks (inside the station's space backdrop)
//   AQ.ShootingStars.spawn(opts)             one streak now (later stages use it for meteor showers)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.ShootingStars = (function () {
  const U = AQ.U, R = U.R;
  const S = { list: [], glows: [], space: [], timer: 6, spaceTimer: 8, scene: null };
  const cfg = () => AQ.TUNING.shootingStars;

  // how dark it is for streaks: 0 by day, 1 in deep night (smooth through dusk / dawn)
  S.night = () => U.clamp(1 - AQ.Clock.daylight() / cfg().nightBelow, 0, 1);
  // where the sky ends on screen (0 = no sky); the same rule the gulls use
  function skyBottom(game) {
    if (game.scene === 'hill') return 128;
    if (game.scene !== 'world') return 0;
    return AQ.World.sea - AQ.Camera.top() - 6;
  }
  function make(x, y, dir) {
    const c = cfg(), a = R.range(c.angle[0], c.angle[1]) * Math.PI / 180, sp = R.range(c.speed[0], c.speed[1]);
    return { x, y, vx: Math.cos(a) * sp * dir, vy: Math.sin(a) * sp, t: 0, life: R.range(c.life[0], c.life[1]), trail: R.range(c.trail[0], c.trail[1]), col: R.pick(c.colors) };
  }
  function whoosh(dir) { AQ.Audio.play('star_whoosh', { vol: cfg().soundVolume, pan: dir * 0.3 }); }

  // one sky streak now (opts.quiet: no sound, for crowded meteor-shower skies)
  S.spawn = function (game, opts = {}) {
    game = game || AQ.Game;
    const bottom = skyBottom(game), dir = R.chance(0.5) ? 1 : -1;
    if (bottom > 24) S.list.push(make(dir > 0 ? R.range(-10, 220) : R.range(100, 330), R.range(4, Math.max(8, Math.min(bottom - 30, 60))), dir));
    else if (game.scene === 'world') S.glows.push({ x: dir > 0 ? -40 : 360, dir, t: 0, life: R.range(1.4, 2.2), y: R.range(20, 70) });
    else return;
    if (!opts.quiet) whoosh(dir);
  };

  S.update = function (dt, game) {
    const c = cfg();
    if (game.scene !== S.scene) { S.scene = game.scene; S.list.length = 0; S.glows.length = 0; S.space.length = 0; }
    for (let i = S.list.length - 1; i >= 0; i--) { const s = S.list[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) S.list.splice(i, 1); }
    for (let i = S.glows.length - 1; i >= 0; i--) { const g = S.glows[i]; g.t += dt; g.x += g.dir * 220 * dt; if (g.t > g.life) S.glows.splice(i, 1); }
    for (let i = S.space.length - 1; i >= 0; i--) { const s = S.space[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) S.space.splice(i, 1); }
    if (game.scene === 'station') {
      // in space it's always "night": now and then a streak crosses a porthole you can see
      S.spaceTimer -= dt;
      if (S.spaceTimer <= 0) {
        S.spaceTimer = R.range(c.stationEverySeconds[0], c.stationEverySeconds[1]);
        const cam = AQ.Camera, holes = (AQ.Station && AQ.Station.portholes ? AQ.Station.portholes() : [])
          .filter((h) => h.x > cam.left() + 10 && h.x < cam.left() + 310 && h.y > cam.top() + 10 && h.y < cam.top() + 170);
        if (holes.length) {
          const h = R.pick(holes), dir = R.chance(0.5) ? 1 : -1, s = make(0, 0, dir);
          // start up-and-behind so the streak's middle crosses the window
          const mid = s.life * 0.5; s.x = h.x - s.vx * mid + R.range(-4, 4); s.y = h.y - s.vy * mid + R.range(-4, 4);
          S.space.push(s); whoosh(dir);
        }
      }
      return;
    }
    if (game.scene !== 'world' && game.scene !== 'hill') return;
    // the sky: only at night, rarer near dusk / dawn
    const n = S.night();
    if (n <= 0) { S.timer = Math.max(S.timer, 3); return; }
    S.timer -= dt * n;
    if (S.timer <= 0) { S.timer = R.range(c.everySeconds[0], c.everySeconds[1]); S.spawn(game); }
  };

  // a streak: bright head pixel, a short trail fading behind it, fading in and out over its life
  function streak(ctx, s, ox, oy, alpha) {
    const k = Math.sin(Math.min(1, s.t / s.life) * Math.PI) * alpha;
    if (k <= 0.01) return;
    const sp = Math.hypot(s.vx, s.vy), ux = s.vx / sp, uy = s.vy / sp, col = U.hex(s.col);
    for (let i = 0; i < s.trail; i++) {
      const a = k * (1 - i / s.trail) * 0.9;
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`;
      ctx.fillRect(Math.round(s.x - ux * i + ox), Math.round(s.y - uy * i + oy), 1, 1);
    }
    ctx.fillStyle = `rgba(255,255,255,${k.toFixed(3)})`; ctx.fillRect(Math.round(s.x + ox), Math.round(s.y + oy), 1, 1);
    ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(k * 0.35).toFixed(3)})`;          // a tiny soft halo round the head
    ctx.fillRect(Math.round(s.x + ox) - 1, Math.round(s.y + oy), 3, 1); ctx.fillRect(Math.round(s.x + ox), Math.round(s.y + oy) - 1, 1, 3);
  }
  S.draw = function (ctx, game) {
    if (!S.list.length) return;
    const bottom = skyBottom(game);
    if (bottom <= 4) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 320, bottom); ctx.clip();
    for (const s of S.list) streak(ctx, s, 0, 0, 1);
    ctx.restore();
  };
  // underwater: a soft, wide glow sliding across the top of the view, fading with depth
  S.drawWater = function (ctx, game) {
    if (!S.glows.length || game.scene !== 'world') return;
    const depth = AQ.Camera.top() - AQ.World.sea, fade = U.clamp(1 - depth / cfg().waterGlowDepth, 0, 1) * cfg().waterGlow;
    if (fade <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of S.glows) {
      const a = Math.sin(Math.min(1, g.t / g.life) * Math.PI) * fade;
      const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 70);
      rg.addColorStop(0, `rgba(200,230,255,${a.toFixed(3)})`); rg.addColorStop(1, 'rgba(200,230,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(g.x - 70, g.y - 70, 140, 140);
    }
    ctx.restore();
  };
  // the building: drawn into the space backdrop, so it only shows through the portholes and round the hull
  S.drawSpace = function (ctx, left, top) { for (const s of S.space) streak(ctx, s, -left, -top, 1); };
  return S;
})();
