// How the weather sounds (src/weather.js decides what the weather is). A few soft layers on the ambience
// bus, under the place's own bed, each following the weather where you are:
//   rain     above the water: a bright hiss and a patter of drops; from below the surface: a low drumming
//            and soft plinks, fading out as you dive deeper (rain isn't heard far down)
//   wind     a breathy rush with slow gusts (breezy, choppy, storms); much quieter under water
//   waves    a heavier wash in rough water
//   thunder  a low rumble a moment after each lightning flash (or REDUCE FLASHING's glow); farther = later
//   static   a faint crackle in the hydrophone while you LISTEN in a storm
// Everything is on the effects / ambience volume and muffled under water like the rest. Thunder is a
// normal effect ('thunder', in the Sound Test), so a real recording can replace it (docs/ADDING_SOUNDS.md).
// The Sound Test's AMBIENCE tab plays each one on its own (wx_* there). Tuning: AQ.TUNING.weather.sound.
// LANG_PREFIX: 'amb.wx_'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.WeatherSound = (function () {
  const A = AQ.Audio, H = A.H;
  const S = { built: false, last: {}, patter: 0, plink: 0, lastBolt: 0 };
  const cfg = () => AQ.TUNING.weather.sound;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // the Sound Test's entries (AMBIENCE tab): each weather's sound on its own
  const TESTS = { wx_breezy: 'breezy', wx_choppy: 'choppy', wx_rain: 'rain', wx_rain_below: 'rain', wx_storm: 'storm' };
  Object.keys(TESTS).forEach((id) => A.register('amb:' + id, { kind: 'amb', bed: id }));   // names: amb.wx_* in data/lang/

  // a looping noise through a filter into its own gain (silent until the weather asks)
  function layer(c, out, type, f, q) {
    const src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(g); g.connect(out); src.start(c.currentTime, Math.random() * 3);
    return { src, fl, g };
  }
  function lfo(c, rate, depth, target) {
    const o = c.createOscillator(), g = c.createGain(); o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(target); o.start(); return o;
  }
  function build() {
    const c = A.ctx;
    S.out = c.createGain(); S.out.gain.value = 1;
    S.lp = c.createBiquadFilter(); S.lp.type = 'lowpass'; S.lp.frequency.value = 18000; S.lp.Q.value = 0.5;   // (the "from below" test)
    S.out.connect(S.lp); S.lp.connect(A.ambBus);
    S.hiss = layer(c, S.out, 'highpass', 2600, 0.6);
    S.drum = layer(c, S.out, 'lowpass', 240, 0.8);
    S.wind = layer(c, S.out, 'bandpass', 420, 0.9);
    lfo(c, 0.09, 180, S.wind.fl.frequency);                        // gusts: the wind's colour drifts...
    S.windSwell = c.createGain(); S.windSwell.gain.value = 0.75; S.wind.g.disconnect(); S.wind.g.connect(S.windSwell); S.windSwell.connect(S.out);
    lfo(c, 0.13, 0.25, S.windSwell.gain);                          // ...and it swells and eases
    S.wash = layer(c, S.out, 'lowpass', 650, 0.7);
    S.washSwell = c.createGain(); S.washSwell.gain.value = 0.6; S.wash.g.disconnect(); S.wash.g.connect(S.washSwell); S.washSwell.connect(S.out);
    lfo(c, 0.16, 0.4, S.washSwell.gain);                           // waves rolling in
    S.static = layer(c, A.sfxBus, 'bandpass', 1300, 0.8);          // (the effects bus: LISTEN ducks the ambience)
    S.built = true;
  }
  // a gain only changes when it really does (no flood of automation)
  function set(name, node, v, tau = 0.4) {
    if (S.last[name] != null && Math.abs(S.last[name] - v) < 0.002) return;
    S.last[name] = v; node.gain.setTargetAtTime(v, A.ctx.currentTime, tau);
  }

  S.update = function (dt, game) {
    if (!A.ready || !A.noiseBuf) return;
    if (!S.built) build();
    const C = cfg(), testId = AQ.Ambience && AQ.Ambience.test, test = testId && TESTS[testId];
    let m = AQ.Weather ? AQ.Weather.mix : {}, under = !!A.under, near = 1;
    if (test) { m = AQ.data.weather.kinds[test]; under = testId === 'wx_rain_below'; }
    else if (testId || !AQ.Weather || game.state === 'soundtest') m = {};
    if (!test && game.scene === 'world' && under) near = clamp(1 - (game.player.y - AQ.World.sea) / C.hearDepth, 0, 1);   // deeper: less of the weather
    const rain = m.rain || 0, wind = m.wind || 0, wave = m.wave || 0, storm = m.storm || 0;
    S.lp.frequency.setTargetAtTime(test && under ? AQ.TUNING.audio.underwaterCutoff : 18000, A.ctx.currentTime, 0.1);
    set('hiss', S.hiss.g, rain * C.rainHiss * (under ? 0.2 * near : 1));
    set('drum', S.drum.g, under ? rain * C.rainDrum * near : rain * C.rainDrum * 0.15);
    // the wind only blows above the water (a breezy day without rain still has some)
    set('wind', S.wind.g, Math.max(0, wind - 0.15) * C.wind * (under ? 0.25 * near : 1));
    set('wash', S.wash.g, wave * C.waves * (under ? 0.5 * near : 1));
    const listening = AQ.Hydro ? AQ.Hydro.k || 0 : 0;
    set('static', S.static.g, storm * listening * C.listenStatic, 0.15);
    // drops: a patter above, soft plinks from below
    if (rain > 0.02 && !A.settings().mute) {
      if (!under) {
        S.patter += dt * rain * C.patterPerSecond;
        for (; S.patter >= 1; S.patter--) H.noise(A.ctx, S.out, A.ctx.currentTime + rnd(0.01, 0.06), { ft: 'bandpass', f: rnd(2200, 6500), q: 1.2, a: 0.001, d: rnd(0.005, 0.012), v: rnd(0.015, 0.045) * C.patter });
      } else if (near > 0.05) {
        S.plink += dt * rain * near * C.plinksPerSecond;
        for (; S.plink >= 1; S.plink--) { const f = rnd(380, 900); H.tone(A.ctx, S.out, A.ctx.currentTime + rnd(0.01, 0.08), { f, f2: f * 1.6, d: 0.04, v: rnd(0.012, 0.03) * C.plinks * near }); }
      }
    }
    // thunder after each lightning flash (or glow): the farther, the later and the softer
    const W = AQ.Weather;
    if (W && W.lastBolt && W.lastBolt !== S.lastBolt) {
      S.lastBolt = W.lastBolt;
      const far = Math.random(), k = (test ? 1 : near) * (1 - far * 0.45);
      A.play('thunder', { delay: 0.5 + far * 2.8, vol: C.thunder * k * Math.max(0.4, storm), important: true });
    }
    if (test === 'storm' && W) {                                   // (the Sound Test's storm: thunder now and then)
      S.testBolt = (S.testBolt == null ? 3 : S.testBolt) - dt;
      if (S.testBolt <= 0) { S.testBolt = rnd(7, 14); W.lastBolt = Date.now(); }
    }
  };
  // the hydrophone in a storm: calls sound quieter and duller (what you can hear and the ripples stay the same)
  S.callVol = () => 1 - (AQ.Weather ? AQ.Weather.mix.storm : 0) * cfg().stormCallQuieter;
  S.callDull = () => 1 - (AQ.Weather ? AQ.Weather.mix.storm : 0) * cfg().stormCallDuller;
  return S;
})();
