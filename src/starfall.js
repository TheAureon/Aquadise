// Falling stars and meteor showers: night events that leave something rare to catch.
//
// Each night is counted at dusk (AQ.State.starfall.night, saved). Its plan (shower or not, how many
// stars fall and when) is seeded from the world seed + night number and saved, so reloading never
// re-rolls it. Catch-up: a star always falls at least every `guaranteeEvery` nights.
// A falling star comes down somewhere in the sea that's reachable at upgrade level 0 (the message-
// bottle spot scan, src/bottles.js), never inside terrain, past the depth limit or on top of you. It
// lands with a burst + a soft chime, and a light column rises from the spot. Water: a few Starfall
// Minnows; shore or sandy seabed: an Aerolite Crab; during a shower each landing may also bring a
// Comet Ray. They glow, wait `lingerMinutes` (real minutes) and then fade out slowly.
// Everything keeps running wherever you are (the hill, the station, a tank): come back and the star
// may still be waiting. A toast tells you where it fell, the map (M) marks it, and a small star sits by
// the HUD moon while something is waiting (a sparkle there means a meteor shower night).
// Tuning: AQ.TUNING.starfall. Saved: AQ.State.starfall = { night, lastStar, phase, plan, landings }.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Starfall = (function () {
  const U = AQ.U, R = U.R;
  const SF = { falls: [], t: 0 };
  const cfg = () => AQ.TUNING.starfall;
  const st = () => (AQ.State.starfall = AQ.State.starfall || { night: 0, lastStar: 0, phase: null, plan: null, landings: [] });
  const EVENING = (p) => p === 'dusk' || p === 'night';
  const defOf = (id) => AQ.Creatures.defs[id];

  // ---------------------------------------------------------------- the nightly plan
  function makePlan(n) {
    const c = cfg(), s = st(), rng = U.rng(((AQ.data.world.seed || 1) * 7919 + n * 104729) >>> 0);
    const shower = rng() < c.showerChance;
    let count = shower ? rng.int(c.showerStars[0], c.showerStars[1]) : rng() < c.starChance ? 1 : 0;
    if (!count && n - s.lastStar >= c.guaranteeEvery) count = 1;              // catch-up: never wait too long
    const [w0, w1] = c.fallWindow, falls = [];
    for (let i = 0; i < count; i++) falls.push({ p: w0 + (w1 - w0) * (i + 0.15 + rng() * 0.7) / count, done: false });
    return { night: n, shower, falls, announced: false };
  }
  // how far through the night we are (0 = nightfall, 1 = dawn), or -1 outside the night
  function nightProgress() {
    const k = AQ.TUNING.clock, start = k.duskHour + k.duskHours, len = (24 - start) + k.dawnHour;
    if (AQ.Clock.phase() !== 'night') return -1;
    return (((AQ.Clock.hour() - start) % 24) + 24) % 24 / len;
  }
  SF.plan = () => st().plan;
  SF.showerTonight = () => { const p = st().plan; return !!(p && p.shower && (EVENING(AQ.Clock.phase()) || SF.forcedUntil > SF.t)); };
  SF.forcedUntil = 0;
  // TESTING (debug.starKeys): a meteor shower right now, even by day. The sky gets busy for a while and
  // 2-4 stars fall over the next ~20 seconds. Tonight's real plan carries on afterwards as normal.
  SF.startShower = function (game) {
    const c = cfg(), s = st(), n = R.int(c.showerStars[0], c.showerStars[1]);
    s.plan = Object.assign(s.plan || { night: s.night, falls: [] }, { shower: true, announced: true });
    SF.forcedUntil = SF.t + 90;
    tell('The sky is full of falling stars tonight', game);
    if (AQ.Music) AQ.Music.stinger('shower');
    for (let i = 0; i < n; i++) SF.queue.push(SF.t + 2 + i * R.range(4, 7));
  };
  SF.queue = [];
  SF.waiting = () => st().landings.filter((L) => wantCount(L) > 0);
  const wantCount = (L) => Object.values(L.want).reduce((a, b) => a + b, 0);

  // ---------------------------------------------------------------- where a star can land
  // spots from the bottle scan: reachable at level 0, above the depth limit, with a clear drop from the sky
  let spotCache = null;
  function spots() {
    if (spotCache) return spotCache;
    const W = AQ.World, out = [], all = (AQ.Bottles && AQ.Bottles.spots) || {};
    const clearSky = (x, y) => { for (let yy = y - 3; yy >= W.sea - 4; yy--) if (W.solid(x, yy)) return false; return true; };
    for (const id in all) for (const s of all[id]) {
      if (s.kind === 'floor' && s.y - W.sea > cfg().maxFloorDepth) continue;
      if (!clearSky(s.x, s.y)) continue;                                       // never into a cave or under an overhang
      out.push({ x: s.x, y: s.y, kind: s.kind, ground: s.kind !== 'float' });
    }
    return (spotCache = out);
  }
  function pickSpot(game, ground) {
    const c = cfg(), P = game.player, inWorld = game.scene === 'world', taken = st().landings;
    const ok = (s) => (!inWorld || Math.hypot(s.x - P.x, s.y - P.y) > c.minPlayerDist) && !taken.some((L) => Math.hypot(L.x - s.x, L.y - s.y) < c.minApart);
    let pool = spots().filter((s) => s.ground === ground && ok(s));
    if (!pool.length) pool = spots().filter(ok);                               // nothing of that kind free: take any
    return pool.length ? R.pick(pool) : null;
  }

  // ---------------------------------------------------------------- a star falls
  SF.fall = function (game, opts = {}) {
    game = game || AQ.Game;
    const c = cfg(), s = st(), ground = opts.ground != null ? opts.ground : R.chance(c.groundShare);
    const spot = pickSpot(game, ground);
    if (!spot) return null;
    const W = AQ.World, biome = W.biomeAt(spot.x, spot.kind === 'float' ? spot.y + 4 : spot.y - 2) || W.biomeAt(spot.x, W.sea + 4);
    const want = {};
    if (spot.ground) want.aerolite_crab = 1; else want.starfall_minnow = R.int(c.minnows[0], c.minnows[1]);
    if (opts.shower && R.chance(c.rayChance)) want.comet_ray = 1;
    const L = { id: U.uid(), x: spot.x, y: spot.y, kind: spot.kind, biome: biome ? biome.id : null, left: c.lingerMinutes * 60, total: c.lingerMinutes * 60, want, landed: false };
    s.landings.push(L);
    s.lastStar = s.night;
    const where = biome ? biome.name : 'the sea';
    // in the sea you see it come down; anywhere else it simply lands (and is waiting when you return)
    if (game.scene === 'world' && game.state !== 'aquarium') {
      const dir = R.chance(0.5) ? 1 : -1, ty = spot.kind === 'float' ? W.sea : spot.ground && spot.kind === 'floor' ? W.sea : spot.y - 2;
      SF.falls.push({ L, x0: spot.x - dir * 120, y0: W.sea - 120, x1: spot.x, y1: ty, t: 0, dur: c.fallSeconds });
      AQ.Audio.play('star_whoosh', { vol: AQ.TUNING.shootingStars.soundVolume });
    } else land(L, game);
    tell(`A shooting star fell near the ${where}!`, game);
    AQ.Save && AQ.Save.dirty();
    return L;
  };
  function tell(text, game) {
    if (game.state === 'aquarium' && AQ.Aquarium.note) AQ.Aquarium.note(text, '#d8e4ff', 5);
    else AQ.HUD.toast(text, '#d8e4ff', 5);
  }
  // the moment it touches down: burst + chime, then its creatures appear
  function land(L, game) {
    L.landed = true;
    const W = AQ.World, P = game.player, inWorld = game.scene === 'world';
    if (inWorld) {
      const d = Math.hypot(P.x - L.x, P.y - L.y), c = cfg();
      AQ.Audio.play('star_land', { vol: c.chimeVolume * (d < c.nearChime ? 1 : 0.45) });
      const by = L.kind === 'float' ? W.sea : L.y - 2;
      for (let i = 0; i < 14; i++) AQ.FX.sparkle(L.x + R.range(-10, 10), by - R.range(0, 12), i % 3 ? '#fff6dc' : '#bfe0ff', 6);
      AQ.FX.puff(L.x, by, L.kind === 'float' ? 'rgba(220,240,255,0.8)' : 'rgba(230,220,200,0.7)', 10);
      if (L.kind !== 'shore') AQ.Audio.play('splash_in', { vol: 0.5 });
    } else AQ.Audio.play('star_land', { vol: cfg().chimeVolume * 0.4 });
    spawn(L);
  }
  // (re)create a landing's creatures (also after a reload)
  function spawn(L) {
    const W = AQ.World;
    for (const id in L.want) {
      const def = defOf(id);
      if (!def) continue;
      for (let i = 0; i < L.want[id]; i++) {
        let x = L.x, y = L.y;
        if (id === 'aerolite_crab') { y = L.y - AQ.Creatures.footOf(def); }
        else {
          // swimmers: a little way under the surface / above the sand, nudged into open water
          const base = L.kind === 'float' ? W.sea + 16 : Math.min(L.y - 14, W.sea + 30);
          for (let k = 0; k < 20; k++) { x = L.x + R.range(-18, 18); y = base + R.range(-6, 10); if (W.water(x, y) && W.water(x, y - 4) && W.water(x, y + 4)) break; }
          if (!W.water(x, y)) { x = L.x; y = W.sea + 12; }
        }
        const cr = AQ.Creatures.spawnAt(def, x, y);
        cr.landing = L.id; cr.alpha = 0; cr.cap = 1;
        cr.onRemove = (c) => { if (!c.fadedOut) { const LL = byId(c.landing); if (LL && LL.want[c.def.id] > 0) LL.want[c.def.id]--; AQ.Save && AQ.Save.dirty(); } };
      }
    }
  }
  const byId = (id) => st().landings.find((L) => L.id === id);
  const creaturesOf = (L) => AQ.Creatures.list.filter((c) => c.landing === L.id);

  // ---------------------------------------------------------------- update
  SF.init = function () {
    const s = st();
    s.landings = (s.landings || []).filter((L) => L.left > 0);
    s.landings.forEach((L) => { if (!L.landed) L.landed = true; spawn(L); });
    if (s.phase == null) s.phase = AQ.Clock.phase();
  };
  // runs whenever the clock runs (play, map, aquarium), in every scene
  SF.update = function (dt, game) {
    const s = st(), c = cfg(), phase = AQ.Clock.phase();
    SF.t += dt;
    // a new evening: count the night and make its plan
    if (EVENING(phase) && !EVENING(s.phase)) {
      s.night++;
      s.plan = makePlan(s.night);
      AQ.Save && AQ.Save.dirty();
    }
    s.phase = phase;
    const plan = s.plan;
    if (plan && plan.shower && !plan.announced && EVENING(phase)) {
      plan.announced = true;
      tell('The sky is full of falling stars tonight', game);
      if (AQ.Music) AQ.Music.stinger('shower');
    }
    // stars fall at their time in the night (time skipped past the night: those stars just don't fall)
    if (plan) {
      const p = nightProgress();
      for (const f of plan.falls) {
        if (f.done) continue;
        if (p >= 0 && p >= f.p) { f.done = true; SF.fall(game, { shower: plan.shower }); }
        else if (phase === 'dawn' || phase === 'day') f.done = true;
      }
    }
    // stars queued by the testing shower key
    for (let i = SF.queue.length - 1; i >= 0; i--) if (SF.t >= SF.queue[i]) { SF.queue.splice(i, 1); SF.fall(game, { shower: true }); }
    // the falling streaks touch down
    for (let i = SF.falls.length - 1; i >= 0; i--) {
      const f = SF.falls[i]; f.t += dt;
      if (f.t >= f.dur) { SF.falls.splice(i, 1); if (!f.L.landed) land(f.L, game); }
    }
    if (game.scene !== 'world' || game.state === 'aquarium') for (const f of SF.falls.splice(0)) if (!f.L.landed) land(f.L, game);
    // landings wait, then fade; caught-empty ones end early
    for (let i = s.landings.length - 1; i >= 0; i--) {
      const L = s.landings[i];
      if (!L.landed) continue;
      L.left -= dt;
      const cap = U.clamp(L.left / c.fadeSeconds, 0, 1), list = creaturesOf(L);
      list.forEach((cr) => { cr.cap = cap; });
      if (L.left <= 0 || wantCount(L) <= 0) {
        list.forEach((cr) => { cr.fadedOut = true; AQ.Creatures.remove(cr); });
        s.landings.splice(i, 1);
        AQ.Save && AQ.Save.dirty();
      } else if (game.scene === 'world' && R.chance(dt * 2)) {
        // a soft twinkle round the waiting creatures
        const cr = R.pick(list); if (cr && cr.alpha > 0.3) AQ.FX.sparkle(cr.x + R.range(-5, 5), cr.y + R.range(-5, 5), '#e8f0ff', 1);
      }
    }
  };

  // ---------------------------------------------------------------- drawing (world, after lighting)
  SF.draw = function (ctx, game) {
    if (game.scene !== 'world') return;
    const s = st(), c = cfg(), cam = AQ.Camera, l = cam.left(), t = cam.top(), W = AQ.World;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // light columns over waiting landings: soft, tall, gently breathing, fading with the creatures
    const col = U.hex(c.column.color);
    for (const L of s.landings) {
      if (!L.landed || wantCount(L) <= 0) continue;
      const fade = U.clamp(L.left / c.fadeSeconds, 0, 1), x = L.x - l, base = (L.kind === 'float' ? W.sea : L.y) - t;
      if (x < -40 || x > 360) continue;
      const a = c.column.alpha * fade * (0.8 + 0.2 * Math.sin(SF.t * 1.6 + L.x)), hgt = c.column.height;
      const gr = ctx.createLinearGradient(0, base, 0, base - hgt);
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      ctx.fillStyle = gr;
      const w = c.column.width;
      ctx.fillRect(Math.round(x - w / 2), base - hgt, w, hgt);
      ctx.fillRect(Math.round(x - 1), base - hgt * 1.2, 2, hgt * 1.2);                 // a brighter core
      // motes drifting up the column
      for (let k = 0; k < 6; k++) { const yy = base - ((SF.t * 18 + k * 43 + L.x) % hgt); ctx.fillStyle = `rgba(255,255,255,${(a * 2 * (1 - (base - yy) / hgt)).toFixed(3)})`; ctx.fillRect(Math.round(x + Math.sin(SF.t + k) * 2), Math.round(yy), 1, 1); }
    }
    ctx.restore();
    // falling streaks: a bright head with a long trail, from the sky down to the spot
    for (const f of SF.falls) {
      const k = Math.min(1, f.t / f.dur), e = k * (0.6 + 0.4 * k), hx = f.x0 + (f.x1 - f.x0) * e, hy = f.y0 + (f.y1 - f.y0) * e;
      const dx = f.x1 - f.x0, dy = f.y1 - f.y0, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      for (let i = 0; i < 34; i++) {
        ctx.fillStyle = `rgba(255,246,220,${(0.95 * (1 - i / 34)).toFixed(3)})`;
        ctx.fillRect(Math.round(hx - ux * i - l), Math.round(hy - uy * i - t), 1, 1);
      }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(hx - l) - 1, Math.round(hy - t), 3, 1); ctx.fillRect(Math.round(hx - l), Math.round(hy - t) - 1, 1, 3);
    }
  };
  // light for the lighting pass, so a landing glows in the dark sea
  SF.lights = function (Ls) {
    for (const L of st().landings) if (L.landed && wantCount(L) > 0) Ls.push({ x: L.x, y: (L.kind === 'float' ? AQ.World.sea : L.y) - 6, r: 34, color: '#d8e4ff', power: 0.55 * U.clamp(L.left / cfg().fadeSeconds, 0, 1) });
  };
  // map (M): a sparkling star at each waiting landing
  SF.drawMap = function (g, ox, oy, S, time) {
    for (const L of SF.waiting()) {
      const x = Math.round(ox + L.x / S), y = Math.round(oy + (L.kind === 'float' ? AQ.World.sea : L.y) / S), on = Math.floor(time * 3 + L.x) % 2;
      g.fillStyle = 'rgba(4,12,24,0.8)'; g.fillRect(x - 3, y + 1, 7, 1); g.fillRect(x + 1, y - 2, 1, 7);
      g.fillStyle = on ? '#ffffff' : '#d8e4ff';
      g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7); g.fillRect(x - 1, y - 1, 3, 3);
      if (on) { g.fillStyle = '#fff3b0'; g.fillRect(x, y, 1, 1); }
    }
  };
  // HUD, by the moon: a little star while something waits; a sparkle on meteor-shower nights
  SF.drawHud = function (ctx, x, y, time) {
    let cx = x;
    if (SF.waiting().length) {
      const c = Math.floor(time * 2) % 2 ? '#fff6dc' : '#d8e4ff';
      ctx.fillStyle = 'rgba(4,12,24,0.75)'; ctx.fillRect(cx + 1, y + 3, 5, 1); ctx.fillRect(cx + 3, y + 1, 1, 5);
      ctx.fillStyle = c; ctx.fillRect(cx, y + 2, 5, 1); ctx.fillRect(cx + 2, y, 1, 5); ctx.fillRect(cx + 1, y + 1, 3, 3);
      cx -= 8;
    }
    if (SF.showerTonight()) {
      const tw = Math.floor(time * 3) % 3;
      ctx.fillStyle = '#fff3b0';
      ctx.fillRect(cx + 2, y + (tw === 0 ? 0 : 1), 1, 1); ctx.fillRect(cx, y + 4, 1, 1); ctx.fillRect(cx + 4, y + 3 + (tw === 1 ? 1 : 0), 1, 1);
      if (tw === 2) { ctx.fillRect(cx + 1, y + 2, 1, 1); ctx.fillRect(cx + 3, y + 2, 1, 1); }
    }
  };
  return SF;
})();
