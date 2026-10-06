#!/usr/bin/env node
// Headless check: opens the game in a browser (no window), visits the main screens and reports any
// console errors. Also used to check translations and to compare the text the game draws.
//
//   node tools/check-game.js                    every screen, in English (and PSEUDO, see below)
//   node tools/check-game.js --lang en          one language only (en, pseudo, or any data/lang file)
//   node tools/check-game.js --dump text.json   also save every piece of text drawn on each screen
//   node tools/check-game.js --compare a.json b.json   compare two dumps (no browser needed)
//   node tools/check-game.js --shots dir        also save a screenshot of each screen into dir
//   node tools/check-game.js --keys             also check the language keys (every t() key used in
//                                               the code exists in data/lang/en.js, and which keys
//                                               in en.js are never used); add --lang none to skip the browser
//
// Needs Playwright with its Chromium (a test tool only; the game itself has no dependencies):
//   npm install --no-save playwright && npx playwright install chromium
// If Playwright is installed globally that copy is used. The script serves the project folder itself.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };

// ---------------------------------------------------------------- compare two text dumps
if (opt('--compare')) {
  const i = args.indexOf('--compare'), a = JSON.parse(fs.readFileSync(args[i + 1], 'utf8')), b = JSON.parse(fs.readFileSync(args[i + 2], 'utf8'));
  let diffs = 0;
  for (const screen of new Set(Object.keys(a).concat(Object.keys(b)))) {
    const A = new Set(a[screen] || []), B = new Set(b[screen] || []);
    const gone = [...A].filter((s) => !B.has(s)), added = [...B].filter((s) => !A.has(s));
    if (!gone.length && !added.length) continue;
    diffs++;
    console.log(`\n${screen}`);
    gone.forEach((s) => console.log('  - ' + JSON.stringify(s)));
    added.forEach((s) => console.log('  + ' + JSON.stringify(s)));
  }
  console.log(diffs ? `\n${diffs} screen(s) differ.` : 'Same text on every screen.');
  process.exit(diffs ? 1 : 0);
}

// ---------------------------------------------------------------- the language key check (no browser needed)
function keyCheck() {
  const vm = require('vm'), ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/lang/en.js'), 'utf8'), ctx);
  const en = ctx.AQ.langFiles.en, keys = Object.keys(en).filter((k) => k !== '_meta');
  // every file that can look text up: the code, the data files and the page itself
  const files = [path.join(ROOT, 'index.html')];
  const walk = (dir) => fs.readdirSync(dir).forEach((f) => { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) { if (f !== 'lang') walk(p); } else if (/\.js$/.test(f)) files.push(p); });
  walk(path.join(ROOT, 'src')); walk(path.join(ROOT, 'data'));
  const used = new Set(), prefixes = new Set(), missing = [];
  const isKey = (k) => Object.prototype.hasOwnProperty.call(en, k);
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    for (const m of raw.matchAll(/LANG_PREFIX:\s*'([a-z0-9_.]+)'/gi)) prefixes.add(m[1]);   // (a marker comment: keys built from this prefix)
    // comments out (examples in comments don't count), then:
    const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, '');
    // 1) any quoted string that is a key counts as used (t('a'), t(x ? 'a' : 'b'), ['a', 'b'] lists, data-t="a")
    for (const m of src.matchAll(/['"]([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"]/g)) if (isKey(m[1])) used.add(m[1]);
    // 2) a literal key passed straight to t() / tEn() that English doesn't have
    for (const m of src.matchAll(/\b(?:t|tEn)\(\s*'([a-z][a-zA-Z0-9_.]*)'/g)) if (!isKey(m[1])) missing.push(`${path.relative(ROOT, f)}: ${m[1]}`);
    // 3) keys built in code from a prefix: `creature.${id}.name`, or marked LANG_PREFIX: 'sfx.'
    for (const m of src.matchAll(/`([a-z][a-zA-Z0-9_]*\.(?:[a-zA-Z0-9_]+\.)*)\$\{/g)) prefixes.add(m[1]);
  }
  const unused = keys.filter((k) => !used.has(k) && ![...prefixes].some((p) => k.startsWith(p)));
  console.log(`\nLanguage keys: ${keys.length} in en.js (${used.size} used by name, the rest through ${prefixes.size} key prefixes built in code).`);
  if (missing.length) { console.log(`MISSING from en.js (${missing.length}):`); missing.forEach((m) => console.log('  ' + m)); }
  else console.log('Every key used in the code exists in en.js.');
  if (unused.length) { console.log(`Not used anywhere (${unused.length}):`); unused.forEach((k) => console.log('  ' + k)); }
  else console.log('Every key in en.js is used.');
  return missing.length;
}

// ---------------------------------------------------------------- find Playwright
function loadPlaywright() {
  const tries = [() => require('playwright'), () => require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'))];
  for (const t of tries) { try { return t(); } catch (e) { /* next */ } }
  console.error('Playwright is not installed. Run:  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

// ---------------------------------------------------------------- a tiny static server for the project folder
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---------------------------------------------------------------- the screens
// Each screen: a function run in the page that puts the game there (the game's own functions).
const SAVE = () => {
  const now = Date.now(), M = 60000;
  return { game: 'aquadise', v: 3, savedAt: '2026-10-01T10:00:00.000Z', scene: 'world', player: { x: 300, y: 80 }, state: {
    collection: { bladefin_perch: 3, kelp_otter: 2, drift_snail: 1, coral_viper: 2, comet_ray: 1 }, plants: {}, upgrades: { net: 2, speed: 1, lantern: 1, depth: 0 }, unlocks: {}, tankBest: { kelp: 3 }, settings: { hints: false },
    log: { bladefin_perch: { m: true, f: true, bred: true, graduated: 1 }, kelp_otter: { m: true, f: true }, drift_snail: { f: true }, coral_viper: { m: true }, comet_ray: { m: true } }, flags: { visitedStation: true }, bottles: { drift_snail: true }, clock: { hour: 12 }, starfall: { night: 1, landings: [] }, tutorial: { seen: {}, diveAsked: true },
    tanks: {
      kelp: { creatures: [{ uid: 'a1', id: 'bladefin_perch', sex: 'm' }, { uid: 'a2', id: 'bladefin_perch', sex: 'f' }, { uid: 'a3', id: 'kelp_otter', sex: 'f' }], storage: [{ uid: 's1', id: 'kelp_otter', sex: 'm' }], decor: [{ uid: 'd1', type: 'decor', id: 'boulder', x: 120, y: 140 }], lastFed: now },
      pred_reef: { creatures: [{ uid: 'p1', id: 'coral_viper', sex: 'm' }], storage: [], decor: [] },
      nursery: { creatures: [{ uid: 'b1', id: 'bladefin_perch', sex: 'f', bornAt: now - 2 * M, from: 'kelp' }, { uid: 'b2', id: 'kelp_otter', sex: 'm', bornAt: now - 999 * M, from: 'kelp', variant: true }], storage: [], decor: [], eggs: [{ uid: 'e1', id: 'bladefin_perch', laidAt: now, x: 120, from: 'kelp' }] } } } };
};
const SCREENS = [
  ['title', () => { AQ.Title.open(AQ.Game); }],
  ['title-controls', () => { AQ.Title.open(AQ.Game); AQ.Title.panel = 'controls'; }],
  ['settings-sound', () => { AQ.Title.open(AQ.Game); AQ.Title.panel = 'sound'; AQ.SoundUI.open(); AQ.SoundUI.tab = 'sound'; }],
  ['settings-options', () => { AQ.SoundUI.tab = 'options'; }],
  ['settings-touch', () => { AQ.SoundUI.tab = 'touch'; }],
  ['sound-test-effects', () => { AQ.Title.panel = null; AQ.SoundTest.open(AQ.Game, 'title'); }],
  ['sound-test-ambience', () => { AQ.SoundTest.tab = 1; }],
  ['sound-test-music', () => { AQ.SoundTest.tab = 2; }],
  ['sea', () => { const G = AQ.Game; G.state = 'play'; AQ.Scenes.restore(G, 'world', 300, 80); AQ.HUD.showHelp = true; AQ.HUD.helpT = 10; AQ.HUD.bannerT = 0; AQ.HUD.toast('A toast for the check.', '#fff'); }],
  ['sea-deep', () => { const G = AQ.Game; AQ.Scenes.restore(G, 'world', 1400, 700); AQ.HUD.bannerT = 0; }],
  ['map', () => { AQ.Game.state = 'map'; }],
  ['pause', () => { AQ.Game.state = 'pause'; AQ.PauseUI.panel = null; }],
  ['guided-dive-prompt', () => { const G = AQ.Game; G.state = 'play'; AQ.State.tutorial.diveAsked = false; AQ.Dive.offer(); }],
  ['guided-dive', () => { AQ.Dive.start(AQ.Game); }],
  ['tip', () => { AQ.Dive.stop && AQ.Dive.stop(); AQ.Tips.setHints(true); AQ.Tips.reset(); AQ.Tips.event('noticed'); AQ.Tips.gap = 0; }],
  ['hill', () => { const G = AQ.Game; AQ.Tips.setHints(false); G.state = 'play'; AQ.Scenes.restore(G, 'hill', 200, 60); }],
  ['station', () => { const G = AQ.Game; G.state = 'play'; AQ.Scenes.restore(G, 'station', 380, 228); }],
  ['station-ground', () => { const G = AQ.Game; AQ.Scenes.restore(G, 'station', 500, 398); }],
  ['station-whole', () => { if (!AQ.Station.zoomedOut()) AQ.Station.toggleZoom(); }],
  ['directory', () => { if (AQ.Station.zoomedOut()) AQ.Station.toggleZoom(); AQ.Aquarium.open(AQ.Game, 'station', 'kelp'); AQ.Aquarium.openOverview(); }],
  ['TANKS', null],                                       // every tank screen (expanded below)
  ['tank-card', () => { const A = AQ.Aquarium; A.open(AQ.Game, 'station', 'kelp'); A.card = A.fish[0] && A.fish[0].uid; }],
  ['tank-fish-tray', () => { const A = AQ.Aquarium; A.card = null; A.tray = 'fish'; }],
  ['tank-tab', () => { const A = AQ.Aquarium; A.card = null; A.tray = 'tank'; }],
  ['tank-expand', () => { AQ.State.panes = 100; AQ.Aquarium.startExpand(); }],
  ['tank-wide', () => { const A = AQ.Aquarium; A.dialog = null; AQ.Collection.tank('kelp').size = 2; A.rebuild(); A.scrollTo(150); A.tray = 'decor'; }],
  ['tank-select', () => { const A = AQ.Aquarium; A.dialog = null; const t = AQ.Collection.tank('kelp'); if (!t.storage.length) t.storage.push({ uid: 'chk1', id: 'ribbonmane', sex: 'm' }, { uid: 'chk2', id: 'ribbonmane', sex: 'f', variant: true }); A.rebuild(); A.select = new Set(['chk1']); A.tray = 'fish'; }],
  ['tank-release', () => { const A = AQ.Aquarium; A.select = null; A.tray = 'tank'; A.releaseExtras(); }],
  ['nursery-card', () => { const A = AQ.Aquarium; A.open(AQ.Game, 'station', 'nursery'); A.tray = 'fish'; A.card = A.fish[0] && A.fish[0].uid; }],
  ['photo-mode', () => { const A = AQ.Aquarium; A.open(AQ.Game, 'station', 'kelp'); A.card = null; AQ.Input.vPress(AQ.TUNING.photo.key); }],
  ['log-species', () => { AQ.Input.vRelease(AQ.TUNING.photo.key); AQ.Aquarium.photo.on = false; AQ.LogUI.open(AQ.Game, 'title'); AQ.LogUI.tab = 'species'; }],
  ['log-entry', () => { AQ.LogUI.entry = AQ.data.creatures.find((d) => d.id === 'bladefin_perch'); }],
  ['log-variants', () => { AQ.LogUI.entry = null; AQ.LogUI.tab = 'variants'; }],
  ['log-notes', () => { AQ.LogUI.tab = 'notes'; }],
  ['GUIDE', null],                                       // every guide page (expanded below)
  ['touch-controls', () => { const G = AQ.Game; AQ.State.settings.touchControls = 'on'; AQ.Touch.refresh(); G.state = 'play'; AQ.Scenes.restore(G, 'world', 300, 80); }],
  ['touch-menu', () => { AQ.Touch.menuOpen = true; }],
  ['save-panel', () => { AQ.Touch.menuOpen = false; AQ.State.settings.touchControls = 'off'; AQ.Touch.refresh(); AQ.Title.open(AQ.Game); AQ.SaveFile.openRecover(); }]
];

async function run(lang, pw, port, dump, shotsDir) {
  const browser = await pw.chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const problems = [];
  let where = 'loading';
  page.on('pageerror', (e) => problems.push(`[${where}] page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${where}] console ${m.type()}: ${m.text()}`); });
  // the same random numbers every run, so two runs draw the same things
  await page.addInitScript(() => { let s = 12345; Math.random = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  const url = `http://127.0.0.1:${port}/index.html`;
  await page.goto(url);
  await page.waitForFunction(() => window.AQ && AQ.Game && AQ.Game.state === 'title', null, { timeout: 60000 });
  await page.evaluate((s) => { AQ.Save.save = () => {}; localStorage.clear(); localStorage.setItem(AQ.TUNING.save.key, JSON.stringify(s)); }, SAVE());
  await page.reload();
  await page.waitForFunction(() => window.AQ && AQ.Game && AQ.Game.state === 'title', null, { timeout: 60000 });
  await page.evaluate((lang) => {
    AQ.Save.save = () => {};
    if (lang === 'pseudo') AQ.TUNING.debug.pseudoLanguage = true;
    if (AQ.Lang && lang) AQ.Lang.set(lang);
    // record every piece of text the pixel font draws
    const F = AQ.Font, orig = F.draw;
    window.__rec = null;
    window.__all = window.__all || new Set();          // everything drawn, including text painted once into cached pictures
    F.draw = function (ctx, str) { if (window.__rec) window.__rec.add(String(str)); window.__all.add(String(str)); return orig.apply(this, arguments); };
  }, lang);
  const screens = [];
  for (const [name, fn] of SCREENS) {
    if (name === 'TANKS') { (await page.evaluate(() => AQ.Tanks.list().map((t) => t.id))).forEach((id) => screens.push(['tank-' + id, `() => { const A = AQ.Aquarium; A.open(AQ.Game, 'station', '${id}'); A.tray = 'decor'; A.card = null; }`])); continue; }
    if (name === 'GUIDE') { const n = await page.evaluate(() => { AQ.Guide.open(AQ.Game, 'title'); return AQ.Guide.pages().length; }); for (let i = 0; i < n; i++) screens.push(['guide-' + (i + 1), `() => { if (AQ.Game.state !== 'guide') AQ.Guide.open(AQ.Game, 'title'); AQ.Guide.page = ${i}; }`]); continue; }
    screens.push([name, fn.toString()]);
  }
  const out = {};
  for (const [name, src] of screens) {
    where = name;
    try {
      await page.evaluate(`(${src})()`);
      await page.waitForTimeout(name === 'station-whole' ? 1200 : 450);   // (the whole-building view zooms out first)
      if (name.startsWith('tank-') || name === 'directory') await page.mouse.move(400, 15);   // over the stars: the vibe tooltip
      await page.evaluate(() => { window.__rec = new Set(); });
      await page.waitForTimeout(350);
      out[name] = await page.evaluate(() => { const r = [...window.__rec].sort(); window.__rec = null;
        const dom = [document.title, (document.getElementById('loading-text') || {}).textContent, (document.getElementById('rotate') || {}).textContent].filter(Boolean);
        return r.concat(dom.map((d) => 'DOM: ' + d.replace(/\s+/g, ' ').trim())); });
      if (shotsDir) { fs.mkdirSync(shotsDir, { recursive: true }); await page.screenshot({ path: path.join(shotsDir, `${lang}-${name}.png`) }); }
    } catch (e) { problems.push(`[${name}] check script could not reach this screen: ${e.message.split('\n')[0]}`); }
  }
  out['(all text drawn)'] = await page.evaluate(() => [...(window.__all || [])].sort());
  const missingGlyphs = await page.evaluate(() => [...(AQ.Font.unknown || [])]);
  if (missingGlyphs.length) problems.push(`characters with no glyph in the font (drawn as boxes): ${missingGlyphs.map((c) => JSON.stringify(c)).join(' ')}`);
  await browser.close();
  console.log(`\n[${lang}] visited ${screens.length} screens, ${problems.length ? problems.length + ' problem(s):' : 'no console errors.'}`);
  problems.forEach((p) => console.log('  ' + p));
  return { problems: problems.length, text: out };
}

(async () => {
  let failures = 0;
  if (opt('--keys')) failures += keyCheck();
  const want = opt('--lang');
  if (want === 'none') process.exit(failures ? 1 : 0);              // --keys --lang none: just the key check
  const pw = loadPlaywright(), server = await serve(), port = server.address().port;
  const langs = want && want !== true ? [want] : ['en', 'pseudo'];
  const dump = opt('--dump'), shots = opt('--shots'), all = {};
  for (const lang of langs) {
    const r = await run(lang, pw, port, dump, shots && shots !== true ? shots : null);
    failures += r.problems;
    Object.entries(r.text).forEach(([k, v]) => { all[langs.length > 1 ? `${lang}:${k}` : k] = v; });
  }
  if (dump && dump !== true) { fs.writeFileSync(dump, JSON.stringify(all, null, 1)); console.log(`\nText drawn on each screen saved to ${dump}`); }
  server.close();
  process.exit(failures ? 1 : 0);
})();
