// Badges (achievements). One entry per badge; the name and description are text in data/lang/en.js:
// badge.<id>.name and badge.<id>.desc ({n} = the target). The engine is src/achievements.js (AQ.Badges).
// Nothing here changes gameplay: badges are never missable, timed, lost or required for anything.
//
// Fields
//   id        unique id (saved; never rename one that has shipped)
//   group     first | collect | aquarium | breed | explore | sky | skill | final   (headings: badge.group.<group>)
//   icon      the icon's picture: shell | fish | heart | egg | bottle | moon | star | camera | crown | ear | secret
//             (sprite 'badge.<icon>', tools/gen-placeholders.js)
//   hidden    true = shown as "???" until earned
//   reward    reserved for cosmetic rewards later (unused for now; leave null)
//   cond      what earns it. Three kinds:
//     { counter: 'chests' }                 a number the game keeps (AQ.Badges.add('chests')); a "set" counter
//                                           (AQ.Badges.addTo('biomes', id)) counts its distinct members
//     { check: 'discovered', where: {...} } worked out from the save (see CHECKS in src/achievements.js);
//                                           `where` matches species fields (e.g. { biome: 'coral' })
//     { event: 'catch', match: {...} }      a one-time event (AQ.Badges.event('catch', { sneaking: true }))
//                                           whose details match; `also` = a check that earns it too
//                                           (an older save that already did it), with its own target
//   target    the number to reach for counters and checks ('all' = everything the check can count)
//   tiers     instead of target: [{ target }, ...] in rising order: one badge with levels (I, II, III...);
//             a tier may have its own name (badge.<id>.tier<k>, k from 1), else "<name> II"
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.badges = [
  // ------------------------------------------------------------------ FIRST STEPS
  { id: 'first_splash', group: 'first', icon: 'shell', cond: { event: 'swim', also: { check: 'caught', target: 1 } } },
  { id: 'first_catch', group: 'first', icon: 'fish', cond: { event: 'catch', also: { check: 'caught', target: 1 } } },
  { id: 'sneaky_steps', group: 'first', icon: 'fish', cond: { event: 'catch', match: { sneaking: true } } },
  { id: 'snack_time', group: 'first', icon: 'fish', cond: { event: 'catch', match: { bait: true } } },
  { id: 'open_book', group: 'first', icon: 'bottle', cond: { event: 'log', also: { check: 'tipSeen', tip: 'log', target: 1 } } },
  { id: 'beam_me_up', group: 'first', icon: 'star', cond: { event: 'ufo', also: { check: 'flag', flag: 'visitedStation', target: 1 } } },
  { id: 'window_shopping', group: 'first', icon: 'heart', cond: { event: 'tank', also: { check: 'tipSeen', tip: 'tank', target: 1 } } },
  { id: 'home_decor', group: 'first', icon: 'heart', cond: { event: 'decor', also: { check: 'decorInTanks', target: 1 } } },
  { id: 'dinner_bell', group: 'first', icon: 'heart', cond: { event: 'feed', also: { check: 'fedAny', target: 1 } } },

  // ------------------------------------------------------------------ COLLECTING
  { id: 'collector', group: 'collect', icon: 'fish', cond: { check: 'discovered' }, tiers: [{ target: 10 }, { target: 25 }, { target: 50 }, { target: 'all' }] },
  { id: 'tide_pool_pro', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'tide_pools' } }, target: 'all' },
  { id: 'reef_regular', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'coral' } }, target: 'all' },
  { id: 'kelp_keeper', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'kelp' } }, target: 'all' },
  { id: 'deep_dweller', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'trench' } }, target: 'all' },
  { id: 'cave_crawler', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'cave' } }, target: 'all' },
  { id: 'open_water_wanderer', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'open_ocean' } }, target: 'all' },
  { id: 'ruin_rummager', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'ruins' } }, target: 'all' },
  { id: 'vent_voyager', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'vents' } }, target: 'all' },
  { id: 'mangrove_mate', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'mangrove' } }, target: 'all' },
  { id: 'ice_explorer', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'ice' } }, target: 'all' },
  { id: 'lush_cave_lounger', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { biome: 'lush_cave' } }, target: 'all' },
  { id: 'predator_pals', group: 'collect', icon: 'fish', cond: { check: 'discovered', where: { predator: true } }, target: 'all' },
  { id: 'stardust_keeper', group: 'collect', icon: 'star', cond: { check: 'discovered', where: { biome: 'starfall' } }, target: 'all' },
  { id: 'night_owls', group: 'collect', icon: 'moon', cond: { check: 'discovered', where: { active: 'night' } }, target: 'all' },
  { id: 'green_thumb', group: 'collect', icon: 'shell', cond: { check: 'discovered', where: { is_plant: true } }, target: 'all' },
  { id: 'two_of_a_kind', group: 'collect', icon: 'heart', cond: { check: 'bothSexes' }, target: 1 },
  { id: 'matching_set', group: 'collect', icon: 'heart', cond: { check: 'bothSexes' }, target: 10 },
  { id: 'perfect_pairs', group: 'collect', icon: 'heart', cond: { check: 'bothSexes' }, target: 'all' },
  { id: 'rainbow_axolotl', group: 'collect', icon: 'fish', cond: { check: 'discovered', where: { family: 'axolotl' } }, target: 'all' },
  { id: 'gold_standard', group: 'collect', icon: 'crown', cond: { check: 'discovered', where: { id: 'aurum_axolotl' } }, target: 'all' },

  // ------------------------------------------------------------------ AQUARIUM
  { id: 'first_star', group: 'aquarium', icon: 'star', cond: { check: 'bestStars' }, target: 1 },
  { id: 'three_stars', group: 'aquarium', icon: 'star', cond: { check: 'bestStars' }, target: 3 },
  { id: 'five_stars', group: 'aquarium', icon: 'star', cond: { check: 'bestStars' }, target: 5 },
  { id: 'full_marks', group: 'aquarium', icon: 'star', cond: { check: 'tanksAtStars', stars: 3 }, target: 'all' },
  { id: 'interior_designer', group: 'aquarium', icon: 'heart', cond: { counter: 'decorTypes' }, target: 25 },
  { id: 'decor_fanatic', group: 'aquarium', icon: 'heart', cond: { counter: 'decorPlaced' }, target: 100 },
  { id: 'happy_little_tank', group: 'aquarium', icon: 'heart', cond: { event: 'happyTank' } },
  { id: 'bigger_is_better', group: 'aquarium', icon: 'shell', cond: { check: 'expanded' }, target: 1 },
  { id: 'architect', group: 'aquarium', icon: 'shell', cond: { check: 'expanded' }, target: 5 },
  { id: 'glass_collector', group: 'aquarium', icon: 'shell', cond: { counter: 'panes' }, tiers: [{ target: 50 }, { target: 200 }] },
  { id: 'tidy_up', group: 'aquarium', icon: 'heart', cond: { event: 'onePair' } },
  { id: 'say_cheese', group: 'aquarium', icon: 'camera', cond: { event: 'photo' } },
  { id: 'photo_album', group: 'aquarium', icon: 'camera', cond: { check: 'photoTanks' }, target: 'all' },
  { id: 'just_vibing', group: 'aquarium', icon: 'heart', cond: { event: 'vibing' } },

  // ------------------------------------------------------------------ BREEDING
  { id: 'love_in_the_water', group: 'breed', icon: 'heart', cond: { event: 'court', also: { check: 'bred', target: 1 } } },
  { id: 'its_a_baby', group: 'breed', icon: 'egg', cond: { event: 'baby', also: { check: 'bred', target: 1 } } },
  { id: 'proud_parent', group: 'breed', icon: 'egg', cond: { counter: 'births' }, tiers: [{ target: 10 }, { target: 50 }] },
  { id: 'graduation_day', group: 'breed', icon: 'egg', cond: { check: 'graduates' }, target: 1 },
  { id: 'class_photo', group: 'breed', icon: 'camera', cond: { check: 'graduates' }, target: 25 },
  { id: 'rare_find', group: 'breed', icon: 'egg', cond: { check: 'variants' }, target: 1 },
  { id: 'rainbow_collector', group: 'breed', icon: 'egg', cond: { check: 'variants' }, tiers: [{ target: 5 }, { target: 15 }, { target: 'all' }] },
  { id: 'full_house', group: 'breed', icon: 'egg', cond: { check: 'bred' }, target: 'all' },

  // ------------------------------------------------------------------ EXPLORING
  { id: 'treasure_hunter', group: 'explore', icon: 'bottle', cond: { counter: 'chests' }, tiers: [{ target: 1 }, { target: 10 }, { target: 50 }] },
  { id: 'fully_geared', group: 'explore', icon: 'bottle', cond: { check: 'maxUpgrades' }, target: 'all' },
  { id: 'message_in_a_bottle', group: 'explore', icon: 'bottle', cond: { check: 'bottles' }, target: 1 },
  { id: 'bottle_collector', group: 'explore', icon: 'bottle', cond: { check: 'bottles' }, tiers: [{ target: 25 }, { target: 'all' }] },
  { id: 'deep_diver', group: 'explore', icon: 'shell', cond: { event: 'deepest' } },
  { id: 'globe_trotter', group: 'explore', icon: 'shell', cond: { counter: 'biomes' }, target: 'all' },
  { id: 'gull_whisperer', group: 'explore', icon: 'moon', cond: { counter: 'gulls' }, target: 10 },

  // ------------------------------------------------------------------ DAY, NIGHT AND SKY
  { id: 'first_night', group: 'sky', icon: 'moon', cond: { event: 'night', also: { check: 'nights', target: 1 } } },
  { id: 'wish_upon_a_star', group: 'sky', icon: 'star', cond: { event: 'catch', match: { starfall: true }, also: { check: 'discovered', where: { biome: 'starfall' }, target: 1 } } },
  { id: 'meteor_witness', group: 'sky', icon: 'star', cond: { event: 'shower' } },
  { id: 'comet_chaser', group: 'sky', icon: 'star', cond: { check: 'discovered', where: { id: 'comet_ray' } }, target: 'all' },
  { id: 'early_bird', group: 'sky', icon: 'moon', cond: { event: 'sunrise' } },
  { id: 'stargazer', group: 'sky', icon: 'star', cond: { counter: 'shootingStars' }, target: 20 },

  // ------------------------------------------------------------------ SKILL AND QUIRKS
  { id: 'gentle_hands', group: 'skill', icon: 'fish', cond: { counter: 'gentleStreak' }, target: 10 },
  { id: 'airborne', group: 'skill', icon: 'fish', cond: { check: 'discovered', where: { id: 'skyleap_flyfish' } }, target: 'all' },
  { id: 'dont_chase_the_light', group: 'skill', icon: 'moon', cond: { event: 'catch', match: { id: 'firefly_frog', lureStruck: false } } },
  { id: 'mirror_mirror', group: 'skill', icon: 'fish', cond: { check: 'discovered', where: { id: 'ribbonmane' } }, target: 'all' },
  { id: 'good_ears', group: 'skill', icon: 'ear', cond: { event: 'catch', match: { caller: true, hydro: true } } },
  { id: 'echo_hunter', group: 'skill', icon: 'ear', cond: { check: 'discovered', where: { id: 'echoshell_snail' } }, target: 'all' },
  { id: 'deep_listener', group: 'skill', icon: 'ear', cond: { check: 'upgrade', upgrade: 'hydro' }, target: 'all' },
  // hidden ("???" until earned)
  { id: 'enthusiastic', group: 'skill', icon: 'secret', hidden: true, cond: { event: 'nudgeSpam' } },
  { id: 'second_chances', group: 'skill', icon: 'secret', hidden: true, cond: { event: 'redo' } },

  // ------------------------------------------------------------------ THE FINAL GOAL (with a progress bar)
  { id: 'aquadise', group: 'final', icon: 'crown', cond: { check: 'aquadise' }, target: 'all' }
];

// every badge gets the reserved, unused `reward` field (cosmetic rewards could hang off it later)
AQ.data.badges.forEach((b) => { if (!('reward' in b)) b.reward = null; });
// the groups in order (the log's headings, the trophy wall's shelves)
AQ.data.badgeGroups = ['first', 'collect', 'aquarium', 'breed', 'explore', 'sky', 'skill', 'final'];
