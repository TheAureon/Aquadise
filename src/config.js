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

  // Chest upgrades beyond NET and SPD. Both start at level 0 (also for older saves).
  upgrades: {
    lanternMax: 3,
    lanternRadius: [0, 16, 32, 50],   // extra light radius (px) around you in dark places, per lantern level
    depthMax: 3,
    // Below this world y the water gets heavy, per depth level 0..3 (null = no limit). The sea surface
    // is y 96. The trench floor is a rounded U (rim ~1200, lowest ~1290): each level lets you sink a
    // little further into it, and level 3 reaches the very bottom (the Pressure Tortoise).
    depthLimitY: [1240, 1256, 1272, null],
    heavySlow: 0.55,          // swim speed multiplier while in heavy water
    heavyPush: 140,           // gentle upward nudge (px/s^2), growing a little the deeper past the limit you are
    heavyHaze: 0.35           // how much the screen softens (0..1)
  },

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

  // Aquarium "vibe" (tank happiness). Each part scores 0..1; the weighted average becomes 0-5 stars.
  // Raise a weight to make that part matter more. Nothing here can ever hurt a creature.
  aquarium: {
    weights: { decor: 1.2, theme: 0.8, plants: 0.8, fed: 0.8, calm: 0.8, space: 0.5, likes: 1.0 },
    decorVarietyTarget: 6,    // different kinds of decor for a full "variety" score
    decorAmountTarget: 10,    // total decor pieces for a full "amount" score
    themeTarget: 4,           // decor pieces matching the tank's biome for a full "theme" score
    plantTarget: 3,           // plants for a full "plants" score
    comfortable: 8,           // creatures before the tank starts to feel crowded
    crowdedFloor: 0.5,        // "space" score when the tank is completely full (never lower)
    stressPenalty: 0.6,       // how much a fully nervous tank lowers "calm" (gentle on purpose)
    nervousAbove: 10,         // more creatures than this in one tank -> the smallest few feel a bit nervous
    fedFreshMinutes: 20,      // real minutes a feeding counts as "fed"...
    fedFadeMinutes: 40,       // ...then fades to hungry over this many minutes (they never starve)
    recomputeEvery: 0.5,      // seconds between vibe updates while watching a tank
    // creature likes + mood
    likeRadius: 22,           // px: how close a creature must be to a liked thing to enjoy it
    visitChance: 0.3,         // chance a creature picks "go visit something I like" as its next activity
    enjoySeconds: [4, 8],     // how long a visit lasts
    happyFxEvery: 1.6,        // seconds between little hearts/sparkles while enjoying
    moodIconEvery: 4,         // seconds between mood icons popping over each creature
    moodIconShow: 1.4,        // seconds each mood icon stays visible
    mood: { base: 0.45, fed: 0.2, likePresent: 0.15, nearLike: 0.25, crowded: 0.1, stressedCap: 0.25 },
    // everyday life: relative weights of what a creature does next (bigger = more often)
    activity: { swim: 30, feed: 18, play: 14, rest: 16, shelter: 8, sleep: 7, drift: 7 },
    schoolChance: 0.65,       // chance a fish swims with others of its kind instead of alone
    grazeChance: 0.7,         // chance "feed" means grazing a plant (when the tank has plants)
    perchChance: 0.7,         // chance "rest" means resting on a rock/log (when there is one)
    sleepSeconds: [7, 14],
    bubbleEvery: 7,           // average seconds between a creature's little breath bubbles
    pace: [0.8, 1.25],        // each creature gets its own speed multiplier in this range
    feedShakeSeconds: 1.4,    // how long the food shaker sprinkles
    feedPellets: 8,
    chompSeconds: 0.45,
    undoSteps: 30,            // how many decor changes UNDO remembers per tank visit
    unlockStars: [2, 3.5, 5]  // tank stars needed for each biome's unlock tiers 1, 2 and 3 (new themed decor)
  },

  // ---- day and night (one clock for the whole game: the sea and the hill's sky follow it; it keeps running in the station)
  clock: {
    dayMinutes: 6,            // real minutes for one full day + night
    startHour: 5,             // a new game (and an older save) starts here: the beginning of the day (dawn)
    dawnHour: 5, dawnHours: 1.5,   // dawn starts at 5:00 and takes 1.5 game hours to become full day
    duskHour: 18.5, duskHours: 1.5, // dusk starts at 18:30 and takes 1.5 game hours to become night
    nightBelow: 0.35,         // night-only creatures come out when daylight drops below this
    nightDarkness: 0.5,       // how dark the sunlit sea gets at night (deep / cave areas are already darker)
    skipHours: 3              // the debug time-skip key jumps this many hours
  },

  // ---- getting to the aquarium building (Tide Pools -> the hill -> the UFO -> the building in space)
  debug: {
    tabOpensAquarium: false,  // TESTING ONLY: true lets Tab open the tank screen from anywhere (the old shortcut)
    timeSkip: false,          // TESTING ONLY: true lets you press N in the sea to skip ahead clock.skipHours
    timeSkipKey: 'KeyN'
  },
  interactKeys: ['KeyE'],     // "interact" (beam up/down, open a tank, use the directory)

  transition: {               // the fade-to-black used for every scene change
    fadeOut: 0.45,            // seconds to fade to black
    hold: 0.2,                // seconds held on black
    fadeIn: 0.5               // seconds to fade back in
  },

  entrance: {
    triggerX: 12,             // walk left past this x (world px) at the far edge of Tide Pools to go to the hill
    returnX: 36               // where you reappear in Tide Pools when you walk back down
  },

  hill: {                     // the hill scene (its own little area, not on the world map)
    bottomFlat: 70,           // flat ground at the foot of the hill (px)
    slopeLength: 240,         // how long the climb is (px)
    rise: 92,                 // how high the hilltop is above the foot (px)
    topWidth: 150,            // width of the flat hilltop (px)
    ufoHeight: 70             // how high the UFO hovers above the hilltop (px)
  },

  beam: {
    width: 30,                // UFO beam width (px); stand inside it to get the prompt
    liftSpeed: 46,            // how fast the beam lifts you (px/s)
    landSpeed: 24,            // how gently it sets you down when you arrive (px/s)
    glow: 0.55                // beam brightness (0..1)
  },

  climb: { speed: 42 },

  // Breeding in the tanks (optional, never needed for anything). Calm and slow on purpose.
  // A ♂ + ♀ of the same species living in a tank court, then an egg (or a baby) appears.
  breeding: {
    enabled: true,
    minStars: 3,              // tank vibe needed before anyone courts
    fedLevel: 0.5,            // "fed recently" (1 = just fed; it fades over aquarium.fedFadeMinutes)
    startChance: 0.3,         // each check, chance a ready pair starts courting
    courtMinutes: 2,          // real minutes of courting before an egg / baby
    eggMinutes: 4,            // real minutes from egg to baby (egg-laying species)
    cooldownMinutes: 20,      // real minutes a tank rests after a new arrival
    growMinutes: 30,          // real minutes for a baby to grow up
    variantChance: 0.04,      // chance a newborn is a rare colour variant (bred babies only, never wild)
    checkSeconds: 5           // how often all tanks are checked (cheap; runs anywhere in the game)
  },

  sexes: {
    missingBias: 0.25         // once you have one sex of a species, the other spawns this much more often
                              // (0.25 -> 75% chance; 0 = always 50/50)
  },

  station: {                  // the aquarium building in space
    zoomedOutByDefault: false, // OPTIONAL view: true starts zoomed out to see the whole building (all tanks)
    zoomKey: 'KeyV',          // toggles the zoomed-out view in the building (your choice is saved)
    zoomSeconds: 0.6,         // how long the zoom in/out takes
    zoomMargin: 10            // space (px) kept around the building when zoomed out
  },       // ladder climbing speed in the aquarium building (px/s)

  // ---- distant seagulls in the sky (sea surface, Tide Pools shore, the hill); day, dawn + dusk only
  gulls: {
    everySeconds: [35, 80],   // a new flock now and then, after this many seconds (random in the range)
    maxFlocks: 2,             // most flocks in the sky at once
    flockSize: [1, 4],        // birds per flock
    speed: [5, 9],            // how fast they drift across the sky (screen px/s): slow and far away
    parallax: 0.12,           // how much they shift with the camera (small = far away)
    flapSeconds: 0.7,         // time per wing frame (slow flaps)
    cryVolume: 0.6,           // their faint cry, on top of the ambience volume
    cryMinGap: 25             // at most one cry every this many seconds
  },

  // Shooting stars (scenery only): thin bright streaks across the night sky (sea surface, Tide Pools
  // shore, hill), a faint glow passing through the water when you're under the surface, and now and
  // then a streak outside the portholes of the aquarium building (space: day or night).
  shootingStars: {
    everySeconds: [9, 22],    // at night, a new streak after this many seconds (random in the range)
    stationEverySeconds: [14, 30], // in the building, a streak past a porthole after this many seconds
    nightBelow: 0.3,          // daylight below this counts as "night" for streaks (they fade in with the dark)
    speed: [170, 260],        // screen px/s
    life: [0.45, 0.8],        // seconds a streak lasts
    trail: [12, 24],          // trail length in px (fades from the bright head to nothing)
    angle: [14, 38],          // degrees below horizontal (left or right)
    colors: ['#fff6dc', '#dcefff', '#ffe6f2', '#e8fff4'],   // soft tints, picked per streak
    waterGlow: 0.10,          // underwater: how bright the passing glow is (0 = off)
    waterGlowDepth: 500,      // ...fading to nothing this many px below the surface
    soundVolume: 0.55,        // the soft whoosh, on top of the ambience volume (respects mute)
    soundMinGap: 4            // at most one whoosh every this many seconds
  },

  // Falling stars + meteor showers (src/starfall.js). Each night (counted at dusk, saved) gets a plan
  // seeded from the world seed + night number, so reloading never re-rolls it. Stars only fall at night,
  // only in the sea, on spots reachable at upgrade level 0 (the message-bottle scan), never on you.
  // Night length: with the default clock (6-minute days) night lasts about 2.25 real minutes.
  starfall: {
    starChance: 0.4,          // chance an ordinary night has a falling star
    guaranteeEvery: 3,        // ...but never more than this many nights in a row without one
    showerChance: 0.18,       // chance a night is a meteor shower (about one night in 5-6)
    showerStars: [2, 4],      // stars that land during a meteor shower (each at a different spot)
    rayChance: 0.35,          // during a shower, chance each landing also brings a Comet Ray
    fallWindow: [0.08, 0.7],  // when in the night stars fall (0 = nightfall, 1 = dawn)
    groundShare: 0.4,         // chance a star lands on the shore / sandy seabed (Aerolite Crab) instead of open water (minnows)
    minnows: [2, 4],          // Starfall Minnows in a water landing's group
    lingerMinutes: 3,         // real minutes the creatures wait at a landing before fading
    fadeSeconds: 20,          // ...the last this many seconds they slowly fade out (can't be netted once faint)
    maxFloorDepth: 180,       // px below the surface a star can still reach the sandy seabed (and never into caves)
    minPlayerDist: 90,        // px: never lands closer than this to you
    minApart: 260,            // px: landings on the same night stay this far apart
    fallSeconds: 1.4,         // how long the falling streak takes to come down
    showerSkyBoost: 7,        // during a shower, shooting-star scenery is this many times more frequent
    column: { height: 260, width: 9, color: '#d8e4ff', alpha: 0.2 },   // the soft light column over a landing
    chimeVolume: 0.8,         // the soft landing chime (sound effects volume)
    nearChime: 360            // px: closer than this the chime is full volume, further away it's quieter
  },

  // ---- photo mode on the tank screen (PHOTO button or the key below)
  photo: {
    key: 'KeyP',              // enter / leave photo mode
    scale: 3,                 // saved PNG is this many times the game's pixels (crisp, no blurring)
    defaultFrame: 2,          // 0 = no frame, 1 = pixel border, 2 = polaroid with a caption
    flashSeconds: 0.25,       // the white camera flash
    previewSeconds: 2.5       // how long the little "Saved!" preview stays
  },

  // ---- message bottles (one per species, holding its field notes; see src/bottles.js, data/lore.js)
  bottles: {
    pickupRadius: 12,         // how close (px) you get to pick one up
    glintPerSecond: 1.2,      // how often a bottle sparkles while it's on screen
    glowRadius: 14,           // soft light around a bottle in dark places
    minSpacing: 60,           // bottles are kept at least this far apart (px)
    scanStep: 3,              // placement search step (px); smaller = more candidate spots
    airBand: 30,              // dry-land bottles only this close above the waterline (the shore), never the sky
    floatShare: 0.4           // share of bottles floating at the surface (the rest lie on the seabed / shore)
  },

  // ---- sound and music (all made in code; see src/audio.js, src/sfx.js, src/ambience.js, src/music.js)
  audio: {
    master: 0.8,              // overall loudness of everything (0..1)
    musicVolume: 0.6,         // default MUSIC slider for a new save (0..1; players change it in SOUND)
    sfxVolume: 0.8,           // default EFFECTS slider for a new save (0..1)
    ambienceLevel: 0.5,       // place sounds (waves, drips, wind...) relative to the effects slider
    maxVoices: 14,            // most effects allowed to ring at once (extra ones are skipped)
    underwaterCutoff: 900,    // how muffled effects + ambience are underwater (Hz; lower = more muffled)
    musicPace: 1,             // music tempo multiplier (0.8 = slower, 1.2 = quicker)
    musicRest: 1,             // silence between music phrases multiplier (2 = twice as much quiet)
    musicAmbient: 1,          // 1 = ambient (slow, a soft pad that never stops, long airy notes, more echo);
                              // 0 = the livelier, plucky style; anything in between blends
    nightPace: 0.8,           // night versions of the sea music play this much slower...
    nightVolume: 0.7,         // ...and this much quieter
    crossfadeSeconds: 3,      // how long music + ambience take to blend into the next place
    menuDuck: 0.5,            // music level while the log, map or pause menu is open
    lookahead: 0.3,           // seconds of music notes scheduled ahead (keeps timing steady, cheap)
    creatureVoiceEvery: 9,    // average seconds between little creature sounds (higher = rarer)
    creatureVoiceRange: 120,  // only creatures this close (px) make sounds
    stepEvery: 20,            // px walked between footsteps (about two steps a second at walking speed)
    muteKey: 'KeyO'           // quick mute / unmute, anywhere
  },

  save: { key: 'aquadise.save.v1', autosaveEvery: 10 }
};
