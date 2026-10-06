# Translating Aquadise

Every word the player sees comes from a language file in `data/lang/`. English
(`data/lang/en.js`) is the master copy, and every other language is a copy of it with the text
on the right translated. Translators never need to touch the game code.

## Adding a language

1. **Pick a language code**, such as `de`, `fr`, `pt-br` or `ja` (the browser's codes; the game
   uses this to pick the language automatically).
2. **Make the file.** There are two ways:
   - **Spreadsheet (easiest):**
     ```
     node tools/lang-csv.js export de de.csv --locale de
     ```
     Open `de.csv` in any spreadsheet program (UTF-8, comma separated). Fill in the
     **translation** column. The **where** column says where each text appears, and sometimes
     what a placeholder means. Save it as CSV, then:
     ```
     node tools/lang-csv.js import de de.csv --name DEUTSCH --locale de
     ```
     This writes `data/lang/de.js`. Rows you leave empty stay in English, so you can work in
     pieces: export again at any time and the CSV comes back with your current translations
     filled in.
   - **By hand:** copy `data/lang/en.js` to `data/lang/de.js`. Change `AQ.langFiles.en` to
     `AQ.langFiles.de`, and set `_meta` to `{ name: 'DEUTSCH', locale: 'de' }`. Then translate
     the text on the right of each line. You may delete lines you haven't translated; they show
     in English.
3. **Load it:** in `index.html`, add one line right after the English one:
   ```html
   <script src="data/lang/en.js"></script>
   <script src="data/lang/de.js"></script>
   ```
4. The language now appears in **SETTINGS > OPTIONS > LANGUAGE**. A player whose browser is set to
   that language gets it automatically.

`name` is how the language is listed in the settings (in its own language, in capitals).
`locale` decides the plural rules, alphabetical order and number style.

## The rules for translated text

- **Keep the keys** (the left side) exactly as they are.
- **Keep every `{placeholder}`.** Move them anywhere in the sentence, but don't translate or drop
  them:
  - `{name}`, `{n}`, `{tank}`... are filled in by the game;
  - `{k:jump}` becomes the name of a key ("SPACE");
  - `{c:...}` becomes a number from the settings.
  
  Example: `'A baby {name} was born!'` could become `'{name}: ein Baby ist geschlüpft!'`.
- **Plurals:** texts with counts look like `{ one: '{n} EGG', other: '{n} EGGS' }`. Give every form
  your language needs:
  - English needs `one` and `other`;
  - Polish needs `one`, `few`, `many` and `other`;
  - Japanese needs only `other`.
  
  `node tools/lang-check.js` tells you which forms your language needs. In the CSV, each form has
  its own row (`key#one`, `key#few`...). The `one` form may leave out `{n}` ("an egg").
- **Line breaks:** `\n` in a text starts a new line, and the spreadsheet shows it as a real line
  break. Most longer texts wrap by themselves, so add line breaks only where English has them.
- **Length:** the screen is tiny (320×180 pixels), so shorter is better. Text that's too long is
  squeezed narrower, and then cut short with "..". It never overlaps anything, but it can get hard
  to read. If a text looks squashed in the game, look for a shorter way to say it.
- **Capitals:** the pixel font has capital letters only, and everything is drawn in upper case. Write
  normally; the game capitalizes using your language's rules.
- **Dates:** `fmt.date` is the date format on photos, built from `{y}`, `{m}` and `{d}`. For example,
  `'{d}.{m}.{y}'`. Photo file names always stay in plain English.

## Testing a language

- **Check the file:**
  ```
  node tools/lang-check.js de      (or --all)
  ```
  It lists:
  - keys still missing (shown in English);
  - keys English doesn't have (typos, or text that was removed);
  - placeholders that don't match;
  - missing plural forms;
  - texts identical to English (fine for names, otherwise maybe untranslated);
  - letters the font can't draw yet.
  
  It exits with an error if anything would show wrongly.
- **See it in the game:** open `index.html` and choose the language under SETTINGS > OPTIONS >
  LANGUAGE. Look especially at:
  - the title menu;
  - the tank screen (the buttons along the top and bottom, the info card);
  - the log;
  - the Guide pages;
  - the settings.
- **Check every screen at once:**
  ```
  node tools/check-game.js --lang de --shots shots
  ```
  This opens the game in a hidden browser, visits all the main screens in your language, and
  reports console errors and missing letters. With `--shots`, it saves a screenshot of every screen
  to the `shots` folder, so you can scroll through them.

  It needs Playwright once:
  ```
  npm install --no-save playwright && npx playwright install chromium
  ```
- **PSEUDO, the test language.** Set `debug.pseudoLanguage: true` in `src/config.js` and a language
  called PSEUDO appears in the settings. It is English, made about 40% longer and wrapped in
  `[!! !!]`:
  - English text without the markers was missed by the translation system (please report it);
  - anything cut off or crowded shows where long translations will struggle.
  
  `node tools/check-game.js --lang pseudo` runs it on every screen.

## Letters the font has

The pixel font is drawn letter by letter in `data/glyphs.js`. It has:

```
A-Z  0-9  . , ! ? : ; - + / ( ) ' % < > [ ] = * # & ^ ~ "  ♥ ♂ ♀ ✦  (and the space)
```

That's all; there are no accented letters yet. Any other character draws as a small box, and
both `lang-check` and `check-game` list which ones your language uses. To add a letter (É, Ñ,
Ü, Ç...), add one line to `AQ.data.glyphs` in `data/glyphs.js`: 5 rows of `#` (lit) and `.`
(empty), usually 3 wide. Nothing else needs to change. Only capitals are needed. Wider letters are
fine, since each letter advances by its own width. The font is 5 pixels tall, so accents must fit
inside those rows (look at how `Q` and `!` use the space).

Languages with thousands of characters (Chinese, Japanese, Korean) would need a different, larger
font. That's a bigger job than adding glyphs.

**The title logo** has its own big letters (`AQ.data.logoGlyphs`, 5×7). It spells the game name
(`game.name`) and only has A, Q, U, D, I, S and E. If you translate the game's name, its letters
need adding there too; a letter without a logo glyph is left as a gap. No image file in the game
contains words.

## Not supported yet

- **Right-to-left languages** (Arabic, Hebrew, Persian...) are **not supported**. The game draws
  every line left to right, and the layout assumes it.
- Languages that need a bigger font (see above).
- Keyboard hints still name the keyboard keys ("X: FLIP").

## Checklist: adding new text to the game

For anyone changing the game (the rules are also in `CLAUDE.md`):

- [ ] Never write player-visible text in code or data files. Add a key to `data/lang/en.js`, in the
      right group, and draw it with `AQ.t('group.key', { ... })`.
- [ ] Write whole sentences with placeholders (`'A baby {name} was born!'`). Never glue pieces
      together, since other languages need a different word order.
- [ ] Counts that change the wording use plural forms: `{ one: '...', other: '...' }`, with `n` passed in.
- [ ] Add a comment after the key when the meaning isn't obvious (what a placeholder is, where the
      text shows). The CSV export puts it in the **where** column for translators.
- [ ] Saves store ids and numbers, never text.
- [ ] Text in a button or a narrow space gets a `max` width (`AQ.Font.draw(..., { max: w })`) so a
      long translation squeezes instead of overflowing. Rows of buttons can use `AQ.Aquarium.fitRow`.
- [ ] Run `node tools/check-game.js --keys`. Every key used must exist, and keys no longer used are
      listed, so remove them.
- [ ] Look at the new screen in PSEUDO: no plain English, nothing overlapping.
