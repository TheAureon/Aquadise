// Shared helpers for the language tools (tools/lang-check.js, tools/lang-csv.js). No dependencies.
//   readLang(code)   the strings of data/lang/<code>.js ({ _meta, key: value... })
//   readEnLayout()   English keys in file order, with their group (area) and note (the comment after them)
//   writeLang(code, meta, strings)   writes data/lang/<code>.js in the same order and groups as English
//   placeholders(s)  the {placeholders} in a text, sorted
//   pluralForms(locale)  the plural forms a language needs (Unicode categories: one, other, few...)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LANG_DIR = path.join(ROOT, 'data', 'lang');
const file = (code) => path.join(LANG_DIR, `${code}.js`);

function readLang(code) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file(code), 'utf8'), ctx, { filename: file(code) });
  const out = ctx.AQ && ctx.AQ.langFiles && ctx.AQ.langFiles[code];
  if (!out) throw new Error(`data/lang/${code}.js doesn't register AQ.langFiles.${code}`);
  return JSON.parse(JSON.stringify(out));
}
// English, line by line: '// ---- <group>' headers, then 'key': value,   // note
function readEnLayout() {
  const lines = fs.readFileSync(file('en'), 'utf8').split('\n'), out = [];
  let group = '';
  for (const ln of lines) {
    const g = ln.match(/^\s*\/\/ -{8,} (.*)$/);
    if (g) { group = g[1].trim(); continue; }
    const k = ln.match(/^\s*'([^']+)':/);
    if (!k || k[1] === '_meta') continue;
    const note = ln.match(/\/\/\s*(.*)$/), inString = note && ln.lastIndexOf("'") > ln.indexOf('//');
    out.push({ key: k[1], group, note: note && !inString ? note[1].trim() : '' });
  }
  return out;
}
const placeholders = (s) => (String(s).match(/\{[^}]+\}/g) || []).sort();
function pluralForms(locale) {
  try { return new Intl.PluralRules(locale).resolvedOptions().pluralCategories; } catch (e) { return ['one', 'other']; }
}
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const val = (v) => (v && typeof v === 'object' ? '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${q(x)}`).join(', ') + ' }' : q(v));
function writeLang(code, meta, strings) {
  const layout = readEnLayout(), lines = [];
  lines.push(`// ${String(meta.name || code).toUpperCase()}: a translation of data/lang/en.js (see docs/TRANSLATING.md).`);
  lines.push('// Translate the text on the right; keep the keys and the {placeholders}. Missing keys show in English.');
  lines.push("var AQ = (typeof AQ !== 'undefined') ? AQ : {};");
  lines.push('AQ.langFiles = AQ.langFiles || {};');
  lines.push(`AQ.langFiles.${code} = {`);
  lines.push(`  _meta: { ${Object.entries(meta).map(([k, v]) => `${k}: ${q(v)}`).join(', ')} },`);
  let group = null;
  const keys = layout.filter((e) => strings[e.key] != null);
  keys.forEach((e, i) => {
    if (e.group !== group) { group = e.group; lines.push('', `  // ---------------------------------------------------------------- ${group}`); }
    lines.push(`  ${q(e.key)}: ${val(strings[e.key])}${i < keys.length - 1 ? ',' : ''}`);
  });
  lines.push('};', '');
  fs.writeFileSync(file(code), lines.join('\n'));
}
module.exports = { ROOT, LANG_DIR, file, readLang, readEnLayout, writeLang, placeholders, pluralForms };
