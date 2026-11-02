// The music director. Builds the music mixer once the audio is unlocked (src/musicmix.js), and tells
// ATARAXIA (src/ataraxia.js) where the player is and how it feels there: the place (title, hill, station,
// aquarium, each sea biome), the depth, the time of day and a meteor-shower night. DELTA (src/delta.js)
// decides when a song plays; while one does, Ataraxia dips to a thin bed underneath it. Notes are scheduled on
// the audio clock, both every frame and on a small timer, so a slow frame never leaves a gap.
// Menus duck the music (AQ.Audio.setDuck). The two reward jingles (stingers) play over it.
// (The old generative music is in git history: docs/MUSIC_PLAN.md.)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Music = (function () {
  const A = AQ.Audio;
  const M = { current: null, test: null, mix: null };
  const D = () => AQ.data.music;
  const X = () => AQ.Ataraxia;

  M.start = function () {
    if (M.mix || !A.ready) return;
    M.mix = AQ.MusicMix.create(A.ctx, A.musicBus, { lowFx: AQ.U.lowFx() });
    AQ.MusicMix.setLayer(M.mix, 'ataraxia', AQ.TUNING.ataraxia.level, 0.05);
    AQ.MusicMix.setLayer(M.mix, 'fx', 1, 0.05);
    X().start(M.mix);
    AQ.Delta.start(M.mix);
    AQ.Delta.onBegin = () => M.layers(AQ.TUNING.delta.dipSeconds);
    AQ.Delta.onEnd = () => M.layers(AQ.TUNING.delta.returnSeconds);
    M.layers(0.05);
    // the scheduler also runs by itself, so dropped frames (or a busy phone) never leave a gap
    M.timer = setInterval(() => { try { X().tick(); AQ.Delta.update(0, null); } catch (e) {} }, AQ.TUNING.music.tickMs);
  };
  // Ataraxia's level: off (ATARAXIA OFF), a thin bed under a song, stepped back for a reward phrase, or full
  M.layers = function (seconds) {
    if (!M.mix) return;
    const on = AQ.Delta.ataraxiaOn(), song = !!AQ.Delta.playing(), sting = M.stingUntil && A.ctx.currentTime < M.stingUntil;
    const k = !on ? 0 : (song ? AQ.TUNING.delta.bedLevel : 1) * (sting ? 0.4 : 1);
    X().quiet = !on;                                               // off: no notes scheduled at all
    if (M.lastK === k) return;
    M.lastK = k;
    AQ.MusicMix.setLayer(M.mix, 'ataraxia', AQ.TUNING.ataraxia.level * k, seconds);
  };

  // which place's music: the Sound Test's choice, else where the player is (same rule as always)
  M.wanted = function (game) {
    if (M.test) return M.test;
    const st = game.state;
    if (st === 'soundtest') return M.current || 'title';
    const from = st === 'log' ? AQ.LogUI.from : st;
    if (from === 'title' || st === 'title') return 'title';
    if (st === 'aquarium' || from === 'aquarium') return 'aquarium';
    if (game.scene === 'station') return 'station';
    if (game.scene === 'hill') return 'hill';
    const P = game.player, b = AQ.World.biomeAt(P.x, P.y);
    return b && D().ataraxia[b.id] ? b.id : 'tide_pools';
  };
  // how it feels where the player is: depth (the sea only), daylight, a meteor-shower night
  function mood(game, key) {
    const [id, mode] = key.split(':');
    if (M.test) return { depth: D().ataraxia[id] ? D().ataraxia[id].depth : 0, daylight: mode === 'night' ? 0 : 1, shower: false };
    const inSea = game.scene === 'world' && (game.state === 'play' || game.state === 'map' || game.state === 'pause' || game.state === 'log');
    const depth = inSea && id !== 'title' && id !== 'aquarium' ? Math.max(0, Math.min(1, (game.player.y - AQ.World.sea) / (AQ.World.h - AQ.World.sea))) : 0;
    const daylight = id === 'station' ? 0.6 : AQ.Clock.daylight();              // (the station floats in space: always the same soft light)
    return { depth, daylight, shower: !!(AQ.Starfall && AQ.Starfall.showerTonight && AQ.Starfall.showerTonight()) };
  }

  M.update = function (dt, game) {
    if (!A.ready || !game) return;
    if (!M.mix) M.start();
    const want = M.wanted(game);
    // biome-to-biome changes while swimming settle first; anything else (title, aquarium, scenes) moves at once
    const roaming = game.scene === 'world' && (game.state === 'play' || game.state === 'map' || game.state === 'pause');
    if (A.settle(M, M.current, want, dt, !!M.test || !roaming)) { M.current = want; X().setPlace(want.split(':')[0], M.test ? 2 : undefined); }
    X().setMood(mood(game, M.current || want));
    X().tick();
    AQ.Delta.update(dt, game);
    M.layers(M.stingUntil && A.ctx.currentTime >= M.stingUntil - 0.05 ? 2.5 : 2);
    // menus: the music steps back
    const st = game.state;
    A.setDuck(st === 'log' || st === 'pause' || st === 'map' ? AQ.TUNING.audio.menuDuck : 1);
  };

  // ---------------------------------------------------------------- reward jingles
  // A short phrase on the 'fx' layer; Ataraxia steps back for a moment underneath it.
  M.stinger = function (id = 'reward') {
    if (!A.ready || A.settings().mute || !M.mix) return;
    const s = D().stingers[id];
    if (!s) return;
    if (AQ.data.audioFiles && AQ.data.audioFiles['music:' + id]) { A.playFile(AQ.data.audioFiles['music:' + id], { bus: A.musicBus }); return; }
    const c = A.ctx, beat = 60 / s.bpm, sc = D().scales[s.scale];
    const note = (st, oct = 0) => s.root + sc[((st % sc.length) + sc.length) % sc.length] + 12 * (Math.floor(st / sc.length) + oct);
    let t = c.currentTime + 0.2;
    s.notes.forEach((st, i) => {
      AQ.Instruments.play(M.mix, 'fx', s.lead, t, note(st), 0.75 * (s.vol || 1) * 1.6, s.beats[i] * beat);
      if (i % 3 === 0) AQ.Instruments.play(M.mix, 'fx', 'harp', t, note(st, -1), 0.4 * (s.vol || 1) * 1.6, s.beats[i] * beat);
      t += s.beats[i] * beat;
    });
    M.stingUntil = t + 0.5;                                        // Ataraxia steps back until then (M.layers)
    M.layers(0.4);
  };

  // the Sound Test's list: every place's Ataraxia, by day and at night, then the jingles
  M.catalog = function () {
    const out = [];
    for (const id in D().ataraxia) {
      const p = D().ataraxia[id];
      out.push({ id, label: p.label });
      out.push({ id: id + ':night', label: AQ.t('music.nightVersion', { name: p.label }) });
    }
    for (const id in D().stingers) out.push({ id, label: D().stingers[id].label, stinger: true });
    return out;
  };
  M.stats = () => AQ.MusicMix.stats(M.mix);
  return M;
})();

// register every place and jingle by id, so the registry lists them alongside effects and ambience
(function () {
  for (const id in AQ.data.music.ataraxia) AQ.Audio.register('music:' + id, { kind: 'music', piece: id });
  for (const id in AQ.data.music.stingers) AQ.Audio.register('music:' + id, { kind: 'music', piece: id, stinger: true });
})();
