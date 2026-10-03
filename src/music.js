// Generative music. Every piece in data/music.js is played live from oscillators and filters: sparse
// phrases built from the piece's scale (its own tune, the shared motif, or a new wandering line,
// never the same phrase twice in a row), held pads, soft bass, harp/chip arpeggios, and long quiet
// rests between phrases. Notes are scheduled a fraction of a second ahead (AQ.TUNING.audio.lookahead).
//
// The director picks the piece from where you are (title, hill, station, aquarium, each sea biome,
// with night versions) and crossfades between them. Menus duck the music.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Music = (function () {
  const A = AQ.Audio, H = A.H;
  const M = { current: null, fading: [], test: null };
  const LEVEL = 0.24;               // music sits underneath the effects (the MUSIC slider scales this)
  const cfg = () => AQ.TUNING.audio;
  const D = () => AQ.data.music;
  const R = Math.random;
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const ambient = () => Math.max(0, Math.min(1, cfg().musicAmbient != null ? cfg().musicAmbient : 1));

  // ---------------------------------------------------------------- instruments
  // (c, dest, t, freq, vel, beats-in-seconds) -> seconds
  function env(c, g, t, a, v, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
    return a + hold + rel;
  }
  function osc(c, type, f, detune) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune; return o; }
  function lp(c, f, q) { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = q || 0.7; return b; }
  function voice(c, dest, t, len, parts, filt) {
    const g = c.createGain(); g.connect(dest);
    let node = g;
    if (filt) { filt.connect(g); node = filt; }
    parts.forEach((o) => { o.connect(node); o.start(t); o.stop(t + len + 0.1); });
    return g;
  }
  // Everything is kept soft: rounded attacks (no clicky starts), dark filters, quiet overtones.
  const I = {
    piano(c, d, t, f, v, len) {
      const L = Math.min(2.6, 0.8 + len);
      const g = voice(c, d, t, L, [osc(c, 'triangle', f), osc(c, 'sine', f * 2, 3), osc(c, 'sine', f, -4)], lp(c, Math.min(1800, f * 4)));
      return env(c, g, t, 0.02, v * 0.42, 0.02, L);
    },
    bell(c, d, t, f, v) {
      const g = voice(c, d, t, 2.4, [osc(c, 'sine', f), osc(c, 'sine', f * 2.76)], lp(c, 2600));
      return env(c, g, t, 0.015, v * 0.24, 0, 2.3);
    },
    harp(c, d, t, f, v) {
      const g = voice(c, d, t, 1.8, [osc(c, 'triangle', f), osc(c, 'sine', f * 2)], lp(c, 1600));
      return env(c, g, t, 0.015, v * 0.38, 0, 1.7);
    },
    marimba(c, d, t, f, v) {
      const g = voice(c, d, t, 0.7, [osc(c, 'sine', f)]);
      const g2 = voice(c, d, t, 0.15, [osc(c, 'sine', f * 4)]);
      env(c, g2, t, 0.01, v * 0.05, 0, 0.12);
      return env(c, g, t, 0.012, v * 0.5, 0, 0.65);
    },
    guitar(c, d, t, f, v) {
      // plucked: a little brighter at first, the filter closes quickly (a soft nylon-ish tone)
      const fl = lp(c, 1800, 0.8);
      fl.frequency.setValueAtTime(1800, t); fl.frequency.exponentialRampToValueAtTime(420, t + 0.3);
      const g = voice(c, d, t, 1.3, [osc(c, 'triangle', f), osc(c, 'sawtooth', f, 5)], fl);
      return env(c, g, t, 0.012, v * 0.24, 0, 1.2);
    },
    chip(c, d, t, f, v, len) {
      const L = Math.min(0.5, len * 0.8 + 0.08);
      const g = voice(c, d, t, L, [osc(c, 'square', f)], lp(c, 1200));
      return env(c, g, t, 0.02, v * 0.08, L * 0.3, L * 0.7);
    },
    drone(c, d, t, f, v, len) {
      const L = Math.max(2, len);
      const g = voice(c, d, t, L + 2, [osc(c, 'sine', f), osc(c, 'sine', f * 1.5, 4), osc(c, 'triangle', f / 2)], lp(c, 420));
      return env(c, g, t, 1.0, v * 0.3, L * 0.4, 1.8);
    },
    bass(c, d, t, f, v, len) {
      const L = Math.max(0.6, len);
      const g = voice(c, d, t, L + 1, [osc(c, 'sine', f), osc(c, 'triangle', f, 3)], lp(c, 300));
      return env(c, g, t, 0.06, v * 0.42, L * 0.5, 0.9);
    },
    warm(c, d, t, f, v, len) {          // pad: two slightly detuned saws through a dark filter
      const g = voice(c, d, t, len + 3, [osc(c, 'sawtooth', f, -7), osc(c, 'sawtooth', f, 7)], lp(c, 520));
      return env(c, g, t, 1.8, v * 0.065, Math.max(0, len - 1.8), 2.6);
    },
    glass(c, d, t, f, v, len) {         // pad: glassy sines with a slow shimmer
      const g = voice(c, d, t, len + 3, [osc(c, 'sine', f), osc(c, 'sine', f * 2, 6), osc(c, 'triangle', f * 3, -6)], lp(c, 1700));
      return env(c, g, t, 1.8, v * 0.075, Math.max(0, len - 1.8), 2.6);
    }
  };
  M.instruments = I;

  // ---------------------------------------------------------------- pieces
  // Resolve a piece id ('kelp' or 'kelp:night') into the settings it plays with.
  function resolve(key) {
    const [id, mode] = key.split(':');
    const base = D().pieces[id];
    if (!base) return null;
    const p = Object.assign({ id, key }, base);
    if (mode === 'night') {
      p.bpm *= cfg().nightPace; p.vol = cfg().nightVolume;
      p.scale = D().nightScale[p.scale] || p.scale;
      p.root -= 2;                              // a little lower
      if (!p.arp) { p.arp = 'chip'; p.arpDensity = 0.35; }   // dreamy chiptune arpeggios at night
      p.bounce = false; p.dark = true;
      p.rest = [p.rest[0] + 1, p.rest[1] + 2];
    }
    p.bpm *= cfg().musicPace * (1 - 0.3 * ambient());
    return p;
  }
  function noteOf(p, step, oct = 0) {
    const sc = D().scales[p.scale], n = sc.length;
    const o = Math.floor(step / n), i = ((step % n) + n) % n;
    return p.root + sc[i] + 12 * (o + oct) + (p.octave || 0);
  }

  // A phrase: [{ step, beats }]. Three sources, chosen at random but never the same as the last one:
  // the place's own tune, the shared motif (moved to a new starting step), or a new wandering line.
  function makePhrase(inst) {
    const p = inst.p;
    for (let tries = 0; tries < 6; tries++) {
      let ph;
      const r = R();
      if (r < 0.3 && p.melody) {
        ph = p.melody.map((s, i) => ({ step: s, beats: i === p.melody.length - 1 ? 2 : pick([1, 1, 0.5, 1.5]) }));
      } else if (r < 0.55) {
        const mo = D().motif, shift = pick([0, 0, 2, -3, 4]);
        ph = mo.notes.map((s, i) => ({ step: s + shift, beats: mo.beats[i] }));
        if (R() < 0.5) ph[ph.length - 1].step += pick([1, -1, 2]);       // a small variation at the end
      } else {
        const len = 4 + Math.floor(R() * 3);
        let s = pick([0, 2, 4]);
        ph = [];
        for (let i = 0; i < len; i++) {
          ph.push({ step: s, beats: i === len - 1 ? pick([2, 3]) : pick([0.5, 1, 1, 1.5]) });
          s += pick([-2, -1, -1, 1, 1, 2, 0]);
          s = Math.max(-3, Math.min(9, s));
        }
        ph[ph.length - 1].step = pick([0, 2, 4]);                         // land on a chord tone
      }
      if (R() < 0.25) ph.forEach((n) => { if (R() < 0.3) n.beats = Math.max(0.5, n.beats + pick([-0.5, 0.5])); });   // slight rhythm variation
      const sig = ph.map((n) => n.step + '/' + n.beats).join(',');
      if (sig !== inst.lastSig) { inst.lastSig = sig; return ph; }
    }
    return [{ step: 0, beats: 2 }];
  }

  // Queue one phrase (+ its pad, bass, arpeggio and the rest after it) starting at time t0.
  // AQ.TUNING.audio.musicAmbient (0..1) turns every piece towards ambient: slower, a held pad that
  // never stops (each chord melts into the next), longer and softer melody notes, sparser
  // arpeggios, a single low bass note, more echo, and now and then a passage of pad alone.
  function queuePhrase(inst, t0) {
    const p = inst.p, beat = 60 / p.bpm, Q = inst.queue, amb = ambient();
    const chord = p.chords[inst.chordIdx++ % p.chords.length];
    const v = 0.9 * (p.vol || 1);
    const padOnly = R() < 0.3 * amb;                               // just the pad breathing for a while
    const ph = padOnly ? [] : makePhrase(inst);
    let t = t0, total = 0;
    ph.forEach((n) => {
      const beats = n.beats * (1 + 0.5 * amb);
      Q.push({ t, ins: p.lead, midi: noteOf(p, n.step + chord, 0), v: v * (0.8 + R() * 0.2) * (1 - 0.3 * amb), len: beats * beat });
      t += beats * beat; total += beats;
    });
    if (padOnly) total = 6 + Math.floor(R() * 4);
    const restBeats = (p.rest[0] + R() * (p.rest[1] - p.rest[0])) * cfg().musicRest * (1 + amb);
    const pad = p.pad || (amb > 0.5 ? 'warm' : null);
    if (pad) {
      // ambient: the pad lasts through the rest and overlaps the next chord (no gaps)
      const span = amb > 0.5 ? (total + restBeats) * beat + 2.5 : (total + restBeats * 0.6) * beat;
      [0, 2, 4].forEach((k) => Q.push({ t: t0, ins: pad, midi: noteOf(p, chord + k, -1), v, len: span }));
      if (amb > 0.5) Q.push({ t: t0 + beat, ins: 'glass', midi: noteOf(p, chord + 4, 0), v: v * 0.35 * amb, len: span });   // a faint shimmer on top
    }
    if (p.bass) {
      if (amb > 0.5) Q.push({ t: t0, ins: 'bass', midi: noteOf(p, chord, -2), v: v * 0.6, len: (total + restBeats * 0.5) * beat });
      else {
        Q.push({ t: t0, ins: 'bass', midi: noteOf(p, chord, -2), v, len: beat * 2 });
        if (total > 4 && R() < 0.6) Q.push({ t: t0 + Math.floor(total / 2) * beat, ins: 'bass', midi: noteOf(p, chord + 4, -2), v: v * 0.8, len: beat * 2 });
      }
    }
    if (p.arp && !padOnly) {
      const pat = [0, 2, 4, 7, 4, 2], step = amb > 0.5 ? beat : beat / 2;
      for (let i = 0; i * step < total * beat; i++) if (R() < (p.arpDensity || 0.5) * (1 - 0.5 * amb)) Q.push({ t: t0 + i * step, ins: p.arp, midi: noteOf(p, chord + pat[i % pat.length], p.arp === 'chip' ? 1 : 0), v: v * 0.5, len: step });
    }
    if (p.bounce && amb <= 0.5) {
      for (let b = 0.5; b < total; b += 1) if (R() < 0.6) [0, 2, 4].forEach((k) => Q.push({ t: t0 + b * beat, ins: 'guitar', midi: noteOf(p, chord + k, 0), v: v * 0.25, len: beat * 0.4 }));
    }
    Q.sort((a, b) => a.t - b.t);
    return t0 + (total + restBeats) * beat;
  }

  function startPiece(key, fadeIn) {
    const c = A.ctx, p = resolve(key);
    if (!p) return null;
    const out = c.createGain(); out.connect(A.musicBus);
    const t = c.currentTime;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(LEVEL, t + Math.max(0.05, fadeIn));
    const inst = { key, p, out, queue: [], chordIdx: 0, lastSig: '', nextFree: t + Math.min(1.5, fadeIn * 0.5) };
    const file = AQ.data.audioFiles && AQ.data.audioFiles['music:' + p.id];
    if (file) inst.file = A.loopFile(file, out);
    return inst;
  }
  function stopPiece(inst, fade) {
    if (!inst) return;
    const t = A.ctx.currentTime;
    inst.out.gain.cancelScheduledValues(t);
    inst.out.gain.setValueAtTime(Math.max(0.0001, inst.out.gain.value), t);
    inst.out.gain.linearRampToValueAtTime(0.0001, t + fade);
    inst.queue.length = 0; inst.stopping = true;
    if (inst.file) inst.file.stop(fade);
    setTimeout(() => { try { inst.out.disconnect(); } catch (e) {} }, (fade + 4) * 1000);
  }
  function pump(inst) {
    const c = A.ctx, horizon = c.currentTime + cfg().lookahead;
    if (inst.file) return;
    if (!inst.queue.length && inst.nextFree < horizon + 0.5) inst.nextFree = queuePhrase(inst, Math.max(inst.nextFree, c.currentTime + 0.05));
    while (inst.queue.length && inst.queue[0].t < horizon) {
      const n = inst.queue.shift();
      if (n.t < c.currentTime - 0.05) continue;                    // fell behind (tab was hidden): skip
      try { I[n.ins](c, inst.out, Math.max(n.t, c.currentTime), H.midi(n.midi), n.v, n.len); } catch (e) {}
    }
  }

  // ---------------------------------------------------------------- reward stinger
  M.stinger = function (id = 'reward') {
    if (!A.ready || A.settings().mute) return;
    const s = D().stingers[id];
    if (!s) return;
    if (AQ.data.audioFiles && AQ.data.audioFiles['music:' + id]) { A.playFile(AQ.data.audioFiles['music:' + id], { bus: A.musicBus }); return; }
    const c = A.ctx, beat = 60 / s.bpm, out = c.createGain(); out.gain.value = LEVEL * 1.2 * (s.vol || 1); out.connect(A.musicBus);
    // the music steps back for a moment
    if (M.current) { const g = M.current.out.gain, t = c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(LEVEL * 0.35, t + 0.3); g.setValueAtTime(LEVEL * 0.35, t + 3); g.linearRampToValueAtTime(LEVEL, t + 5); }
    let t = c.currentTime + 0.25;
    s.notes.forEach((st, i) => {
      const p = { root: s.root, scale: s.scale };
      I[s.lead](c, out, t, H.midi(noteOf(p, st)), 0.9, s.beats[i] * beat);
      if (i % 3 === 0) I.harp(c, out, t, H.midi(noteOf(p, st, -1)), 0.5);
      t += s.beats[i] * beat;
    });
    setTimeout(() => { try { out.disconnect(); } catch (e) {} }, (t - c.currentTime + 3) * 1000);
  };

  // ---------------------------------------------------------------- director
  M.start = function () {
    M.started = true;
    // ambient music gets more space: more reverb and a longer, softer echo
    const amb = ambient();
    A.musicVerb.gain.value = 0.35 + 0.4 * amb;
  };
  M.wanted = function (game) {
    if (M.test) return M.test;
    const st = game.state;
    if (st === 'soundtest') return M.current ? M.current.key : 'title';
    const from = st === 'log' ? AQ.LogUI.from : st;
    if (from === 'title' || st === 'title') return 'title';
    if (st === 'aquarium' || from === 'aquarium') return 'aquarium';
    if (game.scene === 'station') return 'station';
    if (game.scene === 'hill') return 'hill' + (AQ.Clock.isNight() ? ':night' : '');
    const P = game.player, b = AQ.World.biomeAt(P.x, P.y);
    const id = b && D().pieces[b.id] ? b.id : 'tide_pools';
    return id + (D().pieces[id].night && AQ.Clock.isNight() ? ':night' : '');
  };
  M.update = function (dt, game) {
    if (!A.ready || !game) return;
    const want = M.wanted(game);
    // biome-to-biome changes while swimming settle first; anything else (title, aquarium, scenes) switches at once
    const roaming = game.scene === 'world' && (game.state === 'play' || game.state === 'map' || game.state === 'pause');
    if (A.settle(M, M.current && M.current.key, want, dt, !!M.test || !roaming)) {
      const fade = cfg().crossfadeSeconds;
      if (M.current) { stopPiece(M.current, fade); }
      M.current = startPiece(want, M.current ? fade : 2);
    }
    if (M.current) pump(M.current);
    // menus: the music steps back
    const st = game.state;
    A.setDuck(st === 'log' || st === 'pause' || st === 'map' ? cfg().menuDuck : 1);
  };
  // the list of pieces for the sound test (day + night versions)
  M.catalog = function () {
    const out = [];
    for (const id in D().pieces) {
      const p = D().pieces[id];
      out.push({ id, label: p.label });
      if (p.night) out.push({ id: id + ':night', label: p.label + ' NIGHT' });
    }
    for (const id in D().stingers) out.push({ id, label: D().stingers[id].label, stinger: true });
    return out;
  };
  return M;
})();

// register every piece by id, so the registry lists them alongside effects and ambience
(function () {
  for (const id in AQ.data.music.pieces) AQ.Audio.register('music:' + id, { kind: 'music', label: AQ.data.music.pieces[id].label, piece: id });
  for (const id in AQ.data.music.stingers) AQ.Audio.register('music:' + id, { kind: 'music', label: AQ.data.music.stingers[id].label, piece: id, stinger: true });
})();
