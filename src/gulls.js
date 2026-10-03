// Distant seagulls: tiny V-shaped silhouettes (like a child's drawing) drifting across the sky,
// wings flapping slowly between two frames. Rare and calm: now and then a small flock crosses,
// moving slower than the camera so they feel far away. Day, dawn and dusk only (gone at night),
// tinted to suit the sky. Purely scenery: they never touch anything and can't be caught.
// Shown wherever the sky is: the sea surface + Tide Pools shore (the sea world) and the hill.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Gulls = (function () {
  const U = AQ.U, R = U.R;
  const G = { flocks: [], timer: 6, scene: null };
  const cfg = () => AQ.TUNING.gulls;
  // two wing frames, 5 x 2 pixels: wings up (a V) and wings level
  const UP = ['#...#', '.#.#.', '..#..'], LEVEL = ['.....', '##.##', '..#..'];

  // how much of the screen is sky right now (0 = none), and where its bottom edge is
  function skyBottom(game) {
    if (game.scene === 'hill') return 128;                       // the hill's backdrop: sky above the far hills
    if (game.scene !== 'world') return 0;
    return AQ.World.sea - AQ.Camera.top() - 6;                   // down to just above the waterline
  }
  const awake = () => AQ.Clock.phase() !== 'night';

  G.update = function (dt, game) {
    if (game.scene !== G.scene) { G.scene = game.scene; G.flocks.length = 0; G.timer = R.range(2, 6); }
    const c = cfg(), bottom = skyBottom(game);
    // drift + flap; fade out at night, and leave once well off screen
    const camL = AQ.Camera.left();
    for (let i = G.flocks.length - 1; i >= 0; i--) {
      const f = G.flocks[i];
      f.x += f.dir * f.speed * dt; f.t += dt;
      f.alpha = U.approach(f.alpha, awake() ? 1 : 0, dt * 0.5);
      const sx = screenX(f, camL);
      if ((f.alpha <= 0 && !awake()) || sx < -80 || sx > 400) G.flocks.splice(i, 1);
    }
    // now and then a new flock, if there's sky to fly in and it isn't night
    G.timer -= dt;
    if (G.timer <= 0) {
      G.timer = R.range(c.everySeconds[0], c.everySeconds[1]);
      if (awake() && bottom > 24 && G.flocks.length < c.maxFlocks) spawn(game, bottom, camL);
    }
  };
  // screen x: they move a little with the camera, much less than the world (far away)
  const screenX = (f, camL) => f.x - camL * cfg().parallax;
  function spawn(game, bottom, camL) {
    const c = cfg(), dir = R.chance(0.5) ? 1 : -1, n = R.int(c.flockSize[0], c.flockSize[1]);
    const birds = [];
    for (let i = 0; i < n; i++) birds.push({ ox: -dir * i * R.range(7, 11) + R.range(-2, 2), oy: Math.abs(i - (n - 1) / 2) * R.range(2, 4) + R.range(-1, 1), ph: R.range(0, 6) });
    const startSX = dir > 0 ? -20 : 340;
    G.flocks.push({ x: startSX + camL * c.parallax, y: R.range(14, Math.max(16, Math.min(70, bottom - 12))), dir, speed: R.range(c.speed[0], c.speed[1]), t: 0, alpha: 0, birds });
    // a faint, far-off cry as they pass (ambience volume, rate-limited in its sound entry)
    AQ.Audio.play('gull_far', { vol: c.cryVolume, pan: dir * -0.4 });
  }

  // drawn right after the sky, behind everything else
  G.draw = function (ctx, game, skyCols) {
    if (!G.flocks.length) return;
    const bottom = skyBottom(game);
    if (bottom <= 4) return;
    const sky = skyCols || AQ.Render.skyCols();
    // a soft silhouette: the sky's own colour, much darker (warmer at dusk / dawn, bluer by day)
    const col = U.mix(sky[0], [24, 30, 48], 0.62), camL = AQ.Camera.left();
    for (const f of G.flocks) {
      const sx = screenX(f, camL);
      for (const b of f.birds) {
        const x = Math.round(sx + b.ox), y = Math.round(f.y + b.oy + Math.sin(f.t * 0.6 + b.ph) * 1.5);
        if (y > bottom - 3 || x < -6 || x > 326) continue;
        const frame = Math.floor(f.t / cfg().flapSeconds + b.ph) % 2 ? UP : LEVEL;
        ctx.globalAlpha = f.alpha * 0.85;
        ctx.fillStyle = U.css(col);
        frame.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(x + rx - 2, y + ry, 1, 1); });
      }
    }
    ctx.globalAlpha = 1;
  };
  return G;
})();
