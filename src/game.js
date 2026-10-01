// Boot + main loop. Fixed-timestep update, render every animation frame.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Game = (function () {
  const G = {
    state: 'loading',     // loading | play | aquarium | log | map
    time: 0,
    player: null,
    upgrades: { net: 1, speed: 1 },
    lights: []
  };
  const STEP = 1 / 60;
  let acc = 0, last = 0;

  G.boot = async function () {
    const canvas = document.getElementById('game');
    canvas.width = AQ.TUNING.view.w; canvas.height = AQ.TUNING.view.h;
    AQ.Camera.w = canvas.width; AQ.Camera.h = canvas.height;
    AQ.Input.attach(canvas);
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
    AQ.Render.buildTintField();

    const save = AQ.Save ? AQ.Save.load() : null;
    const start = AQ.data.world.playerStart;
    G.player = new AQ.Player(start[0], start[1]);
    if (save) AQ.Save.apply(save, G);
    G.upgrades = AQ.State.upgrades;
    G.player.speedLevel = G.upgrades.speed;

    if (AQ.Creatures) AQ.Creatures.init(G);
    if (AQ.Chests) AQ.Chests.init(G);
    AQ.Camera.snap(G.player);
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
    while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; }
    if (n === 6) acc = 0;
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    const I = AQ.Input;
    G.time += dt;
    AQ.Render.t = G.time;

    if (G.state === 'play' || G.state === 'map') {
      if (I.wasPressed('KeyH')) { AQ.HUD.showHelp = true; AQ.HUD.helpT = AQ.HUD.helpT > 0 ? 0 : 12; }
      if (I.wasPressed('KeyM')) G.state = G.state === 'map' ? 'play' : 'map';
      if (I.wasPressed('Tab') && AQ.Aquarium) { AQ.Aquarium.open(G); I.endFrame(); return; }
      if (I.wasPressed('KeyL') && AQ.LogUI) { AQ.LogUI.open(G); I.endFrame(); return; }
      if (I.wasPressed('Escape')) { if (G.state === 'map') G.state = 'play'; else { G.state = 'pause'; I.endFrame(); return; } }

      G.player.update(dt, AQ.World, I);
      if (AQ.Catching) AQ.Catching.update(dt, G);
      if (AQ.Creatures) AQ.Creatures.update(dt, G);
      if (AQ.Chests) AQ.Chests.update(dt, G);
      AQ.Camera.update(dt, G.player, AQ.World);
      AQ.Terrain.update(dt, AQ.Camera);
      AQ.FX.update(dt, AQ.World);
      AQ.HUD.update(dt, G);
      if (AQ.Save) AQ.Save.tick(dt, G);
    } else if (G.state === 'aquarium') {
      AQ.Aquarium.update(dt, G);
    } else if (G.state === 'log') {
      AQ.LogUI.update(dt, G);
    } else if (G.state === 'pause') {
      AQ.PauseUI.update(dt, G);
    } else if (G.state === 'title') {
      AQ.Title.update(dt, G);
    }
    I.endFrame();
  }

  function draw() {
    const ctx = AQ.Render.ctx, cam = AQ.Camera;
    if (G.state === 'aquarium' || (G.state === 'log' && AQ.LogUI.from === 'aquarium')) {
      AQ.Aquarium.draw(ctx, G);
      if (G.state === 'log') AQ.LogUI.draw(ctx, G);
      return;
    }
    AQ.Render.background(cam);
    AQ.Terrain.draw(ctx, cam);
    ctx.save();
    ctx.translate(-cam.left(), -cam.top());
    const title = G.state === 'title';
    if (AQ.Chests) AQ.Chests.draw(ctx, G);
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
    if (title) { AQ.Title.draw(ctx, G); return; }
    AQ.HUD.draw(ctx, G);
    if (G.state === 'map') AQ.MapUI.draw(ctx, G);
    if (G.state === 'log') AQ.LogUI.draw(ctx, G);
    if (G.state === 'pause') AQ.PauseUI.draw(ctx, G);
  }

  function targetDarkness() {
    const W = AQ.World, cx = AQ.Camera.x, cy = AQ.Camera.y;
    const b = W.biomeAt(cx, cy);
    const depth = AQ.U.clamp((cy - W.sea - 320) / 900, 0, 0.65);
    return Math.max(b.dark || 0, depth);
  }

  function collectLights() {
    const p = G.player, L = G.lights;
    L.length = 0;
    if (G.state === 'title') L.push({ x: AQ.Camera.x, y: AQ.Camera.y, r: 90 });
    else { L.push({ x: p.x + p.facing * 6, y: p.y, r: 58 }); L.push({ x: p.x, y: p.y, r: 26 }); }
    for (const l of AQ.Terrain.lights) L.push(l);
    if (AQ.Creatures) AQ.Creatures.lights(L);
    if (AQ.Chests) AQ.Chests.lights(L);
    return L;
  }

  return G;
})();

window.addEventListener('load', () => AQ.Game.boot());
