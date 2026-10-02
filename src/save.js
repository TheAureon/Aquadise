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
    AQ.State.upgrades = Object.assign({ net: 1, speed: 1 }, st.upgrades || {});
    AQ.State.unlocks = st.unlocks || {};      // older saves: nothing unlocked yet, best stars 0
    AQ.State.tankBest = st.tankBest || {};
    AQ.State.settings = st.settings || {};   // player options (e.g. the building's zoomed-out view)
    // predators moved out of the biome tanks into their own tanks (4th floor): move any old ones over
    if (AQ.Tanks) AQ.Tanks.migrate();
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
  // Fresh start without reloading the page (title screen > New Game).
  S.newGame = function (game) {
    AQ.State.collection = {}; AQ.State.plants = {}; AQ.State.tanks = {}; AQ.State.unlocks = {}; AQ.State.tankBest = {}; AQ.State.settings = {};
    AQ.State.upgrades = { net: 1, speed: 1 };
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
