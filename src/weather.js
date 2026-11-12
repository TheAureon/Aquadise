// The weather. Each sea region that reaches the surface (tide pools, coral, ruins, open ocean, kelp,
// mangrove, ice) has its own weather: calm, breezy, choppy, rain, fog, or a rare storm night. It comes from
// real time, a stretch at a time (AQ.TUNING.weather.stretchMinutes), so it's the same whenever you look,
// and it changes slowly (blendSeconds). Swimming from one region into the next blends between their
// weathers near the border. A storm only rages at night: by day the same stretch is rain, and it builds
// at dusk. The hill shares the tide pools' weather. Never bad for the player: nothing is lost and nothing
// gets harder; it only looks (and, from B2, sounds) different.
//
// How it looks (2D, so every graphics level has it, CLASSIC included; the shader levels add to their own
// clouds and depth fog): a greyer sky and clouds, rain streaks above the water and rings on the surface,
// taller waves with whitecaps, a fog veil, a darker sea in rain and storms, and lightning. REDUCE
// FLASHING: no lightning flash, only a soft distant glow. LOW EFFECTS: half the raindrops.
//
// Kinds and how likely each is per region: data/weather.js. Tuning: AQ.TUNING.weather.
// Saved: AQ.State.weather = { seed } (a number: which weather falls in which stretch).
// Names: weather.<kind>; the change lines: weather.change.<kind> (data/lang/en.js).
// LANG_PREFIX: 'weather.'  LANG_PREFIX: 'weather.change.'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Weather = (function () {
  const U = AQ.U;
  const KEYS = ['cloud', 'wave', 'rain', 'fog', 'dark', 'wind', 'storm'];
  const zero = () => { const o = {}; KEYS.forEach((k) => { o[k] = 0; }); return o; };
  const W = { mix: zero(), drops: [], rings: [], hillDrops: [], forced: {}, boltT: 6, flashT: -1, glowT: -1, boltX: 160, sceneKey: null, lastHere: null };
  const cfg = () => AQ.TUNING.weather;
  const D = () => AQ.data.weather;
  const smooth = (t) => t * t * (3 - 2 * t);
  const st = () => {
    const s = AQ.State.weather = AQ.State.weather && typeof AQ.State.weather === 'object' ? AQ.State.weather : {};
    if (typeof s.seed !== 'number') s.seed = Math.floor(Math.random() * 1e9);
    return s;
  };

  // ---------------------------------------------------------------- which weather, where
  // the regions along the surface, left to right (from the world's biomes)
  let regions = null;
  W.regions = function () {
    if (!regions) regions = AQ.data.world.biomes.filter((b) => b.rect[1] === 0 && D().regions[b.id])
      .map((b) => ({ id: b.id, x0: b.rect[0], x1: b.rect[0] + b.rect[2] })).sort((a, b) => a.x0 - b.x0);
    return regions;
  };
  W.regionAt = (x) => W.regions().find((r) => x >= r.x0 && x < r.x1) || (x < W.regions()[0].x0 ? W.regions()[0] : W.regions()[W.regions().length - 1]);
  const hash = (a, b, c) => {
    let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f);
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  const stretchMs = () => cfg().stretchMinutes * 60000;
  W.stretch = (now = Date.now()) => Math.floor(now / stretchMs());
  // the kind of weather a region has in a stretch (testing overrides first)
  W.kindAt = function (id, stretch) {
    const dbg = AQ.TUNING.debug.weather;
    if (dbg && D().kinds[dbg]) return dbg;
    if (W.forced[id]) return W.forced[id];
    const w = D().regions[id];
    if (!w) return 'calm';
    const idx = W.regions().findIndex((r) => r.id === id), r = hash(st().seed, stretch, idx + 1);
    const total = D().order.reduce((s, k) => s + (w[k] || 0), 0);
    let acc = 0;
    for (const k of D().order) { acc += (w[k] || 0) / total; if (r < acc) return k; }
    return 'calm';
  };
  const night = () => (AQ.Clock ? 1 - AQ.Clock.daylight() : 0);
  // a kind's strengths right now (a storm is rain by day, building at dusk)
  function look(kind) {
    const K = D().kinds;
    if (kind !== 'storm') return K[kind] || K.calm;
    const n = night(), o = {};
    KEYS.forEach((k) => { o[k] = K.rain[k] + (K.storm[k] - K.rain[k]) * n; });
    return o;
  }
  // a region's weather right now: the stretch's, blending in from the last one at its start
  function regionLook(id, now = Date.now()) {
    const s = W.stretch(now), into = now - s * stretchMs(), f = smooth(Math.min(1, into / (cfg().blendSeconds * 1000)));
    const a = look(W.kindAt(id, s - 1)), b = look(W.kindAt(id, s)), o = {};
    KEYS.forEach((k) => { o[k] = a[k] + (b[k] - a[k]) * f; });
    return o;
  }
  // the kind to show (HUD, map, change lines): the new stretch's once it's half blended in
  W.kind = function (id, now = Date.now()) {
    const s = W.stretch(now), into = now - s * stretchMs();
    const k = W.kindAt(id, into < cfg().blendSeconds * 500 ? s - 1 : s);
    return k === 'storm' && night() < 0.5 ? 'rain' : k;
  };
  // the weather at a spot along the sea (x): its region's, blending into the neighbour's near the border
  W.lookAt = function (x) {
    const rs = W.regions(), i = rs.indexOf(W.regionAt(x)), r = rs[i], E = cfg().edge, me = regionLook(r.id);
    let other = null, k = 0;
    if (i > 0 && x - r.x0 < E) { other = rs[i - 1]; k = 0.5 - 0.5 * Math.max(0, x - r.x0) / E; }
    else if (i < rs.length - 1 && r.x1 - x < E) { other = rs[i + 1]; k = 0.5 - 0.5 * Math.max(0, r.x1 - x) / E; }
    if (!other || k <= 0) return me;
    const o = regionLook(other.id), out = {};
    KEYS.forEach((key) => { out[key] = me[key] + (o[key] - me[key]) * k; });
    return out;
  };
  W.on = () => cfg().enabled;
  // where the player is: the sea (by the camera), the hill, or somewhere without weather
  function scene(game) {
    if (!W.on() || !game || game.state === 'title' || game.state === 'loading') return null;
    if (game.state === 'aquarium' || (game.state === 'log' && AQ.LogUI.from === 'aquarium')) return null;
    if (game.scene === 'world') return 'sea';
    if (game.scene === 'hill') return 'hill';
    return null;
  }
  W.here = function (game) {                                       // the region whose weather you're in (or null)
    const s = scene(game);
    return s === 'sea' ? W.regionAt(game.player.x).id : s === 'hill' ? D().hill : null;
  };

  // ---------------------------------------------------------------- every frame
  const rnd = (a, b) => a + Math.random() * (b - a);
  W.update = function (dt, game) {
    const sc = scene(game);
    const target = sc === 'sea' ? W.lookAt(AQ.Camera.x) : sc === 'hill' ? regionLook(D().hill) : zero();
    const snap = sc !== W.sceneKey;                                // a new scene: the weather is simply there
    W.sceneKey = sc;
    const k = snap ? 1 : Math.min(1, dt * 0.8);
    KEYS.forEach((key) => { W.mix[key] += (target[key] - W.mix[key]) * k; });
    if (snap) { W.drops.length = 0; W.rings.length = 0; W.hillDrops.length = 0; }
    if (sc === 'sea') rainSea(dt); else if (sc === 'hill') rainHill(dt);
    for (let i = W.rings.length - 1; i >= 0; i--) if ((W.rings[i].t += dt) > W.rings[i].life) W.rings.splice(i, 1);
    lightning(dt, sc);
    changeLine(game);
    debugKey(game);
  };
  const dropCount = () => Math.round(cfg().rainDrops * W.mix.rain * (U.lowFx() ? 0.5 : 1));
  const slant = () => 0.12 + W.mix.wind * 0.45;                    // px sideways per px down
  // rain over the sea, in world px: from above the view down to the water (rings) or the ground
  function rainSea(dt) {
    const cam = AQ.Camera, Wd = AQ.World, left = cam.left(), top = cam.top(), n = dropCount(), sp = cfg().rainSpeed;
    const seaY = Wd.sea;
    if (seaY - top < 0) { W.drops.length = 0; return; }           // deep below: no rain to see
    while (W.drops.length > n) W.drops.pop();
    const spawn = (d, anywhere) => {
      d.y = anywhere ? rnd(top - 20, seaY) : top - rnd(4, 30); d.x = rnd(left - 40, left + cam.w + 10) - (anywhere ? 0 : slant() * 20);
      d.len = Math.round(rnd(3, 6)); d.v = sp * rnd(0.85, 1.15); return d;
    };
    while (W.drops.length < n) W.drops.push(spawn({}, true));
    for (const d of W.drops) {
      d.y += d.v * dt; d.x += d.v * slant() * dt;
      if (d.y >= seaY) {
        if (!Wd.solid(d.x, seaY) && !Wd.solid(d.x, seaY - 1) && W.rings.length < 80) W.rings.push({ x: d.x, y: seaY, t: 0, life: rnd(0.35, 0.6) });
        spawn(d, false);
      } else if (Wd.solid(d.x, d.y) || d.x > left + cam.w + 20 || d.x < left - 60 || d.y < top - 60) spawn(d, false);
    }
  }
  // the hill: screen px; drops land on the grass, or ring on the little sea below (y 152+)
  function rainHill(dt) {
    const n = dropCount(), sp = cfg().rainSpeed, ground = AQ.Hill && AQ.Hill.groundAt ? AQ.Hill.groundAt : () => 152;
    while (W.hillDrops.length > n) W.hillDrops.pop();
    const spawn = (d, anywhere) => { d.y = anywhere ? rnd(-20, 160) : -rnd(4, 30); d.x = rnd(-40, 330); d.len = Math.round(rnd(3, 6)); d.v = sp * rnd(0.85, 1.15); d.stop = null; return d; };
    while (W.hillDrops.length < n) W.hillDrops.push(spawn({}, true));
    for (const d of W.hillDrops) {
      d.y += d.v * dt; d.x += d.v * slant() * dt;
      const g = ground(Math.round(d.x));
      if (d.y >= g) { if (g >= 152 && W.rings.length < 80) W.rings.push({ x: d.x, y: g + rnd(0, 20), t: 0, life: rnd(0.35, 0.6), screen: true }); spawn(d, false); }
      else if (d.x > 340) spawn(d, false);
    }
  }
  // lightning: a short flash (or, with REDUCE FLASHING, a soft glow) now and then in a storm
  function lightning(dt, sc) {
    if (W.flashT >= 0) { W.flashT += dt; if (W.flashT > 0.5) W.flashT = -1; }
    if (W.glowT >= 0) { W.glowT += dt; if (W.glowT > 2.4) W.glowT = -1; }
    if (!sc || W.mix.storm < 0.25) { W.boltT = Math.max(W.boltT, 3); return; }
    W.boltT -= dt;
    if (W.boltT > 0) return;
    const E = cfg().flashEvery;
    W.boltT = rnd(E[0], E[1]) / Math.max(0.4, W.mix.storm);
    W.boltX = rnd(40, 280);
    if (U.calm()) W.glowT = 0; else W.flashT = 0;
    W.lastBolt = Date.now();
  }
  // how bright the flash / glow is right now (0-1)
  W.flash = function () {
    if (W.flashT < 0) return 0;
    const t = W.flashT;
    return t < 0.07 ? 1 : t < 0.15 ? 0.25 : t < 0.22 ? 0.75 : Math.max(0, 0.75 * (1 - (t - 0.22) / 0.28));
  };
  W.glow = () => (W.glowT < 0 ? 0 : Math.sin(Math.PI * W.glowT / 2.4));
  // a short line when the weather where you are changes (not when you swim into another region:
  // its name shows then, with its weather under it)
  function changeLine(game) {
    const id = W.here(game), kind = id ? W.kind(id) : null;
    const prev = W.lastHere;
    W.lastHere = id ? { id, kind } : null;
    if (!id || !prev || prev.id !== id || prev.kind === kind || game.state !== 'play') return;
    if (cfg().changeToast && AQ.HUD) AQ.HUD.toast(AQ.t('weather.change.' + kind), '#cfe8ff', 4);
  }
  function debugKey(game) {
    const d = AQ.TUNING.debug;
    if (!d.weatherKeys || !AQ.Input.rawPressed(d.weatherKey)) return;
    const id = W.here(game);
    if (!id) return;
    const order = D().order, cur = W.forced[id], i = cur ? order.indexOf(cur) : -1;
    if (i === order.length - 1) delete W.forced[id]; else W.forced[id] = order[i + 1];
    if (AQ.HUD) AQ.HUD.toast(W.forced[id] ? AQ.t('debug.weather', { kind: AQ.t('weather.' + W.forced[id]) }) : AQ.t('debug.weatherUsual'), '#cfe8ff');
    W.lastHere = { id, kind: W.kind(id) };
  }
  W.dark = () => W.mix.dark;

  // ---------------------------------------------------------------- how it looks
  const daylight = () => (AQ.Clock ? AQ.Clock.daylight() : 1);
  const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const css = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;
  // the sky's colours [top, horizon], greyer under clouds and darker in rain and storms
  W.skyTint = function (cols) {
    const m = W.mix, c = Math.min(1, m.cloud), d = daylight();
    if (c < 0.02 && m.dark < 0.01) return cols;
    const grey = mixC([30, 34, 48], [160, 168, 178], d), heavy = mixC([16, 18, 28], [84, 92, 108], d);
    const g = mixC(grey, heavy, Math.min(1, m.dark * 2.5)), k = c * 0.6;
    return [mixC(cols[0], g, k), mixC(cols[1], g, k * 0.85)];
  };
  W.starsK = () => 1 - Math.min(1, W.mix.cloud) * 0.95;            // clouds hide the stars
  // clouds: a few soft banks drifting with the wind (they come in from about 0.25 cloud)
  const CLOUDS = [];
  for (let i = 0; i < 9; i++) CLOUDS.push({ x: i * 83 + (i * 37) % 40, y: 2 + (i * 13) % 24, w: 30 + (i * 29) % 36, h: 9 + (i * 5) % 7, depth: 0.5 + (i % 3) * 0.25, hump: i % 3 });
  const HUMPS = [[[0.22, 0.42, 0.55], [0.5, 0.5, 1], [0.78, 0.4, 0.7]], [[0.3, 0.55, 0.8], [0.66, 0.5, 0.6], [0.5, 0.95, 0.3]], [[0.25, 0.4, 0.75], [0.55, 0.45, 0.95], [0.5, 0.95, 0.35]]];
  function cloudBank(ctx, c, x, y, w, h, body, under, maxY) {
    // three overlapping rounded humps with a flat bottom, row by row (crisp pixels)
    const humps = HUMPS[c.hump];
    for (let r = 0; r < h; r++) {
      const yy = y + r;
      if (yy >= maxY) break;
      let a = Infinity, b = -Infinity;
      for (const [cx, rw, rh] of humps) {
        const hh = h * rh, dy = h - r;
        if (dy > hh) continue;
        const hw = w * rw * 0.5 * Math.sqrt(Math.max(0, 1 - (dy / hh) * (dy / hh)));
        a = Math.min(a, x + w * cx - hw); b = Math.max(b, x + w * cx + hw);
      }
      if (b <= a) continue;
      ctx.fillStyle = r >= h - 2 ? under : body;
      ctx.fillRect(Math.round(a), yy, Math.round(b - a), 1);
    }
  }
  function drawClouds(ctx, left, skyBottom) {
    const m = W.mix, amt = U.clamp((m.cloud - 0.22) / 0.6, 0, 1);
    if (amt <= 0.01 || skyBottom < 6) return;
    const d = daylight(), stormy = U.clamp((m.cloud - 0.6) / 0.4 + m.storm * 0.4, 0, 1);
    const light = mixC([62, 70, 92], [238, 242, 247], d), dark = mixC([26, 30, 44], [100, 108, 126], d);
    const body = mixC(light, dark, stormy), under = mixC(body, [0, 0, 0], 0.18), t = AQ.Render.t * (U.calm() ? 0.5 : 1);
    const n = Math.round(4 + amt * 5);
    for (let i = 0; i < n; i++) {
      const c = CLOUDS[i], span = 720;
      const x = ((c.x - left * 0.08 * c.depth + t * (1 + m.wind * 5) * c.depth) % span + span) % span - 100;
      ctx.globalAlpha = Math.min(0.92, amt * (0.65 + 0.3 * c.depth));
      cloudBank(ctx, c, x, c.y, c.w * (1 + stormy * 0.6), c.h + Math.round(stormy * 4), css(body, 1), css(under, 1), skyBottom - 2);
    }
    ctx.globalAlpha = 1;
  }
  // the sky part, right after the sea's backdrop (behind gulls, terrain and everything else)
  W.drawSky = function (ctx, cam) {
    if (W.sceneKey !== 'sea') return;
    const seaY = AQ.World.sea - cam.top();
    if (seaY <= 0) return;
    glowBehind(ctx, Math.min(seaY, 180));
    drawClouds(ctx, cam.left(), Math.min(seaY, 180));
  };
  // REDUCE FLASHING's soft distant glow, behind the clouds
  function glowBehind(ctx, bottom) {
    const g = W.glow() * W.mix.storm * cfg().glow;
    if (g <= 0.005) return;
    const gr = ctx.createRadialGradient(W.boltX, 20, 4, W.boltX, 20, 80);
    gr.addColorStop(0, `rgba(225,228,255,${g.toFixed(3)})`); gr.addColorStop(1, 'rgba(225,228,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 320, bottom);
  }
  function drawDrop(ctx, x, y, len, sl) {
    for (let i = 0; i < len; i++) ctx.fillRect(Math.round(x - i * sl), Math.round(y - i), 1, 1);
  }
  // rain and its rings on the surface (after the water's surface line is drawn)
  W.drawSea = function (ctx, cam) {
    if (W.sceneKey !== 'sea') return;
    const left = cam.left(), top = cam.top(), seaY = AQ.World.sea - top;
    if (W.drops.length && seaY > 0) {
      const d = daylight();
      ctx.fillStyle = css(mixC([120, 140, 170], [214, 228, 242], d), 0.55);
      const sl = slant();
      for (const p of W.drops) if (p.y - top < seaY) drawDrop(ctx, p.x - left, p.y - top, p.len, sl);
    }
    drawRings(ctx, left, top);
  };
  function drawRings(ctx, left, top) {
    for (const r of W.rings) {
      const k = r.t / r.life, rad = 1 + k * 3.5, x = (r.screen ? r.x : r.x - left), y = Math.round(r.screen ? r.y : r.y - top);
      ctx.fillStyle = `rgba(232,248,255,${(0.7 * (1 - k)).toFixed(3)})`;
      ctx.fillRect(Math.round(x - rad), y, 1, 1); ctx.fillRect(Math.round(x + rad), y, 1, 1);
      if (rad > 2) { ctx.fillRect(Math.round(x - rad * 0.6), y - 1, Math.max(1, Math.round(rad * 1.2)), 1); }
    }
  }
  // the waves: how much taller, and whitecaps (src/render.js draws the surface line)
  W.waveScale = () => 1 + W.mix.wave * cfg().waveHeight;
  W.whitecap = (wx, t) => W.mix.wave > 0.5 && Math.sin(wx * 0.137 + t * 1.9) + Math.sin(wx * 0.051 - t * 0.7) * 0.6 > 1.55 - (W.mix.wave - 0.5) * 0.9;
  // over everything in the world (after its light and shade): the fog veil and the lightning flash
  W.drawOver = function (ctx, cam) {
    if (W.sceneKey !== 'sea') return;
    const seaY = Math.round(AQ.World.sea - cam.top()), m = W.mix, d = daylight(), C = cfg();
    if (m.fog > 0.01) {
      const above = mixC([58, 66, 84], [214, 222, 228], d), below = mixC([22, 34, 52], [104, 138, 152], d);
      if (seaY > 0) { ctx.fillStyle = css(above, m.fog * C.fogAbove); ctx.fillRect(0, 0, 320, Math.min(180, seaY)); }
      // under the surface: the shader layer thickens its own depth fog instead (GRAPHICS LOW-HIGH)
      const shader = AQ.Gfx && AQ.Gfx.active() && !AQ.Gfx.off.fog;
      if (!shader && seaY < 180) {
        const y0 = Math.max(0, seaY), g = ctx.createLinearGradient(0, seaY, 0, seaY + 520);
        g.addColorStop(0, css(below, m.fog * C.fogBelow)); g.addColorStop(1, css(below, m.fog * C.fogBelow * 0.35));
        ctx.fillStyle = g; ctx.fillRect(0, y0, 320, 180 - y0);
      }
    }
    flashOver(ctx, seaY);
  };
  function flashOver(ctx, seaY) {
    const f = W.flash() * W.mix.storm * cfg().flash;
    if (f <= 0.005) return;
    ctx.fillStyle = `rgba(232,236,255,${f.toFixed(3)})`;
    if (seaY > 0) ctx.fillRect(0, 0, 320, Math.min(180, seaY));
    if (seaY < 180) { ctx.fillStyle = `rgba(200,215,255,${(f * 0.18).toFixed(3)})`; ctx.fillRect(0, Math.max(0, seaY), 320, 180 - Math.max(0, seaY)); }
    if (W.flash() > 0.5 && seaY > 20) {                              // the bolt itself, far away
      ctx.fillStyle = 'rgba(246,248,255,0.9)';
      let x = W.boltX;
      for (let y = 14; y < seaY - 1; y++) { if (y % 3 === 0) x += ((W.boltX * 7 + y * 13) % 5) - 2; ctx.fillRect(Math.round(x), y, 1, 1); }
    }
  }
  // the hill: clouds, rain, darker weather, fog and lightning, over the hill's own scene
  W.drawHill = function (ctx) {
    if (W.sceneKey !== 'hill') return;
    const m = W.mix, d = daylight(), C = cfg();
    if (m.dark > 0.01) { ctx.fillStyle = `rgba(20,26,40,${(m.dark * 0.55).toFixed(3)})`; ctx.fillRect(0, 0, 320, 180); }
    if (W.hillDrops.length) {
      ctx.fillStyle = css(mixC([120, 140, 170], [214, 228, 242], d), 0.55);
      const sl = slant();
      for (const p of W.hillDrops) drawDrop(ctx, p.x, p.y, p.len, sl);
    }
    drawRings(ctx, 0, 0);
    if (m.fog > 0.01) { ctx.fillStyle = css(mixC([58, 66, 84], [214, 222, 228], d), m.fog * C.fogAbove * 0.75); ctx.fillRect(0, 0, 320, 180); }
    flashOver(ctx, 150);
  };
  W.drawHillSky = function (ctx) {                                 // behind the hills (after the hill's sky)
    if (W.sceneKey !== 'hill') return;
    glowBehind(ctx, 150);
    drawClouds(ctx, AQ.Camera.left(), 132);
  };

  // ---------------------------------------------------------------- the HUD and the map
  const G = {
    calm:   { rows: ['.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.'], col: '#ffe36b' },
    moon:   { rows: ['..##...', '.#.....', '.#.....', '.#.....', '..##...'], col: '#d8e4ff' },
    breezy: { rows: ['####...', '....#..', '.####..', '.......', '..#####'], col: '#cfe8f5' },
    choppy: { rows: ['..#...#', '.#.#.#.', '#...#..', '.......', '.......'], col: '#9fe0ff' },
    cloud:  { rows: ['...##..', '.#####.', '#######', '.#####.', '.......'], col: '#e4ecf2' },
    rain:   { rows: ['...##..', '.#####.', '#######', '.......', '.#.#.#.'], col: '#e4ecf2', drops: '#8fd0ff' },
    fog:    { rows: ['#####..', '.......', '..#####', '.......', '#####..'], col: '#d0dae0' },
    storm:  { rows: ['...##..', '.#####.', '#######', '...#...', '..#....'], col: '#9aa6b8', drops: '#ffe36b' }
  };
  // a 7 x 5 weather glyph (drops / the bolt in their own colour on the last rows)
  W.drawGlyph = function (ctx, x, y, kind, alpha = 0.9) {
    const g = G[kind];
    if (!g) return;
    ctx.globalAlpha = alpha;
    g.rows.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = 'rgba(4,12,24,0.75)'; ctx.fillRect(x + rx + 1, y + ry + 1, 1, 1); } }));
    g.rows.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = g.drops && ry >= 3 ? g.drops : g.col; ctx.fillRect(x + rx, y + ry, 1, 1); } }));
    ctx.globalAlpha = 1;
  };
  // the HUD: the weather where you are, over the corner of the sun / moon icon (calm: just the icon)
  W.drawHud = function (ctx, x, y, game) {
    const id = W.here(game);
    if (!id) return;
    const k = W.kind(id);
    if (k !== 'calm') W.drawGlyph(ctx, x, y, k);
  };
  // the map: each region's weather above it (calm: a sun, or a moon at night)
  W.drawMap = function (g, ox, oy, S) {
    if (!W.on()) return;
    for (const r of W.regions()) {
      const k = W.kind(r.id), glyph = k === 'calm' ? (night() > 0.5 ? 'moon' : 'calm') : k;
      W.drawGlyph(g, Math.round(ox + (r.x0 + r.x1) / 2 / S) - 3, oy - 8, glyph, 1);
    }
  };
  // the region banner's second line: this region's weather
  W.bannerLine = function (game) { const id = W.here(game); return id ? AQ.t('weather.' + W.kind(id)) : ''; };
  return W;
})();
