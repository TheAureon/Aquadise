// Save/load: one localStorage slot, autosaved every few seconds and when leaving the aquarium/page.
// Safety: before the save is overwritten the previous good one is kept as a backup (key + '.backup').
// If the save can't be read, nothing overwrites it until the player chooses (restore the backup or start
// fresh; src/savefile.js shows the choice). If the browser blocks storage the game keeps running unsaved
// and says so (export still works). Files (export / import) live in src/savefile.js.
// Format: { game: 'aquadise', v: VERSION, savedAt, state, scene, player }. v1 saves (no `game`) still load.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Save = (function () {
  const S = { t: 0, isDirty: false, VERSION: 2, blocked: false, failed: false, status: 'none', backup: null };
  const key = () => AQ.TUNING.save.key;
  const backupKey = () => key() + '.backup';
  const ls = () => { try { return window.localStorage; } catch (e) { return null; } };   // access itself can throw (blocked storage)

  // Is this parsed object a save this build can load? (also used for imported files)
  S.check = function (d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return 'notsave';
    if (d.game != null && d.game !== 'aquadise') return 'notsave';
    if (d.game == null && d.v !== 1) return 'notsave';                         // only the original v1 saves had no `game`
    if (typeof d.v !== 'number' || d.v < 1 || Math.floor(d.v) !== d.v) return 'damaged';
    if (d.v > S.VERSION) return 'newer';
    const st = d.state, obj = (o) => o == null || (typeof o === 'object' && !Array.isArray(o));
    if (!st || typeof st !== 'object' || Array.isArray(st)) return 'damaged';
    if (!['collection', 'plants', 'tanks', 'upgrades', 'unlocks', 'tankBest', 'settings', 'log', 'flags', 'bottles', 'clock', 'starfall', 'tutorial'].every((k) => obj(st[k]))) return 'damaged';
    if (st.collection && Object.values(st.collection).some((n) => typeof n !== 'number')) return 'damaged';
    if (st.tanks && Object.values(st.tanks).some((t) => !t || typeof t !== 'object' || (t.creatures != null && !Array.isArray(t.creatures)))) return 'damaged';
    if (st.clock && st.clock.hour != null && typeof st.clock.hour !== 'number') return 'damaged';
    return 'ok';
  };
  // JSON without prototype tricks (a save is plain data)
  S.parse = (text) => JSON.parse(text, (k, v) => (k === '__proto__' || k === 'constructor' || k === 'prototype' ? undefined : v));
  function read(k) {
    const store = ls();
    if (!store) return { status: 'blockedread' };
    let raw = null;
    try { raw = store.getItem(k); } catch (e) { return { status: 'blockedread' }; }
    if (raw == null) return { status: 'none' };
    try { const d = S.parse(raw); return S.check(d) === 'ok' ? { status: 'ok', data: d, raw } : { status: 'corrupt', raw }; } catch (e) { return { status: 'corrupt', raw }; }
  }
  // Boot: the save, or null. An unreadable save blocks saving until the player decides (S.blocked).
  S.load = function () {
    const main = read(key());
    S.status = main.status;
    if (main.status === 'ok') return main.data;
    if (main.status === 'corrupt') {
      S.blocked = true;                                                       // never overwrite it without asking
      const b = read(backupKey());
      S.backup = b.status === 'ok' ? b.data : null;
    }
    if (main.status === 'blockedread') S.failed = true;
    return null;
  };
  // the current game as a save object (also what EXPORT SAVE writes)
  S.snapshot = (game) => ({ game: 'aquadise', v: S.VERSION, savedAt: new Date().toISOString(), state: AQ.State, scene: game.scene || 'world', player: { x: Math.round(game.player.x), y: Math.round(game.player.y) } });
  S.apply = function (data, game) {
    if (!data || !data.state) return;
    const st = data.state;
    AQ.State.collection = st.collection || {};
    AQ.State.plants = st.plants || {};
    AQ.State.tanks = st.tanks || {};
    AQ.State.upgrades = Object.assign({ net: 1, speed: 1, lantern: 0, depth: 0 }, st.upgrades || {});   // older saves: new upgrades at 0
    AQ.State.unlocks = st.unlocks || {};      // older saves: nothing unlocked yet, best stars 0
    AQ.State.tankBest = st.tankBest || {};
    AQ.State.settings = st.settings || {};   // player options (e.g. the building's zoomed-out view)
    AQ.State.log = st.log || {};
    S.renameSpecies(RENAMED);                 // species that were replaced: carry progress over (see RENAMED)
    // predators moved out of the biome tanks into their own tanks (4th floor): move any old ones over
    if (AQ.Tanks) AQ.Tanks.migrate();
    AQ.State.flags = st.flags || {};
    AQ.State.bottles = st.bottles || {};       // older saves: no bottles found yet
    AQ.State.clock = st.clock && typeof st.clock.hour === 'number' ? st.clock : { hour: AQ.TUNING.clock.startHour };   // saves keep their time (very old ones without a clock start mid-morning)
    // falling stars (night count, tonight's plan, stars still waiting); older saves start at night 0
    const sf = st.starfall;
    AQ.State.starfall = sf && typeof sf.night === 'number' ? Object.assign({ lastStar: 0, phase: null, plan: null }, sf, { landings: Array.isArray(sf.landings) ? sf.landings : [] }) : { night: 0, lastStar: 0, phase: null, plan: null, landings: [] };
    // tutorial: older saves (no tutorial yet) never see the guided dive, and skip every tip their own
    // progress shows they already know (AQ.Tips.inferFromProgress)
    if (st.tutorial && st.tutorial.seen) AQ.State.tutorial = st.tutorial;
    else { AQ.State.tutorial = { seen: {}, diveAsked: true }; if (AQ.Tips) AQ.Tips.inferFromProgress(); }
    if (AQ.Sex) AQ.Sex.migrate();              // older saves: give caught creatures a sex, fill ♂/♀ log slots
    // where you were: scene + spot (older saves have no scene -> the sea world). Validated against
    // that scene's map at boot (AQ.Scenes.restore), which falls back to a safe spot if needed.
    game.scene = (data.scene && AQ.Scenes.list[data.scene]) ? data.scene : 'world';
    if (data.player) { game.player.x = data.player.x; game.player.y = data.player.y; }
  };
  S.save = function (game) {
    if (S.blocked || S.wiped) return false;                                     // an unreadable save waits for the player's choice
    const store = ls();
    try {
      if (!store) throw new Error('no storage');
      // keep the previous good save as a backup before writing the new one
      const prev = store.getItem(key());
      if (prev) { try { if (S.check(S.parse(prev)) === 'ok') store.setItem(backupKey(), prev); } catch (e) { /* unreadable: never copied over the backup */ } }
      store.setItem(key(), JSON.stringify(S.snapshot(game)));
      S.isDirty = false;
      if (S.failed) { S.failed = false; if (AQ.HUD) AQ.HUD.toast('Saving works again.', '#8ff0b0', 3); }
      return true;
    } catch (e) {
      // storage blocked or full (e.g. private browsing): play continues unsaved, with a friendly note once
      if (!S.failed && AQ.HUD) AQ.HUD.toast('Progress can\'t be saved right now. EXPORT SAVE still works.', '#ffcf8a', 5);
      S.failed = true;
      return false;
    }
  };
  // write a validated save object as the save (import / restore): the old save becomes the backup
  S.writeRaw = function (data) {
    const store = ls();
    if (!store) return false;
    try {
      const prev = store.getItem(key());
      if (prev) { try { if (S.check(S.parse(prev)) === 'ok') store.setItem(backupKey(), prev); else store.setItem(key() + '.unreadable', prev); } catch (e) { store.setItem(key() + '.unreadable', prev); } }
      store.setItem(key(), JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  };
  // the player chose to start fresh instead of restoring: the unreadable save is kept aside, never lost
  S.setAsideUnreadable = function () {
    const store = ls();
    try { const raw = store && store.getItem(key()); if (raw) store.setItem(key() + '.unreadable', raw); store && store.removeItem(key()); } catch (e) {}
    S.blocked = false;
  };
  S.dirty = () => { S.isDirty = true; };

  // Old species id -> the species that replaced it. Everything saved under the old id (catch count,
  // log sexes, bred / rare marks, tank + storage creatures, eggs, courting pairs) moves to the new one.
  // The removed lush-cave species was pale pink (#f5c6d6), so it becomes the pink Azalea Axolotl.
  const RENAMED = { cavepetalia: 'azalea_axolotl' };
  S.renameSpecies = function (map) {
    const st = AQ.State;
    for (const from in map) {
      const to = map[from];
      if (st.collection && st.collection[from]) { st.collection[to] = (st.collection[to] || 0) + st.collection[from]; delete st.collection[from]; }
      if (st.log && st.log[from]) { st.log[to] = Object.assign({}, st.log[from], st.log[to] || {}); delete st.log[from]; }
      for (const id in st.tanks || {}) {
        const t = st.tanks[id];
        ['creatures', 'storage', 'eggs'].forEach((k) => (t[k] || []).forEach((e) => { if (e.id === from) e.id = to; }));
        if (t.court && t.court.id === from) t.court.id = to;
      }
    }
  };
  // Fresh start without reloading the page (title screen > New Game).
  S.newGame = function (game) {
    AQ.State.collection = {}; AQ.State.plants = {}; AQ.State.tanks = {}; AQ.State.unlocks = {}; AQ.State.tankBest = {}; AQ.State.log = {}; AQ.State.flags = {}; AQ.State.bottles = {};
    const keep = AQ.State.settings || {};                            // player options carry over: sound, hints, reduce flashing
    AQ.State.settings = { audio: keep.audio, hints: keep.hints, reduceFlashing: keep.reduceFlashing };
    AQ.State.clock = { hour: AQ.TUNING.clock.startHour };          // a new game starts in the bright mid-morning
    AQ.State.starfall = { night: 0, lastStar: 0, phase: null, plan: null, landings: [] };
    if (AQ.Creatures) AQ.Creatures.list.filter((c) => c.landing).forEach((c) => { c.fadedOut = true; AQ.Creatures.remove(c); });   // no stars waiting in a new game
    AQ.State.upgrades = { net: 1, speed: 1, lantern: 0, depth: 0 };
    game.upgrades = AQ.State.upgrades;
    const st = AQ.data.world.playerStart, P = game.player;
    P.x = st[0]; P.y = st[1]; P.vx = P.vy = 0; P.speedLevel = 1;
    game.scene = 'world'; P.climbing = null;
    if (AQ.Aquarium) { AQ.Aquarium.fish = []; AQ.Aquarium.biome = null; }
    S.save(game);
  };
  S.tick = function (dt, game) {
    S.t += dt;
    if (S.t >= AQ.TUNING.save.autosaveEvery) { S.t = 0; S.save(game); }
  };
  S.reset = function () {
    try { const store = ls(); store && store.removeItem(key()); } catch (e) {}
    window.onbeforeunload = null;
    S.wiped = true;
    location.reload();
  };
  window.addEventListener('beforeunload', () => { if (!S.wiped && AQ.Game && AQ.Game.player) S.save(AQ.Game); });
  return S;
})();
