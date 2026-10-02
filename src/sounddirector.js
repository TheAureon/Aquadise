// Sound director: once a frame, turns what's happening into sound. Splashes, swim bubbles, footsteps,
// ladder clinks, beam hums, dusk/dawn chimes, the rare little creature voices, the underwater filter,
// and it drives the music + ambience directors. (Event sounds like catching live at their call sites.)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SoundDirector = (function () {
  const A = AQ.Audio;
  const S = { prevMode: null, prevScene: null, stepDist: 0, bubbleT: 0, rung: 0, phase: null, voiceT: 5, hillMode: null, stationMode: null };
  const cfg = () => AQ.TUNING.audio;

  S.update = function (dt, game) {
    if (game.state === 'loading') return;
    const I = AQ.Input;
    if (I.rawPressed(cfg().muteKey)) A.toggleMute();
    if (!A.ready) return;
    if (AQ.Music) AQ.Music.update(dt, game);
    if (AQ.Ambience) AQ.Ambience.update(dt, game);
    const st = game.state, P = game.player;
    // underwater: muffled while submerged in the sea (and on the title screen's underwater view)
    const inSea = st === 'play' || st === 'map' || st === 'pause' || (st === 'log' && AQ.LogUI.from === 'play');
    A.setUnderwater(st === 'title' || (inSea && game.scene === 'world' && P.mode === 'swim'));
    if (st !== 'play') { S.prevMode = null; return; }
    const frozen = AQ.Transition.blocking();
    if (game.scene !== S.prevScene) { S.prevScene = game.scene; S.prevMode = null; S.phase = null; }

    // ---- moving about
    // splashes: only once you've really been in (or out of) the water a moment, so bobbing at the
    // surface stays quiet
    const wet = P.mode === 'swim';
    if (game.scene === 'world' && S.prevMode && !frozen && wet !== S.wet) {
      if (S.wetT > 0.3) A.play(wet ? 'splash_in' : 'splash_out');
      S.wetT = 0;
    }
    S.wet = wet; S.wetT = (S.wetT || 0) + dt;
    S.prevMode = P.mode;
    if (P.mode === 'swim') {
      S.bubbleT -= dt;
      if (S.bubbleT <= 0 && P.speed() > 20) { S.bubbleT = 0.7 + Math.random() * 0.9; A.play('bubbles', { vol: P.sneaking ? 0.35 : 1 }); }
    }
    if (P.mode === 'walk' && Math.abs(P.vx) > 6) {
      S.stepDist += Math.abs(P.vx) * dt;
      if (S.stepDist >= cfg().stepEvery) {
        S.stepDist = 0;
        const kind = game.scene === 'hill' ? 'step_grass' : game.scene === 'station' ? 'step_metal' : 'step_sand';
        A.play(kind, { vol: P.sneaking ? 0.5 : 1 });
      }
    }
    if (P.mode === 'climb') {
      const r = Math.floor((P.climbT || 0) / 0.3);
      if (r !== S.rung) { S.rung = r; A.play('ladder'); }
    }

    // ---- the beam (hill: lifted up; station: beamed down)
    if (game.scene === 'hill' && AQ.Hill) {
      if (AQ.Hill.mode === 'lift' && S.hillMode !== 'lift') A.play('beam_up');
      S.hillMode = AQ.Hill.mode;
      const g = AQ.Hill.geom();
      AQ.Ambience.set('beam', 1 - Math.min(1, Math.abs(P.x - g.beamX) / 140));
    } else S.hillMode = null;
    if (game.scene === 'station' && AQ.Station) {
      if (AQ.Station.mode === 'beamout' && S.stationMode !== 'beamout') A.play('beam_down');
      S.stationMode = AQ.Station.mode;
      // tank windows: a faint, muffled water sound as you walk past
      const L = AQ.data.station, feet = P.y + AQ.TUNING.swim.hitbox.h / 2;
      let near = 0;
      L.tanks.forEach((t) => { if (!t.tank) return; const dy = Math.abs(L.floors[t.floor] - feet), dx = Math.abs(t.x - P.x); if (dy < 20) near = Math.max(near, 1 - dx / 70); });
      AQ.Ambience.set('water', near * 0.6);
    } else S.stationMode = null;

    // ---- the sea's clock: soft chimes as dusk and dawn begin
    if (game.scene === 'world') {
      const ph = AQ.Clock.phase();
      if (S.phase && ph !== S.phase) { if (ph === 'dusk') A.play('dusk_chime'); else if (ph === 'dawn') A.play('dawn_chime'); }
      S.phase = ph;
      creatureVoices(dt, P);
    }
  };

  // Every so often (AQ.TUNING.audio.creatureVoiceEvery), one nearby creature makes a tiny sound:
  // its own `voice` (data/creatures.js) or its category's (AQ.data.creatureVoices).
  function creatureVoices(dt, P) {
    S.voiceT -= dt;
    if (S.voiceT > 0 || !AQ.Creatures) return;
    S.voiceT = cfg().creatureVoiceEvery * (0.6 + Math.random() * 0.8);
    const range = cfg().creatureVoiceRange;
    const near = AQ.Creatures.list.filter((c) => !c.hidden && !c.closed && voiceOf(c.def) && Math.abs(c.x - P.x) < range && Math.abs(c.y - P.y) < range);
    if (!near.length) return;
    const c = near[Math.floor(Math.random() * near.length)], dist = Math.hypot(c.x - P.x, c.y - P.y);
    A.play(voiceOf(c.def), { vol: Math.max(0.25, 1 - dist / range), pan: (c.x - P.x) / range });
  }
  const voiceOf = (d) => d.voice || (AQ.data.creatureVoices || {})[d.category] || null;
  S.voiceOf = voiceOf;

  return S;
})();
