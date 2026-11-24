// Rare migrations across the open ocean (src/migrations.js): never caught, just watched. Names, field notes
// and the line when one is first seen: migration.<id>.* and lore.sight_<id>.* in data/lang/en.js.
//
//   season    the season it's most often seen in (src/seasons.js; seasonFavour times as likely then)
//   count     how many cross together, one behind the other (spacing: px between them, by `gap`)
//   speed     px a second;  y: the depth band it crosses at (world px)
//   sound     what the hydrophone hears (a sound id in the 'hydro' group, src/sfx.js), every `callEvery` seconds
//   size      how big it's drawn (1 = as designed)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.migrations = {
  order: ['whale', 'mantas', 'turtles'],
  area: [2440, 3960],         // the open ocean, where they cross (they start and end out of sight beyond it)
  kinds: {
    whale:   { season: 'winter', count: 1, gap: 0,  speed: 16, y: [300, 470], sound: 'whale_song', callEvery: [7, 11], size: 1 },
    mantas:  { season: 'summer', count: 5, gap: 34, speed: 30, y: [160, 300], sound: 'manta_glide', callEvery: [5, 8], size: 1 },
    turtles: { season: 'autumn', count: 4, gap: 26, speed: 14, y: [130, 230], sound: 'turtle_note', callEvery: [4, 7], size: 1 }
  }
};
