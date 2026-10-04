// Save/load: one localStorage slot, autosaved every few seconds and when leaving the aquarium/page.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Save = (function () {
  const S = { t: 0, isDirty: false };
  const key = () => AQ.TUNING.save.key;

  S.load = function () {
    try { const raw = localStorage.getItem(key()); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };
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
    try {
      localStorage.setItem(key(), JSON.stringify({ v: 1, state: AQ.State, scene: game.scene || 'world', player: { x: Math.round(game.player.x), y: Math.round(game.player.y) } }));
      S.isDirty = false;
    } catch (e) { /* storage unavailable: play continues unsaved */ }
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
    AQ.State.settings = AQ.State.settings ? { audio: AQ.State.settings.audio, hints: AQ.State.settings.hints } : {};   // sound + hints carry over
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
    try { localStorage.removeItem(key()); } catch (e) {}
    window.onbeforeunload = null;
    S.wiped = true;
    location.reload();
  };
  window.addEventListener('beforeunload', () => { if (!S.wiped && AQ.Game && AQ.Game.player) S.save(AQ.Game); });
  return S;
})();
