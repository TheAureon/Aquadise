# Aquadise: project rules

## Text and translation
- All text the player can see must go through `t()` (`AQ.t` / `AQ.Lang.t`, src/lang.js) with keys in
  `data/lang/`. Never hardcode player-visible text in code or data files.
- New features must add their strings to `data/lang/en.js` (the English master file), in the right group.
- Sentences are written as full templates with placeholders (`'A baby {name} was born!'`), never glued
  together from pieces, so word order can change in other languages. Counts that change the wording use
  plural forms (`{ one: '{n} EGG', other: '{n} EGGS' }`).
- Saves store ids and numbers only, never display text.
- Check with `node tools/check-game.js --keys` (every key used exists, unused keys listed, no console
  errors on any screen). See docs/TRANSLATING.md.
