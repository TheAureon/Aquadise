// Audio engine: everything is generated in code with the Web Audio API (no audio files needed).
//
//   AQ.Audio.play(id, opts)   one-shot sound effect      (opts: { vol, pan, delay, rare })
//   AQ.Audio.music(id)        ask for a music piece      (the music director in src/music.js decides)
//   AQ.Audio.register(id, def) add a sound: { kind: 'sfx'|'amb'|'music', label, fn | start }
//
// Every sound, ambience bed ('amb:<place>') and music piece ('music:<piece>') is registered by id
// (src/sfx.js, src/ambience.js, src/music.js). To swap one for a real recording later, add it to
// AQ.data.audioFiles (data/music.js): { catch: 'audio/catch.ogg' }. Mapped ids play that file instead.
//
// Mixer:  sfx ──┐
//         amb ──┴─> env (underwater lowpass) ─┬──────────────> compressor ─> master ─> speakers
//                                             └─> reverb ──────┘
//         music ─┬─────────────────────────────────────────────┘
//                └─> reverb + slow echo ──────┘
// Nothing makes a sound until the first click or key press (browsers block it before that).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Audio = (function () {
  const A = { sounds: {}, ctx: null, ready: false, voices: 0, last: {}, musicWanted: null, buffers: {} };
  const cfg = () => AQ.TUNING.audio;

  A.register = function (id, def) { A.sounds[id] = Object.assign({ id, kind: 'sfx', label: id }, def); };
  A.list = (kind) => Object.values(A.sounds).filter((s) => s.kind === kind);

  // ---------------------------------------------------------------- settings (saved with the game)
  A.settings = function () {
    const s = (AQ.State && AQ.State.settings) || {};
    if (!s.audio) s.audio = { music: cfg().musicVolume, sfx: cfg().sfxVolume, mute: false };
    if (AQ.State && !AQ.State.settings) AQ.State.settings = s;
    return s.audio;
  };
  A.applyVolumes = function (fast) {
    if (!A.ready) return;
    const st = A.settings(), t = A.ctx.currentTime, k = fast ? 0.02 : 0.15;
    A.master.gain.setTargetAtTime(st.mute ? 0 : cfg().master, t, k);
    A.musicBus.gain.setTargetAtTime(st.music * (A.duck || 1), t, k * 2);
    A.sfxBus.gain.setTargetAtTime(st.sfx, t, k);
    A.ambBus.gain.setTargetAtTime(st.sfx * cfg().ambienceLevel, t, k);
  };
  A.setVolume = function (which, v) {
    A.settings()[which] = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    A.applyVolumes(); AQ.Save && AQ.Save.dirty();
  };
  A.toggleMute = function () {
    const st = A.settings(); st.mute = !st.mute;
    A.applyVolumes(true); AQ.Save && AQ.Save.dirty();
    if (AQ.HUD) AQ.HUD.toast(st.mute ? 'Sound muted (O to unmute)' : 'Sound on', '#cfe8ff');
  };

  // ---------------------------------------------------------------- start-up (on the first gesture)
  function init() {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    const c = A.ctx;
    A.master = c.createGain(); A.master.connect(c.destination);
    const comp = c.createDynamicsCompressor();                     // keeps everything soft, no spikes
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    comp.connect(A.master); A.out = comp;
    A.env = c.createBiquadFilter(); A.env.type = 'lowpass'; A.env.frequency.value = 18000; A.env.Q.value = 0.5;
    A.env.connect(comp);
    A.sfxBus = c.createGain(); A.sfxBus.connect(A.env);
    A.ambBus = c.createGain(); A.ambBus.connect(A.env);
    A.musicBus = c.createGain(); A.musicBus.connect(comp);
    // shared reverb (generated impulse). Sends are taken after the volume controls, so the sliders
    // and the underwater filter shape the echo too.
    A.reverb = c.createConvolver(); A.reverb.buffer = impulse(2.8, 2.4);
    A.reverbOut = c.createGain(); A.reverbOut.gain.value = 0.55; A.reverb.connect(A.reverbOut); A.reverbOut.connect(comp);
    A.sfxVerb = c.createGain(); A.sfxVerb.gain.value = 0.18; A.sfxVerb.connect(A.reverb); A.env.connect(A.sfxVerb);
    A.musicVerb = c.createGain(); A.musicVerb.gain.value = 0.35; A.musicVerb.connect(A.reverb); A.musicBus.connect(A.musicVerb);
    // a slow, soft echo for the music
    const dl = c.createDelay(2), fb = c.createGain(), dlp = c.createBiquadFilter(), dOut = c.createGain();
    dl.delayTime.value = 0.62; fb.gain.value = 0.32; dlp.type = 'lowpass'; dlp.frequency.value = 1800; dOut.gain.value = 0.3;
    A.musicBus.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(dOut); dOut.connect(comp);
    // a direct send for "echoey" one-off sounds (drips in caves)
    A.echo = c.createGain(); A.echo.gain.value = 1; A.echo.connect(A.reverb);
    A.noiseBuf = noiseBuffer(4);
    A.ready = true;
    A.applyVolumes(true);
    loadRecordings();
    if (AQ.Music) AQ.Music.start();
    if (AQ.Ambience) AQ.Ambience.start();
  }
  function impulse(seconds, decay) {
    const c = A.ctx, len = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  function noiseBuffer(seconds) {
    const c = A.ctx, len = Math.floor(c.sampleRate * seconds), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  A.attach = function () {
    const go = () => { init(); if (A.ctx && A.ctx.state === 'suspended' && !document.hidden) A.ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
    document.addEventListener('visibilitychange', () => {
      if (!A.ctx) return;
      if (document.hidden) A.ctx.suspend().catch(() => {}); else A.ctx.resume().catch(() => {});
    });
  };

  // ---------------------------------------------------------------- playing
  A.now = () => (A.ctx ? A.ctx.currentTime : 0);
  // Place changes settle for a moment before music/ambience switch, so drifting back and forth over a
  // biome border doesn't restart them. Returns true when `want` should replace `cur` now.
  A.settle = function (st, cur, want, dt, instant) {
    if (cur === want) { st.pending = null; return false; }
    if (instant || cur == null) return true;
    if (st.pending !== want) { st.pending = want; st.pendingT = 0; }
    st.pendingT += dt;
    return st.pendingT >= 1.2;
  };
  // Voice budget: each recipe reports how long it lasts; past the limit, new sounds are skipped.
  A.voice = function (seconds) {
    A.voices++;
    setTimeout(() => { A.voices = Math.max(0, A.voices - 1); }, Math.max(50, seconds * 1000));
  };
  A.play = function (id, opts = {}) {
    if (!A.ready || A.ctx.state !== 'running' || A.settings().mute) return;
    const rec = recordingFor(id);
    const s = A.sounds[id] || (rec ? { id } : null);
    if (!s || (!s.fn && !rec)) return;
    // the same sound fired many times in a blink plays once
    const t = A.ctx.currentTime, min = s.minGap != null ? s.minGap : 0.05;
    if (A.last[id] && t - A.last[id] < min) return;
    if (A.voices >= cfg().maxVoices && !s.important && !opts.important) return;
    A.last[id] = t;
    try {
      const out = A.ctx.createGain(); out.gain.value = opts.vol != null ? opts.vol : 1;
      let node = out;
      if (opts.pan && A.ctx.createStereoPanner) { const p = A.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); out.connect(p); node = p; }
      node.connect(s.bus === 'music' ? A.musicBus : s.bus === 'amb' ? A.ambBus : A.sfxBus);
      const dur = (rec ? playBuffer(rec, out, t + 0.01 + (opts.delay || 0)) : s.fn(A.ctx, out, t + 0.01 + (opts.delay || 0), opts) || 1) + (opts.delay || 0);
      A.voice(dur);
      setTimeout(() => { try { node.disconnect(); out.disconnect(); } catch (e) {} }, (dur + 0.5) * 1000);
    } catch (e) { /* a sound must never break the game */ }
  };
  // ---------------------------------------------------------------- recordings (AQ.data.audioFiles)
  // An effect mapped to recordings plays one of them (picked at random, with a tiny pitch change so
  // repeats don't sound identical) through the same mixer as everything else: volume sliders,
  // underwater muffling and the voice limit all apply. Until a file has loaded (or if it can't load),
  // the generated version plays instead. Files packed by tools/embed-audio.js load from
  // AQ.data.audioEmbedded, so they also work when the game is opened straight from disk.
  const mapOf = (id) => {
    const m = AQ.data.audioFiles && AQ.data.audioFiles[id];
    if (!m) return null;
    if (typeof m === 'string') return { files: [m], vol: 1 };
    if (Array.isArray(m)) return { files: m, vol: 1 };
    return { files: m.files || [], vol: m.vol != null ? m.vol : 1, vary: m.vary };
  };
  function recordingFor(id) {
    const m = mapOf(id);
    if (!m) return null;
    const ready = m.files.map((f) => A.buffers[f]).filter((b) => b && b !== 'loading' && b !== 'failed');
    return ready.length ? { buf: ready[Math.floor(Math.random() * ready.length)], vol: m.vol, vary: m.vary != null ? m.vary : 0.05 } : null;
  }
  A.hasRecording = (id) => !!mapOf(id);
  function playBuffer(rec, out, t) {
    const src = A.ctx.createBufferSource(), g = A.ctx.createGain();
    src.buffer = rec.buf; src.playbackRate.value = 1 + (Math.random() * 2 - 1) * rec.vary;
    g.gain.value = rec.vol; src.connect(g); g.connect(out);
    src.start(t);
    return rec.buf.duration / src.playbackRate.value;
  }
  function loadRecordings() {
    const all = AQ.data.audioFiles || {};
    for (const id in all) {
      if (A.sounds[id] && A.sounds[id].kind !== 'sfx') continue;    // beds + music stream instead
      const m = mapOf(id);
      if (!m) continue;
      m.files.forEach((url) => {
        if (A.buffers[url]) return;
        A.buffers[url] = 'loading';
        const emb = AQ.data.audioEmbedded && AQ.data.audioEmbedded[url];
        const bytes = emb ? Promise.resolve(Uint8Array.from(atob(emb), (ch) => ch.charCodeAt(0)).buffer) : fetch(url).then((r) => r.arrayBuffer());
        bytes.then((ab) => A.ctx.decodeAudioData(ab)).then((buf) => { A.buffers[url] = buf; }).catch(() => { A.buffers[url] = 'failed'; });
      });
    }
  }

  // A recording in place of a generated sound (AQ.data.audioFiles). One-shots go through the effects
  // (or given) bus; loops (ambience beds, music) feed a gain node the caller fades.
  function playFile(url, opts = {}) {
    try {
      const el = new Audio(url), src = A.ctx.createMediaElementSource(el), g = A.ctx.createGain();
      g.gain.value = opts.vol != null ? opts.vol : 1; src.connect(g); g.connect(opts.bus || A.sfxBus);
      el.addEventListener('ended', () => { try { g.disconnect(); } catch (e) {} });
      el.play().catch(() => {});
    } catch (e) {}
  }
  A.playFile = playFile;
  A.loopFile = function (url, dest) {
    try {
      const el = new Audio(url); el.loop = true;
      A.ctx.createMediaElementSource(el).connect(dest);
      el.play().catch(() => {});
      return { stop(fade) { setTimeout(() => { el.pause(); el.src = ''; }, (fade + 0.1) * 1000); } };
    } catch (e) { return null; }
  };
  // Called by older code: music('aquarium') etc. The director in src/music.js picks the piece.
  A.music = function (id) { A.musicWanted = id; };

  // Underwater: sound effects and ambience are softly muffled while you're submerged.
  A.setUnderwater = function (on) {
    if (!A.ready || A.under === on) return;
    A.under = on;
    A.env.frequency.setTargetAtTime(on ? cfg().underwaterCutoff : 18000, A.ctx.currentTime, on ? 0.12 : 0.25);
  };
  // Menus and the log: music ducks.
  A.setDuck = function (k) {
    if (A.duck === k) return;
    A.duck = k;
    A.applyVolumes();
  };

  // ---------------------------------------------------------------- tiny synth helpers for recipes
  const H = {};
  A.H = H;
  // a single enveloped oscillator note
  H.tone = function (c, dest, t, o) {
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide || o.d));
    if (o.detune) osc.detune.value = o.detune;
    const a = o.a != null ? o.a : 0.005, v = o.v != null ? o.v : 0.2, d = o.d || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    let node = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + a + d + 0.05);
    return a + d;
  };
  // filtered noise burst (whooshes, splashes, rustles)
  H.noise = function (c, dest, t, o) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = A.noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q || 1;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.d || 0.3));
    const a = o.a != null ? o.a : 0.02, v = o.v != null ? o.v : 0.2, d = o.d || 0.3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random()); src.stop(t + a + d + 0.05);
    return a + d;
  };
  // a soft bell / chime (sine + a gentle inharmonic partial)
  H.bell = function (c, dest, t, f, v = 0.12, d = 1.2) {
    H.tone(c, dest, t, { f, v, d, a: 0.004 });
    H.tone(c, dest, t, { f: f * 2.76, v: v * 0.25, d: d * 0.5, a: 0.004 });
    return d;
  };
  H.midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  return A;
})();
