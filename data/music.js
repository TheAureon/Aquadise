// Music data. ATARAXIA (src/ataraxia.js), the calm music that is always there: one setting per place.
// (The composed DELTA songs come in data/songs.js.) Edit freely; AQ.TUNING.ataraxia holds the shared tuning.
//
// A place:
//   root     MIDI note the pad's chords are built on (48 = C3; lower = deeper)
//   chords   the few slow chords the pad glides between, as semitones above the root (4 notes each,
//            written close together so each note only moves a little: smooth voice leading)
//   color    the pad's sound: warm (soft saws) | glass (glassy) | airy (wide, hollow)
//   bright   0..1 how open the pad sounds (then darkened by depth and night)
//   level    0..1 how loud this place's pad is
//   sub      0..1 the deep held bass note under it (0 = none)
//   notes    the instruments of the single, occasional notes (one at a time, long silences between)
//   high     how far above the root those notes may sit (semitones: [lowest, highest])
//   depth    0..1 how deep the place usually is (only the Sound Test uses it; in the game it's the
//            diver's real depth)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

// chord shapes shared by several places (semitones above the root; see `chords` above)
const ATARAXIA_CHORDS = {
  major: [[0, 7, 14, 16], [-3, 7, 12, 16], [-7, 7, 12, 16]],          // I add9, vi7, IV maj9 (shared A, D, F#)
  lydian: [[0, 7, 14, 18], [2, 9, 14, 18], [0, 7, 11, 16]],          // I(#11), II, I maj7: floating
  dorian: [[0, 7, 14, 15], [5, 9, 12, 14], [-2, 7, 10, 14]],         // i add9, IV6, VII: green, open
  mixolydian: [[0, 7, 14, 16], [-2, 7, 10, 14]],                      // I add9, VII6: earthy
  aeolian: [[0, 7, 14, 15], [-4, 7, 12, 15], [-7, 7, 10, 15]],       // i add9, VI maj7, iv: old, dim
  pentatonic: [[0, 7, 14, 19], [-3, 7, 12, 14]],                      // open fifths: glassy, cold
  deep: [[0, 7, 12, 15], [-4, 7, 12, 15]]                             // almost a drone: i, VI
};

AQ.data.music = {
  ataraxia: {
    title:      { root: 50, chords: ATARAXIA_CHORDS.major,      color: 'warm',  bright: 0.55, level: 0.9,  sub: 0.5, notes: ['piano', 'bell'],          high: [14, 34], depth: 0.1 },
    hill:       { root: 55, chords: ATARAXIA_CHORDS.major,      color: 'airy',  bright: 0.7,  level: 0.85, sub: 0.4, notes: ['harp', 'piano'],          high: [12, 31], depth: 0 },
    station:    { root: 52, chords: ATARAXIA_CHORDS.lydian,     color: 'glass', bright: 0.65, level: 0.8,  sub: 0.35, notes: ['glass', 'bell', 'chip'], high: [16, 36], depth: 0 },
    aquarium:   { root: 53, chords: ATARAXIA_CHORDS.lydian,     color: 'glass', bright: 0.55, level: 0.8,  sub: 0.3, notes: ['bell', 'harp', 'glass'],  high: [14, 34], depth: 0.2 },
    tide_pools: { root: 55, chords: ATARAXIA_CHORDS.major,      color: 'airy',  bright: 0.8,  level: 0.9,  sub: 0.4, notes: ['harp', 'bell', 'piano'],  high: [12, 31], depth: 0.1 },
    coral:      { root: 52, chords: ATARAXIA_CHORDS.lydian,     color: 'warm',  bright: 0.7,  level: 0.9,  sub: 0.45, notes: ['harp', 'glass', 'marimba'], high: [12, 31], depth: 0.25 },
    ruins:      { root: 47, chords: ATARAXIA_CHORDS.aeolian,    color: 'warm',  bright: 0.45, level: 0.85, sub: 0.55, notes: ['piano', 'bell'],         high: [15, 34], depth: 0.4 },
    open_ocean: { root: 48, chords: ATARAXIA_CHORDS.lydian,     color: 'airy',  bright: 0.6,  level: 0.85, sub: 0.6, notes: ['bell', 'glass', 'piano'], high: [16, 38], depth: 0.45 },
    kelp:       { root: 50, chords: ATARAXIA_CHORDS.dorian,     color: 'warm',  bright: 0.6,  level: 0.9,  sub: 0.5, notes: ['harp', 'piano'],          high: [12, 31], depth: 0.35 },
    mangrove:   { root: 50, chords: ATARAXIA_CHORDS.mixolydian, color: 'warm',  bright: 0.55, level: 0.85, sub: 0.5, notes: ['marimba', 'harp'],        high: [12, 28], depth: 0.2 },
    ice:        { root: 57, chords: ATARAXIA_CHORDS.pentatonic, color: 'glass', bright: 0.75, level: 0.8,  sub: 0.3, notes: ['glass', 'bell'],          high: [14, 34], depth: 0.25 },
    cave:       { root: 45, chords: ATARAXIA_CHORDS.aeolian,    color: 'warm',  bright: 0.35, level: 0.8,  sub: 0.6, notes: ['piano', 'glass'],         high: [17, 36], depth: 0.6 },
    lush_cave:  { root: 53, chords: ATARAXIA_CHORDS.major,      color: 'warm',  bright: 0.5,  level: 0.85, sub: 0.45, notes: ['harp', 'glass'],         high: [12, 31], depth: 0.6 },
    vents:      { root: 45, chords: ATARAXIA_CHORDS.aeolian,    color: 'warm',  bright: 0.3,  level: 0.75, sub: 0.7, notes: ['piano'],                  high: [19, 36], depth: 0.75 },
    trench:     { root: 43, chords: ATARAXIA_CHORDS.deep,       color: 'airy',  bright: 0.25, level: 0.7,  sub: 0.7, notes: ['glass'],                  high: [21, 38], depth: 0.95 }
  },

  // scales, for the stingers below (scale steps -> semitones)
  scales: { major: [0, 2, 4, 5, 7, 9, 11] },
  // quiet reward moments (a new decoration unlocked, a meteor shower): a short phrase over the music
  stingers: {
    shower: { root: 79, scale: 'major', bpm: 66, lead: 'bell', vol: 0.45, notes: [7, 11, 14, 9, 12, 16, 14], beats: [1, 1, 1.5, 1, 1, 1.5, 4] },
    reward: { root: 67, scale: 'major', bpm: 132, lead: 'harp', notes: [0, 2, 4, 7, 9, 7, 11, 14], beats: [0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 3] }
  }
};

// Creature voices, by category; a creature's own `voice:` field (data/creatures.js) wins.
// Gastropods and plants stay quiet unless they have their own voice.
AQ.data.creatureVoices = {
  fish: 'voice_fish', crustacean: 'voice_crab', cephalopod: 'voice_squid',
  mammal: 'voice_mammal', amphibian: 'voice_amphibian', reptile: 'voice_reptile'
};

// Swap any generated sound for a real recording: map its id to a file. Effects use their id, ambience
// beds 'amb:<place>' (they loop), the two reward phrases 'music:reward' / 'music:shower', e.g.
//   AQ.data.audioFiles = { catch: 'audio/catch.ogg', 'amb:kelp': 'audio/kelp-bed.ogg' };
// The SOUND TEST screen lists every id. Serve the game over http for files to play reliably.
// A value can be one file, a list (one is picked at random each time), or
//   { files: [...], vol: 0..1, vary: 0..0.2 }   (vol = loudness, vary = random pitch change).
// After adding a file to assets/audio/, run `node tools/embed-audio.js` so it also plays from file://.
AQ.data.audioFiles = {
  // footsteps on the sand (tide pool shore) and on the hill's grass: single steps cut from recordings
  step_sand: { files: [1, 2, 3, 4, 5, 6].map((i) => `assets/audio/sand-step-${i}.mp3`), vol: 0.13, vary: 0.06 },
  step_grass: { files: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `assets/audio/grass-step-${i}.mp3`), vol: 0.3, vary: 0.03 },
  // going into and climbing out of the water (two different moments of the same recording)
  splash_in: { files: ['assets/audio/water-in.mp3'], vol: 0.4, vary: 0.04 },
  splash_out: { files: ['assets/audio/water-out.mp3'], vol: 0.4, vary: 0.04 }
};
