// Scenes: separate places the player can be in. Each owns its own collision map, camera bounds,
// update and draw, so side areas (the hill, the aquarium building) never touch the world map.
//   world    - the big sea world (Tide Pools ... Lush Cave)
//   hill     - the hill past the far edge of Tide Pools, with the UFO on top   (src/hill.js)
//   station  - the aquarium building floating in space                         (src/station.js)
// Every move between scenes goes through AQ.Transition (fade to black).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Scenes = (function () {
  const S = { list: {} };
  S.register = (id, scene) => { scene.id = id; S.list[id] = scene; };
  S.cur = (game) => S.list[game.scene] || S.list.world;
  S.worldOf = (game) => S.cur(game).world();

  // Fade out, move the player into scene `id` at `spawn` (a named spot the scene understands), fade in.
  S.go = function (game, id, spawn, opts) {
    return AQ.Transition.go(() => S.enter(game, id, spawn), opts);
  };
  // Instant switch (used under the black screen, and when loading a save).
  S.enter = function (game, id, spawn) {
    const sc = S.list[id] || S.list.world;
    const prev = S.cur(game);
    if (prev && prev !== sc && prev.leave) prev.leave(game);
    game.scene = sc.id;
    const P = game.player;
    P.vx = 0; P.vy = 0; P.climbing = null; P.stun = 0;
    if (sc.enter) sc.enter(game, spawn);
    AQ.FX.list.length = 0;
    AQ.Camera.snap(P, sc.world());
    AQ.HUD.lastZone = ''; AQ.HUD.bannerT = 0;
  };
  // Put a loaded player somewhere valid in their saved scene.
  S.restore = function (game, id, x, y) {
    const sc = S.list[id] ? S.list[id] : S.list.world;
    game.scene = sc.id;
    const P = game.player, w = sc.world();
    const valid = (vx, vy) => (sc.valid ? sc.valid(vx, vy) : w.standable(vx, vy));
    let ok = x != null && y != null && valid(x, y);
    const hb = AQ.TUNING.swim.hitbox;
    if (!ok && x != null && y != null && !w.boxHits(x, y, hb.w / 2, hb.h / 2)) {
      // saved mid-jump: lower them onto the ground just below
      let yy = y;
      for (let k = 0; k < 600 && yy < w.h && !w.boxHits(x, yy + 1, hb.w / 2, hb.h / 2); k++) yy += 1;
      if (valid(x, yy)) { y = yy; ok = true; }
    }
    if (ok) { P.x = x; P.y = y; } else sc.enter(game, 'safe');
    AQ.Camera.snap(P, w);
  };
  S.zoneName = (game) => { const sc = S.cur(game); return sc.zoneName ? sc.zoneName(game) : ''; };
  S.interactPressed = () => AQ.Input.wasPressed(...AQ.TUNING.interactKeys);
  S.keyName = () => AQ.TUNING.interactKeys[0].replace('Key', '');

  // Shared little "press E" prompt over the player's head.
  S.prompt = function (ctx, x, y, text) {
    const F = AQ.Font, label = `${S.keyName()}: ${text}`, w = F.width(label) + 6;
    const t = (AQ.Render.t * 2) % 2 < 1 ? 0 : 1;
    ctx.fillStyle = 'rgba(6,18,34,0.82)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 3 - t), w, 10);
    ctx.fillStyle = '#9feff0'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 3 - t), w, 1);
    F.draw(ctx, label, x, y - t, '#e8fbff', { align: 'center', shadow: false });
  };

  // ---------------------------------------------------------------- the main sea world
  const world = {
    world: () => AQ.World,
    zoneName: (game) => AQ.World.zoneName(game.player.x, game.player.y),
    valid: (x, y) => AQ.World.open(x, y) && !AQ.World.boxHits(x, y, 5, 4),
    enter(game, spawn) {
      const P = game.player, W = AQ.World;
      if (spawn === 'fromHill') {
        // back at the far edge of Tide Pools, facing back into the world
        const x = AQ.TUNING.entrance.returnX, g = W.groundBelow(x, W.sea - 80) || W.sea;
        P.x = x; P.y = g - 5; P.facing = 1;
        world.cooldown = 0.8;
      } else if (spawn === 'safe' || !spawn) {
        const st = AQ.data.world.playerStart; P.x = st[0]; P.y = st[1];
      }
    },
    update(dt, game, input) {
      const G = game, P = G.player;
      P.update(dt, AQ.World, input);
      if (AQ.Catching && !AQ.Transition.blocking()) AQ.Catching.update(dt, G);
      if (AQ.Doors) AQ.Doors.update(dt, G);
      if (AQ.Creatures) AQ.Creatures.update(dt, G);
      if (AQ.Chests) AQ.Chests.update(dt, G);
      if (AQ.Bottles) AQ.Bottles.update(dt, G);
      AQ.Camera.update(dt, P, AQ.World);
      AQ.Terrain.update(dt, AQ.Camera);
      AQ.FX.update(dt, AQ.World);
      // the path to the hill: walk off the far (left) edge of Tide Pools
      world.cooldown = Math.max(0, (world.cooldown || 0) - dt);
      if (!AQ.Transition.active && world.cooldown <= 0 && P.mode !== 'swim' && P.x <= AQ.TUNING.entrance.triggerX) S.go(G, 'hill', 'fromWorld');
    }
  };
  S.register('world', world);

  // Subtle cue at the edge of Tide Pools: a little signpost pointing up the path, and a few
  // drifting motes of light where the path leaves the screen.
  S.drawEntranceCue = function (ctx, game) {
    const W = AQ.World, sx = 30, g = W.groundBelow(sx, W.sea - 80);
    if (g == null) return;
    AQ.Assets.draw(ctx, 'misc.signpost', 'idle', sx, g + 1, { t: AQ.Render.t });
    const t = AQ.Render.t;
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.35 + i / 6) % 1, x = 6 + (i * 5) % 14 + Math.sin(t + i) * 1.5, y = g - 2 - ph * 22;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.75;
      ctx.fillStyle = i % 2 ? '#fff6c8' : '#bff6ff';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  };

  return S;
})();
