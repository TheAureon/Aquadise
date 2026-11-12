// The music's live checks (node tools/check-music.js --live): plays the game in a headless browser and checks
// the music's rules in every situation. Each line says PASS or FAIL and what it saw.
'use strict';

module.exports = async function live(pw, port, problems, notes) {
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  let pass = 0;
  const check = (name, ok, saw) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${saw != null ? ' - ' + saw : ''}`); if (ok) pass++; else problems.push(`live: ${name}${saw != null ? ' (' + saw + ')' : ''}`); };
  async function open(ctxOpts) {
    const ctx = await browser.newContext(ctxOpts || {}), p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(url); await p.waitForFunction(() => window.AQ && AQ.Game && AQ.Game.state === 'title', null, { timeout: 60000 });
    await p.keyboard.press('Shift'); await p.waitForTimeout(600);       // (the audio starts on a key press)
    await p.evaluate(() => {
      window.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      AQ.SaveFile.reminded = true; AQ.Tips.setHints(false); AQ.State.quests = { asked: true, on: false, done: {}, skips: {} };
      AQ.Save.save = () => {};                                    // (the checks never write over a real save)
      window.endSong = () => { const P = AQ.Delta.player; if (P && P.comp) P.t0 -= P.comp.seconds + 1; };
      window.playing = () => (AQ.Delta.playing() ? AQ.Delta.playing().id : null);
      window.layer = (n) => AQ.MusicMix.layerLevel(AQ.Music.mix, n);
    });
    return p;
  }
  console.log('\nLIVE');
  const p = await open();
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // ---- every place, by day and at night: Ataraxia follows; night colours it
  const places = await ev(async () => {
    const G = AQ.Game, out = [];
    G.state = 'play'; AQ.Dive.decline(); AQ.Delta.setFrequency('off');
    const spot = (id) => { const b = AQ.data.world.biomes.find((x) => x.id === id), [x0, y0, w, h] = b.rect;
      for (let y = y0 + 40; y < y0 + h; y += 20) for (let x = x0 + 20; x < x0 + w; x += 20) if (AQ.World.biomeAt(x, y).id === id && AQ.World.isWater && AQ.World.isWater(x, y)) return [x, y];
      for (let y = y0 + 40; y < y0 + h; y += 20) for (let x = x0 + 20; x < x0 + w; x += 20) if (AQ.World.biomeAt(x, y).id === id) return [x, y];
      return null; };
    for (const night of [false, true]) {
      AQ.Clock.set(night ? 23 : 12);
      const go = async (id, setup, wait = 250) => { setup(); await sleep(wait); for (let k = 0; k < 23 && wait > 1000 && (AQ.Music.current || '').split(':')[0] !== id; k++) await sleep(100); out.push([id, night, AQ.Music.current, AQ.Ataraxia.state().place, AQ.Ataraxia.state().feel.night]); };
      await go('title', () => AQ.Title.open(G));
      await go('aquarium', () => { G.state = 'play'; AQ.Aquarium.open(G, 'play', 'kelp'); });
      await go('station', () => { G.state = 'play'; AQ.Scenes.restore(G, 'station', 300, 380); });
      await go('hill', () => { G.state = 'play'; AQ.Scenes.restore(G, 'hill', 200, 100); });
      G.state = 'play'; AQ.Scenes.restore(G, 'world', 300, 300); await sleep(1200);   // (back in the sea: let the scene change finish)
      for (const b of AQ.data.world.biomes) { const s = spot(b.id); if (s) await go(b.id, () => { G.state = 'play'; AQ.Scenes.restore(G, 'world', s[0], s[1]); G.player.x = s[0]; G.player.y = s[1]; }, 1700); }   // (swimming between places waits 1.2 s before it changes; a slow frame can stretch that, so up to 4 s)
    }
    return out;
  });
  const wrong = places.filter(([id, night, cur, pl, n]) => cur !== id || pl !== id || (night && id !== 'station' && !n));
  check(`ATARAXIA in all ${places.length / 2} places, by day and at night`, !wrong.length, wrong.length ? JSON.stringify(wrong.slice(0, 3)) : `${places.length} visits`);

  // ---- a song keeps playing through a scene change, pause and menus
  let r = await ev(async () => {
    const G = AQ.Game; AQ.Clock.set(12); G.state = 'play'; AQ.Scenes.restore(G, 'world', 4400, 400); await sleep(300);
    AQ.Delta.begin(AQ.Delta.byId('kelp')); await sleep(800); const a = playing();
    AQ.Scenes.restore(G, 'hill', 200, 100); await sleep(800); const b = playing();
    G.state = 'pause'; await sleep(700); const c = playing(), duck = AQ.Audio.duck; G.state = 'play';
    AQ.LogUI.open ? AQ.LogUI.open(G) : (G.state = 'log'); await sleep(500); const d = playing(), duck2 = AQ.Audio.duck; G.state = 'play'; await sleep(300);
    return { a, b, c, d, duck, duck2, bed: layer('ataraxia') };
  });
  check('a song keeps playing through a scene change, pause and the log', r.a === 'kelp' && r.b === 'kelp' && r.c === 'kelp' && r.d === 'kelp', `${r.a} > ${r.b} > ${r.c} > ${r.d}`);
  check('menus duck the music', r.duck < 1 && r.duck2 < 1, `pause x${r.duck}, log x${r.duck2}`);
  check('ATARAXIA is a thin bed under a song', r.bed < 0.2, `level ${r.bed.toFixed(2)}`);

  // ---- a hidden tab: the song freezes and goes on from the same place
  r = await ev(async () => {
    const before = AQ.Delta.position();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    await sleep(3000); const hidden = AQ.Delta.position();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'));
    await sleep(1000); return { before, hidden, after: AQ.Delta.position(), song: playing() };
  });
  check('a hidden tab freezes the song, which carries on when it returns', r.song === 'kelp' && Math.abs(r.hidden - r.before) < 0.3 && r.after > r.hidden, `${r.before.toFixed(1)} s > ${r.hidden.toFixed(1)} s hidden > ${r.after.toFixed(1)} s`);

  // ---- mute and volume
  r = await ev(async () => {
    const A = AQ.Audio, out = {};
    A.toggleMute(); await sleep(400); out.muted = A.master.gain.value; A.toggleMute(); await sleep(400); out.unmuted = A.master.gain.value;
    A.setVolume('music', 0); await sleep(1500); out.zero = A.musicBus.gain.value;
    A.setVolume('music', 1); await sleep(1500); out.max = A.musicBus.gain.value;
    A.setVolume('music', AQ.TUNING.audio.musicVolume); return out;
  });
  check('mute silences everything; unmute brings it back', r.muted < 0.01 && r.unmuted > 0.5, `${r.muted.toFixed(3)} / ${r.unmuted.toFixed(2)}`);
  check('MUSIC volume at 0 and at max', r.zero < 0.01 && r.max > 0.9, `${r.zero.toFixed(3)} / ${r.max.toFixed(2)}`);
  await ev(() => { endSong(); });
  await p.waitForTimeout(400);

  // ---- moments a song waits out
  r = await ev(async () => {
    const G = AQ.Game, D = AQ.Delta, out = {};
    G.state = 'play'; AQ.Scenes.restore(G, 'world', 4400, 400); D.setFrequency('often'); await sleep(300);
    let hold = true; const keep = () => { if (hold) { AQ.Hydro.k = 1; requestAnimationFrame(keep); } }; keep();
    D.wait = 0; await sleep(900); out.listen = playing(); hold = false; await sleep(700); out.afterListen = playing(); endSong(); await sleep(300);
    D.wait = 1e9; AQ.Aquarium.open(G, 'play', 'kelp'); AQ.Aquarium.photo.on = true; D.wait = 0; await sleep(700); out.photo = playing();
    AQ.Aquarium.photo.on = false; await sleep(600); out.afterPhoto = playing(); endSong(); await sleep(300);
    G.state = 'play'; AQ.Scenes.restore(G, 'world', 4400, 400);
    D.wait = 1e9; AQ.Audio.toggleMute(); D.wait = 0; await sleep(700); out.muted = playing(); AQ.Audio.toggleMute(); await sleep(600); out.afterMute = playing(); endSong(); await sleep(300);
    return out;
  });
  check('songs wait for LISTEN (hydrophone)', !r.listen && !!r.afterListen, `${r.listen} > ${r.afterListen}`);
  check('songs wait for photo mode', !r.photo && !!r.afterPhoto, `${r.photo} > ${r.afterPhoto}`);
  check('songs wait while muted', !r.muted && !!r.afterMute, `${r.muted} > ${r.afterMute}`);

  // ---- REDO TUTORIAL: the guided dive's first steps wait; with requests on, a request celebration during a song
  r = await ev(async () => {
    const G = AQ.Game, D = AQ.Delta, out = {};
    G.state = 'pause'; AQ.Redo.ask(G, 'pause'); await sleep(200);
    return out;
  });
  await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
  r = await ev(async () => {
    const D = AQ.Delta, out = { dive: AQ.Dive.active(), step: AQ.State.tutorial.dive && AQ.State.tutorial.dive.step };
    D.wait = 0; await sleep(800); out.during = playing();
    AQ.State.tutorial.dive.step = 5; await sleep(800); out.after = playing();
    AQ.Dive.stop ? AQ.Dive.stop() : (AQ.State.tutorial.dive.active = false); AQ.State.tutorial.dive = { active: false, step: 0, did: {} };
    AQ.State.quests = { asked: true, on: true, done: {}, skips: {} }; if (AQ.Quests.loaded) AQ.Quests.loaded();
    const q = AQ.Quests.current && AQ.Quests.current(); if (q) AQ.Quests.complete(q); await sleep(2500); out.questSong = playing();
    AQ.State.quests.on = false; endSong(); await sleep(300); return out;
  });
  check('REDO TUTORIAL: no song begins in the guided dive\'s first steps', r.dive && !r.during && !!r.after, `dive ${r.dive}, step ${r.step}: ${r.during} > ${r.after}`);
  check('a request celebration while a song plays', !!r.questSong, `song ${r.questSong}`);

  // ---- each frequency (time passing quickly): how long until the next song
  r = await ev(async () => {
    const G = AQ.Game, D = AQ.Delta, out = {};
    G.state = 'play'; AQ.Scenes.restore(G, 'world', 4400, 400); await sleep(200);
    for (const f of ['rarely', 'sometimes', 'often', 'always']) {
      const waits = [];
      for (let k = 0; k < 6; k++) {
        endSong(); D.update(0.01, G); D.setFrequency('off'); D.setFrequency(f);
        let t = 0; while (!D.playing() && t < 3600) { D.update(5, G); t += 5; }
        waits.push(t); endSong(); D.update(0.01, G);
      }
      out[f] = waits;
    }
    D.setFrequency('off'); endSong(); D.update(0.01, G); D.update(5, G); out.off = playing();
    // ALWAYS after a song ends: the next after the breathing gap
    D.setFrequency('always'); D.begin(D.byId('kelp')); endSong(); D.update(0.01, G); out.gap = Math.round(D.wait);
    D.setFrequency('off'); return out;
  });
  const range = (a) => `${Math.min(...a) / 60 | 0}-${Math.ceil(Math.max(...a) / 60)} min`;
  check('RARELY: about every 25 minutes', Math.min(...r.rarely) >= 18 * 60 && Math.max(...r.rarely) <= 32 * 60, range(r.rarely));
  check('SOMETIMES: about every 10 minutes', Math.min(...r.sometimes) >= 7 * 60 && Math.max(...r.sometimes) <= 13 * 60, range(r.sometimes));
  check('OFTEN: about every 4 minutes', Math.min(...r.often) >= 170 && Math.max(...r.often) <= 310, range(r.often));
  check('ALWAYS: about 20 seconds between songs', Math.max(...r.always) <= 25 && r.gap >= 15 && r.gap <= 25, `waits ${r.always.join(',')} s, gap after a song ${r.gap} s`);
  check('OFF: no song comes', !r.off);

  // ---- ATARAXIA on / off; both off = no music, effects still play
  r = await ev(async () => {
    const D = AQ.Delta, out = {};
    D.setAtaraxia(false); AQ.Music.layers(0.5); await sleep(1200); out.off = layer('ataraxia'); out.quiet = AQ.Ataraxia.quiet;
    const n0 = AQ.Music.stats().started; AQ.TUNING.ataraxia.noteEvery = [0.2, 0.4]; await sleep(1500); out.notesWhileOff = AQ.Music.stats().started - n0;
    AQ.Audio.play('menu_select', { important: true }); out.sfxBus = AQ.Audio.sfxBus.gain.value;
    D.setAtaraxia(true); AQ.Music.layers(0.5); await sleep(1200); out.on = layer('ataraxia'); AQ.TUNING.ataraxia.noteEvery = [7, 22];
    return out;
  });
  check('ATARAXIA OFF: silent, and no notes scheduled', r.off < 0.01 && r.quiet && r.notesWhileOff === 0, `level ${r.off.toFixed(3)}, ${r.notesWhileOff} notes`);
  check('ATARAXIA and DELTA both off: effects still play', r.sfxBus > 0.5, `effects bus ${r.sfxBus.toFixed(2)}`);
  check('ATARAXIA back on', r.on > 0.3, `level ${r.on.toFixed(2)}`);

  // ---- saves: the settings and the songs heard go into the save, a backup and a save code; old saves load
  r = await ev(async () => {
    const G = AQ.Game, SF = AQ.SaveFile, out = {};
    AQ.State.music = { heard: { kelp: 3, delta: 1 }, recent: ['kelp'] }; AQ.Delta.setFrequency('often'); AQ.Delta.setTitles(false);
    const text = SF.backupText(G, 'file', false), data = JSON.parse(text);
    out.backup = !!(data.state.music && data.state.music.heard.kelp === 3 && data.state.settings.music.delta === 'often' && data.state.settings.music.titles === false);
    const code = await SF.makeCode(text), back = JSON.parse(await SF.readCode(code));
    out.code = !!(back.state.music && back.state.music.heard.kelp === 3 && back.state.settings.music.delta === 'often');
    AQ.State.music = { heard: {}, recent: [] }; AQ.Save.apply(back, G); out.restored = AQ.State.music.heard.kelp === 3;
    const old = JSON.parse(text); delete old.state.music; delete old.state.settings.music; AQ.Save.apply(old, G);
    out.old = JSON.stringify(AQ.State.music) + ' / ' + AQ.Delta.frequency() + ' / titles ' + AQ.Delta.titlesOn() + ' / ataraxia ' + AQ.Delta.ataraxiaOn();
    AQ.Delta.setTitles(true); return out;
  });
  check('a backup keeps the music settings and the songs heard', r.backup);
  check('a save code keeps them too, and restoring brings them back', r.code && r.restored);
  check('an old save (from before the music) loads with the defaults', /"heard":\{\}/.test(r.old) && /sometimes/.test(r.old), r.old);

  // ---- a long session: lots of notes, songs started and stopped, place changes: nothing piles up
  r = await ev(async () => {
    const G = AQ.Game, D = AQ.Delta, C = AQ.TUNING.ataraxia, keep = JSON.stringify(C);
    G.state = 'play'; AQ.Scenes.restore(G, 'world', 300, 300); D.setFrequency('off'); endSong(); await sleep(6000);
    const base = AQ.Music.stats().nodesAlive;
    C.noteEvery = [0.05, 0.1]; C.noteSkip = 0; C.chordSeconds = [0.5, 1]; C.crossfadeSeconds = 1;
    const xs = [300, 1300, 2150, 3000, 4400, 5300, 6000]; let most = 0;
    for (let i = 0; i < 24; i++) {
      G.player.x = xs[i % xs.length]; G.player.y = 300 + (i % 3) * 300;
      if (i % 4 === 0) D.begin(D.all()[i % D.all().length]); if (i % 4 === 2) D.stop(0.3);
      await sleep(1500); most = Math.max(most, AQ.Music.stats().nodesAlive);
    }
    Object.assign(C, JSON.parse(keep)); D.stop(0.3); G.player.x = 300; G.player.y = 300; await sleep(14000);
    return { base, most, end: AQ.Music.stats().nodesAlive, notes: AQ.Music.stats().started };
  });
  check('a long, busy session: the audio nodes come back down', r.end <= r.base + 20, `${r.notes} notes; nodes ${r.base} at the start, at most ${r.most}, ${r.end} at the end`);

  // ---- the testing key: the next song now
  r = await ev(async () => { AQ.TUNING.debug.musicKeys = true; AQ.Game.state = 'play'; await sleep(100); return null; });
  await p.keyboard.press('Digit2'); await p.waitForTimeout(500);
  r = await ev(() => { const s = playing(); AQ.TUNING.debug.musicKeys = false; endSong(); return s; });
  check('the testing key (debug.musicKeys) starts the next song', !!r, r);
  await p.close();

  // ---- a phone-sized screen, by touch: the pause menu's MUSIC, a song, PAUSE, the settings' DELTA row
  const t = await open({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const tap = async (gx, gy) => { const b = await t.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); return [r.left, r.top, r.width / 320, r.height / 180]; }); await t.touchscreen.tap(b[0] + gx * b[2], b[1] + gy * b[3]); await t.waitForTimeout(350); };
  await t.evaluate(() => { AQ.State.music = { heard: { kelp: 1, cave: 1 }, recent: [] }; AQ.Delta.setFrequency('off'); const G = AQ.Game; G.state = 'play'; AQ.Dive.decline(); AQ.Scenes.restore(G, 'world', 300, 300); });
  await t.waitForTimeout(500);
  await t.evaluate(() => { AQ.Game.state = 'pause'; AQ.PauseUI.sel = 0; }); await t.waitForTimeout(300);
  let btn = await t.evaluate(() => AQ.PauseUI.ui.find((u) => u.id === 'music'));
  await tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  const st1 = await t.evaluate(() => AQ.Game.state);
  btn = await t.evaluate(() => AQ.Jukebox.ui.find((u) => u.id === 'song' && u.s.id === 'kelp'));
  if (btn) await tap(btn.x + 20, btn.y + btn.h / 2);
  await t.waitForTimeout(800);
  const s1 = await t.evaluate(() => playing());
  btn = await t.evaluate(() => AQ.Jukebox.ui.find((u) => u.id === 'toggle'));
  await tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  const paused = await t.evaluate(() => AQ.Delta.player.paused != null);
  btn = await t.evaluate(() => AQ.Jukebox.ui.find((u) => u.id === 'close')); await tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  await t.evaluate(() => { AQ.Jukebox.stop(); AQ.Game.state = 'pause'; AQ.PauseUI.panel = 'sound'; AQ.SoundUI.open(); AQ.SoundUI.tab = 'sound'; }); await t.waitForTimeout(400);
  btn = await t.evaluate(() => AQ.SoundUI.ui.find((u) => u.id === 'delta')); const f0 = await t.evaluate(() => AQ.Delta.frequency());
  await tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  const f1 = await t.evaluate(() => AQ.Delta.frequency());
  check('by touch on a phone-sized screen: MUSIC opens the jukebox, a tap plays a song, PAUSE pauses', st1 === 'jukebox' && s1 === 'kelp' && paused, `${st1}, ${s1}, paused ${paused}`);
  check('by touch: SETTINGS > SOUND > DELTA steps on', f0 !== f1, `${f0} > ${f1}`);
  await t.close();

  errors.forEach((e) => problems.push('live, browser: ' + e));
  console.log(`  ${pass} passed`);
  await browser.close();
};
