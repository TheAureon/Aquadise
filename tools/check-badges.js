#!/usr/bin/env node
// Checks the badge data (data/achievements.js) against the rest of the game, without a browser:
//   node tools/check-badges.js
// It reports: duplicate ids, unknown groups / icons, unknown species / biomes / families / fields in
// `where`, unknown checks, events nobody sends and counters nobody counts (it reads the game's code for
// AQ.Badges.event('...') / add('...') / addTo('...') calls), tiers out of order, badges that can't be
// reached (a target higher than what exists), and missing names / descriptions in data/lang/en.js.
// Exit code 1 if anything is wrong.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/lang/en.js', 'data/world.js', 'data/creatures.js', 'data/achievements.js']) vm.runInContext(read(f), ctx, { filename: f });
const AQ = ctx.AQ, badges = AQ.data.badges, creatures = AQ.data.creatures, en = AQ.langFiles.en;
const biomes = new Set(AQ.data.world.biomes.map((b) => b.id).concat(['starfall']));
const species = new Set(creatures.map((c) => c.id));
const families = new Set(creatures.map((c) => c.family).filter(Boolean));
const fields = new Set(creatures.flatMap((c) => Object.keys(c)));

// what the code sends and counts
const src = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.js$/.test(f)).map((f) => read('src/' + f)).join('\n');
const events = new Set([...src.matchAll(/(?:Badges|\bB)\.event\('([a-zA-Z]+)'/g)].map((m) => m[1]));
const counters = new Set([...src.matchAll(/(?:Badges|\bB)\.(?:add|addTo)\('([a-zA-Z]+)'/g)].map((m) => m[1]));
const engine = read('src/achievements.js');
const checks = new Set([...engine.match(/const CHECKS = \{([\s\S]*?)\n  \};/)[1].matchAll(/^\s{4}(\w+): \{/gm)].map((m) => m[1]));
const GROUPS = new Set(AQ.data.badgeGroups);
const ICONS = new Set(['shell', 'fish', 'heart', 'egg', 'bottle', 'moon', 'star', 'camera', 'crown', 'ear', 'secret']);

const errors = [], warn = [];
const err = (b, msg) => errors.push(`${b.id || '?'}: ${msg}`);
const seen = new Set();
const match = (d, where) => Object.keys(where || {}).every((k) => (where[k] === true ? !!d[k] : where[k] === false ? !d[k] : d[k] === where[k]));
const sexed = (d) => !d.is_plant && d.sexes !== 'none';
// how much of a check exists at most (null = no fixed limit)
function available(cond) {
  switch (cond.check) {
    case 'discovered': return creatures.filter((d) => match(d, cond.where)).length;
    case 'caught': return creatures.filter((d) => !d.is_plant).length;
    case 'bothSexes': return creatures.filter(sexed).length;
    case 'variants': case 'bred': return creatures.filter((d) => !d.is_plant).length;
    case 'bestStars': return 5;
    case 'maxUpgrades': return 5;
    default: return null;
  }
}
function checkCond(b, cond, targets) {
  if (cond.counter) {
    if (!counters.has(cond.counter)) err(b, `counter '${cond.counter}' is never counted (no AQ.Badges.add / addTo('${cond.counter}') in src/)`);
    if (targets.includes('all') && cond.counter !== 'biomes') err(b, `counter '${cond.counter}' has no 'all'`);
  } else if (cond.check) {
    if (!checks.has(cond.check)) err(b, `unknown check '${cond.check}'`);
    const w = cond.where || {};
    for (const k in w) {
      if (!fields.has(k)) err(b, `where: no species has a '${k}' field`);
      if (k === 'biome' && !biomes.has(w[k])) err(b, `where: unknown biome '${w[k]}'`);
      if (k === 'id' && !species.has(w[k])) err(b, `where: unknown species '${w[k]}'`);
      if (k === 'family' && !families.has(w[k])) err(b, `where: unknown family '${w[k]}'`);
    }
    const max = available(cond);
    if (max === 0) err(b, `can't be reached: nothing matches`);
    for (const t of targets) if (max != null && typeof t === 'number' && t > max) err(b, `can't be reached: target ${t} but only ${max} exist`);
  } else err(b, 'cond needs counter, check or event');
}
for (const b of badges) {
  if (!b.id) { err(b, 'no id'); continue; }
  if (seen.has(b.id)) err(b, 'duplicate id'); seen.add(b.id);
  if (!GROUPS.has(b.group)) err(b, `unknown group '${b.group}'`);
  if (!ICONS.has(b.icon)) err(b, `unknown icon '${b.icon}'`);
  if (!('reward' in b)) err(b, 'missing the reserved reward field');
  const name = en[`badge.${b.id}.name`], desc = en[`badge.${b.id}.desc`];
  if (!name) err(b, `no name (badge.${b.id}.name)`); else if (name.length > 19) warn.push(`${b.id}: name is ${name.length} characters (about 18 fits)`);
  if (!desc) err(b, `no description (badge.${b.id}.desc)`); else if (desc.length > 80) warn.push(`${b.id}: description is ${desc.length} characters (two short lines is about 80)`);
  const c = b.cond || {};
  if (b.tiers && b.target != null) err(b, 'has both tiers and target');
  const targets = b.tiers ? b.tiers.map((t) => t.target) : [b.target];
  if (b.tiers) {
    if (!b.tiers.length) err(b, 'empty tiers');
    const nums = targets.filter((t) => typeof t === 'number');
    if (nums.some((t, i) => i && t <= nums[i - 1])) err(b, `tiers out of order (${targets.join(', ')})`);
    if (targets.indexOf('all') >= 0 && targets.indexOf('all') !== targets.length - 1) err(b, "'all' must be the last tier");
  }
  if (c.event) {
    if (!events.has(c.event)) err(b, `event '${c.event}' is never sent (no AQ.Badges.event('${c.event}') in src/)`);
    if (b.tiers) err(b, 'event badges have no tiers');
    if (c.also) checkCond(b, c.also, [c.also.target]);
  } else {
    if (!b.tiers && b.target == null) err(b, 'needs a target (or tiers)');
    checkCond(b, c, targets);
  }
}
console.log(`Badges: ${badges.length} (${badges.filter((b) => b.tiers).length} with tiers, ${badges.filter((b) => b.hidden).length} hidden).`);
console.log(`Events sent by the game: ${[...events].sort().join(', ')}`);
console.log(`Counters kept by the game: ${[...counters].sort().join(', ')}`);
if (warn.length) { console.log(`\nWarnings (${warn.length}):`); warn.forEach((w) => console.log('  ' + w)); }
if (errors.length) { console.log(`\nPROBLEMS (${errors.length}):`); errors.forEach((e) => console.log('  ' + e)); process.exit(1); }
console.log('\nEvery badge checks out.');
