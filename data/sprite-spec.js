// Sprite sheet conventions (see docs/SPRITE_SPEC.md). Used by the placeholder generator
// and by the manifest. Real art must follow these so it drops in without code changes.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};
AQ.data = AQ.data || {};

AQ.data.spriteSpec = {
  // size class -> [frame width, frame height] in pixels
  sizes: {
    tiny: [12, 12], small: [16, 16], medium: [24, 24], large: [32, 32], huge: [48, 48],
    tall: [16, 32], wide: [32, 16], widelarge: [48, 24]
  },
  // Animation rows. Frames run left -> right; rows top -> bottom. All sprites face RIGHT.
  anims: {
    creature: { idle: { row: 0, frames: 4, fps: 5 }, move: { row: 1, frames: 4, fps: 10 } },
    plant:    { idle: { row: 0, frames: 4, fps: 3 } },
    decor:    { idle: { row: 0, frames: 1, fps: 1 } },
    player:   { idle: { row: 0, frames: 4, fps: 5 }, swim: { row: 1, frames: 6, fps: 12 }, net: { row: 2, frames: 4, fps: 14 },
                stand: { row: 3, frames: 2, fps: 2 }, walk: { row: 4, frames: 4, fps: 9 }, jump: { row: 5, frames: 1, fps: 1 } },
    chest:    { closed: { row: 0, col: 0, frames: 1, fps: 1 }, open: { row: 0, col: 1, frames: 1, fps: 1 } },
    bait:     { idle: { row: 0, frames: 2, fps: 3 } }
  },
  // anchor = the pixel inside a frame that sits on the entity's world position
  anchors: { creature: 'center', plant: 'bottom', decor: 'bottom', player: 'center', chest: 'bottom', bait: 'center' }
};
