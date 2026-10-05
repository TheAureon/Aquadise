// Aquarium tanks: per-tank looks (tankStyles), the predator tanks (predatorTanks) and special tanks
// that aren't a sea biome (specialTanks: Starfall, home of the falling-star creatures).
// Per-tank aquarium looks. Every field is optional; missing ones fall back to `default`.
// top/deep:  water gradient colours (top of tank -> sand)
// shafts:    strength of the swaying light shafts from the lid (0 = none)
// caustics:  strength of the light ripples on the sand
// dark:      how dark the tank is (0..1). In dark tanks, decor with a `glow` colour lights it up.
// particles: motes | snow (slow falling flakes) | embers (warm rising sparks) | fireflies | spores
// lamp:      colour of the LED strip in the lid
// glow:      optional soft colour glowing up from the middle of the tank (Starfall)
// particles: ...also 'stars' (drifting, twinkling star motes) and 'soft' (slow pastel bubbles, the Nursery)
// windowGlow: optional warm glow around the tank's window in the building (the Nursery)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.tankStyles = {
  default:    { shafts: 0.05, caustics: 0.22, dark: 0, particles: 'motes', lamp: '#9feff0' },
  tide_pools: { top: '#c4f2ee', deep: '#3a9fb8', shafts: 0.07, caustics: 0.3, lamp: '#fff3c4' },
  kelp:       { top: '#a8e2c4', deep: '#1d5b55', shafts: 0.08, caustics: 0.2, particles: 'spores', lamp: '#c8f0a0' },
  coral:      { top: '#b0f2f6', deep: '#2a7fb8', shafts: 0.08, caustics: 0.3, lamp: '#ffd0e0' },
  trench:     { top: '#2a4470', deep: '#050b1e', shafts: 0, caustics: 0, dark: 0.5, particles: 'snow', lamp: '#5f7fff' },
  cave:       { top: '#3e5a6a', deep: '#0e1a24', shafts: 0.02, caustics: 0.04, dark: 0.38, particles: 'motes', lamp: '#9fb8c8' },
  open_ocean: { top: '#94dcf6', deep: '#1846a0', shafts: 0.1, caustics: 0.26, lamp: '#bff6ff' },
  ruins:      { top: '#8cc4b8', deep: '#1a3a48', shafts: 0.06, caustics: 0.18, dark: 0.12, lamp: '#ffe9a8' },
  vents:      { top: '#6a4048', deep: '#1a0a10', shafts: 0, caustics: 0.05, dark: 0.32, particles: 'embers', lamp: '#ff9a5a' },
  mangrove:   { top: '#b4cc8a', deep: '#33452a', shafts: 0.07, caustics: 0.14, dark: 0.05, particles: 'spores', lamp: '#e8f0a0' },
  ice:        { top: '#eefcff', deep: '#4f9ccc', shafts: 0.11, caustics: 0.32, particles: 'snow', lamp: '#ffffff' },
  lush_cave:  { top: '#5a7a6a', deep: '#141e2a', shafts: 0.03, caustics: 0.06, dark: 0.32, particles: 'fireflies', lamp: '#ffc0f0' },
  starfall:   { top: '#2c2a6e', deep: '#0a0a26', shafts: 0.02, caustics: 0.05, dark: 0.3, particles: 'stars', lamp: '#c8b8ff', glow: '#6f5fd8' },
  nursery:    { top: '#ffe6ee', deep: '#a8c8e0', shafts: 0.09, caustics: 0.24, particles: 'soft', lamp: '#ffd8e8', glow: '#ffd0a8', windowGlow: '#ffd6b8' },
  // predator tanks (4th floor)
  pred_reef:  { top: '#9fe2e8', deep: '#1f5f8a', shafts: 0.07, caustics: 0.24, dark: 0.08, lamp: '#ffb0a0' },
  pred_open:  { top: '#7fc8ea', deep: '#0f3478', shafts: 0.09, caustics: 0.2, lamp: '#bfe0ff' },
  pred_deep:  { top: '#1e3058', deep: '#03060f', shafts: 0, caustics: 0, dark: 0.55, particles: 'snow', lamp: '#7f6fff' },
  pred_cave:  { top: '#3a4a52', deep: '#0a1218', shafts: 0.02, caustics: 0.03, dark: 0.42, particles: 'motes', lamp: '#a8c8b8' },
  pred_swamp: { top: '#a8b878', deep: '#28351e', shafts: 0.06, caustics: 0.12, dark: 0.1, particles: 'spores', lamp: '#f0e08a' }
};

// Predator tanks. Predators (creatures with `predator: true` in data/creatures.js) live here instead of
// in their biome's tank. Regroup them by moving ids between `members`; a predator not listed in any
// group falls back to the group whose `themes` include its biome, then to the first group.
//   themes:  biomes whose decor/plants count as "on theme" for this tank (vibe theme bonus, tray order)
//   theme:   which biome-style silhouettes to paint in the tank backdrop
//   (names: tank.<id>.name / .short / .tiny in data/lang/en.js; tiny = the shortest label, used when names
//   must squeeze, e.g. the zoomed-out building)
//   palette: sand (top) and rock colours, like a biome palette; water: tint colour
AQ.data.predatorTanks = [
  { id: 'pred_reef', members: ['coral_viper', 'wreck_eel'],
    themes: ['coral', 'ruins'], theme: 'coral', water: '#2f9ab8',
    palette: { top: ['#e8d6a8', '#d6c08e', '#c0a878'], rock: ['#a88a72', '#8d725d', '#725c4a'] } },
  { id: 'pred_open', members: ['reeftooth'],
    themes: ['open_ocean'], theme: 'open_ocean', water: '#1f5fa8',
    palette: { top: ['#6d7c88', '#5d6b78', '#4f5c68'], rock: ['#46525e', '#3c4652', '#323b46'] } },
  { id: 'pred_deep', members: ['lanternjaw', 'trenchmaw'],
    themes: ['trench', 'vents'], theme: 'vents', water: '#050c1c',
    palette: { top: ['#2c3448', '#252c3d', '#1e2433'], rock: ['#1b2130', '#161b27', '#11151f'] } },
  { id: 'pred_cave', members: ['cave_crawler'],
    themes: ['cave', 'lush_cave'], theme: 'ruins', water: '#1c3550',
    palette: { top: ['#56606b', '#4a535d', '#3f4750'], rock: ['#3e444d', '#343941', '#2a2e35'] } },
  { id: 'pred_swamp', members: ['dwarf_croc', 'bankside_monitor'],
    themes: ['mangrove'], theme: 'mangrove', water: '#5c7a3a',
    palette: { top: ['#6e5a3c', '#5c4b32', '#4a3c29'], rock: ['#4e4234', '#41372b', '#342c23'] } }
];

// Tanks that aren't a sea biome. Same fields as a predator tank (palette = sand/rock colours).
// nursery: true marks the Universal Nursery (src/nursery.js): every bred egg and baby goes there.
AQ.data.specialTanks = [
  { id: 'nursery', nursery: true, themes: ['nursery'], theme: 'nursery', water: '#e8b8c8',
    palette: { top: ['#f8ead0', '#eedcbc', '#e0caa4'], rock: ['#e8ccd8', '#d4b4c4', '#c09cb0'] } },
  { id: 'starfall', themes: ['starfall'], theme: 'starfall', water: '#1c1650',
    palette: { top: ['#5a5480', '#4a4470', '#3a3660'], rock: ['#3a3458', '#2e2a48', '#24203a'] } }
];
