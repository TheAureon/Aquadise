// Home aquarium: one tank per biome. Arrange decorations + harvested plants, watch creatures idle
// (swim / feed / play / rest). Predators stress smaller prey sharing their tank (no harm done).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Aquarium = (function () {
  const U = AQ.U, R = U.R, F = () => AQ.Font;
  const A = { biome: null, fish: [], food: [], bubbles: [], holding: null, tray: 'decor', trayScroll: 0, trayPos: 0, t: 0, hover: null, ui: [],
    photo: { on: false, paused: false, icons: true, frame: null, caption: false, flash: 0, preview: null, previewT: 0, ui: [] } };
  const TANK = { x: 4, y: 16, w: 312, h: 130, waterTop: 22, sandTop: 126, bottom: 145 };
  const SIZE_RANK = { tiny: 0, small: 1, medium: 2, mediumlong: 2, wide: 2, tall: 2, large: 3, widelarge: 3, huge: 4 };
  const TRAY_Y = 149, CELL = 26;

  const styleOf = (id) => Object.assign({}, AQ.data.tankStyles.default, AQ.data.tankStyles[id] || {});
  const defOf = (id) => AQ.Creatures.defs[id] || AQ.data.creatures.find((d) => d.id === id);
  const decorDef = (id) => AQ.data.decorations.find((d) => d.id === id);
  // every tank (biome tanks + predator tanks) in building order; Q/E steps through this list
  const biomes = () => AQ.Tanks.list();

  // ---------------------------------------------------------------- open / close
  A.open = function (game, from, biome) {
    A.returnTo = from || 'play';
    game.state = 'aquarium';
    if (biome) { if (A.biome !== biome) A.fish = []; A.biome = biome; }
    if (!A.biome) {
      const here = game.scene === 'world' ? AQ.World.biomeAt(game.player.x, game.player.y).id : 'tide_pools';
      A.biome = here;
    }
    A.prevState = 'play';
    A.undo = []; A.notes = []; A.view = 'tank';
    A.shaker = null; A.card = null; A.clearArm = 0; A.courtC = null; A.holding = null;
    A.photo.on = false; A.photo.paused = false; A.photo.previewT = 0;   // always arrive in the normal view
    AQ.FX.list.length = 0;
    A.rebuild();
    AQ.Audio.music('aquarium');
  };
  A.close = function (game) {
    putBack();
    AQ.FX.list.length = 0;
    if (A.returnTo === 'title') { AQ.Save && AQ.Save.save(game); AQ.Title.open(game); return; }
    game.state = 'play';
    AQ.Save && AQ.Save.save(game);
  };

  A.refreshVibe = function () {
    const before = A.vibe && A.vibeOf === A.biome ? A.vibe.stars : null;
    A.vibe = AQ.Vibe.evaluate(A.biome); A.vibeOf = A.biome;
    if (before != null && Math.floor(A.vibe.stars) > Math.floor(before)) AQ.Audio.play('star');   // a whole new star
    A.vibeT = AQ.TUNING.aquarium.recomputeEvery;
    A.fish.forEach(updateMood);
    A.fish.forEach(setAge);
    A.courtPair = new Set(AQ.Breeding.courting(AQ.Collection.tank(A.biome)) || []);
    AQ.Vibe.recordBest(A.biome, A.vibe.stars).forEach(celebrate);
  };

  // ---------------------------------------------------------------- likes + mood
  // Where a placed decor/plant visibly sits: centre x, top y, half width (from the sprite's visible bounds).
  function geo(d) {
    const e = AQ.Assets.entry((d.type === 'plant' ? 'plant.' : 'decor.') + d.id);
    const floating = d.y < TANK.sandTop;
    if (!e) return { d, cx: d.x, top: d.y - 10, half: 5, h: 10, floating };
    const v = e.vis || [0, 0, e.fw - 1, e.fh - 1];
    let off = (v[0] + v[2] + 1) / 2 - e.anchor[0];
    if (d.flip) off = -off;
    return { d, cx: d.x + off, top: d.y - e.anchor[1] + v[1], half: (v[2] - v[0] + 1) / 2, h: v[3] - v[1] + 1, floating };
  }
  const live = (g) => !!g && AQ.Collection.tank(A.biome).decor.indexOf(g.d) >= 0;
  // Placed things carrying a tag that this creature can reach (crawlers can't reach floating things).
  function withTag(tag, f) {
    return AQ.Collection.tank(A.biome).decor.filter((d) => AQ.Vibe.tagsOf(d).indexOf(tag) >= 0).map(geo).filter((g) => f.loco === 'swim' || !g.floating);
  }
  // Placed things this creature likes, as spots it can go and hang around.
  function likedSpots(f) {
    const likes = f.def.likes || [];
    if (!likes.length) return [];
    const out = [];
    AQ.Collection.tank(A.biome).decor.forEach((d) => {
      const tags = AQ.Vibe.tagsOf(d), tag = likes.find((l) => tags.indexOf(l) >= 0);
      if (!tag) return;
      const g = geo(d);
      if (f.loco !== 'swim' && g.floating) return;
      out.push(Object.assign(g, { tag, x: g.cx, y: g.floating ? d.y + 6 : d.y - Math.min(g.h * 0.6, 40) }));
    });
    return out;
  }
  const MOODS = [[0.85, 'DELIGHTED', '#ff9fc0'], [0.65, 'HAPPY', '#ffe27a'], [0.45, 'CONTENT', '#bfe8ff'], [0.3, 'UNEASY', '#c8c0d8'], [-1, 'NERVOUS', '#9fd8ff']];
  function updateMood(f) {
    const cfg = AQ.TUNING.aquarium, mc = cfg.mood, tank = AQ.Collection.tank(A.biome);
    const spots = likedSpots(f);
    f.near = spots.find((s) => Math.abs(s.x - f.x) < cfg.likeRadius + s.half && (f.loco !== 'swim' || Math.abs(s.y - f.y) < cfg.likeRadius + 10)) || null;
    let m = mc.base + mc.fed * AQ.Vibe.fedLevel(tank);
    if (!(f.def.likes || []).length || spots.length) m += mc.likePresent;
    if (f.near) m += mc.nearLike;
    if (tank.creatures.length > cfg.comfortable) m -= mc.crowded;
    if (f.stress) m = Math.min(m, mc.stressedCap);
    f.mood = U.clamp(m, 0, 1);
    const row = MOODS.find((r) => f.mood >= r[0]);
    f.moodName = row[1]; f.moodCol = row[2];
  }
  // A tank reached a new happiness milestone: a burst of sparkles and a new decoration.
  function celebrate(dd) {
    A.fresh = A.fresh || {}; A.fresh[dd.id] = true;
    note(`New decoration unlocked: ${dd.name}!`, '#ffe08a', 5);
    for (let i = 0; i < 9; i++) AQ.FX.sparkle(R.range(30, 290), R.range(40, 110), i % 2 ? '#fff3b0' : '#ffd25a', 6);
    for (let i = 0; i < 5; i++) AQ.FX.sparkle(88 + i * 8, 6, '#fff3b0', 4);
    A.tray = 'decor'; A.trayScroll = 0; A.trayPos = 0;
    AQ.Audio.play('unlock');
    AQ.Audio.play('fanfare', { delay: 0.6 });
    if (AQ.Music) AQ.Music.stinger('reward');
  }
  A.moodOf = (f) => ({ name: f.moodName, color: f.moodCol, value: f.mood });

  // babies use the smaller, lighter juvenile sheet until they've grown up
  function footOfKey(key, fallback) { const en = AQ.Assets.entry(key); return en && en.vis ? en.vis[3] - en.anchor[1] + 1 : fallback; }
  function setAge(f) {
    const juv = AQ.Breeding.isJuvenile(f.entry);
    if (juv === f.juv) return;
    f.juv = juv;
    const babyKey = AQ.Sex.babyKey(f.def, f.variant);
    f.key = juv && babyKey ? babyKey : AQ.Sex.spriteKey(f.def, f.sex, f.variant);
    f.r = juv ? Math.max(3, Math.round(f.adultR * 0.6)) : f.adultR;
    f.foot = footOfKey(f.key, AQ.Creatures.footOf(f.def));
    if (f.loco !== 'swim') f.y = f.z - f.foot;
  }

  A.rebuild = function () {
    const tank = AQ.Collection.tank(A.biome);
    const old = new Map(A.fish.map((f) => [f.uid, f]));
    A.fish = tank.creatures.map((e) => old.get(e.uid) || makeFish(e));
    A.food = [];
    computeStress();
    A.refreshVibe();
  };

  function makeFish(e) {
    const def = defOf(e.id);
    const loco = def.tank || (def.category === 'crustacean' || def.category === 'gastropod' ? 'crawl' : 'swim');
    const r = AQ.Creatures.spriteR(def);
    const f = {
      uid: e.uid, def, loco, r, key: AQ.Sex.spriteKey(def, e.sex, e.variant), sex: e.sex || null, variant: !!e.variant,
      x: R.range(30, 290), y: loco === 'swim' ? R.range(40, 110) : 0, vx: 0, vy: 0, facing: R.chance(0.5) ? 1 : -1,
      z: R.range(TANK.sandTop + 2, TANK.bottom), state: 'swim', st: R.range(1, 4), t: R.range(0, 9), stress: false, target: null
    };
    f.foot = AQ.Creatures.footOf(def);
    f.adultR = r; f.entry = e;
    setAge(f);
    const cfg = AQ.TUNING.aquarium;
    f.moodPh = R.range(0, cfg.moodIconEvery); f.fxT = R.range(0, 1);
    f.pace = R.range(cfg.pace[0], cfg.pace[1]); f.bubT = R.range(1, cfg.bubbleEvery); f.lift = 0; f.side = R.chance(0.5) ? 1 : -1;
    if (loco !== 'swim') f.y = f.z - f.foot;
    return f;
  }

  // nervous = the tank is crowded (see AQ.Vibe.stressedIds); nervous creatures hide for a while
  function computeStress() {
    const nervous = AQ.Vibe.stressedIds(AQ.Collection.tank(A.biome).creatures);
    A.fish.forEach((f) => {
      const was = f.stress;
      f.stress = nervous.has(f.uid);
      if (f.stress && !was) { f.state = 'hide'; f.st = 0; f.hideX = R.chance(0.5) ? 18 : 302; }
      if (!f.stress && was) { f.state = 'swim'; f.st = 1; }
    });
  }

  // ---------------------------------------------------------------- simulation
  function steer(f, tx, ty, speed, dt, k = 3) {
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
    const kk = 1 - Math.exp(-k * dt);
    f.vx += ((dx / d) * speed - f.vx) * kk; f.vy += ((dy / d) * speed - f.vy) * kk;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (Math.abs(f.vx) > 1.5) f.facing = f.vx > 0 ? 1 : -1;
    return d < 4;
  }
  function clampFish(f) {
    f.x = U.clamp(f.x, TANK.x + 8, TANK.x + TANK.w - 8);
    if (f.loco === 'swim') f.y = U.clamp(f.y, TANK.waterTop + 6, TANK.sandTop - 2);
    else f.y = U.lerp(f.z - f.foot, (f.perchTop || f.z) - f.foot, f.lift || 0);
  }
  function pickActivity(f) {
    const w = AQ.TUNING.aquarium.activity, keys = Object.keys(w);
    let r = R() * keys.reduce((a, k) => a + w[k], 0);
    for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
    return 'swim';
  }
  // The first-caught member of a species leads; the others school behind it.
  function leaderOf(f) {
    const mates = A.fish.filter((o) => o.def.id === f.def.id && o.loco === 'swim' && !o.stress);
    if (mates.length < 2) return null;
    const lead = mates.reduce((a, b) => (a.uid < b.uid ? a : b));
    if (lead === f) return null;
    const i = mates.filter((o) => o !== lead).indexOf(f);
    f.schoolOff = [8 + (i >> 1) * 7 + R.range(0, 3), (i % 2 ? 1 : -1) * (3 + (i >> 1) * 2)];
    return lead;
  }
  function nextState(f) {
    const cfg = AQ.TUNING.aquarium;
    f.target = null; f.buddy = null; f.spot = null; f.leader = null; f.perch = null; f.graze = null; f.shelter = null;
    if (f.stress) {
      // nervous: duck into a hideout if there is one, otherwise a quiet corner
      const hs = withTag('hideout', f);
      f.state = 'hide'; f.st = R.range(4, 8); f.shelter = hs.length ? R.pick(hs) : null;
      return;
    }
    if (f.loco === 'still') { f.state = R.chance(0.3) ? 'sleep' : 'rest'; f.st = R.range(5, 10); return; }
    // sometimes go hang out near something it likes
    const spots = likedSpots(f);
    if (spots.length && R.chance(cfg.visitChance)) {
      f.spot = R.pick(spots); f.state = 'visit'; f.st = 12;
      f.spotOff = R.chance(0.5) ? -1 : 1;
      return;
    }
    f.state = pickActivity(f);
    f.st = R.range(3, 7);
    switch (f.state) {
      case 'swim':
        if (f.loco === 'swim' && R.chance(cfg.schoolChance)) f.leader = leaderOf(f);
        break;
      case 'feed': {
        const plants = withTag('plant', f);
        if (plants.length && R.chance(cfg.grazeChance)) { f.graze = R.pick(plants); f.st = R.range(4, 8); }
        break;
      }
      case 'play':
        if (f.loco === 'swim') {
          const others = A.fish.filter((o) => o !== f && o.loco === 'swim');
          f.buddy = others.length && R.chance(0.6) ? R.pick(others) : null;
          f.loopC = [f.x, f.y]; f.loopA = 0;
        }
        break;
      case 'rest': {
        const perches = withTag('perch', f).filter((g) => !g.floating && g.half * 2 >= f.r && !A.fish.some((o) => o.perch && o.perch.d === g.d));
        if (perches.length && R.chance(cfg.perchChance)) { f.perch = R.pick(perches); f.st = R.range(5, 10); }
        break;
      }
      case 'shelter': {
        const hs = withTag('hideout', f);
        if (hs.length) f.shelter = R.pick(hs); else f.state = 'drift';
        break;
      }
      case 'sleep': f.st = R.range(cfg.sleepSeconds[0], cfg.sleepSeconds[1]); break;
    }
  }

  // Ease into a resting spot (instead of overshooting and circling like steer would).
  function settle(f, tx, ty, speed, dt) {
    if (Math.hypot(tx - f.x, ty - f.y) > 5) { steer(f, tx, ty, speed, dt, 3); return false; }
    const k = 1 - Math.exp(-3 * dt);
    f.x += (tx - f.x) * k; f.y += (ty - f.y) * k; f.vx *= 1 - k; f.vy *= 1 - k;
    return true;
  }
  // Tuck in behind a hideout, peeking out now and then.
  function goShelter(f, s, dt) {
    const peek = Math.sin(f.t * 0.6 + f.moodPh) * s.half * 0.7;
    if (f.loco === 'swim') {
      const ty = U.clamp(s.top + s.h * 0.6, TANK.waterTop + 8, TANK.sandTop - 3);
      settle(f, s.cx + peek, ty, 22 * f.pace, dt);
      if (Math.abs(f.x - s.cx) < s.half) { f.zDraw = s.d.y - 0.5; if (Math.abs(f.vx) > 1) f.facing = f.vx > 0 ? 1 : -1; }
    } else if (f.loco === 'crawl') {
      walk(f, s.cx + peek, 10 * f.pace, dt);
      if (Math.abs(f.x - s.cx) < s.half) { f.z += U.clamp(s.d.y - 1 - f.z, -6 * dt, 6 * dt); f.zDraw = s.d.y - 0.5; }
    }
  }
  function eat(f, food) {
    A.food.splice(A.food.indexOf(food), 1);
    f.chomp = AQ.TUNING.aquarium.chompSeconds;
    AQ.FX.sparkle(food.x, food.y, '#d9a066', 3);          // crumbs
    if (R.chance(0.5)) heart(f);
    markFed();
  }

  function updateFish(f, dt) {
    const cfg = AQ.TUNING.aquarium;
    f.t += dt; f.st -= dt; f.zDraw = null;
    if (f.chomp > 0) f.chomp -= dt;
    // a little breath bubble now and then
    f.bubT -= dt;
    if (f.bubT <= 0) {
      f.bubT = cfg.bubbleEvery * R.range(0.5, 1.5);
      if (f.state !== 'hide') for (let i = 0, n = R.chance(0.3) ? 2 : 1; i < n; i++) A.bubbles.push({ x: f.x + f.facing * f.r * 0.5, y: f.y - f.r * 0.3 - i * 3, vy: -R.range(12, 18), p: R() * 6 });
    }
    // food overrides everything except stress: everyone gathers round
    const food = !f.stress && A.food.length ? A.food.reduce((a, b) => (Math.hypot(a.x - f.x, a.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y) ? a : b)) : null;
    if (food && f.loco !== 'still') {
      if (f.state === 'sleep' || f.state === 'rest') { f.state = 'swim'; f.st = 2; f.leader = null; }
      let got;
      if (f.loco === 'swim') got = steer(f, food.x, U.clamp(food.y, TANK.waterTop + 4, TANK.sandTop), 34 * f.pace, dt, 4) || Math.hypot(food.x - f.x, food.y - f.y) < 5;
      else { walk(f, food.x, 18 * f.pace, dt); got = food.y > TANK.sandTop - 6 && Math.abs(food.x - f.x) < 4; }
      if (got && food.y > TANK.waterTop) eat(f, food);
      clampFish(f); return;
    }
    if (food && f.loco === 'still' && Math.abs(food.x - f.x) < 8 && food.y > TANK.sandTop - 6) eat(f, food);
    // courting: the pair swims (or walks) together in a slow loop, with hearts
    if (A.courtPair && A.courtPair.has(f.uid) && !f.stress && f.loco !== 'still') {
      const mate = A.fish.find((o) => o !== f && A.courtPair.has(o.uid));
      if (mate) {
        f.state = 'court'; f.st = 1; f.hop = 0;
        if (!A.courtC) A.courtC = [U.clamp((f.x + mate.x) / 2, 70, 250), U.clamp((f.y + mate.y) / 2, 50, 100)];
        const first = f.uid < mate.uid, ang = A.t * 1.1 + (first ? 0 : Math.PI);
        if (f.loco === 'swim') steer(f, A.courtC[0] + Math.cos(ang) * 16, A.courtC[1] + Math.sin(ang * 2) * 6, (Math.hypot(f.x - A.courtC[0], f.y - A.courtC[1]) > 30 ? 30 : 18) * f.pace, dt, 3);
        else { walk(f, A.courtC[0] + (first ? -6 : 6), 8, dt); if (Math.abs(f.x - A.courtC[0]) < 9) { f.facing = first ? 1 : -1; f.hop = Math.max(0, Math.sin(f.t * 6)) * 1.5; } }
        f.fxT -= dt;
        if (first && f.fxT <= 0) { f.fxT = 1.3; AQ.FX.text((f.x + mate.x) / 2, Math.min(f.y, mate.y) - Math.max(f.r, mate.r) - 3, '♥', '#ff9fc0'); AQ.Audio.play('court'); }
        clampFish(f); return;
      }
    }
    if (f.state === 'court') { f.state = 'swim'; f.st = 0; A.courtC = null; }
    if (f.st <= 0) nextState(f);
    if (f.state !== 'enjoy') f.hop = 0;
    if (!(f.state === 'rest' && f.perch)) f.lift = Math.max(0, (f.lift || 0) - dt * 3);
    const sp = (f.loco === 'still' ? 0 : f.loco === 'crawl' ? 8 : 16) * f.pace;
    switch (f.state) {
      case 'hide': {
        if (live(f.shelter)) goShelter(f, f.shelter, dt);
        else {
          // no hideout: cower in a corner
          const hx = f.hideX || 18;
          if (f.loco === 'swim') steer(f, hx, TANK.sandTop - 8, 24, dt, 4); else walk(f, hx, 14, dt);
        }
        f.shake = Math.sin(f.t * 40) > 0 ? 1 : 0;
        break;
      }
      case 'swim':
        if (f.loco === 'swim') {
          const ld = f.leader;
          if (ld && A.fish.includes(ld) && !ld.stress) steer(f, ld.x - ld.facing * f.schoolOff[0], U.clamp(ld.y + f.schoolOff[1], TANK.waterTop + 8, TANK.sandTop - 4), Math.max(20, Math.hypot(ld.vx, ld.vy) * 1.1), dt, 3);
          else if (!f.target || steer(f, f.target[0], f.target[1], sp, dt, 2)) f.target = [R.range(20, 300), R.range(32, 118)];
        } else if (f.loco === 'crawl') { if (!f.target || walk(f, f.target[0], sp, dt)) f.target = [R.range(20, 300)]; }
        break;
      case 'feed':
        if (live(f.graze)) {
          // graze on a plant: nibble at its leaves, dropping the odd green crumb
          const g = f.graze;
          const there = f.loco === 'swim'
            ? settle(f, g.cx + f.side * (g.half + 2), U.clamp(g.top + g.h * 0.45, TANK.waterTop + 8, TANK.sandTop - 4), sp * 1.2, dt)
            : walk(f, g.cx + f.side * g.half * 0.6, sp, dt);
          if (there) {
            f.facing = g.cx > f.x ? 1 : -1;
            f.peck = Math.sin(f.t * 10) > 0.6 ? 1 : 0;
            if (R.chance(dt * 1.2)) AQ.FX.sparkle(f.x + f.facing * f.r * 0.6, f.y, '#9fe08a', 2);
          }
        } else if (f.loco === 'swim') { if (!f.target) f.target = [R.range(24, 296), TANK.sandTop - 4]; if (steer(f, f.target[0], f.target[1], sp, dt, 3)) { f.vy = Math.sin(f.t * 12) * 6; } }
        else f.peck = Math.sin(f.t * 10) > 0.6 ? 1 : 0;
        break;
      case 'play':
        if (f.loco === 'swim') {
          if (f.buddy && A.fish.includes(f.buddy)) steer(f, f.buddy.x - f.buddy.facing * 10, f.buddy.y, 30 * f.pace, dt, 4);
          else { f.loopA += dt * 2.6; steer(f, f.loopC[0] + Math.cos(f.loopA) * 18, U.clamp(f.loopC[1] + Math.sin(f.loopA) * 12, 34, 116), 34 * f.pace, dt, 6); }
        } else if (f.loco === 'crawl') { if (!f.target || walk(f, f.target[0], 26 * f.pace, dt)) f.target = [U.clamp(f.x + R.range(-30, 30), 20, 300)]; }
        break;
      case 'rest':
        if (live(f.perch)) {
          // rest on top of a rock / log
          const p = f.perch;
          if (f.loco === 'swim') {
            if (settle(f, p.cx, p.top - f.foot + 1, Math.max(8, sp), dt)) f.zDraw = p.d.y + 0.5;
          } else if (f.lift > 0 || walk(f, p.cx, sp, dt)) {
            f.perchTop = p.top + 1; f.lift = Math.min(1, (f.lift || 0) + dt * 2.5);
            f.z += U.clamp(p.d.y + 1 - f.z, -6 * dt, 6 * dt); f.zDraw = p.d.y + 0.5;
          }
        } else if (f.loco === 'swim') steer(f, f.x + Math.sin(f.t) * 2, f.y + Math.cos(f.t * 0.7), 3, dt, 1);
        break;
      case 'shelter':
        if (live(f.shelter)) goShelter(f, f.shelter, dt); else f.st = 0;
        break;
      case 'sleep':
        // drift down near the sand and doze
        if (f.loco === 'swim') settle(f, f.x, TANK.sandTop - f.foot - 3, 6, dt);
        break;
      case 'drift':
        if (f.loco === 'swim') {
          // go limp and let the gentle tank current carry it
          f.vx += (Math.sin(A.t * 0.25 + f.moodPh) * 6 - f.vx) * dt; f.vy += (Math.sin(f.t * 0.8) * 2 - f.vy) * dt;
          f.x += f.vx * dt; f.y += f.vy * dt;
        }
        break;
      case 'visit': {
        // head over to a liked thing, then switch to the happy "enjoy" idle
        const s = f.spot;
        if (!live(s)) { f.st = 0; break; }
        const tx = U.clamp(s.x + f.spotOff * (s.half + 3), 16, 304);
        const got = f.loco === 'swim' ? steer(f, tx, U.clamp(s.y, TANK.waterTop + 8, TANK.sandTop - 4), 20 * f.pace, dt, 3) : walk(f, tx, sp * 1.2, dt);
        if (got) { f.state = 'enjoy'; f.st = R.range(...cfg.enjoySeconds); f.loopA = 0; f.fxT = 0.3; updateMood(f); }
        break;
      }
      case 'enjoy': {
        const s = f.spot;
        if (!live(s)) { f.st = 0; break; }
        if (f.loco === 'swim') {
          // lazy figure-eight around the liked thing
          f.loopA += dt * 1.4;
          steer(f, s.x + Math.sin(f.loopA) * (s.half + 6), U.clamp(s.y + Math.sin(f.loopA * 2) * 4, TANK.waterTop + 8, TANK.sandTop - 4), 14, dt, 3);
        } else {
          // happy little hops, turning to face the liked thing
          f.hop = Math.max(0, Math.sin(f.t * 7)) * 2 * (Math.sin(f.t * 1.3) > 0 ? 1 : 0);
          f.facing = s.x > f.x ? 1 : -1;
        }
        f.fxT -= dt;
        if (f.fxT <= 0) {
          f.fxT = cfg.happyFxEvery * R.range(0.8, 1.2);
          if (R.chance(0.5)) heart(f); else AQ.FX.sparkle(f.x, f.y - f.r, '#fff3b0', 3);
        }
        break;
      }
    }
    clampFish(f);
  }
  function walk(f, tx, speed, dt) {
    if (f.lift > 0.02) { f.lift = Math.max(0, f.lift - dt * 3); return false; }   // hop down off a perch first
    const dx = tx - f.x;
    if (Math.abs(dx) < 2) return true;
    f.x += Math.sign(dx) * speed * dt; f.facing = dx > 0 ? 1 : -1; f.walking = true;
    return false;
  }
  function markFed() { AQ.Collection.tank(A.biome).lastFed = Date.now(); AQ.Save && AQ.Save.dirty(); }
  function heart(f) { AQ.FX.text(f.x, f.y - f.r - 3, '♥', '#ff9fc0'); AQ.Audio.play('hearts', { vol: 0.7 }); }

  // ---------------------------------------------------------------- UI layout + input
  function layout() {
    const ui = [];
    ui.push({ id: 'prev', x: 2, y: 2, w: 9, h: 10, label: '<' });
    ui.push({ id: 'next', x: 72, y: 2, w: 9, h: 10, label: '>' });
    ui.push({ id: 'stars', x: 84, y: 2, w: 40, h: 10, label: '' });
    ui.push({ id: 'photo', x: 147, y: 2, w: 26, h: 10, label: 'PHOTO' });
    ui.push({ id: 'tanks', x: 175, y: 2, w: 27, h: 10, label: 'TANKS' });
    ui.push({ id: 'undo', x: 204, y: 2, w: 22, h: 10, label: 'UNDO', off: !A.undo.length });
    ui.push({ id: 'clear', x: 228, y: 2, w: 26, h: 10, label: A.clearArm > 0 ? 'SURE?' : 'CLEAR', warn: A.clearArm > 0 });
    ui.push({ id: 'feed', x: 256, y: 2, w: 20, h: 10, label: 'FEED' });
    ui.push({ id: 'log', x: 278, y: 2, w: 16, h: 10, label: 'LOG' });
    ui.push({ id: 'back', x: 296, y: 2, w: 22, h: 10, label: A.returnTo === 'title' ? 'HOME' : 'BACK' });
    ui.push({ id: 'tray_decor', x: 4, y: TRAY_Y, w: 34, h: 10, label: 'DECOR', on: A.tray === 'decor' });
    ui.push({ id: 'tray_fish', x: 4, y: TRAY_Y + 11, w: 34, h: 10, label: 'FISH', on: A.tray === 'fish' });
    ui.push({ id: 'tray_left', x: 40, y: TRAY_Y, w: 8, h: 29, label: '<' });
    ui.push({ id: 'tray_right', x: 308, y: TRAY_Y, w: 8, h: 29, label: '>' });
    const items = trayItems();
    const perPage = Math.floor((308 - 50) / CELL);
    A.trayScroll = U.clamp(A.trayScroll, 0, Math.max(0, items.length - perPage));
    // the tray slides: items sit at their place minus the eased scroll, clipped to the strip
    const off = Math.round(A.trayPos * CELL), clip = { x0: 50, x1: 50 + perPage * CELL - 2 };
    items.forEach((it, i) => {
      const x = 50 + i * CELL - off;
      if (x + CELL - 2 > clip.x0 && x < clip.x1) ui.push(Object.assign({ x, y: TRAY_Y, w: CELL - 2, h: 29, clipX: clip }, it));
    });
    return ui;
  }
  function trayItems() {
    const out = [];
    if (A.tray === 'decor') {
      const themes = AQ.Tanks.themesOf(A.biome);
      const rank = (d) => (d.biomes && d.biomes.some((x) => themes.indexOf(x) >= 0) ? 0 : !d.biomes ? 1 : 2);
      AQ.data.decorations.map((d, i) => [d, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
        .forEach(([d]) => {
          // locked pieces: this tank's show as a goal; other biomes' stay hidden until unlocked
          const locked = !AQ.Vibe.isUnlocked(d);
          if (locked && (d.unlock.tank || d.unlock.biome) !== A.biome) return;
          out.push({ id: 'item', kind: 'decor', ref: d.id, key: 'decor.' + d.id, name: d.name, count: Infinity, locked, need: locked ? AQ.Vibe.unlockStars(d) : 0, fresh: !!(A.fresh && A.fresh[d.id]) });
        });
      Object.entries(AQ.State.plants).forEach(([id, n]) => { const d = defOf(id); if (d && n > 0) out.push({ id: 'item', kind: 'plant', ref: id, key: 'plant.' + id, name: d.name, count: n }); });
    } else {
      const tank = AQ.Collection.tank(A.biome);
      const sx = (e) => (e.sex ? ' ' + AQ.Sex.SYMBOL[e.sex] : '');
      const nm = (e) => (e.variant ? '✦ ' : '') + defOf(e.id).name + sx(e);
      tank.creatures.forEach((e) => out.push({ id: 'fish', where: 'tank', uid: e.uid, ref: e.id, sex: e.sex, variant: e.variant, key: AQ.Sex.spriteKey(defOf(e.id), e.sex, e.variant), name: nm(e) }));
      tank.storage.forEach((e) => out.push({ id: 'fish', where: 'storage', uid: e.uid, ref: e.id, sex: e.sex, variant: e.variant, key: AQ.Sex.spriteKey(defOf(e.id), e.sex, e.variant), name: nm(e) }));
    }
    return out;
  }

  const hit = (r, m) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;
  const inTank = (m) => m.x >= TANK.x && m.x < TANK.x + TANK.w && m.y >= TANK.y && m.y < TANK.y + TANK.h;

  function placeY(kind, my, hang) { return kind === 'float' ? TANK.waterTop + 1 + (hang || 0) : U.clamp(Math.round(my), TANK.sandTop + 3, TANK.bottom); }
  // how a held / placed thing sits: floor or float, and how far a floating piece dips in
  function placement(h) {
    if (h.kind === 'decor') { const dd = decorDef(h.id); return { kind: dd.kind || 'floor', hang: dd.hang || 0 }; }
    return { kind: defOf(h.id).params.drift ? 'float' : 'floor', hang: 0 };
  }

  A.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, tank = AQ.Collection.tank(A.biome);
    if (A.photo.on) { updatePhoto(dt, game, tank); return; }
    A.t += dt;
    if (A.view === 'overview') { updateOverview(dt, game); return; }
    if (I.wasPressed('KeyT')) { openOverview(); return; }
    if (I.wasPressed(AQ.TUNING.photo.key)) { enterPhoto(); return; }
    A.ui = layout();
    if (I.wasPressed('Escape') && A.card && !A.holding) A.card = null;
    else if (I.wasPressed('Tab') || (I.wasPressed('Escape') && !A.holding)) { A.close(game); return; }
    if (I.wasPressed('KeyL')) { AQ.LogUI.open(game, 'aquarium'); return; }
    if (I.wasPressed('KeyQ', 'ArrowLeft')) switchTank(-1);
    if (I.wasPressed('KeyE', 'ArrowRight')) switchTank(1);
    if (I.wasPressed('KeyF')) feed();
    if (I.wasPressed('KeyU') || (I.wasPressed('KeyZ') && I.isDown('ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'))) undo(tank);
    else if (I.wasPressed('KeyZ')) cycleLayer(tank);
    if (I.wasPressed('KeyX')) flipIt(tank);
    if (A.clearArm > 0) A.clearArm -= dt;
    for (let i = A.notes.length - 1; i >= 0; i--) if ((A.notes[i].t += dt) > A.notes[i].life) A.notes.splice(i, 1);
    if (m.wheelPx) { A.trayScroll += m.wheelPx / 80; A.trayIdle = 0; }  // ~one item per wheel notch, smooth on trackpads
    else if ((A.trayIdle = (A.trayIdle || 0) + dt) > 0.12) A.trayScroll = Math.round(A.trayScroll);   // then settle on a whole item
    { const k = 1 - Math.exp(-dt * 16); A.trayPos += (A.trayScroll - A.trayPos) * k; if (Math.abs(A.trayScroll - A.trayPos) < 0.02) A.trayPos = A.trayScroll; }
    if ((I.wasPressed('Escape') || m.pressed[2]) && A.holding) { cancelHold(); }

    A.hover = null;
    for (const r of A.ui) if (hit(r, m) && (!r.clipX || (m.x >= r.clipX.x0 && m.x < r.clipX.x1))) A.hover = r;

    if (m.pressed[0]) {
      const r = A.hover;
      if (r) clickUI(r, game, tank);
      else if (inTank(m)) {
        if (A.holding) place(tank, m);
        else {
          // click a creature for its info card; click decor to move it
          const f = fishAt(m);
          A.card = f ? f.uid : null;
          const d = !f && decorAt(tank, m);
          if (d) pickUp(tank, d);
        }
      }
    } else if (m.pressed[2] && !A.holding && inTank(m)) {
      const d = decorAt(tank, m);
      if (d) { removeDecor(tank, d, true); }
    }

    simulate(dt, tank);
  };

  // the tank's life: vibe, creatures, food, bubbles, effects (frozen while a photo is being posed)
  function simulate(dt, tank) {
    A.vibeT -= dt;
    if (A.vibeT <= 0) A.refreshVibe();
    if (tank.creatures.length !== A.fish.length) {
      const before = new Set(A.fish.map((f) => f.uid));
      A.rebuild();
      A.fish.forEach((f) => { if (!before.has(f.uid) && f.entry.bornAt) { f.x = R.range(80, 240); AQ.FX.sparkle(f.x, f.y, '#ffb0d0', 10); } });
    }
    for (const f of A.fish) { f.walking = false; updateFish(f, dt); }
    updateShaker(dt);
    for (let i = A.food.length - 1; i >= 0; i--) {
      const p = A.food[i];
      p.t += dt;
      if (p.y < TANK.sandTop + 2) { p.y += (p.y < TANK.waterTop ? 30 : 12) * dt; p.x += Math.sin(p.t * 3 + p.ph) * 3 * dt; }
      if (p.t > 25) A.food.splice(i, 1);
    }
    // bubbles from bubblers + ambient
    tank.decor.forEach((d) => { const dd = decorDef(d.id); if (d.type === 'decor' && dd && dd.bubbles && R.chance(dt * 4)) { const gm = geo(d); A.bubbles.push({ x: gm.cx + R.range(-1, 1), y: gm.top + 1, vy: -R.range(16, 26), p: R() * 6 }); } });
    if (R.chance(dt * 1.5)) A.bubbles.push({ x: R.range(10, 310), y: TANK.bottom - 2, vy: -R.range(10, 18), p: R() * 6 });
    for (let i = A.bubbles.length - 1; i >= 0; i--) { const b = A.bubbles[i]; b.y += b.vy * dt; b.x += Math.sin(A.t * 4 + b.p) * 4 * dt; if (b.y < TANK.waterTop + 1) A.bubbles.splice(i, 1); }
    AQ.FX.update(dt, { water: () => true });
  }

  function switchTank(dir) {
    const list = biomes();
    const i = list.findIndex((b) => b.id === A.biome);
    putBack();                                   // a carried piece goes back into the tank it came from
    A.biome = list[(i + dir + list.length) % list.length].id;
    A.fish = []; A.shaker = null; A.card = null; A.undo = []; A.clearArm = 0; A.courtC = null; A.rebuild();
  }
  // Feeding: a little shaker tips over the lid and sprinkles pellets as it slides along.
  function feed() {
    if (A.shaker) return;
    const L = AQ.TUNING.aquarium;
    A.shaker = { t: 0, x: R.range(70, 250), dir: R.chance(0.5) ? 1 : -1, dropT: 0.15, left: L.feedPellets };
    AQ.Audio.play('feed');
  }
  function updateShaker(dt) {
    const s = A.shaker; if (!s) return;
    const L = AQ.TUNING.aquarium, dur = L.feedShakeSeconds;
    s.t += dt; s.dropT -= dt;
    s.sx = s.x + s.dir * U.clamp(s.t / dur, 0, 1) * 50;
    if (s.dropT <= 0 && s.left > 0 && s.t > 0.2) {
      s.dropT = dur / L.feedPellets; s.left--;
      A.food.push({ x: s.sx + R.range(-2, 2), y: TANK.waterTop - 2, t: 0, ph: R() * 6 });
    }
    if (s.t > dur + 0.5) A.shaker = null;
  }
  function drawShaker(g) {
    const s = A.shaker; if (!s) return;
    const L = AQ.TUNING.aquarium, k = U.clamp(Math.min(s.t / 0.2, (L.feedShakeSeconds + 0.5 - s.t) / 0.3), 0, 1);
    const x = Math.round(s.sx - 3 + (s.t < L.feedShakeSeconds && Math.sin(s.t * 40) > 0 ? 1 : 0)), y = Math.round(TANK.y - 8 + k * 6);
    // tipped-over can: red cap with holes at the bottom, white body with a label
    g.fillStyle = '#e9f1f4'; g.fillRect(x, y, 7, 6);
    g.fillStyle = '#ff9a5a'; g.fillRect(x, y + 2, 7, 2);
    g.fillStyle = '#c24b4b'; g.fillRect(x - 1, y + 6, 9, 2);
    g.fillStyle = '#2a1a1a'; g.fillRect(x + 1, y + 7, 1, 1); g.fillRect(x + 3, y + 7, 1, 1); g.fillRect(x + 5, y + 7, 1, 1);
    g.fillStyle = '#ffffff'; g.fillRect(x + 1, y, 1, 6);
  }
  function fishAt(m) {
    let best = null, bd = 1e9;
    for (const f of A.fish) {
      const d = Math.hypot(f.x - m.x, f.y - m.y);
      if (Math.abs(f.x - m.x) < f.r + 2 && Math.abs(f.y - m.y) < f.r + 2 && d < bd) { best = f; bd = d; }
    }
    return best;
  }

  function clickUI(r, game, tank) {
    switch (r.id) {
      case 'prev': switchTank(-1); break;
      case 'next': switchTank(1); break;
      case 'feed': feed(); break;
      case 'photo': enterPhoto(); break;
      case 'stars': break;
      case 'undo': undo(tank); break;
      case 'tanks': openOverview(); break;
      case 'clear':
        if (!tank.decor.length) { note('Nothing to clear.', '#cfe8ff'); break; }
        if (A.clearArm > 0) clearTank(tank); else { A.clearArm = 3; note('Click CLEAR again to empty this tank\'s decor.', '#ffcf8a'); }
        break;
      case 'log': AQ.LogUI.open(game, 'aquarium'); break;
      case 'back': A.close(game); break;
      case 'tray_decor': A.tray = 'decor'; A.trayScroll = 0; A.trayPos = 0; break;
      case 'tray_fish': A.tray = 'fish'; A.trayScroll = 0; A.trayPos = 0; break;
      case 'tray_left': A.trayScroll = Math.round(A.trayScroll) - 3; break;
      case 'tray_right': A.trayScroll = Math.round(A.trayScroll) + 3; break;
      case 'item':
        if (r.locked) { note(`Reach ${r.need} stars in this tank to unlock ${r.name}.`, '#ffcf8a'); break; }
        if (A.fresh) delete A.fresh[r.ref];
        if (tank.decor.length >= AQ.TUNING.tank.decorCapacity) { note('This tank is full of decorations.', '#ffd56b'); break; }
        if (A.holding) cancelHold();
        A.holding = { kind: r.kind, id: r.ref, key: r.key };
        break;
      case 'fish': {
        const from = r.where === 'tank' ? tank.creatures : tank.storage, to = r.where === 'tank' ? tank.storage : tank.creatures;
        if (r.where === 'storage' && AQ.Breeding.occupancy(tank) >= AQ.TUNING.tank.capacity) { note((tank.eggs || []).length && tank.creatures.length < AQ.TUNING.tank.capacity ? 'No room: eggs are about to hatch here.' : `Tank full (${AQ.TUNING.tank.capacity}). Move one to storage first.`, '#ffd56b'); break; }
        const i = from.findIndex((e) => e.uid === r.uid);
        if (i >= 0) to.push(from.splice(i, 1)[0]);
        A.rebuild(); AQ.Save && AQ.Save.dirty();
        break;
      }
    }
  }

  function decorAt(tank, m) {
    const sorted = tank.decor.slice().sort((a, b) => zOf(b) - zOf(a));
    for (const d of sorted) {
      const e = AQ.Assets.entry(d.type === 'plant' ? 'plant.' + d.id : 'decor.' + d.id);
      if (!e) continue;
      if (m.x >= d.x - e.fw / 2 && m.x < d.x + e.fw / 2 && m.y >= d.y - e.fh && m.y <= d.y + 1) return d;
    }
    return null;
  }
  // Draw order: back-layer pieces sit behind everything, front-layer pieces in front of everything.
  function zOf(d) { return d.layer === 'back' ? d.y - 1000 : d.layer === 'front' ? d.y + 1000 : d.y; }
  function place(tank, m) {
    const h = A.holding, pl = placement(h);
    // repeat placements keep holding the piece, so the cap is checked here too
    if (!h.fromTank && tank.decor.length >= AQ.TUNING.tank.decorCapacity) { note('This tank is full of decorations.', '#ffd56b'); A.holding = null; return; }
    if (h.kind === 'plant' && !h.fromTank) {
      if (!(AQ.State.plants[h.id] > 0)) { A.holding = null; return; }
      AQ.State.plants[h.id]--;
    }
    const y = placeY(pl.kind, m.y, pl.hang);
    const item = { uid: h.fromTank ? h.orig.uid : AQ.U.uid(), type: h.kind, id: h.id, x: Math.round(U.clamp(m.x, TANK.x + 6, TANK.x + TANK.w - 6)), y };
    if (h.flip) item.flip = true;
    if (h.layer) item.layer = h.layer;
    if (h.fromTank) { tank.decor.splice(Math.min(h.index, tank.decor.length), 0, item); pushUndo({ t: 'move', uid: item.uid, prev: h.orig }); }
    else { tank.decor.push(item); pushUndo({ t: 'add', uid: item.uid }); }
    AQ.FX.puff(m.x, y - 2, 'rgba(240,230,200,0.6)', 4);
    AQ.Audio.play('place');
    // keep holding base decor for quick multi-placement; plants need stock
    if (h.fromTank || (h.kind === 'plant' && !(AQ.State.plants[h.id] > 0))) A.holding = null;
    AQ.Save && AQ.Save.dirty();
  }
  function pickUp(tank, d) {
    const index = tank.decor.indexOf(d);
    tank.decor.splice(index, 1);
    A.holding = { kind: d.type, id: d.id, key: (d.type === 'plant' ? 'plant.' : 'decor.') + d.id, fromTank: true, orig: Object.assign({}, d), index, flip: !!d.flip, layer: d.layer };
  }
  // leaving the tank while carrying a piece puts it back where it was
  function putBack() {
    const h = A.holding;
    if (h && h.fromTank) { const t = AQ.Collection.tank(A.biome); t.decor.splice(Math.min(h.index, t.decor.length), 0, h.orig); A.holding = null; }
    else cancelHold();
  }
  function cancelHold() {
    const h = A.holding;
    if (h && h.fromTank) {
      // dropping a piece picked up from the tank removes it (undo brings it back)
      if (h.kind === 'plant') AQ.State.plants[h.id] = (AQ.State.plants[h.id] || 0) + 1;
      pushUndo({ t: 'del', item: h.orig, index: h.index });
      AQ.Save && AQ.Save.dirty();
    }
    A.holding = null;
  }
  function removeDecor(tank, d) {
    const index = tank.decor.indexOf(d);
    tank.decor.splice(index, 1);
    if (d.type === 'plant') AQ.State.plants[d.id] = (AQ.State.plants[d.id] || 0) + 1;
    pushUndo({ t: 'del', item: Object.assign({}, d), index });
    AQ.FX.puff(d.x, d.y - 3, 'rgba(240,230,200,0.6)', 4);
    AQ.Save && AQ.Save.dirty();
  }
  function clearTank(tank) {
    const items = tank.decor.map((d) => Object.assign({}, d));
    items.forEach((d) => { if (d.type === 'plant') AQ.State.plants[d.id] = (AQ.State.plants[d.id] || 0) + 1; AQ.FX.puff(d.x, d.y - 3, 'rgba(240,230,200,0.6)', 3); });
    tank.decor.length = 0;
    A.clearArm = 0;
    AQ.Audio.play('clear');
    pushUndo({ t: 'clear', items });
    note('Tank cleared. Plants went back to your stock. (UNDO to restore)', '#cfe8ff');
    AQ.Save && AQ.Save.dirty();
  }
  // X: flip the held piece, or the placed piece under the mouse
  function flipIt(tank) {
    if (A.holding) { A.holding.flip = !A.holding.flip; AQ.Audio.play('flip'); return; }
    const d = inTank(AQ.Input.mouse) && decorAt(tank, AQ.Input.mouse);
    if (!d) return;
    pushUndo({ t: 'edit', uid: d.uid, flip: d.flip, layer: d.layer });
    if (d.flip) delete d.flip; else d.flip = true;
    AQ.Audio.play('flip');
    AQ.Save && AQ.Save.dirty();
  }
  // Z: middle -> front -> back -> middle
  const NEXT_LAYER = { undefined: 'front', front: 'back', back: undefined };
  const LAYER_NAME = { undefined: 'MIDDLE', front: 'IN FRONT', back: 'IN BACK' };
  function cycleLayer(tank) {
    let target = A.holding;
    const d = !target && inTank(AQ.Input.mouse) && decorAt(tank, AQ.Input.mouse);
    if (!target && !d) return;
    if (d) { pushUndo({ t: 'edit', uid: d.uid, flip: d.flip, layer: d.layer }); target = d; }
    const nl = NEXT_LAYER[target.layer];
    if (nl) target.layer = nl; else delete target.layer;
    const m = AQ.Input.mouse;
    AQ.FX.text(m.x, m.y - 8, LAYER_NAME[target.layer], '#ffe9a8');
    AQ.Save && AQ.Save.dirty();
  }
  function pushUndo(a) { A.undo.push(a); if (A.undo.length > AQ.TUNING.aquarium.undoSteps) A.undo.shift(); }
  function undo(tank) {
    if (A.holding) { const h = A.holding; A.holding = null; if (h.fromTank) { tank.decor.splice(Math.min(h.index, tank.decor.length), 0, h.orig); return; } }
    const a = A.undo.pop();
    if (!a) { note('Nothing to undo.', '#cfe8ff'); return; }
    AQ.Audio.play('undo');
    const find = (uid) => tank.decor.find((d) => d.uid === uid);
    const takePlant = (d) => { if (d.type !== 'plant') return true; if (!(AQ.State.plants[d.id] > 0)) return false; AQ.State.plants[d.id]--; return true; };
    if (a.t === 'add') {
      const d = find(a.uid);
      if (d) { tank.decor.splice(tank.decor.indexOf(d), 1); if (d.type === 'plant') AQ.State.plants[d.id] = (AQ.State.plants[d.id] || 0) + 1; }
    } else if (a.t === 'move') {
      const d = find(a.uid);
      if (d) { d.x = a.prev.x; d.y = a.prev.y; if (a.prev.flip) d.flip = true; else delete d.flip; if (a.prev.layer) d.layer = a.prev.layer; else delete d.layer; }
    } else if (a.t === 'del') {
      if (takePlant(a.item)) tank.decor.splice(Math.min(a.index, tank.decor.length), 0, Object.assign({}, a.item));
      else note('That plant is already placed somewhere else.', '#ffcf8a');
    } else if (a.t === 'edit') {
      const d = find(a.uid);
      if (d) { if (a.flip) d.flip = true; else delete d.flip; if (a.layer) d.layer = a.layer; else delete d.layer; }
    } else if (a.t === 'clear') {
      a.items.forEach((d) => { if (takePlant(d)) tank.decor.push(Object.assign({}, d)); });
    }
    AQ.Save && AQ.Save.dirty();
  }
  function note(text, color = '#ffffff', life = 3) {
    A.notes = A.notes || [];
    A.notes.push({ text: text.toUpperCase(), color, t: 0, life });
    if (A.notes.length > 2) A.notes.shift();
  }
  A.note = note;

  // ---------------------------------------------------------------- drawing
  A.draw = function (g, game) {
    if (A.view === 'overview') { drawOverview(g); return; }
    const b = AQ.Tanks.get(A.biome), tank = AQ.Collection.tank(A.biome);
    if (A.photo.on) { drawScene(g, b, tank, A.photo.icons); drawPhotoUI(g, b, tank); return; }
    drawScene(g, b, tank, true);
    drawShaker(g);
    A.drawRest(g, b, tank);
  };

  // The tank itself: water, light, decor, creatures, bubbles and the glass frame. No interface, so it
  // is also what a photo captures. icons = mood icons, hearts and sparkles (photo mode can hide them).
  function drawScene(g, b, tank, icons) {
    const st = styleOf(b.id);
    g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, 320, 180);
    g.drawImage(backdrop(b), TANK.x, TANK.y);
    // light shafts from the lid, gently swaying
    g.save();
    for (let i = 0; i < 6; i++) {
      const x = 22 + i * 52 + Math.sin(A.t * 0.35 + i * 1.7) * 8, w = 8 + (i % 3) * 5;
      g.globalAlpha = Math.max(0, st.shafts * (1 + 0.5 * Math.sin(A.t * 0.8 + i)));
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(x, TANK.waterTop); g.lineTo(x + w, TANK.waterTop); g.lineTo(x + w + 26, TANK.sandTop + 6); g.lineTo(x + 18, TANK.sandTop + 6); g.fill();
    }
    g.restore();
    // caustics: shifting light ripples on the sand
    g.fillStyle = `rgba(255,255,240,${st.caustics})`;
    if (st.caustics > 0) for (let x = TANK.x; x < TANK.x + TANK.w; x += 1) for (let k = 0; k < 9; k++) {
      const y = TANK.sandTop + 1 + k * 2 + (x & 1);
      if (Math.sin(x * 0.31 + A.t * 1.6 + k * 0.9) + Math.sin(x * 0.13 - A.t * 1.1 + k * 1.7) > 1.45) g.fillRect(x, y, 1, 1);
    }
    // water surface: bright wavy line + soft reflection band
    for (let x = TANK.x; x < TANK.x + TANK.w; x++) {
      const yy = TANK.waterTop + Math.round(Math.sin(x * 0.12 + A.t * 2) * 0.7);
      g.fillStyle = 'rgba(240,255,255,0.8)'; g.fillRect(x, yy, 1, 1);
      if (Math.sin(x * 0.07 - A.t) > 0.6) { g.fillStyle = 'rgba(240,255,255,0.25)'; g.fillRect(x, yy + 2, 1, 1); }
    }
    g.fillStyle = 'rgba(210,245,255,0.18)'; g.fillRect(TANK.x, TANK.y, TANK.w, TANK.waterTop - TANK.y);

    // depth-sorted decor + creatures
    const items = [];
    tank.decor.forEach((d) => items.push({ z: zOf(d), d }));
    (tank.eggs || []).forEach((egg) => items.push({ z: TANK.sandTop + 5, egg }));
    A.fish.forEach((f) => items.push({ z: f.zDraw != null ? f.zDraw : f.z, f }));
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.egg) { drawEgg(g, it.egg); continue; }
      if (it.d) {
        const d = it.d, key = (d.type === 'plant' ? 'plant.' : 'decor.') + d.id;
        AQ.Assets.draw(g, key, 'idle', d.x, d.y, { t: A.t + d.x * 0.01, flip: !!d.flip, alpha: d.layer === 'back' ? 0.78 : 1 });
      } else {
        const f = it.f;
        // soft shadow on the sand
        if (f.zDraw == null) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(Math.round(f.x - f.r * 0.7), Math.round(f.z), Math.round(f.r * 1.4), 1); }
        const moving = Math.hypot(f.vx, f.vy) > 5 || f.walking, asleep = f.state === 'sleep';
        const chompX = f.chomp > 0 && Math.sin(f.chomp * 40) > 0 ? f.facing : 0;
        AQ.Assets.draw(g, f.key, moving && !asleep ? 'move' : 'idle', f.x + (f.shake && f.stress ? 1 : 0) + chompX, f.y - (f.peck || 0) - Math.round(f.hop || 0), { t: asleep ? f.t * 0.25 : f.t, flip: f.facing < 0, alpha: f.stress ? 0.8 : 1 });
        if (icons) moodIcon(g, f);
        if (A.card === f.uid && !A.photo.on) selectMark(g, f);
        if (icons && (f.state === 'sleep' || (f.state === 'rest' && (f.def.category === 'mammal' || f.def.category === 'reptile'))) && !f.stress) F().draw(g, 'z', f.x + 4, f.y - f.r - 6 - Math.round((A.t * 4) % 4), '#e8f4ff');
      }
    }
    // food
    A.food.forEach((p) => { g.fillStyle = '#e8873a'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); g.fillStyle = '#ffc07a'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); });
    // bubbles
    g.fillStyle = 'rgba(230,250,255,0.8)';
    A.bubbles.forEach((b) => g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1));
    if (icons) AQ.FX.draw(g);                       // hearts, sparkles, crumbs
    drawParticles(g, st.particles);
    if (st.dark > 0) drawDarkness(g, st, tank);
    // soft vignette in the tank corners
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(4,16,30,${(0.12 - i * 0.018).toFixed(3)})`;
      g.fillRect(TANK.x + i, TANK.y, 1, TANK.h); g.fillRect(TANK.x + TANK.w - 1 - i, TANK.y, 1, TANK.h);
    }
    // glass frame: dark metal rim with a highlight, lid with a lamp strip
    g.fillStyle = '#1c2c3d'; g.fillRect(TANK.x - 3, TANK.y - 3, TANK.w + 6, 3); g.fillRect(TANK.x - 3, TANK.y + TANK.h, TANK.w + 6, 3);
    g.fillRect(TANK.x - 3, TANK.y, 3, TANK.h); g.fillRect(TANK.x + TANK.w, TANK.y, 3, TANK.h);
    g.fillStyle = '#4a6a86'; g.fillRect(TANK.x - 3, TANK.y - 3, TANK.w + 6, 1); g.fillRect(TANK.x - 3, TANK.y, 1, TANK.h);
    g.fillStyle = st.lamp; for (let x = TANK.x + 20; x < TANK.x + TANK.w - 20; x += 2) g.fillRect(x, TANK.y - 1, 1, 1);   // lamp LEDs
    for (const rx of [TANK.x - 2, TANK.x + TANK.w + 1]) for (const ry of [TANK.y + 4, TANK.y + TANK.h - 5]) { g.fillStyle = '#7f9ab2'; g.fillRect(rx, ry, 1, 1); }
    g.save(); g.globalAlpha = 0.07; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(TANK.x + 20, TANK.y); g.lineTo(TANK.x + 34, TANK.y); g.lineTo(TANK.x + 4, TANK.y + 40); g.lineTo(TANK.x, TANK.y + 40); g.fill();
    g.beginPath(); g.moveTo(TANK.x + 40, TANK.y); g.lineTo(TANK.x + 44, TANK.y); g.lineTo(TANK.x + 14, TANK.y + 40); g.lineTo(TANK.x + 10, TANK.y + 40); g.fill();
    g.restore();
  }
  A.drawRest = function (g, b, tank) {
    // ghost of held item
    const m = AQ.Input.mouse;
    if (A.holding && inTank(m)) {
      const pl = placement(A.holding);
      AQ.Assets.draw(g, A.holding.key, 'idle', m.x, placeY(pl.kind, m.y, pl.hang), { alpha: 0.6, t: A.t, flip: !!A.holding.flip });
    }
    // hover tooltip on creatures
    if (!A.holding && inTank(m)) {
      const f = fishAt(m);
      if (f && A.card !== f.uid) tip(g, `${f.variant ? '✦ ' : ''}${f.def.name}${f.sex ? ' ' + AQ.Sex.SYMBOL[f.sex] : ''} - ${f.moodName || 'CONTENT'}${f.near ? ' (LOVES THE ' + f.near.tag.replace(/_/g, ' ').toUpperCase() + ')' : ''}`, m.x, m.y - 10, f.moodCol || '#fff');
    }

    const cf = A.card && A.fish.find((f) => f.uid === A.card);
    if (cf) drawCard(g, cf); else A.card = null;
    drawBars(g, tank, b);
  };

  // ---------------------------------------------------------------- photo mode
  // PHOTO (or P): the interface hides, a camera frame shows, and Space / a click takes a picture,
  // saved as a crisp PNG download. Freeze pauses the creatures; hearts and mood icons can be hidden;
  // three frame styles (none, pixel border, polaroid with a caption).
  const FRAMES = ['NONE', 'BORDER', 'POLAROID'];
  const pcfg = () => AQ.TUNING.photo;
  function enterPhoto() {
    putBack(); A.card = null;
    Object.assign(A.photo, { on: true, flash: 0 });
    if (A.photo.frame == null) A.photo.frame = pcfg().defaultFrame;
    AQ.Audio.play('menu_select');
  }
  function exitPhoto() { A.photo.on = false; A.photo.paused = false; AQ.Audio.play('menu_select'); }
  function photoUI() {
    const P = A.photo, ui = [];
    const add = (id, label, w, on) => ui.push({ id, label, w, h: 10, y: 2, on });
    add('p_exit', 'EXIT', 22);
    add('p_freeze', P.paused ? 'FROZEN' : 'FREEZE', 32, P.paused);
    add('p_icons', P.icons ? 'ICONS ON' : 'ICONS OFF', 40, P.icons);
    add('p_frame', 'FRAME: ' + FRAMES[P.frame], 66);
    add('p_caption', P.frame === 2 ? 'CAPTION: ON' : P.caption ? 'CAPTION: ON' : 'CAPTION: OFF', 52, P.frame === 2 || P.caption);
    add('p_snap', 'SNAP', 26);
    let x = 4; ui.forEach((r) => { r.x = x; x += r.w + 3; });
    return ui;
  }
  function updatePhoto(dt, game, tank) {
    const I = AQ.Input, m = I.mouse, P = A.photo;
    P.flash = Math.max(0, P.flash - dt);
    P.previewT = Math.max(0, P.previewT - dt);
    if (!P.paused) { A.t += dt; simulate(dt, tank); }
    P.ui = photoUI();
    P.hover = P.ui.find((r) => hit(r, m));
    if (I.wasPressed('Escape', pcfg().key)) { exitPhoto(); return; }
    const act = (id) => {
      if (id === 'p_exit') exitPhoto();
      else if (id === 'p_freeze') P.paused = !P.paused;
      else if (id === 'p_icons') P.icons = !P.icons;
      else if (id === 'p_frame') P.frame = (P.frame + 1) % FRAMES.length;
      else if (id === 'p_caption') { if (P.frame !== 2) P.caption = !P.caption; }
      else if (id === 'p_snap') snap(tank);
      if (id !== 'p_snap' && id !== 'p_exit') AQ.Audio.play('menu_move');
    };
    if (I.wasPressed('KeyZ')) act('p_freeze');
    if (I.wasPressed('KeyI')) act('p_icons');
    if (I.wasPressed('KeyF')) act('p_frame');
    if (I.wasPressed('KeyC')) act('p_caption');
    if (I.wasPressed('Space')) act('p_snap');
    if (m.pressed[0]) { if (P.hover) act(P.hover.id); else if (inTank(m)) act('p_snap'); }
  }
  const dateText = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  // The picture: the tank (rim included), framed in the chosen style, scaled up crisply.
  function composePhoto(b, tank) {
    const P = A.photo, src = document.createElement('canvas');
    src.width = 320; src.height = 180;
    const sg = src.getContext('2d'); sg.imageSmoothingEnabled = false;
    drawScene(sg, b, tank, P.icons);
    const cx = TANK.x - 3, cy = TANK.y - 3, cw = TANK.w + 6, ch = TANK.h + 6;
    const name = (b.short || b.name), stars = A.vibe ? A.vibe.stars : 0, date = dateText();
    const pad = P.frame === 0 ? [0, 0, 0] : P.frame === 1 ? [5, 5, 5] : [10, 10, 30];   // side, top, bottom
    const W = cw + pad[0] * 2, H = ch + pad[1] + pad[2];
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (P.frame === 1) {                                              // simple pixel border
      g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7fb6cc'; g.fillRect(2, 2, W - 4, 1); g.fillRect(2, H - 3, W - 4, 1); g.fillRect(2, 2, 1, H - 4); g.fillRect(W - 3, 2, 1, H - 4);
    } else if (P.frame === 2) {                                       // polaroid
      g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#d9d3c4'; g.fillRect(0, H - 1, W, 1); g.fillRect(W - 1, 0, 1, H);
    }
    g.drawImage(src, cx, cy, cw, ch, pad[0], pad[1], cw, ch);
    if (P.frame === 2) {
      F().draw(g, name.toUpperCase(), pad[0] + 2, ch + pad[1] + 6, '#3a3a44', { shadow: false });
      drawStars(g, Math.round(W / 2 - 20), ch + pad[1] + 5, stars);
      F().draw(g, date, W - pad[0] - 2, ch + pad[1] + 6, '#6a6a74', { align: 'right', shadow: false });
      F().draw(g, 'AQUADISE', W - pad[0] - 2, ch + pad[1] + 16, '#9a9488', { align: 'right', shadow: false });
    } else if (P.caption) {                                           // optional caption strip
      const y = pad[1] + ch - 13;
      g.fillStyle = 'rgba(5,14,26,0.72)'; g.fillRect(pad[0] + 3, y, cw - 6, 10);
      F().draw(g, name.toUpperCase(), pad[0] + 6, y + 3, '#ffe9a8', { shadow: false });
      drawStars(g, Math.round(pad[0] + cw / 2 - 20), y + 2, stars);
      F().draw(g, date, pad[0] + cw - 6, y + 3, '#cfe8ff', { align: 'right', shadow: false });
    }
    const k = pcfg().scale, out = document.createElement('canvas');
    out.width = W * k; out.height = H * k;
    const og = out.getContext('2d'); og.imageSmoothingEnabled = false;
    og.drawImage(c, 0, 0, W * k, H * k);
    return { out, small: c, name, date };
  }
  A.composePhoto = () => composePhoto(AQ.Tanks.get(A.biome), AQ.Collection.tank(A.biome));
  function snap(tank) {
    const P = A.photo, b = AQ.Tanks.get(A.biome);
    AQ.Audio.play('shutter');
    P.flash = pcfg().flashSeconds;
    let shot;
    try { shot = composePhoto(b, tank); } catch (e) { note('The photo could not be taken.', '#ffb08a'); return; }
    const file = `Aquadise-${shot.name.replace(/[^A-Za-z0-9]/g, '')}-${shot.date}.png`;
    const done = (ok) => {
      P.preview = shot.small; P.previewT = ok ? pcfg().previewSeconds : 0;
      P.saved = ok ? 'SAVED!' : 'COULD NOT SAVE';
      if (!ok) { P.previewT = pcfg().previewSeconds; }
      A.lastPhoto = { file, ok, w: shot.out.width, h: shot.out.height };
    };
    try {
      shot.out.toBlob((blob) => {
        if (!blob) { done(false); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = file;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        done(true);
      }, 'image/png');
    } catch (e) { done(false); }     // e.g. a browser that won't export these images
  }
  function drawPhotoUI(g, b, tank) {
    const P = A.photo, t = A.t;
    // dim everything outside the tank, then the camera frame: viewfinder corners + a recording dot
    g.fillStyle = 'rgba(4,10,20,0.85)';
    g.fillRect(0, 0, 320, TANK.y - 3); g.fillRect(0, TANK.y + TANK.h + 3, 320, 180 - TANK.y - TANK.h - 3);
    const x0 = TANK.x + 4, y0 = TANK.y + 4, x1 = TANK.x + TANK.w - 5, y1 = TANK.y + TANK.h - 5, L = 10;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      g.fillRect(Math.min(x, x + dx * L), y, L, 1); g.fillRect(x, Math.min(y, y + dy * L), 1, L);
    }
    if (Math.floor(t * 2) % 2 && !P.paused) { g.fillStyle = '#ff5a6a'; g.fillRect(x1 - 12, y0 + 3, 3, 3); }
    if (P.paused) F().draw(g, 'FROZEN', x1 - 4, y0 + 5, '#9fe8ff', { align: 'right' });
    F().draw(g, FRAMES[P.frame] + (P.frame !== 2 && P.caption ? ' + CAPTION' : ''), x0 + 4, y0 + 5, 'rgba(255,255,255,0.8)');
    // the toolbar + key hints (never in the picture)
    for (const r of P.ui) button(g, r, P.hover === r);
    F().draw(g, 'SPACE / CLICK: SNAP     Z: FREEZE     I: HEARTS + MOOD ICONS', 8, 153, '#8fb6cc');
    F().draw(g, 'F: FRAME STYLE     C: CAPTION     P / ESC: LEAVE PHOTO MODE', 8, 162, '#8fb6cc');
    F().draw(g, `PHOTOS SAVE AS PNG DOWNLOADS (${pcfg().scale}X PIXELS)`, 8, 171, '#5f7f96');
    // after a shot: a tiny preview with "Saved!"
    if (P.previewT > 0 && P.preview) {
      const pw = 64, ph = Math.round(P.preview.height * pw / P.preview.width), px = 320 - pw - 6, py = 180 - ph - 4;
      g.globalAlpha = Math.min(1, P.previewT * 3);
      g.fillStyle = '#0b1a2c'; g.fillRect(px - 2, py - 10, pw + 4, ph + 12);
      g.save(); g.imageSmoothingEnabled = true; g.drawImage(P.preview, px, py, pw, ph); g.restore();
      F().draw(g, P.saved || 'SAVED!', px + pw / 2, py - 8, P.saved === 'SAVED!' ? '#8ff0b0' : '#ffb08a', { align: 'center' });
      g.globalAlpha = 1;
    }
    if (P.flash > 0) { g.fillStyle = `rgba(255,255,255,${(P.flash / pcfg().flashSeconds * 0.9).toFixed(3)})`; g.fillRect(0, 0, 320, 180); }
  }

  // ---------------------------------------------------------------- creature info card
  function selectMark(g, f) {
    if (Math.floor(A.t * 3) % 3 === 2) return;
    const r = Math.round(f.r) + 2, x = Math.round(f.x), y = Math.round(f.y - (f.hop || 0));
    g.fillStyle = '#ffe9a8';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.fillRect(x + sx * r - (sx > 0 ? 1 : 0), y + sy * r - (sy > 0 ? 1 : 0), 1, 1); g.fillRect(x + sx * r - (sx > 0 ? 2 : -1), y + sy * r - (sy > 0 ? 1 : 0), 1, 1); g.fillRect(x + sx * r - (sx > 0 ? 1 : 0), y + sy * r - (sy > 0 ? 2 : -1), 1, 1); }
  }
  // a small clutch of soft, glowing eggs on the sand that wobbles as it gets ready to hatch
  function drawEgg(g, egg) {
    const d = defOf(egg.id), c = U.hex((d && (d.accent || d.color)) || '#ffe0c0');
    const ready = U.clamp((Date.now() - egg.laidAt) / (AQ.TUNING.breeding.eggMinutes * 60000), 0, 1);
    const x = Math.round(egg.x), y = TANK.sandTop + 5, wob = ready > 0.7 && Math.sin(A.t * 9) > 0.6 ? 1 : 0;
    [[0, 0], [3, 1], [-3, 1]].forEach(([dx, dy], i) => {
      const ex = x + dx + (i === 0 ? wob : 0), ey = y + dy;
      g.fillStyle = 'rgba(40,30,20,0.55)'; g.fillRect(ex - 2, ey - 3, 5, 3); g.fillRect(ex - 1, ey - 4, 3, 1); g.fillRect(ex - 1, ey, 3, 1);
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.95)`; g.fillRect(ex - 1, ey - 3, 3, 3); g.fillRect(ex, ey - 4, 1, 1);
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(ex - 1, ey - 3, 1, 1);
    });
  }
  const TAGWORD = (t) => t.replace(/_/g, ' ').toUpperCase();
  function activity(f) {
    const nm = (gm) => (gm && gm.d ? (gm.d.type === 'plant' ? defOf(gm.d.id).name : decorDef(gm.d.id).name).toUpperCase() : '');
    if (A.food.length && f.loco !== 'still' && !f.stress) return 'GOING FOR FOOD';
    if (f.chomp > 0) return 'MUNCHING';
    switch (f.state) {
      case 'hide': return f.shelter ? 'HIDING IN THE ' + nm(f.shelter) : 'HIDING IN A CORNER';
      case 'swim': return f.leader ? 'SWIMMING WITH ITS SCHOOL' : f.loco === 'swim' ? 'SWIMMING AROUND' : 'WANDERING';
      case 'feed': return f.graze ? 'GRAZING ON ' + nm(f.graze) : 'NIBBLING THE SAND';
      case 'court': return 'COURTING ♥';
      case 'play': return f.buddy ? 'PLAYING WITH ' + f.buddy.def.name.toUpperCase() : 'PLAYING';
      case 'rest': return f.perch ? 'RESTING ON THE ' + nm(f.perch) : 'RESTING';
      case 'shelter': return 'NAPPING IN THE ' + nm(f.shelter);
      case 'sleep': return 'SLEEPING';
      case 'drift': return 'DRIFTING';
      case 'visit': return 'OFF TO SEE THE ' + nm(f.spot);
      case 'enjoy': return 'LOVING THE ' + nm(f.spot);
    }
    return '';
  }
  function drawCard(g, f) {
    const W = 168, H = 58, x = f.x < 160 ? TANK.x + TANK.w - W - 6 : TANK.x + 6, y = TANK.waterTop + 4;
    const tank = AQ.Collection.tank(A.biome), likes = f.def.likes || [];
    const have = new Set(); tank.decor.forEach((d) => AQ.Vibe.tagsOf(d).forEach((t) => have.add(t)));
    g.fillStyle = 'rgba(6,18,34,0.92)'; g.fillRect(x, y, W, H);
    g.fillStyle = '#5fc6d9'; g.fillRect(x, y, W, 1);
    g.fillStyle = '#132b40'; g.fillRect(x + 3, y + 4, 26, 26);
    const e = AQ.Assets.entry(f.key);
    if (e) {
      const sc = Math.min(1, 22 / Math.max(e.fw, e.fh));
      g.save(); g.translate(x + 16, y + 17); g.scale(sc, sc);
      AQ.Assets.draw(g, f.key, 'idle', 0, e.anchor[1] - e.fh / 2, { t: A.t });
      g.restore();
    }
    const tx = x + 33, b = AQ.World.biomeById[f.def.biome];
    F().draw(g, f.def.name.toUpperCase(), tx, y + 4, '#ffe9a8', { shadow: false });
    if (f.sex) F().draw(g, AQ.Sex.SYMBOL[f.sex], tx + F().width(f.def.name.toUpperCase()) + 3, y + 4, AQ.Sex.COLOR[f.sex], { shadow: false });
    if (f.variant) F().draw(g, '✦ RARE COLOR', tx + F().width(f.def.name.toUpperCase()) + (f.sex ? 11 : 3), y + 4, '#ffd25a', { shadow: false });
    F().draw(g, 'MOOD:', tx, y + 12, '#8fb6cc', { shadow: false });
    F().draw(g, f.moodName || 'CONTENT', tx + 24, y + 12, f.moodCol || '#bfe8ff', { shadow: false });
    F().draw(g, 'LIKES:', tx, y + 20, '#8fb6cc', { shadow: false });
    let lx = tx + 28;
    if (!likes.length) F().draw(g, 'ANYTHING', lx, y + 20, '#cfe8ff', { shadow: false });
    likes.forEach((l, i) => {
      const w = TAGWORD(l) + (i < likes.length - 1 ? ',' : '');
      F().draw(g, w, lx, y + 20, have.has(l) ? '#8ff0b0' : '#7d8fa0', { shadow: false });
      lx += F().width(w) + 4;
    });
    F().draw(g, 'FROM:', tx, y + 28, '#8fb6cc', { shadow: false });
    F().draw(g, ((b && b.name) || f.def.biome).toUpperCase(), tx + 24, y + 28, '#cfe8ff', { shadow: false });
    F().draw(g, 'SEX:', x + 4, y + 35, '#8fb6cc', { shadow: false });
    const sexTxt = f.sex ? `${AQ.Sex.NAME[f.sex]} ${AQ.Sex.SYMBOL[f.sex]}` : 'NONE';
    F().draw(g, sexTxt, x + 24, y + 35, f.sex ? AQ.Sex.COLOR[f.sex] : '#cfe8ff', { shadow: false });
    const ageTxt = f.juv ? `BABY (${AQ.Breeding.growLeftMin(f.entry)} MIN TO GROW)` : 'ADULT';
    F().draw(g, ageTxt, x + 24 + F().width(sexTxt) + 6, y + 35, f.juv ? '#ffe9a8' : '#cfe8ff', { shadow: false });
    F().draw(g, activity(f), x + 4, y + 43, f.state === 'court' ? '#ffb0d0' : '#e8fbff', { shadow: false });
    const missing = likes.filter((l) => !have.has(l));
    F().draw(g, missing.length ? 'WOULD LOVE SOME ' + TAGWORD(missing[0]) : (f.stress ? 'THE TANK FEELS A BIT CROWDED' : 'HAS EVERYTHING IT LIKES'), x + 4, y + 50, missing.length || f.stress ? '#ffcf8a' : '#8ff0b0', { shadow: false });
  }

  // Glanceable mood: a tiny icon pops over each creature now and then (always while nervous
  // or enjoying, and always for the creature under the mouse).
  const ICONS = {
    DELIGHTED: ['#.#', '###', '.#.'],          // heart
    HAPPY: ['.#.', '#.#', '.#.'],              // sparkle
    UNEASY: ['...', '#.#', '...'],             // "..": a little unsure
    NERVOUS: ['.#.', '.#.', '###']             // sweat drop
  };
  function moodIcon(g, f) {
    if (!f.moodName) return;
    const cfg = AQ.TUNING.aquarium, m = AQ.Input.mouse;
    const hovered = Math.abs(f.x - m.x) < f.r + 2 && Math.abs(f.y - m.y) < f.r + 2;
    const cyc = (A.t + f.moodPh) % cfg.moodIconEvery < cfg.moodIconShow;
    const always = f.stress || f.state === 'enjoy' || hovered;
    if (!(cyc || always) || f.moodName === 'CONTENT') return;
    if (f.stress && Math.floor(A.t * 2 + f.t) % 2) return;          // nervous drop blinks
    const ic = ICONS[f.moodName]; if (!ic) return;
    const x = Math.round(f.x + 2), y = Math.round(f.y - f.r - 5 - (f.hop || 0) + (f.moodName === 'DELIGHTED' ? Math.sin(A.t * 3) * 0.6 : 0));
    g.fillStyle = 'rgba(4,12,24,0.45)';
    ic.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') g.fillRect(x + rx, y + ry + 1, 1, 1); }));
    g.fillStyle = f.moodCol;
    ic.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') g.fillRect(x + rx, y + ry, 1, 1); }));
  }

  // ---------------------------------------------------------------- overview: every tank at a glance
  // A grid that mirrors the building: one row per floor (top floor first), 5 slots per row.
  const CARD = { w: 60, h: 37, gap: 2, x0: 6, y0: 15, cols: 5 };
  A.openOverview = () => openOverview();
  A.backdropOf = (b) => backdrop(b);
  A.styleOf = styleOf;
  function overviewSlots() {
    const st = AQ.data.station, floors = st.floors.length;
    const rows = [];
    for (let f = floors - 1; f >= 0; f--) rows.push(st.tanks.filter((t) => t.floor === f).sort((a, b) => a.x - b.x));
    const out = [];
    rows.forEach((row, ri) => row.slice(0, CARD.cols).forEach((t, ci) => {
      const b = t.tank && AQ.Tanks.get(t.tank);
      out.push({ i: out.length, row: ri, col: ci, b, v: b ? AQ.Vibe.evaluate(b.id) : null });
    }));
    return out;
  }
  function openOverview() {
    putBack();
    A.view = 'overview'; A.card = null; A.ovT = 0; A.ovHover = null;
    A.overview = overviewSlots();
  }
  function cardRect(o) { return { x: CARD.x0 + o.col * (CARD.w + CARD.gap), y: CARD.y0 + o.row * (CARD.h + CARD.gap), w: CARD.w, h: CARD.h }; }
  function overviewButtons() { return [{ id: 'ov_back', x: 292, y: 2, w: 26, h: 10, label: 'TANK' }]; }
  function updateOverview(dt, game) {
    const I = AQ.Input, m = I.mouse;
    A.ovT += dt;
    if (A.ovT > 1) { A.ovT = 0; A.overview = overviewSlots(); }
    if (I.wasPressed('Escape', 'KeyT')) { A.view = 'tank'; return; }
    if (I.wasPressed('Tab')) { A.view = 'tank'; A.close(game); return; }
    A.ovHover = null;
    A.overview.forEach((o) => { if (o.b && hit(cardRect(o), m)) A.ovHover = o.i; });
    const btn = overviewButtons().find((r) => hit(r, m));
    if (m.pressed[0]) {
      if (btn) { A.view = 'tank'; return; }
      if (A.ovHover != null) {
        A.view = 'tank';
        A.biome = A.overview[A.ovHover].b.id;
        A.fish = []; A.shaker = null; A.card = null; A.undo = []; A.clearArm = 0; A.courtC = null; A.rebuild();
      }
    }
    AQ.FX.update(dt, { water: () => true });
  }
  function drawOverview(g) {
    const m = AQ.Input.mouse, real = A.overview.filter((o) => o.b);
    g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, 320, 180);
    F().draw(g, 'YOUR AQUARIUM', 6, 4, '#ffe9a8');
    const total = real.reduce((a, o) => a + o.v.creatures, 0), stars = real.reduce((a, o) => a + o.v.stars, 0);
    const lockable = AQ.data.decorations.filter((d) => d.unlock), got = lockable.filter((d) => AQ.Vibe.isUnlocked(d)).length;
    F().draw(g, `${total} CREATURES  ${stars} STARS  DECOR ${got}/${lockable.length}`, 186, 4, '#8fb6cc', { align: 'center' });
    overviewButtons().forEach((r) => button(g, r, hit(r, m)));
    A.overview.forEach((o) => {
      const r = cardRect(o), b = o.b;
      if (!b) {   // an empty, unlit slot
        g.fillStyle = '#0e2132'; g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = '#081622'; g.fillRect(r.x + 2, r.y + 9, r.w - 4, 12);
        F().draw(g, 'EMPTY SLOT', r.x + r.w / 2, r.y + 26, '#3a5266', { align: 'center', shadow: false });
        return;
      }
      const v = o.v, tank = AQ.Collection.tank(b.id), hov = A.ovHover === o.i, cur = b.id === A.biome;
      g.fillStyle = hov ? '#1d4460' : b.kind === 'predator' ? '#2a2234' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = cur ? '#ffe9a8' : hov ? '#5fc6d9' : b.kind === 'predator' ? 'rgba(255,170,150,0.45)' : 'rgba(160,220,240,0.3)'; g.fillRect(r.x, r.y, r.w, 1);
      // thumbnail: the tank's own backdrop + its creatures
      const tx = r.x + 2, ty = r.y + 9, tw = r.w - 4, th = 12;
      g.drawImage(backdrop(b), 0, 30, TANK.w, TANK.h - 30, tx, ty, tw, th);
      const st = styleOf(b.id);
      if (st.dark) { g.fillStyle = `rgba(2,6,16,${st.dark * 0.6})`; g.fillRect(tx, ty, tw, th); }
      const ids = [...new Set(tank.creatures.map((e) => e.id))];
      const stressed = AQ.Vibe.stressedIds(tank.creatures);
      ids.slice(0, 4).forEach((id, k) => {
        const key = 'creature.' + id, e = AQ.Assets.entry(key);
        if (!e) return;
        const sc = Math.min(0.5, 9 / Math.max(e.fw, e.fh)), cx = tx + 6 + k * 12, cy = ty + 6 + Math.round(Math.sin(A.t * 2 + k) * 1);
        g.save(); g.translate(cx, cy); g.scale(sc, sc);
        AQ.Assets.draw(g, key, 'idle', 0, 0, { t: A.t + k, flip: k % 2 === 1 });
        g.restore();
        if (tank.creatures.some((e2) => e2.id === id && stressed.has(e2.uid)) && Math.floor(A.t * 2) % 2 === 0) { g.fillStyle = '#9fd8ff'; g.fillRect(cx + 3, cy - 6, 1, 2); g.fillRect(cx + 2, cy - 4, 3, 1); }
      });
      g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
      F().draw(g, (b.short || b.name).toUpperCase(), r.x + 2, r.y + 2, cur ? '#ffe9a8' : '#e8fbff', { shadow: false });
      g.restore();
      drawStars(g, r.x + 2, r.y + 22, v.stars);
      F().draw(g, `${ids.length}`, r.x + r.w - 2, r.y + 23, '#8fb6cc', { align: 'right', shadow: false });
      // one-line status: the most useful thing to know about this tank
      let status, col;
      if (!v.creatures) { status = tank.decor.length ? 'NO CREATURES' : 'EMPTY'; col = '#7d8fa0'; }
      else if (v.stressed) { status = `${v.stressed} NERVOUS`; col = '#9fd8ff'; }
      else if (v.parts.fed < 0.5) { status = 'HUNGRY'; col = '#ffcf8a'; }
      else if (tank.court) { status = 'COURTING ♥'; col = '#ffb0d0'; }
      else if (v.stars >= 4.5) { status = 'VERY HAPPY'; col = '#8ff0b0'; }
      else { status = 'CONTENT'; col = '#cfe8ff'; }
      F().draw(g, status, r.x + 2, r.y + 30, col, { shadow: false });
    });
    // hover: what's helping / missing in that tank
    if (A.ovHover != null) {
      const o = A.overview[A.ovHover], nx = AQ.Vibe.nextUnlock(o.b.id);
      const line = o.v.missing[0] ? '- ' + o.v.missing[0] : '+ ' + (o.v.helps[0] || '');
      tip(g, `${(o.b.short || o.b.name).toUpperCase()}: ${line}${nx ? '  NEXT UNLOCK ' + nx.stars + ' STARS' : ''}`, 160, 172, o.v.missing[0] ? '#ffcf8a' : '#8ff0b0');
    } else tip(g, 'TOP ROW = PREDATOR WING   CLICK A TANK TO VISIT IT   (T / ESC: BACK)', 160, 172, '#8fb6cc');
  }

  // Ambient particles per tank style.
  function drawParticles(g, kind) {
    const H = TANK.sandTop - TANK.waterTop - 8, top = TANK.waterTop + 4;
    if (kind === 'snow') {
      for (let i = 0; i < 34; i++) {
        const x = TANK.x + ((i * 53 + Math.sin(A.t * 0.4 + i) * 6 + 400) % TANK.w), y = top + ((i * 37 + A.t * (2.5 + (i % 3))) % H);
        g.fillStyle = `rgba(240,248,255,${0.35 + (i % 3) * 0.15})`; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else if (kind === 'embers') {
      for (let i = 0; i < 22; i++) {
        const x = TANK.x + ((i * 47 + Math.sin(A.t * 0.9 + i) * 4 + 400) % TANK.w), y = TANK.sandTop - ((i * 29 + A.t * (5 + (i % 4) * 2)) % H);
        g.fillStyle = Math.sin(A.t * 6 + i) > 0 ? '#ffb070' : '#ff7a3a'; g.globalAlpha = 0.45 + (i % 3) * 0.15;
        g.fillRect(Math.round(x), Math.round(y), 1, 1); g.globalAlpha = 1;
      }
    } else if (kind === 'fireflies') {
      for (let i = 0; i < 12; i++) {
        const x = TANK.x + TANK.w / 2 + Math.sin(A.t * 0.23 * (1 + i % 3) + i * 2.1) * TANK.w * 0.44, y = top + 6 + (Math.sin(A.t * 0.31 + i * 1.3) * 0.5 + 0.5) * (H - 12);
        const on = Math.sin(A.t * 1.7 + i * 2.7);
        if (on < -0.2) continue;
        g.fillStyle = 'rgba(232,255,140,0.25)'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        g.fillStyle = '#efff9a'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else {
      const spores = kind === 'spores';
      for (let i = 0; i < 26; i++) {
        const x = TANK.x + ((i * 53 + A.t * (spores ? 1.5 : 3 + (i % 4))) % TANK.w);
        const y = spores ? TANK.sandTop - 6 - ((i * 41 + A.t * (1 + (i % 3) * 0.6)) % H) : top + 2 + ((i * 37 + Math.sin(A.t * 0.5 + i) * 6) % H);
        g.fillStyle = spores ? `rgba(220,255,190,${0.22 + (i % 3) * 0.1})` : `rgba(230,250,255,${0.18 + (i % 3) * 0.08})`;
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }
  // Dark tanks: a dim overlay with soft holes around glowing decor (and a faint halo round each
  // creature so they stay easy to see), plus a gentle coloured glow.
  let lightC = null;
  function glowSources(tank) {
    const out = [];
    tank.decor.forEach((d) => {
      let col = null;
      if (d.type === 'plant') { const pd = defOf(d.id); if (pd && (pd.tags || []).indexOf('light') >= 0) col = pd.accent || pd.color; }
      else { const dd = decorDef(d.id); col = dd && dd.glow; }
      if (!col) return;
      const gm = geo(d);
      out.push({ x: gm.cx, y: gm.top + gm.h * 0.4, col, r: 26 + gm.h * 0.4 + Math.sin(A.t * 1.5 + d.x) * 2 });
    });
    return out;
  }
  function drawDarkness(g, st, tank) {
    if (!lightC) { lightC = document.createElement('canvas'); lightC.width = TANK.w; lightC.height = TANK.h; }
    const lg = lightC.getContext('2d'), src = glowSources(tank);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, TANK.w, TANK.h);
    const grad = lg.createLinearGradient(0, 0, 0, TANK.h);
    grad.addColorStop(0, `rgba(2,6,16,${st.dark * 0.55})`); grad.addColorStop(1, `rgba(2,6,16,${st.dark})`);
    lg.fillStyle = grad; lg.fillRect(0, 0, TANK.w, TANK.h);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { const rg = lg.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${a})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = rg; lg.fillRect(x - r, y - r, r * 2, r * 2); };
    src.forEach((s) => hole(s.x - TANK.x, s.y - TANK.y, s.r, 1));
    A.fish.forEach((f) => hole(f.x - TANK.x, f.y - TANK.y, f.r + 8, 0.55));
    g.drawImage(lightC, TANK.x, TANK.y);
    g.save(); g.globalCompositeOperation = 'lighter';
    src.forEach((s) => {
      const c = U.hex(s.col), rg = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 0.8);
      rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.22)`); rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = rg; g.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    });
    g.restore();
  }

  // Cached, biome-themed backdrop: dithered water gradient, distant rock silhouettes, themed
  // mid-ground silhouettes and a rippled sand bed with pebbles.
  const backdrops = {};
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => v / 16));
  function backdrop(b) {
    if (backdrops[b.id]) return backdrops[b.id];
    const W = TANK.w, H = TANK.h, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
    const st = styleOf(b.id), water = U.hex(b.water || '#3497bd');
    const top = st.top ? U.hex(st.top) : U.mix([150, 225, 235], water, 0.35), deep = st.deep ? U.hex(st.deep) : U.mix([26, 70, 110], water, 0.45);
    const pal = b.palette, sand = pal.top.map(U.hex), rock = U.mix(U.hex(pal.rock[1]), deep, 0.55), rockFar = U.mix(rock, deep, 0.5);
    const seed = b.index * 31 + 7, theme = b.theme || b.id;
    const sandY = (x) => TANK.sandTop - TANK.y + Math.round(Math.sin(x * 0.05) * 1.5 + Math.sin(x * 0.13) * 0.8);
    const farH = (x) => 34 + Math.sin(x * 0.021 + seed) * 10 + Math.sin(x * 0.07 + seed * 2) * 5;
    const midH = (x) => 20 + Math.sin(x * 0.04 + seed * 3) * 7 + U.noise1(x * 0.08, seed) * 6;
    const set = (x, y, col, a = 255) => { const i = (y * W + x) * 4; const k = a / 255; d[i] = d[i] * (1 - k) + col[0] * k; d[i + 1] = d[i + 1] * (1 - k) + col[1] * k; d[i + 2] = d[i + 2] * (1 - k) + col[2] * k; d[i + 3] = 255; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // 8-band gradient with ordered dithering between bands
      const t = y / H * 16, band = Math.floor(t + (t % 1 > BAYER[y & 3][x & 3] ? 1 : 0)) / 16;
      set(x, y, U.mix(top, deep, band));
      const sy = sandY(x);
      if (y < sy && y > sy - farH(x)) set(x, y, rockFar, 110);
      if (y < sy && y > sy - midH(x)) set(x, y, rock, 120);
      if (y >= sy) {
        const k = y - sy, h = U.hash2(x, y, 3);
        let col = k === 0 ? U.scale(sand[0], 1.08) : k < 4 ? sand[0] : k < 9 ? sand[1] : sand[2];
        if (Math.sin(x * 0.45 + y * 1.3 + Math.sin(x * 0.05) * 3) > 0.85 && k > 1) col = U.scale(col, 0.9);   // ripples
        if (h < 0.025) col = U.scale(sand[2], 0.8); else if (h < 0.04) col = [236, 228, 214];                   // pebbles / shell bits
        set(x, y, col);
      }
    }
    // themed mid-ground silhouettes
    const sil = U.mix(rock, deep, 0.2), r = U.rng(seed);
    const stroke = (x0, y0, x1, y1, a) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); if (x >= 0 && y >= 0 && x < W && y < H) set(x, y, sil, a); } };
    for (let k = 0; k < 14; k++) {
      const x = r.range(6, W - 6), base = sandY(Math.round(x));
      if (theme === 'kelp' || theme === 'lush_cave' || theme === 'tide_pools') { for (let y = base; y > base - r.range(40, 95); y--) set(Math.round(x + Math.sin(y * 0.08 + k) * 2), y, sil, 90); }
      else if (theme === 'coral') { const R = r.range(6, 13); for (let a = Math.PI; a < Math.PI * 2; a += 0.12) stroke(x, base, x + Math.cos(a) * R, base + Math.sin(a) * R * 1.2, 80); }
      else if (theme === 'ice') { const h = r.range(14, 40); for (let y = 0; y < h; y++) { const w = (1 - y / h) * 5; for (let i = -w; i <= w; i++) set(Math.round(x + i), base - y, [205, 235, 248], 70); } }
      else if (theme === 'vents') { const h = r.range(12, 30); for (let y = 0; y < h; y++) { const w = 2 + (1 - y / h) * 4; for (let i = -w; i <= w; i++) set(Math.round(x + i), base - y, sil, 100); } }
      else if (theme === 'mangrove') { const reach = r.range(10, 24); stroke(x, base - 60, x - reach, base, 90); stroke(x, base - 60, x + reach, base, 90); stroke(x, base - 60, x, base - 100, 90); }
      else if (theme === 'ruins') { const h = r.range(14, 34); for (let y = 0; y < h; y++) for (let i = -2; i <= 2; i++) set(Math.round(x + i), base - y, sil, 90); }
      else { const h = r.range(8, 24); for (let y = 0; y < h; y++) set(Math.round(x), base - y, sil, 80); }
    }
    g.putImageData(img, 0, 0);
    backdrops[b.id] = c;
    return c;
  }

  // 7x7 pixel stars: full, half (left half lit) and empty
  const STAR = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##', '.......'];
  function star(g, x, y, fill) {
    STAR.forEach((row, ry) => [...row].forEach((v, rx) => {
      if (v !== '#') return;
      const lit = fill >= 1 || (fill > 0 && rx <= 3);
      g.fillStyle = lit ? (ry < 2 ? '#fff1a8' : '#ffd25a') : '#2c4258';
      g.fillRect(x + rx, y + ry, 1, 1);
    }));
  }
  function lockIcon(g, x, y) {
    g.fillStyle = '#c8b27a'; g.fillRect(x + 1, y, 4, 1); g.fillRect(x, y + 1, 1, 3); g.fillRect(x + 5, y + 1, 1, 3);
    g.fillStyle = '#ffd25a'; g.fillRect(x - 1, y + 4, 8, 6);
    g.fillStyle = '#8a6a2a'; g.fillRect(x + 2, y + 6, 2, 2);
  }
  function miniStar(g, x, y) {
    g.fillStyle = '#ffd25a'; g.fillRect(x + 1, y, 1, 1); g.fillRect(x, y + 1, 3, 1); g.fillRect(x, y + 3, 1, 1); g.fillRect(x + 2, y + 3, 1, 1); g.fillRect(x + 1, y + 2, 1, 1);
  }
  function drawStars(g, x, y, stars) { for (let i = 0; i < 5; i++) star(g, x + i * 8, y, U.clamp(stars - i, 0, 1)); }
  A.drawStars = drawStars;
  function vibeTooltip(g, v) {
    const lines = v.helps.slice(0, 5).map((t) => ['+ ' + t, '#8ff0b0']).concat(v.missing.slice(0, 5).map((t) => ['- ' + t, '#ffcf8a']));
    const nx = AQ.Vibe.nextUnlock(A.biome), best = (AQ.State.tankBest || {})[A.biome] || 0;
    if (v.breeding) lines.push([(v.breeding.good ? '♥ ' : '- ') + v.breeding.text, v.breeding.good ? '#ffb0d0' : '#ffcf8a']);
    lines.push(nx ? [`NEXT: ${nx.stars} STARS UNLOCKS ${nx.def.name.toUpperCase()}`, '#ffe08a'] : ['ALL OF THIS TANK\'S DECOR IS UNLOCKED!', '#ffe08a']);
    if (best > v.stars) lines.push([`BEST SO FAR: ${best} STARS`, '#8fb6cc']);
    const w = Math.max(120, ...lines.map((l) => F().width(l[0]))) + 10, h = 14 + lines.length * 7;
    const x = 84, y = 15;
    g.fillStyle = 'rgba(6,18,34,0.94)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#5fc6d9'; g.fillRect(x, y, w, 1);
    F().draw(g, `TANK VIBE  ${v.stars} / 5`, x + 5, y + 4, '#ffe9a8', { shadow: false });
    lines.forEach(([t, c], i) => F().draw(g, t, x + 5, y + 12 + i * 7, c, { shadow: false }));
  }

  // Lightweight hint text: no box, just a soft shadow so it doesn't cover the tank.
  function tip(g, text, x, y, col) {
    const w = F().width(text);
    const tx = U.clamp(Math.round(x - w / 2), 3, 317 - w);
    g.globalAlpha = 0.9;
    F().draw(g, text, tx, y, col, { shadow: 'rgba(4,12,24,0.85)' });
    g.globalAlpha = 1;
  }
  A.tip = tip;

  function button(g, r, hover) {
    g.fillStyle = r.warn ? (hover ? '#a8503a' : '#8a3f2e') : r.on ? '#2e7d96' : hover && !r.off ? '#24506b' : '#16334a';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(160,220,240,0.35)'; g.fillRect(r.x, r.y, r.w, 1);
    if (r.label) F().draw(g, r.label, r.x + r.w / 2, r.y + Math.floor((r.h - 5) / 2), r.off ? '#5f7a8c' : '#e8fbff', { align: 'center' });
  }
  A.button = button;

  function drawBars(g, tank, b) {
    // top bar
    g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, 320, 14);
    F().draw(g, (b.short || b.name), 42, 4, '#ffe9a8', { align: 'center' });
    if (A.vibe) drawStars(g, 84, 3, A.vibe.stars);
    F().draw(g, `${tank.creatures.length}/${AQ.TUNING.tank.capacity}`, 126, 4, '#8fb6cc');
    // tray
    g.fillStyle = '#0b1a2c'; g.fillRect(0, TRAY_Y - 1, 320, 32);
    for (const r of A.ui) {
      const hover = A.hover === r;
      if (r.id === 'item' || r.id === 'fish') {
        g.save(); g.beginPath(); g.rect(r.clipX.x0, r.y, r.clipX.x1 - r.clipX.x0, r.h); g.clip();
        g.fillStyle = hover ? '#24506b' : (A.holding && A.holding.id === r.ref && r.id === 'item') ? '#2e7d96' : '#132b40';
        g.fillRect(r.x, r.y, r.w, r.h);
        const e = AQ.Assets.entry(r.key);
        if (e) {
          const sc = Math.min(1, 20 / Math.max(e.fw, e.fh));
          g.save(); g.translate(r.x + r.w / 2, r.y + 12); g.scale(sc, sc);
          AQ.Assets.draw(g, r.key, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: 0 });
          g.restore();
        }
        if (r.id === 'item' && r.count !== Infinity) F().draw(g, 'x' + r.count, r.x + r.w - 1, r.y + 23, '#ffe9a8', { align: 'right' });
        if (r.locked) {
          g.fillStyle = 'rgba(8,20,34,0.72)'; g.fillRect(r.x, r.y, r.w, r.h);
          lockIcon(g, r.x + r.w / 2 - 3, r.y + 7);
          const txt = String(r.need); F().draw(g, txt, r.x + r.w / 2 - 4, r.y + 22, '#ffd25a', { align: 'center', shadow: false });
          miniStar(g, r.x + r.w / 2 - 3 + Math.ceil(F().width(txt) / 2), r.y + 22);
        }
        if (r.fresh && Math.floor(A.t * 3) % 2 === 0) F().draw(g, 'NEW', r.x + r.w / 2, r.y + 1, '#ffe08a', { align: 'center' });
        if (r.id === 'fish' && r.sex) F().draw(g, AQ.Sex.SYMBOL[r.sex], r.x + 2, r.y + 2, AQ.Sex.COLOR[r.sex], { shadow: false });
        if (r.id === 'fish' && r.variant) F().draw(g, '✦', r.x + r.w - 7, r.y + 2, '#ffd25a', { shadow: false });
        if (r.id === 'fish') F().draw(g, r.where === 'tank' ? 'IN' : 'OUT', r.x + r.w / 2, r.y + 23, r.where === 'tank' ? '#7ef0c0' : '#a8b8c8', { align: 'center' });
        g.restore();
      } else if (r.id !== 'stars') button(g, r, hover);
    }
    const items = trayItems();
    if (!items.length) F().draw(g, A.tray === 'fish' ? 'NO CREATURES FROM THIS BIOME YET' : 'NOTHING HERE YET', 178, TRAY_Y + 12, '#8aa4b8', { align: 'center' });
    if (A.hover && A.hover.id === 'stars' && A.vibe) { vibeTooltip(g, A.vibe); return; }
    // hints
    if (A.hover && (A.hover.id === 'item' || A.hover.id === 'fish')) {
      const hv = A.hover;
      tip(g, hv.id === 'fish' ? `${hv.name}: CLICK TO MOVE ${hv.where === 'tank' ? 'TO STORAGE' : 'INTO TANK'}` : hv.locked ? `${hv.name}: REACH ${hv.need} STARS IN THIS TANK TO UNLOCK` : `${hv.name}: CLICK, THEN CLICK IN TANK`, hv.x + 12, TANK.waterTop + 4, hv.locked ? '#ffcf8a' : '#fff');
    } else if (A.holding) tip(g, 'CLICK: PLACE   X: FLIP   Z: FRONT/BACK   RIGHT CLICK: STOP', 160, TANK.waterTop + 4, '#ffe9a8');
    else if (!tank.creatures.length && !tank.decor.length) tip(g, 'CATCH CREATURES FROM THIS BIOME TO FILL THIS TANK', 160, 70, '#ffffff');
    else if (inTank(AQ.Input.mouse) && fishAt(AQ.Input.mouse)) { if (!A.card) tip(g, 'CLICK A CREATURE TO LEARN ABOUT IT', 160, TANK.waterTop + 4, '#cfe8ff'); }
    else if (inTank(AQ.Input.mouse) && decorAt(tank, AQ.Input.mouse)) tip(g, 'CLICK: MOVE   RIGHT CLICK: REMOVE   X: FLIP   Z: FRONT/BACK', 160, TANK.waterTop + 4, '#cfe8ff');
    else if (A.hover && A.hover.id === 'undo') tip(g, 'UNDO LAST DECOR CHANGE (U)', 160, TANK.waterTop + 4, '#cfe8ff');
    else if (A.hover && A.hover.id === 'clear') tip(g, 'REMOVE ALL DECOR FROM THIS TANK', 160, TANK.waterTop + 4, '#cfe8ff');
    // notices (tank full, cleared, unlocks...)
    (A.notes || []).forEach((n, i) => {
      g.globalAlpha = U.clamp(Math.min(n.t * 4, (n.life - n.t) * 2), 0, 1);
      const w = F().width(n.text) + 10, y = TANK.waterTop + 16 + i * 11;
      g.fillStyle = 'rgba(6,18,34,0.85)'; g.fillRect(160 - w / 2, y - 3, w, 10);
      g.fillStyle = n.color; g.fillRect(160 - w / 2, y - 3, w, 1);
      F().draw(g, n.text, 160, y, n.color, { align: 'center', shadow: false });
      g.globalAlpha = 1;
    });
  }

  return A;
})();
