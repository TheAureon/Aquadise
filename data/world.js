// World layout (side-view cross-section, left -> right, following the design sketch).
// Edit freely: floor points, biome rectangles, palettes, terrain shapes, props, spawns.
// Coordinates are world pixels. y grows downward; seaLevel is the water surface.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.world = {
  width: 6800,
  height: 1280,
  seaLevel: 96,
  seed: 7,
  playerStart: [372, 108],

  // Seabed profile: [x, y, roughness]. Everything below the line is solid.
  floor: [
    // Tide pools / shallows: rocky outcrops poking above the waterline, sloping gently down
    [0, 70, 2], [30, 74, 2], [60, 86, 2], [85, 104, 2], [110, 112, 2], [135, 90, 2], [160, 86, 2], [185, 104, 2],
    [210, 114, 2], [235, 92, 2], [260, 88, 2], [285, 104, 2], [310, 114, 3], [350, 120, 4], [400, 128, 4],
    [440, 140, 5], [480, 152, 5], [540, 168, 4], [600, 186, 4], [650, 206, 3], [700, 236, 3],
    // Coral shelf: long and fairly flat
    [740, 250, 4], [900, 246, 6], [1050, 252, 6], [1200, 248, 6], [1350, 256, 6], [1500, 252, 6], [1650, 258, 6], [1800, 262, 5],
    // Sunken ruins at the shelf edge
    [1900, 266, 3], [2050, 270, 3], [2200, 272, 3], [2380, 276, 3],
    // Steep drop-off
    [2440, 300, 6], [2500, 370, 8], [2560, 450, 8], [2620, 530, 8], [2680, 610, 8], [2730, 690, 6], [2770, 760, 5],
    // Volcanic vents at the bottom of the slope
    [2800, 790, 4], [2900, 800, 6], [3000, 795, 6], [3100, 802, 6], [3200, 798, 6], [3290, 806, 4],
    // Deep trench (steep walls)
    [3320, 830, 4], [3335, 900, 6], [3350, 1000, 6], [3370, 1120, 6], [3400, 1200, 5], [3500, 1222, 4], [3650, 1218, 4],
    [3800, 1224, 4], [3850, 1200, 5], [3880, 1100, 6], [3900, 980, 6], [3920, 840, 6], [3940, 700, 6], [3955, 560, 5], [3968, 440, 4],
    // Kelp forest + mangrove roots on the shallower seabed
    [3990, 388, 3], [4200, 384, 4], [4450, 390, 4], [4700, 384, 4], [4900, 388, 4],
    [5100, 384, 4], [5300, 390, 5], [5500, 384, 4], [5680, 388, 3],
    // Ice shelf / polar waters
    [5760, 392, 3], [5900, 396, 4], [6100, 392, 4], [6300, 398, 4], [6500, 394, 4], [6700, 396, 4], [6800, 396, 0]
  ],

  // Biomes are matched top-to-bottom: the first rect containing a point wins.
  // palette: top = surface material (sand/mud/snow), rock = body shades, accent = speckles.
  // water = tint mixed into the water colour, dark = ambient darkness (0..1).
  biomes: [
    { id: 'lush_cave', name: 'Half-Flooded Lush Cave', short: 'Lush Cave', rect: [5960, 700, 840, 260],
      palette: { top: ['#6fa456', '#4f8a43', '#3d6b37'], rock: ['#5a5560', '#4a4550', '#3b3742'], accent: '#c9e07a' }, water: '#2f8a7a', waterMix: 0.45, dark: 0.45 },
    { id: 'cave', name: 'Flooded Cave System', short: 'Cave', rect: [5660, 400, 360, 820],
      palette: { top: ['#56606b', '#4a535d', '#3f4750'], rock: ['#3e444d', '#343941', '#2a2e35'], accent: '#7fb0a8' }, water: '#1c3550', waterMix: 0.5, dark: 0.72 },
    { id: 'trench', name: 'Deep Trench', short: 'Trench', rect: [3320, 640, 660, 640],
      palette: { top: ['#2c3448', '#252c3d', '#1e2433'], rock: ['#1b2130', '#161b27', '#11151f'], accent: '#3c6b7a' }, water: '#050c1c', waterMix: 0.4, dark: 0.74 },
    { id: 'vents', name: 'Volcanic Vents', short: 'Vents', rect: [2560, 600, 760, 680],
      palette: { top: ['#4a3f44', '#3d3338', '#33292e'], rock: ['#2f282c', '#272124', '#1f1a1d'], accent: '#ff8a3a' }, water: '#3a2230', waterMix: 0.25, dark: 0.55 },
    { id: 'open_ocean', name: 'Open Ocean', short: 'Open Ocean', rect: [2420, 0, 1550, 1280],
      palette: { top: ['#6d7c88', '#5d6b78', '#4f5c68'], rock: ['#46525e', '#3c4652', '#323b46'], accent: '#8da3b0' }, water: '#1f5fa8', waterMix: 0.2, dark: 0 },
    { id: 'tide_pools', name: 'Tide Pools', short: 'Tide Pools', rect: [0, 0, 720, 1280],
      palette: { top: ['#ecd9a0', '#d9c084', '#c4a86c'], rock: ['#8c8178', '#766b63', '#5f564f'], accent: '#6fa35a' }, water: '#58d0cf', waterMix: 0.25, dark: 0,
      props: [
        { type: 'algae', at: 'floor', n: 60, air: true, y: [60, 118] },
        { type: 'rock', at: 'floor', n: 16, area: [290, 720], r: [3, 8], barnacles: true },
        { type: 'rock', at: 'floor', n: 8, air: true, area: [0, 290], r: [3, 6], barnacles: true },
        { type: 'seagrass', at: 'floor', n: 46, area: [300, 720] },
        { type: 'seagrass', at: 'floor', n: 10, area: [80, 300], h: [4, 9] },
        { type: 'anemone', at: 'floor', n: 14, area: [280, 720] },
        { type: 'urchin', at: 'floor', n: 9, area: [330, 720] },
        { type: 'starfish', at: 'floor', n: 12, area: [90, 720], air: true },
        { type: 'shell', at: 'floor', n: 18, area: [0, 720], air: true },
        { type: 'pebbles', at: 'floor', n: 26, area: [280, 720] }
      ] },
    { id: 'coral', name: 'Coral Shelf', short: 'Coral', rect: [720, 0, 1180, 1280],
      palette: { top: ['#f3e2b6', '#e6cf9a', '#d4b984'], rock: ['#c4a58a', '#a98b72', '#8d725d'], accent: '#ef8aa0' }, water: '#3fc0d8', waterMix: 0.25, dark: 0 },
    { id: 'ruins', name: 'Sunken Ruins', short: 'Ruins', rect: [1900, 0, 520, 1280],
      palette: { top: ['#a6a283', '#928e70', '#7d7a5f'], rock: ['#6d6b5c', '#5c5a4d', '#4b4a40'], accent: '#a5643a' }, water: '#4a8f8a', waterMix: 0.3, dark: 0.05 },
    { id: 'kelp', name: 'Kelp Forest', short: 'Kelp', rect: [3970, 0, 930, 1280],
      palette: { top: ['#bfae7c', '#a8976a', '#8f8059'], rock: ['#6e705f', '#5c5e4f', '#4a4c40'], accent: '#7a9a3a' }, water: '#2f8a6a', waterMix: 0.3, dark: 0.08 },
    { id: 'mangrove', name: 'Mangrove Roots', short: 'Mangrove', rect: [4900, 0, 800, 1280],
      palette: { top: ['#6e5a3c', '#5c4b32', '#4a3c29'], rock: ['#4e4234', '#41372b', '#342c23'], accent: '#7d8f3c' }, water: '#5c7a3a', waterMix: 0.4, dark: 0.12 },
    { id: 'ice', name: 'Ice Shelf', short: 'Ice', rect: [5700, 0, 1100, 1280], zones: [{ name: 'Icy', x0: 5700, x1: 6250 }, { name: 'Glaciers', x0: 6250, x1: 6800 }],
      palette: { top: ['#eef8ff', '#d2ebf7', '#b4d8ea'], rock: ['#5e6976', '#4f5966', '#424a55'], accent: '#9fd3ee' }, water: '#7fc6e6', waterMix: 0.35, dark: 0.05 }
  ],

  // Terrain shapes, applied in order on top of the floor. ops: solid | carve | pool | air | water
  // shapes: poly{pts} rect{x,y,w,h} circle{x,y,r} tunnel{path:[[x,y,r]], r} spikes{x,y,w,n,h,dir} chimney{x,y,w,h}
  shapes: [
    // --- Tide pools: boulders with crevices (Knuckle Crab homes) and a small overhang
    { op: 'solid', shape: 'circle', x: 424, y: 134, r: 11, jitter: 2 },
    { op: 'carve', shape: 'circle', x: 432, y: 142, r: 4, rx: 5, ry: 3 },
    { op: 'solid', shape: 'circle', x: 520, y: 162, r: 9, jitter: 2 },
    { op: 'solid', shape: 'circle', x: 566, y: 172, r: 15, jitter: 3 },
    { op: 'carve', shape: 'circle', x: 554, y: 182, r: 4, rx: 5, ry: 3 },
    { op: 'solid', shape: 'poly', pts: [[606, 178], [646, 168], [668, 176], [642, 186]], jitter: 2 },
    { op: 'carve', shape: 'circle', x: 352, y: 122, r: 4, rx: 4, ry: 3 }
  ],

  // Tide pools: basins of water carved into rock above the sea (x = centre, w = width, d = depth)
  pools: [
    { x: 40, w: 14, d: 4 }, { x: 148, w: 18, d: 5 }, { x: 250, w: 18, d: 5 }
  ],

  // Shape materials (referenced by shapes[].mat). Same format as a biome palette.
  materials: {
    ice:   { top: ['#ffffff', '#e8f6ff', '#cfe9f7'], rock: ['#bfe3f4', '#9ccfe8', '#7fb8d8'], accent: '#ffffff', style: 'ice' },
    wood:  { top: ['#8a6440', '#79563a', '#684a32'], rock: ['#7a5636', '#694a2f', '#573d27'], accent: '#a5643a', style: 'wood' },
    metal: { top: ['#8a6a52', '#7a5a46', '#6a4c3c'], rock: ['#6b5a50', '#5b4b43', '#4b3d37'], accent: '#b8643a', style: 'metal' },
    basalt:{ top: ['#4a3f44', '#3d3338', '#33292e'], rock: ['#3a3034', '#2f272a', '#251f22'], accent: '#ff8a3a', style: 'strata' }
  }
};
