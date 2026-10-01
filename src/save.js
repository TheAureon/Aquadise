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
    if (data.player && AQ.World.water(data.player.x, data.player.y)) { game.player.x = data.player.x; game.player.y = data.player.y; }
  };
  S.save = function (game) {
    try {
      localStorage.setItem(key(), JSON.stringify({ v: 1, state: AQ.State, player: { x: Math.round(game.player.x), y: Math.round(game.player.y) } }));
      S.isDirty = false;
    } catch (e) { /* storage unavailable: play continues unsaved */ }
  };
  S.dirty = () => { S.isDirty = true; };
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
