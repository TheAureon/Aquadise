#!/usr/bin/env node
// Checks the shader layer (src/gfx/) without playing the game:
//   1. every shader the game can build (each quality level x scene kind x pass, the light map, bloom,
//      the final pass): #if / #endif and brackets balance, loops have fixed bounds, every uniform the
//      code uses is declared, every uniform gfx.js sets exists, and how much uniform room each needs
//   2. every effect (src/gfx/effects.js) and which quality levels draw it; an effect that moves but has
//      no REDUCE FLASHING handling (or whose handling can't be found in the code) is flagged
//   3. the safety governor, simulated: slow at every level, slow whatever the level (a 30 Hz screen),
//      a chosen level, a recovering frame rate. It must only ever step down, one level at a time, stop
//      when stepping doesn't help, and never touch a level the player chose.
//
//   node tools/check-graphics.js             all of the above (no browser needed)
//   node tools/check-graphics.js --browser   also compiles and links every shader for real in a headless
//                                            browser (needs Playwright, like tools/check-game.js)
// Exits with 1 if anything is flagged.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const problems = [];
const flag = (msg) => { problems.push(msg); console.log('  !! ' + msg); };

// ---------------------------------------------------------------- load the shader layer in a sandbox
const ctx = { console, performance: { now: () => 0 } };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['src/config.js', 'src/gfx/effects.js', 'src/gfx/shaders.js', 'src/gfx/gl.js', 'src/gfx/gfx.js']) vm.runInContext(read(f), ctx, { filename: f });
const AQ = ctx.AQ, Sh = AQ.Shaders, C = AQ.TUNING.graphics, LEVELS = ['high', 'medium', 'low'];

// every program the game builds (mirrors AQ.Gfx.ensure)
const programs = [];
for (const lv of LEVELS) {
  const L = C.levels[lv], pass = L.fxScale ? 'scene' : 'all';
  for (const kind of L.scenes ? Sh.kinds : ['world']) programs.push({ name: `composite ${lv} ${kind}`, fs: Sh.composite(lv, pass, kind) });
  if (L.light) {
    const n = Sh.maxLights[lv];
    programs.push({ name: `light map ${lv} (tint)`, fs: Sh.lights(n, 0, false) });
    programs.push({ name: `light map ${lv} (glow)`, fs: Sh.lights(n, 1, false) });
    programs.push({ name: `light map ${lv} (glow + shadows)`, fs: Sh.lights(Math.max(1, n - (Sh.counts.ao / 2 + 1)), 1, true) });
  }
}
programs.push({ name: 'bloom bright pass', fs: Sh.bright }, { name: 'bloom blur', fs: Sh.blur }, { name: 'final pass', fs: Sh.final });

// a tiny preprocessor: keeps the lines the #if / #ifdef / #else / #endif select (enough for these shaders)
function preprocess(src) {
  const defs = new Map(), out = [], stack = [];
  let live = true, depth = 0, err = '';
  const val = (e) => {
    e = e.replace(/defined\(\s*(\w+)\s*\)/g, (m, n) => (defs.has(n) ? '1' : '0')).replace(/\b[A-Za-z_]\w*\b/g, (n) => (defs.has(n) ? String(defs.get(n) || 1) : '0'));
    try { return !!Function('return (' + e + ')')(); } catch (x) { err = 'cannot read #if ' + e; return false; }
  };
  for (const line of src.split('\n')) {
    const m = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!m) { if (live) out.push(line); continue; }
    const [, d, rest] = m;
    if (d === 'ifdef' || d === 'ifndef' || d === 'if') {
      depth++; stack.push({ live, taken: false });
      const on = d === 'ifdef' ? defs.has(rest.trim()) : d === 'ifndef' ? !defs.has(rest.trim()) : val(rest);
      stack[stack.length - 1].taken = on; live = live && on;
    } else if (d === 'else') {
      const top = stack[stack.length - 1]; if (!top) { err = '#else without #if'; continue; }
      live = top.live && !top.taken; top.taken = true;
    } else if (d === 'endif') {
      const top = stack.pop(); depth--; if (!top) { err = '#endif without #if'; continue; }
      live = top.live;
    } else if (d === 'define' && live) { const [n, ...v] = rest.split(/\s+/); defs.set(n, v.join(' ') || '1'); }
  }
  if (depth !== 0) err = err || `${depth} #if left open`;
  return { code: out.join('\n'), defs, err };
}
const SIZE = { float: 1, vec2: 1, vec3: 1, vec4: 1, int: 1, bool: 1, mat4: 4, sampler2D: 0 };

console.log('\n1. SHADERS (' + programs.length + ' programs)');
const declaredAnywhere = new Set();
for (const p of programs) {
  const pp = preprocess(p.fs), code = pp.code, issues = [];
  if (pp.err) issues.push(pp.err);
  const count = (re) => (code.match(re) || []).length;
  if (count(/\{/g) !== count(/\}/g)) issues.push('{ } do not balance');
  if (count(/\(/g) !== count(/\)/g)) issues.push('( ) do not balance');
  if (!/void main\(\)/.test(code)) issues.push('no main()');
  // fixed loop bounds (WebGL1 needs them)
  for (const m of code.matchAll(/for\s*\(\s*int\s+\w+\s*=\s*\d+\s*;\s*\w+\s*<\s*(\w+)\s*;/g)) if (!/^\d+$/.test(m[1]) && !pp.defs.has(m[1])) issues.push(`loop bound ${m[1]} is not fixed`);
  // uniforms: declared, used, room
  const decl = new Map();
  for (const m of code.matchAll(/uniform\s+(\w+)\s+(\w+)(?:\[(\w+)\])?\s*;/g)) {
    const n = m[3] ? (/^\d+$/.test(m[3]) ? +m[3] : +pp.defs.get(m[3])) : 1;
    if (decl.has(m[2])) issues.push(`uniform ${m[2]} declared twice`);
    decl.set(m[2], (SIZE[m[1]] == null ? 1 : SIZE[m[1]]) * n); declaredAnywhere.add(m[2]);
  }
  const body = code.replace(/uniform[^;]*;/g, '');
  for (const m of new Set(body.match(/\bu[A-Z]\w*/g) || [])) if (!decl.has(m)) issues.push(`uses ${m} but never declares it`);
  const room = [...decl.entries()].filter(([n]) => new RegExp('\\b' + n + '\\b').test(body)).reduce((a, [, v]) => a + v, 0);
  const tex = count(/texture2D\s*\(/g);
  p.room = room;
  console.log(`  ${p.name.padEnd(34)} uniform room ${String(room).padStart(3)} vectors, ${tex} texture reads` + (issues.length ? '' : '  ok'));
  if (room > 221) issues.push(`needs ${room} uniform vectors (many phones have 224 or fewer)`);
  issues.forEach((i) => flag(`${p.name}: ${i}`));
}
// every uniform gfx.js sets must exist in some shader
const gfxSrc = read('src/gfx/gfx.js');
const used = new Set([...gfxSrc.matchAll(/\b(?:u|fu|lu)\.(u[A-Z]\w*)/g)].map((m) => m[1]).concat([...gfxSrc.matchAll(/R\.(?:bright|blur)\.u\.(u[A-Z]\w*)/g)].map((m) => m[1])));
const missing = [...used].filter((n) => !declaredAnywhere.has(n));
if (missing.length) flag('gfx.js sets uniforms no shader has: ' + missing.join(', '));
else console.log(`  gfx.js sets ${used.size} uniforms; every one exists in a shader`);
const biggest = Math.max(...programs.filter((p) => p.name.startsWith('composite')).map((p) => p.room));
console.log(`  room: the biggest composite needs ${biggest} vectors (most phones have 64 or more; a chip with less shows CLASSIC).`);
console.log(`        The light map takes as many lights as the chip has room for (src/gfx/gfx.js): with 64, ${Math.min(Sh.maxLights.medium, Math.floor((64 - 8) / 2))} on MEDIUM.`);

// ---------------------------------------------------------------- 2. effects, levels, REDUCE FLASHING
console.log('\n2. EFFECTS (src/gfx/effects.js)');
const on = (fx, lv) => fx.level === 'all' || !!C.levels[lv][fx.level];
console.log('  ' + 'effect'.padEnd(10) + 'HIGH  MEDIUM LOW   moves  REDUCE FLASHING');
for (const [name, fx] of Object.entries(AQ.GfxEffects)) {
  const lv = LEVELS.map((l) => (on(fx, l) ? 'yes' : '-').padEnd(6)).join(' ');
  let calm = fx.moves ? fx.calm || '(none!)' : 'nothing moves';
  if (fx.moves) {
    if (!fx.calm || !fx.proof) flag(`${name} moves but has no REDUCE FLASHING handling`);
    else if (!fx.proof.test(read(fx.file))) { flag(`${name}: its REDUCE FLASHING handling (${fx.proof}) is no longer in ${fx.file}`); calm += ' (NOT FOUND)'; }
  }
  console.log('  ' + name.padEnd(10) + lv + (fx.moves ? 'yes' : 'no').padEnd(7) + calm);
}
const keys = Object.keys(AQ.GfxEffects);
if (JSON.stringify(AQ.Gfx.EFFECTS) !== JSON.stringify(keys)) flag('the testing keys do not cover exactly the listed effects');
console.log('  levels: ' + LEVELS.map((l) => `${l.toUpperCase()} = ${Object.entries(C.levels[l]).map(([k, v]) => `${k} ${v}`).join(', ')}`).join('\n          '));

// ---------------------------------------------------------------- 3. the governor, simulated
console.log('\n3. GOVERNOR (simulated; graphics.governor: below ' + C.governor.minFps + ' fps for ' + C.governor.seconds + ' s steps down)');
const X = AQ.Gfx, ORDER = ['high', 'medium', 'low', 'classic'];
function simulate(label, start, manual, fpsAt, seconds = 120) {
  const toasts = [];
  ctx.AQ.State = { settings: { graphics: { level: start, manual } } };
  ctx.AQ.Save = { dirty() {} }; ctx.AQ.HUD = { toast: (t) => toasts.push(t) }; ctx.AQ.t = (k) => k; ctx.AQ.U = { calm: () => false };
  X.ensure = () => true; X.sync = () => {}; X.lost = false; X.govLog.length = 0;
  Object.assign(X._gov, { slow: 0, settle: 0, before: 0, judging: false, stuck: false });
  X.apply();
  const seen = [start], game = { state: 'play' };
  for (let t = 0; t < seconds; t += 1 / 30) {
    const lv = X.saved().level, fps = fpsAt(lv, t);
    X.dt = 1000 / 30; X.fps = fps;                                  // (one tick = 1/30 s of play at that frame rate)
    X._governor(game);
    if (X.saved().level !== seen[seen.length - 1]) seen.push(X.saved().level);
  }
  // only ever down, one level at a time; never a chosen level; one message per step
  const idx = seen.map((l) => ORDER.indexOf(l));
  const down = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const ok = down && (!manual || seen.length === 1) && toasts.length === seen.length - 1;
  console.log(`  ${label.padEnd(46)} ${seen.join(' -> ')}${X._gov.stuck && seen.length > 1 ? '  (then stopped: stepping no longer helped or nothing lower)' : ''}  ${ok ? 'ok' : 'WRONG'}`);
  if (!ok) flag(`governor: ${label}: ${seen.join(' -> ')}, ${toasts.length} messages`);
  return seen;
}
simulate('slow at HIGH, fine from MEDIUM (auto)', 'high', false, (lv) => ({ high: 25, medium: 50, low: 58, classic: 60 })[lv]);
simulate('slow at HIGH and MEDIUM, fine at LOW (auto)', 'high', false, (lv) => ({ high: 15, medium: 28, low: 45, classic: 60 })[lv]);
simulate('very slow everywhere, each step helps (auto)', 'high', false, (lv) => ({ high: 8, medium: 12, low: 18, classic: 26 })[lv]);
simulate('30 fps whatever the level (a 30 Hz screen)', 'high', false, () => 30);
simulate('a level the player chose, very slow', 'high', true, () => 10);
simulate('slow, then the frame rate recovers', 'high', false, (lv, t) => (t < 20 ? 20 : 60));
simulate('fast all along', 'high', false, () => 60);

// ---------------------------------------------------------------- 4. (optional) compile for real
async function browserCompile() {
  console.log('\n4. REAL COMPILE (headless browser)');
  let pw = null;
  for (const t of [() => require('playwright'), () => require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'))]) { try { pw = t(); break; } catch (e) { /* next */ } }
  if (!pw) { console.log('  Playwright is not installed (npm install --no-save playwright && npx playwright install chromium): skipped'); return; }
  const browser = await pw.chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage();
  const res = await page.evaluate(({ vs, list }) => {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return { error: 'no WebGL in this browser' };
    const out = [];
    for (const p of list) {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return [s, gl.getShaderParameter(s, gl.COMPILE_STATUS) ? '' : gl.getShaderInfoLog(s)]; };
      const [v, ve] = sh(gl.VERTEX_SHADER, vs), [f, fe] = sh(gl.FRAGMENT_SHADER, p.fs);
      let le = '';
      if (!ve && !fe) { const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.bindAttribLocation(pr, 0, 'aPos'); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) le = gl.getProgramInfoLog(pr); }
      out.push({ name: p.name, err: ve || fe || le });
    }
    return { out, renderer: gl.getParameter(gl.RENDERER), room: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) };
  }, { vs: Sh.vertex, list: programs });
  await browser.close();
  if (res.error) { console.log('  ' + res.error + ': skipped'); return; }
  console.log(`  ${res.renderer}, ${res.room} uniform vectors`);
  for (const r of res.out) { if (r.err) flag(`${r.name} does not compile: ${r.err.trim()}`); }
  console.log(`  ${res.out.filter((r) => !r.err).length} of ${res.out.length} programs compile and link`);
}

(async () => {
  if (process.argv.includes('--browser')) await browserCompile();
  console.log(problems.length ? `\n${problems.length} problem(s) flagged.` : '\nNothing flagged.');
  process.exit(problems.length ? 1 : 0);
})();
