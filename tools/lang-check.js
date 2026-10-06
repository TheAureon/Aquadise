#!/usr/bin/env node
// Checks a language file against English (data/lang/en.js):
//   node tools/lang-check.js de          check data/lang/de.js
//   node tools/lang-check.js --all       check every language file
// Reports: keys missing (they show in English), keys that English doesn't have (typos, removed text),
// placeholders that don't match ({name}, {n}, {k:jump}...: the same ones must appear, in any order),
// plural forms the language needs but doesn't give, texts identical to English (maybe untranslated),
// and characters the pixel font has no glyph for yet (they'd show as boxes; see data/glyphs.js).
// Exit code 1 if anything would show wrongly (missing placeholders or plural forms, unknown keys).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lang-lib');

const args = process.argv.slice(2);
if (!args.length) { console.log('Usage: node tools/lang-check.js <code> | --all'); process.exit(2); }
const codes = args[0] === '--all' ? fs.readdirSync(L.LANG_DIR).filter((f) => /\.js$/.test(f)).map((f) => f.slice(0, -3)).filter((c) => c !== 'en') : args;

const en = L.readLang('en');
const glyphs = (() => { const c = {}; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(L.ROOT, 'data/glyphs.js'), 'utf8'), c); return c.AQ.data.glyphs; })();
let bad = 0;
if (!codes.length) console.log('No translations yet (only data/lang/en.js).');
for (const code of codes) {
  const tr = L.readLang(code), meta = tr._meta || {}, locale = meta.locale || code;
  const keys = Object.keys(en).filter((k) => k !== '_meta');
  const missing = keys.filter((k) => tr[k] == null), extra = Object.keys(tr).filter((k) => k !== '_meta' && en[k] == null);
  const ph = [], plural = [], same = [], glyph = new Map();
  const forms = L.pluralForms(locale);
  for (const k of keys) {
    const e = en[k], t = tr[k];
    if (t == null) continue;
    const eText = typeof e === 'object' ? e.other : e;
    if (typeof e === 'object') {
      if (typeof t !== 'object') { plural.push(`${k}: needs plural forms { ${forms.join(', ')} }`); continue; }
      const lack = forms.filter((f) => t[f] == null);
      if (lack.length) plural.push(`${k}: missing ${lack.join(', ')}`);
    }
    const texts = typeof t === 'object' ? Object.entries(t) : [['', t]];
    for (const [form, text] of texts) {
      // {n} may be left out of a singular form ("one egg"); everything else must be there
      const want = L.placeholders(eText).filter((p) => !(form === 'one' && p === '{n}')), got = L.placeholders(text);
      const lost = want.filter((p) => got.indexOf(p) < 0), added = got.filter((p) => L.placeholders(eText).indexOf(p) < 0);
      if (lost.length || added.length) ph.push(`${k}${form ? '#' + form : ''}: ${lost.length ? 'missing ' + lost.join(' ') : ''}${lost.length && added.length ? ', ' : ''}${added.length ? 'unknown ' + added.join(' ') : ''}`);
      for (const ch of String(text).replace(/\{[^}]+\}/g, '').toLocaleUpperCase(locale)) if (!(ch in glyphs) && ch !== '\n') glyph.set(ch, (glyph.get(ch) || 0) + 1);
    }
    if (JSON.stringify(t) === JSON.stringify(e) && /[A-Za-z]{3}/.test(eText)) same.push(k);
  }
  console.log(`\n== ${code} (${meta.name || '?'}, locale ${locale}): ${keys.length - missing.length}/${keys.length} keys translated`);
  const list = (title, arr, n = 40) => { if (!arr.length) return; console.log(`${title} (${arr.length}):`); arr.slice(0, n).forEach((x) => console.log('  ' + x)); if (arr.length > n) console.log(`  ... and ${arr.length - n} more`); };
  list('Missing (shown in English)', missing);
  list('Not in English (remove or fix the key)', extra);
  list('Placeholders that do not match English', ph);
  list(`Plural forms (this language uses: ${forms.join(', ')})`, plural);
  list('Same as English (fine for names; otherwise untranslated?)', same, 15);
  if (glyph.size) console.log(`Characters the font doesn't have yet (they show as boxes; add them to data/glyphs.js): ${[...glyph.keys()].join(' ')}`);
  if (!missing.length && !extra.length && !ph.length && !plural.length) console.log('All good.');
  bad += extra.length + ph.length + plural.length;
}
process.exit(bad ? 1 : 0);
