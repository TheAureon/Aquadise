// Your own songs (audio files) for the game to play as DELTA songs, alongside the built-in ones: the same
// frequency setting, NOW PLAYING toast, jukebox and Sound Test. How to add one: docs/ADDING_MUSIC.md.
//
// One line per song:
//   { title: 'MY SONG', file: 'assets/music/my-song.mp3', place: 'kelp', time: 'any' },
//   title   its name, as the game shows it (capital letters read best in the game's font)
//   file    where it is, from the game's folder (ogg or mp3)
//   place   where it plays: title, hill, station, aquarium, tide_pools, coral, ruins, open_ocean, vents,
//           trench, kelp, mangrove, ice, cave, lush_cave (or several: places: ['kelp', 'mangrove'])
//   time    'day', 'night' or 'any' (night songs only play at night, day songs only by day)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.musicFiles = [
  // { title: 'MY SONG', file: 'assets/music/my-song.mp3', place: 'kelp', time: 'any' },
];
