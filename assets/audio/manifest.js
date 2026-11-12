// Real recordings in place of the game's generated sounds. How to add one: docs/ADDING_SOUNDS.md.
//
// 1. Put the file in this folder (assets/audio/): MP3, OGG, WAV or M4A, short, with no silence at the start.
// 2. Add (or un-comment) its line below. The name before the colon is the sound's id (the Sound Test shows
//    every id, under the sound: "ID: ...").
// 3. Run `node tools/embed-audio.js` (so it also plays when the game is opened straight from disk).
//
// A line can be one file, several takes (one is picked at random each time, never the same twice in a row):
//   catch: 'assets/audio/catch.mp3',
//   swing: { files: ['assets/audio/swing-1.mp3', 'assets/audio/swing-2.mp3'], level: 1, vary: 0.05 },
//   level   how loud, compared with the sound it replaces (1 = the same, 0.5 = quieter, 2 = louder).
//           Each recording is measured and matched automatically, so most lines don't need it.
//   vary    a small random pitch change on each play (0 = none, 0.05 = a little, 0.15 = a lot)
//   vol     sets the volume by hand instead of matching (0..1); the footsteps below use it
// A line whose file is missing or can't be read is skipped: the generated sound plays (and the browser's
// console says which file).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.audioFiles = Object.assign(AQ.data.audioFiles || {}, {
  // ---- in use
  // footsteps on the sand (tide pool shore) and on the hill's grass: single steps cut from recordings
  step_sand: { files: [1, 2, 3, 4, 5, 6].map((i) => `assets/audio/sand-step-${i}.mp3`), vol: 0.13, vary: 0.06 },
  step_grass: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `assets/audio/grass-step-${i}.mp3`), vol: 0.3, vary: 0.03 },
  // going into and climbing out of the water (two different moments of the same recording)
  splash_in: { files: ['assets/audio/water-in.mp3'], vol: 0.4, vary: 0.04 },
  splash_out: { files: ['assets/audio/water-out.mp3'], vol: 0.4, vary: 0.04 },

  // ---- ready for recordings: remove the // in front of a line once its files are in this folder
  // bubbles: a few small bubbles while swimming (about 0.3 s; 3-4 takes keep it from sounding looped)
  // bubbles: { files: ['assets/audio/bubbles-1.mp3', 'assets/audio/bubbles-2.mp3', 'assets/audio/bubbles-3.mp3'], vary: 0.08 },
  // swing: the net swishing through the water (about 0.2 s, soft; 2-3 takes)
  // swing: { files: ['assets/audio/net-swish-1.mp3', 'assets/audio/net-swish-2.mp3'], vary: 0.06 },
  // catch: catching a creature (a short happy sound, about 0.7 s)
  // catch: { files: ['assets/audio/catch.mp3'], vary: 0.02 },
  // catch_rare: catching a rare one (a bigger version, about 1.3 s)
  // catch_rare: { files: ['assets/audio/catch-rare.mp3'], vary: 0 },
  // splash_in / splash_out: jumping in and climbing out (replace the lines above to use your own)
  // splash_in: { files: ['assets/audio/splash-in-1.mp3', 'assets/audio/splash-in-2.mp3'], vary: 0.04 },
  // splash_out: { files: ['assets/audio/splash-out-1.mp3', 'assets/audio/splash-out-2.mp3'], vary: 0.04 },
  // up_hydro: the hydrophone's sonar ping (about 1.3 s: a ping, a fainter return ping, a low hum)
  // up_hydro: { files: ['assets/audio/sonar-ping.mp3'], vary: 0 },
});
