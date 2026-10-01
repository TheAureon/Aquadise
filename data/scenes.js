// Layout of the aquarium building that floats in space (src/station.js). All numbers are pixels in
// the building scene. Floors are listed ground floor first; `y` is the walking surface.
// Tanks are filled in world order (Tide Pools, Coral, Ruins ...), floor by floor, left to right.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.station = {
  width: 640, height: 390,                  // whole scene, including the space around the building
  hull: { x: 60, y: 56, w: 520, h: 286, thick: 8 },
  floors: [316, 230, 144],                  // ground floor, 2nd floor, 3rd floor
  floorThick: 8,
  ladders: [                                // from `floor` up to the floor above it
    { x: 548, floor: 0 },
    { x: 92, floor: 1 }
  ],
  tanks: [                                  // 11 tank displays (x = centre)
    { floor: 0, x: 116 }, { floor: 0, x: 196 }, { floor: 0, x: 276 },
    { floor: 1, x: 158 }, { floor: 1, x: 252 }, { floor: 1, x: 346 }, { floor: 1, x: 440 },
    { floor: 2, x: 158 }, { floor: 2, x: 252 }, { floor: 2, x: 346 }, { floor: 2, x: 440 }
  ],
  pad: { x: 452 },                          // the beam pad (ground floor)
  console: { x: 372 },                      // the tank directory (ground floor)
  windows: [                                // portholes in the back wall, [x, floor] (centre)
    [236, 0], [332, 0], [512, 0],
    [205, 1], [299, 1], [393, 1], [500, 1],
    [110, 2], [205, 2], [299, 2], [393, 2], [500, 2]
  ],
  plants: [[72 + 12, 0], [404, 0], [528, 1], [528, 2]]   // potted plants, [x, floor]
};
