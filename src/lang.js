// Languages. Every piece of text the player can see comes from here, through t():
//   AQ.Lang.t('toast.babyBorn', { name: 'Ribbonmane' })   -> "A baby Ribbonmane was born! It's in the nursery."
//   t('nursery.eggs', { n: 3 })                            -> "3 EGGS"  (plural forms: see below)
// The strings live in data/lang/<code>.js (English: data/lang/en.js), one flat list of keys, each file
// registering itself as AQ.langFiles[code]. A key missing in the current language falls back to
// English; a key missing everywhere draws nothing (never the raw key) and is listed in AQ.Lang.missing
// (tools/check-game.js --keys finds those before players do).
//
// Placeholders: {name}, {n}... are filled from the values passed in (anything else in braces, like the
// key-name tokens {k:jump} or the config numbers {c:...}, is left for the code that fills those in).
// Plurals: a value can be { one: '...', other: '...' } (and any of zero / two / few / many, the
// Unicode plural categories); the form is chosen from the `n` value with the language's own rules
// (Intl.PluralRules), falling back to `other`.
// Also: the current language's name comparison (sorting lists) and date format.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.langFiles = AQ.langFiles || {};

AQ.Lang = (function () {
  const L = { code: 'en', missing: new Set(), listeners: [] };
  // things that cache text in pictures (the building's signs...) repaint when the language changes
  L.onChange = (fn) => L.listeners.push(fn);
  const files = () => AQ.langFiles;
  const meta = (code) => (files()[code] && files()[code]._meta) || {};
  const tun = () => (AQ.TUNING && AQ.TUNING.debug) || {};

  // ---------------------------------------------------------------- which languages exist
  // Every loaded language file, except hidden ones (the PSEUDO test language) unless their debug flag is on.
  L.available = () => Object.keys(files()).filter((c) => !meta(c).hidden || (meta(c).flag && tun()[meta(c).flag])).concat(
    L.extra ? Object.keys(L.extra).filter((c) => tun()[L.extra[c].flag]) : []);
  L.has = (key, code = L.code) => !!(files()[code] && key in files()[code]);
  L.name = (code) => (L.extra && L.extra[code] ? L.extra[code].name : meta(code).name) || code.toUpperCase();
  L.locale = () => meta(L.code).locale || (L.extra && L.extra[L.code] && L.extra[L.code].locale) || 'en';
  // the player's choice (AQ.State.settings.language), else the browser's language if we have it, else English
  L.pick = function () {
    const chosen = AQ.State && AQ.State.settings && AQ.State.settings.language, ok = L.available();
    if (chosen && ok.indexOf(chosen) >= 0) return chosen;
    for (const b of (navigator.languages || [navigator.language || 'en'])) {
      const c = String(b).toLowerCase();
      if (ok.indexOf(c) >= 0) return c;
      if (ok.indexOf(c.split('-')[0]) >= 0) return c.split('-')[0];
    }
    return 'en';
  };
  L.set = function (code) {
    if (L.available().indexOf(code) < 0) code = 'en';
    L.code = code; collator = null; plurals = null;
    L.listeners.forEach((fn) => { try { fn(code); } catch (e) { /* a listener never stops the switch */ } });
    if (L.fillPage && typeof document !== 'undefined' && document.body) L.fillPage();
    return code;
  };
  L.refresh = () => L.set(L.pick());
  // the page's own text: the tab title and every element with data-t="key" (index.html)
  L.fillPage = function () {
    if (typeof document === 'undefined') return;
    document.title = L.t('game.title');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = L.t(el.getAttribute('data-t')); });
  };

  // ---------------------------------------------------------------- lookups
  // raw value (a string or a plural object) for a key: this language, then English
  function raw(key, code) {
    if (L.extra && L.extra[code] && L.extra[code].raw) return L.extra[code].raw(key);
    const f = files()[code];
    if (f && key in f) return f[key];
    const en = files().en;
    return en && key in en ? en[key] : undefined;
  }
  let plurals = null, collator = null;
  L.pluralForm = function (n) {
    try { plurals = plurals || new Intl.PluralRules(L.locale()); return plurals.select(n); } catch (e) { return n === 1 ? 'one' : 'other'; }
  };
  // choose a plural form: forms = { one, other, ... } (missing forms fall back to `other`)
  L.plural = function (n, forms) {
    if (typeof forms === 'string') return forms;
    const f = L.pluralForm(n);
    return forms[f] != null ? forms[f] : forms.other != null ? forms.other : forms.one;
  };
  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : String(s));
  L.t = function (key, vars, code = L.code) {
    let v = raw(key, code);
    if (v == null) { L.missing.add(key); return ''; }
    if (typeof v === 'object') v = L.plural(vars && vars.n != null ? vars.n : 1, v);
    return fill(v, vars);
  };
  // English, whatever the current language (file names and other things that must stay plain ASCII)
  L.tEn = (key, vars) => L.t(key, vars, 'en');

  // ---------------------------------------------------------------- language-aware helpers
  // compare two names for sorting, with the language's own rules
  L.compare = function (a, b) {
    try { collator = collator || new Intl.Collator(L.locale(), { sensitivity: 'base', numeric: true }); return collator.compare(String(a), String(b)); }
    catch (e) { return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; }
  };
  // a date in the language's short format (the template 'fmt.date' with {y} {m} {d}, zero-padded)
  L.date = function (d) {
    const z = (n) => String(n).padStart(2, '0');
    return L.t('fmt.date', { y: d.getFullYear(), m: z(d.getMonth() + 1), d: z(d.getDate()) });
  };
  return L;
})();
AQ.t = AQ.Lang.t;
