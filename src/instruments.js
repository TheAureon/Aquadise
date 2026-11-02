// The music's instruments, all synthesized (no samples). Every note has a soft attack and release (no
// clicks), small human touches (timing a few ms off, velocity and brightness varied), and frees its nodes
// when it ends (AQ.MusicMix.track). Each note uses at most about 7 nodes.
//
//   AQ.Instruments.play(mix, layer, inst, t, midi, vel, len, opts) -> when the note has fully died away
//     inst: piano | bell | glass | harp | marimba | chip | sub | bass | pad | perc (opts.kind: shaker | clave | kick)
//     opts: { pan (-1..1, a fixed place instead of the group's drift), exact (no human touches) }
//   AQ.Instruments.padEngine(mix, layer, { color, voices })   a held pad that never restarts: it glides
//     from chord to chord (setChord), brightens or darkens (setBright), fades (setLevel), stops (stop)
//   AQ.Instruments.subEngine(mix, layer)                      the same for a single deep bass note
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Instruments = (function () {
  const IN = {};
  const MM = () => AQ.MusicMix;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  IN.hz = hz;

  function noise(mix) {                                            // one shared noise buffer per mixer
    if (mix.noise) return mix.noise;
    const c = mix.ctx, len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (mix.noise = b);
  }
  // the note's output gain, connected to its instrument group (or through its own fixed pan)
  function outFor(mix, layer, inst, opts, nodes) {
    const c = mix.ctx, out = c.createGain(); out.gain.value = 0;
    let dest = MM().group(mix, layer, inst);
    if (opts.pan != null && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(opts.pan, -1, 1); p.connect(dest); dest = p; nodes.push(p); }
    out.connect(dest); nodes.push(out);
    return out;
  }
  function osc(c, type, f, detune, nodes, sources) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; nodes.push(o); sources.push(o); return o; }
  function gainNode(c, v, nodes) { const g = c.createGain(); g.gain.value = v; nodes.push(g); return g; }
  function lowpass(c, f, q, nodes) { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q; nodes.push(b); return b; }
  // the main envelope: a soft rise to `peak`, then the instrument's own fall; a release at `rel`
  function rise(g, t, peak, attack) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack); }
  function startAll(sources, t, end) { sources.forEach((s) => { s.start(t); s.stop(end); }); }

  // ---------------------------------------------------------------- the notes
  const R = {
    // felt piano: a soft hammer of filtered noise, a slightly sharp octave partial (strings are a little
    // "stretched"), a low-pass that opens with velocity and closes as the note fades, a two-stage decay
    piano(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], links = [], f = hz(m);
      const out = outFor(mix, L, 'piano', o, nodes);
      const flt = lowpass(c, Math.min(9000, f * (2.5 + 6 * v)), 0.6, nodes); flt.connect(out);
      flt.frequency.setTargetAtTime(f * 1.6 + 220, t + 0.01, 0.35 + 0.25 * (1 - v));
      const o1 = osc(c, 'triangle', f, rnd(-3, 3), nodes, src); o1.connect(flt);
      const g2 = gainNode(c, 0, nodes); g2.connect(flt);
      const o2 = osc(c, 'sine', f * 2.003, rnd(-2, 2), nodes, src); o2.connect(g2);
      g2.gain.setValueAtTime(0.35, t); g2.gain.setTargetAtTime(0, t + 0.01, 0.45);
      const nz = c.createBufferSource(); nz.buffer = noise(mix); nodes.push(nz); src.push(nz);
      const ng = gainNode(c, 0, nodes); nz.connect(ng); ng.connect(flt);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.07 * v, t + 0.006); ng.gain.setTargetAtTime(0, t + 0.007, 0.018);
      const tau = 2.2 * clamp(1 + (60 - m) / 40, 0.55, 1.6);      // low notes ring longer
      rise(out, t, 0.5 * v, 0.009);
      out.gain.setTargetAtTime(0.2 * v, t + 0.01, 0.28);
      const rel = t + Math.max(0.2, len);
      if (rel > t + 0.45) out.gain.setTargetAtTime(0, t + 0.45, tau);
      out.gain.setTargetAtTime(0, rel, 0.22);
      const end = Math.min(rel + 1.0, t + 0.45 + tau * 5);       // (a released note is silent after ~4.5 time-constants)
      startAll([o1, o2], t, end); nz.start(t, Math.random()); nz.stop(t + 0.08);
      MM().track(mix, src, nodes, { out, vel: v, t, end, links });
      return end;
    },
    // bell: inharmonic partials, each fading at its own speed; the upper ones shimmer slowly
    bell(mix, L, t, m, v, len, o) { return chime(mix, L, 'bell', t, m, v, o, [1, 2.756, 5.404], [1, 0.32, 0.1], [2.6, 1.3, 0.6], 0.008); },
    // glass: nearly harmonic, softer start, longer and more even shimmer
    glass(mix, L, t, m, v, len, o) { return chime(mix, L, 'glass', t, m, v, o, [1, 2.002, 3.004], [1, 0.28, 0.12], [3.4, 2, 1.1], 0.05); },
    // harp / pluck: bright for a moment, then the filter closes; a quiet octave gives it body
    harp(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], f = hz(m);
      const out = outFor(mix, L, 'harp', o, nodes);
      const flt = lowpass(c, Math.min(9000, f * (6 + 6 * v)), 0.7, nodes); flt.connect(out);
      flt.frequency.setTargetAtTime(f * 2.2 + 150, t + 0.005, 0.12);
      osc(c, 'triangle', f, rnd(-3, 3), nodes, src).connect(flt);
      const g2 = gainNode(c, 0.18, nodes); g2.connect(out);
      osc(c, 'sine', f * 2, 0, nodes, src).connect(g2);
      const tau = 0.9 * clamp(1 + (60 - m) / 50, 0.6, 1.5);
      rise(out, t, 0.42 * v, 0.006);
      out.gain.setTargetAtTime(0, t + 0.01, tau);
      const end = t + 0.01 + tau * 5.5;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    },
    // marimba: a warm sine with a quick wooden "tine" four times higher
    marimba(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], f = hz(m);
      const out = outFor(mix, L, 'marimba', o, nodes);
      osc(c, 'sine', f, rnd(-2, 2), nodes, src).connect(out);
      const g2 = gainNode(c, 0, nodes); g2.connect(out);
      osc(c, 'sine', f * 3.98, 0, nodes, src).connect(g2);
      g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.09, t + 0.006); g2.gain.setTargetAtTime(0, t + 0.007, 0.035);
      rise(out, t, 0.55 * v, 0.006);
      out.gain.setTargetAtTime(0, t + 0.01, 0.32);
      const end = t + 2;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    },
    // soft chiptune: a square through a low-pass, a gentle vibrato that arrives after the start
    chip(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], links = [], f = hz(m);
      const out = outFor(mix, L, 'chip', o, nodes);
      const flt = lowpass(c, Math.min(4000, f * 3), 0.5, nodes); flt.connect(out);
      const o1 = osc(c, 'square', f, 0, nodes, src); o1.connect(flt);
      mix.vibrato.connect(o1.detune); links.push([mix.vibrato, o1.detune]);
      const rel = t + Math.max(0.12, len);
      rise(out, t, 0.2 * v, 0.02);
      out.gain.setTargetAtTime(0.13 * v, t + 0.03, 0.15);
      out.gain.setTargetAtTime(0, rel, 0.09);
      const end = rel + 0.6;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end, links });
      return end;
    },
    // a sub-bass note (songs; Ataraxia uses the held subEngine)
    sub(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], f = hz(m);
      const out = outFor(mix, L, 'sub', o, nodes);
      osc(c, 'sine', f, 0, nodes, src).connect(out);
      const g2 = gainNode(c, 0.14, nodes); g2.connect(out);
      osc(c, 'triangle', f * 2, 0, nodes, src).connect(g2);
      const rel = t + Math.max(0.3, len);
      rise(out, t, 0.6 * v, 0.07);
      out.gain.setTargetAtTime(0.48 * v, t + 0.08, 0.6);
      out.gain.setTargetAtTime(0, rel, 0.25);
      const end = rel + 1.6;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    },
    // a song's bass: round and plucked (a soft upright / felt-bass feel); the filter closes after the attack
    bass(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], f = hz(m);
      const out = outFor(mix, L, 'bass', o, nodes);
      const flt = lowpass(c, Math.min(1400, f * 9), 0.7, nodes); flt.connect(out);
      flt.frequency.setTargetAtTime(Math.max(140, f * 2.5), t + 0.01, 0.18);
      osc(c, 'sine', f, 0, nodes, src).connect(out);
      osc(c, 'triangle', f, rnd(-3, 3), nodes, src).connect(flt);
      const rel = t + Math.max(0.2, len * 0.95);
      rise(out, t, 0.5 * v, 0.012);
      out.gain.setTargetAtTime(0.3 * v, t + 0.015, 0.5);
      out.gain.setTargetAtTime(0, rel, 0.12);
      const end = rel + 0.9;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    },
    // a pad chord tone (songs): two detuned layers, slow in, slow out
    pad(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], f = hz(m), d = rnd(5, 9);
      const out = outFor(mix, L, 'pad', o, nodes);
      const flt = lowpass(c, clamp(f * 3, 400, 2600), 0.6, nodes); flt.connect(out);
      osc(c, 'sawtooth', f, -d, nodes, src).connect(flt);
      osc(c, 'triangle', f, d, nodes, src).connect(flt);
      const rel = t + Math.max(1, len);
      rise(out, t, 0.12 * v, Math.min(1.2, len * 0.4));
      out.gain.setTargetAtTime(0, rel, 0.6);
      const end = rel + 2.6;
      startAll(src, t, end);
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    },
    // hushed percussion (some songs only): shaker, clave, heartbeat kick
    perc(mix, L, t, m, v, len, o) {
      const c = mix.ctx, nodes = [], src = [], kind = o.kind || 'shaker';
      const out = outFor(mix, L, 'perc', o, nodes);
      let end;
      if (kind === 'shaker') {
        const nz = c.createBufferSource(); nz.buffer = noise(mix); nodes.push(nz); src.push(nz);
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200; hp.Q.value = 0.7; nodes.push(hp);
        nz.connect(hp); hp.connect(out);
        rise(out, t, 0.16 * v, 0.008); out.gain.setTargetAtTime(0, t + 0.01, 0.035);
        end = t + 0.3; nz.start(t, Math.random()); nz.stop(end);
      } else if (kind === 'clave') {
        osc(c, 'sine', 1650, 0, nodes, src).connect(out);
        rise(out, t, 0.12 * v, 0.005); out.gain.setTargetAtTime(0, t + 0.006, 0.03);
        end = t + 0.3; startAll(src, t, end);
      } else {                                                     // kick: a soft low thump
        const o1 = osc(c, 'sine', 92, 0, nodes, src); o1.connect(out);
        o1.frequency.setValueAtTime(92, t); o1.frequency.exponentialRampToValueAtTime(44, t + 0.16);
        rise(out, t, 0.55 * v, 0.006); out.gain.setTargetAtTime(0, t + 0.01, 0.13);
        end = t + 0.9; startAll(src, t, end);
      }
      MM().track(mix, src, nodes, { out, vel: v, t, end });
      return end;
    }
  };
  // bells and glass: several partials (own gain and decay each); upper ones get the shared shimmer
  function chime(mix, L, inst, t, m, v, o, ratios, amps, decays, attack) {
    const c = mix.ctx, nodes = [], src = [], links = [], f = hz(m), k = clamp(1 + (72 - m) / 48, 0.5, 1.5);
    const out = outFor(mix, L, inst, o, nodes);
    rise(out, t, 0.32 * v, attack);
    let longest = 0;
    ratios.forEach((r, i) => {
      if (f * r > 12000) return;
      const g = gainNode(c, 0, nodes); g.connect(out);
      const ob = osc(c, 'sine', f * r, rnd(-2, 2), nodes, src); ob.connect(g);
      if (i > 0 || inst === 'glass') { mix.shimmer.connect(ob.detune); links.push([mix.shimmer, ob.detune]); }
      g.gain.setValueAtTime(amps[i], t); g.gain.setTargetAtTime(0, t + attack, decays[i] * k);
      longest = Math.max(longest, decays[i] * k);
    });
    const end = t + attack + longest * 4;
    startAll(src, t, end);
    MM().track(mix, src, nodes, { out, vel: v, t, end, links });
    return end;
  }

  IN.play = function (mix, layer, inst, t, midi, vel, len, opts = {}) {
    const fn = R[inst];
    if (!fn || !mix) return t;
    const H = AQ.TUNING.music.humanize;
    if (!opts.exact) { t += Math.random() * H.timing; vel *= 1 + (Math.random() * 2 - 1) * H.velocity; }
    t = Math.max(t, mix.ctx.currentTime + 0.005);
    try { return fn(mix, layer, t, midi, clamp(vel, 0.02, 1.2), len || 0.5, opts); } catch (e) { return t; }
  };
  IN.list = Object.keys(R);

  // ---------------------------------------------------------------- held voices (Ataraxia)
  const COLORS = {                                                 // pad colours: two layers per note
    // air: a soft extra layer an octave up (its level), for shine on top
    warm: { types: ['sawtooth', 'sawtooth'], level: 0.07, bright: 1, detune: 7, air: 0 },
    glass: { types: ['triangle', 'sine'], level: 0.12, bright: 1.4, detune: 5, air: 0.35 },
    airy: { types: ['triangle', 'triangle'], level: 0.11, bright: 1.2, detune: 11, air: 0.25 }
  };
  IN.colors = Object.keys(COLORS);
  // A pad that holds `voices` notes for as long as it lives. A new chord glides each note to its nearest
  // new note (voice leading); the filter breathes slowly; each layer drifts a few cents now and then.
  IN.padEngine = function (mix, layer, opts = {}) {
    const c = mix.ctx, col = COLORS[opts.color] || COLORS.warm, n = opts.voices || 4, t = c.currentTime;
    const out = c.createGain(); out.gain.value = 0; out.connect(MM().group(mix, layer, 'pad'));
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 800; flt.Q.value = 0.8; flt.connect(out);
    const lfo = c.createOscillator(), lfoD = c.createGain(); lfo.frequency.value = rnd(0.03, 0.07); lfoD.gain.value = 150; lfo.connect(lfoD); lfoD.connect(flt.frequency); lfo.start(t);
    const strands = [];
    for (let i = 0; i < n; i++) {
      const g = c.createGain(); g.gain.value = col.level; g.connect(flt);
      const oscs = col.types.map((ty, j) => { const o = c.createOscillator(); o.type = ty; o.frequency.value = 110; o.detune.value = (j ? 1 : -1) * col.detune; o.connect(g); o.start(t); return o; });
      let air = null;
      if (col.air) { const ag = c.createGain(); ag.gain.value = col.air; ag.connect(g); air = c.createOscillator(); air.type = 'sine'; air.frequency.value = 220; air.detune.value = col.detune * 1.5; air.connect(ag); air.start(t); air.ag = ag; }
      strands.push({ g, oscs, air, midi: null });
    }
    const P = { color: opts.color || 'warm', out, flt, alive: true, nodes: 4 + n * (3 + (col.air ? 2 : 0)) };
    mix.nodesAlive += P.nodes;
    P.setChord = function (midis, when = c.currentTime, glide = 4) {
      const want = midis.slice().sort((a, b) => a - b), tau = Math.max(0.05, glide / 3);
      strands.forEach((s, i) => {
        const m = want[Math.min(i, want.length - 1)];
        s.oscs.forEach((o) => { if (s.midi == null) o.frequency.setValueAtTime(hz(m), when); else o.frequency.setTargetAtTime(hz(m), when, tau); });
        if (s.air) { if (s.midi == null) s.air.frequency.setValueAtTime(hz(m) * 2, when); else s.air.frequency.setTargetAtTime(hz(m) * 2, when, tau); }
        s.g.gain.setTargetAtTime(col.level * clamp(0.75 + (m - 52) / 40, 0.5, 1.15), when, tau);   // the lowest notes a bit softer (no mud)
        s.midi = m;
      });
    };
    P.setBright = function (cut, seconds = 3) { const v = clamp(cut * col.bright, 120, 9000); flt.frequency.setTargetAtTime(v, c.currentTime, seconds / 3); lfoD.gain.setTargetAtTime(v * 0.22, c.currentTime, seconds / 3); };
    P.setLevel = function (v, seconds = 3) { out.gain.cancelScheduledValues(c.currentTime); out.gain.setTargetAtTime(Math.max(0, v), c.currentTime, Math.max(0.05, seconds / 3)); };
    P.drift = function () {                                        // slow, tiny pitch wander (human, alive)
      const H = AQ.TUNING.music.humanize;
      strands.forEach((s) => s.oscs.forEach((o, j) => o.detune.setTargetAtTime((j ? 1 : -1) * col.detune + rnd(-H.padDriftCents, H.padDriftCents), c.currentTime, H.padDriftSeconds / 3)));
    };
    P.stop = function (seconds = 4) {
      if (!P.alive) return;
      P.alive = false;
      P.setLevel(0, seconds);
      const end = c.currentTime + seconds * 2 + 0.2;
      strands.forEach((s) => { s.oscs.forEach((o) => o.stop(end)); if (s.air) s.air.stop(end); });
      lfo.stop(end);
      lfo.onended = () => { [out, flt, lfo, lfoD].concat(...strands.map((s) => [s.g].concat(s.oscs, s.air ? [s.air, s.air.ag] : []))).forEach((x) => { try { x.disconnect(); } catch (e) {} }); mix.nodesAlive -= P.nodes; };
    };
    return P;
  };
  // One held deep note under everything; glides when the place's root changes.
  IN.subEngine = function (mix, layer) {
    const c = mix.ctx, t = c.currentTime;
    const out = c.createGain(); out.gain.value = 0; out.connect(MM().group(mix, layer, 'sub'));
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55; o1.connect(out); o1.start(t);
    const g2 = c.createGain(); g2.gain.value = 0.12; g2.connect(out);
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 110; o2.connect(g2); o2.start(t);
    const S = { alive: true, midi: null, nodes: 4 };
    mix.nodesAlive += S.nodes;
    S.setNote = function (m, glide = 4) { const tt = c.currentTime; if (S.midi == null) { o1.frequency.setValueAtTime(hz(m), tt); o2.frequency.setValueAtTime(hz(m) * 2, tt); } else { o1.frequency.setTargetAtTime(hz(m), tt, glide / 3); o2.frequency.setTargetAtTime(hz(m) * 2, tt, glide / 3); } S.midi = m; };
    S.setLevel = function (v, seconds = 3) { out.gain.cancelScheduledValues(c.currentTime); out.gain.setTargetAtTime(Math.max(0, v), c.currentTime, Math.max(0.05, seconds / 3)); };
    S.stop = function (seconds = 4) {
      if (!S.alive) return; S.alive = false; S.setLevel(0, seconds);
      const end = c.currentTime + seconds * 2 + 0.2; o1.stop(end); o2.stop(end);
      o1.onended = () => { [out, o1, o2, g2].forEach((x) => { try { x.disconnect(); } catch (e) {} }); mix.nodesAlive -= S.nodes; };
    };
    return S;
  };

  return IN;
})();
