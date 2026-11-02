// DELTA: the composed songs (played by src/delta.js with the instruments in src/instruments.js).
// One album: piano, bells, harp, soft pads, a warm bass; each place has its own flavour, and every song
// quotes DELTA's motif somewhere (sol-mi-re-do-re: in D, "A F# E D E").
//
// A song:
//   id, places (where it is picked; see AQ.data.music.ataraxia for the place ids), time: day | night | any
//   bpm, meter (beats in a bar: 4 or 3), lead (the melody's instrument), counter, bass (instrument), pad (true)
//   form: the order its sections play in (a section can come back)
//   ring: beats the last chord rings on after the last bar (the ending)
//   echo: the echo's time in beats (1.5 = a dotted quarter)
// A section:
//   bars, chords: chord names, bars split by |; two in a bar share it ("Asus4:2 A:2" for other lengths)
//     chord names: D, Dm, Dmaj7, Dm7, D7, Dsus2, Dsus4, D7sus4, Dadd9, Dmadd9, Dmaj9, Dm9, D9, D6, Dm6, D69, Ddim,
//     Dm7b5, Daug, Dmaj7#11, D5, and a bass note after a slash: D/F#
//   melody, counter, bass: notes "pitch:beats" ("F#5:1.5"), rests "r:beats", bars split by |; "!" after a note
//     = an accent. Every bar must add up to the meter (tools/check-music.js and the game check it).
//   mel / ctr / bassInst: another instrument for this section
//   pad: false = no pad here (the song's pad is on otherwise)
//   arp: { inst, pat, vel } broken chords: one token per step of the bar; a number picks a note of the chord
//     (0 = lowest), "+" an octave up, "." a rest.   comp: { inst, pat, vel } block chords on each "x"
//   perc: { shaker | clave | kick: "x.o." } hushed percussion: x = a hit, o = a softer one, one char per step
//   dyn: 0..1 how strong (to: where it has grown by the section's end); transpose: semitones (a key change)
//   like: 'A' = everything from section A, then what's written here replaces it
// Names: song.<id> in data/lang/en.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.songs = [
  // ---------------------------------------------------------------- DELTA: the title theme (D major, then E)
  { id: 'delta', places: ['title'], time: 'any', bpm: 72, meter: 4, lead: 'piano', counter: 'harp', bass: 'bass', pad: true, ring: 6,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'C', 'A4', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.5, chords: 'D | Bm7 | Gmaj7 | Asus4:2 A:2',
        counter: 'r:2 A5:2 | F#5:3 r:1 | r:2 E5:2 | D5:2 E5:2', ctr: 'bell',
        bass: 'D2:4 | B1:4 | G1:4 | A1:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'D | Bm7 | Gmaj7 | A | D/F# | G | Em7 | Asus4:2 A:2',
        melody: 'A5:1 F#5:1 E5:1.5 D5:0.5 | E5:3 r:1 | D5:0.5 E5:0.5 F#5:1 B5:1.5 A5:0.5 | A5:3 r:1 | A5:1 F#5:1 E5:1.5 D5:0.5 | B4:1 D5:1 G5:2 | F#5:1.5 E5:0.5 D5:1 E5:1 | E5:2 r:2',
        bass: 'D2:3 A2:1 | B1:3 F#2:1 | G1:3 D2:1 | A1:3 E2:1 | F#2:4 | G2:3 D2:1 | E2:3 B1:1 | A1:4' },
      A2: { bars: 8, dyn: 0.6, to: 0.65, chords: 'D | Bm7 | Gmaj7 | A | D/F# | G | Em7 A7 | D',
        melody: 'A5:1 F#5:1 E5:1.5 D5:0.5 | E5:3 r:1 | D5:0.5 E5:0.5 F#5:1 B5:1.5 A5:0.5 | A5:3 r:1 | A5:1 F#5:1 E5:1.5 D5:0.5 | B4:1 D5:1 G5:2 | G5:1 F#5:1 E5:1 C#5:1 | D5:4',
        counter: 'r:4 | r:2 B4:2 | r:2 D5:2 | C#5:2 E5:2 | r:4 | r:2 B4:2 | B4:2 A4:2 | F#4:4',
        bass: 'D2:3 A2:1 | B1:3 F#2:1 | G1:3 D2:1 | A1:3 E2:1 | F#2:4 | G2:3 D2:1 | E2:2 A1:2 | D2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.72, chords: 'Bm | G | D/F# | A | Bm | G | Em7 | Asus4:2 A:2',
        melody: 'B4:1 D5:1 E5:1 F#5:1 | F#5:2 D5:1 B4:1 | C#5:3 A4:1 | A4:2 r:2 | B4:1 D5:1 E5:1 F#5:1 | G5:2 F#5:1 D5:1 | E5:1.5 D5:0.5 C#5:1 B4:1 | E5:4',
        arp: { inst: 'harp', pat: '0 . 2 3 . 2 1 .', vel: 0.8 },
        bass: 'B1:3 F#2:1 | G1:3 D2:1 | F#2:4 | A1:3 E2:1 | B1:3 F#2:1 | G1:3 D2:1 | E2:4 | A1:4' },
      A3: { like: 'A2', dyn: 0.72, to: 0.78, arp: { inst: 'harp', pat: '0 . 2 . 3 . 2 .', vel: 0.7 },
        counter: 'r:4 | r:2 D6:2 | r:4 | r:2 C#6:2 | r:4 | r:2 B5:2 | r:4 | A5:4', ctr: 'bell' },
      C: { bars: 8, dyn: 0.5, to: 0.55, chords: 'Gmaj7 | F#m7 | Em7 | A | Gmaj7 | F#m7 | Bm7 | B7sus4:2 B7:2', mel: 'glass',
        melody: 'r:1 B5:1 A5:1 F#5:1 | A5:3 r:1 | r:1 G5:1 F#5:1 E5:1 | E5:3 r:1 | r:1 B5:1 A5:1 F#5:1 | C#6:3 r:1 | D6:2 B5:1 F#5:1 | A5:2 F#5:2',
        bass: 'G1:4 | F#2:4 | E2:4 | A1:4 | G1:4 | F#2:4 | B1:4 | B1:4' },
      A4: { like: 'A2', transpose: 2, dyn: 0.8, to: 0.85, arp: { inst: 'harp', pat: '0 . 2 3 . 2 1 .', vel: 0.75 },
        counter: 'r:4 | r:2 D6:2 | r:4 | r:2 C#6:2 | r:4 | r:2 B5:2 | r:4 | A5:4', ctr: 'bell' },
      outro: { bars: 6, transpose: 2, dyn: 0.6, to: 0.35, chords: 'D | Bm7 | Gmaj7 | Asus4:2 A:2 | D | D',
        melody: 'A5:1 F#5:1 E5:1.5 D5:0.5 | E5:4 | r:1 D5:1 E5:1 F#5:1 | E5:4 | A5:1 F#5:1 E5:1.5 D5:0.5 | D5:4',
        bass: 'D2:4 | B1:4 | G1:4 | A1:4 | D2:4 | D2:4' }
    } },

  // ---------------------------------------------------------------- SEA GLASS MORNING: tide pools (a waltz, G major, then A)
  { id: 'tide_pools', places: ['tide_pools', 'mangrove'], time: 'day', bpm: 96, meter: 3, lead: 'marimba', counter: 'bell', bass: 'bass', pad: true, ring: 6, echo: 1,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.4, to: 0.5, chords: 'G | C | G | D',
        counter: 'D5:1 B4:1 A4:1 | G4:1 A4:2 | r:3 | r:3', ctr: 'harp',
        arp: { inst: 'harp', pat: '. 1 2', vel: 0.7 }, bass: 'G2:3 | C2:3 | G2:3 | D2:3' },
      A: { bars: 16, dyn: 0.55, to: 0.62, chords: 'G | G | C | G | Em | Am7 | D | D | G | G | C | Cm6 | G/D | D7 | G | G',
        melody: 'B4:2 D5:1 | G5:2 F#5:1 | E5:1 D5:1 C5:1 | D5:3 | B4:2 E5:1 | E5:1 D5:1 C5:1 | A4:2 B4:1 | A4:3 | B4:2 D5:1 | G5:2 A5:1 | G5:1 E5:1 C5:1 | Eb5:2 C5:1 | B4:2 D5:1 | C5:1 A4:1 F#4:1 | G4:3 | r:3',
        arp: { inst: 'harp', pat: '. 1 2', vel: 0.7 },
        bass: 'G2:2 D2:1 | G2:2 B1:1 | C2:2 G2:1 | G2:2 D2:1 | E2:2 B1:1 | A1:2 E2:1 | D2:2 A1:1 | D2:2 F#2:1 | G2:2 D2:1 | G2:2 B1:1 | C2:2 G2:1 | C2:2 Eb2:1 | D2:3 | D2:2 C2:1 | G1:3 | G1:3' },
      A2: { like: 'A', dyn: 0.62, to: 0.68,
        counter: 'r:3 | r:3 | r:1 G5:2 | B5:3 | r:3 | r:1 A5:2 | F#5:3 | r:3 | r:3 | r:3 | r:1 E5:2 | G5:3 | r:1 D5:2 | A5:3 | B5:3 | r:3' },
      B: { bars: 16, dyn: 0.62, to: 0.74, chords: 'Em | C | G | D | Em | C | Am7 | D | Em | C | G/B | Cmaj7 | Am7 | Bm7 | C | E7',
        melody: 'G5:2 F#5:1 | E5:3 | D5:2 B4:1 | A4:3 | G5:2 F#5:1 | E5:2 G5:1 | A5:2 G5:1 | F#5:3 | B5:2 A5:1 | G5:2 E5:1 | D5:3 | E5:2 B4:1 | C5:2 A4:1 | B4:2 D5:1 | E5:2 D5:1 | D5:1 B4:1 G#4:1',
        arp: { inst: 'harp', pat: '0 . 2', vel: 0.6 }, perc: { shaker: '.oo' },
        bass: 'E2:3 | C2:3 | G1:3 | D2:3 | E2:3 | C2:3 | A1:3 | D2:3 | E2:3 | C2:3 | B1:3 | C2:3 | A1:3 | B1:3 | C2:3 | E2:3' },
      A3: { like: 'A2', transpose: 2, dyn: 0.72, to: 0.78, perc: { shaker: '.oo' } },
      outro: { bars: 8, transpose: 2, dyn: 0.55, to: 0.3, chords: 'G | C | G | Cm6 | G/D | D7 | G | G',
        melody: 'B4:2 D5:1 | E5:3 | D5:2 B4:1 | Eb5:2 C5:1 | B4:2 A4:1 | A4:3 | G4:3 | G4:3',
        arp: { inst: 'harp', pat: '. 1 2', vel: 0.5 },
        bass: 'G2:3 | C2:3 | G2:3 | C2:3 | D2:3 | D2:3 | G1:3 | G1:3' }
    } },

  // ---------------------------------------------------------------- CORAL LANTERNS: the reef (E major, lydian colour)
  { id: 'coral', places: ['coral', 'ruins'], time: 'day', bpm: 76, meter: 4, lead: 'harp', counter: 'glass', bass: 'bass', pad: true, ring: 6,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'Emaj7 | F#/E | Emaj7 | F#/E',
        counter: 'r:2 B5:2 | A#5:4 | r:2 G#5:2 | F#5:4', bass: 'E2:4 | E2:4 | E2:4 | E2:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'Emaj7 | F#/E | Emaj7 | F#/E | C#m7 | Bsus4 B | Amaj7 | Bsus4:2 B:2',
        melody: 'B4:1 E5:1 G#5:2 | A#5:1.5 G#5:0.5 F#5:2 | E5:1 D#5:1 B4:2 | C#5:3 r:1 | E5:1 G#5:1 B5:1.5 A5:0.5 | G#5:2 F#5:2 | E5:1 C#5:1 G#4:2 | A4:2 F#4:1 r:1',
        bass: 'E2:4 | E2:4 | E2:4 | E2:4 | C#2:3 G#1:1 | B1:4 | A1:4 | B1:4' },
      A2: { like: 'A', dyn: 0.6, to: 0.66, chords: 'Emaj7 | F#/E | Emaj7 | F#/E | C#m7 | Bsus4 B | Amaj7 B7 | E',
        melody: 'B4:1 E5:1 G#5:2 | A#5:1.5 G#5:0.5 F#5:2 | E5:1 D#5:1 B4:2 | C#5:3 r:1 | E5:1 G#5:1 B5:1.5 A5:0.5 | G#5:2 F#5:2 | E5:1 C#5:1 B4:1 A4:1 | G#4:4',
        counter: 'r:2 E6:2 | r:4 | r:2 D#6:2 | r:4 | r:2 B5:2 | r:4 | r:2 A5:2 | G#5:4',
        bass: 'E2:4 | E2:4 | E2:4 | E2:4 | C#2:3 G#1:1 | B1:4 | A1:2 B1:2 | E2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.72, chords: 'C#m | A | E/G# | B | C#m | A | F#m7 | Bsus4:2 B:2',
        melody: 'B4:1 G#4:1 F#4:1.5 E4:0.5 | F#4:3 r:1 | G#4:1 B4:1 E5:1.5 D#5:0.5 | D#5:3 r:1 | E5:1 G#5:1 F#5:1.5 E5:0.5 | C#5:3 r:1 | A4:1 C#5:1 E5:1 F#5:1 | F#5:4',
        arp: { inst: 'marimba', pat: '0 . . 2 . 3 . .', vel: 0.8 },
        bass: 'C#2:3 G#1:1 | A1:4 | G#1:4 | B1:3 F#2:1 | C#2:3 G#1:1 | A1:4 | F#1:4 | B1:4' },
      A3: { like: 'A2', dyn: 0.72, to: 0.78, arp: { inst: 'marimba', pat: '0 . 2 . 3 . . .', vel: 0.7 } },
      outro: { bars: 4, dyn: 0.5, to: 0.3, chords: 'Emaj7 | F#/E | Emaj7 | Emaj7',
        melody: 'B4:1 E5:1 G#5:2 | A#5:1.5 G#5:0.5 F#5:2 | E5:4 | r:4', bass: 'E2:4 | E2:4 | E2:4 | E2:4' }
    } },

  // ---------------------------------------------------------------- GREEN CATHEDRAL: the kelp forest (D dorian)
  { id: 'kelp', places: ['kelp', 'mangrove'], time: 'any', bpm: 66, meter: 4, lead: 'piano', counter: 'harp', bass: 'bass', pad: true, ring: 6,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'Dm9 | G6/D | Dm9 | G6/D',
        arp: { inst: 'harp', pat: '0 . . 2 . . 3 .', vel: 0.7 }, bass: 'D2:4 | D2:4 | D2:4 | D2:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'Dm9 | G6/D | Dm9 | G6/D | Fmaj7 | C | Am7 | Asus4:2 A:2',
        melody: 'A5:1.5 G5:0.5 F5:1 E5:1 | D5:3 r:1 | A5:1.5 G5:0.5 F5:1 E5:1 | B5:3 r:1 | C6:1 A5:1 E5:2 | G5:2 E5:1 C5:1 | E5:1 G5:1 A5:1.5 C6:0.5 | B5:2 A5:2',
        arp: { inst: 'harp', pat: '0 . . 2 . . 3 .', vel: 0.6 },
        bass: 'D2:3 A1:1 | D2:3 B1:1 | D2:3 A1:1 | D2:3 B1:1 | F1:3 C2:1 | C2:3 G1:1 | A1:3 E2:1 | A1:4' },
      A2: { like: 'A', dyn: 0.6, to: 0.66, chords: 'Dm9 | G6/D | Dm9 | G6/D | Fmaj7 | C | Am7 | Dm9',
        melody: 'A5:1.5 G5:0.5 F5:1 E5:1 | D5:3 r:1 | A5:1.5 G5:0.5 F5:1 E5:1 | B5:3 r:1 | C6:1 A5:1 E5:2 | G5:2 E5:1 C5:1 | E5:1 G5:1 A5:1 G5:1 | E5:2 D5:2',
        counter: 'r:2 F4:2 | r:2 B4:2 | r:2 A4:2 | r:2 G4:2 | r:2 C5:2 | r:2 G4:2 | r:2 C5:2 | A4:4',
        bass: 'D2:3 A1:1 | D2:3 B1:1 | D2:3 A1:1 | D2:3 B1:1 | F1:3 C2:1 | C2:3 G1:1 | A1:3 E2:1 | D2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.72, chords: 'Fmaj7 | C/E | Dm7 | G | Fmaj7 | C/E | Em7 | Asus4:2 A:2', counter: '',
        melody: 'C6:1 A5:1 G5:1.5 F5:0.5 | G5:3 r:1 | F5:1 E5:1 D5:1.5 C5:0.5 | D5:3 r:1 | C6:1 A5:1 G5:1.5 F5:0.5 | G5:2 E5:2 | B5:1 A5:1 G5:1 E5:1 | E5:4',
        arp: { inst: 'harp', pat: '0 . 2 . 3 . . 1', vel: 0.7 },
        bass: 'F1:4 | E2:4 | D2:4 | G1:4 | F1:4 | E2:4 | E2:4 | A1:4' },
      A3: { like: 'A2', dyn: 0.72, to: 0.76, arp: { inst: 'harp', pat: '0 . 2 . 3 . 2 .', vel: 0.6 } },
      outro: { bars: 6, dyn: 0.55, to: 0.3, chords: 'Dm9 | G6/D | Fmaj7 | C | Dm9 | Dm9',
        melody: 'A5:1.5 G5:0.5 F5:1 E5:1 | D5:4 | C6:1 A5:1 E5:2 | G5:4 | A5:2 F5:1 E5:1 | D5:4',
        bass: 'D2:4 | D2:4 | F1:4 | C2:4 | D2:4 | D2:4' }
    } },

  // ---------------------------------------------------------------- BLUE MILE: the open ocean (C lydian, then D)
  { id: 'open_ocean', places: ['open_ocean', 'ice'], time: 'any', bpm: 60, meter: 4, lead: 'bell', counter: 'piano', bass: 'sub', pad: true, ring: 8, echo: 1,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'Cmaj7 | D/C | Cmaj7 | D/C',
        counter: 'r:4 | r:2 A4:2 | r:4 | r:2 F#4:2', bass: 'C2:4 | C2:4 | C2:4 | C2:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'Cmaj7 | D/C | Cmaj7 | D/C | Em7 | Am7 | G | D/F#',
        melody: 'E5:2 G5:2 | F#5:3 r:1 | E5:1 D5:1 B4:2 | A4:4 | G5:2 B5:2 | A5:3 E5:1 | D5:2 B4:1 G4:1 | A4:3 r:1',
        bass: 'C2:4 | C2:4 | C2:4 | C2:4 | E2:4 | A1:4 | G1:4 | F#1:4' },
      A2: { like: 'A', dyn: 0.6, to: 0.66, chords: 'Cmaj7 | D/C | Cmaj7 | D/C | Em7 | Am7 | D | Cmaj7',
        melody: 'E5:2 G5:2 | F#5:3 r:1 | E5:1 D5:1 B4:2 | A4:4 | G5:2 B5:2 | A5:3 E5:1 | F#5:2 A5:2 | E5:4',
        counter: 'r:2 G4:2 | r:2 A4:2 | r:2 G4:2 | r:2 F#4:2 | r:2 B4:2 | r:2 C5:2 | r:2 A4:2 | r:2 G4:2',
        bass: 'C2:4 | C2:4 | C2:4 | C2:4 | E2:4 | A1:4 | D2:4 | C2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.7, chords: 'Am7 | Em7 | Fmaj7 | Cmaj7 | Am7 | Em7 | Dsus4 | D', counter: '',
        melody: 'G5:1 E5:1 D5:1.5 C5:0.5 | D5:3 r:1 | E5:2 A5:2 | G5:3 r:1 | G5:1 E5:1 D5:1.5 C5:0.5 | B4:3 r:1 | A4:2 D5:2 | F#5:4',
        arp: { inst: 'harp', pat: '0 . . 2 . . 3 .', vel: 0.6 },
        bass: 'A1:4 | E2:4 | F1:4 | C2:4 | A1:4 | E2:4 | D2:4 | D2:4' },
      A3: { like: 'A2', transpose: 2, dyn: 0.72, to: 0.76, arp: { inst: 'harp', pat: '0 . . 2 . . 3 .', vel: 0.55 } },
      outro: { bars: 6, transpose: 2, dyn: 0.5, to: 0.28, chords: 'Cmaj7 | D/C | Cmaj7 | D/C | Cmaj7 | Cmaj7',
        melody: 'E5:2 G5:2 | F#5:4 | E5:2 B4:2 | A4:4 | E5:4 | r:4', bass: 'C2:4 | C2:4 | C2:4 | C2:4 | C2:4 | C2:4' }
    } },

  // ---------------------------------------------------------------- LANTERN BELOW: the deep (A minor, a soft heartbeat)
  { id: 'deep', places: ['trench', 'vents', 'ruins'], time: 'any', bpm: 54, meter: 4, lead: 'piano', counter: 'glass', bass: 'sub', pad: true, ring: 8,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.3, to: 0.4, chords: 'Am | Fmaj7 | Am | Fmaj7',
        counter: 'r:2 E5:2 | r:4 | r:2 C5:2 | r:4', bass: 'A1:4 | F1:4 | A1:4 | F1:4' },
      A: { bars: 8, dyn: 0.45, to: 0.55, chords: 'Am | Fmaj7 | Am | Fmaj7 | Dm7 | Am/C | Bm7b5 | E7sus4:2 E:2',
        melody: 'r:1 E5:1 C5:1 A4:1 | C5:3 r:1 | r:1 E5:1 C5:1 A4:1 | E4:3 r:1 | F4:1 A4:1 C5:1 D5:1 | E5:3 r:1 | D5:1.5 C5:0.5 B4:2 | B4:2 r:2',
        bass: 'A1:4 | F1:4 | A1:4 | F1:4 | D2:4 | C2:4 | B1:4 | E2:4' },
      A2: { like: 'A', dyn: 0.55, to: 0.6, chords: 'Am | Fmaj7 | Am | Fmaj7 | Dm7 | Am/C | Dm7 E7 | Am',
        melody: 'r:1 E5:1 C5:1 A4:1 | C5:3 r:1 | r:1 E5:1 C5:1 A4:1 | E4:3 r:1 | F4:1 A4:1 C5:1 D5:1 | E5:3 r:1 | D5:1 C5:1 B4:1 G#4:1 | A4:4',
        counter: 'r:4 | r:2 G5:2 | r:4 | r:2 E5:2 | r:4 | r:2 G5:2 | r:4 | E5:4',
        bass: 'A1:4 | F1:4 | A1:4 | F1:4 | D2:4 | C2:4 | D2:2 E2:2 | A1:4' },
      B: { bars: 8, dyn: 0.55, to: 0.65, chords: 'C | G/B | Am7 | Em7 | Fmaj7 | C/E | Dm7 | E7sus4:2 E7:2', counter: '',
        melody: 'G4:1 E4:1 D4:1.5 C4:0.5 | D4:3 r:1 | E4:1 G4:1 A4:1.5 B4:0.5 | B4:3 r:1 | A4:1 C5:1 E5:1.5 D5:0.5 | C5:3 r:1 | F4:1 A4:1 D5:1 C5:1 | B4:4',
        perc: { kick: 'xo......' },
        bass: 'C2:4 | B1:4 | A1:4 | E2:4 | F1:4 | E2:4 | D2:4 | E2:4' },
      A3: { like: 'A2', dyn: 0.65, to: 0.7, perc: { kick: 'xo......' } },
      outro: { bars: 4, dyn: 0.45, to: 0.25, chords: 'Am | Fmaj7 | Dm7 | Am',
        melody: 'r:1 E5:1 C5:1 A4:1 | C5:4 | r:1 F4:1 A4:1 D5:1 | A4:4', bass: 'A1:4 | F1:4 | D2:4 | A1:4' }
    } },

  // ---------------------------------------------------------------- DRIP GARDEN: the caves (F major, then G)
  { id: 'cave', places: ['cave', 'lush_cave'], time: 'any', bpm: 63, meter: 4, lead: 'marimba', counter: 'glass', bass: 'bass', pad: true, ring: 6,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'Fmaj7 | Am7 | Bbmaj7 | C',
        arp: { inst: 'harp', pat: '0 . 2 . 3 . . .', vel: 0.7 }, bass: 'F2:4 | A1:4 | Bb1:4 | C2:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'Fmaj7 | Am7 | Bbmaj7 | C | Fmaj7 | Am7 | Gm7 | Csus4:2 C:2',
        melody: 'A5:0.5 C6:0.5 A5:1 G5:2 | E5:2 r:2 | F5:0.5 A5:0.5 F5:1 D5:2 | E5:3 r:1 | A5:0.5 C6:0.5 A5:1 G5:2 | C6:2 r:2 | Bb5:1 A5:1 G5:1 F5:1 | G5:4',
        perc: { clave: '....x.......o...' },
        bass: 'F2:3 C2:1 | A1:3 E2:1 | Bb1:3 F2:1 | C2:4 | F2:3 C2:1 | A1:3 E2:1 | G1:3 D2:1 | C2:4' },
      A2: { like: 'A', dyn: 0.6, to: 0.66, chords: 'Fmaj7 | Am7 | Bbmaj7 | C | Fmaj7 | Am7 | Gm7 C7 | F',
        melody: 'A5:0.5 C6:0.5 A5:1 G5:2 | E5:2 r:2 | F5:0.5 A5:0.5 F5:1 D5:2 | E5:3 r:1 | A5:0.5 C6:0.5 A5:1 G5:2 | C6:2 r:2 | Bb5:1 A5:1 G5:1 E5:1 | F5:4',
        counter: 'r:2 C6:2 | r:4 | r:2 D6:2 | r:4 | r:2 E6:2 | r:4 | r:2 Bb5:2 | A5:4',
        bass: 'F2:3 C2:1 | A1:3 E2:1 | Bb1:3 F2:1 | C2:4 | F2:3 C2:1 | A1:3 E2:1 | G1:2 C2:2 | F2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.7, chords: 'Dm7 | Bbmaj7 | Gm7 | C | Dm7 | Bbmaj7 | Gm7 | Dsus4:2 D:2', counter: '',
        melody: 'C6:1 A5:1 G5:1.5 F5:0.5 | G5:3 r:1 | Bb5:1 A5:1 G5:1.5 F5:0.5 | E5:3 r:1 | F5:1 A5:1 C6:1.5 D6:0.5 | D6:3 r:1 | Bb5:1 G5:1 D5:1 E5:1 | A5:4',
        arp: { inst: 'harp', pat: '0 . 2 . 3 . . 1', vel: 0.65 },
        bass: 'D2:4 | Bb1:4 | G1:4 | C2:4 | D2:4 | Bb1:4 | G1:4 | D2:4' },
      A3: { like: 'A2', transpose: 2, dyn: 0.7, to: 0.76, arp: { inst: 'harp', pat: '0 . 2 . 3 . . .', vel: 0.55 } },
      outro: { bars: 4, transpose: 2, dyn: 0.45, to: 0.25, chords: 'Fmaj7 | Bbmaj7 | Fmaj7 | Fmaj7',
        melody: 'A5:0.5 C6:0.5 A5:1 G5:2 | D5:2 E5:2 | F5:4 | r:4', bass: 'F2:4 | Bb1:4 | F2:4 | F2:4' }
    } },

  // ---------------------------------------------------------------- KITE WEATHER: the hill (a waltz, G major, then A)
  { id: 'hill', places: ['hill'], time: 'day', bpm: 104, meter: 3, lead: 'harp', counter: 'piano', bass: 'bass', pad: true, ring: 6, echo: 1,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.4, to: 0.5, chords: 'G | D/F# | Em | C', comp: { inst: 'piano', pat: '. x .', vel: 0.7 },
        bass: 'G2:3 | F#2:3 | E2:3 | C2:3' },
      A: { bars: 16, dyn: 0.55, to: 0.62, chords: 'G | D/F# | Em | C | G | D/F# | C | D | G | D/F# | Em | C | Am7 | D | G | G',
        melody: 'D5:1 G5:1 A5:1 | B5:2 A5:1 | G5:2 E5:1 | E5:3 | D5:1 G5:1 A5:1 | B5:2 D6:1 | C6:2 E5:1 | A5:3 | D5:1 G5:1 A5:1 | B5:2 A5:1 | G5:2 B5:1 | C6:3 | C6:2 B5:1 | A5:3 | G5:3 | r:3',
        comp: { inst: 'piano', pat: '. x .', vel: 0.6 },
        bass: 'G2:3 | F#2:3 | E2:3 | C2:3 | G2:3 | F#2:3 | C2:3 | D2:3 | G2:3 | F#2:3 | E2:3 | C2:3 | A1:3 | D2:3 | G1:3 | G1:3' },
      A2: { like: 'A', dyn: 0.62, to: 0.68,
        counter: 'r:3 | r:3 | B4:3 | G4:3 | r:3 | r:3 | E4:3 | F#4:3 | r:3 | r:3 | B4:3 | G4:3 | A4:3 | F#4:3 | D4:3 | r:3' },
      B: { bars: 16, dyn: 0.62, to: 0.74, chords: 'Em | C | G | D | Em | C | Am7 | D | Em | C | G/B | C | Am7 | Bm7 | C | E7',
        melody: 'D5:1 B4:1 A4:1 | G4:1 A4:2 | B4:2 D5:1 | A4:3 | D5:1 B4:1 A4:1 | G4:1 E5:2 | E5:2 D5:1 | F#5:3 | G5:2 F#5:1 | E5:3 | D5:2 B4:1 | C5:2 E5:1 | E5:2 C5:1 | D5:2 F#5:1 | G5:2 E5:1 | G#5:3',
        comp: { inst: 'piano', pat: '. x x', vel: 0.45 }, perc: { shaker: '.oo' },
        bass: 'E2:3 | C2:3 | G1:3 | D2:3 | E2:3 | C2:3 | A1:3 | D2:3 | E2:3 | C2:3 | B1:3 | C2:3 | A1:3 | B1:3 | C2:3 | E2:3' },
      A3: { like: 'A2', transpose: 2, dyn: 0.72, to: 0.78, comp: { inst: 'piano', pat: '. x x', vel: 0.45 }, perc: { shaker: '.oo' } },
      outro: { bars: 8, transpose: 2, dyn: 0.55, to: 0.3, chords: 'G | D/F# | C | D | G | C | G | G',
        melody: 'D5:1 G5:1 A5:1 | B5:2 A5:1 | G5:2 E5:1 | A5:3 | B5:2 A5:1 | E5:3 | G5:3 | r:3',
        comp: { inst: 'piano', pat: '. x .', vel: 0.5 },
        bass: 'G2:3 | F#2:3 | C2:3 | D2:3 | G2:3 | C2:3 | G1:3 | G1:3' }
    } },

  // ---------------------------------------------------------------- ORBIT GARDEN: the station (E major, chip sparkles)
  { id: 'station', places: ['station', 'aquarium'], time: 'any', bpm: 70, meter: 4, lead: 'bell', counter: 'harp', bass: 'bass', pad: true, ring: 8,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'E | G#m7 | A | Bsus4:2 B:2',
        arp: { inst: 'chip', pat: '0+ . 2+ . 3+ . 2+ .', vel: 0.6 }, bass: 'E2:4 | G#1:4 | A1:4 | B1:4' },
      A: { bars: 8, dyn: 0.5, to: 0.6, chords: 'E | G#m7 | A | E/G# | F#m7 | B | C#m7 | Bsus4:2 B:2',
        melody: 'G#4:1 B4:1 E5:2 | D#5:2 B4:2 | C#5:1 B4:1 A4:2 | G#4:3 r:1 | F#4:1 A4:1 C#5:2 | B4:2 D#5:2 | E5:1 C#5:1 G#4:2 | F#4:4',
        bass: 'E2:4 | G#1:4 | A1:4 | G#1:4 | F#1:4 | B1:4 | C#2:4 | B1:4' },
      A2: { like: 'A', dyn: 0.6, to: 0.66, chords: 'E | G#m7 | A | E/G# | F#m7 | B | C#m7 B7 | E',
        melody: 'G#4:1 B4:1 E5:2 | D#5:2 B4:2 | C#5:1 B4:1 A4:2 | G#4:3 r:1 | F#4:1 A4:1 C#5:2 | B4:2 D#5:2 | E5:1 C#5:1 B4:1 A4:1 | G#4:4',
        counter: 'r:2 B3:2 | r:2 D#4:2 | r:2 E4:2 | r:2 B3:2 | r:2 C#4:2 | r:2 D#4:2 | r:2 D#4:2 | E4:4',
        arp: { inst: 'chip', pat: '0+ . 2+ . 3+ . 2+ .', vel: 0.5 },
        bass: 'E2:4 | G#1:4 | A1:4 | G#1:4 | F#1:4 | B1:4 | C#2:2 B1:2 | E2:4' },
      B: { bars: 8, dyn: 0.6, to: 0.7, chords: 'C#m | A | E | B | C#m | A | F#m7 | Bsus4:2 B:2', counter: '',
        melody: 'B4:1 G#4:1 F#4:1.5 E4:0.5 | F#4:3 r:1 | E5:1 B4:1 G#4:1.5 E4:0.5 | F#4:3 r:1 | B4:1 G#4:1 F#4:1.5 E4:0.5 | A4:2 C#5:2 | E5:2 C#5:1 A4:1 | B4:4',
        arp: { inst: 'harp', pat: '0 . 2 . 3 . . .', vel: 0.65 },
        bass: 'C#2:4 | A1:4 | E2:4 | B1:4 | C#2:4 | A1:4 | F#1:4 | B1:4' },
      A3: { like: 'A2', dyn: 0.7, to: 0.76 },
      outro: { bars: 4, dyn: 0.45, to: 0.25, chords: 'E | A | E | E',
        melody: 'G#4:1 B4:1 E5:2 | C#5:2 B4:2 | E4:4 | r:4', bass: 'E2:4 | A1:4 | E2:4 | E2:4' }
    } },

  // ---------------------------------------------------------------- MOON POOL: night (B flat major, soft chiptune)
  { id: 'night', places: ['tide_pools', 'coral', 'ruins', 'open_ocean', 'vents', 'trench', 'kelp', 'mangrove', 'ice', 'cave', 'lush_cave', 'hill', 'station', 'aquarium'],
    time: 'night', bpm: 64, meter: 4, lead: 'chip', counter: 'piano', bass: 'sub', pad: true, ring: 8,
    form: ['intro', 'A', 'A2', 'B', 'A3', 'outro'],
    sections: {
      intro: { bars: 4, dyn: 0.35, to: 0.45, chords: 'Bbmaj7 | Gm7 | Ebmaj7 | Fsus4:2 F:2',
        arp: { inst: 'chip', pat: '0+ . . 2+ . . 3+ .', vel: 0.5 }, bass: 'Bb1:4 | G1:4 | Eb2:4 | F1:4' },
      A: { bars: 8, dyn: 0.5, to: 0.58, chords: 'Bbmaj7 | Gm7 | Ebmaj7 | F | Bbmaj7 | Dm7 | Ebmaj7 | Fsus4:2 F:2',
        melody: 'D5:1 F5:1 C6:1.5 Bb5:0.5 | Bb5:2 r:2 | G5:1 Bb5:1 D6:2 | C6:3 r:1 | D5:1 F5:1 C6:1.5 Bb5:0.5 | A5:2 F5:2 | G5:1 Bb5:1 Eb6:1 D6:1 | C6:4',
        bass: 'Bb1:4 | G1:4 | Eb2:4 | F1:4 | Bb1:4 | D2:4 | Eb2:4 | F1:4' },
      A2: { like: 'A', dyn: 0.58, to: 0.64, chords: 'Bbmaj7 | Gm7 | Ebmaj7 | F | Bbmaj7 | Dm7 | Ebmaj7 F7 | Bb',
        melody: 'D5:1 F5:1 C6:1.5 Bb5:0.5 | Bb5:2 r:2 | G5:1 Bb5:1 D6:2 | C6:3 r:1 | D5:1 F5:1 C6:1.5 Bb5:0.5 | A5:2 F5:2 | G5:1 Bb5:1 A5:1 Eb5:1 | D5:4',
        counter: 'r:2 F4:2 | r:2 D4:2 | r:2 Eb4:2 | r:2 C4:2 | r:2 F4:2 | r:2 D4:2 | r:2 C4:2 | Bb3:4',
        bass: 'Bb1:4 | G1:4 | Eb2:4 | F1:4 | Bb1:4 | D2:4 | Eb2:2 F1:2 | Bb1:4' },
      B: { bars: 8, dyn: 0.58, to: 0.66, chords: 'Gm7 | Ebmaj7 | Bb/D | F | Gm7 | Ebmaj7 | Cm7 | Fsus4:2 F:2', counter: '', mel: 'piano',
        melody: 'F5:1 D5:1 C5:1.5 Bb4:0.5 | C5:3 r:1 | D5:1 F5:1 Bb5:1.5 A5:0.5 | A5:3 r:1 | F5:1 D5:1 C5:1.5 Bb4:0.5 | G5:2 Bb5:2 | G5:1 F5:1 Eb5:1 D5:1 | C5:4',
        arp: { inst: 'harp', pat: '0 . 2 . 3 . . .', vel: 0.6 },
        bass: 'G1:4 | Eb2:4 | D2:4 | F1:4 | G1:4 | Eb2:4 | C2:4 | F1:4' },
      A3: { like: 'A2', dyn: 0.64, to: 0.68, arp: { inst: 'chip', pat: '0+ . . 2+ . . 3+ .', vel: 0.4 } },
      outro: { bars: 4, dyn: 0.45, to: 0.25, chords: 'Bbmaj7 | Ebmaj7 | Bbmaj7 | Bbmaj7',
        melody: 'D5:1 F5:1 C6:1.5 Bb5:0.5 | Bb5:2 G5:2 | F5:2 D5:2 | r:4', bass: 'Bb1:4 | Eb2:4 | Bb1:4 | Bb1:4' }
    } }
];
