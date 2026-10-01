// All feel/tuning constants live here. Tweak freely.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.TUNING = {
  view: { w: 320, h: 180 },          // internal low-res resolution (scaled up with nearest-neighbor)

  swim: {
    maxSpeed: 78,        // px/s at full input
    accel: 300,          // px/s^2 while holding a direction
    drag: 2.4,           // water drag (higher = stops sooner); exponential per second
    idleDrag: 3.2,       // drag applied when no direction is held
    sneakMult: 0.38,     // max speed multiplier while holding Shift (sneaking)
    boostPerLevel: 0.18, // +18% max speed / accel per speed upgrade level
    gravity: 260,        // px/s^2 when above water (surfacing / air pockets)
    airDrag: 0.6,
    hitbox: { w: 10, h: 8 }
  },

  // On dry land (Tide Pools) the diver walks; it only swims once the water is deep enough to submerge it.
  walk: {
    accel: 300,          // px/s^2
    max: 44,             // walking speed
    friction: 10,        // how quickly you stop on land
    sneakMult: 0.45,     // Shift on land = careful walking
    jump: 112,           // jump velocity (W / Up on land)
    airControl: 0.6,
    swimDepth: 7         // water this deep (px) at your chest switches you to swimming
  },

  camera: {
    stiffness: 5.5,      // follow speed (higher = snappier)
    lookahead: 0.45,     // seconds of velocity to lead by
    maxLookahead: 42
  },

  net: {
    swingTime: 0.34,
    activeFrom: 0.05, activeTo: 0.24,
    reach:  [0, 14, 16, 19],    // index = net level (1..3)
    radius: [0, 9, 13, 18],
    pryTime: 1.2,               // seconds of holding to pry a clinging creature
    maxLevel: 3
  },

  speedMaxLevel: 3,

  bait: { lifetime: 22, sinkSpeed: 7, lureRadius: 95 },

  stealth: {
    carelessNoise: 0.55  // player speed / base max speed above which creatures consider you careless
  },

  knockback: { light: 150, strong: 300, stun: 0.45 },

  chests: { active: 6, respawnMin: 40, respawnMax: 80, lifetime: 300, minPlayerDist: 220 },

  creatures: {
    simRadius: 520,      // creatures farther than this from the player are frozen
    respawnTime: 45      // seconds before a caught creature's slot refills
  },

  plants: { regrowTime: 50 },

  tank: { capacity: 12, decorCapacity: 40 },

  save: { key: 'aquadise.save.v1', autosaveEvery: 10 }
};
