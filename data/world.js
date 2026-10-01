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
  playerStart: [470, 118],

  // Seabed profile: [x, y, roughness]. Everything below the line is solid.
  floor: [
    // Tide pools / shallows: rocky shore above the waterline, sloping gently down
    [0, 58, 2], [50, 62, 3], [100, 72, 3], [150, 86, 3], [200, 92, 3], [250, 94, 3], [290, 100, 4],
    [330, 114, 4], [380, 126, 5], [430, 140, 5], [480, 152, 5], [540, 168, 4], [600, 186, 4], [650, 206, 3], [700, 236, 3],
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
    { id: 'lush_cave', name: 'Half-Flooded Lush Cave', rect: [5960, 700, 840, 260],
      palette: { top: ['#6fa456', '#4f8a43', '#3d6b37'], rock: ['#5a5560', '#4a4550', '#3b3742'], accent: '#c9e07a' }, water: '#2f8a7a', waterMix: 0.45, dark: 0.45 },
    { id: 'cave', name: 'Flooded Cave System', rect: [5660, 400, 360, 820],
      palette: { top: ['#56606b', '#4a535d', '#3f4750'], rock: ['#3e444d', '#343941', '#2a2e35'], accent: '#7fb0a8' }, water: '#1c3550', waterMix: 0.5, dark: 0.72 },
    { id: 'trench', name: 'Deep Trench', rect: [3320, 640, 660, 640],
      palette: { top: ['#2c3448', '#252c3d', '#1e2433'], rock: ['#1b2130', '#161b27', '#11151f'], accent: '#3c6b7a' }, water: '#050c1c', waterMix: 0.4, dark: 0.88 },
    { id: 'vents', name: 'Volcanic Vents', rect: [2560, 600, 760, 680],
      palette: { top: ['#4a3f44', '#3d3338', '#33292e'], rock: ['#2f282c', '#272124', '#1f1a1d'], accent: '#ff8a3a' }, water: '#3a2230', waterMix: 0.25, dark: 0.55 },
    { id: 'open_ocean', name: 'Open Ocean', rect: [2420, 0, 1550, 700],
      palette: { top: ['#6d7c88', '#5d6b78', '#4f5c68'], rock: ['#46525e', '#3c4652', '#323b46'], accent: '#8da3b0' }, water: '#1f5fa8', waterMix: 0.2, dark: 0 },
    { id: 'tide_pools', name: 'Tide Pools', rect: [0, 0, 720, 1280],
      palette: { top: ['#ecd9a0', '#d9c084', '#c4a86c'], rock: ['#8c8178', '#766b63', '#5f564f'], accent: '#6fa35a' }, water: '#58d0cf', waterMix: 0.25, dark: 0 },
    { id: 'coral', name: 'Coral Shelf', rect: [720, 0, 1180, 1280],
      palette: { top: ['#f3e2b6', '#e6cf9a', '#d4b984'], rock: ['#c4a58a', '#a98b72', '#8d725d'], accent: '#ef8aa0' }, water: '#3fc0d8', waterMix: 0.25, dark: 0 },
    { id: 'ruins', name: 'Sunken Ruins', rect: [1900, 0, 520, 1280],
      palette: { top: ['#a6a283', '#928e70', '#7d7a5f'], rock: ['#6d6b5c', '#5c5a4d', '#4b4a40'], accent: '#a5643a' }, water: '#4a8f8a', waterMix: 0.3, dark: 0.05 },
    { id: 'kelp', name: 'Kelp Forest', rect: [3970, 0, 930, 1280],
      palette: { top: ['#bfae7c', '#a8976a', '#8f8059'], rock: ['#6e705f', '#5c5e4f', '#4a4c40'], accent: '#7a9a3a' }, water: '#2f8a6a', waterMix: 0.3, dark: 0.08 },
    { id: 'mangrove', name: 'Mangrove Roots', rect: [4900, 0, 800, 1280],
      palette: { top: ['#6e5a3c', '#5c4b32', '#4a3c29'], rock: ['#4e4234', '#41372b', '#342c23'], accent: '#7d8f3c' }, water: '#5c7a3a', waterMix: 0.4, dark: 0.12 },
    { id: 'ice', name: 'Ice Shelf', rect: [5700, 0, 1100, 1280], zones: [{ name: 'Icy', x0: 5700, x1: 6250 }, { name: 'Glaciers', x0: 6250, x1: 6800 }],
      palette: { top: ['#eef8ff', '#d2ebf7', '#b4d8ea'], rock: ['#5e6976', '#4f5966', '#424a55'], accent: '#9fd3ee' }, water: '#7fc6e6', waterMix: 0.35, dark: 0.05 }
  ],

  // Terrain shapes, applied in order on top of the floor. ops: solid | carve | pool | air | water
  // shapes: poly{pts} rect{x,y,w,h} circle{x,y,r} tunnel{path:[[x,y,r]], r} spikes{x,y,w,n,h,dir} chimney{x,y,w,h}
  shapes: []
};
