# Adding real recordings for sounds

Every sound in the game is made in code, so the game needs no audio files. Any of them can be swapped for a
real recording, though: a bubble, the net's swish, a splash. The footsteps and the splashes already are. It
takes three steps and no coding.

## The three steps
1. **Put the file in `assets/audio/`.** MP3 works everywhere (OGG, WAV and M4A too). Keep it short,
   with no silence at the start: trim it so the sound begins right away.
2. **Add its line to `assets/audio/manifest.js`.** The file already has ready-made lines for the main
   sounds (bubbles, the net swish, a catch, a rare catch, the splashes, the hydrophone ping). Rename your
   file to match, or change the name in the line, then remove the `//` in front of it.
3. **Run `node tools/embed-audio.js`.** This packs the files so they also play when the game is opened
   straight from disk. (The one-file build, `node tools/build.js`, does it for you.)

Then reload the game. That's all.

## How loud it is
You don't need to set it. Each recording is measured when the game starts and turned up or down to match
the sound it replaces, so a loud recording and a quiet one both fit in. If one still feels too loud or too
quiet, add `level` to its line: `level: 0.5` is half as loud as the sound it replaced, and `level: 2` twice
as loud.

(`vol: 0.3` sets the volume by hand instead, with no matching. The footsteps use it because they were
tuned by ear.)

## Several takes
Real sounds never repeat exactly, so a sound that plays often (bubbles, steps, the net) is nicer with 2 to 4
slightly different recordings. List them all:

```js
bubbles: { files: ['assets/audio/bubbles-1.mp3', 'assets/audio/bubbles-2.mp3', 'assets/audio/bubbles-3.mp3'], vary: 0.08 },
```

One is picked at random each time, never the same one twice in a row. `vary` adds a small random pitch
change on top: 0 is none, 0.05 a little, 0.15 a lot.

## Which sound is which
Open the **Sound Test** (SETTINGS > SOUND > SOUND TEST). Pick a sound and the line at the bottom shows its
id, for example `ID: SWING`. In the manifest, write the id in small letters with `_` for spaces
(`splash_in`). Sounds with a recording say **(RECORDING)**, and a **HEAR: RECORDING / HEAR: BUILT-IN** button
(or the **R** key) lets you compare the recording with the game's own sound.

The main ones:

| Id | What it is | Length |
|---|---|---|
| `bubbles` | a few small bubbles while swimming | about 0.3 s |
| `swing` | the net swishing through the water | about 0.2 s |
| `catch` | catching a creature | about 0.7 s |
| `catch_rare` | catching a rare one | about 1.3 s |
| `splash_in` / `splash_out` | jumping in / climbing out of the water | about 0.6 s |
| `up_hydro` | the hydrophone's sonar ping | about 1.3 s |
| `step_sand` / `step_grass` | footsteps (already recordings) | about 0.1 s |

## If something doesn't play
- The game plays its own sound until the recording has loaded, and keeps doing so if the file can't be
  loaded. Nothing breaks.
- The browser's console (F12) says what went wrong: a file that isn't there, or an id that isn't a sound.
- Opening `index.html` straight from disk only plays recordings that `tools/embed-audio.js` has packed.

## Where to find recordings
Record your own (a phone works well for water sounds: a bowl, a bath, a pool), or use a free sound library.
If you use someone else's recording, check its licence lets you use it in a game, and credit it if it asks
you to.
