// The slow-device watch: measures how long real frames take (not the game's capped dt) while you play.
// When the game runs slowly for a while (a busy or older phone), the music quietly plays fewer notes at once
// (AQ.TUNING.music.lowFxVoices, as with LOW EFFECTS), and once per save a toast suggests LOW EFFECTS. When
// frames are quick again for a while, the music goes back to normal. LOW EFFECTS on: always the lighter music.
// Frames while the tab was hidden or paused (a gap over a second) don't count. Tuning: AQ.TUNING.slowWatch.
// Saved: AQ.State.settings.slowHint = 1 once the hint has shown (a number only).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SlowWatch = (function () {
  const W = { avg: 0, last: 0, slowFor: 0, fastFor: 0, slow: false };
  const cfg = () => AQ.TUNING.slowWatch;
  W.update = function (game) {
    const now = performance.now(), gap = W.last ? now - W.last : 0;
    W.last = now;
    if (!gap || gap > 1000 || document.hidden || game.state === 'loading') return W.apply();
    const C = cfg();
    W.avg = W.avg ? W.avg + (gap - W.avg) * 0.05 : gap;              // a smoothed frame time (ms)
    const s = gap / 1000;
    if (W.avg > C.slowFrameMs) { W.slowFor += s; W.fastFor = 0; } else if (W.avg < C.fastFrameMs) { W.fastFor += s; W.slowFor = 0; }
    if (!W.slow && W.slowFor >= C.slowSeconds) { W.slow = true; W.hint(game); }
    if (W.slow && W.fastFor >= C.recoverSeconds) W.slow = false;
    W.apply();
  };
  // the music's note limit, changed live (LOW EFFECTS or a slow device: the lighter one)
  W.apply = function () {
    const mix = AQ.Music && AQ.Music.mix;
    if (mix) mix.maxVoices = AQ.U.lowFx() || W.slow ? AQ.TUNING.music.lowFxVoices : AQ.TUNING.music.maxVoices;
  };
  W.hint = function (game) {
    const set = AQ.State && AQ.State.settings;
    if (!cfg().hint || !set || set.slowHint || AQ.U.lowFx() || game.state !== 'play' || !AQ.HUD) return;
    set.slowHint = 1;
    AQ.HUD.toast(AQ.t('perf.slowHint'), '#cfe8ff', 6);
  };
  return W;
})();
