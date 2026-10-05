// Aquarium decorations. Unlimited once available; harvested plants are added on top.
// kind:    floor (sits on the sand) | float (hangs at the water top; `hang` = px it dips below the surface)
// tags:    what the piece "is" - creatures' likes (data/creatures.js) refer to these tags.
//          rock shell coral kelp plant wood metal arch pillar hideout perch light ice crystal roots
//          treasure vent bubbles meteorite stardust
// biomes:  tanks it matches for the vibe "theme" bonus (omit = fits anywhere, no bonus)
// unlock:  { biome | tank, tier } - unlocked when that biome's (or predator) tank first reaches the star count for that tier
//          (tiers 1/2/3 = AQ.TUNING.aquarium.unlockStars in config.js; `stars: n` overrides). Omit = always.
// glow:    colour of the soft light it gives off in dark tanks (light-tagged pieces)
// The first 13 pieces are the basic set; after them each biome has one free themed piece and
// three that unlock at tiers 1, 2 and 3.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.decorations = [
  { id: 'pebble_rock', name: 'Rock', kind: 'floor', sprite_size: 'small', color: '#8c8178', art: { shape: 'rock', seed: 2 }, tags: ['rock', 'perch'] },
  { id: 'boulder', name: 'Boulder', kind: 'floor', sprite_size: 'medium', color: '#76706a', art: { shape: 'rock', seed: 5 }, tags: ['rock', 'perch'] },
  { id: 'seashell', name: 'Seashell', kind: 'floor', sprite_size: 'tiny', color: '#f2d9c4', art: { shape: 'shell' }, tags: ['shell'], biomes: ['tide_pools', 'coral'] },
  { id: 'starfish', name: 'Starfish', kind: 'floor', sprite_size: 'tiny', color: '#f08a3c', accent: '#ffd27a', art: { shape: 'starfish' }, tags: ['shell'], biomes: ['tide_pools', 'coral'] },
  { id: 'driftwood', name: 'Driftwood', kind: 'floor', sprite_size: 'wide', color: '#8a6a4a', art: { shape: 'driftwood' }, tags: ['wood', 'perch'], biomes: ['tide_pools', 'mangrove'] },
  { id: 'amphora', name: 'Amphora', kind: 'floor', sprite_size: 'small', color: '#c4703a', accent: '#f2c14e', art: { shape: 'amphora' }, tags: ['hideout', 'treasure'], biomes: ['ruins'] },
  { id: 'castle', name: 'Sand Castle', kind: 'floor', sprite_size: 'large', color: '#d9c49a', art: { shape: 'castle' }, tags: ['hideout'], biomes: ['tide_pools', 'coral'] },
  { id: 'arch', name: 'Stone Arch', kind: 'floor', sprite_size: 'large', color: '#8a8478', art: { shape: 'arch' }, tags: ['arch', 'hideout', 'rock'], biomes: ['coral', 'kelp'] },
  { id: 'treasure', name: 'Treasure Chest', kind: 'floor', sprite_size: 'small', color: '#9b5a2e', art: { shape: 'treasure' }, tags: ['treasure', 'hideout'], biomes: ['ruins'] },
  { id: 'pillar', name: 'Ruined Pillar', kind: 'floor', sprite_size: 'tall', color: '#c9c4b8', art: { shape: 'pillar' }, tags: ['pillar'], biomes: ['ruins'] },
  { id: 'anchor', name: 'Anchor', kind: 'floor', sprite_size: 'medium', color: '#6a6460', art: { shape: 'anchor' }, tags: ['metal'], biomes: ['ruins', 'open_ocean'] },
  { id: 'barrel', name: 'Old Barrel', kind: 'floor', sprite_size: 'small', color: '#8a5b33', art: { shape: 'barrel' }, tags: ['wood', 'hideout'], biomes: ['ruins'] },
  { id: 'bubbler', name: 'Bubbler', kind: 'floor', sprite_size: 'tiny', color: '#9aa4ae', art: { shape: 'bubbler' }, bubbles: true, tags: ['bubbles'] },

  // ---- Tide Pools
  { id: 'sand_dollar', name: 'Sand Dollar', kind: 'floor', sprite_size: 'tiny', color: '#e8d2b0', art: { shape: 'sanddollar' }, tags: ['shell'], biomes: ['tide_pools'] },
  { id: 'anemone_rock', name: 'Anemone Rock', kind: 'floor', sprite_size: 'medium', color: '#8c8178', accent: '#ff8fb0', art: { shape: 'anemonerock' }, tags: ['rock', 'perch', 'shell', 'plant'], biomes: ['tide_pools'], unlock: { biome: 'tide_pools', tier: 1 } },
  { id: 'sand_pail', name: 'Lost Sand Pail', kind: 'floor', sprite_size: 'medium', color: '#ff7a59', accent: '#ffe08a', art: { shape: 'pail' }, tags: ['hideout'], biomes: ['tide_pools'], unlock: { biome: 'tide_pools', tier: 2 } },
  { id: 'lighthouse', name: 'Tiny Lighthouse', kind: 'floor', sprite_size: 'tall', color: '#f4f0e6', accent: '#d94f4f', art: { shape: 'lighthouse' }, tags: ['light', 'pillar'], glow: '#fff1a8', biomes: ['tide_pools'], unlock: { biome: 'tide_pools', tier: 3 } },

  // ---- Kelp Forest
  { id: 'kelp_stalk', name: 'Kelp Stalk', kind: 'floor', sprite_size: 'tall', color: '#6b8f3a', accent: '#a8c460', art: { shape: 'kelp' }, tags: ['kelp', 'plant'], biomes: ['kelp'] },
  { id: 'otter_rock', name: 'Otter Rock', kind: 'floor', sprite_size: 'wide', color: '#6e705f', art: { shape: 'flatrock', seed: 6, moss: '#7a9a3a' }, tags: ['rock', 'perch'], biomes: ['kelp'], unlock: { biome: 'kelp', tier: 1 } },
  { id: 'sea_urchin', name: 'Sea Urchin', kind: 'floor', sprite_size: 'small', color: '#6a3f8a', accent: '#c9a0ff', art: { shape: 'urchin' }, tags: ['shell', 'rock'], biomes: ['kelp'], unlock: { biome: 'kelp', tier: 2 } },
  { id: 'kelp_arch', name: 'Kelp-Draped Arch', kind: 'floor', sprite_size: 'large', color: '#6e705f', art: { shape: 'kelparch', kelp: '#6b8f3a' }, tags: ['arch', 'kelp', 'hideout', 'rock'], biomes: ['kelp'], unlock: { biome: 'kelp', tier: 3 } },

  // ---- Coral Shelf
  { id: 'branch_coral', name: 'Branch Coral', kind: 'floor', sprite_size: 'medium', color: '#ef8aa0', accent: '#ffd0dc', art: { shape: 'branchcoral', seed: 4 }, tags: ['coral'], biomes: ['coral'] },
  { id: 'giant_clam', name: 'Giant Clam', kind: 'floor', sprite_size: 'medium', color: '#7fb0c8', accent: '#3fd0c0', art: { shape: 'clam' }, tags: ['shell', 'hideout', 'treasure'], biomes: ['coral'], unlock: { biome: 'coral', tier: 1 } },
  { id: 'sea_fan', name: 'Sea Fan', kind: 'floor', sprite_size: 'large', color: '#b45ac8', accent: '#ffd0ff', art: { shape: 'seafan' }, tags: ['coral', 'plant'], biomes: ['coral'], unlock: { biome: 'coral', tier: 2 } },
  { id: 'coral_tower', name: 'Coral Tower', kind: 'floor', sprite_size: 'large', color: '#ffb347', accent: '#fff1a8', art: { shape: 'branchcoral', seed: 11 }, tags: ['coral', 'perch', 'pillar'], biomes: ['coral'], unlock: { biome: 'coral', tier: 3 } },

  // ---- Deep Trench
  { id: 'glow_stone', name: 'Glow Stone', kind: 'floor', sprite_size: 'small', color: '#3a4458', art: { shape: 'glowstone', glow: '#7ff6ff' }, tags: ['rock', 'light', 'perch'], glow: '#7ff6ff', biomes: ['trench'] },
  { id: 'tube_worms', name: 'Tube Worms', kind: 'floor', sprite_size: 'medium', color: '#e8e2d6', accent: '#e0403a', art: { shape: 'tubeworms' }, tags: ['vent', 'plant'], biomes: ['trench', 'vents'], unlock: { biome: 'trench', tier: 1 } },
  { id: 'whale_bones', name: 'Whale Bones', kind: 'floor', sprite_size: 'widelarge', color: '#d8d2bf', art: { shape: 'ribs' }, tags: ['arch', 'hideout'], biomes: ['trench'], unlock: { biome: 'trench', tier: 2 } },
  { id: 'abyss_lantern', name: 'Abyss Lantern', kind: 'floor', sprite_size: 'small', color: '#4a4a52', accent: '#9ff6ff', art: { shape: 'lantern' }, tags: ['light', 'metal'], glow: '#9ff6ff', biomes: ['trench'], unlock: { biome: 'trench', tier: 3 } },

  // ---- Flooded Cave
  { id: 'stalagmite', name: 'Stalagmite', kind: 'floor', sprite_size: 'tall', color: '#56606b', art: { shape: 'stalagmite' }, tags: ['rock', 'pillar'], biomes: ['cave'] },
  { id: 'cave_crystals', name: 'Cave Crystals', kind: 'floor', sprite_size: 'medium', color: '#8a7fe0', accent: '#c4bcff', art: { shape: 'crystals' }, tags: ['crystal', 'light'], glow: '#b4a8ff', biomes: ['cave', 'lush_cave'], unlock: { biome: 'cave', tier: 1 } },
  { id: 'rock_den', name: 'Rock Den', kind: 'floor', sprite_size: 'large', color: '#4a535d', art: { shape: 'den' }, tags: ['rock', 'hideout', 'perch'], biomes: ['cave'], unlock: { biome: 'cave', tier: 2 } },
  { id: 'geode', name: 'Geode', kind: 'floor', sprite_size: 'medium', color: '#7a746c', accent: '#b46cff', art: { shape: 'geode' }, tags: ['crystal', 'rock', 'treasure', 'light'], glow: '#d0a0ff', biomes: ['cave'], unlock: { biome: 'cave', tier: 3 } },

  // ---- Open Ocean
  { id: 'buoy', name: 'Buoy', kind: 'float', hang: 10, sprite_size: 'small', color: '#e8503a', accent: '#f4f0e6', art: { shape: 'buoy' }, tags: ['metal', 'light'], glow: '#fff1a8', biomes: ['open_ocean'] },
  { id: 'message_bottle', name: 'Message in a Bottle', kind: 'floor', sprite_size: 'small', color: '#5fbf8f', art: { shape: 'bottle' }, tags: ['treasure'], biomes: ['open_ocean'], unlock: { biome: 'open_ocean', tier: 1 } },
  { id: 'glass_floats', name: 'Glass Floats', kind: 'float', hang: 8, sprite_size: 'small', color: '#5fd0e0', accent: '#8fe0a0', art: { shape: 'glassfloat' }, tags: ['bubbles', 'light'], glow: '#bff6ff', biomes: ['open_ocean'], unlock: { biome: 'open_ocean', tier: 2 } },
  { id: 'ships_wheel', name: "Ship's Wheel", kind: 'floor', sprite_size: 'medium', color: '#8a5b33', accent: '#f2c14e', art: { shape: 'wheel' }, tags: ['wood', 'metal', 'arch'], biomes: ['open_ocean', 'ruins'], unlock: { biome: 'open_ocean', tier: 3 } },

  // ---- Sunken Ruins
  { id: 'broken_column', name: 'Broken Column', kind: 'floor', sprite_size: 'medium', color: '#c9c4b8', art: { shape: 'brokencolumn' }, tags: ['pillar', 'rock', 'perch'], biomes: ['ruins'] },
  { id: 'statue_head', name: 'Statue Head', kind: 'floor', sprite_size: 'large', color: '#a6a290', accent: '#7a9a3a', art: { shape: 'statuehead' }, tags: ['rock', 'treasure', 'perch'], biomes: ['ruins'], unlock: { biome: 'ruins', tier: 1 } },
  { id: 'old_cannon', name: 'Old Cannon', kind: 'floor', sprite_size: 'wide', color: '#4a4a52', art: { shape: 'cannon' }, tags: ['metal', 'hideout'], biomes: ['ruins'], unlock: { biome: 'ruins', tier: 2 } },
  { id: 'golden_idol', name: 'Golden Idol', kind: 'floor', sprite_size: 'small', color: '#f2c14e', art: { shape: 'idol' }, tags: ['treasure', 'light'], glow: '#ffe08a', biomes: ['ruins'], unlock: { biome: 'ruins', tier: 3 } },

  // ---- Volcanic Vents
  { id: 'mini_vent', name: 'Mini Vent', kind: 'floor', sprite_size: 'small', color: '#3d3338', art: { shape: 'chimney', glow: '#ff8a3a' }, bubbles: true, tags: ['vent', 'bubbles', 'light'], glow: '#ff9a5a', biomes: ['vents'] },
  { id: 'basalt_columns', name: 'Basalt Columns', kind: 'floor', sprite_size: 'medium', color: '#3a3438', art: { shape: 'basalt' }, tags: ['rock', 'pillar', 'perch'], biomes: ['vents'], unlock: { biome: 'vents', tier: 1 } },
  { id: 'sulfur_crystals', name: 'Sulfur Crystals', kind: 'floor', sprite_size: 'small', color: '#e8d040', accent: '#fff3a0', art: { shape: 'crystals' }, tags: ['crystal', 'vent', 'light'], glow: '#fff08a', biomes: ['vents'], unlock: { biome: 'vents', tier: 2 } },
  { id: 'magma_rock', name: 'Magma Rock', kind: 'floor', sprite_size: 'medium', color: '#2f282c', art: { shape: 'magmarock', glow: '#ff7a2a' }, tags: ['rock', 'vent', 'light', 'perch'], glow: '#ff7a2a', biomes: ['vents'], unlock: { biome: 'vents', tier: 3 } },

  // ---- Mangrove Roots
  { id: 'mangrove_roots', name: 'Mangrove Roots', kind: 'floor', sprite_size: 'widelarge', color: '#5c4b32', accent: '#7d8f3c', art: { shape: 'roots' }, tags: ['roots', 'wood', 'hideout'], biomes: ['mangrove'] },
  { id: 'lily_pad', name: 'Lily Pad', kind: 'float', hang: 12, sprite_size: 'small', color: '#5fa04a', art: { shape: 'lilypad', flower: '#ffb0d0' }, tags: ['plant'], biomes: ['mangrove', 'lush_cave'], unlock: { biome: 'mangrove', tier: 1 } },
  { id: 'mud_mound', name: 'Mud Mound', kind: 'floor', sprite_size: 'wide', color: '#5c4b32', art: { shape: 'flatrock', seed: 8, moss: '#7d8f3c' }, tags: ['rock', 'perch'], biomes: ['mangrove'], unlock: { biome: 'mangrove', tier: 2 } },
  { id: 'hollow_log', name: 'Hollow Log', kind: 'floor', sprite_size: 'wide', color: '#6e5236', accent: '#7d8f3c', art: { shape: 'log' }, tags: ['wood', 'hideout', 'perch', 'roots'], biomes: ['mangrove'], unlock: { biome: 'mangrove', tier: 3 } },

  // ---- Ice Shelf
  { id: 'ice_chunk', name: 'Ice Chunk', kind: 'floor', sprite_size: 'medium', color: '#d2ebf7', accent: '#9fd3ee', art: { shape: 'icechunk' }, tags: ['ice', 'perch'], biomes: ['ice'] },
  { id: 'icicle_spire', name: 'Icicle Spire', kind: 'floor', sprite_size: 'tall', color: '#b4d8ea', art: { shape: 'stalagmite' }, tags: ['ice', 'pillar'], biomes: ['ice'], unlock: { biome: 'ice', tier: 1 } },
  { id: 'ice_cave', name: 'Ice Cave', kind: 'floor', sprite_size: 'large', color: '#d2ebf7', art: { shape: 'icecave' }, tags: ['ice', 'hideout'], biomes: ['ice'], unlock: { biome: 'ice', tier: 2 } },
  { id: 'frost_crystal', name: 'Frost Crystal', kind: 'floor', sprite_size: 'medium', color: '#bff6ff', accent: '#ffffff', art: { shape: 'crystals' }, tags: ['ice', 'crystal', 'light'], glow: '#d8fbff', biomes: ['ice'], unlock: { biome: 'ice', tier: 3 } },

  // ---- Lush Cave
  { id: 'glow_mushrooms', name: 'Glow Mushrooms', kind: 'floor', sprite_size: 'small', color: '#ff9fd0', accent: '#fff1a8', art: { shape: 'mushroom' }, tags: ['plant', 'light'], glow: '#ffb0e0', biomes: ['lush_cave'] },
  { id: 'mossy_stone', name: 'Mossy Stone', kind: 'floor', sprite_size: 'wide', color: '#5a5560', art: { shape: 'flatrock', seed: 3, moss: '#6fa456' }, tags: ['rock', 'plant', 'perch'], biomes: ['lush_cave'], unlock: { biome: 'lush_cave', tier: 1 } },
  { id: 'flower_arch', name: 'Flower Arch', kind: 'floor', sprite_size: 'large', color: '#5a5560', accent: '#ff9fd0', art: { shape: 'florarch', leaf: '#6fa456' }, tags: ['arch', 'plant', 'hideout'], biomes: ['lush_cave'], unlock: { biome: 'lush_cave', tier: 2 } },
  { id: 'fairy_lantern', name: 'Fairy Lantern', kind: 'floor', sprite_size: 'small', color: '#5a4a3a', accent: '#ffd0f0', art: { shape: 'lantern', metal: '#6a5a4a' }, tags: ['light'], glow: '#ffc0f0', biomes: ['lush_cave'], unlock: { biome: 'lush_cave', tier: 3 } },

  // ---- Predator tanks (4th floor): their basics come from their theme biomes; these unlock with stars
  { id: 'ambush_coral', name: 'Ambush Coral', kind: 'floor', sprite_size: 'medium', color: '#c8503a', accent: '#ffb0a0', art: { shape: 'branchcoral', seed: 7 }, tags: ['coral', 'hideout'], biomes: ['pred_reef'], unlock: { tank: 'pred_reef', tier: 1 } },
  { id: 'wreck_ribs', name: 'Wreck Ribs', kind: 'floor', sprite_size: 'widelarge', color: '#7a5a3a', art: { shape: 'ribs' }, tags: ['wood', 'arch', 'hideout'], biomes: ['pred_reef'], unlock: { tank: 'pred_reef', tier: 2 } },
  { id: 'reef_throne', name: 'Reef Throne', kind: 'floor', sprite_size: 'large', color: '#8a7a6a', accent: '#ff8aa0', art: { shape: 'kelparch', kelp: '#ef8aa0' }, tags: ['arch', 'coral', 'rock', 'perch'], biomes: ['pred_reef'], unlock: { tank: 'pred_reef', tier: 3 } },
  { id: 'drift_rope', name: 'Drift Rope', kind: 'float', hang: 10, sprite_size: 'medium', color: '#b49a6a', accent: '#d8c090', art: { shape: 'tangle' }, tags: ['wood'], biomes: ['pred_open'], unlock: { tank: 'pred_open', tier: 1 } },
  { id: 'great_bones', name: 'Great Bones', kind: 'floor', sprite_size: 'widelarge', color: '#e6dfcc', art: { shape: 'ribs' }, tags: ['arch', 'hideout'], biomes: ['pred_open'], unlock: { tank: 'pred_open', tier: 2 } },
  { id: 'storm_buoy', name: 'Storm Buoy', kind: 'float', hang: 10, sprite_size: 'small', color: '#f2c14e', accent: '#2a2a32', art: { shape: 'buoy' }, tags: ['metal', 'light'], glow: '#fff1a8', biomes: ['pred_open'], unlock: { tank: 'pred_open', tier: 3 } },
  { id: 'angler_lamp', name: 'Angler Lamp', kind: 'floor', sprite_size: 'small', color: '#3a3448', accent: '#c8a0ff', art: { shape: 'lantern', metal: '#3a3448' }, tags: ['light', 'metal'], glow: '#c8a0ff', biomes: ['pred_deep'], unlock: { tank: 'pred_deep', tier: 1 } },
  { id: 'abyss_spire', name: 'Abyss Spire', kind: 'floor', sprite_size: 'tall', color: '#252c3d', art: { shape: 'stalagmite', seed: 5 }, tags: ['rock', 'pillar'], biomes: ['pred_deep'], unlock: { tank: 'pred_deep', tier: 2 } },
  { id: 'hunter_geode', name: 'Hunter Geode', kind: 'floor', sprite_size: 'medium', color: '#2f2a3a', accent: '#7ff6ff', art: { shape: 'geode' }, tags: ['crystal', 'rock', 'light', 'treasure'], glow: '#7ff6ff', biomes: ['pred_deep'], unlock: { tank: 'pred_deep', tier: 3 } },
  { id: 'gnaw_rock', name: 'Gnawed Rock', kind: 'floor', sprite_size: 'wide', color: '#4a535d', art: { shape: 'flatrock', seed: 9 }, tags: ['rock', 'perch'], biomes: ['pred_cave'], unlock: { tank: 'pred_cave', tier: 1 } },
  { id: 'burrow_den', name: 'Burrow Den', kind: 'floor', sprite_size: 'large', color: '#3e444d', art: { shape: 'den' }, tags: ['rock', 'hideout'], biomes: ['pred_cave'], unlock: { tank: 'pred_cave', tier: 2 } },
  { id: 'glow_crystals', name: 'Glow Crystals', kind: 'floor', sprite_size: 'medium', color: '#5fe0b0', accent: '#d0fff0', art: { shape: 'crystals' }, tags: ['crystal', 'light'], glow: '#a0ffd8', biomes: ['pred_cave'], unlock: { tank: 'pred_cave', tier: 3 } },
  { id: 'basking_log', name: 'Basking Log', kind: 'floor', sprite_size: 'wide', color: '#6e5236', accent: '#7d8f3c', art: { shape: 'log' }, tags: ['wood', 'perch', 'hideout'], biomes: ['pred_swamp'], unlock: { tank: 'pred_swamp', tier: 1 } },
  { id: 'reed_clump', name: 'Reed Clump', kind: 'floor', sprite_size: 'medium', color: '#7d8f3c', accent: '#c8b070', art: { shape: 'tuft' }, tags: ['plant', 'roots'], biomes: ['pred_swamp'], unlock: { tank: 'pred_swamp', tier: 2 } },
  { id: 'swamp_lantern', name: 'Swamp Lantern', kind: 'floor', sprite_size: 'small', color: '#5a4a3a', accent: '#ffd890', art: { shape: 'lantern', metal: '#4a3a2a' }, tags: ['light'], glow: '#ffd890', biomes: ['pred_swamp'], unlock: { tank: 'pred_swamp', tier: 3 } },
  // Starfall tank: one free piece, three that unlock at its tiers
  // ---- Universal Nursery (all free from the start)
  { id: 'shell_cradle', name: 'Shell Cradle', kind: 'floor', sprite_size: 'small', color: '#ffd8e0', accent: '#fff4e8', art: { shape: 'shellcradle' }, tags: ['shell', 'hideout'], biomes: ['nursery'] },
  { id: 'bubble_mobile', name: 'Bubble Mobile', kind: 'float', hang: 20, sprite_size: 'medium', color: '#c8b8e8', accent: '#bfeaff', art: { shape: 'bubblemobile' }, tags: ['bubbles', 'light'], glow: '#ffe0f0', biomes: ['nursery'] },
  { id: 'soft_sand_mound', name: 'Soft Sand Mound', kind: 'floor', sprite_size: 'wide', color: '#f4e2c4', accent: '#ffc8d8', art: { shape: 'sandmound' }, tags: ['perch'], biomes: ['nursery'] },
  { id: 'pebble_nest', name: 'Little Pebble Nest', kind: 'floor', sprite_size: 'small', color: '#cdbfb4', accent: '#ffe8a8', art: { shape: 'pebblenest' }, tags: ['rock', 'hideout'], biomes: ['nursery'] },
  { id: 'stardust_patch', name: 'Stardust Patch', kind: 'floor', sprite_size: 'small', color: '#3a3460', accent: '#fff3b0', art: { shape: 'stardust' }, tags: ['stardust'], glow: '#d8d0ff', biomes: ['starfall'] },
  { id: 'meteorite_rock', name: 'Meteorite Rock', kind: 'floor', sprite_size: 'medium', color: '#4a4650', accent: '#ff9a5a', art: { shape: 'meteorite' }, tags: ['meteorite', 'rock', 'perch'], glow: '#ffb070', biomes: ['starfall'], unlock: { tank: 'starfall', tier: 1 } },
  { id: 'crater_bowl', name: 'Crater Bowl', kind: 'floor', sprite_size: 'wide', color: '#5a5668', accent: '#b8b0d8', art: { shape: 'crater' }, tags: ['meteorite', 'hideout', 'rock'], biomes: ['starfall'], unlock: { tank: 'starfall', tier: 2 } },
  { id: 'star_lantern', name: 'Star Lantern', kind: 'floor', sprite_size: 'tall', color: '#3a3a5a', accent: '#fff3a8', art: { shape: 'starlantern' }, tags: ['light', 'pillar'], glow: '#fff1a8', biomes: ['starfall'], unlock: { tank: 'starfall', tier: 3 } }
];
