// STATION REQUESTS: small friendly goals the station's directory console sends by radio, one at a time.
// There are no rewards: completing or ignoring one changes nothing about the game (just a nice moment).
// The engine is src/quests.js (AQ.Quests); the words are in data/lang/en.js:
//   quest.<id>          the request on the tracker (short: one or two lines)
//   quest.<id>.intro    the radio message that brings it (warm, a little cheeky, never bossy)
//   quest.<id>.thanks   the thank-you line when it's done
//   quest.<id>.progress (optional) how the count reads, e.g. '{n}/{target} SPECIES' (default '{n}/{target}')
//   quest.chapter.<chapter>   the chapter's name
//
// Fields
//   id        unique id (saved; never rename one that has shipped)
//   chapter   one of AQ.data.questChapters (requests come in the order they're listed here)
//   icon      a badge icon: shell | fish | heart | egg | bottle | moon | star | camera | crown | ear
//   cond      what completes it: the SAME kinds of condition as the badges (data/achievements.js), read from
//             the badge system's own counters, checks and events (nothing is counted twice):
//     { counter: 'chests' }                  a number the badge system keeps
//     { check: 'discovered', where: {...} }  worked out from the save (CHECKS in src/achievements.js)
//     { event: 'catch', match: {...}, also } a moment (AQ.Badges.event); `also` = a check that shows it
//                                            already happened (so an older save, or a request that comes up
//                                            later, sees it), with its own target
//   target    the number to reach for counters and checks (shown as a count, "2/3", when it's above 1)
//   after     (optional) another request that must be done first
//   needs     (optional) a feature the build must have (an AQ module name, like the Guide's pages)
//   tank      (optional) the request is about a tank: true = the tank you were last at, or a tank id; that
//             tank's window in the station sparkles softly the next time it's on screen
//   requires  (optional) a condition that must already hold before it's offered (e.g. having the hydrophone),
//             so nothing is ever asked that the player can't do yet
// Every request must be possible for anyone, at any time, without luck (tools/check-quests.js checks it):
// no rare variants, no Comet Ray, no meteor showers, no specific chest reward. Time of day is fine.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.questChapters = ['first', 'home', 'pairs', 'sky', 'tinker', 'listen', 'collect'];

AQ.data.quests = [
  // ------------------------------------------------------------------ 1. FIRST DIVE
  { id: 'first_catch', chapter: 'first', icon: 'fish', cond: { check: 'caught' }, target: 1 },
  { id: 'sneak_catch', chapter: 'first', icon: 'fish', cond: { event: 'catch', match: { sneaking: true }, also: { check: 'badge', badge: 'sneaky_steps', target: 1 } } },
  { id: 'two_species', chapter: 'first', icon: 'fish', cond: { check: 'caught' }, target: 2 },
  { id: 'open_log', chapter: 'first', icon: 'bottle', cond: { event: 'log', also: { check: 'badge', badge: 'open_book', target: 1 } } },
  { id: 'bait_catch', chapter: 'first', icon: 'fish', cond: { event: 'catch', match: { bait: true }, also: { check: 'badge', badge: 'snack_time', target: 1 } } },
  { id: 'bottle', chapter: 'first', icon: 'bottle', needs: 'Bottles', cond: { check: 'bottles' }, target: 1 },

  // ------------------------------------------------------------------ 2. HOME
  { id: 'ufo', chapter: 'home', icon: 'star', cond: { event: 'ufo', also: { check: 'flag', flag: 'visitedStation', target: 1 } } },
  { id: 'open_tank', chapter: 'home', tank: true, icon: 'heart', after: 'ufo', cond: { event: 'tank', also: { check: 'badge', badge: 'window_shopping', target: 1 } } },
  { id: 'decor', chapter: 'home', tank: true, icon: 'heart', after: 'open_tank', cond: { event: 'decor', also: { check: 'decorInTanks', target: 1 } } },
  { id: 'feed', chapter: 'home', tank: true, icon: 'heart', after: 'open_tank', cond: { event: 'feed', also: { check: 'fedAny', target: 1 } } },
  { id: 'decor_five', chapter: 'home', tank: true, icon: 'heart', after: 'decor', cond: { counter: 'decorPlaced' }, target: 5 },
  { id: 'two_stars', chapter: 'home', tank: true, icon: 'star', after: 'open_tank', cond: { check: 'bestStars' }, target: 2 },

  // ------------------------------------------------------------------ 3. PAIRS
  { id: 'both_sexes', chapter: 'pairs', icon: 'heart', needs: 'Sex', cond: { check: 'bothSexes' }, target: 1 },
  { id: 'pair_tank', chapter: 'pairs', tank: true, icon: 'heart', needs: 'Sex', after: 'both_sexes', cond: { check: 'pairsInTanks' }, target: 1 },
  { id: 'court', chapter: 'pairs', tank: true, icon: 'heart', needs: 'Breeding', after: 'pair_tank', cond: { event: 'court', also: { check: 'bred', target: 1 } } },
  { id: 'baby', chapter: 'pairs', tank: 'nursery', icon: 'egg', needs: 'Breeding', after: 'court', cond: { counter: 'births' }, target: 1 },
  { id: 'graduate', chapter: 'pairs', tank: 'nursery', icon: 'egg', needs: 'Nursery', after: 'baby', cond: { check: 'graduates' }, target: 1 },
  { id: 'five_pairs', chapter: 'pairs', icon: 'heart', needs: 'Sex', after: 'both_sexes', cond: { check: 'bothSexes' }, target: 5 },

  // ------------------------------------------------------------------ 4. NIGHT AND SKY
  { id: 'night', chapter: 'sky', icon: 'moon', cond: { event: 'night', also: { check: 'nights', target: 1 } } },
  { id: 'night_catch', chapter: 'sky', icon: 'moon', cond: { check: 'discovered', where: { active: 'night' } }, target: 1 },
  { id: 'night_bloom', chapter: 'sky', icon: 'moon', cond: { check: 'discovered', where: { bloom: 'night' } }, target: 1 },
  { id: 'shooting_star', chapter: 'sky', icon: 'star', needs: 'ShootingStars', cond: { counter: 'shootingStars' }, target: 1 },
  { id: 'fallen_star', chapter: 'sky', icon: 'star', needs: 'Starfall', cond: { counter: 'starsFound', also: { check: 'discovered', where: { biome: 'starfall' }, target: 1 } }, target: 1 },
  { id: 'sunrise', chapter: 'sky', icon: 'moon', cond: { event: 'sunrise', also: { check: 'badge', badge: 'early_bird', target: 1 } } },

  // ------------------------------------------------------------------ 5. TINKERING
  { id: 'chests', chapter: 'tinker', icon: 'bottle', needs: 'Chests', cond: { counter: 'chests' }, target: 3 },
  { id: 'photo', chapter: 'tinker', tank: true, icon: 'camera', after: 'open_tank', cond: { event: 'photo', also: { check: 'badge', badge: 'say_cheese', target: 1 } } },
  { id: 'four_stars', chapter: 'tinker', tank: true, icon: 'star', after: 'two_stars', cond: { check: 'bestStars' }, target: 4 },
  { id: 'one_pair', chapter: 'tinker', tank: true, icon: 'heart', needs: 'Pairs', after: 'open_tank', cond: { event: 'onePair', also: { check: 'badge', badge: 'tidy_up', target: 1 } } },
  { id: 'expand', chapter: 'tinker', tank: true, icon: 'shell', needs: 'Panes', after: 'open_tank', cond: { check: 'expanded' }, target: 1 },

  // ------------------------------------------------------------------ 6. LISTENING
  { id: 'chime_shrimp', chapter: 'listen', icon: 'ear', needs: 'Hydro', cond: { check: 'discovered', where: { id: 'chime_shrimp' } }, target: 1 },
  { id: 'listen', chapter: 'listen', icon: 'ear', needs: 'Hydro', requires: { check: 'upgrade', upgrade: 'hydro', target: 1 }, cond: { counter: 'listens' }, target: 1 },
  { id: 'caller', chapter: 'listen', icon: 'ear', needs: 'Hydro', after: 'listen', requires: { check: 'upgrade', upgrade: 'hydro', target: 1 },
    cond: { event: 'catch', match: { caller: true, hydro: true }, also: { check: 'badge', badge: 'good_ears', target: 1 } } },

  // ------------------------------------------------------------------ 7. COLLECTING
  { id: 'ribbonmane', chapter: 'collect', icon: 'fish', cond: { check: 'discovered', where: { id: 'ribbonmane' } }, target: 1 },
  { id: 'species10', chapter: 'collect', icon: 'fish', cond: { check: 'discovered' }, target: 10 },
  { id: 'places5', chapter: 'collect', icon: 'shell', cond: { counter: 'biomes' }, target: 5 },
  { id: 'species25', chapter: 'collect', icon: 'fish', after: 'species10', cond: { check: 'discovered' }, target: 25 },
  { id: 'biome_done', chapter: 'collect', icon: 'shell', cond: { check: 'biomesComplete' }, target: 1 },
  { id: 'predator_done', chapter: 'collect', icon: 'fish', cond: { check: 'predatorTanksComplete' }, target: 1 },
  { id: 'fill_tanks', chapter: 'collect', icon: 'heart', after: 'open_tank', cond: { check: 'tanksWith' }, target: 3 },
  { id: 'species50', chapter: 'collect', icon: 'crown', after: 'species25', cond: { check: 'discovered' }, target: 50 }
];
