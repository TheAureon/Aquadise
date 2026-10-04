// Boot + main loop. Fixed-timestep update, render every animation frame.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Game = (function () {
  const G = {
    state: 'loading',     // loading | title | play | pause | aquarium | log | map | soundtest
    scene: 'world',       // where the player is: world | hill | station  (see src/scenes.js)
    time: 0,
    player: null,
    upgrades: { net: 1, speed: 1, lantern: 0, depth: 0 },
    lights: []
  };
  const STEP = 1 / 60;
  // what the player "presses" while a transition has control
  const NO_INPUT = { isDown: () => false, wasPressed: () => false, axis: () => ({ x: 0, y: 0 }) };
  let acc = 0, last = 0;

  G.boot = async function () {
    const canvas = document.getElementById('game');
    canvas.width = AQ.TUNING.view.w; canvas.height = AQ.TUNING.view.h;
    AQ.Camera.w = canvas.width; AQ.Camera.h = canvas.height;
    AQ.Input.attach(canvas);
    AQ.Audio.attach();                          // sound starts on the first click / key press
    AQ.Render.init(canvas);
    fit(); window.addEventListener('resize', fit);

    setLoading('Loading sprites...');
    await AQ.Assets.load((p) => setLoading(`Loading sprites... ${Math.round(p * 100)}%`));
    setLoading('Shaping the seabed...');
    await frame();
    AQ.World.build(AQ.data.world);
    setLoading('Painting terrain...');
    await frame();
    AQ.Terrain.build(AQ.World);
    AQ.World.releaseBackShapes();               // scenery-only shapes stop being walls once painted
    AQ.Render.buildTintField();
    for (const id in AQ.Scenes.list) if (AQ.Scenes.list[id].build) AQ.Scenes.list[id].build();

    const save = AQ.Save ? AQ.Save.load() : null;
    const start = AQ.data.world.playerStart;
    G.player = new AQ.Player(start[0], start[1]);
    if (save) AQ.Save.apply(save, G);
    // a brand-new game has tutorial progress from the start, so its saves are never mistaken for an older save
    if (!AQ.State.tutorial) AQ.State.tutorial = { seen: {} };
    G.upgrades = AQ.State.upgrades;
    G.player.speedLevel = G.upgrades.speed;

    if (AQ.Bottles) AQ.Bottles.init();           // before the doors exist: shut doors open by themselves anyway
    if (AQ.Doors) AQ.Doors.init();
    if (AQ.Creatures) AQ.Creatures.init(G);
    if (AQ.Chests) AQ.Chests.init(G);
    if (AQ.Starfall) AQ.Starfall.init();           // stars still waiting from last time (after the creatures)
    AQ.Scenes.restore(G, G.scene, G.player.x, G.player.y);
    document.getElementById('loading').style.display = 'none';
    AQ.Title.open(G);
    requestAnimationFrame(loop);
  };

  function setLoading(t) { const el = document.getElementById('loading-text'); if (el) el.textContent = t; }
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  function fit() {
    const canvas = document.getElementById('game');
    const vw = AQ.TUNING.view.w, vh = AQ.TUNING.view.h;
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / vw, window.innerHeight / vh)));
    canvas.style.width = vw * s + 'px'; canvas.style.height = vh * s + 'px';
    document.documentElement.style.setProperty('--px', s + 'px');
  }

  function loop(ts) {
    const dt = Math.min(0.1, (ts - last) / 1000 || 0);
    last = ts;
    acc += dt;
    let n = 0;
    // Safety net: an error in one frame is logged, but never stops the game (or leaves it stuck on
    // a black transition screen).
    try {
      while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; }
      if (n === 6) acc = 0;
      draw();
    } catch (e) {
      acc = 0;
      if (!G.errorShown) { G.errorShown = true; console.error('[Aquadise] frame error:', e); }
      AQ.Input.endFrame();
    }
    requestAnimationFrame(loop);
  }

  function update(dt) {
    const I = AQ.Input;
    G.time += dt;
    AQ.Render.t = G.time;

    if (G.state === 'play' || G.state === 'map') {
      const frozen = AQ.Transition.blocking(), inWorld = G.scene === 'world';
      AQ.Clock.update(dt);                         // one day/night clock for everywhere (the sea, the hill, the station)
      if (AQ.Starfall) AQ.Starfall.update(dt, G);   // falling stars + meteor showers: on schedule wherever you are
      if (AQ.Tips) AQ.Tips.update(dt, G);           // one-time tips (first, so an Esc / click that closes a tip is used up)
      if (AQ.Dive) AQ.Dive.update(dt, G);           // the optional guided dive (its buttons' clicks never swing the net)
      if (AQ.TUNING.debug.tutorialReset && I.wasPressed(AQ.TUNING.debug.tutorialResetKey) && AQ.Dive) { AQ.Tips.reset(); AQ.Dive.start(G); AQ.HUD.toast('Tutorial restarted, all tips reset.', '#cfe8ff'); }
      if (!frozen) {
        if (AQ.TUNING.debug.timeSkip && I.wasPressed(AQ.TUNING.debug.timeSkipKey)) { AQ.Clock.set(AQ.Clock.hour() + AQ.TUNING.clock.skipHours); AQ.HUD.toast(`Time skip: ${AQ.HUD.clockText()}`, '#cfe8ff'); }
        if (AQ.TUNING.debug.starKeys && AQ.Starfall) {
          if (I.wasPressed(AQ.TUNING.debug.fallStarKey) && !AQ.Starfall.fall(G)) AQ.HUD.toast('No free spot for a star right now.', '#cfe8ff');
          if (I.wasPressed(AQ.TUNING.debug.showerKey)) AQ.Starfall.startShower(G);
        }
        if (AQ.Keys.pressed('help')) { AQ.HUD.showHelp = true; AQ.HUD.helpT = AQ.HUD.helpT > 0 ? 0 : 12; }
        if (AQ.Keys.pressed('map')) { if (inWorld) G.state = G.state === 'map' ? 'play' : 'map'; else AQ.HUD.toast('The map only shows the sea.', '#cfe8ff'); }
        if (I.wasPressed('Tab') && AQ.Aquarium && AQ.TUNING.debug.tabOpensAquarium) { AQ.Aquarium.open(G); I.endFrame(); return; }
        if (AQ.Keys.pressed('log') && AQ.LogUI) { AQ.LogUI.open(G); I.endFrame(); return; }
        if (AQ.Keys.pressed('guide') && AQ.Guide) { AQ.Guide.open(G, 'play'); I.endFrame(); return; }
        if (AQ.Keys.pressed('pause')) { if (G.state === 'map') G.state = 'play'; else { G.state = 'pause'; I.endFrame(); return; } }
      }
      AQ.Scenes.cur(G).update(dt, G, frozen ? NO_INPUT : I);
      if (AQ.Gulls) AQ.Gulls.update(dt, G);         // distant seagulls in the sky (sea + hill)
      if (AQ.ShootingStars) AQ.ShootingStars.update(dt, G);   // night streaks (sky, water glow, portholes)
      AQ.HUD.update(dt, G);
      if (AQ.Save) AQ.Save.tick(dt, G);
    } else if (G.state === 'aquarium') {
      AQ.Clock.update(dt);                         // time keeps passing while you tend a tank
      if (AQ.Starfall) AQ.Starfall.update(dt, G);
      if (AQ.Tips) AQ.Tips.update(dt, G);
      AQ.Aquarium.update(dt, G);
    } else if (G.state === 'log') {
      AQ.LogUI.update(dt, G);
    } else if (G.state === 'pause') {
      AQ.PauseUI.update(dt, G);
    } else if (G.state === 'title') {
      AQ.Title.update(dt, G);
    } else if (G.state === 'soundtest') {
      AQ.SoundTest.update(dt, G);
    } else if (G.state === 'guide') {
      AQ.Guide.update(dt, G);
    }
    if (AQ.SoundDirector) AQ.SoundDirector.update(dt, G);
    AQ.Transition.update(dt);
    if (AQ.Breeding && G.state !== 'loading') AQ.Breeding.update(dt);   // tanks live on wherever you are
    I.endFrame();
  }

  function draw() {
    drawScene();
    AQ.Transition.draw(AQ.Render.ctx);
  }
  function drawScene() {
    const ctx = AQ.Render.ctx, cam = AQ.Camera;
    if (G.state === 'soundtest') { AQ.SoundTest.draw(ctx); return; }
    if (G.state === 'aquarium' || (G.state === 'log' && AQ.LogUI.from === 'aquarium')) {
      AQ.Aquarium.draw(ctx, G);
      if (G.state === 'log') AQ.LogUI.draw(ctx, G);
      else if (AQ.Tips) AQ.Tips.draw(ctx, G);
      return;
    }
    const title = G.state === 'title' || (G.state === 'log' && AQ.LogUI.from === 'title') || (G.state === 'guide' && AQ.Guide.from === 'title');
    if (!title && G.scene !== 'world') {
      // side scenes draw themselves; overlays go on top as usual
      AQ.Scenes.cur(G).draw(ctx, G);
      drawOverlays(ctx);
      return;
    }
    AQ.Render.background(cam);
    if (G.state === 'title') AQ.Title.drawBack(ctx);
    else { if (AQ.ShootingStars) AQ.ShootingStars.draw(ctx, G); if (AQ.Gulls) AQ.Gulls.draw(ctx, G); }   // far behind everything, just after the sky
    AQ.Terrain.draw(ctx, cam);
    ctx.save();
    ctx.translate(-cam.left(), -cam.top());
    if (AQ.Chests) AQ.Chests.draw(ctx, G);
    if (AQ.Bottles && !title) AQ.Bottles.draw(ctx);
    if (!title) AQ.Scenes.drawEntranceCue(ctx, G);
    if (AQ.Doors) AQ.Doors.draw(ctx);
    if (AQ.Creatures) AQ.Creatures.drawBack(ctx, G);
    if (!title) {
      G.player.draw(ctx);
      if (AQ.Catching) AQ.Catching.draw(ctx, G);
      if (AQ.Creatures) AQ.Creatures.drawFront(ctx, G);
    }
    AQ.FX.draw(ctx);
    ctx.restore();
    if (AQ.Terrain.drawFront) AQ.Terrain.drawFront(ctx, cam);
    AQ.Render.surface(cam);
    AQ.Render.lighting(cam, collectLights(), targetDarkness());
    AQ.Render.twilightTint(cam);
    if (!title && AQ.ShootingStars) AQ.ShootingStars.drawWater(ctx, G);   // a star's glow passing through the water
    if (!title && AQ.Starfall) AQ.Starfall.draw(ctx, G);                   // falling stars + light columns over landings
    if (!title && AQ.Dive) AQ.Dive.drawWorld(ctx, G);                      // the guided dive's glowing marker
    AQ.Render.heavyHaze(G.player.heavy || 0);
    AQ.Terrain.drawGlow(ctx, cam);
    if (title) { if (G.state === 'log') AQ.LogUI.draw(ctx, G); else if (G.state === 'guide') AQ.Guide.draw(ctx); else AQ.Title.draw(ctx, G); return; }
    drawOverlays(ctx);
  }
  function drawOverlays(ctx) {
    if (G.state === 'guide') { AQ.Guide.draw(ctx); return; }              // the book covers the HUD (no text underneath)
    AQ.HUD.draw(ctx, G);
    if (G.state === 'play' && AQ.Tips) AQ.Tips.draw(ctx, G);
    if (G.state === 'play' && AQ.Dive) AQ.Dive.draw(ctx, G);
    if (G.state === 'map') AQ.MapUI.draw(ctx, G);
    if (G.state === 'log') AQ.LogUI.draw(ctx, G);
    if (G.state === 'pause') AQ.PauseUI.draw(ctx, G);
  }

  function targetDarkness() {
    const W = AQ.World, cx = AQ.Camera.x, cy = AQ.Camera.y;
    const b = W.biomeAt(cx, cy);
    const depth = AQ.U.clamp((cy - W.sea - 320) / 900, 0, 0.65);
    // night darkens the sunlit sea; places that are already darker (deep water, caves) are unchanged
    const night = G.state === 'title' ? 0 : (1 - AQ.Clock.daylight()) * AQ.TUNING.clock.nightDarkness;
    return Math.max(b.dark || 0, depth, night);
  }

  function collectLights() {
    const p = G.player, L = G.lights;
    L.length = 0;
    if (G.state === 'title') L.push({ x: AQ.Camera.x, y: AQ.Camera.y, r: 90 });
    else {
      const extra = AQ.TUNING.upgrades.lanternRadius[G.upgrades.lantern || 0] || 0;   // the LANTERN upgrade
      L.push({ x: p.x + p.facing * 6, y: p.y, r: 58 + extra }); L.push({ x: p.x, y: p.y, r: 26 + extra * 0.5 });
    }
    for (const l of AQ.Terrain.lights) L.push(l);
    for (const f of AQ.Terrain.fireflies) L.push({ x: f.x, y: f.y, r: 9, color: '#ffe36b', power: 0.5 });
    if (AQ.Creatures) AQ.Creatures.lights(L);
    if (AQ.Chests) AQ.Chests.lights(L);
    if (AQ.Bottles && G.state !== 'title') AQ.Bottles.lights(L);
    if (AQ.Starfall && G.state !== 'title') AQ.Starfall.lights(L);
    return L;
  }

  return G;
})();

window.addEventListener('load', () => AQ.Game.boot());
