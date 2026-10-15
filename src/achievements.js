// Badges (achievements): AQ.Badges. The badges themselves are data (data/achievements.js); their text is
// badge.<id>.name / .desc in data/lang/en.js. Nothing here changes gameplay: a badge is never missable,
// timed, lost or required for anything.
//
//   AQ.Badges.event('catch', { sneaking: true, ... })   something happened (one-time event badges)
//   AQ.Badges.add('chests')         a counter the game didn't track before (+1, or + n)
//   AQ.Badges.addTo('biomes', id)   a "set" counter: how many different things (biomes visited...)
// Event badges are checked when their event happens; counters when they change; badges worked out from
// the save (species discovered, tank stars...) only every badges.checkSeconds, never per frame.
//
// Saved in AQ.State.badges: { earned: { id: { tier, at: [iso dates per tier] } }, counters, sets, seen,
// welcomed }. An older save (no badges yet) gets every badge its progress already shows, silently, and a
// single "Welcome back! You've already earned n badges" message the first time you play.
// Testing: AQ.TUNING.debug.badges (keys in config.js): award the next badge, award all, reset all, and an
// overlay with every counter.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Badges = (function () {
  const B = { t: 0, envT: 0, overlay: false, pendingWelcome: 0 };
  const cfg = () => AQ.TUNING.badges;
  const dbg = () => AQ.TUNING.debug;
  const list = () => AQ.data.badges;
  const S = () => {
    const st = AQ.State;
    if (!st.badges || typeof st.badges !== 'object') st.badges = fresh();
    const b = st.badges;
    b.earned = b.earned || {}; b.counters = b.counters || {}; b.sets = b.sets || {}; b.seen = b.seen || {};
    return b;
  };
  const fresh = () => ({ v: 1, earned: {}, counters: {}, sets: {}, seen: {}, welcomed: true });
  B.byId = (id) => list().find((b) => b.id === id) || null;

  // ---------------------------------------------------------------- the species a check counts
  const defs = () => AQ.data.creatures;
  const has = (id) => !!(AQ.State.collection || {})[id];
  const logOf = (id) => (AQ.State.log || {})[id] || {};
  const sexed = (d) => !!AQ.Sex && AQ.Sex.has(d);
  const breedable = (d) => !d.is_plant;
  function matches(d, where) {
    for (const k in where || {}) {
      const want = where[k], v = d[k];
      if (want === true ? !v : want === false ? !!v : v !== want) return false;
    }
    return true;
  }
  const seaTanks = () => (AQ.Tanks ? AQ.Tanks.list().filter((t) => t.kind === 'biome' || t.kind === 'predator') : []);
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

  // ---------------------------------------------------------------- checks (worked out from the save)
  // value(cond) = how far along; total(cond) = what 'all' means for it
  const CHECKS = {
    caught: { value: () => defs().filter((d) => !d.is_plant && has(d.id)).length },
    discovered: { value: (c) => defs().filter((d) => matches(d, c.where) && has(d.id)).length, total: (c) => defs().filter((d) => matches(d, c.where)).length },
    bothSexes: { value: () => defs().filter((d) => sexed(d) && logOf(d.id).m && logOf(d.id).f).length, total: () => defs().filter(sexed).length },
    variants: { value: () => defs().filter((d) => breedable(d) && logOf(d.id).variant).length, total: () => defs().filter(breedable).length },   // (any bred baby can be a rare color)
    bred: { value: () => defs().filter((d) => breedable(d) && logOf(d.id).bred).length, total: () => defs().filter(breedable).length },
    graduates: { value: () => sum(defs(), (d) => logOf(d.id).graduated || 0) },
    bestStars: { value: () => Math.max(0, ...Object.values(AQ.State.tankBest || {}).map(Number).filter((n) => !isNaN(n))) },
    tanksAtStars: { value: (c) => seaTanks().filter((t) => AQ.Vibe.evaluate(t.id).stars >= c.stars).length, total: () => seaTanks().length },
    expanded: { value: () => (AQ.Tanks ? AQ.Tanks.list().filter((t) => AQ.Tanks.size(t.id) > 0).length : 0) },
    photoTanks: { value: () => Object.keys(S().sets.photoTanks || {}).length, total: () => (AQ.Tanks ? AQ.Tanks.list().length : 1) },
    maxUpgrades: { value: () => UPGRADES().filter(([k, max]) => (AQ.State.upgrades[k] || 0) >= max).length, total: () => UPGRADES().length },
    upgrade: { value: (c) => AQ.State.upgrades[c.upgrade] || 0, total: (c) => (UPGRADES().find((u) => u[0] === c.upgrade) || [0, 1])[1] },
    bottles: { value: () => (AQ.Bottles ? AQ.Bottles.progress().found : 0), total: () => (AQ.Bottles ? AQ.Bottles.progress().total : 1) },
    tipSeen: { value: (c) => ((AQ.State.tutorial || {}).seen || {})[c.tip] ? 1 : 0 },
    flag: { value: (c) => ((AQ.State.flags || {})[c.flag] ? 1 : 0) },
    decorInTanks: { value: () => sum(Object.values(AQ.State.tanks || {}), (t) => (t.decor || []).length) },
    fedAny: { value: () => (Object.values(AQ.State.tanks || {}).some((t) => t.lastFed) ? 1 : 0) },
    nights: { value: () => ((AQ.State.starfall || {}).night || 0) },
    // the final goal: every species, both sexes of every species that has them, every rare variant
    aquadise: {
      value: () => CHECKS.discovered.value({}) + CHECKS.bothSexes.value() + CHECKS.variants.value(),
      total: () => CHECKS.discovered.total({}) + CHECKS.bothSexes.total() + CHECKS.variants.total()
    }
  };
  B.CHECKS = CHECKS;
  function UPGRADES() {
    const T = AQ.TUNING;
    return [['net', T.net.maxLevel], ['speed', T.speedMaxLevel], ['lantern', T.upgrades.lanternMax], ['depth', T.upgrades.depthMax], ['hydro', T.hydrophone.max]];
  }
  // counters that have a natural "all"
  const COUNTER_TOTALS = { biomes: () => AQ.World.biomes.length };
  B.COUNTER_TOTALS = COUNTER_TOTALS;

  // ---------------------------------------------------------------- progress of one badge
  B.counter = (name) => (S().sets[name] ? Object.keys(S().sets[name]).length : (S().counters[name] || 0));
  // { value, target } for a condition (+ its target, which may be 'all')
  function progressOf(cond, target) {
    let value = 0, total = null;
    if (cond.counter) { value = B.counter(cond.counter); total = COUNTER_TOTALS[cond.counter] ? COUNTER_TOTALS[cond.counter]() : null; }
    else if (cond.check) { const c = CHECKS[cond.check]; value = c ? c.value(cond) : 0; total = c && c.total ? c.total(cond) : null; }
    const t = target === 'all' ? (total == null ? 1 : Math.max(1, total)) : (target == null ? 1 : target);
    return { value, target: t };
  }
  B.tiers = (b) => b.tiers || [{ target: b.target }];
  B.tier = (id) => ((S().earned[id] || {}).tier || 0);
  B.earned = (id) => B.tier(id) > 0;
  B.maxTier = (b) => B.tiers(b).length;
  // the progress toward the next tier (or the last one, when complete); null for plain event badges
  B.progress = function (b) {
    const c = b.cond;
    if (c.event) return null;                                         // (an event either happened or not: no bar)
    const tiers = B.tiers(b), k = Math.min(B.tier(b.id), tiers.length - 1);
    return progressOf(c, tiers[k].target);
  };
  // earned (or a new tier) but not looked at yet in the log's BADGES tab: the NEW dot (saved)
  B.unseen = () => list().filter((b) => B.tier(b.id) > (S().seen[b.id] || 0)).length;
  B.isNew = (id) => B.tier(id) > (S().seen[id] || 0);
  B.markSeen = () => { let ch = false; for (const b of list()) { const t = B.tier(b.id); if (t > (S().seen[b.id] || 0)) { S().seen[b.id] = t; ch = true; } } if (ch) AQ.Save && AQ.Save.dirty(); };
  B.count = () => ({ earned: list().filter((b) => B.earned(b.id)).length, total: list().length });

  // ---------------------------------------------------------------- awarding
  // earn tiers up to `tier` (1-based). silent: no toast / sound (an older save catching up)
  function award(b, tier, silent) {
    const e = S().earned[b.id] || (S().earned[b.id] = { tier: 0, at: [] });
    if (tier <= e.tier) return false;
    const when = new Date().toISOString();
    while (e.at.length < tier) e.at.push(when);
    const from = e.tier;
    e.tier = tier;
    AQ.Save && AQ.Save.dirty();
    if (!silent) B.announce(b, tier, from);
    return true;
  }
  // ---------------------------------------------------------------- the toast + chime queue
  // A new badge (or tier) waits in a queue; one toast at a time with a short gap, each with its chime
  // (a bigger one for a higher tier or Aquadise, a hushed one for a hidden badge). Three or more waiting
  // at once become one summary ("3 new badges!"). Nothing shows during a scene change, in photo mode or
  // while a menu or dialog is open: they wait until it's free.
  B.queue = []; B.cur = null; B.gap = 0;
  const chimeOf = (b, tier) => (b.hidden ? 'badge_hidden' : (tier > 1 || b.id === 'aquadise') ? 'badge_big' : 'badge');
  B.announce = function (b, tier) { B.queue.push({ b, tier, kind: chimeOf(b, tier) }); };
  function free(game) {
    if (!game || (game.state !== 'play' && game.state !== 'aquarium')) return false;
    if (AQ.Transition && AQ.Transition.active) return false;
    if (AQ.Redo && AQ.Redo.dialog) return false;
    if (AQ.Touch && AQ.Touch.menuOpen) return false;
    const A = AQ.Aquarium;
    if (game.state === 'aquarium' && A && (A.photo.on || A.dialog)) return false;
    return true;
  }
  B.toastFree = free;
  function updateToasts(dt, game) {
    const c = cfg();
    if (!free(game)) return;                                          // (a toast up when a menu opens waits too)
    if (B.cur) { B.cur.t += dt; if (B.cur.t >= B.cur.life) { B.cur = null; B.gap = c.toastGap; } return; }
    B.gap -= dt;
    if (B.gap > 0 || !B.queue.length) return;
    if (B.queue.length >= c.summaryAt) {
      const n = B.queue.length, big = B.queue.some((q) => q.kind === 'badge_big');
      B.cur = { summary: n, kind: big ? 'badge_big' : 'badge', t: 0, life: c.toastSeconds };
      B.queue.length = 0;
    } else B.cur = Object.assign(B.queue.shift(), { t: 0, life: c.toastSeconds });
    AQ.Audio.play(B.cur.kind);
    if (AQ.Tips) AQ.Tips.event('badge'); if (AQ.Touch) AQ.Touch.buzz('unlock');   // a light buzz (touch, VIBRATION on)
  }
  // the toast box: centred, under the tip box and above the HUD toasts (y = badges.toastY)
  B.drawToastBox = function (g, q, y) {
    const F = AQ.Font, text = q.summary ? AQ.t('badge.summary', { n: q.summary }) : AQ.t('badge.toast', { name: B.name(q.b, q.tier) });
    const w = Math.min(300, F.width(text) + 26), x = Math.round(160 - w / 2), h = 16;
    const a = Math.max(0, Math.min(1, q.t * 5, (q.life - q.t) * 2.5));
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(6,18,34,0.94)'; g.fillRect(x, y, w, h);
    g.fillStyle = q.kind === 'badge_hidden' ? '#c9a8ff' : '#ffd25a'; g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(255,210,90,0.25)'; g.fillRect(x, y + h - 1, w, 1);
    if (q.summary) B.drawIcon(g, { id: '_', icon: 'crown', group: 'final' }, x + 10, y + 8, true);
    else B.drawIcon(g, q.b, x + 10, y + 8, true, q.tier);
    F.draw(g, text, x + 19, y + 5, q.kind === 'badge_big' ? '#ffe9a8' : '#fff6dc', { shadow: false, max: w - 23 });
    // a few sparkles around it (REDUCE FLASHING: still, softer ones)
    const calm = AQ.U.calm(), tt = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const on = calm || Math.floor(tt * 4 + i * 1.7) % 3 === 0;
      if (!on) continue;
      g.globalAlpha = a * (calm ? 0.35 : 0.9);
      g.fillStyle = '#fff6c8';
      const sx = i % 2 ? x + w + 2 : x - 3, sy = y + 2 + (i < 2 ? 0 : 10);
      g.fillRect(sx, sy, 1, 1); if (!calm) { g.fillRect(sx - 1, sy + 1, 3, 1); g.fillRect(sx, sy + 2, 1, 1); }
    }
    g.restore();
  };
  B.drawToast = function (g, game) {
    if (!B.cur || !free(game)) return;
    B.drawToastBox(g, B.cur, cfg().toastY);
  };

  // ---------------------------------------------------------------- icons
  // A badge's icon: the sprite 'badge.<icon>' (frame by tier mark), or a simple plaque in its group's
  // colour while there's no art. shown false: a dark silhouette (not earned yet).
  const GROUP_COL = { first: '#7ef0c0', collect: '#9fd8ff', aquarium: '#ff9fc0', breed: '#ffc890', explore: '#ffe36b', sky: '#c9a8ff', skill: '#a8f0ff', final: '#ffd25a' };
  B.TIER_COL = ['#c98a4a', '#cfd8e0', '#ffd25a', '#9ff3ff'];          // bronze, silver, gold, (a 4th tier) pale gem
  B.groupCol = (g) => GROUP_COL[g] || '#ffd25a';
  B.drawIcon = function (g, b, cx, cy, shown, tier) {
    const key = 'badge.' + b.icon, e = AQ.Assets && AQ.Assets.entry(key);
    if (e) { AQ.Assets.draw(g, key, 'idle', cx, cy, { frame: !shown ? 1 : (b.tiers && tier ? 1 + Math.min(tier, 4) : 0) }); return; }   // (the tier mark is in the art)
    else {
      g.fillStyle = shown ? '#2a2414' : '#0f1d2b'; g.fillRect(cx - 5, cy - 5, 11, 11);
      g.fillStyle = shown ? B.groupCol(b.group) : '#1d3446'; g.fillRect(cx - 4, cy - 4, 9, 9);
      g.fillStyle = shown ? '#fff6dc' : '#27455c'; g.fillRect(cx - 1, cy - 2, 3, 5);
    }
    if (shown && b.tiers && tier) { g.fillStyle = B.TIER_COL[Math.min(tier, 4) - 1]; g.fillRect(cx + 3, cy + 3, 3, 3); }   // the tier mark
  };
  // check a counter or computed badge now (and its tiers)
  function evaluate(b, silent) {
    const c = b.cond;
    if (c.event) {
      if (B.earned(b.id) || !c.also) return;
      const p = progressOf(c.also, c.also.target);
      if (p.value >= p.target) award(b, 1, silent);
      return;
    }
    const tiers = B.tiers(b);
    let k = B.tier(b.id);
    if (k >= tiers.length) return;
    const cond = c;
    let reached = k;
    while (reached < tiers.length) { const p = progressOf(cond, tiers[reached].target); if (p.value >= p.target) reached++; else break; }
    if (reached > k) award(b, reached, silent);
  }
  B.evaluateAll = function (silent) { let n = 0; for (const b of list()) { const before = B.tier(b.id); evaluate(b, silent); if (B.tier(b.id) > before) n++; } return n; };

  // ---------------------------------------------------------------- events, counters
  B.event = function (name, data = {}) {
    if (name === 'spook') { if (S().counters.gentleStreak) S().counters.gentleStreak = 0; return; }   // Gentle Hands: a catch streak with nothing startled
    if (name === 'catch') B.add('gentleStreak', 1, true);
    for (const b of list()) {
      const c = b.cond;
      if (c.event !== name || B.earned(b.id)) continue;
      if (c.match && Object.keys(c.match).some((k) => data[k] !== c.match[k])) continue;
      award(b, 1, false);
    }
    if (name === 'catch') for (const b of list()) if (b.cond.counter === 'gentleStreak') evaluate(b, false);
  };
  // counters the game didn't track before: +n, then the badges that read it are checked
  B.add = function (name, n = 1, quiet) {
    S().counters[name] = (S().counters[name] || 0) + n;
    AQ.Save && AQ.Save.dirty();
    if (!quiet) for (const b of list()) if (b.cond.counter === name) evaluate(b, false);
  };
  B.addTo = function (name, key) {
    const set = S().sets[name] || (S().sets[name] = {});
    if (set[key]) return;
    set[key] = 1;
    AQ.Save && AQ.Save.dirty();
    for (const b of list()) if (b.cond.counter === name) evaluate(b, false);
  };

  // ---------------------------------------------------------------- names
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  B.name = function (b, tier = B.tier(b.id) || 1) {
    const base = AQ.t(`badge.${b.id}.name`);
    if (!b.tiers) return base;
    if (AQ.Lang.has(`badge.${b.id}.tier${tier}`, 'en')) return AQ.t(`badge.${b.id}.tier${tier}`);
    return AQ.t('badge.tierName', { name: base, tier: ROMAN[tier] || tier });
  };
  B.desc = function (b, tier) {
    const tiers = B.tiers(b), k = Math.max(0, Math.min((tier || B.tier(b.id) + 1) - 1, tiers.length - 1));
    const cond = b.cond.event ? (b.cond.also || {}) : b.cond, p = progressOf(cond, b.cond.event ? (cond.target || 1) : tiers[k].target);
    return AQ.t(`badge.${b.id}.desc`, { n: p.target });
  };

  // ---------------------------------------------------------------- an older save: catch up silently
  // Counters that were never tracked start from what the save shows (at least), or 0.
  function seedCounters() {
    const c = S().counters, sets = S().sets, st = AQ.State, up = st.upgrades || {};
    const gained = (up.net || 1) - 1 + (up.speed || 1) - 1 + (up.lantern || 0) + (up.depth || 0) + (up.hydro || 0);
    c.chests = Math.max(c.chests || 0, gained);                       // every upgrade came from a chest
    let spent = 0;
    if (AQ.Tanks) for (const t of AQ.Tanks.list()) for (let l = 0; l < AQ.Tanks.size(t.id); l++) spent += AQ.TUNING.tank.expandCost[l] || 0;
    c.panes = Math.max(c.panes || 0, (st.panes || 0) + spent);       // panes still here + panes built into tanks
    const decor = Object.values(st.tanks || {}).flatMap((t) => t.decor || []);
    c.decorPlaced = Math.max(c.decorPlaced || 0, decor.length);
    sets.decorTypes = sets.decorTypes || {}; decor.forEach((d) => { sets.decorTypes[d.id] = 1; });
    const nt = AQ.Nursery ? AQ.Nursery.tank() : { creatures: [], eggs: [] };
    c.births = Math.max(c.births || 0, CHECKS.graduates.value() + (nt.creatures || []).length);
    sets.biomes = sets.biomes || {};
    defs().forEach((d) => { if (has(d.id) && AQ.World.biomeById[d.biome]) sets.biomes[d.biome] = 1; });   // where its catches came from
    if (has('glasswinged_minnow') || Object.keys(st.collection || {}).length) sets.biomes.tide_pools = 1;
  }
  // called when a game loads or starts (Save.apply / newGame / a fresh boot)
  B.loaded = function (fromOlderSave) {
    if (fromOlderSave) {
      AQ.State.badges = fresh();
      AQ.State.badges.welcomed = false;
      seedCounters();
      const n = B.evaluateAll(true);
      Object.keys(S().earned).forEach((id) => { S().seen[id] = S().earned[id].tier; });   // nothing "new" to look at
      B.pendingWelcome = n;
      if (!n) AQ.State.badges.welcomed = true;
    } else { S(); B.pendingWelcome = S().welcomed === false ? B.count().earned : 0; }   // (closed before the welcome showed: it waits)
    B.t = 0;
  };
  B.newGame = function () { AQ.State.badges = fresh(); B.pendingWelcome = 0; };

  // ---------------------------------------------------------------- every frame (cheap)
  B.update = function (dt, game) {
    debugKeys(game);
    if (!game || game.state === 'title' || game.state === 'loading') return;
    updateToasts(dt, game);
    // the one-time "welcome back" (once you're actually playing)
    if (B.pendingWelcome && game.state === 'play' && !(AQ.Transition && AQ.Transition.active)) {
      if (AQ.HUD) AQ.HUD.toast(AQ.t('badge.welcomeBack', { n: B.pendingWelcome }), '#ffe36b', 6);
      B.pendingWelcome = 0; S().welcomed = true; AQ.Save && AQ.Save.dirty();
    }
    // things that are simply "being there" (a few times a second, not every frame)
    B.envT -= dt;
    if (B.envT <= 0 && game.state === 'play' && game.scene === 'world') {
      B.envT = cfg().envSeconds;
      const C = AQ.Clock, P = game.player;
      if (C && C.isNight()) B.event('night');
      if (C && C.phase() === 'dawn') B.event('sunrise');
      if (C && C.isNight() && AQ.Starfall && AQ.Starfall.showerTonight()) B.event('shower');
      if (P && P.y >= cfg().deepestY && AQ.World.water(P.x, P.y)) B.event('deepest');
    }
    // the badges worked out from the save: every few seconds
    B.t -= dt;
    if (B.t <= 0) { B.t = cfg().checkSeconds; B.evaluateAll(false); }
  };

  // ---------------------------------------------------------------- testing (AQ.TUNING.debug.badges)
  function debugKeys(game) {
    const d = dbg();
    if (!d.badges) return;
    const I = AQ.Input;
    if (I.wasPressed(d.badgeNextKey)) {
      const b = list().find((x) => B.tier(x.id) < B.maxTier(x));
      if (b) award(b, B.tier(b.id) + 1, false); else if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.badgesAll'), '#cfe8ff');
    }
    if (I.wasPressed(d.badgeAllKey)) { list().forEach((b) => award(b, B.maxTier(b), false)); if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.badgesAwarded'), '#cfe8ff'); }   // (a summary toast)
    if (I.wasPressed(d.badgeResetKey)) { const keep = { counters: S().counters, sets: S().sets }; AQ.State.badges = Object.assign(fresh(), keep); B.queue.length = 0; B.cur = null; if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.badgesReset'), '#cfe8ff'); B.t = cfg().checkSeconds; }
    if (I.wasPressed(d.badgeOverlayKey)) B.overlay = !B.overlay;
  }
  // the counters overlay (testing only)
  B.drawOverlay = function (g) {
    if (!B.overlay || !dbg().badges) return;
    const F = AQ.Font, rows = [];
    const c = S().counters, sets = S().sets;
    Object.keys(c).sort().forEach((k) => rows.push(`${k}: ${c[k]}`));
    Object.keys(sets).sort().forEach((k) => rows.push(`${k}: ${Object.keys(sets[k]).length} (SET)`));
    for (const name of Object.keys(CHECKS)) { if (name === 'tanksAtStars' || name === 'tipSeen' || name === 'flag' || name === 'upgrade') continue; const ch = CHECKS[name]; rows.push(`${name}: ${ch.value({})}${ch.total ? '/' + ch.total({}) : ''}`); }
    const n = B.count();
    rows.unshift(`BADGES ${n.earned}/${n.total}`);
    g.fillStyle = 'rgba(4,10,20,0.82)'; g.fillRect(200, 20, 118, rows.length * 6 + 4);
    rows.forEach((r, i) => F.draw(g, r.toUpperCase(), 203, 22 + i * 6, i ? '#ff9fe8' : '#ffe36b', { shadow: false, max: 112 }));
  };
  return B;
})();
