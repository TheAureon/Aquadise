// Music previews: any DELTA song or any ATARAXIA place rendered offline (OfflineAudioContext) through the same
// instruments, music mixer and reverb as the game, measured, and saved as a WAV file to listen to anywhere.
// Used by the Sound Test's PREVIEW / EXPORT ALL buttons (AQ.TUNING.debug.musicPreview) and by
// tools/check-music.js. How a preview differs from the game: see docs/MUSIC_PLAN.md ("Previews").
//
//   AQ.MusicPreview.render({ song: id } | { place: id, night, seconds }) -> Promise<AudioBuffer>
//   AQ.MusicPreview.analyze(buffer) -> { seconds, peakDb, rmsDb, quiet10, loud10, silenceInside, tail, bands, shape }
//   AQ.MusicPreview.wav(buffer) -> Blob (16-bit stereo WAV)       AQ.MusicPreview.save(blob, name) (a download)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.MusicPreview = (function () {
  const MP = {};
  const RATE = 44100;
  const Offline = typeof OfflineAudioContext === 'function' ? OfflineAudioContext : (typeof webkitOfflineAudioContext === 'function' ? webkitOfflineAudioContext : null);
  MP.can = () => !!Offline && typeof Offline.prototype.suspend === 'function' && typeof Blob === 'function';        // (very old browsers: no PREVIEW buttons)
  // the level it is rendered at: the player's MUSIC slider and the master volume (mute ignored), as in the game
  function level() { const st = AQ.Audio.settings(); return (st.music != null ? st.music : AQ.TUNING.audio.musicVolume) * AQ.TUNING.audio.master; }

  MP.render = async function (what) {
    const song = what.song ? AQ.Delta.byId(what.song) : null;
    if (what.song && !song) throw new Error('no song ' + what.song);
    const place = what.place && AQ.data.music.ataraxia[what.place];
    if (what.place && !place) throw new Error('no place ' + what.place);
    if (song && song.file) await AQ.Delta.prepare(song);          // (a song from a file: its decoded sound)
    const secs = song ? Math.ceil(AQ.Delta.length(song) + (song.file ? 1 : 0)) : (what.seconds || AQ.TUNING.debug.musicPreviewSeconds);
    if (!MP.can()) throw new Error('offline audio is not supported here');
    const ctx = new Offline(2, Math.ceil(RATE * secs), RATE);
    const vol = ctx.createGain(); vol.gain.value = what.level != null ? what.level : level(); vol.connect(ctx.destination);
    const mix = AQ.MusicMix.create(ctx, vol, { lowFx: AQ.U.lowFx() });
    let tick, maxNodes = 0;
    if (song) {                                                    // the song alone (no Ataraxia under it)
      const pl = AQ.Delta.make(mix); pl.start(song, 0); tick = () => pl.pump();
    } else {                                                       // one place's Ataraxia, by day or at night
      AQ.MusicMix.setLayer(mix, 'ataraxia', AQ.TUNING.ataraxia.level);
      const x = AQ.Ataraxia.make(); x.start(mix);
      x.setMood({ depth: place.depth, daylight: what.night ? 0 : 1, shower: !!what.shower });
      x.setPlace(what.place); tick = () => x.tick();
    }
    // the scheduler runs every quarter second of the render, as the game's timer does
    for (let t = 0.25; t < secs; t += 0.25) ctx.suspend(t).then(() => { tick(); maxNodes = Math.max(maxNodes, mix.nodesAlive); ctx.resume(); });
    const buf = await ctx.startRendering();
    buf.stats = { notes: mix.started, stolen: mix.stolen, maxNodes, nodesAtEnd: mix.nodesAlive };
    if (song && song.file) AQ.Delta.release(song);                // (its decoded sound is let go again, unless it's playing)
    return buf;
  };

  // ---------------------------------------------------------------- measuring
  // Loudness in 0.4 s windows; spectrum in five bands (FFT, every half second); the song's shape in tenths.
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, br = re[b] * cr - im[b] * ci, bi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - br; im[b] = im[a] - bi; re[a] += br; im[a] += bi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  MP.BANDS = [[20, 120], [120, 400], [400, 1500], [1500, 5000], [5000, 16000]];
  const db = (p) => 10 * Math.log10(p + 1e-12);
  MP.analyze = function (buf) {
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = L.length, sr = buf.sampleRate;
    const win = Math.floor(sr * 0.4), wins = [];
    let peak = 0, sum = 0, ws = 0;
    for (let i = 0; i < n; i++) {
      const m = (L[i] + R[i]) / 2;
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += m * m; ws += m * m;
      if ((i + 1) % win === 0) { wins.push(db(ws / win)); ws = 0; }
    }
    // the last window with sound: after it is only the ending's tail
    let last = wins.length - 1; while (last > 0 && wins[last] < -60) last--;
    let run = 0, longest = 0;
    for (let i = 0; i <= last; i++) { if (wins[i] < -60) { run += 0.4; longest = Math.max(longest, run); } else run = 0; }
    const body = wins.slice(Math.min(5, last), last + 1).sort((a, b) => a - b);
    const N = 4096, re = new Float32Array(N), im = new Float32Array(N), bp = MP.BANDS.map(() => 0);
    for (let s0 = Math.min(sr * 2, n - N - 1); s0 + N < n; s0 += sr / 2) {
      for (let i = 0; i < N; i++) { re[i] = (L[s0 + i] + R[s0 + i]) / 2 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
      fft(re, im);
      for (let k = 1; k < N / 2; k++) { const f = k * sr / N, pw = re[k] * re[k] + im[k] * im[k]; MP.BANDS.forEach(([a, z], j) => { if (f >= a && f < z) bp[j] += pw; }); }
    }
    const bt = bp.reduce((a, b) => a + b, 0) || 1, tenth = Math.max(1, Math.floor((last + 1) / 10)), shape = [];
    for (let k = 0; k < 10; k++) { let e = 0, c = 0; for (let i = k * tenth; i < Math.min(last + 1, (k + 1) * tenth); i++) { e += Math.pow(10, wins[i] / 10); c++; } shape.push(Math.round(db(e / Math.max(1, c)))); }
    const q = (k) => +(body[Math.floor((body.length - 1) * k)] || -120).toFixed(1);
    return {
      seconds: +(n / sr).toFixed(1), lastSound: +((last + 1) * 0.4).toFixed(1), peakDb: +db(peak * peak).toFixed(1), rmsDb: +db(sum / n).toFixed(1),
      quiet10: q(0.1), loud10: q(0.9), silenceInside: +longest.toFixed(1), bands: bp.map((x) => Math.round(100 * x / bt)), shape
    };
  };

  // ---------------------------------------------------------------- saving
  MP.wav = function (buf) {
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = L.length;
    const ab = new ArrayBuffer(44 + n * 4), v = new DataView(ab), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    return new Blob([ab], { type: 'audio/wav' });
  };
  MP.save = function (blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  // clear file names: Aquadise-DELTA-01-delta.wav, Aquadise-ATARAXIA-kelp-night.wav
  MP.name = function (what) {
    if (what.song) { const i = AQ.Delta.all().findIndex((s) => s.id === what.song); return `Aquadise-DELTA-${String(i + 1).padStart(2, '0')}-${what.song.replace(/^file:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '')}.wav`; }
    return `Aquadise-ATARAXIA-${what.place.replace(/_/g, '-')}-${what.night ? 'night' : 'day'}.wav`;
  };

  // ---------------------------------------------------------------- the Sound Test's buttons
  MP.busy = null;                                                  // { n, total, name } while rendering
  MP.export = async function (list) {
    if (MP.busy) return;
    for (let i = 0; i < list.length; i++) {
      MP.busy = { n: i + 1, total: list.length, name: MP.name(list[i]) };
      try { MP.save(MP.wav(await MP.render(list[i])), MP.busy.name); } catch (e) { console.warn('[preview] ' + (e && e.message)); }
      await new Promise((r) => setTimeout(r, 400));                 // (a moment between downloads, so the browser keeps up)
    }
    MP.done = { total: list.length, at: Date.now() };
    MP.busy = null;
  };
  return MP;
})();
