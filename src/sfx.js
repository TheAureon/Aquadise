// Sound effect recipes. Each one is registered by id and built from a few soft oscillators and
// filtered noise (helpers in AQ.Audio.H). Everything is gentle on purpose: soft attacks, low volume,
// no harsh highs. To replace one with a real recording, map its id in AQ.data.audioFiles.
//
//   AQ.Audio.register(id, { label, group, fn(ctx, out, t, opts) -> seconds, minGap, important })
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

(function () {
  const A = AQ.Audio, H = A.H, m = H.midi;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reg = (id, group, label, fn, extra) => A.register(id, Object.assign({ kind: 'sfx', group, label, fn }, extra || {}));
  // a few bell notes in a row (chimes, jingles)
  const run = (c, o, t, notes, step, v, d) => { notes.forEach((n, i) => H.bell(c, o, t + i * step, m(n), v, d)); return notes.length * step + d; };

  // ---------------------------------------------------------------- the original hooks
  reg('swing', 'net', 'NET SWING', (c, o, t) => H.noise(c, o, t, { f: 500, f2: 1700, q: 0.8, a: 0.05, d: 0.16, v: 0.13 }), { minGap: 0.12 });
  reg('catch', 'net', 'CATCH', (c, o, t, op) => {
    if (op && op.rare) return A.sounds.catch_rare.fn(c, o, t, op);
    H.tone(c, o, t, { f: m(60), v: 0.06, d: 0.5, a: 0.01, type: 'triangle', lp: 1200 });
    return run(c, o, t, [72, 76, 79, 84], 0.07, 0.09, 0.7);
  }, { important: true, minGap: 0.2 });
  reg('catch_rare', 'net', 'CATCH RARE', (c, o, t) => {
    H.tone(c, o, t, { f: m(60), v: 0.06, d: 0.9, a: 0.02, type: 'triangle', lp: 1200 });
    H.tone(c, o, t, { f: m(67), v: 0.04, d: 0.9, a: 0.02, type: 'triangle', lp: 1400 });
    const d = run(c, o, t, [72, 76, 79, 83, 84, 88, 91], 0.065, 0.08, 1.0);
    for (let i = 0; i < 8; i++) H.bell(c, o, t + 0.45 + i * 0.05, m(96 + (i % 4) * 2 + (i > 3 ? 3 : 0)), 0.025, 0.4);   // sparkles
    H.noise(c, o, t + 0.4, { ft: 'highpass', f: 6000, a: 0.1, d: 0.6, v: 0.025 });
    return d + 0.3;
  }, { important: true, minGap: 0.2 });
  reg('spook', 'creatures', 'SPOOK', (c, o, t) => {
    for (let i = 0; i < 3; i++) H.tone(c, o, t + i * 0.045, { f: rnd(380, 460) + i * 120, f2: 900 + i * 200, glide: 0.05, d: 0.06, v: 0.07 });
    H.noise(c, o, t, { f: 2500, q: 2, d: 0.12, v: 0.03 });
    return 0.25;
  }, { minGap: 0.25 });
  reg('lunge', 'creatures', 'LUNGE', (c, o, t) => {
    H.tone(c, o, t, { type: 'triangle', f: 150, f2: 65, d: 0.14, v: 0.22, lp: 700 });
    H.noise(c, o, t, { ft: 'lowpass', f: 900, a: 0.005, d: 0.08, v: 0.08 });
    return 0.2;
  }, { minGap: 0.3 });
  reg('bait', 'net', 'BAIT PLOP', (c, o, t) => {
    H.tone(c, o, t, { f: 620, f2: 190, d: 0.13, v: 0.16 });
    H.tone(c, o, t + 0.12, { f: 520, f2: 900, d: 0.05, v: 0.04 });
    return 0.25;
  });
  reg('bump', 'creatures', 'BUMP', (c, o, t) => {
    H.tone(c, o, t, { f: 120, f2: 60, d: 0.22, v: 0.26, lp: 320 });
    H.noise(c, o, t, { ft: 'lowpass', f: 400, d: 0.1, v: 0.06 });
    return 0.3;
  }, { minGap: 0.3 });
  reg('harvest', 'net', 'HARVEST SNIP', (c, o, t) => {
    H.noise(c, o, t, { ft: 'highpass', f: 3500, a: 0.002, d: 0.035, v: 0.09 });
    H.noise(c, o, t + 0.07, { ft: 'highpass', f: 3800, a: 0.002, d: 0.035, v: 0.08 });
    H.noise(c, o, t + 0.05, { f: 2200, f2: 1200, q: 0.8, a: 0.03, d: 0.22, v: 0.06 });   // leafy rustle
    return 0.35;
  });
  const creak = (c, o, t, v = 0.07) => {
    H.tone(c, o, t, { type: 'sawtooth', f: 160, f2: 230, glide: 0.3, a: 0.04, d: 0.3, v, lp: 600, q: 4 });
    H.tone(c, o, t, { type: 'triangle', f: 95, f2: 120, glide: 0.3, a: 0.04, d: 0.3, v: v * 0.8, lp: 400 });
    return 0.35;
  };
  reg('chest', 'world', 'CHEST', (c, o, t) => {
    creak(c, o, t);
    return 0.35 + run(c, o, t + 0.35, [84, 88, 91, 96, 91, 96], 0.055, 0.06, 0.6);
  }, { important: true });
  reg('unlock', 'aquarium', 'UNLOCK', (c, o, t) => {
    H.tone(c, o, t, { type: 'triangle', f: m(60), v: 0.05, a: 0.1, d: 1.6, lp: 1500 });
    H.tone(c, o, t, { type: 'triangle', f: m(64), v: 0.04, a: 0.1, d: 1.6, lp: 1500 });
    return run(c, o, t, [79, 84, 88, 91, 96, 100, 103, 108], 0.085, 0.065, 1.1);
  }, { important: true });
  reg('door', 'world', 'DOOR', (c, o, t) => {
    H.noise(c, o, t, { ft: 'lowpass', f: 380, f2: 700, a: 0.15, d: 0.5, v: 0.12 });
    H.tone(c, o, t, { f: 95, f2: 118, a: 0.15, d: 0.55, v: 0.06 });
    return 0.75;
  }, { minGap: 0.4 });
  reg('feed', 'aquarium', 'FEED', (c, o, t) => {
    for (let i = 0; i < 9; i++) { const f = rnd(900, 1700); H.tone(c, o, t + i * 0.07 + rnd(0, 0.03), { f, f2: f * 0.55, d: 0.04, v: 0.05 }); }
    return 0.75;
  }, { minGap: 0.3 });

  // ---------------------------------------------------------------- moving around
  reg('splash_in', 'moving', 'SPLASH IN', (c, o, t) => {
    H.noise(c, o, t, { ft: 'lowpass', f: 3200, f2: 450, a: 0.01, d: 0.45, v: 0.3 });
    for (let i = 0; i < 4; i++) H.tone(c, o, t + 0.12 + i * 0.07, { f: rnd(300, 500), f2: rnd(700, 1000), d: 0.05, v: 0.04 });
    return 0.6;
  }, { minGap: 0.5 });
  reg('splash_out', 'moving', 'SPLASH OUT', (c, o, t) => {
    H.noise(c, o, t, { f: 1100, f2: 2600, q: 0.7, a: 0.02, d: 0.28, v: 0.22 });
    for (let i = 0; i < 3; i++) H.tone(c, o, t + 0.25 + i * rnd(0.08, 0.16), { f: rnd(1300, 1800), f2: 700, d: 0.04, v: 0.035 });   // drips
    return 0.7;
  }, { minGap: 0.5 });
  reg('bubbles', 'moving', 'SWIM BUBBLES', (c, o, t) => {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) { const f = rnd(280, 520); H.tone(c, o, t + i * rnd(0.05, 0.1), { f, f2: f * 1.8, d: 0.05, v: 0.045 }); }
    return 0.35;
  }, { minGap: 0.3 });
  reg('step_sand', 'moving', 'STEP SAND', (c, o, t) => H.noise(c, o, t, { f: rnd(1100, 1600), q: 0.7, a: 0.005, d: 0.06, v: 0.2 }), { minGap: 0.08 });
  reg('step_grass', 'moving', 'STEP GRASS', (c, o, t) => {
    H.noise(c, o, t, { ft: 'highpass', f: rnd(2800, 3600), a: 0.006, d: 0.05, v: 0.12 });
    return H.noise(c, o, t + 0.01, { f: 900, q: 1, a: 0.004, d: 0.04, v: 0.1 });
  }, { minGap: 0.25 });
  reg('step_metal', 'moving', 'STEP METAL', (c, o, t) => {
    const f = rnd(480, 560);
    H.tone(c, o, t, { f, d: 0.1, v: 0.07, type: 'triangle', lp: 1800 });
    H.tone(c, o, t, { f: f * 2.4, d: 0.05, v: 0.012 });
    return H.noise(c, o, t, { f: 3000, q: 1.5, a: 0.002, d: 0.02, v: 0.03 });
  }, { minGap: 0.08 });
  reg('ladder', 'moving', 'LADDER CLINK', (c, o, t) => {
    const f = rnd(820, 980);
    H.tone(c, o, t, { f, d: 0.16, v: 0.04 }); H.tone(c, o, t, { f: f * 2.7, d: 0.08, v: 0.012 });
    return 0.2;
  }, { minGap: 0.12 });

  // ---------------------------------------------------------------- the beam, scene changes
  reg('beam_hum', 'beam', 'BEAM HUM', (c, o, t) => {
    H.tone(c, o, t, { f: 110, a: 0.3, d: 1.4, v: 0.08 }); H.tone(c, o, t, { f: 220, detune: 6, a: 0.3, d: 1.4, v: 0.04 });
    H.tone(c, o, t, { f: 330, detune: -5, a: 0.4, d: 1.2, v: 0.015 });
    return 1.8;
  });
  const beam = (c, o, t, up) => {
    H.tone(c, o, t, { f: up ? 140 : 560, f2: up ? 560 : 140, glide: 1.4, a: 0.25, d: 1.4, v: 0.07, type: 'triangle', lp: 1600 });
    H.tone(c, o, t, { f: up ? 210 : 840, f2: up ? 840 : 210, glide: 1.4, a: 0.3, d: 1.3, v: 0.03, detune: 7 });
    const notes = [84, 88, 91, 96, 100, 103];
    (up ? notes : notes.slice().reverse()).forEach((n, i) => H.bell(c, o, t + 0.2 + i * 0.18, m(n), 0.03, 0.7));
    return 2.0;
  };
  reg('beam_up', 'beam', 'BEAM UP', (c, o, t) => beam(c, o, t, true), { important: true, minGap: 1 });
  reg('beam_down', 'beam', 'BEAM DOWN', (c, o, t) => beam(c, o, t, false), { important: true, minGap: 1 });
  reg('transition', 'beam', 'TRANSITION', (c, o, t) => H.noise(c, o, t, { f: 300, f2: 1300, q: 0.7, a: 0.3, d: 0.45, v: 0.07 }), { minGap: 0.5 });

  // ---------------------------------------------------------------- menus
  reg('menu_move', 'menus', 'MENU MOVE', (c, o, t) => H.tone(c, o, t, { f: 1180, d: 0.035, v: 0.06, type: 'triangle' }), { minGap: 0.04, important: true });
  reg('menu_select', 'menus', 'MENU SELECT', (c, o, t) => {
    H.tone(c, o, t, { f: 880, d: 0.06, v: 0.08, type: 'triangle' });
    return H.tone(c, o, t + 0.06, { f: 1320, d: 0.12, v: 0.08, type: 'triangle' }) + 0.06;
  }, { minGap: 0.08, important: true });
  reg('log_open', 'menus', 'LOG OPEN', (c, o, t) => {
    H.noise(c, o, t, { f: 1800, f2: 4200, q: 0.8, a: 0.04, d: 0.14, v: 0.06 });
    return H.bell(c, o, t + 0.08, m(88), 0.035, 0.5) + 0.08;
  }, { important: true });
  reg('log_close', 'menus', 'LOG CLOSE', (c, o, t) => {
    H.noise(c, o, t, { f: 4000, f2: 1600, q: 0.8, a: 0.03, d: 0.14, v: 0.05 });
    return H.bell(c, o, t + 0.06, m(81), 0.03, 0.4) + 0.06;
  }, { important: true });
  reg('bottle', 'world', 'BOTTLE PICKUP', (c, o, t) => {
    H.tone(c, o, t, { f: 520, f2: 260, glide: 0.05, d: 0.06, v: 0.12 });                 // cork pop
    H.noise(c, o, t, { ft: 'highpass', f: 2500, a: 0.002, d: 0.03, v: 0.05 });
    return run(c, o, t + 0.1, [88, 95, 100], 0.07, 0.045, 1.1) + 0.1;                       // glass chime
  }, { important: true, minGap: 0.3 });
  reg('shutter', 'aquarium', 'CAMERA SHUTTER', (c, o, t) => {
    H.noise(c, o, t, { ft: 'highpass', f: 2800, a: 0.001, d: 0.025, v: 0.09 });          // click
    H.tone(c, o, t + 0.005, { type: 'triangle', f: 900, f2: 500, d: 0.04, v: 0.04 });
    H.noise(c, o, t + 0.07, { ft: 'highpass', f: 3200, a: 0.001, d: 0.02, v: 0.06 });     // the blades close
    return H.noise(c, o, t + 0.03, { f: 1500, q: 0.8, a: 0.02, d: 0.08, v: 0.03 }) + 0.05;   // soft whirr
  }, { important: true, minGap: 0.2 });
  // a very faint, far-off gull cry as a flock passes: played through the AMBIENCE bus (ambience
  // volume + mute apply), rate-limited by AQ.TUNING.gulls.cryMinGap
  // a shooting star: a very soft airy whoosh with a faint high shimmer on top
  reg('star_whoosh', 'world', 'SHOOTING STAR', (c, o, t) => {
    H.noise(c, o, t, { f: 2400, f2: 900, q: 0.9, a: 0.12, d: 0.55, v: 0.035 });
    H.tone(c, o, t + 0.05, { type: 'sine', f: 2600, f2: 1900, glide: 0.5, a: 0.08, d: 0.5, v: 0.012 });
    return 0.7;
  }, { bus: 'amb', minGap: AQ.TUNING.shootingStars.soundMinGap });
  reg('gull_far', 'world', 'DISTANT GULLS', (c, o, t) => {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const f = 1350 + Math.random() * 250;
      H.tone(c, o, t + i * 0.34, { type: 'triangle', f, f2: f * 0.7, glide: 0.24, a: 0.03, d: 0.24, v: 0.035, lp: 2200 });
      H.tone(c, o, t + i * 0.34 + 0.12, { type: 'triangle', f: f * 0.95, f2: f * 0.68, glide: 0.18, a: 0.02, d: 0.16, v: 0.02, lp: 2000 });
    }
    return 0.4 + n * 0.34;
  }, { bus: 'amb', minGap: AQ.TUNING.gulls.cryMinGap });
  reg('page_turn', 'menus', 'PAGE TURN', (c, o, t) => {
    H.noise(c, o, t, { f: 1800, f2: 3600, q: 0.7, a: 0.03, d: 0.12, v: 0.06 });      // paper swish
    return H.noise(c, o, t + 0.09, { ft: 'lowpass', f: 600, a: 0.005, d: 0.05, v: 0.04 }) + 0.09;   // soft settle
  }, { minGap: 0.08, important: true });
  reg('toast', 'menus', 'TOAST BLIP', (c, o, t) => H.bell(c, o, t, m(91), 0.025, 0.25), { minGap: 0.35 });

  // ---------------------------------------------------------------- upgrades (after the chest jingle)
  reg('up_net', 'upgrades', 'NET SWELL', (c, o, t) => {
    H.tone(c, o, t, { type: 'triangle', f: 196, f2: 392, glide: 0.5, a: 0.25, d: 0.6, v: 0.08, lp: 1400 });
    return run(c, o, t + 0.4, [79, 83, 86], 0.08, 0.05, 0.6) + 0.4;
  }, { important: true });
  reg('up_speed', 'upgrades', 'SPEED WHOOSH', (c, o, t) => {
    H.noise(c, o, t, { f: 400, f2: 3200, q: 0.9, a: 0.08, d: 0.35, v: 0.1 });
    H.tone(c, o, t + 0.05, { f: 440, f2: 1320, glide: 0.3, d: 0.35, v: 0.04, type: 'triangle' });
    return 0.5;
  }, { important: true });
  reg('up_lantern', 'upgrades', 'LANTERN GLOW', (c, o, t) => {
    H.noise(c, o, t, { ft: 'highpass', f: 3000, a: 0.002, d: 0.03, v: 0.07 });        // click
    [m(60), m(64), m(67), m(72)].forEach((f, i) => H.tone(c, o, t + 0.05 + i * 0.03, { f, a: 0.35, d: 1.2, v: 0.035 }));   // warm glow
    return 1.6;
  }, { important: true });
  reg('up_depth', 'upgrades', 'DEPTH HUM', (c, o, t) => {
    H.tone(c, o, t, { f: 55, a: 0.4, d: 1.5, v: 0.2 }); H.tone(c, o, t, { f: 82.5, a: 0.5, d: 1.3, v: 0.08 });
    H.tone(c, o, t + 0.2, { f: 110, a: 0.5, d: 1.1, v: 0.03, type: 'triangle', lp: 300 });
    return 2;
  }, { important: true });

  // ---------------------------------------------------------------- aquarium
  reg('place', 'aquarium', 'PLACE', (c, o, t) => {
    H.tone(c, o, t, { type: 'triangle', f: 1500, d: 0.025, v: 0.04 });
    return H.tone(c, o, t, { f: 320, f2: 220, d: 0.07, v: 0.08 });
  }, { minGap: 0.06 });
  reg('flip', 'aquarium', 'FLIP', (c, o, t) => H.noise(c, o, t, { f: 1400, f2: 3200, q: 1, a: 0.02, d: 0.09, v: 0.07 }), { minGap: 0.08 });
  reg('undo', 'aquarium', 'UNDO', (c, o, t) => H.noise(c, o, t, { f: 3200, f2: 1300, q: 1, a: 0.02, d: 0.11, v: 0.07 }), { minGap: 0.08 });
  reg('clear', 'aquarium', 'CLEAR', (c, o, t) => H.noise(c, o, t, { ft: 'lowpass', f: 4200, f2: 350, a: 0.05, d: 0.6, v: 0.11 }), { minGap: 0.4 });
  reg('star', 'aquarium', 'STAR GAINED', (c, o, t) => run(c, o, t, [84, 91, 96], 0.09, 0.05, 0.8), { important: true, minGap: 0.5 });
  reg('fanfare', 'aquarium', 'DECOR FANFARE', (c, o, t) => {
    const ns = [67, 72, 76, 79, 76, 79, 84];
    ns.forEach((n, i) => H.tone(c, o, t + i * 0.11, { type: 'triangle', f: m(n), d: i === ns.length - 1 ? 1.2 : 0.3, v: 0.06, lp: 2400 }));
    [m(48), m(55), m(60)].forEach((f) => H.tone(c, o, t + 0.66, { f, a: 0.05, d: 1.4, v: 0.04 }));
    return 2.1;
  }, { important: true, minGap: 1 });
  reg('hearts', 'aquarium', 'HEART SPARKLES', (c, o, t) => { H.bell(c, o, t, m(rnd(98, 102) | 0), 0.018, 0.25); return H.bell(c, o, t + 0.07, m(103), 0.014, 0.25) + 0.07; }, { minGap: 1.5 });

  // ---------------------------------------------------------------- breeding + the clock
  reg('baby', 'life', 'BABY BORN', (c, o, t) => run(c, o, t, [79, 81, 84, 88, 86, 91], 0.12, 0.05, 0.8), { important: true, minGap: 2 });
  reg('court', 'life', 'COURTSHIP', (c, o, t) => {
    for (let i = 0; i < 5; i++) H.bell(c, o, t + i * 0.09 + rnd(0, 0.03), m(96 + [0, 4, 7, 4, 12][i]), 0.02, 0.4);
    return 0.9;
  }, { minGap: 6 });
  reg('dusk_chime', 'life', 'DUSK CHIME', (c, o, t) => run(c, o, t, [79, 76, 72, 67], 0.45, 0.05, 1.8), { important: true, minGap: 5 });
  reg('dawn_chime', 'life', 'DAWN CHIME', (c, o, t) => run(c, o, t, [67, 72, 76, 79, 84], 0.35, 0.05, 1.6), { important: true, minGap: 5 });

  // ---------------------------------------------------------------- creature voices (tiny + rare)
  reg('voice_fish', 'voices', 'FISH BLIP', (c, o, t) => H.tone(c, o, t, { f: rnd(620, 820), f2: rnd(950, 1200), d: 0.06, v: 0.04 }));
  reg('voice_crab', 'voices', 'CRAB CLICK', (c, o, t) => {
    H.noise(c, o, t, { f: 3400, q: 3, a: 0.001, d: 0.015, v: 0.06 });
    return H.noise(c, o, t + 0.08, { f: 3000, q: 3, a: 0.001, d: 0.015, v: 0.05 }) + 0.08;
  });
  reg('voice_squid', 'voices', 'SQUID SQUELCH', (c, o, t) => {
    H.tone(c, o, t, { f: 320, f2: 140, d: 0.14, v: 0.05, lp: 700 });
    return H.noise(c, o, t, { ft: 'lowpass', f: 700, f2: 300, a: 0.01, d: 0.12, v: 0.04 });
  });
  reg('voice_mammal', 'voices', 'MAMMAL CHIRP', (c, o, t) => {
    H.tone(c, o, t, { f: 1400, f2: 2100, d: 0.07, v: 0.035 });
    return H.tone(c, o, t + 0.11, { f: 1600, f2: 2400, d: 0.08, v: 0.03 }) + 0.11;
  });
  reg('voice_amphibian', 'voices', 'AMPHIBIAN CROAK', (c, o, t) => {
    for (let i = 0; i < 3; i++) H.tone(c, o, t + i * 0.055, { type: 'triangle', f: 125, f2: 105, d: 0.045, v: 0.08, lp: 500 });
    return 0.25;
  });
  reg('voice_reptile', 'voices', 'REPTILE HISS', (c, o, t) => H.noise(c, o, t, { ft: 'highpass', f: 4200, a: 0.12, d: 0.3, v: 0.025 }));
  reg('glow_chime', 'voices', 'GLOW CHIME', (c, o, t) => { H.bell(c, o, t, m(96), 0.035, 1.4); return H.bell(c, o, t + 0.16, m(103), 0.025, 1.6) + 0.16; });
  reg('turtle_note', 'voices', 'TURTLE NOTE', (c, o, t) => {
    H.tone(c, o, t, { f: 73.4, f2: 69, glide: 2, a: 0.5, d: 2.2, v: 0.12 });
    H.tone(c, o, t, { f: 146.8, f2: 138, glide: 2, a: 0.6, d: 1.8, v: 0.03, lp: 500 });
    return 2.8;
  });
  reg('bell_tiny', 'voices', 'TINY BELL', (c, o, t) => H.bell(c, o, t, m(rnd(95, 98) | 0), 0.04, 0.7));
})();
