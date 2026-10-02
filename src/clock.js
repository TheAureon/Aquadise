// The day/night clock. One calm, short day (AQ.TUNING.clock.dayMinutes real minutes), saved with the
// game. 0..24 "hours"; dawn and dusk fade smoothly. One clock for the whole game: it keeps running on
// the hill (whose sky follows it too) and in the aquarium building.
//   AQ.Clock.hour()      0..24
//   AQ.Clock.daylight()  1 = full day ... 0 = deep night (smooth through dawn and dusk)
//   AQ.Clock.phase()     'dawn' | 'day' | 'dusk' | 'night'
//   AQ.Clock.isNight()   night-only creatures are out (daylight below AQ.TUNING.clock.nightBelow)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Clock = (function () {
  const K = {};
  const cfg = () => AQ.TUNING.clock;
  const st = () => (AQ.State.clock = AQ.State.clock || { hour: cfg().startHour });
  const smooth = (t) => t * t * (3 - 2 * t);

  K.hour = () => st().hour;
  K.set = (h) => { st().hour = ((h % 24) + 24) % 24; };
  K.update = function (dt) { K.set(st().hour + dt * 24 / (cfg().dayMinutes * 60)); };

  K.daylight = function (h = K.hour()) {
    const c = cfg();
    if (h >= c.dawnHour && h < c.dawnHour + c.dawnHours) return smooth((h - c.dawnHour) / c.dawnHours);
    if (h >= c.dawnHour + c.dawnHours && h < c.duskHour) return 1;
    if (h >= c.duskHour && h < c.duskHour + c.duskHours) return 1 - smooth((h - c.duskHour) / c.duskHours);
    return 0;
  };
  K.phase = function (h = K.hour()) {
    const c = cfg();
    if (h >= c.dawnHour && h < c.dawnHour + c.dawnHours) return 'dawn';
    if (h >= c.dawnHour + c.dawnHours && h < c.duskHour) return 'day';
    if (h >= c.duskHour && h < c.duskHour + c.duskHours) return 'dusk';
    return 'night';
  };
  K.isNight = () => K.daylight() < cfg().nightBelow;
  // how "twilight-y" it is right now (0..1): warm tint at dawn and dusk
  K.twilight = function () { const d = K.daylight(); const p = K.phase(); return p === 'dawn' || p === 'dusk' ? Math.sin(d * Math.PI) : 0; };

  // Is this creature out right now? (`active: 'night' | 'day'` in data/creatures.js; default always)
  K.activeFor = (def) => !def.active || (def.active === 'night' ? K.isNight() : !K.isNight());

  return K;
})();
