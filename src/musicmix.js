// The music mixer. Every note of music (Ataraxia now, Delta songs later) goes through here, then into
// AQ.Audio.musicBus (MUSIC volume, mute, the menu and hydrophone ducks). Effects and ambience don't.
//
//   note ─> instrument group (level, slow pan drift) ─┬─> layer dry ──────────────────────────┐
//                                                     ├─> layer reverb send ─> reverb ───────┤
//                                                     └─> layer echo send ─> tape echo ──────┤
//                                       warmth low-pass ─> glue compressor ─> limiter ─> out ┘
//
// Layers ('ataraxia', 'delta', 'fx') each have their own level, so one can dip under another.
// Everything takes the AudioContext it is given, so the same mixer renders offline too (docs/MUSIC_PLAN.md).
//
//   const mix = AQ.MusicMix.create(ctx, destination, { lowFx })
//   mix.group(layer, inst)          -> the node a note of that instrument connects to (made once, kept)
//   mix.setLayer(layer, level, seconds)
//   mix.track(sources, nodes, info) -> a note's nodes, freed (disconnected) when its last source ends
//   AQ.MusicMix.stats(mix)          -> { notes, nodesAlive, started, stolen } for tests
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.MusicMix = (function () {
  const MM = {};
  const cfg = () => AQ.TUNING.music;

  // A stereo room: noise that decays, darkening as it goes (high frequencies die first), after a short
  // predelay, with the two channels independent so it sounds wide.
  function roomImpulse(c, seconds, predelay, damping) {
    const rate = c.sampleRate, pre = Math.floor(predelay * rate), len = Math.floor(seconds * rate) + pre;
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let y = 0, energy = 0;
      for (let i = pre; i < len; i++) {
        const k = (i - pre) / (len - pre);                        // 0 .. 1 through the tail
        const a = 0.95 * Math.pow(1 - damping * 0.97, k * 3);     // one-pole low-pass that closes over time
        y += Math.max(0.02, a) * ((Math.random() * 2 - 1) - y);
        const env = Math.pow(1 - k, 2.2) * Math.min(1, (i - pre) / (0.012 * rate));   // soft onset, long fall
        d[i] = y * env; energy += d[i] * d[i];
      }
      const norm = Math.sqrt(0.6 / (energy + 1e-9));            // about as much energy as the dry sound
      for (let i = pre; i < len; i++) d[i] *= norm;
    }
    return buf;
  }

  MM.create = function (c, dest, opts = {}) {
    const C = cfg(), low = !!opts.lowFx;
    const mix = { ctx: c, layers: {}, groups: {}, live: [], nodesAlive: 0, started: 0, stolen: 0, maxVoices: low ? C.lowFxVoices : C.maxVoices };
    const gain = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
    // the end of the chain: warmth -> glue -> limiter -> out
    const warmth = c.createBiquadFilter(); warmth.type = 'lowpass'; warmth.frequency.value = C.warmth; warmth.Q.value = 0.5;
    const shelf = c.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = C.lowShelf.freq; shelf.gain.value = C.lowShelf.gain;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = C.glue.threshold; glue.ratio.value = C.glue.ratio; glue.attack.value = C.glue.attack; glue.release.value = C.glue.release; glue.knee.value = 12;
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = C.limiter.threshold; lim.ratio.value = C.limiter.ratio; lim.attack.value = C.limiter.attack; lim.release.value = C.limiter.release; lim.knee.value = 0;
    const out = gain(C.level);
    warmth.connect(shelf); shelf.connect(glue); glue.connect(lim); lim.connect(out); out.connect(dest);
    mix.out = out; mix.limiter = lim;
    // dry, reverb and echo buses
    const dry = gain(1); dry.connect(warmth);
    const verbIn = gain(1), verb = c.createConvolver(), verbCut = c.createBiquadFilter(), verbOut = gain(C.reverb.level);
    const verbLow = c.createBiquadFilter(); verbLow.type = 'highpass'; verbLow.frequency.value = C.reverb.lowCut; verbLow.Q.value = 0.5;
    verb.buffer = roomImpulse(c, low ? C.reverb.lowFxSeconds : C.reverb.seconds, C.reverb.predelay, C.reverb.damping);
    verbCut.type = 'lowpass'; verbCut.frequency.value = C.reverb.highCut; verbCut.Q.value = 0.5;
    verbIn.connect(verbLow); verbLow.connect(verb); verb.connect(verbCut); verbCut.connect(verbOut); verbOut.connect(warmth);
    // tape echo: two delays bouncing left / right; a low-pass in the loop darkens each repeat; a slow wobble
    // on the delay time gives it a soft tape "wow"
    const E = C.echo, echoIn = gain(1), echoOut = gain(E.level);
    const dL = c.createDelay(3), dR = c.createDelay(3), lpL = c.createBiquadFilter(), lpR = c.createBiquadFilter(), fbL = gain(E.feedback), fbR = gain(E.feedback);
    dL.delayTime.value = E.seconds; dR.delayTime.value = E.seconds;
    [lpL, lpR].forEach((f) => { f.type = 'lowpass'; f.frequency.value = E.tone; f.Q.value = 0.4; });
    const pL = c.createStereoPanner ? c.createStereoPanner() : gain(1), pR = c.createStereoPanner ? c.createStereoPanner() : gain(1);
    if (pL.pan) { pL.pan.value = -E.spread; pR.pan.value = E.spread; }
    echoIn.connect(dL); dL.connect(lpL); lpL.connect(fbL); fbL.connect(dR); dR.connect(lpR); lpR.connect(fbR); fbR.connect(dL);
    lpL.connect(pL); lpR.connect(pR); pL.connect(echoOut); pR.connect(echoOut); echoOut.connect(warmth);
    const wow = c.createOscillator(), wowD = gain(E.wow); wow.frequency.value = E.wowRate; wow.connect(wowD); wowD.connect(dL.delayTime); wowD.connect(dR.delayTime); wow.start();
    mix.bus = { dry, verb: verbIn, echo: echoIn };
    mix.setEcho = function (seconds) { const t = c.currentTime; dL.delayTime.setTargetAtTime(seconds, t, 0.5); dR.delayTime.setTargetAtTime(seconds, t, 0.5); };
    // slow modulators shared by every note (one each, not one per note): a shimmer for bells, a vibrato for the chip
    const lfo = (rate, depth) => { const o = c.createOscillator(), g = gain(depth); o.frequency.value = rate; o.connect(g); o.start(); return g; };
    mix.shimmer = lfo(4.3, 6);                                     // cents
    mix.vibrato = lfo(5.4, 9);                                     // cents
    mix.persistent = [wow, mix.shimmer, mix.vibrato];
    return mix;
  };

  // A layer: three gains (dry, reverb send, echo send) moved together, so dipping a layer dips its echo too.
  function layer(mix, name) {
    if (mix.layers[name]) return mix.layers[name];
    const c = mix.ctx, L = { name, dry: c.createGain(), verb: c.createGain(), echo: c.createGain(), level: 1 };
    L.dry.connect(mix.bus.dry); L.verb.connect(mix.bus.verb); L.echo.connect(mix.bus.echo);
    return (mix.layers[name] = L);
  }
  MM.setLayer = function (mix, name, level, seconds = 0.05) {
    const L = layer(mix, name), t = mix.ctx.currentTime;
    L.level = level;
    [L.dry, L.verb, L.echo].forEach((g) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(Math.max(0, level), t + Math.max(0.02, seconds)); });
  };
  MM.layerLevel = (mix, name) => layer(mix, name).level;
  // An instrument within a layer: its level, its sends, and a slow pan drift (an LFO of its own speed).
  MM.group = function (mix, name, inst) {
    const key = name + ':' + inst;
    if (mix.groups[key]) return mix.groups[key];
    const c = mix.ctx, L = layer(mix, name), I = cfg().inst[inst] || cfg().inst.piano;
    const g = c.createGain(); g.gain.value = I.level;
    let node = g;
    if (I.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(), o = c.createOscillator(), d = c.createGain();
      o.frequency.value = 0.02 + Math.random() * 0.05; d.gain.value = I.pan; o.connect(d); d.connect(p.pan); o.start(c.currentTime + Math.random() * 3);
      g.connect(p); node = p;
    }
    const sv = c.createGain(), se = c.createGain(); sv.gain.value = I.verb; se.gain.value = I.echo;
    node.connect(L.dry); node.connect(sv); node.connect(se); sv.connect(L.verb); se.connect(L.echo);
    return (mix.groups[key] = g);
  };

  // ---------------------------------------------------------------- note bookkeeping
  // Every note registers its sources and nodes; when the last source ends, all of them are disconnected
  // (nothing piles up). Past the voice cap, the quietest note that started longest ago fades out in 60 ms.
  MM.track = function (mix, sources, nodes, info) {
    const note = { sources, nodes, out: info.out, vel: info.vel || 0.5, t: info.t, end: info.end, left: sources.length, links: info.links || [], layer: info.layer || mix.playing };
    mix.nodesAlive += nodes.length; mix.started++;
    const done = () => {
      if (--note.left > 0) return;
      nodes.forEach((n) => { try { n.disconnect(); } catch (e) {} });
      note.links.forEach(([from, param]) => { try { from.disconnect(param); } catch (e) {} });   // shared LFOs let go of it too
      mix.nodesAlive -= nodes.length;
      const i = mix.live.indexOf(note); if (i >= 0) mix.live.splice(i, 1);
    };
    sources.forEach((s) => { s.onended = done; });
    const now = mix.ctx.currentTime;
    const ringing = mix.live.filter((n) => n.end > now && !n.released);
    if (ringing.length >= mix.maxVoices) {
      const victim = ringing.reduce((a, b) => (b.vel * (b.end - now) < a.vel * (a.end - now) ? b : a));
      MM.release(mix, victim, 0.06);
      mix.stolen++;
    }
    mix.live.push(note);
    return note;
  };
  // fade a note out now (voice stealing, or stopping a song)
  MM.release = function (mix, note, seconds) {
    if (note.released) return;
    note.released = true;
    const t = mix.ctx.currentTime, g = note.out.gain;
    try { g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.exponentialRampToValueAtTime(0.0001, t + seconds); } catch (e) {}
    note.sources.forEach((s) => { try { s.stop(t + seconds + 0.02); } catch (e) {} });
    note.end = t + seconds;
  };
  // fade out every note of one layer now (pausing or stopping a song: its pads and tails go quiet too)
  MM.releaseLayer = function (mix, layer, seconds) { mix.live.filter((n) => n.layer === layer).forEach((n) => MM.release(mix, n, seconds)); };
  MM.stats = (mix) => (mix ? { notes: mix.live.length, nodesAlive: mix.nodesAlive, started: mix.started, stolen: mix.stolen } : null);

  return MM;
})();
