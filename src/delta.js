// DELTA: composed songs (data/songs.js) that play every so often, matched to the place and time of day.
//
//   1. Notation: songs are written as text (see data/songs.js): notes with lengths, chord names per bar,
//      accompaniment patterns. AQ.Delta.compile(song) reads it into timed notes, and reports anything that
//      doesn't add up (a bar with the wrong number of beats, an unknown chord) instead of guessing.
//   2. Voicing: the pad, the broken chords and the block chords are voiced from the chord names: each chord
//      keeps the notes it shares with the last one and moves the others to the nearest new note (smooth
//      voice leading, inversions included), within a mid range so it never gets muddy.
//   3. Playing: AQ.Delta.make(mix) is a player that schedules a song's notes a little ahead on the audio
//      clock (steady through slow frames, paused tabs and menus) with tiny human variation.
//   4. When songs play (the director, AQ.Delta.update): how often (SETTINGS > SOUND > DELTA), which song
//      (place and time of day, not one heard recently, never the same twice in a row), waiting out the
//      hydrophone's LISTEN, photo mode and the guided dive's first steps; the title screen's DELTA.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Delta = (function () {
  const DL = {};
  const cfg = () => AQ.TUNING.delta;
  const songs = () => AQ.data.songs || [];
  DL.FREQS = ['off', 'rarely', 'sometimes', 'often', 'always'];   // names: settings.delta.<id>

  // ---------------------------------------------------------------- 1. notation
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pitch(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    return m ? 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : null;
  }
  DL.pitch = pitch;
  // chord qualities: intervals above the root (9ths written as 14: they sit above the chord)
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10],
    add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], maj9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], 9: [0, 4, 7, 10, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
    69: [0, 4, 7, 9, 14], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], aug: [0, 4, 8], 'maj7#11': [0, 4, 7, 11, 18], 5: [0, 7]
  };
  function chord(sym) {
    const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(sym);
    if (!m || !QUAL.hasOwnProperty(m[3])) return null;
    const root = (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    const iv = QUAL[m[3]], bass = m[4] ? (NOTE[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + 12) % 12 : root;
    return { sym, root, iv, pcs: iv.map((i) => (root + i) % 12), bass };
  }
  DL.chord = chord;
  // "D5:1 E5:0.5 r:1.5 | ..." -> [{ beat, midi (null = rest), len, acc }], checking every bar adds up to the meter
  function line(str, meter, bars, label, errs) {
    if (!str) return [];
    const out = [], bs = String(str).split('|').map((b) => b.trim());
    if (bars != null && bs.length !== bars) errs.push(`${label}: ${bs.length} bars, the section has ${bars}`);
    bs.forEach((bar, bi) => {
      let pos = 0;
      bar.split(/\s+/).filter(Boolean).forEach((tok) => {
        const m = /^([A-Gr][#b]?-?\d?):([\d.]+)(!?)$/.exec(tok);
        if (!m) { errs.push(`${label} bar ${bi + 1}: can't read "${tok}"`); return; }
        const len = +m[2], midi = m[1] === 'r' ? null : pitch(m[1]);
        if (m[1] !== 'r' && midi == null) errs.push(`${label} bar ${bi + 1}: unknown note "${m[1]}"`);
        else if (midi != null && (midi < 28 || midi > 100)) errs.push(`${label} bar ${bi + 1}: ${m[1]} is out of range`);
        out.push({ beat: bi * meter + pos, midi, len, acc: !!m[3] });
        pos += len;
      });
      if (Math.abs(pos - meter) > 1e-6) errs.push(`${label} bar ${bi + 1}: ${pos} beats, not ${meter}`);
    });
    return out;
  }
  // "D | Bm7 G/B | A:3 A7:1 | ..." -> [{ beat, len, ch }] (several chords in a bar share it equally unless given lengths)
  function chordLine(str, meter, bars, label, errs) {
    const out = [], bs = String(str || '').split('|').map((b) => b.trim());
    if (bs.length !== bars) errs.push(`${label}: ${bs.length} chord bars, the section has ${bars}`);
    bs.forEach((bar, bi) => {
      const toks = bar.split(/\s+/).filter(Boolean);
      let pos = 0;
      toks.forEach((tok) => {
        const [sym, l] = tok.split(':'), ch = chord(sym), len = l ? +l : meter / toks.length;
        if (!ch) errs.push(`${label} bar ${bi + 1}: unknown chord "${sym}"`);
        else out.push({ beat: bi * meter + pos, len, ch });
        pos += len;
      });
      if (toks.length && Math.abs(pos - meter) > 1e-6) errs.push(`${label} bar ${bi + 1}: chords last ${pos} beats, not ${meter}`);
    });
    return out;
  }

  // ---------------------------------------------------------------- 2. voicing
  const LO = 52, HI = 72;                                         // the pad / chord range (E3 .. C5)
  function voice(prev, ch, tr) {
    const pcs = ch.pcs.map((p) => (p + tr + 120) % 12), n = 4;
    const near = (from, pc) => { let best = null; for (let k = LO; k <= HI; k++) if ((k % 12) === pc && (best == null || Math.abs(k - from) < Math.abs(best - from))) best = k; return best; };
    let v;
    if (!prev) {                                                   // first chord: stacked up from the root
      let b = LO; while ((b % 12) !== pcs[0]) b++;
      v = ch.iv.slice(0, n).map((i) => b + i);
      while (v.length < n) v.push(v[v.length - 3] + 12);
      v = v.map((x) => { while (x > HI) x -= 12; return x; });
    } else v = prev.map((p) => near(p, pcs.reduce((a, pc) => (Math.abs(near(p, pc) - p) < Math.abs(near(p, a) - p) ? pc : a), pcs[0])));
    // every important note must sound: the third (or sus), the 7th / 6th / 9th, then the root
    const want = [pcs[1], pcs[3], pcs[4], pcs[0]].filter((x) => x != null);
    want.forEach((pc) => {
      if (v.some((x) => x % 12 === pc)) return;
      const counts = {}; v.forEach((x) => { counts[x % 12] = (counts[x % 12] || 0) + 1; });
      let i = v.findIndex((x) => counts[x % 12] > 1);
      if (i < 0) i = v.findIndex((x) => x % 12 === pcs[2] && pcs.length > 3);   // the fifth can go
      if (i >= 0) v[i] = near(v[i], pc);
    });
    return v.sort((a, b) => a - b);
  }
  DL.voice = voice;

  // ---------------------------------------------------------------- compiling a song
  const V = { melody: 0.78, counter: 0.5, bass: 0.62, pad: 0.42, arp: 0.38, comp: 0.36, perc: 0.5 };
  const lerp = (a, b, k) => a + (b - a) * k;
  function sectionOf(song, name, errs, seen = {}) {
    const s = song.sections[name];
    if (!s) { errs.push(`form: no section "${name}"`); return null; }
    if (!s.like) return s;
    if (seen[name]) { errs.push(`section ${name}: "like" loops`); return s; }
    seen[name] = true;
    return Object.assign({}, sectionOf(song, s.like, errs, seen), s, { like: undefined });
  }
  DL.compile = function (song) {
    if (song._compiled) return song._compiled;
    const errs = [], ev = [], meter = song.meter || 4, beat = 60 / song.bpm, marks = [];
    let t0 = 0, prevV = null, last = null;
    song.form.forEach((name, fi) => {
      const s = sectionOf(song, name, errs);
      if (!s) return;
      const L = `${song.id}.${name}`, bars = s.bars, total = bars * meter, tr = s.transpose || 0;
      if (!bars) { errs.push(`${L}: no bars`); return; }
      const dyn = (b) => lerp(s.dyn != null ? s.dyn : 0.6, s.to != null ? s.to : (s.dyn != null ? s.dyn : 0.6), b / total);
      marks.push({ name, beat: t0 });
      const chords = chordLine(s.chords, meter, bars, L + ' chords', errs);
      chords.forEach((c) => { c.v = voice(prevV, c.ch, tr); prevV = c.v; });
      const chordAt = (b) => chords.filter((c) => c.beat <= b + 1e-6).pop() || chords[0];
      const add = (b, inst, midi, vel, len, opts) => ev.push({ beat: t0 + b, inst, midi, vel, len, opts });
      const put = (str, inst, base, label) => line(str, meter, bars, `${L} ${label}`, errs).forEach((n) => {
        if (n.midi == null) return;
        const down = n.beat % meter === 0 ? 1.06 : 1;              // a gentle lift on each bar's first beat
        add(n.beat, inst, n.midi + tr, base * dyn(n.beat) * down * (n.acc ? 1.15 : 1), n.len);
      });
      put(s.melody, s.mel || song.lead, V.melody, 'melody');
      put(s.counter, s.ctr || song.counter || 'bell', V.counter, 'counter');
      put(s.bass, s.bassInst || song.bass || 'bass', V.bass, 'bass');
      if (s.pad !== false && (s.pad || song.pad)) chords.forEach((c) => c.v.forEach((m) => add(c.beat, 'pad', m, V.pad * dyn(c.beat), c.len + 0.3)));
      const pattern = (spec, kind) => {                            // broken chords (arp) or block chords (comp), every bar
        if (!spec) return;
        const toks = spec.pat.split(/\s+/).filter(Boolean), step = meter / toks.length;
        for (let bar = 0; bar < bars; bar++) toks.forEach((tk, i) => {
          if (tk === '.') return;
          const b = bar * meter + i * step, c = chordAt(b), vel = (spec.vel || 1) * V[kind] * dyn(b);
          if (kind === 'comp') c.v.slice(1).forEach((m) => add(b, spec.inst, m, vel * 0.85, spec.len || step));   // the upper three (the bass has the bottom)
          else {
            const up = (tk.match(/\+/g) || []).length, idx = parseInt(tk, 10) || 0, vv = c.v;
            add(b, spec.inst, vv[idx % vv.length] + 12 * (Math.floor(idx / vv.length) + up), vel, spec.len || step * 1.5);
          }
        });
      };
      pattern(s.arp, 'arp'); pattern(s.comp, 'comp');
      for (const kind in (s.perc || {})) {                          // hushed percussion: x = a hit, o = a softer one
        const p = s.perc[kind].replace(/\s/g, ''), step = meter / p.length;
        for (let bar = 0; bar < bars; bar++) [...p].forEach((ch, i) => { if (ch === 'x' || ch === 'o') add(bar * meter + i * step, 'perc', 60, V.perc * dyn(bar * meter) * (ch === 'o' ? 0.55 : 1), step, { kind }); });
      }
      if (fi === song.form.length - 1) last = { chords, t0, total, tr };
      t0 += total;
    });
    // the ending: the last chord rings out (held longer), so the song really finishes
    const ring = song.ring != null ? song.ring : 4;
    if (last && last.chords.length) {
      const c = last.chords[last.chords.length - 1];
      ev.forEach((e) => { if (e.inst === 'pad' && e.beat === last.t0 + c.beat) e.len += ring; });
    }
    ev.forEach((e) => { e.t = e.beat * beat; e.dur = e.len * beat; });
    ev.sort((a, b) => a.t - b.t);
    const seconds = (t0 + ring) * beat + cfg().tailSeconds;
    const out = { events: ev, seconds, beats: t0, marks: marks.map((m) => ({ name: m.name, t: m.beat * beat })), errors: errs };
    song._compiled = out;
    return out;
  };
  DL.length = (song) => (song.file ? (song.buffer ? song.buffer.duration : 0) : DL.compile(song).seconds);
  DL.title = (song) => (song.file ? song.name : AQ.t(`song.${song.id}`));   // (a file's title is its own)
  DL.clock = (sec) => AQ.t('music.time', { m: Math.floor(sec / 60), s: String(Math.floor(sec % 60)).padStart(2, '0') });

  // ---------------------------------------------------------------- 3. the player
  // One song at a time on the mixer's 'delta' layer. start() -> pump() often -> done() when it has rung out.
  // A song from an audio file (assets/music) plays its decoded buffer instead of notes. pause() / resume()
  // (the jukebox) pick up where it stopped.
  DL.make = function (mix) {
    const P = { mix, song: null, paused: null };
    P.start = function (song, when, offset = 0) {
      const c = mix.ctx, comp = song.file ? { seconds: song.buffer.duration + 0.5, events: [] } : DL.compile(song);
      P.song = song; P.comp = comp; P.paused = null;
      P.t0 = Math.max(when || 0, c.currentTime + 0.15) - offset;
      P.idx = 0; while (P.idx < comp.events.length && comp.events[P.idx].t < offset - 1e-6) P.idx++;   // (from the middle: skip what's before)
      AQ.MusicMix.setLayer(mix, 'delta', cfg().level, offset ? 0.3 : 0.05);
      if (song.file) {                                             // a recording: its buffer, loudness-matched
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = song.buffer; g.gain.value = song.gain;
        src.connect(g); g.connect(AQ.MusicMix.group(mix, 'delta', 'file'));
        src.start(P.t0 + offset, offset);
        src.onended = () => { try { g.disconnect(); src.disconnect(); } catch (e) {} };
        P.src = src;
      } else if (mix.setEcho) mix.setEcho(Math.min(1.2, (60 / song.bpm) * (song.echo || 1.5)));   // the echo follows the song's tempo
      P.pump();
    };
    P.pump = function () {
      if (!P.song || P.paused != null) return;
      const c = mix.ctx, horizon = c.currentTime + AQ.TUNING.music.scheduleAhead, ev = P.comp.events;
      while (P.idx < ev.length && P.t0 + ev[P.idx].t < horizon) {
        const e = ev[P.idx++], at = P.t0 + e.t;
        if (at < c.currentTime - 0.08) continue;                    // (very late: skip rather than pile up)
        AQ.Instruments.play(mix, 'delta', e.inst, at, e.midi, e.vel, e.dur, e.opts || {});
      }
    };
    P.position = () => (!P.song ? 0 : P.paused != null ? P.paused : Math.max(0, Math.min(P.comp.seconds, mix.ctx.currentTime - P.t0)));
    P.done = () => !P.song || (P.paused == null && mix.ctx.currentTime >= P.t0 + P.comp.seconds);
    // everything still sounding fades quickly (no note is cut off hard)
    function hush(fade) {
      AQ.MusicMix.releaseLayer(mix, 'delta', fade);
      if (P.src) { const s = P.src; try { s.stop(mix.ctx.currentTime + fade + 0.05); } catch (e) {} P.src = null; }
    }
    P.pause = function () {
      if (!P.song || P.paused != null) return;
      P.paused = P.position();
      AQ.MusicMix.setLayer(mix, 'delta', 0, cfg().pauseFade);
      hush(cfg().pauseFade);
    };
    P.resume = function () { if (P.song && P.paused != null) P.start(P.song, mix.ctx.currentTime + cfg().pauseFade + 0.05, P.paused); };
    P.stop = function (fade) {                                     // fade the whole song out, then end it
      if (!P.song) return;
      if (P.paused != null) { P.clear(); return; }
      P.idx = P.comp.events.length;
      AQ.MusicMix.setLayer(mix, 'delta', 0, fade);
      setTimeout(() => hush(0.2), fade * 1000);
      P.t0 = mix.ctx.currentTime + fade + 0.5 - P.comp.seconds;    // it now ends when the fade is over
    };
    P.clear = function () { hush(0.1); P.song = null; P.comp = null; P.paused = null; };
    return P;
  };

  // ---------------------------------------------------------------- songs from audio files (assets/music)
  // assets/music/manifest.js lists them; each is fetched (or, opened from disk, read from the embedded copy
  // made by tools/embed-music.js), decoded once, measured, and turned up or down to sit with the built-in
  // songs. Until it has loaded (or if it can't), it simply isn't offered.
  const fileSongs = [];
  DL.fileSongs = fileSongs;
  DL.loadFiles = function (ctx) {
    const list = (AQ.data.musicFiles || []).filter((f) => f && f.file);
    list.forEach((f, i) => {
      const song = { id: 'file:' + f.file, file: f.file, name: f.title || f.file, places: f.places || (f.place ? [f.place] : []), time: f.night === true ? 'night' : f.night === false ? 'day' : (f.time || 'any'), loading: true };
      fileSongs.push(song);
      const emb = AQ.data.musicEmbedded && AQ.data.musicEmbedded[f.file];
      const bytes = emb ? Promise.resolve(Uint8Array.from(atob(emb), (ch) => ch.charCodeAt(0)).buffer) : fetch(f.file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      bytes.then((ab) => ctx.decodeAudioData(ab)).then((buf) => {
        let sum = 0, n = 0;                                        // its average level (every 7th sample is plenty)
        for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let k = 0; k < d.length; k += 7) { sum += d[k] * d[k]; n++; } }
        const db = 10 * Math.log10(sum / Math.max(1, n) + 1e-12), R = cfg().fileGainRange;
        song.buffer = buf; song.level = db; song.gain = Math.max(R[0], Math.min(R[1], Math.pow(10, (cfg().fileLoudness - db) / 20)));
        song.loading = false;
      }).catch((e) => { song.loading = false; song.failed = true; console.warn(`[music] couldn't load ${f.file}: ${e && e.message ? e.message : e}`); });
    });
  };
  const ready = (s) => !s.file || !!s.buffer;
  // every song: the built-in ones, then the audio files that have loaded
  DL.all = () => songs().concat(fileSongs.filter(ready));

  // ---------------------------------------------------------------- 4. the director
  const set = () => { const s = (AQ.State.settings = AQ.State.settings || {}); return (s.music = s.music || {}); };
  DL.frequency = () => (DL.FREQS.indexOf(set().delta) >= 0 ? set().delta : cfg().defaultFrequency);
  DL.ataraxiaOn = () => set().ataraxia !== false;
  DL.titlesOn = () => set().titles !== false;                    // SONG TITLES: the NOW PLAYING toast
  const heard = () => (AQ.State.music = AQ.State.music || { heard: {}, recent: [] });
  DL.byId = (id) => DL.all().find((s) => s.id === id);
  DL.playing = () => (DL.player && DL.player.song ? DL.player.song : null);
  DL.position = () => (DL.player ? DL.player.position() : 0);

  // seconds until the next song, for this frequency (randomized a little)
  function interval(f) {
    if (f === 'off') return Infinity;
    if (f === 'always') return cfg().alwaysGapSeconds;
    const j = cfg().jitter;
    return cfg().minutes[f] * 60 * (1 - j + Math.random() * 2 * j);
  }
  DL.setFrequency = function (f) {
    const was = DL.FREQS.indexOf(DL.frequency());
    set().delta = f;
    if (f === 'off') { if (DL.playing() && !DL.isTest) DL.player.stop(cfg().offFade); DL.wait = Infinity; }
    else if (DL.FREQS.indexOf(f) > was) DL.wait = Math.min(DL.wait != null && isFinite(DL.wait) ? DL.wait : Infinity, interval(f));   // more often: sooner, if anything
    else DL.wait = interval(f);                                    // less often: the new, longer wait starts now
    AQ.Save && AQ.Save.dirty();
  };
  DL.setAtaraxia = function (on) { set().ataraxia = !!on; AQ.Save && AQ.Save.dirty(); };
  DL.setTitles = function (on) { set().titles = !!on; AQ.Save && AQ.Save.dirty(); };

  // which song now: one of the place's own that fits the time of day (night songs only at night, and then
  // more likely; day songs only by day), else any song that fits; never the last one again, and songs heard
  // recently are less likely
  DL.pick = function (place, night) {
    const H = heard(), last = H.recent[H.recent.length - 1];
    const fits = (s) => (s.time === 'night' ? night : s.time === 'day' ? !night : true);
    let list = DL.all().filter((s) => fits(s) && (s.places || []).indexOf(place) >= 0);
    if (!list.length) list = DL.all().filter((s) => fits(s) && s.id !== 'delta');
    if (list.length > 1) list = list.filter((s) => s.id !== last);
    const recent = H.recent.slice(-cfg().recent);
    const weight = (s) => (recent.indexOf(s.id) >= 0 ? 0.25 : 1) / (1 + 0.15 * (H.heard[s.id] || 0)) * (night && s.time === 'night' ? 2 : 1);
    let r = Math.random() * list.reduce((a, s) => a + weight(s), 0);
    for (const s of list) { r -= weight(s); if (r <= 0) return s; }
    return list[0] || null;
  };
  // a moment a song shouldn't begin in (it waits until the moment ends)
  DL.blocked = function (game) {
    const st = game.state;
    if (st === 'loading' || st === 'soundtest') return true;
    if (AQ.Audio.settings().mute) return true;                    // nobody would hear it (and it would count as heard)
    if (AQ.Hydro && AQ.Hydro.k > 0.01) return true;               // LISTEN
    if (st === 'aquarium' && AQ.Aquarium && AQ.Aquarium.photo && AQ.Aquarium.photo.on) return true;   // photo mode
    if (AQ.Dive && AQ.Dive.active() && AQ.State.tutorial && AQ.State.tutorial.dive && AQ.State.tutorial.dive.step < cfg().waitDiveSteps) return true;
    return false;
  };
  // how: 'test' (the Sound Test: not counted as heard), 'jukebox' (you chose it: no NOW PLAYING toast)
  function begin(song, how) {
    if (!song || !DL.player) return;
    const test = how === true || how === 'test';
    if (DL.playing()) DL.player.clear();
    DL.player.start(song);
    DL.isTest = test; DL.how = test ? 'test' : how || 'auto';
    if (!test && how !== 'jukebox' && DL.titlesOn() && (!AQ.Tips || AQ.Tips.hintsOn()) && AQ.Badges && AQ.Badges.announceSong) AQ.Badges.announceSong(song);
    if (!test) {
      const H = heard(); H.heard[song.id] = (H.heard[song.id] || 0) + 1;
      H.recent.push(song.id); if (H.recent.length > 8) H.recent.shift();
      AQ.Save && AQ.Save.dirty();
    }
    if (DL.onBegin) DL.onBegin(song, test);
  }
  DL.begin = begin;
  // the Sound Test: play this song now (or stop it)
  DL.test = function (id) {
    if (!DL.player) return;
    if (DL.playing() && DL.playing().id === id) { DL.player.stop(1.5); return; }
    if (DL.playing()) DL.player.clear();
    begin(DL.byId(id), true);
  };
  DL.stop = function (fade = 1.5) { if (DL.playing()) DL.player.stop(fade); };

  DL.start = function (mix) {
    DL.player = DL.make(mix); DL.wait = interval(DL.frequency()); DL.titleVisit = false;
    DL.loadFiles(mix.ctx);
    songs().forEach((s) => DL.compile(s).errors.forEach((e) => console.warn('[songs] ' + e)));   // a song with a mistake says so
  };
  // once a frame (and on the music timer, with game = null: only keeps notes flowing)
  DL.update = function (dt, game) {
    if (!DL.player) return;
    DL.player.pump();
    if (DL.playing() && DL.player.done()) {                        // it has rung out
      const how = DL.how;
      DL.player.clear(); DL.isTest = false; DL.how = null;
      DL.wait = interval(DL.frequency());
      if (how === 'jukebox' && AQ.Jukebox) AQ.Jukebox.ended();     // the jukebox plays on (next, shuffle, repeat)
      if (DL.onEnd) DL.onEnd();
    }
    if (!game) return;
    if (AQ.Jukebox && AQ.Jukebox.active()) return;                 // the jukebox chooses for now
    const f = DL.frequency(), st = game.state;
    // the title screen: DELTA itself, once each time you arrive there (unless songs are OFF)
    const atTitle = st === 'title' || (st === 'log' && AQ.LogUI && AQ.LogUI.from === 'title');
    if (!atTitle) DL.titleVisit = false;
    else if (!DL.titleVisit) { DL.titleVisit = true; DL.titleT = cfg().titleDelay; }
    if (atTitle && DL.titleT != null) {
      DL.titleT -= dt;
      if (DL.titleT <= 0) { DL.titleT = null; if (f !== 'off' && !DL.playing() && !DL.blocked(game) && DL.byId('delta')) begin(DL.byId('delta')); }
    }
    if (f === 'off' || DL.playing() || st === 'soundtest') return;
    if (DL.wait == null || !isFinite(DL.wait)) DL.wait = interval(f);
    DL.wait -= dt;
    if (DL.wait <= 0 && !DL.blocked(game)) {
      const place = (AQ.Music.current || 'title').split(':')[0];
      begin(DL.pick(place, AQ.Clock.isNight()));
      if (!DL.playing()) DL.wait = 30;                             // (nothing fits: look again in a moment)
    }
  };
  return DL;
})();
