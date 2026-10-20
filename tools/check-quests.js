#!/usr/bin/env node
// Checks the station requests (data/quests.js) against the rest of the game, without a browser:
//   node tools/check-quests.js
// It reports: duplicate ids, unknown chapters / icons / tanks, missing words in data/lang/en.js, unknown
// species / biomes / families / fields in `where`, unknown checks, badges and flags, events nobody sends,
// `match` fields the event never carries, counters nobody counts, prerequisites that point nowhere or loop,
// requests that can't be reached (a target higher than what exists, or a chain that leads to one), and
// requests that depend on luck (rare variants, meteor showers, Comet Ray-only species, a specific chest
// reward...). Requests whose feature isn't in this build (`needs`) are listed as skipped.
// Exit code 1 if anything is wrong.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['data/lang/en.js', 'data/world.js', 'data/creatures.js', 'data/achievements.js', 'data/aquarium.js', 'data/quests.js']) vm.runInContext(read(f), ctx, { filename: f });
const AQ = ctx.AQ, quests = AQ.data.quests, chapters = AQ.data.questChapters, creatures = AQ.data.creatures, en = AQ.langFiles.en;
const biomes = new Set(AQ.data.world.biomes.map((b) => b.id).concat(['starfall']));
const species = new Map(creatures.map((c) => [c.id, c]));
const families = new Set(creatures.map((c) => c.family).filter(Boolean));
const fields = new Set(creatures.flatMap((c) => Object.keys(c)));
const badges = new Map(AQ.data.badges.map((b) => [b.id, b]));
const tanks = new Set(Object.keys(AQ.data.tankStyles).filter((k) => k !== 'default'));

// what the game's code actually does
const srcFiles = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.js$/.test(f));
const src = srcFiles.map((f) => read('src/' + f)).join('\n');
const events = new Set([...src.matchAll(/(?:Badges|\bB)\.event\('([a-zA-Z]+)'/g)].map((m) => m[1]));
const eventFields = {};                                              // the fields each event carries
for (const m of src.matchAll(/(?:Badges|\bB)\.event\('([a-zA-Z]+)',\s*\{([\s\S]*?)\}\s*\)/g)) (eventFields[m[1]] = eventFields[m[1]] || new Set()) && [...m[2].matchAll(/(\w+)\s*[:,}]/g)].forEach((f) => eventFields[m[1]].add(f[1]));
const counters = new Set([...src.matchAll(/(?:Badges|\bB)\.(?:add|addTo)\('([a-zA-Z]+)'/g)].map((m) => m[1]));
const checks = new Set([...read('src/achievements.js').match(/const CHECKS = \{([\s\S]*?)\n  \};/)[1].matchAll(/^\s{4}(\w+): \{/gm)].map((m) => m[1]));
const modules = new Set([...src.matchAll(/^AQ\.([A-Z]\w*) = /gm)].map((m) => m[1]));
const flags = new Set([...src.matchAll(/flags\.(\w+)\s*=/g)].map((m) => m[1]));
const upgrades = new Set(['net', 'speed', 'lantern', 'depth', 'hydro']);
const ICONS = new Set(['shell', 'fish', 'heart', 'egg', 'bottle', 'moon', 'star', 'camera', 'crown', 'ear']);

const errors = [], luck = [], skipped = [];
const err = (q, msg) => errors.push(`${q.id || '?'}: ${msg}`);
const match = (d, where) => Object.keys(where || {}).every((k) => (where[k] === true ? !!d[k] : where[k] === false ? !d[k] : d[k] === where[k]));
const sexed = (d) => !d.is_plant && d.sexes !== 'none';
// species you can only get by luck: meteor-shower-only ones (Comet Ray)
const luckySpecies = new Set(creatures.filter((d) => d.event === 'shower').map((d) => d.id));
// how much of a check exists at most (null = no fixed limit)
function most(cond) {
  switch (cond.check) {
    case 'discovered': return creatures.filter((d) => match(d, cond.where)).length;
    case 'caught': return creatures.filter((d) => !d.is_plant).length;
    case 'bothSexes': return creatures.filter(sexed).length;
    case 'bestStars': return 5;
    case 'biomesComplete': return AQ.data.world.biomes.length;
    case 'predatorTanksComplete': return AQ.data.predatorTanks.length;
    case 'tanksWith': case 'expanded': return tanks.size;
    case 'badge': case 'flag': case 'fedAny': return 1;
    case 'upgrade': return 3;
    default: return null;
  }
}
// does a condition depend on luck? (and why)
function lucky(cond) {
  if (!cond) return null;
  if (cond.check === 'variants') return 'rare colour variants';
  if (cond.event === 'shower' || cond.counter === 'showers') return 'a meteor shower';
  if (cond.match && (cond.match.lureStruck || cond.match.rare)) return 'a chance moment';
  const w = cond.where || {};
  if (w.id && luckySpecies.has(w.id)) return `${w.id} (meteor showers only)`;
  if (w.event === 'shower' || w.variant) return 'meteor showers / rare variants';
  if (cond.check === 'discovered' && cond.where) { const m = creatures.filter((d) => match(d, w)); if (m.length && m.every((d) => luckySpecies.has(d.id))) return 'only meteor-shower species match'; }
  if (cond.reward || cond.chest) return 'a specific chest reward';
  if (cond.check === 'badge') { const b = badges.get(cond.badge); if (b) return lucky(b.cond) || (b.cond && lucky(b.cond.also)); }
  return null;
}
function checkCond(q, cond, target, label) {
  if (!cond || typeof cond !== 'object') return err(q, `${label}: no condition`);
  if (cond.event) {
    if (!events.has(cond.event)) err(q, `${label}: event '${cond.event}' is never sent (no AQ.Badges.event('${cond.event}') in src/)`);
    for (const k in cond.match || {}) if (!(eventFields[cond.event] || new Set()).has(k)) err(q, `${label}: event '${cond.event}' never carries '${k}'`);
    if (!cond.also) err(q, `${label}: an event request needs \`also\` (so a save that already did it, or a request offered later, sees it)`);
    else checkCond(q, cond.also, cond.also.target, `${label} also`);
    return;
  }
  if (cond.counter) { if (!counters.has(cond.counter)) err(q, `${label}: counter '${cond.counter}' is never counted (no AQ.Badges.add / addTo('${cond.counter}') in src/)`); }
  else if (cond.check) {
    if (!checks.has(cond.check)) err(q, `${label}: unknown check '${cond.check}'`);
    if (cond.check === 'badge' && !badges.has(cond.badge)) err(q, `${label}: unknown badge '${cond.badge}'`);
    if (cond.check === 'flag' && !flags.has(cond.flag)) err(q, `${label}: the game never sets flag '${cond.flag}'`);
    if (cond.check === 'upgrade' && !upgrades.has(cond.upgrade)) err(q, `${label}: unknown upgrade '${cond.upgrade}'`);
    const w = cond.where || {};
    for (const k in w) {
      if (!fields.has(k)) err(q, `${label}: where: no species has a '${k}' field`);
      if (k === 'biome' && !biomes.has(w[k])) err(q, `${label}: where: unknown biome '${w[k]}'`);
      if (k === 'id' && !species.has(w[k])) err(q, `${label}: where: unknown species '${w[k]}'`);
      if (k === 'family' && !families.has(w[k])) err(q, `${label}: where: unknown family '${w[k]}'`);
    }
    const max = most(cond);
    if (max === 0) err(q, `${label}: can't be reached: nothing matches`);
    else if (max != null && typeof target === 'number' && target > max) err(q, `${label}: can't be reached: target ${target} but only ${max} exist`);
  } else err(q, `${label}: needs a counter, check or event`);
  if (cond.also) checkCond(q, cond.also, cond.also.target, `${label} also`);
}

// ---------------------------------------------------------------- each request
const ids = new Set();
for (const q of quests) {
  if (!q.id) { err(q, 'no id'); continue; }
  if (ids.has(q.id)) err(q, 'duplicate id'); ids.add(q.id);
  if (chapters.indexOf(q.chapter) < 0) err(q, `unknown chapter '${q.chapter}'`);
  if (!ICONS.has(q.icon)) err(q, `unknown icon '${q.icon}'`);
  for (const k of [`quest.${q.id}`, `quest.${q.id}.intro`, `quest.${q.id}.thanks`]) if (!en[k]) err(q, `no text (${k} in data/lang/en.js)`);
  if (q.tank !== undefined && q.tank !== true && !tanks.has(q.tank)) err(q, `unknown tank '${q.tank}'`);
  if (q.needs && !modules.has(q.needs)) skipped.push(`${q.id} (needs ${q.needs}, not in this build)`);
  checkCond(q, q.cond, q.target, 'cond');
  if (q.requires) checkCond(q, q.requires, q.requires.target, 'requires');
  const why = lucky(q.cond) || lucky(q.cond.also);
  if (why) luck.push(`${q.id}: depends on luck (${why})`);
  if ('reward' in q || 'rewards' in q || 'give' in q) err(q, 'requests never give anything (remove the reward)');
}
for (const ch of chapters) {
  if (!en[`quest.chapter.${ch}`]) errors.push(`chapter ${ch}: no name (quest.chapter.${ch})`);
  if (!quests.some((q) => q.chapter === ch)) errors.push(`chapter ${ch}: has no requests`);
}
// prerequisites: unknown, looping, or leading to something that can't be done
const byId = new Map(quests.map((q) => [q.id, q]));
for (const q of quests) if (q.after && !byId.has(q.after)) err(q, `after: unknown request '${q.after}'`);
for (const q of quests) {
  const seen = new Set([q.id]);
  for (let p = byId.get(q.after); p; p = byId.get(p.after)) {
    if (seen.has(p.id)) { err(q, `prerequisites loop (${[...seen, p.id].join(' -> ')})`); break; }
    seen.add(p.id);
    if (errors.some((e) => e.startsWith(p.id + ': ') && /can't be reached/.test(e))) err(q, `can't be reached: it comes after '${p.id}', which can't be reached`);
  }
}

console.log(`Requests: ${quests.length} in ${chapters.length} chapters (${chapters.map((c) => `${c} ${quests.filter((q) => q.chapter === c).length}`).join(', ')}).`);
console.log(`Kinds: ${quests.filter((q) => q.cond.counter).length} counters, ${quests.filter((q) => q.cond.check).length} checks, ${quests.filter((q) => q.cond.event).length} moments; ${quests.filter((q) => q.after).length} wait for another request, ${quests.filter((q) => q.tank).length} are about a tank.`);
if (skipped.length) { console.log(`\nSkipped in this build (${skipped.length}):`); skipped.forEach((s) => console.log('  ' + s)); }
if (luck.length) { console.log(`\nLUCK (${luck.length}) - every request must be possible without luck:`); luck.forEach((l) => console.log('  ' + l)); }
if (errors.length) { console.log(`\nPROBLEMS (${errors.length}):`); errors.forEach((e) => console.log('  ' + e)); }
if (errors.length || luck.length) process.exit(1);
console.log('\nEvery request checks out: reachable, without luck, and nothing is given.');
