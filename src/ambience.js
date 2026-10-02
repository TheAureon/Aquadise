// Ambience: a quiet looping "bed" of sound for each place (waves in the tide pools, drips in caves,
// crickets on the hill...), made from filtered noise and soft tones, plus small events that happen
// now and then (a distant gull, a drip, a whale-like note). Beds crossfade as you move between places.
//
//   AQ.Ambience.register(id, { label, layers: [...], events: [...] })     registered as 'amb:<id>'
//     layer: { noise: { ft, f, q }, v, lfo: { rate, depth, filter } }  or  { tone: { f, type }, v, lfo }
//            param: 'beam' | 'water'  -> its level follows AQ.Ambience.set(param, 0..1)
//     event: { every: [minSec, maxSec], fn(ctx, out, t, bed) }
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Ambience = (function () {
  const A = AQ.Audio, H = A.H, m = H.midi;
  const B = { beds: {}, current: null, fading: [], test: null, params: { beam: 0, water: 0 } };
  const cfg = () => AQ.TUNING.audio;
  const rnd = (a, b) => a + Math.random() * (b - a);

  B.register = function (id, def) {
    B.beds[id] = Object.assign({ id, layers: [], events: [] }, def);
    A.register('amb:' + id, { kind: 'amb', label: def.label, bed: id });
  };

  // ---------------------------------------------------------------- one playing bed
  function startBed(id, fade) {
    const def = B.beds[id], c = A.ctx;
    if (!def) return null;
    const out = c.createGain(), t = c.currentTime;
    out.connect(A.ambBus);
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fade));
    const bed = { id, def, out, sources: [], params: [], timers: def.events.map((e) => rnd(e.every[0] * 0.3, e.every[1])) };
    const file = AQ.data.audioFiles && AQ.data.audioFiles['amb:' + id];
    if (file) { bed.file = A.loopFile(file, out); bed.timers = []; return bed; }
    def.layers.forEach((L) => {
      const g = c.createGain(); g.gain.value = L.param ? 0 : L.v; g.connect(out);
      let src, node;
      if (L.noise) {
        src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
        const f = c.createBiquadFilter(); f.type = L.noise.ft || 'lowpass'; f.frequency.value = L.noise.f; f.Q.value = L.noise.q || 0.7;
        src.connect(f); node = f;
        if (L.lfo && L.lfo.filter) { const lo = lfo(c, L.lfo.rate, L.noise.f * L.lfo.filter); lo.connect(f.frequency); bed.sources.push(lo.src); }
      } else {
        src = c.createOscillator(); src.type = L.tone.type || 'sine'; src.frequency.value = L.tone.f;
        if (L.tone.detune) src.detune.value = L.tone.detune;
        node = src;
      }
      if (L.lfo && L.lfo.depth) {                  // slow swell in loudness (waves, sway, breeze)
        const wob = c.createGain(); wob.gain.value = 1 - L.lfo.depth / 2;
        const lo = lfo(c, L.lfo.rate, L.lfo.depth / 2); lo.connect(wob.gain); bed.sources.push(lo.src);
        node.connect(wob); wob.connect(g);
      } else node.connect(g);
      src.start(t, L.noise ? Math.random() * 3 : 0);
      bed.sources.push(src);
      if (L.param) bed.params.push({ name: L.param, g, v: L.v });
    });
    return bed;
  }
  function lfo(c, rate, depth) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rate; g.gain.value = depth; o.connect(g); o.start(c.currentTime + Math.random() * 0.1);
    g.src = o;
    return g;
  }
  function stopBed(bed, fade) {
    if (!bed) return;
    const t = A.ctx.currentTime, g = bed.out.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.linearRampToValueAtTime(0.0001, t + fade);
    bed.stopping = true;
    if (bed.file) bed.file.stop(fade);
    bed.sources.forEach((s) => { try { s.stop(t + fade + 0.1); } catch (e) {} });
    setTimeout(() => { try { bed.out.disconnect(); } catch (e) {} }, (fade + 0.5) * 1000);
  }
  function tickBed(bed, dt) {
    const t = A.ctx.currentTime;
    bed.params.forEach((p) => {
      const v = p.v * (B.params[p.name] || 0);
      if (p.last == null || Math.abs(v - p.last) > 0.004) { p.last = v; p.g.gain.setTargetAtTime(v, t, 0.3); }
    });
    bed.def.events.forEach((e, i) => {
      bed.timers[i] -= dt;
      if (bed.timers[i] > 0) return;
      bed.timers[i] = rnd(e.every[0], e.every[1]);
      if (e.when && !e.when()) return;
      try { e.fn(A.ctx, bed.out, t + 0.05, bed); } catch (err) {}
    });
  }

  // ---------------------------------------------------------------- director
  B.start = function () { B.started = true; };
  B.set = (name, v) => { B.params[name] = Math.max(0, Math.min(1, v)); };
  B.wanted = function (game) {
    if (B.test) return B.test;
    const st = game.state;
    if (st === 'soundtest') return B.current ? B.current.id : null;
    if (st === 'aquarium' || (st === 'log' && AQ.LogUI.from === 'aquarium')) { B.set('water', 0.8); return 'station'; }
    if (st === 'title' || (st === 'log' && AQ.LogUI.from === 'title')) { const b = AQ.World.biomeAt(AQ.Camera.x, AQ.Camera.y); return b && B.beds[b.id] ? b.id : 'coral'; }
    if (game.scene === 'hill') return 'hill';
    if (game.scene === 'station') return 'station';
    const P = game.player, b = AQ.World.biomeAt(P.x, P.y);
    return b && B.beds[b.id] ? b.id : 'tide_pools';
  };
  B.update = function (dt, game) {
    if (!A.ready || !game) return;
    const want = B.wanted(game);
    if (A.settle(B, B.current ? B.current.id : null, want, dt, !!B.test || game.scene !== 'world')) {
      const fade = cfg().crossfadeSeconds;
      if (B.current) stopBed(B.current, fade);
      B.current = want ? startBed(want, B.current ? fade : 2) : null;
    }
    if (B.current) tickBed(B.current, dt);
  };

  // ---------------------------------------------------------------- little event sounds
  const drip = (c, o, t, f = rnd(900, 1500)) => {
    const g = c.createGain(); g.gain.value = 1; g.connect(o); g.connect(A.echo);       // drips echo
    H.tone(c, g, t, { f, f2: f * 0.5, d: 0.07, v: rnd(0.04, 0.08) });
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 3000);
  };
  const bubbleRun = (c, o, t, n = 4) => { for (let i = 0; i < n; i++) { const f = rnd(200, 420); H.tone(c, o, t + i * rnd(0.05, 0.12), { f, f2: f * 1.9, d: 0.05, v: 0.04 }); } };
  const creak = (c, o, t, f = rnd(80, 110), v = 0.04) => {
    H.tone(c, o, t, { type: 'sawtooth', f, f2: f * rnd(1.15, 1.4), glide: 0.7, a: 0.2, d: 0.6, v, lp: 450, q: 5 });
  };

  // ---------------------------------------------------------------- the beds
  B.register('tide_pools', {
    label: 'TIDE POOLS',
    layers: [
      { noise: { ft: 'lowpass', f: 650 }, v: 0.08, lfo: { rate: 0.12, depth: 0.85 } },                // lapping waves
      { noise: { ft: 'bandpass', f: 2400, q: 0.6 }, v: 0.03, lfo: { rate: 0.12, depth: 0.95 } }       // foam fizz on each wave
    ],
    events: [{ every: [14, 32], fn: (c, o, t) => {                                                   // a distant gull
      for (let i = 0; i < 2; i++) H.tone(c, o, t + i * 0.32, { f: 1500, f2: 1050, glide: 0.25, a: 0.03, d: 0.25, v: 0.025, lp: 2400, type: 'triangle' });
    } }]
  });
  B.register('kelp', {
    label: 'KELP FOREST',
    layers: [{ noise: { ft: 'lowpass', f: 320 }, v: 0.25, lfo: { rate: 0.07, depth: 0.6, filter: 0.3 } }],
    events: [{ every: [4, 10], fn: (c, o, t) => creak(c, o, t) }]
  });
  B.register('coral', {
    label: 'CORAL SHELF',
    layers: [{ noise: { ft: 'lowpass', f: 450 }, v: 0.14, lfo: { rate: 0.09, depth: 0.4 } }],
    events: [{ every: [0.12, 0.5], fn: (c, o, t) => {                                                // soft crackling
      for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++) H.noise(c, o, t + i * rnd(0.01, 0.04), { ft: 'highpass', f: rnd(3500, 6000), a: 0.001, d: 0.008, v: rnd(0.02, 0.05) });
    } }]
  });
  B.register('open_ocean', {
    label: 'OPEN OCEAN',
    layers: [{ noise: { ft: 'lowpass', f: 220 }, v: 0.32, lfo: { rate: 0.05, depth: 0.5, filter: 0.4 } }],
    events: [{ every: [28, 55], fn: (c, o, t) => {                                                   // a rare whale-like note
      const g = c.createGain(); g.connect(o); g.connect(A.echo);
      H.tone(c, g, t, { f: 170, f2: 240, glide: 1.2, a: 0.8, d: 2.4, v: 0.04, lp: 600 });
      H.tone(c, g, t + 1.6, { f: 240, f2: 150, glide: 1.6, a: 0.3, d: 2.0, v: 0.03, lp: 600 });
      setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 8000);
    } }]
  });
  const deep = (label) => ({
    label,
    layers: [{ tone: { f: 55 }, v: 0.05, lfo: { rate: 0.1, depth: 0.4 } }, { tone: { f: 82.5, detune: 5 }, v: 0.02 }, { noise: { ft: 'lowpass', f: 160 }, v: 0.18 }],
    events: [{ every: [2, 6], fn: (c, o, t) => drip(c, o, t) }]
  });
  B.register('cave', deep('FLOODED CAVE'));
  B.register('trench', deep('DEEP TRENCH'));
  B.register('vents', {
    label: 'VOLCANIC VENTS',
    layers: [{ noise: { ft: 'lowpass', f: 110, q: 1.2 }, v: 0.45, lfo: { rate: 0.2, depth: 0.5 } }, { tone: { f: 41 }, v: 0.05 }],
    events: [{ every: [0.6, 2.2], fn: (c, o, t) => bubbleRun(c, o, t, 3 + Math.floor(Math.random() * 4)) }]
  });
  B.register('mangrove', {
    label: 'MANGROVE',
    layers: [{ noise: { ft: 'bandpass', f: 1300, q: 1.2 }, v: 0.06, lfo: { rate: 1.3, depth: 0.5 } }, { noise: { ft: 'lowpass', f: 400 }, v: 0.1 }],
    events: [{ every: [2.5, 7], fn: (c, o, t) => {                                                    // insects
      const f = rnd(3800, 4800);
      for (let i = 0; i < 6; i++) H.tone(c, o, t + i * 0.05, { f, d: 0.025, v: 0.012 });
    } }]
  });
  B.register('ice', {
    label: 'ICE SHELF',
    layers: [{ noise: { ft: 'bandpass', f: 700, q: 0.8 }, v: 0.14, lfo: { rate: 0.06, depth: 0.7, filter: 0.6 } }],     // faint wind
    events: [{ every: [2, 6], fn: (c, o, t) => H.bell(c, o, t, m(Math.floor(rnd(93, 104))), 0.018, 1.2) }]           // tinkling
  });
  B.register('ruins', {
    label: 'SUNKEN RUINS',
    layers: [{ noise: { ft: 'lowpass', f: 240 }, v: 0.3 }, { noise: { ft: 'bandpass', f: 180, q: 9 }, v: 0.3, lfo: { rate: 0.08, depth: 0.6 } }],   // hollow echo
    events: [{ every: [6, 14], fn: (c, o, t) => { const g = c.createGain(); g.connect(o); g.connect(A.echo); creak(c, g, t, rnd(60, 90), 0.05); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 4000); } }]
  });
  B.register('lush_cave', {
    label: 'LUSH CAVE',
    layers: [{ noise: { ft: 'lowpass', f: 300 }, v: 0.22 }],
    events: [
      { every: [1.5, 4.5], fn: (c, o, t) => drip(c, o, t, rnd(1100, 1800)) },
      { every: [3, 8], fn: (c, o, t) => H.noise(c, o, t, { f: rnd(2500, 3500), q: 0.8, a: 0.08, d: 0.3, v: 0.025 }) }   // rustling leaves
    ]
  });
  B.register('hill', {
    label: 'THE HILL',
    layers: [
      { noise: { ft: 'bandpass', f: 550, q: 0.6 }, v: 0.14, lfo: { rate: 0.09, depth: 0.7, filter: 0.5 } },          // evening breeze
      { tone: { f: 110 }, v: 0.05, param: 'beam' }, { tone: { f: 220, detune: 6 }, v: 0.025, param: 'beam' }           // the beam's hum (near it)
    ],
    events: [{ every: [0.8, 2.6], fn: (c, o, t) => {                                                   // crickets
      const f = rnd(4200, 4700);
      for (let i = 0; i < 3; i++) H.tone(c, o, t + i * 0.065, { f, d: 0.03, v: 0.012 });
    } }]
  });
  B.register('station', {
    label: 'STATION',
    layers: [
      { tone: { f: 82 }, v: 0.05 }, { tone: { f: 123, detune: 4 }, v: 0.02, lfo: { rate: 0.15, depth: 0.5 } },        // warm low hum
      { noise: { ft: 'lowpass', f: 380 }, v: 0.14, param: 'water', lfo: { rate: 0.2, depth: 0.5 } }                     // tank water, muffled
    ],
    events: [{ every: [3, 8], fn: (c, o, t) => {                                                       // tiny electronic blips
      const f = Math.random() < 0.5 ? 1760 : 2093;
      H.tone(c, o, t, { type: 'square', f, d: 0.03, v: 0.008, lp: 3000 });
      if (Math.random() < 0.5) H.tone(c, o, t + 0.08, { type: 'square', f: f * 1.25, d: 0.03, v: 0.006, lp: 3000 });
    } }]
  });

  return B;
})();
