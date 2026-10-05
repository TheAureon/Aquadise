// ENGLISH: every piece of text the player can see, as one flat list of keys. This is the master copy:
// other languages copy this file (data/lang/<code>.js) and translate the text on the right, never the
// keys on the left. See docs/TRANSLATING.md.
//   {name}, {n}...  placeholders filled in by the game (keep them, move them anywhere in the sentence)
//   {k:jump}        a key or button name (keyboard or touch), filled in by the game: keep as is
//   {c:...} {inv:...}  a number from the settings (config.js), filled in by the game: keep as is
//   { one: '...', other: '...' }   plural forms, chosen by the number {n} (add zero / two / few / many
//                                  if your language needs them)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.langFiles = AQ.langFiles || {};
AQ.langFiles.en = {
  _meta: { name: 'ENGLISH', locale: 'en' },

  // ---------------------------------------------------------------- formats
  'fmt.date': '{y}-{m}-{d}',                     // the photo caption's date (y = year, m = month, d = day)

  // ---------------------------------------------------------------- settings
  'settings.language': 'LANGUAGE'
};
