// Treasure chests: the only source of progression (bigger net, faster swimming).
// A handful exist at once at random seabed spots; opened or expired chests despawn and new ones
// respawn elsewhere after a delay.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Chests = (function () {
  const U = AQ.U, R = U.R;
  const K = { list: [], timers: [] };
  const T = () => AQ.TUNING.chests;

  K.init = function (game) {
    K.list = []; K.timers = [];
    for (let i = 0; i < T().active; i++) spawn(game, true);
  };

  function spawn(game, initial) {
    const biomes = AQ.World.biomes;
    for (let tries = 0; tries < 30; tries++) {
      const b = R.pick(biomes);
      const spot = AQ.Creatures.findSpot({ id: 'chest', biome: b.id, is_plant: true, spriteKey: 'chest', spawn: {} }, 'floor');
      if (!spot) continue;
      const P = game.player;
      if (!initial && Math.hypot(spot[0] - P.x, spot[1] - P.y) < T().minPlayerDist) continue;
      if (K.list.some((c) => Math.abs(c.x - spot[0]) < 300)) continue;
      K.list.push({ x: spot[0], y: spot[1], state: 'closed', t: 0, life: T().lifetime * R.range(0.8, 1.2) });
      return;
    }
    K.timers.push(10); // world too crowded right now; try again soon
  }

  function reward(game) {
    const up = game.upgrades, opts = [];
    if (up.net < AQ.TUNING.net.maxLevel) opts.push('net');
    if (up.speed < AQ.TUNING.speedMaxLevel) opts.push('speed');
    if ((up.lantern || 0) < AQ.TUNING.upgrades.lanternMax) opts.push('lantern');
    if ((up.depth || 0) < AQ.TUNING.upgrades.depthMax) opts.push('depth');
    if (!opts.length) return null;
    const pick = R.pick(opts);
    up[pick] = (up[pick] || 0) + 1;
    if (pick === 'speed') game.player.speedLevel = up.speed;
    AQ.Save && AQ.Save.dirty();
    return pick;
  }

  K.update = function (dt, game) {
    const P = game.player;
    for (let i = K.list.length - 1; i >= 0; i--) {
      const c = K.list[i];
      c.t += dt;
      if (c.state === 'closed') {
        if (R.chance(dt * 0.8)) AQ.FX.sparkle(c.x + R.range(-6, 6), c.y - R.range(2, 10), '#ffe9a0', 1);
        if (Math.hypot(P.x - c.x, P.y - (c.y - 6)) < 13) {
          c.state = 'open'; c.t = 0;
          const what = reward(game);
          AQ.FX.sparkle(c.x, c.y - 8, '#ffe36b', 18);
          AQ.Audio.play('chest');
          if (what) AQ.Audio.play({ net: 'up_net', speed: 'up_speed', lantern: 'up_lantern', depth: 'up_depth' }[what], { delay: 0.75 });
          if (what === 'net') AQ.HUD.toast(`BIGGER NET! (LV ${game.upgrades.net})`, '#ffe36b', 3.5);
          else if (what === 'speed') AQ.HUD.toast(`SWIM SPEED UP! (LV ${game.upgrades.speed})`, '#7ef0c0', 3.5);
          else if (what === 'lantern') AQ.HUD.toast(`BRIGHTER LANTERN! (LV ${game.upgrades.lantern})`, '#ffe9a8', 3.5);
          else if (what === 'depth') AQ.HUD.toast(`DEEPER DIVES! (DEPTH LV ${game.upgrades.depth})`, '#9fd8ff', 3.5);
          else AQ.HUD.toast('Empty... all four upgrades are already the best.', '#cfe8ff');
        } else if (c.t > c.life) { AQ.FX.puff(c.x, c.y - 4, 'rgba(220,210,180,0.6)', 8); remove(i); }
      } else if (c.t > 2.5) remove(i);
    }
    for (let i = K.timers.length - 1; i >= 0; i--) {
      K.timers[i] -= dt;
      if (K.timers[i] <= 0) { K.timers.splice(i, 1); spawn(game, false); }
    }
  };
  function remove(i) { K.list.splice(i, 1); K.timers.push(R.range(T().respawnMin, T().respawnMax)); }

  K.draw = function (g) {
    for (const c of K.list) {
      const alpha = c.state === 'open' ? Math.max(0, 1 - (c.t - 1.5)) : 1;
      const bob = c.state === 'closed' ? 0 : -Math.min(4, c.t * 6);
      AQ.Assets.draw(g, 'chest', c.state, c.x, c.y + bob, { alpha });
    }
  };
  K.lights = function (L) { for (const c of K.list) if (c.state === 'closed') L.push({ x: c.x, y: c.y - 6, r: 20, color: '#ffd56b', power: 0.7 }); };

  return K;
})();
