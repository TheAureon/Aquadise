#!/usr/bin/env node
// Checks the music (no sound needed: everything is measured from offline renders made with the game's own
// instruments and mixer, src/musicpreview.js). Runs in a headless browser, like tools/check-game.js.
//
//   node tools/check-music.js              the data, then every DELTA song and every ATARAXIA place (day + night)
//   node tools/check-music.js --quick      the data only (seconds, no renders)
//   node tools/check-music.js --song kelp  one song (and the data)
//   node tools/check-music.js --wav dir    also save every render as a WAV file into dir
//   node tools/check-music.js --live       also play the game for real: the music's rules in every situation
//                                          (scenes, pause, menus, photo mode, the hydrophone, a hidden tab, mute,
//                                          volume, each DELTA frequency, ATARAXIA on / off, touch on a phone-sized
//                                          screen, old saves, backups and save codes, the tutorial, requests,
//                                          and a long session's notes cleaning up)
//
// The data: every song reads correctly (bars add up, chords and notes exist and are in range, no empty
// section, a real form), held melody notes don't clash a semitone against their chord, every place has an
// ATARAXIA setting, every song's places exist.
// The renders, per song / place: length, peak (must be below -1 dB: no clipping), average loudness (songs
// within 4 dB of each other; ATARAXIA at least 3 dB below the songs), long silences inside a song, the
// spectrum (not too bassy: under 60% below 120 Hz; not shrill: under 10% above 5 kHz), and every note's
// nodes freed by the end. Exit code 1 if anything fails.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };

function loadPlaywright() {
  const tries = [() => require('playwright'), () => require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'))];
  for (const t of tries) { try { return t(); } catch (e) { /* next */ } }
  console.error('Playwright is not installed. Run:  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(p, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const problems = [], notes = [];
const fail = (s) => problems.push(s), note = (s) => notes.push(s);

// ---------------------------------------------------------------- the data (in the page)
function dataCheck() {
  const out = { errors: [], warnings: [], summary: [] }, D = AQ.Delta, M = AQ.data.music.ataraxia;
  const places = ['title', 'hill', 'station', 'aquarium'].concat(AQ.data.world.biomes.map((b) => b.id));
  places.forEach((p) => { if (!M[p]) out.errors.push(`place ${p}: no ATARAXIA setting (data/music.js)`); });
  for (const id in M) {
    const p = M[id];
    if (!p.chords || !p.chords.length || p.chords.some((c) => !Array.isArray(c) || c.length < 2)) out.errors.push(`ATARAXIA ${id}: chords missing or too small`);
    if (AQ.Instruments.colors.indexOf(p.color) < 0) out.errors.push(`ATARAXIA ${id}: unknown pad colour "${p.color}"`);
    (p.notes || []).forEach((n) => { if (AQ.Instruments.list.indexOf(n) < 0) out.errors.push(`ATARAXIA ${id}: unknown instrument "${n}"`); });
  }
  const ids = new Set();
  for (const s of AQ.data.songs) {
    if (ids.has(s.id)) out.errors.push(`song ${s.id}: the id is used twice`); ids.add(s.id);
    if (!AQ.Lang.has(`song.${s.id}`, 'en')) out.errors.push(`song ${s.id}: no name (song.${s.id} in data/lang/en.js)`);
    if (!s.form || !s.form.length) out.errors.push(`song ${s.id}: no form`);
    (s.places || []).forEach((p) => { if (places.indexOf(p) < 0) out.errors.push(`song ${s.id}: unknown place "${p}"`); });
    if (['day', 'night', 'any'].indexOf(s.time) < 0) out.errors.push(`song ${s.id}: time must be day, night or any`);
    s._compiled = null;
    const c = D.compile(s);
    c.errors.forEach((e) => out.errors.push(e));
    // empty sections, unknown instruments
    c.marks.forEach((m, i) => {                                    // each section (each time it comes) plays something
      const end = i + 1 < c.marks.length ? c.marks[i + 1].t : Infinity;
      if (!c.events.some((e) => e.t >= m.t - 1e-6 && e.t < end - 1e-6)) out.errors.push(`song ${s.id}: section ${m.name} plays nothing`);
    });
    [...new Set(c.events.map((e) => e.inst))].forEach((i) => { if (AQ.Instruments.list.indexOf(i) < 0) out.errors.push(`song ${s.id}: unknown instrument "${i}"`); });
    // held melody / counter notes a semitone above a chord tone (b9-type clashes): worth a listen
    const meter = s.meter || 4;
    const res = (n) => { const x = s.sections[n]; return x && x.like ? Object.assign({}, res(x.like), x) : x; };
    for (const name of new Set(s.form)) {
      const sec = res(name); if (!sec) continue;
      const chords = []; String(sec.chords || '').split('|').forEach((bar, bi) => { const tk = bar.trim().split(/\s+/).filter(Boolean); let pos = 0; tk.forEach((t) => { const [sym, l] = t.split(':'), len = l ? +l : meter / tk.length; chords.push({ b: bi * meter + pos, ch: D.chord(sym) }); pos += len; }); });
      for (const part of ['melody', 'counter']) String(sec[part] || '').split('|').forEach((bar, bi) => {
        let pos = 0; bar.trim().split(/\s+/).filter(Boolean).forEach((tk) => {
          const [p, l] = tk.split(':'), len = +l, b = bi * meter + pos; pos += len;
          if (p === 'r' || len < 1) return;
          const c2 = chords.filter((x) => x.b <= b + 1e-6).pop(); if (!c2 || !c2.ch) return;
          const pc = D.pitch(p) % 12;
          if (!c2.ch.pcs.includes(pc) && c2.ch.pcs.some((t) => (pc - t + 12) % 12 === 1)) out.warnings.push(`song ${s.id} ${name} ${part} bar ${bi + 1}: ${p} held over ${c2.ch.sym} clashes`);
        });
      });
    }
    out.summary.push(`${s.id} ${D.clock(c.seconds)} ${s.form.length} sections ${c.events.length} notes`);
  }
  return out;
}

// ---------------------------------------------------------------- renders (in the page)
async function renderOne(what) {
  const buf = await AQ.MusicPreview.render(what), a = AQ.MusicPreview.analyze(buf);
  a.stats = buf.stats;
  if (window.__wantWav) { const blob = AQ.MusicPreview.wav(buf), ab = await blob.arrayBuffer(); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); a.wav = btoa(s); a.name = AQ.MusicPreview.name(what); }
  return a;
}

(async () => {
  const pw = loadPlaywright(), server = await serve(), port = server.address().port;
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext()).newPage(), pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /\[songs\]|\[music\]/.test(m.text()))) pageErrors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.AQ && AQ.Game && AQ.Game.state === 'title', null, { timeout: 60000 });
  await page.keyboard.press('Shift'); await page.waitForTimeout(300);
  await page.evaluate(() => { AQ.State.settings = AQ.State.settings || {}; AQ.State.settings.audio = { music: AQ.TUNING.audio.musicVolume, sfx: AQ.TUNING.audio.sfxVolume, mute: false }; });   // renders at the default MUSIC volume

  // the data
  const d = await page.evaluate(dataCheck);
  console.log('MUSIC DATA');
  d.summary.forEach((s) => console.log('  ' + s));
  d.errors.forEach(fail); d.warnings.forEach((w) => note(w));
  console.log(d.errors.length ? `  ${d.errors.length} problem(s)` : '  every song reads correctly; every place has its ATARAXIA');

  if (!opt('--quick')) {
    const wavDir = opt('--wav'); if (wavDir) { fs.mkdirSync(wavDir, { recursive: true }); await page.evaluate(() => { window.__wantWav = true; }); }
    const only = opt('--song');
    const songs = await page.evaluate(() => AQ.Delta.all().map((s) => s.id));
    const places = only ? [] : await page.evaluate(() => Object.keys(AQ.data.music.ataraxia));
    const jobs = songs.filter((s) => !only || s === only).map((id) => ({ song: id })).concat(places.flatMap((p) => [{ place: p, seconds: 60 }, { place: p, night: true, seconds: 60 }]));
    const rows = [];
    console.log(`\nRENDERS (${jobs.length}; at the default MUSIC volume; a song whole, a place 60 s)`);
    console.log('  ' + 'what'.padEnd(26) + 'length  peak   avg    10%..90%       silence  <120/400/1.5k/5k/16k Hz %   notes  nodes left');
    for (const job of jobs) {
      const t0 = Date.now(), a = await page.evaluate(renderOne, job), label = job.song ? 'song ' + job.song : `ataraxia ${job.place}${job.night ? ' night' : ''}`;
      if (a.wav) { fs.writeFileSync(path.join(wavDir, a.name), Buffer.from(a.wav, 'base64')); delete a.wav; }
      rows.push(Object.assign({ job, label }, a));
      console.log('  ' + label.padEnd(26) + `${String(Math.floor(a.seconds / 60)) + ':' + String(Math.round(a.seconds % 60)).padStart(2, '0')}`.padEnd(8) + `${a.peakDb}`.padEnd(7) + `${a.rmsDb}`.padEnd(7) + `${a.quiet10}..${a.loud10}`.padEnd(15) + `${a.silenceInside}s`.padEnd(9) + a.bands.join('/').padEnd(27) + `${a.stats.notes}`.padEnd(7) + `${a.stats.nodesAtEnd}` + `   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
      if (a.peakDb > -1) fail(`${label}: peak ${a.peakDb} dB (clipping risk; must stay below -1 dB)`);
      if (a.bands[0] > 60) fail(`${label}: too bassy (${a.bands[0]}% below 120 Hz)`);
      if (a.bands[4] > 10) fail(`${label}: too shrill (${a.bands[4]}% above 5 kHz)`);
      if (job.song && a.silenceInside > 4) fail(`${label}: ${a.silenceInside} s of silence inside the song`);
      if (job.song && a.stats.nodesAtEnd !== 0) fail(`${label}: ${a.stats.nodesAtEnd} audio nodes still alive after it ended`);
      if (job.song && (a.seconds < 120 || a.seconds > 250) && !/^file:/.test(job.song)) note(`${label}: ${a.seconds} s long (songs are meant to be 2 to 4 minutes)`);
    }
    const songRows = rows.filter((r) => r.job.song && !/^file:/.test(r.job.song)), placeRows = rows.filter((r) => r.job.place);
    if (songRows.length > 1) {
      const lv = songRows.map((r) => r.rmsDb).sort((a, b) => a - b), med = lv[Math.floor(lv.length / 2)];
      songRows.forEach((r) => { if (Math.abs(r.rmsDb - med) > 4) fail(`${r.label}: average ${r.rmsDb} dB, more than 4 dB from the songs' middle (${med} dB)`); });
      console.log(`\n  songs' average loudness: ${lv[0]} .. ${lv[lv.length - 1]} dB (middle ${med})`);
      if (placeRows.length) {
        const al = placeRows.map((r) => r.rmsDb).sort((a, b) => a - b), amed = al[Math.floor(al.length / 2)];
        console.log(`  ATARAXIA's: ${al[0]} .. ${al[al.length - 1]} dB (middle ${amed}), ${(med - amed).toFixed(1)} dB below the songs`);
        placeRows.forEach((r) => { if (r.rmsDb > med - 3) fail(`${r.label}: ${r.rmsDb} dB, not quieter than the songs (should be at least 3 dB below ${med})`); });
      }
      songRows.forEach((r) => { const s = r.shape; if (s[0] > Math.max(...s.slice(3, 8))) note(`${r.label}: its intro is as loud as its middle (shape ${s.join(' ')})`); });
    }
  }

  if (opt('--live')) await require('./check-music-live.js')(pw, port, problems, notes);

  console.log('');
  pageErrors.forEach((e) => fail('browser: ' + e));
  if (notes.length) { console.log(`WORTH A LISTEN (${notes.length}):`); notes.forEach((n) => console.log('  ' + n)); }
  if (problems.length) { console.log(`PROBLEMS (${problems.length}):`); problems.forEach((p) => console.log('  ' + p)); }
  else console.log('Music checks passed.');
  await browser.close(); server.close();
  process.exit(problems.length ? 1 : 0);
})();
