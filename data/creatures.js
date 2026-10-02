// Creature + plant roster. Adding a creature = adding an entry here (and optionally real art).
//
// Fields
//   id, name, biome, category            identity (category: fish|gastropod|crustacean|amphibian|cephalopod|reptile|mammal|plant)
//   is_plant                             plants are harvested (not caught) and become decorations
//   catch_behavior                       reusable behaviour type (see src/behaviors.js); `params` tunes it
//   hostile, knockback                   knockback: none | light | strong
//   requires_upgraded_net                needs net level >= 2
//   draft                                true = not finalized in the design doc
//   rare                                 0..1 chance the spawn slot is occupied on each (re)spawn
//   predator                             lives in a predator tank (data/aquarium.js predatorTanks)
//   sexes                                optional: 'none' = no ♂/♀ (e.g. hermaphrodites). Default: male + female
//   mirror      (new) copies your swimming mirrored while you're near; hold still and it drifts in -> net it
//               params: range, calmTime, approach, mirror, wanderR
//   lure        (new) a glowing decoy bobs on a stalk; the real creature waits dim beside it (the decoy
//               can't be netted and flickers when you're close). params: decoyDist, decoyColor, alpha, glow
//   midair      (new) cruises under the surface and leaps out every few seconds; only nettable in the air
//               params: leapEvery [min,max], leap, speed, depth, wanderR
//   active                               optional 'night' | 'day': only out at those hours (default: always)
//   eggs                                 optional true/false: lays eggs when breeding (default: all but mammals)
//   sprite_size                          size class from data/sprite-spec.js
//   color, accent, art                   placeholder-art hints only (ignored once real art exists)
//   spawn                                { n, at: floor|water|surface|wall|ceiling|pool|ice_top|reef, area:[x0,x1], y:[y0,y1] }
//   light                                { r, color } emits light in dark biomes
//   tank                                 tank idle locomotion: swim | crawl | still (default from category)
//   hint                                 shown in the collection log
//   likes                                aquarium: decor/plant tags it enjoys being near (see data/decorations.js)
//   tags                                 plants only: what the plant counts as when placed in a tank
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.creatures = [
  // ------------------------------------------------------------------ Tide Pools / Shallows
  { id: 'saltbloom', tags: ['crystal'], name: 'Saltbloom', biome: 'tide_pools', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#f6e9ef', accent: '#f2a7c3', art: { shape: 'saltbloom' },
    spawn: { n: 6, at: 'ground', area: [0, 600] }, hint: 'Crystalline blooms that grow around the rock pools. Harvest with the net.' },
  { id: 'drift_snail', likes: ['plant', 'rock'], name: 'Drift Snail', biome: 'tide_pools', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.4, speed: 2.5, trail: '#e2f6ff' },
    sprite_size: 'tiny', color: '#b9a7d9', accent: '#e7dcf7', art: { shape: 'snail', glass: true },
    spawn: { n: 4, at: 'ground', area: [0, 700] }, hint: 'Slow and harmless. Look for its shimmering trail.' },
  { id: 'knuckle_crab', likes: ['rock', 'hideout'], name: 'Knuckle Crab', biome: 'tide_pools', category: 'crustacean', catch_behavior: 'wary',
    params: { reaction: 'hide', pry: true, alertR: 48, speed: 6, wanderR: 26 },
    sprite_size: 'small', color: '#c9573f', accent: '#e8885f', art: { shape: 'crab' },
    spawn: { n: 3, at: 'ground', area: [0, 700] }, hint: 'Sneak up (hold Shift). If it ducks into a crevice, hold the net to pry it out.' },
  { id: 'glasswinged_minnow', likes: ['plant', 'bubbles'], name: 'Glasswinged Minnow', biome: 'tide_pools', category: 'fish', catch_behavior: 'tidepool',
    params: { chance: 0.55, sneakBonus: 0.25 },
    sprite_size: 'tiny', color: '#bfe8f2', accent: '#ffffff', art: { shape: 'fish', wing: true },
    spawn: { n: 3, at: 'pool' }, hint: 'Lives in the little rock pools. Darting means one is inside: tap the pool with your net.' },
  { id: 'puddlejack', likes: ['rock', 'plant'], name: 'Puddlejack', biome: 'tide_pools', category: 'amphibian', catch_behavior: 'hopper',
    params: { restTime: [3, 6], hopTime: 0.9, alertR: 36 },
    sprite_size: 'small', color: '#6fae4a', accent: '#d8e88a', art: { shape: 'frog' },
    spawn: { n: 1, at: 'pool' }, hint: 'Hops between rock pools. Catch it resting or mid-hop.' },

  // ------------------------------------------------------------------ Kelp Forest
  { id: 'bladefin_perch', likes: ['kelp', 'plant'], name: 'Bladefin Perch', biome: 'kelp', category: 'fish', catch_behavior: 'school',
    params: { size: [5, 7], cover: true, speed: 18, alertR: 64 },
    sprite_size: 'small', color: '#8fa3b5', accent: '#d6e2ea', art: { shape: 'fish', stripes: true },
    spawn: { n: 2, at: 'water', y: [190, 360] }, hint: 'Hides in the kelp. Drop bait to draw the school into the open.' },
  { id: 'kelp_otter', likes: ['kelp', 'perch'], name: 'Kelp Otter', biome: 'kelp', category: 'mammal', catch_behavior: 'wary',
    params: { reaction: 'dive', bask: true, alertR: 60, carelessNoise: 0.5 },
    sprite_size: 'medium', color: '#7a5534', accent: '#d9b48a', art: { shape: 'otter' },
    spawn: { n: 2, at: 'surface' }, hint: 'Dozes at the surface. Easy if you sneak; dives if you rush it.' },
  { id: 'frond_squid', likes: ['kelp'], name: 'Frond Squid', biome: 'kelp', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.12, moveEvery: [3, 6], moveSpeed: 26 },
    sprite_size: 'small', color: '#7f9a3a', accent: '#b5cf62', art: { shape: 'squid' },
    spawn: { n: 3, at: 'water', y: [170, 370] }, hint: 'Camouflaged against kelp. Only visible when it moves.' },
  { id: 'coilback_newt', likes: ['kelp', 'wood'], name: 'Coilback Newt', biome: 'kelp', category: 'reptile', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 46, carelessNoise: 0.4, wanderR: 0, fleeSpeed: 75 },
    sprite_size: 'small', color: '#c46d3a', accent: '#f2c14e', art: { shape: 'lizard', spots: true },
    spawn: { n: 3, at: 'water', y: [200, 370] }, hint: 'Clings to kelp stalks. Slips away fast unless you approach slowly.' },
  { id: 'sandveil_skink', likes: ['rock', 'shell'], name: 'Sandveil Skink', biome: 'kelp', category: 'reptile', catch_behavior: 'camouflage',
    params: { buried: true, alpha: 0.06, moveEvery: [4, 8], moveTime: [0.5, 0.9], moveSpeed: 60 },
    sprite_size: 'small', color: '#c9b07a', accent: '#8f7a4a', art: { shape: 'lizard' }, tank: 'crawl',
    spawn: { n: 3, at: 'floor' }, hint: 'Buried in the sand, nearly invisible until it darts along the floor.' },
  { id: 'bell_kelp', tags: ['kelp'], name: 'Bell Kelp', biome: 'kelp', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'tall', color: '#6b8a2c', accent: '#c2b84a', art: { shape: 'kelp' },
    spawn: { n: 5, at: 'floor' }, hint: 'Kelp with bell-shaped floats.' },

  // ------------------------------------------------------------------ Coral Shelf
  { id: 'fanray_damsel', likes: ['coral', 'arch'], name: 'Fanray Damsel', biome: 'coral', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 50, fleeTime: [0.8, 1.3], wanderR: 22, speed: 14 },
    sprite_size: 'small', color: '#3a7bd5', accent: '#ffd35c', art: { shape: 'fish', fan: true },
    spawn: { n: 4, at: 'reef' }, hint: 'Territorial: when spooked it always circles back to the same coral. Wait there.' },
  { id: 'coral_whelk', likes: ['coral', 'rock'], name: 'Coral Whelk', biome: 'coral', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.28, speed: 2 },
    sprite_size: 'tiny', color: '#e88f9a', accent: '#f5c0a0', art: { shape: 'snail' },
    spawn: { n: 4, at: 'floor' }, hint: 'Blends into coral texture. Slow; finding it is the challenge.' },
  { id: 'pincer_hermit', likes: ['shell', 'rock'], name: 'Pincer Hermit', biome: 'coral', category: 'crustacean', catch_behavior: 'dart',
    params: { alertR: 48, runTime: [1, 1.6], pauseTime: [1.5, 2.3], runSpeed: 70, crawl: true },
    sprite_size: 'small', color: '#d9663f', accent: '#e8d0a8', art: { shape: 'hermit' },
    spawn: { n: 3, at: 'floor' }, hint: 'Scuttles off when startled. Net it while it pauses to fix its shell.' },
  { id: 'reef_mimic', likes: ['coral', 'hideout'], name: 'Reef Mimic', biome: 'coral', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.15, relocate: true, relocateAfter: 3.5, moveEvery: [6, 10], crawl: true },
    sprite_size: 'medium', color: '#e8806a', accent: '#f5b25c', art: { shape: 'octopus' },
    spawn: { n: 3, at: 'floor' }, hint: 'Imitates coral when still. Hesitate too long and it shifts away.' },
  { id: 'fire_coral', tags: ['coral'], name: 'Fire Coral', biome: 'coral', category: 'plant', is_plant: true, catch_behavior: 'plant',
    params: { sting: true }, knockback: 'light',
    sprite_size: 'small', color: '#ff6a3a', accent: '#ffd35c', art: { shape: 'branchcoral' },
    spawn: { n: 5, at: 'floor' }, hint: 'Stings if you harvest it in a hurry. Sneak up first.' },
  { id: 'ridgeback_basker', likes: ['perch', 'rock'], name: 'Ridgeback Basker', biome: 'coral', category: 'reptile', catch_behavior: 'wary', draft: true,
    params: { reaction: 'dive', bask: true, alertR: 55 },
    sprite_size: 'medium', color: '#5f8a4a', accent: '#d9c45a', art: { shape: 'lizard', ridge: true },
    spawn: { n: 2, at: 'surface' }, hint: 'Easy while basking at the waterline; dives fast if startled.' },
  { id: 'coral_viper', likes: ['arch', 'hideout'], name: 'Coral Viper', biome: 'coral', category: 'reptile', catch_behavior: 'timing', draft: true, predator: true,
    params: { phases: [
      { name: 'swim', dur: [4, 6], move: 'wander', speed: 42, catchable: false },
      { name: 'coiled', dur: [3, 5], move: 'still', catchable: true, label: 'zz' }] },
    sprite_size: 'wide', color: '#3a3a5a', accent: '#f2f2f2', art: { shape: 'eel', bands: true },
    spawn: { n: 2, at: 'reef' }, hint: 'Too fast while swimming. Easy while coiled up and resting.' },
  { id: 'brain_coral', tags: ['coral', 'rock'], name: 'Brain Coral', biome: 'coral', category: 'plant', is_plant: true, catch_behavior: 'plant', draft: true,
    sprite_size: 'medium', color: '#d9a05a', accent: '#f2d08a', art: { shape: 'braincoral' },
    spawn: { n: 4, at: 'floor' }, hint: 'A maze-patterned dome of coral.' },

  // ------------------------------------------------------------------ Deep Trench (no mammals)
  { id: 'lanternjaw', likes: ['light', 'rock'], name: 'Lanternjaw', biome: 'trench', category: 'fish', catch_behavior: 'wary', predator: true,
    params: { reaction: 'flee', alertR: 38, carelessNoise: 0.25, fleeSpeed: 70, speed: 10 },
    sprite_size: 'medium', color: '#3a2f4a', accent: '#5a4a6a', art: { shape: 'fish', lure: true, glow: '#9ff7ff' },
    light: { r: 22, color: '#9ff7ff' },
    spawn: { n: 3, at: 'water', y: [900, 1200] }, hint: 'Its glowing lure gives it away from afar. Skittish up close: go slow.' },
  { id: 'vent_shell', likes: ['rock', 'vent'], name: 'Vent Shell', biome: 'trench', category: 'crustacean', catch_behavior: 'clinger',
    params: { pry: true },
    sprite_size: 'small', color: '#8a6a5a', accent: '#c98a6a', art: { shape: 'isopod' }, tank: 'crawl',
    spawn: { n: 3, at: 'wall', y: [850, 1200] }, hint: "Won't flee, but it's stuck fast. Hold the net to pry it off the wall." },
  { id: 'abyss_drifter', likes: ['light'], name: 'Abyss Drifter', biome: 'trench', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.05, pulse: true, pulseEvery: [3, 5], moveEvery: [8, 12] },
    sprite_size: 'medium', color: '#5a6fd5', accent: '#a6f0ff', art: { shape: 'jelly' },
    light: { r: 26, color: '#7fdcff', pulse: true },
    spawn: { n: 3, at: 'water', y: [850, 1180] }, hint: 'Nearly invisible in the dark until it pulses with light.' },
  { id: 'trenchmaw', likes: ['hideout', 'arch'], name: 'Trenchmaw', biome: 'trench', category: 'cephalopod', catch_behavior: 'ambush', rare: 0.45,
    hostile: true, knockback: 'strong', requires_upgraded_net: true, predator: true,
    params: { aggroR: 52, lungeSpeed: 120, alpha: 0.5 },
    sprite_size: 'huge', color: '#4a1f3a', accent: '#d94a6a', art: { shape: 'squid' },
    spawn: { n: 1, at: 'water', y: [1080, 1200] }, hint: 'Rare. Needs an upgraded net. Lunges at careless divers.' },
  { id: 'glow_tuft', tags: ['light'], name: 'Glow Tuft', biome: 'trench', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#2f5f6a', accent: '#7ff7e0', art: { shape: 'tuft' }, light: { r: 34, color: '#7ff7e0' },
    spawn: { n: 10, at: 'floor', y: [900, 1240] }, hint: 'Bioluminescent: the main light source of the trench.' },

  // ------------------------------------------------------------------ Flooded Cave System
  { id: 'blindgill', likes: ['rock', 'bubbles'], name: 'Blindgill', biome: 'cave', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 72, carelessNoise: 0.18, fleeSpeed: 60 },
    sprite_size: 'small', color: '#e6dcd5', accent: '#f5efe9', art: { shape: 'fish', eyeless: true },
    spawn: { n: 3, at: 'water' }, hint: 'Eyeless; senses movement. Stillness is your friend.' },
  { id: 'cave_newt', likes: ['rock', 'crystal'], name: 'Cave Newt', biome: 'cave', category: 'amphibian', catch_behavior: 'camouflage',
    params: { alpha: 0.12, revealDist: 26, stayRevealed: true, moveEvery: [7, 12], crawl: true },
    sprite_size: 'small', color: '#59606a', accent: '#8a939e', art: { shape: 'lizard', gills: true },
    spawn: { n: 3, at: 'floor' }, hint: 'Camouflaged against wet rock. Easy once spotted up close.' },
  { id: 'stoneshell', likes: ['rock'], name: 'Stoneshell', biome: 'cave', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.18, speed: 1, inch: true },
    sprite_size: 'small', color: '#4e555e', accent: '#6a727c', art: { shape: 'snail' },
    spawn: { n: 3, at: 'floor' }, hint: 'Looks like cave wall until it inches forward.' },
  { id: 'cave_crawler', likes: ['hideout', 'rock'], name: 'Cave Crawler', biome: 'cave', category: 'crustacean', catch_behavior: 'dart', predator: true,
    params: { erratic: true, runSpeed: 85, alertR: 52, runTime: [1.2, 2], pauseTime: [1.2, 1.8], crawl: true },
    sprite_size: 'large', color: '#7a8a96', accent: '#b9c4cc', art: { shape: 'crab', spindly: true, wide: 1.1 },
    spawn: { n: 2, at: 'floor' }, hint: 'As big as a king crab. Fast and erratic when startled; net it when it stops.' },
  { id: 'mineral_bloom', tags: ['crystal', 'light'], name: 'Mineral Bloom', biome: 'cave', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#9f7fe8', accent: '#6fd6e8', art: { shape: 'crystals' }, light: { r: 18, color: '#c9a2ff' },
    spawn: { n: 6, at: 'floor' }, hint: 'Glittering mineral growths.' },

  // ------------------------------------------------------------------ Open Ocean
  { id: 'driftfin', likes: ['bubbles', 'plant'], name: 'Driftfin', biome: 'open_ocean', category: 'fish', catch_behavior: 'school',
    params: { size: [5, 8], speed: 42, roam: 420, alertR: 46, fleeSpeed: 80 },
    sprite_size: 'medium', color: '#2f5fa8', accent: '#c9d6e8', art: { shape: 'fish', long: 1.15 },
    spawn: { n: 2, at: 'water', y: [140, 560] }, hint: 'Loose, fast schools with no cover. Get ahead of them and intercept.' },
  { id: 'blue_runner', likes: ['bubbles', 'arch'], name: 'Blue Runner', biome: 'open_ocean', category: 'mammal', catch_behavior: 'curious',
    params: { approachR: 130, keepDist: 24 },
    sprite_size: 'large', color: '#5a8fd5', accent: '#d6e6f5', art: { shape: 'dolphin' },
    spawn: { n: 2, at: 'water', y: [120, 480] }, hint: 'Curious and playful. Swing only when it pauses to look at you (?).' },
  { id: 'open_drifter', likes: ['light', 'bubbles'], name: 'Open Drifter', biome: 'open_ocean', category: 'cephalopod', catch_behavior: 'drift',
    params: { sting: true, speed: 5 }, knockback: 'light',
    sprite_size: 'small', color: '#e8a6d9', accent: '#f5d0ee', art: { shape: 'jelly' },
    spawn: { n: 4, at: 'water', y: [110, 500] }, hint: 'Drifts with the current. Easy, but stings if you grab it at speed.' },
  { id: 'longneck_sea_lizard', likes: ['perch', 'rock'], name: 'Longneck Sea-lizard', biome: 'open_ocean', category: 'reptile', catch_behavior: 'timing',
    params: { phases: [
      { name: 'deep', dur: [5, 8], move: 'deep', speed: 30, catchable: false, alpha: 0.6 },
      { name: 'rising', dur: [2, 3], move: 'surface', speed: 34, catchable: false },
      { name: 'breathing', dur: [2.5, 3.5], move: 'still', catchable: true, label: '~' }] },
    sprite_size: 'large', color: '#4a7a6a', accent: '#a6c9a0', art: { shape: 'lizard', neck: true },
    spawn: { n: 2, at: 'surface' }, hint: 'Surfaces briefly to breathe. Catch it during that window.' },
  { id: 'floating_weed_mat', tags: ['bubbles'], name: 'Floating Weed Mat', biome: 'open_ocean', category: 'plant', is_plant: true, catch_behavior: 'plant',
    params: { drift: true },
    sprite_size: 'wide', color: '#7a7a2f', accent: '#a8a33a', art: { shape: 'mat' },
    spawn: { n: 4, at: 'surface' }, hint: 'Drifts around the surface.' },
  { id: 'reeftooth', likes: ['arch', 'rock'], name: 'Reeftooth', biome: 'open_ocean', category: 'fish', catch_behavior: 'patrol', predator: true,
    knockback: 'strong',
    params: { speed: 26, noticeR: 64, stillNoise: 0.12, bump: true, span: 110 },
    sprite_size: 'huge', color: '#6a7a8a', accent: '#d6dee6', art: { shape: 'shark' },
    spawn: { n: 2, at: 'water', y: [160, 520] }, hint: 'Patrols a fixed route. Wait motionless at one of its turning points.' },
  { id: 'wandershell_nautilus', likes: ['shell', 'pillar'], name: 'Wandershell Nautilus', biome: 'open_ocean', category: 'cephalopod', catch_behavior: 'drift',
    params: { alpha: 0.75, speed: 4 },
    sprite_size: 'small', color: '#d9c4a6', accent: '#a65a3a', art: { shape: 'nautilus' },
    spawn: { n: 3, at: 'water', y: [200, 600] }, hint: 'Slow and easy to mistake for floating debris.' },
  { id: 'crimsonback', likes: ['bubbles', 'plant'], name: 'Crimsonback', biome: 'open_ocean', category: 'fish', catch_behavior: 'school', draft: true,
    params: { size: [5, 7], tight: 1.6, leap: true, speed: 40, alertR: 50 },
    sprite_size: 'medium', color: '#c23a3a', accent: '#f2a0a0', art: { shape: 'fish', blackEye: true, long: 1.15 },   // 2px longer than a default fish
    spawn: { n: 1, at: 'surface' }, hint: 'Tight schools that leap at the surface. Red inside and out.' },
  { id: 'ironfin', likes: ['arch', 'bubbles'], name: 'Ironfin', biome: 'open_ocean', category: 'fish', catch_behavior: 'timing', draft: true,
    params: { phases: [
      { name: 'cruise', dur: [3, 5], move: 'wander', speed: 30, catchable: false },
      { name: 'burst', dur: [0.7, 1], move: 'burst', speed: 170, catchable: false },
      { name: 'tired', dur: [2, 3], move: 'still', catchable: true, label: '...' }] },
    sprite_size: 'medium', color: '#6a7a8a', accent: '#b0bcc8', art: { shape: 'fish', long: 1.2 },
    spawn: { n: 2, at: 'water', y: [200, 560] }, hint: 'Solitary with powerful speed bursts. Only catchable right after one.' },

  // ------------------------------------------------------------------ Sunken Ruins
  { id: 'porthole_darter', likes: ['hideout', 'treasure'], name: 'Porthole Darter', biome: 'ruins', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'hide', alertR: 52, hideTime: [4, 7], speed: 14 },
    sprite_size: 'small', color: '#f2c14e', accent: '#5ab0d9', art: { shape: 'fish', stripes: true },
    spawn: { n: 4, at: 'water', y: [150, 270] }, hint: 'Ducks through portholes out of reach if spooked.' },
  { id: 'rustclaw', likes: ['metal', 'treasure'], name: 'Rustclaw', biome: 'ruins', category: 'crustacean', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 46, carelessNoise: 0.3, fleeSpeed: 40, alpha: 0.5, crawl: true },
    sprite_size: 'small', color: '#a5643a', accent: '#6b4a35', art: { shape: 'crab' },
    spawn: { n: 3, at: 'floor' }, hint: 'Blends with corroded metal. Any sudden movement scares it.' },
  { id: 'chest_octopus', likes: ['treasure', 'hideout'], name: 'Chest Octopus', biome: 'ruins', category: 'cephalopod', catch_behavior: 'coax',
    params: { emerge: 'quiet', quietTime: 3, home: 'decor.barrel' },
    sprite_size: 'medium', color: '#d9773a', accent: '#f2c48a', art: { shape: 'octopus' },
    spawn: { n: 2, at: 'floor' }, hint: 'Lives in an old barrel. Wait quietly nearby and it peeks out.' },
  { id: 'wreck_eel', likes: ['pillar', 'arch'], name: 'Wreck Eel', biome: 'ruins', category: 'reptile', catch_behavior: 'flee', predator: true,
    params: { alertR: 60, fleeSpeed: 38, tightBonus: 1.4 },
    sprite_size: 'wide', color: '#4a5a3a', accent: '#8a9a5a', art: { shape: 'eel' },
    spawn: { n: 2, at: 'water', y: [180, 270] }, hint: 'Fast in tight wreck spaces, slow in open water. Chase it into the open.' },
  { id: 'barnacle_crawler', likes: ['wood', 'metal'], sexes: 'none', name: 'Barnacle Crawler', biome: 'ruins', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.3, speed: 1 },
    sprite_size: 'tiny', color: '#cfc4b0', accent: '#9a8f7a', art: { shape: 'barnacles' },
    spawn: { n: 4, at: 'floor' }, hint: 'Extremely slow. The only challenge is spotting it.' },
  { id: 'rustweed', tags: ['metal'], name: 'Rustweed', biome: 'ruins', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#8a3f2a', accent: '#b5643a', art: { shape: 'frond' },
    spawn: { n: 6, at: 'floor' }, hint: 'Reddish weed that grows on old metal.' },

  // ------------------------------------------------------------------ Volcanic Vents (no reptiles)
  { id: 'ember_goby', likes: ['vent', 'rock'], name: 'Ember Goby', biome: 'vents', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'hide', alertR: 46, carelessNoise: 0.5, hideTime: [3, 6], speed: 10 },
    sprite_size: 'tiny', color: '#ff7a3a', accent: '#ffd27a', art: { shape: 'fish' },
    spawn: { n: 4, at: 'reef' }, hint: 'Darts into vent cracks if you approach too fast.' },
  { id: 'sulfur_crab', likes: ['vent', 'rock'], name: 'Sulfur Crab', biome: 'vents', category: 'crustacean', catch_behavior: 'defensive', knockback: 'light',
    params: { alertR: 46, relaxTime: 2 },
    sprite_size: 'small', color: '#d9c43a', accent: '#f2e27a', art: { shape: 'crab' },
    spawn: { n: 3, at: 'floor' }, hint: 'Raises its claws when you come close. Hover still a moment and it relaxes.' },
  { id: 'vent_limpet', likes: ['rock', 'vent'], name: 'Vent Limpet', biome: 'vents', category: 'gastropod', catch_behavior: 'timing',
    params: { phases: [
      { name: 'clear', dur: [3, 5], move: 'still', catchable: true, alpha: 0.85 },
      { name: 'plume', dur: [2, 3], move: 'still', catchable: false, alpha: 0.05, plume: true }] },
    sprite_size: 'tiny', color: '#8a7a6a', accent: '#c9a68a', art: { shape: 'limpet' }, tank: 'still',
    spawn: { n: 4, at: 'floor' }, hint: 'Motionless, but vent plumes keep hiding it. Net it between plumes.' },
  { id: 'vent_salamander', likes: ['vent', 'light'], name: 'Vent Salamander', biome: 'vents', category: 'amphibian', catch_behavior: 'timing',
    params: { phases: [
      { name: 'calm', dur: [4, 7], move: 'wander', speed: 8, catchable: true },
      { name: 'plume', dur: [1.5, 2], move: 'still', catchable: true, plume: true },
      { name: 'alert', dur: [3, 4], move: 'still', catchable: true, alertR: 70, carelessNoise: 0.15, label: '!' }] },
    sprite_size: 'medium', color: '#d95a3a', accent: '#ffb27a', art: { shape: 'lizard', gills: true },
    spawn: { n: 2, at: 'reef' }, hint: 'Calm most of the time, but jumpy right after a plume passes.' },
  { id: 'vent_moss', tags: ['vent'], name: 'Vent Moss', biome: 'vents', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#c9c43a', accent: '#8a9a2a', art: { shape: 'moss' },
    spawn: { n: 6, at: 'floor' }, hint: 'Warm, fuzzy moss that thrives near the vents.' },

  // ------------------------------------------------------------------ Mangrove Roots
  { id: 'rootback_mudskipper', likes: ['roots', 'wood'], name: 'Rootback Mudskipper', biome: 'mangrove', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'leap', alertR: 50, hideTime: [4, 7], speed: 10 },
    sprite_size: 'small', color: '#8a7a5a', accent: '#c9b48a', art: { shape: 'fish' },
    spawn: { n: 3, at: 'surface' }, hint: 'Flops onto exposed roots out of reach if startled.' },
  { id: 'mangrove_fiddler', likes: ['roots', 'shell'], name: 'Mangrove Fiddler', biome: 'mangrove', category: 'crustacean', catch_behavior: 'camouflage',
    params: { freezeOnApproach: true, alpha: 0.22, visibleAlpha: 0.95, crawl: true, moveEvery: [2, 4] },
    sprite_size: 'small', color: '#d9a03a', accent: '#ffcf5a', art: { shape: 'crab', bigclaw: true },
    spawn: { n: 3, at: 'floor' }, hint: "Freezes rather than flees. Remember where it stopped." },
  { id: 'rootcoil_snake', likes: ['roots', 'wood'], name: 'Rootcoil Snake', biome: 'mangrove', category: 'reptile', catch_behavior: 'camouflage',
    params: { alpha: 0.1, moveEvery: [5, 9], moveTime: [0.8, 1.2], moveSpeed: 20 },
    sprite_size: 'wide', color: '#5a4a2f', accent: '#8a7a4a', art: { shape: 'eel', bands: true, thick: 0.8 },
    spawn: { n: 3, at: 'water', y: [104, 182] }, hint: 'Nearly invisible wound around roots until it shifts.' },
  { id: 'dwarf_croc', likes: ['perch', 'wood'], name: 'Dwarf Croc', biome: 'mangrove', category: 'reptile', catch_behavior: 'ambush', predator: true,
    hostile: true, knockback: 'strong',
    params: { aggroR: 56, lungeSpeed: 130, alpha: 0.4, surface: true },
    sprite_size: 'widelarge', color: '#556b33', accent: '#c9c48a', art: { shape: 'croc' },
    spawn: { n: 2, at: 'surface' }, hint: 'Mostly submerged ambush predator. Approach very carefully.' },
  { id: 'bankside_monitor', likes: ['rock', 'wood'], name: 'Bankside Monitor', biome: 'mangrove', category: 'reptile', catch_behavior: 'patrol', predator: true,
    params: { crawl: true, speed: 16, onSpook: 'flee', fleeSpeed: 70, noticeR: 56, span: 90 },
    sprite_size: 'medium', color: '#6a6a4a', accent: '#c9c48a', art: { shape: 'lizard', spots: true },
    spawn: { n: 2, at: 'floor' }, hint: 'Patrols the muddy banks and bolts when startled. Cut off its path.' },
  { id: 'muckhide_octopus', likes: ['hideout', 'roots'], name: 'Muckhide Octopus', biome: 'mangrove', category: 'cephalopod', catch_behavior: 'coax',
    params: { emerge: 'bait' },
    sprite_size: 'medium', color: '#7a5a3a', accent: '#a5835a', art: { shape: 'octopus' },
    spawn: { n: 2, at: 'floor' }, hint: 'Buried in mud. Coax it out with bait.' },
  { id: 'root_tangle', tags: ['roots', 'wood'], name: 'Root Tangle', biome: 'mangrove', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'medium', color: '#5b4129', accent: '#4f9440', art: { shape: 'tangle' },
    spawn: { n: 5, at: 'floor' }, hint: 'A knot of mangrove roots with fresh leaves.' },

  // ------------------------------------------------------------------ Ice Shelf / Polar Waters (no plant)
  { id: 'frostfin', likes: ['ice', 'bubbles'], name: 'Frostfin', biome: 'ice', category: 'fish', catch_behavior: 'school',
    params: { size: [6, 8], tight: 1.5, straggler: true, speed: 24, alertR: 58 },
    sprite_size: 'small', color: '#a6d9f2', accent: '#ffffff', art: { shape: 'fish' },
    spawn: { n: 2, at: 'water', y: [140, 370] }, hint: 'Tight schools through the ice gaps. Go for the straggler.' },
  { id: 'iceback_seal_pup', likes: ['ice', 'perch'], name: 'Iceback Seal Pup', biome: 'ice', category: 'mammal', catch_behavior: 'wary',
    params: { reaction: 'dive', bask: true, onIce: true, alertR: 55 },
    sprite_size: 'medium', color: '#f2f6fa', accent: '#c9d6e0', art: { shape: 'otter', plump: true },
    spawn: { n: 2, at: 'ice_top' }, hint: 'Easy while lounging on the ice; much harder once it dives.' },
  { id: 'frost_isopod', likes: ['ice', 'rock'], name: 'Frost Isopod', biome: 'ice', category: 'crustacean', catch_behavior: 'clinger',
    params: { pry: false },
    sprite_size: 'small', color: '#c9e0ee', accent: '#8fb8d0', art: { shape: 'isopod' }, tank: 'crawl',
    spawn: { n: 3, at: 'ceiling' }, hint: 'Clings upside-down under the ice shelves.' },
  { id: 'iceshell_snail', likes: ['ice', 'plant'], name: 'Iceshell Snail', biome: 'ice', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.2, speed: 1.2 },
    sprite_size: 'tiny', color: '#d0f0ff', accent: '#e8f8ff', art: { shape: 'snail', glass: true },
    spawn: { n: 3, at: 'floor' }, hint: 'Translucent and extremely slow. Hard to see.' },

  // ------------------------------------------------------------------ Half-Flooded Lush Cave
  { id: 'cavepetalia', likes: ['plant', 'light'], name: 'Cavepetalia', biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#f5c6d6', accent: '#ffffff', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { n: 3, at: 'water' }, hint: 'Pale pink with feathery gills. Barely reacts to you at all.' }
];
