// ATARAXIA: the calm music that is always there. A held pad gliding between a place's few slow chords, a
// deep held bass note, and now and then a single bell, piano or plucked note with long silences around it.
// Nothing in it is a tune: notes are chord tones, one at a time, never a step away from the last one.
//
// It never restarts: changing place glides the same pad to the new place's notes (or, if the new place has
// a different pad colour, crossfades two pads), so there is no beginning and no gap. Depth, time of day and
// a meteor-shower night colour it as you go. Settings per place: AQ.data.music.ataraxia; tuning:
// AQ.TUNING.ataraxia. It plays on the mixer's 'ataraxia' layer (src/musicmix.js), which a Delta song dips.
//
//   AQ.Ataraxia.start(mix)                     once the audio is unlocked
//   AQ.Ataraxia.setPlace(id, seconds)          where we are ('kelp', 'title', ...)
//   AQ.Ataraxia.setMood({ depth, daylight, shower })   0..1 deep, 0..1 day, a shower night
//   AQ.Ataraxia.tick()                         often (every frame and on a timer): schedules what's next
//   AQ.Ataraxia.make()                         a separate copy (offline renders, tests) with the same calls
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Ataraxia = (function make() {
  const X = { place: null, pad: null, sub: null, mood: { depth: 0, daylight: 1, shower: false }, lastNote: null, applied: {} };
  const cfg = () => AQ.TUNING.ataraxia;
  const D = () => AQ.data.music.ataraxia;
  const IN = () => AQ.Instruments;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const now = () => X.mix.ctx.currentTime;
  const LAYER = 'ataraxia';

  X.start = function (mix) { X.mix = mix; };
  X.places = () => Object.keys(D());
  X.has = (id) => !!D()[id];

  // how much slower everything is now (night and depth), how dark, how loud
  function feel() {
    const C = cfg(), m = X.mood, day = Math.max(0, Math.min(1, m.daylight)), dep = Math.max(0, Math.min(1, m.depth));
    return {
      slow: lerp(C.night.slower, 1, day) * lerp(1, C.depth.slower, dep),
      bright: lerp(C.night.bright, 1, day) * (1 - C.depth.dark * dep),
      level: lerp(C.night.level, 1, day) * (1 - C.depth.quiet * dep),
      night: day < 0.35
    };
  }
  const chordOf = (p, i) => p.chords[i % p.chords.length].map((o) => p.root + o);
  const subNote = (p) => { let m = p.root - 12; while (m < 33) m += 12; return m; };

  X.setPlace = function (id, seconds) {
    if (!X.mix || !D()[id] || id === X.place) return;
    const p = D()[id], fade = seconds != null ? seconds : cfg().crossfadeSeconds, first = !X.place;
    X.place = id; X.p = p; X.chord = 0;
    if (!X.pad || X.pad.color !== p.color) {                       // a new pad colour: the old one fades out under the new
      if (X.pad) X.pad.stop(fade);                                // (it frees its own nodes once silent)
      X.pad = IN().padEngine(X.mix, LAYER, { color: p.color, voices: 4 });
      X.pad.setChord(chordOf(p, 0), now(), 0);
      X.pad.setBright(cutoff(p), 0.1);
    } else X.pad.setChord(chordOf(p, 0), now(), fade);             // the same pad glides to the new place's chord
    if (!X.sub) X.sub = IN().subEngine(X.mix, LAYER);
    X.sub.setNote(subNote(p), first ? 0 : fade);
    X.applied = {};
    apply(first ? 4 : fade);
    X.nextChord = now() + rnd(cfg().chordSeconds[0], cfg().chordSeconds[1]) * feel().slow;
    if (first || X.nextNote == null) X.nextNote = now() + rnd(3, 8);
  };
  X.setMood = function (m) { Object.assign(X.mood, m); };

  function cutoff(p) { const B = cfg().padBright; return lerp(B[0], B[1], p.bright) * feel().bright; }
  // brightness and loudness follow the moment (depth, daylight), smoothly; only sent when they really change
  function apply(seconds) {
    const p = X.p, f = feel(), cut = cutoff(p), lvl = p.level * f.level, sub = p.sub * f.level;
    const changed = (k, v) => { const o = X.applied[k]; if (o != null && Math.abs(v - o) / Math.max(1e-3, o) < 0.04) return false; X.applied[k] = v; return true; };
    if (changed('cut', cut)) X.pad.setBright(cut, seconds);
    if (changed('lvl', lvl)) X.pad.setLevel(lvl, seconds);
    if (changed('sub', sub)) X.sub.setLevel(sub * 0.35, seconds);
  }

  // the single occasional note: a chord tone (or the chord's colour tone) high above the pad; never a step
  // away from the last one (so no tune forms), sometimes left out altogether
  function playNote(t) {
    const p = X.p, C = cfg(), f = feel();
    if (Math.random() < C.noteSkip) return;
    let inst = p.notes[Math.floor(Math.random() * p.notes.length)];
    if (f.night && Math.random() < C.night.chip) inst = 'chip';
    if (X.mood.shower && Math.random() < C.showerShimmer) inst = 'glass';
    const lo = p.root + p.high[0] + (inst === 'chip' || inst === 'glass' ? 5 : 0), hi = p.root + p.high[1] + (inst === 'glass' && X.mood.shower ? 7 : 0);
    const pool = [];
    chordOf(p, X.chord).forEach((m) => { for (let k = m; k <= hi; k += 12) if (k >= lo) pool.push(k); });
    const ok = pool.filter((m) => X.lastNote == null || m === X.lastNote || Math.abs(m - X.lastNote) >= 5);
    const list = ok.length ? ok : pool;
    if (!list.length) return;
    const m = list[Math.floor(Math.random() * list.length)];
    X.lastNote = m;
    const v = rnd(0.32, 0.55) * (inst === 'piano' ? 0.9 : 1) * f.level;
    IN().play(X.mix, LAYER, inst, t, m, v, inst === 'piano' ? rnd(2, 4) : inst === 'chip' ? 0.5 : 2, { pan: rnd(-0.6, 0.6) });
  }

  X.tick = function () {
    if (!X.mix || !X.p) return;
    const C = cfg(), t = now(), ahead = AQ.TUNING.music.scheduleAhead, f = feel();
    if (t >= X.nextChord) {                                        // the pad glides on to another chord
      const n = X.p.chords.length;
      if (n > 1) { let i; do { i = Math.floor(Math.random() * n); } while (i === X.chord); X.chord = i; }
      X.pad.setChord(chordOf(X.p, X.chord), t, rnd(6, 10));
      X.nextChord = t + rnd(C.chordSeconds[0], C.chordSeconds[1]) * f.slow;
    }
    if (X.nextNote <= t + ahead) {
      if (X.nextNote >= t - 0.5 && !X.quiet) playNote(Math.max(t + 0.01, X.nextNote));   // (fell far behind: just move on)
      X.nextNote = Math.max(X.nextNote, t) + rnd(C.noteEvery[0], C.noteEvery[1]) * f.slow;
    }
    if (!X.driftT || t >= X.driftT) { X.pad.drift(); X.driftT = t + AQ.TUNING.music.humanize.padDriftSeconds * rnd(0.7, 1.3); }
    if (!X.applyT || t >= X.applyT) { apply(3); X.applyT = t + 0.5; }
  };
  // the place's version heard right now (for tests): its id, and what depth / night it is coloured by
  X.make = make;
  X.state = () => ({ place: X.place, chord: X.chord, mood: Object.assign({}, X.mood), feel: X.p ? feel() : null });

  return X;
})();
