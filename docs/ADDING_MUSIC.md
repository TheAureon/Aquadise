# Adding your own music

You can give the game your own songs as audio files. They play exactly like the built-in DELTA songs:
- every so often, at the frequency chosen in SETTINGS > SOUND > DELTA;
- with the NOW PLAYING toast;
- in the jukebox (the MUSIC page);
- in the Sound Test.

If you add nothing, nothing changes.

## 1. Put the file in the music folder

Copy your song into the `assets/music/` folder (next to `manifest.js`).

- **Format:** MP3 works in every browser, Safari included. OGG works in most, but not in older Safari.
  MP3 is the safe choice.
- **Name:** small letters, no spaces, dashes instead: `kelp-lullaby.mp3`, not `Kelp Lullaby.MP3`.
  Web servers care about capitals and spaces even when your computer doesn't.

## 2. Add one line to `assets/music/manifest.js`

Open `assets/music/manifest.js` in any text editor. Inside the square brackets, add one line per song:

```js
AQ.data.musicFiles = [
  { title: 'KELP LULLABY', file: 'assets/music/kelp-lullaby.mp3', place: 'kelp', time: 'any' },
];
```

- **title**: the name the game shows. Capital letters look best in the game's font.
- **file**: `assets/music/` followed by the file's exact name.
- **place**: where it plays. One of:
  - `title`, `hill`, `station`, `aquarium`;
  - the sea biomes: `tide_pools`, `coral`, `ruins`, `open_ocean`, `vents`, `trench`, `kelp`, `mangrove`, `ice`, `cave`, `lush_cave`.

  For several places, write `places: ['kelp', 'mangrove']` instead.
- **time**:
  - `'day'`: only plays by day;
  - `'night'`: only plays at night;
  - `'any'`: plays at any time.

Keep the quotes and the comma at the end of the line. Save the file and reload the game.

**To check it worked:** open SETTINGS > SOUND > SOUND TEST > DELTA. Your song is listed with its length; click it to play it. If the name in `file` is wrong, the browser's console (F12) says "couldn't load assets/music/…" and the song is left out. The rest of the game is unaffected.

## 3. How loud should it be?

Any normally mastered song is fine. The game measures each file's average loudness when it loads and turns it up or down to sit with the built-in songs, so a loud file won't jump out.

A very quiet file is only raised so far (about 8 dB), so its hiss isn't amplified. If yours sounds quiet next to the others, raise its volume in an audio editor before adding it.

Fade-ins and fade-outs are yours to choose. A gentle fade-out at the end sounds best, because the game lets the song end by itself.

## 4. How big is too big?

| | Rough size |
|---|---|
| A 3-minute MP3 at 128–192 kbps | 3–4 MB |
| Every song you add | is downloaded when someone plays the game |

- Keep each song under about 8 MB, and all of them together under about 40 MB. People on phones will thank you.
- **itch.io:** the uploaded zip may be up to 1 GB, but a smaller game loads faster.
- MP3 at 128 kbps sounds fine for this soft music.

## 5. Hosted, opened from a file, or the one-file upload

- **On a website (hosted):** nothing more to do. The game loads the files from `assets/music/`.
- **Opened straight from disk (`index.html` double-clicked):** browsers won't let a page read files from your disk. Run this once after adding or changing songs (it needs Node.js):

  ```
  node tools/embed-music.js
  ```

  It packs your songs into `assets/music/embedded.js`, which the game reads instead. It also warns about big files.
- **The one-file upload (`node tools/build.js`):** does that packing for you, so your songs are inside the uploaded file.
