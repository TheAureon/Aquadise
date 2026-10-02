// Music + sound data. Edit freely: every piece is generated live from these settings (src/music.js).
//
// A piece:  root (MIDI note of the key), scale, bpm, and which instruments play which part:
//   lead    the melody voice          piano | bell | harp | marimba | guitar | chip | drone | bass
//   pad     held chords (optional)    warm | glass
//   bass    soft low notes (true/false)
//   arp     arpeggios (optional)      harp | chip | marimba | guitar   (+ arpDensity 0..1)
//   bounce  little offbeat chord plucks (Stardew-ish), true/false
//   melody  the place's own short tune (scale steps); the shared MOTIF also comes back now and then
//   chords  chord roots (scale steps) the phrases move through
//   rest    [min, max] beats of quiet between phrases (silence matters); x AQ.TUNING.audio.musicRest
//   octave  shifts the melody (12 = an octave up, -12 down)
//   night   true -> at night this piece plays slower, quieter and darker (AQ.TUNING.audio.night*),
//           in a minor-ish scale, with soft chiptune arpeggios
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.music = {
  scales: {
    major: [0, 2, 4, 5, 7, 9, 11], majPent: [0, 2, 4, 7, 9], minPent: [0, 3, 5, 7, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10]
  },
  // the darker scale each one turns into at night
  nightScale: { major: 'dorian', majPent: 'minPent', lydian: 'dorian', mixolydian: 'dorian', dorian: 'aeolian', aeolian: 'aeolian', minPent: 'minPent' },

  // The shared motif (scale steps + beats) heard in every place, voiced by that place's lead.
  motif: { notes: [0, 2, 4, 3, 1], beats: [1, 0.5, 1.5, 1, 2] },

  pieces: {
    title:      { label: 'TITLE',       root: 60, scale: 'major',      bpm: 70,  lead: 'piano',   pad: 'warm',  bass: true, melody: [4, 2, 1, 2, 0, -1, 0], chords: [0, 5, 3, 4], rest: [3, 6] },
    hill:       { label: 'HILL',        root: 62, scale: 'mixolydian', bpm: 76,  lead: 'guitar',  pad: 'warm',  bass: true, bounce: true, melody: [0, 2, 4, 5, 4, 2], chords: [0, 3, 6, 0], rest: [4, 7] },
    station:    { label: 'STATION',     root: 64, scale: 'lydian',     bpm: 84,  lead: 'chip',    pad: 'glass', arp: 'chip', arpDensity: 0.7, melody: [0, 4, 3, 7, 6, 4], chords: [0, 1, 0, 4], rest: [3, 6] },
    aquarium:   { label: 'AQUARIUM',    root: 65, scale: 'lydian',     bpm: 72,  lead: 'bell',    pad: 'glass', arp: 'chip', arpDensity: 0.35, melody: [4, 3, 1, 0, 1, 4], chords: [0, 1, 3, 4], rest: [4, 7] },
    tide_pools: { label: 'TIDE POOLS',  root: 67, scale: 'majPent',    bpm: 100, lead: 'marimba', bass: true, bounce: true, melody: [0, 1, 2, 4, 3, 2, 0], chords: [0, 3, 1, 4], rest: [3, 6], night: true },
    coral:      { label: 'CORAL SHELF', root: 64, scale: 'major',      bpm: 80,  lead: 'harp',    pad: 'warm',  arp: 'harp', arpDensity: 0.6, melody: [2, 4, 5, 4, 2, 1], chords: [0, 3, 5, 4], rest: [3, 6], night: true },
    ruins:      { label: 'SUNKEN RUINS',root: 57, scale: 'aeolian',    bpm: 64,  lead: 'piano',   pad: 'warm',  bass: true, melody: [0, 2, 3, 2, 4, 0], chords: [0, 5, 3, 6], rest: [4, 8], night: true },
    open_ocean: { label: 'OPEN OCEAN',  root: 60, scale: 'lydian',     bpm: 60,  lead: 'bell',    pad: 'warm',  arp: 'harp', arpDensity: 0.5, bass: true, melody: [4, 7, 6, 4, 3, 4], chords: [0, 1, 5, 4], rest: [4, 8], night: true },
    vents:      { label: 'VENTS', root: 47, scale: 'aeolian', bpm: 50,  lead: 'piano',   pad: 'warm',  bass: true, melody: [0, 1, 0, -2, 0], chords: [0, 5, 0, 6], rest: [6, 10], octave: 12, night: true },
    trench:     { label: 'TRENCH', root: 45, scale: 'minPent',    bpm: 44,  lead: 'drone',   pad: 'warm',  melody: [0, 2, 1, 0], chords: [0, 3], rest: [8, 12], night: true },
    kelp:       { label: 'KELP FOREST', root: 62, scale: 'dorian',     bpm: 66,  lead: 'harp',    pad: 'warm',  arp: 'harp', arpDensity: 0.65, bass: true, melody: [0, 2, 4, 6, 4, 3], chords: [0, 3, 6, 4], rest: [3, 7], night: true },
    mangrove:   { label: 'MANGROVE',    root: 62, scale: 'mixolydian', bpm: 84,  lead: 'guitar',  bass: true, bounce: true, melody: [4, 2, 4, 6, 4, 0], chords: [0, 6, 3, 0], rest: [4, 7], night: true },
    ice:        { label: 'ICE SHELF',   root: 69, scale: 'majPent',    bpm: 60,  lead: 'bell',    pad: 'glass', melody: [4, 3, 1, 3, 2, 0], chords: [0, 3, 2, 4], rest: [5, 9], night: true },
    cave:       { label: 'CAVE',root: 50, scale: 'aeolian',    bpm: 52,  lead: 'piano',   pad: 'warm',  melody: [4, 3, 2, 0, 1], chords: [0, 5, 3], rest: [6, 11], octave: 12, night: true },
    lush_cave:  { label: 'LUSH CAVE',   root: 65, scale: 'majPent',    bpm: 62,  lead: 'harp',    pad: 'warm',  melody: [2, 3, 4, 2, 1, 0], chords: [0, 3, 1, 4], rest: [5, 9], night: true }
  },

  // quiet reward moments (a new decoration unlocked): a short plucked phrase over the music
  stingers: {
    reward: { label: 'REWARD', root: 67, scale: 'major', bpm: 132, lead: 'guitar', notes: [0, 2, 4, 7, 9, 7, 11, 14], beats: [0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 3] }
  }
};

// Creature voices, by category; a creature's own `voice:` field (data/creatures.js) wins.
// Gastropods and plants stay quiet unless they have their own voice.
AQ.data.creatureVoices = {
  fish: 'voice_fish', crustacean: 'voice_crab', cephalopod: 'voice_squid',
  mammal: 'voice_mammal', amphibian: 'voice_amphibian', reptile: 'voice_reptile'
};

// Swap any generated sound for a real recording: map its id to a file. Effects use their id, ambience
// beds 'amb:<place>', music 'music:<piece>' (beds + music loop), e.g.
//   AQ.data.audioFiles = { catch: 'audio/catch.ogg', 'amb:kelp': 'audio/kelp-bed.ogg', 'music:kelp': 'audio/kelp.ogg' };
// The SOUND TEST screen lists every id. Serve the game over http for files to play reliably.
// A value can be one file, a list (one is picked at random each time), or
//   { files: [...], vol: 0..1, vary: 0..0.2 }   (vol = loudness, vary = random pitch change).
// After adding a file to assets/audio/, run `node tools/embed-audio.js` so it also plays from file://.
AQ.data.audioFiles = {
  // footsteps on the sand (tide pool shore) and on the hill's grass: single steps cut from recordings
  step_sand: { files: [1, 2, 3, 4, 5, 6].map((i) => `assets/audio/sand-step-${i}.mp3`), vol: 0.13, vary: 0.06 },
  step_grass: { files: [1, 2, 3, 4, 5, 6].map((i) => `assets/audio/grass-step-${i}.mp3`), vol: 0.4, vary: 0.06 },
  // going into and climbing out of the water (two different moments of the same recording)
  splash_in: { files: ['assets/audio/water-in.mp3'], vol: 0.4, vary: 0.04 },
  splash_out: { files: ['assets/audio/water-out.mp3'], vol: 0.4, vary: 0.04 }
};
