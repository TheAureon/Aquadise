#!/usr/bin/env node
// Translate in a spreadsheet, without touching code.
//   node tools/lang-csv.js export de [de.csv] [--locale de]  write a CSV: key, english, translation, where (where it's used / notes)
//                                                (the translation column is filled from data/lang/de.js if it exists)
//   node tools/lang-csv.js import de de.csv [--name DEUTSCH] [--locale de]
//                                                write data/lang/de.js from the CSV (only rows with a translation)
// Plural texts get one row per form: key#one, key#other (and key#few, key#many... for the forms the
// language needs). Open the CSV in any spreadsheet (UTF-8, comma separated), fill in the translation
// column, save as CSV, import. Then: node tools/lang-check.js de
'use strict';
const fs = require('fs');
const L = require('./lang-lib');

const argv = process.argv.slice(2), opts = {}, pos = [];
for (let i = 0; i < argv.length; i++) { if (/^--/.test(argv[i])) opts[argv[i]] = argv[++i]; else pos.push(argv[i]); }
const [cmd, code, csvPath] = pos, opt = (n) => opts[n] || null;
if (!cmd || !code || !/^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(code) || code === 'en') {
  console.log('Usage: node tools/lang-csv.js export <code> [file.csv] [--locale xx]\n       node tools/lang-csv.js import <code> <file.csv> [--name NAME] [--locale xx]');
  process.exit(2);
}

// ---- CSV (RFC 4180: quotes around fields, doubled quotes inside)
const cell = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
function parseCSV(text) {
  const rows = []; let row = [], f = '', i = 0, inQ = false;
  text = text.replace(/^﻿/, '');
  while (i < text.length) {
    const c = text[i];
    if (inQ) { if (c === '"' && text[i + 1] === '"') { f += '"'; i += 2; continue; } if (c === '"') { inQ = false; i++; continue; } f += c; i++; continue; }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(f); f = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
    f += c; i++;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const en = L.readLang('en'), layout = L.readEnLayout();
const existing = fs.existsSync(L.file(code)) ? L.readLang(code) : {};
const meta = Object.assign({ name: code.toUpperCase(), locale: code }, existing._meta || {});
const forms = L.pluralForms(opt('--locale') || meta.locale);

if (cmd === 'export') {
  const out = [['key', 'english', 'translation', 'where'].map(cell).join(',')];
  for (const e of layout) {
    const v = en[e.key], t = existing[e.key], where = e.group + (e.note ? ' - ' + e.note : '');
    if (v && typeof v === 'object') {
      const ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
      const fs2 = [...new Set(forms.concat(Object.keys(v)))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      for (const f of fs2) out.push([`${e.key}#${f}`, v[f] != null ? v[f] : v.other, t && typeof t === 'object' ? t[f] || '' : '', `${where} (plural: ${f})`].map(cell).join(','));
    } else out.push([e.key, v, typeof t === 'string' ? t : '', where].map(cell).join(','));
  }
  const dest = csvPath || `${code}.csv`;
  fs.writeFileSync(dest, '﻿' + out.join('\r\n') + '\r\n');
  console.log(`Wrote ${dest}: ${out.length - 1} rows (${Object.keys(existing).length ? 'with the current translations' : 'translation column empty'}).`);
} else if (cmd === 'import') {
  if (!csvPath) { console.log('Which CSV file?'); process.exit(2); }
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const head = rows.shift().map((h) => h.trim().toLowerCase()), ki = head.indexOf('key'), ti = head.indexOf('translation');
  if (ki < 0 || ti < 0) { console.log('The CSV needs "key" and "translation" columns.'); process.exit(1); }
  const strings = {}; let n = 0; const unknown = [];
  for (const r of rows) {
    const raw = (r[ki] || '').trim(), text = r[ti];
    if (!raw || text == null || text === '') continue;
    const [key, form] = raw.split('#');
    if (en[key] == null) { unknown.push(key); continue; }
    if (form) { strings[key] = typeof strings[key] === 'object' ? strings[key] : {}; strings[key][form] = text; } else strings[key] = text;
    n++;
  }
  if (opt('--name')) meta.name = opt('--name');
  if (opt('--locale')) meta.locale = opt('--locale');
  L.writeLang(code, meta, strings);
  console.log(`Wrote data/lang/${code}.js: ${n} texts.${unknown.length ? ` Skipped ${unknown.length} rows with unknown keys: ${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '...' : ''}` : ''}`);
  console.log(`Next: add <script src="data/lang/${code}.js"></script> to index.html (after en.js) if it isn't there, then run node tools/lang-check.js ${code}`);
} else { console.log(`Unknown command "${cmd}" (export or import).`); process.exit(2); }
