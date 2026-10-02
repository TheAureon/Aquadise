// Layout of the aquarium building that floats in space (src/station.js). All numbers are pixels in
// the building scene. Floors are listed ground floor first; `y` is the walking surface.
// Each tank slot names the tank it shows (see `tanks` below).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.station = {
  width: 760, height: 476,                  // whole scene, including the space around the building
  hull: { x: 60, y: 56, w: 640, h: 372, thick: 8 },
  floors: [402, 316, 230, 144],             // ground floor, 2nd, 3rd, 4th (predator wing)
  floorThick: 8,
  ladders: [                                // from `floor` up to the floor above; both ladders run the full height
    { x: 86, floor: 0 }, { x: 86, floor: 1 }, { x: 86, floor: 2 },
    { x: 674, floor: 0 }, { x: 674, floor: 1 }, { x: 674, floor: 2 }
  ],
  // 5 tank slots per floor (x = centre). `tank` = which tank shows there (a biome id, or a predator
  // tank id from data/aquarium.js); null = an empty, unlit slot for the future.
  tanks: [
    { floor: 0, x: 136, tank: 'tide_pools' }, { floor: 0, x: 208, tank: 'coral' }, { floor: 0, x: 280, tank: 'ruins' },
    { floor: 0, x: 352, tank: 'open_ocean' }, { floor: 0, x: 424, tank: 'vents' },
    { floor: 1, x: 180, tank: 'trench' }, { floor: 1, x: 280, tank: 'kelp' }, { floor: 1, x: 380, tank: 'mangrove' },
    { floor: 1, x: 480, tank: 'cave' }, { floor: 1, x: 580, tank: 'ice' },
    { floor: 2, x: 180, tank: 'lush_cave' }, { floor: 2, x: 280, tank: null }, { floor: 2, x: 380, tank: null },
    { floor: 2, x: 480, tank: null }, { floor: 2, x: 580, tank: null },
    { floor: 3, x: 180, tank: 'pred_reef' }, { floor: 3, x: 280, tank: 'pred_open' }, { floor: 3, x: 380, tank: 'pred_deep' },
    { floor: 3, x: 480, tank: 'pred_cave' }, { floor: 3, x: 580, tank: 'pred_swamp' }
  ],
  pad: { x: 572 },                          // the beam pad (ground floor)
  console: { x: 496 },                      // the tank directory (ground floor)
  windows: [                                // portholes in the back wall, [x, floor] (centre)
    [172, 0], [316, 0], [636, 0],
    [130, 1], [230, 1], [330, 1], [430, 1], [530, 1], [630, 1],
    [130, 2], [230, 2], [330, 2], [430, 2], [530, 2], [630, 2],
    [130, 3], [230, 3], [330, 3], [430, 3], [530, 3], [630, 3]
  ],
  plants: [[110, 0], [528, 0], [650, 1], [110, 2], [650, 3]],   // potted plants, [x, floor]
  signs: [                                  // [text, x, floor, colour]
    ['DIRECTORY', 496, 0, '#ffe08a'], ['BEAM PAD', 572, 0, '#9feff0'],
    ['AQUARIUM STATION', 380, 2, '#ffd0e0'], ['PREDATOR WING', 380, 3, '#ffb0a0']
  ]
};
