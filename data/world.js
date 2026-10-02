// World layout (side-view cross-section, left -> right, following the design sketch).
// Edit freely: floor points, biome rectangles, palettes, terrain shapes, props, spawns.
// Coordinates are world pixels. y grows downward; seaLevel is the water surface.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.world = {
  width: 6800,
  height: 1440,
  seaLevel: 96,
  seed: 7,
  playerStart: [120, 76],

  // Seabed profile: [x, y, roughness]. Everything below the line is solid.
  floor: [
    // Tide pools / shallows: mostly DRY walkable ground (above the sea) dotted with small pools,
    // a small step down, then a gentle slope into the water that ends in a steeper drop.
    [0, 84, 1.2], [190, 85, 1.2], [205, 89, 1.2], [440, 90, 1.2], [480, 95, 1.5], [540, 104, 2], [610, 118, 2],
    [670, 136, 2], [720, 160, 2], [760, 196, 3],
    // Coral shelf: dips in at the start, then long and gently rolling (smooth sand under the coral)
    [790, 228, 2], [820, 244, 2], [850, 240, 2], [900, 246, 2], [1050, 250, 2], [1200, 247, 2], [1350, 254, 2],
    [1500, 252, 2], [1650, 258, 2], [1800, 262, 2],
    // Sunken ruins at the shelf edge
    [1900, 266, 3], [2050, 270, 3], [2200, 272, 3], [2380, 276, 3],
    // Steep drop-off
    [2440, 300, 6], [2500, 370, 8], [2560, 450, 8], [2620, 530, 8], [2680, 610, 8], [2730, 690, 6], [2770, 760, 5],
    // Volcanic vents at the bottom of the slope: three broad, smoking mounds with open floor between
    [2800, 804, 2], [2850, 772, 2], [2905, 806, 2], [2985, 806, 3], [3030, 768, 2], [3080, 806, 2],
    [3165, 806, 3], [3210, 776, 2], [3255, 806, 2], [3290, 806, 2],
    // Deep trench (steep walls)
    [3320, 830, 4], [3335, 900, 6], [3350, 1000, 6], [3370, 1120, 6], [3400, 1200, 5], [3500, 1222, 4], [3650, 1218, 4],
    [3800, 1224, 4], [3850, 1200, 5], [3880, 1100, 6], [3900, 980, 6], [3920, 840, 6], [3940, 700, 6], [3955, 560, 5], [3968, 440, 4],
    // Kelp forest + mangrove roots on the shallower seabed
    [3990, 388, 3], [4200, 384, 4], [4450, 390, 4], [4700, 384, 4], [4880, 388, 4],
    // Mangrove: a shallow, muddy flat (real mangroves grow in shallow water)
    [4930, 350, 4], [4980, 300, 3], [5040, 278, 3], [5200, 282, 3], [5350, 276, 3], [5500, 284, 3], [5600, 278, 3],
    [5650, 320, 3], [5690, 388, 3],
    // Ice shelf / polar waters
    [5760, 392, 3], [5900, 396, 4], [6100, 392, 4], [6300, 398, 4], [6500, 394, 4], [6700, 396, 4], [6800, 396, 0]
  ],

  // Biomes are matched top-to-bottom: the first rect containing a point wins.
  // palette: top = surface material (sand/mud/snow), rock = body shades, accent = speckles.
  // water = tint mixed into the water colour, dark = ambient darkness (0..1).
  biomes: [
    { id: 'lush_cave', name: 'Half-Flooded Lush Cave', short: 'Lush Cave', rect: [5960, 700, 840, 260],
      palette: { top: ['#6fa456', '#4f8a43', '#3d6b37'], rock: ['#5a5560', '#4a4550', '#3b3742'], accent: '#c9e07a', style: 'mossy', backwall: true, air: '#26333a' }, water: '#2fa08c', waterMix: 0.45, dark: 0.36,
      props: [
        { type: 'vine', at: 'ceiling', n: 26, air: true },
        { type: 'glowvine', at: 'ceiling', n: 14, air: true },
        { type: 'glowshroom', at: 'floor', n: 12, air: true },
        { type: 'flowerbed', at: 'floor', n: 10, airOnly: true },
        { type: 'fern', at: 'floor', n: 14, airOnly: true },
        { type: 'lilypad', at: 'waterline', n: 16 },
        { type: 'seagrass', at: 'floor', n: 16, colors: ['#5fae6e', '#4b9058', '#7ccf86'] },
        { type: 'glowshroom', at: 'floor', n: 5 },
        { type: 'stalactite', at: 'ceiling', n: 6, air: true }
      ] },
    { id: 'cave', name: 'Flooded Cave System', short: 'Cave', rect: [5660, 400, 360, 820],
      palette: { top: ['#56606b', '#4a535d', '#3f4750'], rock: ['#3e444d', '#343941', '#2a2e35'], accent: '#7fb0a8', style: 'strata', backwall: true }, water: '#1c3550', waterMix: 0.5, dark: 0.72,
      props: [
        { type: 'stalactite', at: 'ceiling', n: 22 },
        { type: 'stalagmite', at: 'floor', n: 12 },
        { type: 'crystal', at: 'floor', n: 8 },
        { type: 'crystal', at: 'ceiling', n: 5, colors: ['#6fd6e8', '#9f7fe8'] },
        { type: 'pebbles', at: 'floor', n: 6 }
      ] },
    { id: 'trench', name: 'Deep Trench', short: 'Trench', rect: [3320, 640, 660, 800],
      palette: { top: ['#2c3448', '#252c3d', '#1e2433'], rock: ['#1b2130', '#161b27', '#11151f'], accent: '#3c6b7a', style: 'strata' }, water: '#050c1c', waterMix: 0.4, dark: 0.74,
      props: [
        { type: 'spire', at: 'floor', n: 10, y: [1150, 1260] },
        { type: 'bones', at: 'floor', n: 3, y: [1150, 1260] },
        { type: 'rock', at: 'floor', n: 14 },
        { type: 'tubeworms', at: 'floor', n: 6 }
      ] },
    { id: 'vents', name: 'Volcanic Vents', short: 'Vents', rect: [2560, 600, 760, 840],
      palette: { top: ['#4a3f44', '#3d3338', '#33292e'], rock: ['#2f282c', '#272124', '#1f1a1d'], accent: '#ff8a3a', style: 'strata', embers: true }, water: '#3a2230', waterMix: 0.25, dark: 0.55,
      props: [
        { type: 'ventcrack', at: 'floor', n: 3, y: [790, 820] },
        { type: 'tubeworms', at: 'floor', n: 6 },
        { type: 'rock', at: 'floor', n: 5, color: '#4a3f44' }
      ] },
    { id: 'open_ocean', name: 'Open Ocean', short: 'Open Ocean', rect: [2420, 0, 1550, 1440],
      palette: { top: ['#6d7c88', '#5d6b78', '#4f5c68'], rock: ['#46525e', '#3c4652', '#323b46'], accent: '#8da3b0' }, water: '#1f5fa8', waterMix: 0.2, dark: 0,
      props: [
        { type: 'rock', at: 'floor', n: 16 },
        { type: 'seagrass', at: 'floor', n: 8, y: [0, 420] },
        { type: 'anemone', at: 'floor', n: 5, y: [0, 500] }
      ] },
    { id: 'tide_pools', name: 'Tide Pools', short: 'Tide Pools', rect: [0, 0, 720, 1440],
      palette: { top: ['#ecd9a0', '#d9c084', '#c4a86c'], rock: ['#8c8178', '#766b63', '#5f564f'], accent: '#6fa35a' }, water: '#58d0cf', waterMix: 0.25, dark: 0,
      props: [
        { type: 'algae', at: 'floor', n: 34, air: true, area: [0, 520] },
        { type: 'rock', at: 'floor', n: 5, air: true, area: [0, 470], r: [2, 4] },
        { type: 'shell', at: 'floor', n: 10, air: true, area: [0, 520] },
        { type: 'starfish', at: 'floor', n: 4, air: true, area: [0, 520] },
        { type: 'pebbles', at: 'floor', n: 8, air: true, area: [0, 760] },
        { type: 'rock', at: 'floor', n: 6, area: [470, 760], r: [3, 7] },
        { type: 'seagrass', at: 'floor', n: 18, area: [470, 760] },
        { type: 'anemone', at: 'floor', n: 5, area: [480, 760] },
        { type: 'urchin', at: 'floor', n: 3, area: [520, 760] },
      ] },
    { id: 'coral', name: 'Coral Shelf', short: 'Coral', rect: [720, 0, 1180, 1440],
      palette: { top: ['#f3e2b6', '#e6cf9a', '#d4b984'], rock: ['#c4a58a', '#a98b72', '#8d725d'], accent: '#ef8aa0' }, water: '#3fc0d8', waterMix: 0.25, dark: 0,
      props: [
        { type: 'coral', at: 'floor', n: 90 },
        { type: 'coral', at: 'floor', n: 12, kinds: ['fan'], scale: 1.4 },
        { type: 'anemone', at: 'floor', n: 8 },
        { type: 'seagrass', at: 'floor', n: 12, h: [5, 11] },
        { type: 'starfish', at: 'floor', n: 5 },
        { type: 'shell', at: 'floor', n: 6 },
        { type: 'urchin', at: 'floor', n: 4 }
      ] },
    { id: 'ruins', name: 'Sunken Ruins', short: 'Ruins', rect: [1900, 0, 520, 1440],
      palette: { top: ['#a6a283', '#928e70', '#7d7a5f'], rock: ['#6d6b5c', '#5c5a4d', '#4b4a40'], accent: '#a5643a' }, water: '#4a8f8a', waterMix: 0.3, dark: 0.05,
      props: [
        { type: 'plank', at: 'floor', n: 7 },
        { type: 'barrel', at: 'floor', n: 2 },
        { type: 'crate', at: 'floor', n: 3 },
        { type: 'chain', at: 'floor', n: 2 },
        { type: 'anchor', at: 'points', points: [[2392, 276]] },
        { type: 'mast', at: 'points', points: [[2110, 207]], air: true, h: 68 },
        { type: 'flag', at: 'points', points: [[2112, 142]], air: true },
        { type: 'seagrass', at: 'floor', n: 10, colors: ['#6f8a3e', '#5b7333', '#86a04a'] },
        { type: 'rock', at: 'floor', n: 8 }
      ] },
    { id: 'kelp', name: 'Kelp Forest', short: 'Kelp', rect: [3970, 0, 930, 1440],
      palette: { top: ['#bfae7c', '#a8976a', '#8f8059'], rock: ['#6e705f', '#5c5e4f', '#4a4c40'], accent: '#7a9a3a' }, water: '#2f8a6a', waterMix: 0.3, dark: 0.08,
      props: [
        { type: 'kelp', at: 'floor', every: 32, chance: 0.85, area: [3990, 4900] },
        { type: 'rock', at: 'floor', n: 14 },
        { type: 'seagrass', at: 'floor', n: 18 },
        { type: 'kelp', at: 'floor', every: 110, chance: 0.5, layer: 'front', sparse: true, alpha: 150, colors: ['#3f5a1c', '#33491a', '#4d6b22'], area: [3990, 4900] }
      ] },
    { id: 'mangrove', name: 'Mangrove Roots', short: 'Mangrove', rect: [4900, 0, 800, 1440],
      palette: { top: ['#6e5a3c', '#5c4b32', '#4a3c29'], rock: ['#4e4234', '#41372b', '#342c23'], accent: '#7d8f3c' }, water: '#5c7a3a', waterMix: 0.4, dark: 0.12,
      props: [
        { type: 'mangrove', at: 'floor', every: 115, area: [4930, 5660] },
        { type: 'seagrass', at: 'floor', n: 14, colors: ['#6d7a3a', '#596531', '#828f44'] },
        { type: 'rock', at: 'floor', n: 10, color: '#5c4b32' },
        { type: 'algae', at: 'floor', n: 15, color: '#6b5a2f' }
      ] },
    { id: 'ice', name: 'Ice Shelf', short: 'Ice', rect: [5700, 0, 1100, 1440], zones: [{ name: 'Icy', x0: 5700, x1: 6250 }, { name: 'Glaciers', x0: 6250, x1: 6800 }],
      palette: { top: ['#eef8ff', '#d2ebf7', '#b4d8ea'], rock: ['#5e6976', '#4f5966', '#424a55'], accent: '#9fd3ee' }, water: '#7fc6e6', waterMix: 0.35, dark: 0.05,
      props: [
        { type: 'icicle', at: 'ceiling', n: 26 },
        { type: 'rock', at: 'floor', n: 10, color: '#5e6976' },
        { type: 'seagrass', at: 'floor', n: 12, colors: ['#6f9aa0', '#5a8088', '#8ab8be'], h: [4, 8] }
      ] }
  ],

  // Doors: solid while shut; they open by themselves when you swim up and close after you pass.
  // vertical doors stand in a doorway (w small, h tall); hatches lie flat (w wide, h small).
  doors: [
    { x: 2026, y: 244, w: 4, h: 18, name: 'DOOR' },          // bow door into the ship's hold
    { x: 2140, y: 213, w: 4, h: 18, name: 'DOOR' },          // cabin door
    { x: 2180, y: 230, w: 24, h: 4, name: 'HATCH' },         // deck hatch into the hold
    { x: 2094, y: 232, w: 18, h: 4, name: 'HATCH' }          // floor hatch, cabin -> hold
  ],

  // Terrain shapes, applied in order on top of the floor. ops: solid | carve | pool | air | water
  // back: true -> scenery only (painted, but not a wall)
  // shapes: poly{pts} rect{x,y,w,h} circle{x,y,r} tunnel{path:[[x,y,r]], r} spikes{x,y,w,n,h,dir} chimney{x,y,w,h}
  shapes: [
    // --- Sunken ruins: ancient pillars + a wrecked ship you can swim through
    // (back: true = painted like terrain but only scenery: you swim in front of it)
    { op: 'solid', shape: 'rect', x: 1930, y: 222, w: 10, h: 48, jitter: 0.6, back: true },
    { op: 'solid', shape: 'rect', x: 1926, y: 218, w: 18, h: 5, back: true },
    { op: 'solid', shape: 'rect', x: 1968, y: 240, w: 10, h: 30, jitter: 0.6, back: true },
    // the ship (from the sketch): sitting upright on the floor, cabin + mast with a flag, portholes, swim-through hull
    { op: 'solid', shape: 'poly', mat: 'wood', pts: [[2030, 270], [2018, 238], [2030, 232], [2270, 230], [2300, 236], [2318, 250], [2306, 270]], jitter: 1.2 },
    { op: 'carve', shape: 'poly', pts: [[2044, 264], [2036, 242], [2264, 238], [2292, 250], [2286, 264]] },
    { op: 'solid', shape: 'rect', mat: 'wood', x: 2080, y: 206, w: 64, h: 26 },
    { op: 'carve', shape: 'rect', x: 2086, y: 212, w: 52, h: 20 },
    { op: 'carve', shape: 'circle', x: 2226, y: 250, r: 4 },
    { op: 'carve', shape: 'circle', x: 2248, y: 250, r: 4 },
    // doorways (each is closed by a door from `doors` below): bow door, deck hatch, cabin door,
    // and a floor hatch from the cabin down into the hold
    { op: 'carve', shape: 'rect', x: 2012, y: 244, w: 40, h: 18 },
    { op: 'carve', shape: 'rect', x: 2180, y: 224, w: 24, h: 18 },
    { op: 'carve', shape: 'rect', x: 2136, y: 213, w: 16, h: 18 },
    { op: 'carve', shape: 'rect', x: 2094, y: 228, w: 18, h: 14 },
    { op: 'solid', shape: 'circle', mat: 'metal', x: 2372, y: 266, r: 10, jitter: 1, back: true },

    // --- Deep places past the gentle depth limits (see AQ.TUNING.upgrades.depthLimitY):
    // the open ocean's Blue Hole (a winding shaft below the drop-off that opens into a round bowl, DEPTH 2) ...
    { op: 'carve', shape: 'tunnel', r: 16, jitter: 0.35, path: [[2492, 380, 20], [2480, 560, 14], [2500, 760, 17], [2484, 960, 13], [2498, 1140, 16], [2490, 1250, 22]] },
    { op: 'carve', shape: 'tunnel', r: 26, jitter: 0.3, path: [[2448, 1302, 16], [2470, 1300, 26], [2494, 1296, 32], [2520, 1300, 26], [2540, 1304, 16]] },
    // ... and the trench's deepest slot (DEPTH 3): a funnel in the trench floor down into a bowl
    { op: 'carve', shape: 'tunnel', r: 15, jitter: 0.3, path: [[3652, 1206, 28], [3648, 1250, 17], [3652, 1310, 14], [3654, 1356, 20]] },
    { op: 'carve', shape: 'tunnel', r: 20, jitter: 0.3, path: [[3606, 1386, 13], [3628, 1386, 20], [3654, 1384, 25], [3680, 1386, 20], [3702, 1388, 13]] },

    // --- Volcanic vents: smoking craters on top of the mounds (y is found automatically)
    { shape: 'vent', x: 2850 }, { shape: 'vent', x: 3030 }, { shape: 'vent', x: 3210 },

    // --- Deep trench: ledges on the walls
    { op: 'solid', shape: 'poly', pts: [[3330, 880], [3380, 900], [3384, 912], [3335, 914]], jitter: 2 },
    { op: 'solid', shape: 'poly', pts: [[3910, 900], [3860, 960], [3856, 972], [3918, 950]], jitter: 2 },
    { op: 'solid', shape: 'poly', pts: [[3355, 1060], [3420, 1080], [3424, 1092], [3360, 1094]], jitter: 2 },

    // --- Ice shelf: floor spikes ("Icy"), floating shelves, glacier walls ("Glaciers")
    { op: 'solid', shape: 'spikes', mat: 'ice', x: 5830, y: 398, w: 400, n: 14, h: [18, 52], base: [5, 11], jitter: 1 },
    { op: 'solid', shape: 'poly', mat: 'ice', pts: [[5850, 88], [5990, 86], [5984, 112], [5940, 122], [5870, 116]], jitter: 2 },
    { op: 'solid', shape: 'poly', mat: 'ice', pts: [[6060, 90], [6190, 88], [6196, 108], [6150, 126], [6070, 112]], jitter: 2 },
    { op: 'solid', shape: 'spikes', mat: 'ice', x: 5870, y: 116, w: 100, n: 5, h: [6, 16], base: [2, 4], dir: 'down' },
    { op: 'solid', shape: 'spikes', mat: 'ice', x: 6075, y: 112, w: 100, n: 5, h: [6, 18], base: [2, 4], dir: 'down' },
    // Glaciers: triangular icebergs - pointed peaks above the water, a bigger jagged mass below
    { op: 'solid', shape: 'poly', mat: 'ice', pts: [[6350, 98], [6382, 54], [6396, 62], [6420, 10], [6444, 50], [6458, 42], [6482, 98], [6512, 150], [6470, 214], [6420, 254], [6372, 214], [6322, 150]], jitter: 1.5 },
    { op: 'solid', shape: 'poly', mat: 'ice', pts: [[6638, 98], [6666, 62], [6688, 68], [6714, 8], [6740, 58], [6756, 50], [6782, 98], [6800, 140], [6800, 200], [6770, 226], [6716, 264], [6660, 222], [6618, 150]], jitter: 1.5 },
    { op: 'solid', shape: 'spikes', mat: 'ice', x: 6300, y: 398, w: 480, n: 10, h: [14, 40], base: [6, 12], jitter: 1 },

    // --- Flooded cave system: a steep passage down from the seabed, branching deeper
    { op: 'carve', shape: 'tunnel', r: 22, jitter: 0.35, path: [[5742, 376, 18], [5760, 450], [5800, 540], [5846, 630], [5888, 720, 26], [5930, 800, 24], [5990, 852, 22]] },
    { op: 'carve', shape: 'tunnel', r: 24, jitter: 0.35, path: [[5888, 720], [5870, 830], [5895, 940, 30], [5950, 1040, 28], [5925, 1140, 22]] },
    { op: 'carve', shape: 'tunnel', r: 16, jitter: 0.4, path: [[5800, 540], [5740, 600], [5712, 680, 20]] },

    // --- Half-flooded lush cave: a horizontal chamber, bottom half water, top half air
    { op: 'carve', shape: 'tunnel', r: 46, jitter: 0.25, path: [[5990, 852, 24], [6080, 836, 40], [6200, 818, 54], [6380, 812, 58], [6560, 818, 52], [6700, 832, 34]] },
    { op: 'solid', shape: 'poly', pts: [[6240, 790], [6300, 784], [6310, 796], [6250, 800]], jitter: 1.5 },
    { op: 'solid', shape: 'poly', pts: [[6470, 792], [6530, 786], [6540, 800], [6476, 804]], jitter: 1.5 },
    { op: 'air', shape: 'rect', x: 6020, y: 700, w: 760, h: 116 }
  ],

  // Tide pools: basins of water carved into rock above the sea (x = centre, w = width, d = depth)
  pools: [
    { x: 30, w: 30, d: 4 }, { x: 78, w: 44, d: 11 }, { x: 132, w: 26, d: 4 }, { x: 176, w: 34, d: 6 },
    { x: 236, w: 46, d: 12 }, { x: 290, w: 30, d: 5 }, { x: 340, w: 52, d: 10 }, { x: 394, w: 28, d: 4 },
    { x: 430, w: 30, d: 6 }
  ],


  // Shape materials (referenced by shapes[].mat). Same format as a biome palette.
  materials: {
    ice:   { top: ['#ffffff', '#e8f6ff', '#cfe9f7'], rock: ['#bfe3f4', '#9ccfe8', '#7fb8d8'], accent: '#ffffff', style: 'ice' },
    wood:  { top: ['#8a6440', '#79563a', '#684a32'], rock: ['#7a5636', '#694a2f', '#573d27'], accent: '#a5643a', style: 'wood' },
    metal: { top: ['#8a6a52', '#7a5a46', '#6a4c3c'], rock: ['#6b5a50', '#5b4b43', '#4b3d37'], accent: '#b8643a', style: 'metal' },
    basalt:{ top: ['#4a3f44', '#3d3338', '#33292e'], rock: ['#3a3034', '#2f272a', '#251f22'], accent: '#ff8a3a', style: 'strata', embers: true }
  }
};
