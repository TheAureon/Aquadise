// Creature + plant roster. Adding a creature = adding an entry here (and optionally real art).
//
// Fields
//   id, biome, category                  identity (the name and log hint are in data/lang/: creature.<id>.name / .hint) (category: fish|gastropod|crustacean|amphibian|cephalopod|reptile|mammal|plant)
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
//   bloom                                plants: 'night' = closed (not harvestable) by day, open + glowing at night
//   requires_depth                       lives past a depth limit: needs that DEPTH upgrade level to reach (log tag)
//   eggs                                 optional true/false: lays eggs when breeding (default: all but mammals)
//   sprite_size                          size class from data/sprite-spec.js
//   color, accent, art                   placeholder-art hints only (ignored once real art exists)
//   spawn                                { n, at: floor|water|surface|wall|ceiling|pool|ice_top|reef, area:[x0,x1], y:[y0,y1] }
//                                        + optional extra: [{ n, at, area, y }, ...] for more places it also lives
//   light                                { r, color } emits light in dark biomes
//   tank                                 tank idle locomotion: swim | crawl | still (default from category)
//   voice                                optional: its own little sound id (src/sfx.js); otherwise one per category
//                                        (AQ.data.creatureVoices in data/music.js)
//   hint                                 shown in the collection log
//   likes                                aquarium: decor/plant tags it enjoys being near (see data/decorations.js)
//   tags                                 plants only: what the plant counts as when placed in a tank
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.creatures = [
  // ------------------------------------------------------------------ Tide Pools / Shallows
  { id: 'saltbloom', tags: ['crystal'], biome: 'tide_pools', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#f6e9ef', accent: '#f2a7c3', art: { shape: 'saltbloom' },
    spawn: { n: 6, at: 'ground', area: [0, 600] } },
  { id: 'drift_snail', likes: ['plant', 'rock'], biome: 'tide_pools', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.4, speed: 2.5, trail: '#e2f6ff' },
    sprite_size: 'tiny', color: '#b9a7d9', accent: '#e7dcf7', art: { shape: 'snail', glass: true },
    spawn: { n: 4, at: 'ground', area: [0, 700] } },
  { id: 'knuckle_crab', likes: ['rock', 'hideout'], biome: 'tide_pools', category: 'crustacean', catch_behavior: 'wary',
    params: { reaction: 'hide', pry: true, alertR: 48, speed: 6, wanderR: 26 },
    sprite_size: 'small', color: '#c9573f', accent: '#e8885f', art: { shape: 'crab' },
    spawn: { n: 3, at: 'ground', area: [0, 700] } },
  { id: 'glasswinged_minnow', likes: ['plant', 'bubbles'], biome: 'tide_pools', category: 'fish', catch_behavior: 'tidepool',
    params: { chance: 0.55, sneakBonus: 0.25 },
    sprite_size: 'tiny', color: '#bfe8f2', accent: '#ffffff', art: { shape: 'fish', wing: true },
    spawn: { n: 3, at: 'pool' } },
  { id: 'puddlejack', likes: ['rock', 'plant'], biome: 'tide_pools', category: 'amphibian', catch_behavior: 'hopper',
    params: { restTime: [3, 6], hopTime: 0.9, alertR: 36 },
    sprite_size: 'small', color: '#6fae4a', accent: '#d8e88a', art: { shape: 'frog' },
    spawn: { n: 1, at: 'pool' } },

  // ------------------------------------------------------------------ Kelp Forest
  { id: 'bladefin_perch', likes: ['kelp', 'plant'], biome: 'kelp', category: 'fish', catch_behavior: 'school',
    params: { size: [5, 7], cover: true, speed: 18, alertR: 64 },
    sprite_size: 'small', color: '#8fa3b5', accent: '#d6e2ea', art: { shape: 'fish', stripes: true },
    spawn: { n: 2, at: 'water', y: [190, 360] } },
  { id: 'kelp_otter', likes: ['kelp', 'perch'], biome: 'kelp', category: 'mammal', catch_behavior: 'wary',
    params: { reaction: 'dive', bask: true, alertR: 60, carelessNoise: 0.5 },
    sprite_size: 'medium', color: '#7a5534', accent: '#d9b48a', art: { shape: 'otter' },
    spawn: { n: 2, at: 'surface' } },
  { id: 'frond_squid', likes: ['kelp'], biome: 'kelp', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.12, moveEvery: [3, 6], moveSpeed: 26 },
    sprite_size: 'small', color: '#7f9a3a', accent: '#b5cf62', art: { shape: 'squid' },
    spawn: { n: 3, at: 'water', y: [170, 370] } },
  { id: 'coilback_newt', likes: ['kelp', 'wood'], biome: 'kelp', category: 'reptile', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 46, carelessNoise: 0.4, wanderR: 0, fleeSpeed: 75 },
    sprite_size: 'small', color: '#c46d3a', accent: '#f2c14e', art: { shape: 'lizard', spots: true },
    spawn: { n: 3, at: 'water', y: [200, 370] } },
  { id: 'sandveil_skink', likes: ['rock', 'shell'], biome: 'kelp', category: 'reptile', catch_behavior: 'camouflage',
    params: { buried: true, alpha: 0.06, moveEvery: [4, 8], moveTime: [0.5, 0.9], moveSpeed: 60 },
    sprite_size: 'small', color: '#c9b07a', accent: '#8f7a4a', art: { shape: 'lizard' }, tank: 'crawl',
    spawn: { n: 3, at: 'floor' } },
  { id: 'bell_kelp', tags: ['kelp'], biome: 'kelp', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'tall', color: '#6b8a2c', accent: '#c2b84a', art: { shape: 'kelp' },
    spawn: { n: 5, at: 'floor' } },

  // ------------------------------------------------------------------ Coral Shelf
  { id: 'fanray_damsel', likes: ['coral', 'arch'], biome: 'coral', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 50, fleeTime: [0.8, 1.3], wanderR: 22, speed: 14 },
    sprite_size: 'small', color: '#3a7bd5', accent: '#ffd35c', art: { shape: 'fish', fan: true },
    spawn: { n: 4, at: 'reef' } },
  { id: 'coral_whelk', likes: ['coral', 'rock'], biome: 'coral', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.28, speed: 2 },
    sprite_size: 'tiny', color: '#e88f9a', accent: '#f5c0a0', art: { shape: 'snail' },
    spawn: { n: 4, at: 'floor' } },
  { id: 'pincer_hermit', likes: ['shell', 'rock'], biome: 'coral', category: 'crustacean', catch_behavior: 'dart',
    params: { alertR: 48, runTime: [1, 1.6], pauseTime: [1.5, 2.3], runSpeed: 70, crawl: true },
    sprite_size: 'small', color: '#d9663f', accent: '#e8d0a8', art: { shape: 'hermit' },
    spawn: { n: 3, at: 'floor' } },
  { id: 'reef_mimic', likes: ['coral', 'hideout'], biome: 'coral', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.15, relocate: true, relocateAfter: 3.5, moveEvery: [6, 10], crawl: true },
    sprite_size: 'medium', color: '#e8806a', accent: '#f5b25c', art: { shape: 'octopus' },
    spawn: { n: 3, at: 'floor' } },
  { id: 'fire_coral', tags: ['coral'], biome: 'coral', category: 'plant', is_plant: true, catch_behavior: 'plant',
    params: { sting: true }, knockback: 'light',
    sprite_size: 'small', color: '#ff6a3a', accent: '#ffd35c', art: { shape: 'branchcoral' },
    spawn: { n: 5, at: 'floor' } },
  { id: 'ridgeback_basker', likes: ['perch', 'rock'], biome: 'coral', category: 'reptile', catch_behavior: 'wary', draft: true,
    params: { reaction: 'dive', bask: true, alertR: 55 },
    sprite_size: 'medium', color: '#5f8a4a', accent: '#d9c45a', art: { shape: 'lizard', ridge: true },
    spawn: { n: 2, at: 'surface' } },
  { id: 'coral_viper', likes: ['arch', 'hideout'], biome: 'coral', category: 'reptile', catch_behavior: 'timing', draft: true, predator: true,
    params: { phases: [
      { name: 'swim', dur: [4, 6], move: 'wander', speed: 42, catchable: false },
      { name: 'coiled', dur: [3, 5], move: 'still', catchable: true, label: 'zz' }] },
    sprite_size: 'wide', color: '#3a3a5a', accent: '#f2f2f2', art: { shape: 'eel', bands: true },
    spawn: { n: 2, at: 'reef' } },
  { id: 'brain_coral', tags: ['coral', 'rock'], biome: 'coral', category: 'plant', is_plant: true, catch_behavior: 'plant', draft: true,
    sprite_size: 'medium', color: '#d9a05a', accent: '#f2d08a', art: { shape: 'braincoral' },
    spawn: { n: 4, at: 'floor' } },

  // ------------------------------------------------------------------ Deep Trench (no mammals)
  { id: 'lanternjaw', likes: ['light', 'rock'], biome: 'trench', category: 'fish', catch_behavior: 'wary', predator: true,
    params: { reaction: 'flee', alertR: 38, carelessNoise: 0.25, fleeSpeed: 70, speed: 10 },
    sprite_size: 'medium', color: '#3a2f4a', accent: '#5a4a6a', art: { shape: 'fish', lure: true, glow: '#9ff7ff' },
    light: { r: 22, color: '#9ff7ff' },
    spawn: { n: 3, at: 'water', y: [900, 1200], extra: [{ n: 1, at: 'water', area: [3440, 3860], y: [1200, 1280] }] } },
  { id: 'vent_shell', likes: ['rock', 'vent'], biome: 'trench', category: 'crustacean', catch_behavior: 'clinger',
    params: { pry: true },
    sprite_size: 'small', color: '#8a6a5a', accent: '#c98a6a', art: { shape: 'isopod' }, tank: 'crawl',
    spawn: { n: 3, at: 'wall', y: [850, 1200], extra: [{ n: 2, at: 'wall', area: [3440, 3860], y: [1150, 1290] }] } },
  { id: 'abyss_drifter', likes: ['light'], biome: 'trench', category: 'cephalopod', catch_behavior: 'camouflage',
    params: { alpha: 0.05, pulse: true, pulseEvery: [3, 5], moveEvery: [8, 12] },
    sprite_size: 'medium', color: '#5a6fd5', accent: '#a6f0ff', art: { shape: 'jelly' },
    light: { r: 26, color: '#7fdcff', pulse: true },
    spawn: { n: 3, at: 'water', y: [850, 1180], extra: [{ n: 2, at: 'water', area: [3440, 3860], y: [1190, 1275] }] } },
  { id: 'trenchmaw', likes: ['hideout', 'arch'], biome: 'trench', category: 'cephalopod', catch_behavior: 'ambush', rare: 0.45,
    hostile: true, knockback: 'strong', requires_upgraded_net: true, predator: true,
    params: { aggroR: 52, lungeSpeed: 120, alpha: 0.5 },
    sprite_size: 'huge', color: '#4a1f3a', accent: '#d94a6a', art: { shape: 'squid' },
    spawn: { n: 1, at: 'water', y: [1080, 1200] } },
  { id: 'glow_tuft', tags: ['light'], biome: 'trench', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#2f5f6a', accent: '#7ff7e0', art: { shape: 'tuft' }, light: { r: 34, color: '#7ff7e0' },
    spawn: { n: 10, at: 'floor', y: [900, 1240], extra: [{ n: 6, at: 'floor', area: [3440, 3860], y: [1220, 1300] }] } },

  // ------------------------------------------------------------------ Flooded Cave System
  { id: 'blindgill', likes: ['rock', 'bubbles'], biome: 'cave', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 72, carelessNoise: 0.18, fleeSpeed: 60 },
    sprite_size: 'small', color: '#e6dcd5', accent: '#f5efe9', art: { shape: 'fish', eyeless: true },
    spawn: { n: 3, at: 'water' } },
  { id: 'cave_newt', likes: ['rock', 'crystal'], biome: 'cave', category: 'amphibian', catch_behavior: 'camouflage',
    params: { alpha: 0.12, revealDist: 26, stayRevealed: true, moveEvery: [7, 12], crawl: true },
    sprite_size: 'small', color: '#59606a', accent: '#8a939e', art: { shape: 'lizard', gills: true },
    spawn: { n: 3, at: 'floor' } },
  { id: 'stoneshell', likes: ['rock'], biome: 'cave', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.18, speed: 1, inch: true },
    sprite_size: 'small', color: '#4e555e', accent: '#6a727c', art: { shape: 'snail' },
    spawn: { n: 3, at: 'floor' } },
  { id: 'cave_crawler', likes: ['hideout', 'rock'], biome: 'cave', category: 'crustacean', catch_behavior: 'dart', predator: true,
    params: { erratic: true, runSpeed: 85, alertR: 52, runTime: [1.2, 2], pauseTime: [1.2, 1.8], crawl: true },
    sprite_size: 'large', color: '#7a8a96', accent: '#b9c4cc', art: { shape: 'crab', spindly: true, wide: 1.1 },
    spawn: { n: 2, at: 'floor' } },
  { id: 'mineral_bloom', tags: ['crystal', 'light'], biome: 'cave', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#9f7fe8', accent: '#6fd6e8', art: { shape: 'crystals' }, light: { r: 18, color: '#c9a2ff' },
    spawn: { n: 6, at: 'floor' } },

  // ------------------------------------------------------------------ Open Ocean
  { id: 'driftfin', likes: ['bubbles', 'plant'], biome: 'open_ocean', category: 'fish', catch_behavior: 'school',
    params: { size: [5, 8], speed: 42, roam: 420, alertR: 46, fleeSpeed: 80 },
    sprite_size: 'medium', color: '#2f5fa8', accent: '#c9d6e8', art: { shape: 'fish', long: 1.15 },
    spawn: { n: 2, at: 'water', y: [140, 560] } },
  { id: 'blue_runner', likes: ['bubbles', 'arch'], biome: 'open_ocean', category: 'mammal', catch_behavior: 'curious',
    params: { approachR: 130, keepDist: 24 },
    sprite_size: 'large', color: '#5a8fd5', accent: '#d6e6f5', art: { shape: 'dolphin' },
    spawn: { n: 2, at: 'water', y: [120, 480] } },
  { id: 'open_drifter', likes: ['light', 'bubbles'], biome: 'open_ocean', category: 'cephalopod', catch_behavior: 'drift',
    params: { sting: true, speed: 5 }, knockback: 'light',
    sprite_size: 'small', color: '#e8a6d9', accent: '#f5d0ee', art: { shape: 'jelly' },
    spawn: { n: 4, at: 'water', y: [110, 500] } },
  { id: 'longneck_sea_lizard', likes: ['perch', 'rock'], biome: 'open_ocean', category: 'reptile', catch_behavior: 'timing',
    params: { phases: [
      { name: 'deep', dur: [5, 8], move: 'deep', speed: 30, catchable: false, alpha: 0.6 },
      { name: 'rising', dur: [2, 3], move: 'surface', speed: 34, catchable: false },
      { name: 'breathing', dur: [2.5, 3.5], move: 'still', catchable: true, label: '~' }] },
    sprite_size: 'large', color: '#4a7a6a', accent: '#a6c9a0', art: { shape: 'lizard', neck: true },
    spawn: { n: 2, at: 'surface' } },
  { id: 'floating_weed_mat', tags: ['bubbles'], biome: 'open_ocean', category: 'plant', is_plant: true, catch_behavior: 'plant',
    params: { drift: true },
    sprite_size: 'wide', color: '#7a7a2f', accent: '#a8a33a', art: { shape: 'mat' },
    spawn: { n: 4, at: 'surface' } },
  { id: 'reeftooth', likes: ['arch', 'rock'], biome: 'open_ocean', category: 'fish', catch_behavior: 'patrol', predator: true,
    knockback: 'strong',
    params: { speed: 26, noticeR: 64, stillNoise: 0.12, bump: true, span: 110 },
    sprite_size: 'huge', color: '#6a7a8a', accent: '#d6dee6', art: { shape: 'shark' },
    spawn: { n: 2, at: 'water', y: [160, 520] } },
  { id: 'wandershell_nautilus', likes: ['shell', 'pillar'], biome: 'open_ocean', category: 'cephalopod', catch_behavior: 'drift',
    params: { alpha: 0.75, speed: 4 },
    sprite_size: 'small', color: '#d9c4a6', accent: '#a65a3a', art: { shape: 'nautilus' },
    spawn: { n: 3, at: 'water', y: [200, 600] } },
  { id: 'crimsonback', likes: ['bubbles', 'plant'], biome: 'open_ocean', category: 'fish', catch_behavior: 'school', draft: true,
    // roams the whole open-ocean water column (roamY), but never below maxY: the vents + trench start at ~600
    params: { size: [5, 7], tight: 1.6, leap: true, speed: 40, alertR: 50, roam: 260, roamY: 180, maxY: 560 },
    sprite_size: 'mediumlong', color: '#c23a3a', accent: '#f2a0a0', art: { shape: 'fish', blackEye: true, long: 1.03, tall: 0.85 },   // a longer frame so it really is longer (23px) than other mid-size fish
    spawn: { n: 1, at: 'water', area: [2600, 3950], y: [120, 520] } },
  { id: 'ironfin', likes: ['arch', 'bubbles'], biome: 'open_ocean', category: 'fish', catch_behavior: 'timing', draft: true,
    params: { phases: [
      { name: 'cruise', dur: [3, 5], move: 'wander', speed: 30, catchable: false },
      { name: 'burst', dur: [0.7, 1], move: 'burst', speed: 170, catchable: false },
      { name: 'tired', dur: [2, 3], move: 'still', catchable: true, label: '...' }] },
    sprite_size: 'medium', color: '#6a7a8a', accent: '#b0bcc8', art: { shape: 'fish', long: 1.2 },
    spawn: { n: 2, at: 'water', y: [200, 560] } },

  // ------------------------------------------------------------------ Sunken Ruins
  { id: 'porthole_darter', likes: ['hideout', 'treasure'], biome: 'ruins', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'hide', alertR: 52, hideTime: [4, 7], speed: 14 },
    sprite_size: 'small', color: '#f2c14e', accent: '#5ab0d9', art: { shape: 'fish', stripes: true },
    spawn: { n: 4, at: 'water', y: [150, 270] } },
  { id: 'rustclaw', likes: ['metal', 'treasure'], biome: 'ruins', category: 'crustacean', catch_behavior: 'wary',
    params: { reaction: 'flee', alertR: 46, carelessNoise: 0.3, fleeSpeed: 40, alpha: 0.5, crawl: true },
    sprite_size: 'small', color: '#a5643a', accent: '#6b4a35', art: { shape: 'crab' },
    spawn: { n: 3, at: 'floor' } },
  { id: 'chest_octopus', likes: ['treasure', 'hideout'], biome: 'ruins', category: 'cephalopod', catch_behavior: 'coax',
    params: { emerge: 'quiet', quietTime: 3, home: 'decor.barrel' },
    sprite_size: 'medium', color: '#d9773a', accent: '#f2c48a', art: { shape: 'octopus' },
    spawn: { n: 2, at: 'floor' } },
  { id: 'wreck_eel', likes: ['pillar', 'arch'], biome: 'ruins', category: 'reptile', catch_behavior: 'flee', predator: true,
    params: { alertR: 60, fleeSpeed: 38, tightBonus: 1.4 },
    sprite_size: 'wide', color: '#4a5a3a', accent: '#8a9a5a', art: { shape: 'eel' },
    spawn: { n: 2, at: 'water', y: [180, 270] } },
  { id: 'barnacle_crawler', likes: ['wood', 'metal'], sexes: 'none', biome: 'ruins', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.3, speed: 1 },
    sprite_size: 'tiny', color: '#cfc4b0', accent: '#9a8f7a', art: { shape: 'barnacles' },
    spawn: { n: 4, at: 'floor' } },
  { id: 'rustweed', tags: ['metal'], biome: 'ruins', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#8a3f2a', accent: '#b5643a', art: { shape: 'frond' },
    spawn: { n: 6, at: 'floor' } },

  // ------------------------------------------------------------------ Volcanic Vents (no reptiles)
  { id: 'ember_goby', likes: ['vent', 'rock'], biome: 'vents', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'hide', alertR: 46, carelessNoise: 0.5, hideTime: [3, 6], speed: 10 },
    sprite_size: 'tiny', color: '#ff7a3a', accent: '#ffd27a', art: { shape: 'fish' },
    spawn: { n: 4, at: 'reef' } },
  { id: 'sulfur_crab', likes: ['vent', 'rock'], biome: 'vents', category: 'crustacean', catch_behavior: 'defensive', knockback: 'light',
    params: { alertR: 46, relaxTime: 2 },
    sprite_size: 'small', color: '#d9c43a', accent: '#f2e27a', art: { shape: 'crab' },
    spawn: { n: 3, at: 'floor' } },
  { id: 'vent_limpet', likes: ['rock', 'vent'], biome: 'vents', category: 'gastropod', catch_behavior: 'timing',
    params: { phases: [
      { name: 'clear', dur: [3, 5], move: 'still', catchable: true, alpha: 0.85 },
      { name: 'plume', dur: [2, 3], move: 'still', catchable: false, alpha: 0.05, plume: true }] },
    sprite_size: 'tiny', color: '#8a7a6a', accent: '#c9a68a', art: { shape: 'limpet' }, tank: 'still',
    spawn: { n: 4, at: 'floor' } },
  { id: 'vent_salamander', likes: ['vent', 'light'], biome: 'vents', category: 'amphibian', catch_behavior: 'timing',
    params: { phases: [
      { name: 'calm', dur: [4, 7], move: 'wander', speed: 8, catchable: true },
      { name: 'plume', dur: [1.5, 2], move: 'still', catchable: true, plume: true },
      { name: 'alert', dur: [3, 4], move: 'still', catchable: true, alertR: 70, carelessNoise: 0.15, label: '!' }] },
    sprite_size: 'medium', color: '#d95a3a', accent: '#ffb27a', art: { shape: 'lizard', gills: true },
    spawn: { n: 2, at: 'reef' } },
  { id: 'vent_moss', tags: ['vent'], biome: 'vents', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'small', color: '#c9c43a', accent: '#8a9a2a', art: { shape: 'moss' },
    spawn: { n: 6, at: 'floor' } },

  // ------------------------------------------------------------------ Mangrove Roots
  { id: 'rootback_mudskipper', likes: ['roots', 'wood'], biome: 'mangrove', category: 'fish', catch_behavior: 'wary',
    params: { reaction: 'leap', alertR: 50, hideTime: [4, 7], speed: 10 },
    sprite_size: 'small', color: '#8a7a5a', accent: '#c9b48a', art: { shape: 'fish' },
    spawn: { n: 3, at: 'surface' } },
  { id: 'mangrove_fiddler', likes: ['roots', 'shell'], biome: 'mangrove', category: 'crustacean', catch_behavior: 'camouflage',
    params: { freezeOnApproach: true, alpha: 0.22, visibleAlpha: 0.95, crawl: true, moveEvery: [2, 4] },
    sprite_size: 'small', color: '#d9a03a', accent: '#ffcf5a', art: { shape: 'crab', bigclaw: true },
    spawn: { n: 3, at: 'floor' } },
  { id: 'rootcoil_snake', likes: ['roots', 'wood'], biome: 'mangrove', category: 'reptile', catch_behavior: 'camouflage',
    params: { alpha: 0.1, moveEvery: [5, 9], moveTime: [0.8, 1.2], moveSpeed: 20 },
    sprite_size: 'wide', color: '#5a4a2f', accent: '#8a7a4a', art: { shape: 'eel', bands: true, thick: 0.8 },
    spawn: { n: 3, at: 'water', y: [104, 182] } },
  { id: 'dwarf_croc', likes: ['perch', 'wood'], biome: 'mangrove', category: 'reptile', catch_behavior: 'ambush', predator: true,
    hostile: true, knockback: 'strong',
    params: { aggroR: 56, lungeSpeed: 130, alpha: 0.4, surface: true },
    sprite_size: 'widelarge', color: '#556b33', accent: '#c9c48a', art: { shape: 'croc' },
    spawn: { n: 2, at: 'surface' } },
  { id: 'bankside_monitor', likes: ['rock', 'wood'], biome: 'mangrove', category: 'reptile', catch_behavior: 'patrol', predator: true,
    params: { crawl: true, speed: 16, onSpook: 'flee', fleeSpeed: 70, noticeR: 56, span: 90 },
    sprite_size: 'medium', color: '#6a6a4a', accent: '#c9c48a', art: { shape: 'lizard', spots: true },
    spawn: { n: 2, at: 'floor' } },
  { id: 'muckhide_octopus', likes: ['hideout', 'roots'], biome: 'mangrove', category: 'cephalopod', catch_behavior: 'coax',
    params: { emerge: 'bait' },
    sprite_size: 'medium', color: '#7a5a3a', accent: '#a5835a', art: { shape: 'octopus' },
    spawn: { n: 2, at: 'floor' } },
  { id: 'root_tangle', tags: ['roots', 'wood'], biome: 'mangrove', category: 'plant', is_plant: true, catch_behavior: 'plant',
    sprite_size: 'medium', color: '#5b4129', accent: '#4f9440', art: { shape: 'tangle' },
    spawn: { n: 5, at: 'floor' } },

  // ------------------------------------------------------------------ Ice Shelf / Polar Waters (no plant)
  { id: 'frostfin', likes: ['ice', 'bubbles'], biome: 'ice', category: 'fish', catch_behavior: 'school',
    params: { size: [6, 8], tight: 1.5, straggler: true, speed: 24, alertR: 58 },
    sprite_size: 'small', color: '#a6d9f2', accent: '#ffffff', art: { shape: 'fish' },
    spawn: { n: 2, at: 'water', y: [140, 370] } },
  { id: 'iceback_seal_pup', likes: ['ice', 'perch'], biome: 'ice', category: 'mammal', catch_behavior: 'wary',
    params: { reaction: 'dive', bask: true, onIce: true, alertR: 55 },
    sprite_size: 'medium', color: '#f2f6fa', accent: '#c9d6e0', art: { shape: 'otter', plump: true },
    spawn: { n: 2, at: 'ice_top' } },
  { id: 'frost_isopod', likes: ['ice', 'rock'], biome: 'ice', category: 'crustacean', catch_behavior: 'clinger',
    params: { pry: false },
    sprite_size: 'small', color: '#c9e0ee', accent: '#8fb8d0', art: { shape: 'isopod' }, tank: 'crawl',
    spawn: { n: 3, at: 'ceiling' } },
  { id: 'iceshell_snail', likes: ['ice', 'plant'], biome: 'ice', category: 'gastropod', catch_behavior: 'spotting',
    params: { alpha: 0.2, speed: 1.2 },
    sprite_size: 'tiny', color: '#d0f0ff', accent: '#e8f8ff', art: { shape: 'snail', glass: true },
    spawn: { n: 3, at: 'floor' } },

  // ------------------------------------------------------------------ Half-Flooded Lush Cave
  // Five natural axolotl colours (family 'axolotl'), all drawn in the original lush-cave shape: each is its own species with its own log entry,
  // sexes and breeding (a pair always has babies of its own colour). How often each one turns up is
  // set by AQ.data.families.axolotl.weights below.
  { id: 'azalea_axolotl', family: 'axolotl', likes: ['plant', 'light'], biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#f5c6d6', accent: '#ffffff', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { at: 'water' } },
  { id: 'aurum_axolotl', family: 'axolotl', likes: ['plant', 'light'], biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#f2c24a', accent: '#fff3c4', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { at: 'water' } },
  { id: 'pluvia_axolotl', family: 'axolotl', likes: ['plant', 'light'], biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#8ee6ee', accent: '#eafcff', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { at: 'water' } },
  { id: 'viridis_axolotl', family: 'axolotl', likes: ['plant', 'light'], biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#9ed47c', accent: '#efffdf', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { at: 'water' } },
  { id: 'navious_axolotl', family: 'axolotl', likes: ['plant', 'light'], biome: 'lush_cave', category: 'amphibian', catch_behavior: 'easy',
    params: { speed: 7 },
    sprite_size: 'medium', color: '#5a82e0', accent: '#e2eaff', art: { shape: 'lizard', gills: true, belly: true },
    spawn: { at: 'water' } },

  // ---- Day & night update: nine new creatures (night-only, depth-gated, and the new behaviours)
  { id: 'auroravein_squid', voice: 'glow_chime', likes: ['ice', 'light'], biome: 'ice', category: 'cephalopod', catch_behavior: 'drift', active: 'night',
    params: { speed: 6, alpha: 0.95 },
    sprite_size: 'medium', color: '#cfe6dc', accent: '#c9a8ff', art: { shape: 'squid', veins: true }, light: { r: 30, color: '#b8ffd8' },
    spawn: { n: 2, at: 'water', y: [150, 360] } },
  { id: 'moonshell_crab', likes: ['shell', 'rock'], biome: 'tide_pools', category: 'crustacean', catch_behavior: 'camouflage', active: 'night',
    params: { freezeOnApproach: true, alpha: 0.25, visibleAlpha: 0.95, crawl: true, moveEvery: [3, 5] },
    sprite_size: 'small', color: '#dfe4f2', accent: '#a8c4ff', art: { shape: 'crab' }, light: { r: 12, color: '#dfe8ff' },
    spawn: { n: 2, at: 'ground', area: [40, 700] } },
  { id: 'ribbonmane', likes: ['kelp', 'plant'], biome: 'kelp', category: 'fish', catch_behavior: 'mirror',
    params: { range: 72, calmTime: 0.9, approach: 26, wanderR: 50 },
    sprite_size: 'medium', color: '#e8a04a', accent: '#ff7f9a', art: { shape: 'seahorse' },
    spawn: { n: 2, at: 'water', y: [170, 360] } },
  { id: 'candlepolyp', voice: 'glow_chime', tags: ['coral', 'light'], biome: 'coral', category: 'plant', is_plant: true, catch_behavior: 'plant', bloom: 'night',
    params: {},
    sprite_size: 'medium', color: '#6a4a6a', accent: '#ffd98a', art: { shape: 'candlepolyp' }, light: { r: 22, color: '#ffd98a' },
    spawn: { n: 5, at: 'floor' } },
  { id: 'skyleap_flyfish', likes: ['bubbles', 'arch'], biome: 'open_ocean', category: 'fish', catch_behavior: 'midair',
    params: { leapEvery: [2.5, 4.5], leap: 125, speed: 24, depth: 14, wanderR: 100 },
    sprite_size: 'small', color: '#5fa8e8', accent: '#e8f4ff', art: { shape: 'flyfish' },
    spawn: { n: 3, at: 'surface' } },
  { id: 'sail_turtle', voice: 'turtle_note', likes: ['rock', 'arch'], biome: 'open_ocean', category: 'reptile', catch_behavior: 'patrol',
    params: { speed: 10, noticeR: 56, stillNoise: 0.12, span: 40 },
    sprite_size: 'widelarge', color: '#6a9a7a', accent: '#c8a060', art: { shape: 'turtle', sail: true },
    spawn: { n: 1, at: 'water', area: [2600, 3900], y: [200, 520] } },
  { id: 'pressure_tortoise', likes: ['rock', 'crystal'], biome: 'trench', category: 'reptile', catch_behavior: 'defensive', requires_depth: 3, tank: 'crawl',
    params: { alertR: 40, relaxTime: 2.5, withdraw: true },
    sprite_size: 'wide', color: '#5a5a6a', accent: '#8f98b8', art: { shape: 'turtle', dome: true },
    spawn: { n: 1, at: 'floor', area: [3615, 3695], y: [1280, 1300] } },
  { id: 'bellcrab', voice: 'bell_tiny', likes: ['metal', 'treasure'], biome: 'ruins', category: 'crustacean', catch_behavior: 'wary',
    params: { reaction: 'hide', pry: true, alertR: 46, speed: 6, wanderR: 28 },
    sprite_size: 'small', color: '#c8a060', accent: '#d8c090', art: { shape: 'crab', bell: true },
    spawn: { n: 2, at: 'floor' } },
  { id: 'firefly_frog', voice: 'glow_chime', likes: ['roots', 'plant'], biome: 'mangrove', category: 'amphibian', catch_behavior: 'lure', active: 'night',
    params: { decoyDist: 11, decoyColor: '#f0ff8a', alpha: 0.55, glow: 28 },
    sprite_size: 'small', color: '#4a6a3a', accent: '#e8ff7a', art: { shape: 'frog', glow: true }, light: { r: 12, color: '#e8ff8a' },
    spawn: { n: 2, at: 'floor' } },

  // ------------------------------------------------------------------ Starfall (night events only)
  // No wild spawn: `event` creatures only appear where a falling star lands (src/starfall.js).
  // event: 'star' = any falling star, 'shower' = only during meteor showers. Their tank is Starfall.
  // bottle: the sea biome their message bottle lies in (they have no biome of their own in the sea).
  { id: 'starfall_minnow', likes: ['stardust', 'light'], biome: 'starfall', category: 'fish', catch_behavior: 'dart',
    event: 'star', bottle: 'open_ocean', light: { r: 20, color: '#cfe4ff' },
    params: { alertR: 44, runTime: [0.7, 1.1], pauseTime: [1.4, 2.2], runSpeed: 60, erratic: true },
    sprite_size: 'tiny', color: '#d8ecff', accent: '#fff3a8', art: { shape: 'fish', starry: true } },
  { id: 'aerolite_crab', likes: ['meteorite', 'hideout'], biome: 'starfall', category: 'crustacean', catch_behavior: 'wary',
    event: 'star', bottle: 'tide_pools', light: { r: 16, color: '#ffd8a8' },
    params: { reaction: 'hide', pry: true, alertR: 46, speed: 6, wanderR: 22 },
    sprite_size: 'small', color: '#6e6a74', accent: '#ffb86a', art: { shape: 'crab', rocky: true } },
  { id: 'comet_ray', likes: ['stardust', 'arch'], biome: 'starfall', category: 'fish', catch_behavior: 'curious',
    event: 'shower', bottle: 'coral', light: { r: 30, color: '#b8d8ff' },
    params: { approachR: 130, keepDist: 26 },
    sprite_size: 'widelarge', color: '#3a4a8a', accent: '#bfe8ff', art: { shape: 'ray' } },
];

// Families: species that belong together (the log groups them under one heading). A family with
// `slots` shares that many spawn places in its biome; each time a place fills, one member is picked
// by `weights` (bigger = more common). `variantArt` replaces the usual hue-shifted rare-variant look
// with a pattern, so a rare bred one never looks like another natural colour.
AQ.data.families = {
  axolotl: {
    slots: 5,
    weights: { azalea_axolotl: 30, viridis_axolotl: 30, pluvia_axolotl: 14, navious_axolotl: 14, aurum_axolotl: 4 },
    variantArt: { color: '#f6f1e6', accent: '#e9c86a', speckle: '#d9a21e' }   // white with gold speckles
  }
};
