# Aquadise

A cozy 2D pixel-art diving game: swim an open underwater world, catch fictional creatures with a
net, and bring them home to biome-themed aquarium tanks.

**Stack:** plain HTML5 Canvas + vanilla JavaScript. No build step and no dependencies.

## Run it

Open `index.html` in a browser. Double-clicking works in Chrome, Edge, and Firefox. A local server is
the most reliable option:

```sh
npx http-server -c-1 .      # or: python3 -m http.server
# then open http://localhost:8080
```

## Controls

| action              | keys                                     |
|---------------------|------------------------------------------|
| swim / walk         | WASD / arrow keys                        |
| jump (on land)      | Space (or W / Up)                        |
| sneak (slow, quiet) | hold Shift                               |
| net                 | left-click (aims at the mouse)           |
| pry a stuck creature| keep holding left-click after the swing  |
| drop bait           | B / K, or right-click                    |
| interact (beam up/down, open a tank) | E                         |
| climb a ladder      | W / S (or Up / Down) on a ladder         |
| building: whole-view toggle | V                                |
| field guide         | I (Left/Right: turn the page, Esc: close)  |
| collection log      | L (Left/Right: tabs, WASD or Up/Down: move, Q/E or the dots: biome, wheel: scroll, Enter: open entry, then Left/Right: prev/next species, Esc: back / close) |
| map                 | M                                        |
| pause / home / reset | Esc                                     |
| help overlay        | H                                        |
| mute / unmute sound | O (anywhere)                             |

### Touch screens (phones, tablets)

Touch controls turn on by themselves with the first touch (**SETTINGS > TOUCH > TOUCH CONTROLS**:
AUTO / ON / OFF, saved). Hold the device sideways: in portrait a "Rotate your device" screen shows and
the game waits. The game fills the screen (keeping its shape, clear of notches and the home bar),
and the controls sit in the black side bars where there's room, or over the game's edges:

| action | touch |
|---|---|
| swim / walk / climb ladders | the joystick: put a thumb down anywhere in the lower part of the left side and slide (it appears under your thumb; a small push does nothing) |
| jump | **JUMP** (up arrow), or push the joystick far up on land |
| sneak | **SNEAK** (footprints) turns it on / off; it lights up and SNEAKING shows in the HUD |
| net | tap the game where you want to swing; keep the finger down after the swing to pry. A quick tap in the joystick area swings there too |
| drop bait | **BAIT** (sea only) |
| interact (beam up/down, a tank, the directory) | **INTERACT** (a hand) shows up whenever the game shows a prompt |
| log, map, guide, help, mute, pause, settings | **MENU** (top corner) opens a panel with all of them |

Keyboard and mouse keep working at the same time. **SWAP SIDES** (same settings tab) puts the
joystick on the right and the buttons on the left. The controls fade when you haven't touched them
for a few seconds. Sizes, positions, fading and the joystick's feel are in `AQ.TUNING.touch`. To try
them on a computer, set `AQ.TUNING.debug.forceTouch: true`: the controls show and the mouse acts as a
finger (drag in the joystick area, click the buttons).

In the aquarium: **Q/E** switch tanks, **F** feeds, **T** (or TANKS) shows every tank at a glance.
Drag a tray item into the tank (or click it, then click in the tank). Drag a placed item to move it;
right-click or **Delete** removes it. Tray pieces show ♥ when a creature in the tank loves them and a
green dot when they suit the tank's theme (best ones first; hover for details). While carrying a piece,
a toolbar offers FLIP, LAYER, PUT BACK and REMOVE. **X** flips the held or hovered piece, **Z** moves it in front of / behind everything,
**U** (or UNDO, Ctrl+Z) undoes the last decor change, and CLEAR (click twice) empties the tank's decor.
Click a creature for its info card. Hover the stars for what's helping and what's missing. The
**FISH** tray moves creatures between the tank and storage.

**Photo mode** (tank screen: the PHOTO button or **P**): the buttons, trays, hints and info cards
hide and a camera frame shows. **Space** or a click in the tank takes a picture: a shutter sound, a
quick white flash, and a PNG downloads at 3x the game's pixels (nearest-neighbour, no blurring), named
like `Aquadise-TidePools-2026-10-03.png`, with a small "Saved!" preview. **Z** freezes the creatures
so you can pose a shot, **I** hides or shows hearts and mood icons, **F** cycles the frame (none,
pixel border, polaroid) and **C** turns the caption (tank name, stars, date) on for the first two
(the polaroid always has one). **P** or **Esc** leaves. Works on every tank, predator tanks included.
Tuning: `AQ.TUNING.photo` (key, scale, default frame, flash, preview time). When the game is opened
straight from disk (file://) the sprites load from `assets/sprites-embedded.js` (kept in sync by
`tools/gen-placeholders.js`, or run `node tools/embed-sprites.js` after replacing art), because
browsers won't let a page save pictures made from file:// images.

## How it plays

- **Title screen (home):** the world drifts by behind the logo. Continue, New Game (asks to
  confirm when a save exists) or Controls. Esc → Home returns to it from the game.

- **Catching.** Creatures react to how close and how fast you are. Sneak, or drop bait to lure
  them out, then net them. Each species uses a reusable catch behaviour (hides, darts, schools,
  camouflage, timing windows, patrols, needs coaxing, and so on). The log lists a tip for every species.
- **Collection log tabs:** SPECIES (each biome's species, families grouped under a heading),
  VARIANTS (every rare colour variant, grouped by biome, with a "VARIANTS n/total" count) and NOTES
  (field notes from message bottles). Left/Right arrows or a click switch tabs; Q/E or the < >
  buttons switch biome. All counts are worked out from the data.
- **Tide Pools are dry land** (merged from the Milestone 2 prototype): you walk and jump on the
  shore and only swim once the water is deep enough to submerge you. Shallow pools are splashed
  through and deep ones can be swum in. Tap a pool with the net to try for a Glasswinged Minnow.
- **The sunken ship** in the Sunken Ruins has a door at the bow, a cabin door and two hatches.
  They open by themselves as you swim up and close behind you (listed in `data/world.js` `doors`).
- **Upgrades from chests:** NET, SPD, LAMP (wider light in dark places) and DEEP (how deep you can
  dive before the water gets heavy: you slow down, the view softens and you drift back up, never
  any damage). Limits are in `upgrades.depthLimitY`; level 0 reaches everything except the bottom of the
  trench's rounded floor, which each level lets you sink a little further into (level 3 reaches the bottom).
- **New catch behaviours:** `mirror` (copies your swimming mirrored; hold still and it drifts in),
  `lure` (a glowing decoy on a stalk; net the dim creature beside it, not the light) and `midair`
  (leaps out of the water; only nettable in the air). See the header of data/creatures.js.
- **Nine new creatures:** Auroravein Squid (ice, night), Moonshell Crab (tide pools,
  night), Ribbonmane (kelp, mirror), Candlepolyp (coral plant, blooms at night), Skyleap Flyfish
  (open ocean, mid-air), Sail Turtle (open ocean), Pressure Tortoise (bottom of the trench, depth 3),
  Bellcrab (ruins) and Firefly Frog (mangrove, night, lure). Existing creatures have no new gates.
- **Axolotls (Lush Cave):** five natural colours, each its own species with its own log entry,
  sexes and breeding: Azalea (pink), Aurum (gold), Pluvia (cyan), Viridis (green) and Navious (blue).
  A pair always has babies of its own colour. They share a `family: 'axolotl'` tag, so the log groups
  them under an AXOLOTL heading. Azalea and Viridis are common, Pluvia and Navious uncommon and Aurum
  rare: the weights (and how many axolotls are out at once) are `AQ.data.families.axolotl` in
  `data/creatures.js`. Their rare bred variant is a pattern (white with gold speckles), not a hue
  shift, so it never looks like one of the five colours. Older saves: the pale pink lush-cave species
  they replace becomes the Azalea Axolotl (catches, log, tanks, storage, eggs and courting pairs).
- **Message bottles + field notes:** one bottle per species, lying on the seabed, on the Tide Pools
  shore or bobbing at the surface in that species' biome. They glint softly; swim (or walk) into one
  to pick it up, like a chest. Found bottles are saved and never come back. Each holds a field
  researcher's notes on its species (`data/lore.js`): an epithet, an invented scientific name and a
  few lines of biology. The species' name only appears once you've caught it ("this creature"
  until then). Read them on a species' entry page (ENTER or click in the SPECIES tab, in its Field
  Notes section) or in the NOTES tab, grouped by biome. The log header shows "BOTTLES FOUND n/total". Pickup toasts (and every other toast)
  sit just above the controls hint at the bottom of the screen while it is showing, never on top of it.
  Placement is the same every time (seeded), never inside terrain, and every bottle can be reached
  without any upgrade (checked with the sea scene's own "can the player be here" test and a flood
  fill from the start that stops at the level-0 depth limit). Tuning: `AQ.TUNING.bottles`
  (pickup radius, glint, glow, spacing, share floating at the surface).
- **Distant seagulls:** wherever the sky shows (the sea surface, the Tide Pools shore and the hill),
  a small flock of 1-4 tiny V-shaped gulls now and then drifts slowly across, flapping between two
  wing frames and moving less than the camera so they feel far away. Day, dawn and dusk only (they
  fade away at night), tinted to suit the sky; scenery only. A very faint, rate-limited gull cry plays
  as a flock passes, through the ambience volume (and mute). Tuning: `AQ.TUNING.gulls` (how often,
  most flocks at once, flock size, speed, parallax, flap speed, cry volume and gap).
- **Shooting stars (scenery):** at night (the shared day/night clock) a thin bright streak with a short
  fading trail now and then crosses the sky wherever it shows: the sea surface, the Tide Pools shore and
  the hill. Under the surface you see a faint glow sliding through the water instead (fading with
  depth). In the aquarium building, which is in space, a streak now and then passes outside a porthole
  you can see, day or night. Each streak has a very soft whoosh on the ambience volume (and mute);
  it's in the Sound Test as SHOOTING STAR. Tuning: `AQ.TUNING.shootingStars` (how often, speed, trail
  length, angle, tints, underwater glow, sound volume).
- **No fail state.** Hostile creatures only knock you back. Air is unlimited.
- **Progression** comes only from chests: a bigger net (3 levels) and faster swimming (3 levels).
  Six chests exist at a time, and they despawn and respawn around the world.
- **Getting to the aquarium.** Walk left off the far edge of Tide Pools (by the little signpost)
  and the screen fades to a separate hill scene. Walk up the hill and stand in the UFO's beam,
  then press **E**: you're lifted up and arrive in the aquarium building, which floats in space.
  Inside there's normal gravity. Walk, jump and climb the ladders, and press **E** at a tank to tend
  it, or at the DIRECTORY console for the overview of every tank. The BEAM PAD on the ground floor
  (**E**) sends you back to the hilltop. Optional: **V** zooms out to the whole building so you see every
  tank at once, while you keep control of the robot (default in `AQ.TUNING.station`, your choice is saved); walk down the hill's right edge to return to Tide Pools.
  The hill and the building are their own scenes and never appear on the world map. The game
  saves which scene you're in. Caught creatures still go straight to their tank. (The old Tab
  shortcut is a test-only setting: `AQ.TUNING.debug.tabOpensAquarium`, off by default.)
- **One-time tips (optional, never blocking).** Short, friendly tips pop up the first time something
  happens: a creature notices you, your first bait, first catch, closing the log for the first time,
  your first chest, heavy deep water, the first evening, a message bottle, a falling star or meteor
  shower, the hill's UFO beam, the aquarium building, your first tank, a new star level or unlock, a
  ♂/♀ pair sharing a tank, the first courtship and baby, and a creature's first bump. One at a time,
  with a quiet gap between them, in a small box where nothing else draws (out in the world: the top
  centre under the area name; on the tank screen: the bottom-left, over the sand). They never show
  mid-netting, during a transition, in photo mode or in a menu, and any key or click closes one (Esc
  and clicks on the box don't do anything else). Each shows once; seen tips are saved. HINTS ON/OFF and
  RESET TIPS are in the Sound settings (pause menu or title). Older saves skip every tip their own
  progress shows they already know. Text: `data/tutorial.js` (key names are filled in from the real
  bindings, see below). Sounds: NEW TIP and STEP COMPLETE in the Sound Test. Tuning: `AQ.TUNING.tips`.
- **Optional guided first dive.** NEW GAME on a fresh save asks "Want a quick guided dive?" (YES /
  NO THANKS; Esc is no thanks, and the answer is saved). It's a short checklist shown one step at a
  time in the top-left corner (STEP n OF 9), with a soft glowing ring and arrow near the thing to do:
  walk, hop onto the rocks, wade into the deep water and swim, sneak up on a little minnow, swing the
  net, catch it (a very easy Glasswinged Minnow waits in the water for you: it's a real catch), drop
  bait, open the log, done. Each step completes when you actually do it (a soft chime), nothing ever
  pauses or takes your controls, and if you wander off it just waits (it dims, and hides away from the
  sea). SKIP skips a step, STOP ALL ends it. Restart it any time from the pause menu (TUTORIAL); it
  never changes your progress. Text: `data/tutorial.js` (dive). Tuning: `AQ.TUNING.dive`. Testing: set
  `debug.tutorialReset: true` and press **R** to restart the dive and reset every tip
  (`debug.tutorialResetKey`).
- **The GUIDE.** A small paged field-guide book: from the title screen (GUIDE), the pause menu
  (GUIDE) or the help line's key (**I** by default, `keys.guide`). Left/right, A/D or the arrows turn
  the page; Esc or the guide key closes it. Ten short pages, each with a picture: moving, swimming and
  sneaking; catching (the net, bait and how creatures behave); upgrades and chests; day, night and
  night events; getting to the aquarium; tanks; sexes, breeding and rare colors; the log and message
  bottles; photo mode; sound and settings. A page (or line) about a feature the build doesn't have is
  left out. Text: `data/tutorial.js` (guide); key names and numbers like the day length or the
  rare-color odds are filled in live from the bindings and config.js (`{k:...}`, `{c:...}`, `{inv:...}`).
- **REDUCE FLASHING.** In SETTINGS > OPTIONS (pause menu or title), saved with your other settings.
  When it's on: the photo camera flash becomes a faint, slow fade instead of a white flash; shooting
  stars, the underwater glow and falling stars are dimmer and slower (and meteor-shower skies calmer);
  a falling star lands with a soft glow instead of a sparkle burst; the UFO beam, its lights and the
  beam pad hold still instead of animating and pulsing (and the station beam eases up instead of
  jumping bright); scene fades are smooth instead of stepped; and fast blinking is held steady: your
  stun blink, the firefly frog's flickering decoy, the map's "you" dot and star marker, the HUD star,
  the meteor-shower sparkle, tank nervous drops, the photo REC dot, NEW labels, the selected-creature
  marker and the Variants outline. A one-time tip mentions it the first time a flash plays; the
  Guide's Sound page too. Tuning: `AQ.TUNING.calm`.
- **Save files and safety.** EXPORT SAVE and IMPORT SAVE are on the title screen and in the pause
  menu. Export downloads your save as `Aquadise-save-YYYY-MM-DD.json` (it works even when the browser
  won't let the game save). Import lets you pick a file, checks it carefully (an Aquadise save, the
  right structure, a version this game understands) and refuses anything else with a friendly message,
  then asks before replacing your save; the imported save loads through the normal loading and
  migration, just like an old save, and your previous save becomes the backup. Saves carry a version
  number (`AQ.Save.VERSION`, now 2; the original v1 saves still load). Before every save the previous
  good one is kept as a backup. If your save can't be read, the title asks whether to restore the
  backup (or import a file) or start fresh, and the unreadable save is never overwritten: starting
  fresh keeps it aside (`aquadise.save.v1.unreadable`). If the browser blocks saving (e.g. private
  browsing), the game keeps running, says so once, and the title / pause screens show a small note.
  Tuning: `saveFile.maxImportBytes`.
- **Key bindings in one place:** `AQ.TUNING.keys` in config.js (plus `interactKeys`, `audio.muteKey`,
  `photo.key`, `station.zoomKey`). The game reads them, and the help line, the title's CONTROLS panel
  and every tip show key names from them (`src/keys.js`), so changing a key changes the text too.
- **Falling stars and meteor showers.** Some nights a star visibly falls and lands somewhere in the
  sea or on the shore: always a spot you can reach at upgrade level 0 (the same scan and checks as the
  message bottles), with a clear drop from the sky (never in a cave), never inside terrain, past the
  depth limit or on top of you. It lands with a burst and a soft descending chime, and a soft light
  column rises from the spot so you can find it from far away. In open water a small group of Starfall
  Minnows appears; on the shore or the sandy seabed, an Aerolite Crab. They glow, wait a few real
  minutes (`lingerMinutes`, default 3) and then fade out slowly (once faint they can't be netted).
  They're caught like anything else and follow the usual ♂/♀ balancing (the sex you're missing is more
  likely). A toast says where it fell ("A shooting star fell near the Kelp Forest!"), the map (M) shows
  a sparkling star at the spot, and a little star sits next to the HUD moon while something is waiting.
  - **Meteor showers:** on rarer nights (about one in 5-6) the sky fills with shooting stars all night
    and 2-4 stars land at different spots; each landing may also bring a Comet Ray. It's announced at
    dusk ("The sky is full of falling stars tonight") with a gentle shimmering music cue and a small
    sparkle next to the HUD moon. The cue (METEOR SHOWER) and the landing chime (STAR LANDS) are in the
    Sound Test.
  - **Schedule:** nights are counted at dusk and each night's plan is seeded from the world seed and
    the night number and saved, so reloading never re-rolls it. Catch-up: a star always falls at least
    every 3 nights. Stars only fall at night and only in the sea, but it all keeps going wherever you
    are (the hill, the building, a tank): come back and the star may still be waiting. Waiting stars
    are saved too.
  - Tuning: `AQ.TUNING.starfall` (star / shower chances, catch-up, stars per shower, Comet Ray chance,
    when in the night they fall, water vs shore, group size, how long they wait and fade, distances,
    the light column, chime volume).
  - Testing: set `debug.starKeys: true` in config.js; then (any time, even by day) **G** makes a
    star fall right now and **J** starts a meteor shower right now (2-4 stars over the next ~20 s).
    The keys are `debug.fallStarKey` / `debug.showerKey`.
- **Starfall tank and its three creatures.** The building's 3rd floor has a new tank, STARFALL: deep
  indigo water, drifting twinkling star motes and a faint glow welling up from the middle. It's in every
  list of tanks (the DIRECTORY / TANKS overview, the whole-building view, Q/E switching, vibe tooltips,
  photo mode). Four themed decorations: Stardust Patch (always available), Meteorite Rock, Crater Bowl
  and Star Lantern (unlock at its 1st, 2nd and 3rd star tiers). Its creatures have no wild spawn; they
  only appear through night events (falling stars and meteor showers):
  - **Starfall Minnow** (fish, darts): tiny and glowing, in small groups where a star lands in water.
  - **Aerolite Crab** (crustacean, wary): a shell like a space rock, where a star lands on the shore or sand.
  - **Comet Ray** (fish, curious): larger, with a glowing tail; only during meteor showers, the rarest.
  They follow the same rules as everything else (♂/♀, breeding, rare variants, likes, moods, photo
  mode). The log gives them their own STARFALL page with "FALLING STARS ONLY" / "METEOR SHOWERS ONLY"
  tags. Each has field notes in a message bottle: the minnow's on the Open Ocean seabed, the crab's
  on the Tide Pools shore, the ray's on the Coral Reef seabed (set by `bottle` in `data/creatures.js`).
  Data: `AQ.data.specialTanks` + `tankStyles.starfall` (data/aquarium.js), the creatures' `event` field.
- **Predator wing.** The building's 4th floor holds 5 predator tanks (Reef, Open-Water, Deep, Cave
  and Swamp Hunters). Every creature marked `predator` lives there instead of in its biome's tank;
  the grouping is data in `data/aquarium.js` (`predatorTanks`). Each floor has 5 tank slots
  (`data/scenes.js`); unused slots stay dark. Old saves move predators over automatically.
  Creatures only get nervous when a tank is crowded (more than `aquarium.nervousAbove`).
- **Sexes.** Every animal is ♂ or ♀ (plants have none; `sexes: 'none'` in data/creatures.js
  opts a species out). Males have a small cyan marking. The log tracks both: a species is
  *discovered* when you catch either sex and *complete* with both. Once you have one sex, the other
  spawns more often (`sexes.missingBias`).
- **Breeding (optional).** A ♂ and ♀ of the same species living in one tank may court (they swim
  together with hearts) when the tank has at least `breeding.minStars`, was fed recently and nobody
  is nervous. When the courtship finishes, the egg (a baby for mammals) appears in the **Universal
  Nursery**, never in the parents' tank, with a little sparkle by the parents if you're watching
  them; eggs hatch there and babies grow up over `breeding.growMinutes`. It all runs on real time,
  wherever you are in the game. The log marks species you've bred with a ♥. Nothing requires it.
  The parents' tank's star tooltip says when an egg is on its way or a baby is in the nursery.
- **The Universal Nursery** (3rd floor, next to Starfall; NURSERY in the directory, the TANKS
  overview, the whole-building view and Q/E). A soft, warm, pastel tank where babies of every species
  and biome live together, predators included: babies never stress, scare or eat each other, so no
  predator rules apply. Only bred babies can be in it, never caught adults. It has its own room
  (`nursery.capacity`, 20, counting babies, grown babies and eggs; shown as ♥ n/20); when it's full,
  breeding pauses everywhere and the parents' tooltip says "BREEDING PAUSED: THE NURSERY IS FULL,
  GRADUATE SOME BABIES". The nursery has no vibe stars, stress or unlocks; feeding still works (just
  for fun). Its four decorations (Shell Cradle, Bubble Mobile, Soft Sand Mound, Little Pebble Nest)
  are free from the start. Older saves: babies still growing and eggs in any tank (or its storage)
  move into the nursery when the save loads, keeping sex, colour and birth time; if it's full the
  rest stay where they are (nothing is ever deleted). Code: `src/nursery.js`, `src/breeding.js`.
  - **Growing up and graduating.** Babies grow up over `breeding.growMinutes`. In the nursery, hover
    (or tap) a baby to see how long it has left; its info card shows its name, sex, rare colour and
    time left, and grown babies wear a little graduation cap. Each grown baby has a GRADUATE button
    (on its card, and under it in the nursery's FISH tray); it sends the baby to the **storage** of
    its home tank (its biome tank, its predator tank, or Starfall for the falling-star creatures),
    with a soft chime (`graduate`, also in the Sound Test) and a message saying where it went.
    GRADUATE ALL (bottom right of the nursery) sends every grown baby at once and says how many went
    where. Babies still growing can't graduate yet (the button shows the time left). If a home tank's
    storage ever has a limit (`tank.storageCapacity`, none by default) and it's full, the baby simply
    stays in the nursery and the message says why. The log's entry shows BRED, how many are IN
    NURSERY and how many GRADUATED.
  - Testing: set `debug.fastNursery: true` in config.js. Courting, hatching, growing up and the rest
    after a birth then take seconds (`debug.fastNurserySeconds`), and a ready pair starts courting at
    once. The usual requirements still apply (a ♂ and ♀ adult in a fed tank with enough stars).
- **Day and night.** A new game starts in the bright mid-morning (10:00, `clock.startHour`); saves keep
  their own time. The sea has a calm clock (`clock.dayMinutes`, 6 real minutes per day by default)
  with dawn, day, dusk and night; nights are darker and bluer near the surface, while deep and cave
  areas look the same as before. The HUD shows a sun, sunrise or moon. Creatures with
  `active: 'night'` only come out at night and fade away at dawn. Testing: set
  `debug.timeSkip: true` and press **N** in the sea to jump ahead `clock.skipHours`.
- **Rare colour variants.** A baby born in a tank has a small chance (`breeding.variantChance`, 4%) to
  be a rare colour variant (✦). Only bred babies, never wild ones. The log's VARIANTS tab lists every
  species that can have one (every animal that can breed: plants and sexless species can't) as a
  "normal > rare" card. The rare colour stays hidden until you breed it; until then its box shows the
  next step (the missing ♂ or ♀, ♂♀ = put a pair in its tank, ♥ = a pair is breeding), and the panel
  below spells it out.
- **Aquarium.** One tank per biome, and a creature can only live in its own biome's tank.
  Nothing ever dies and nothing is punished:
  - **Tank vibe (0-5 stars):** decor variety and amount, biome-themed pieces, plants, being fed
    recently, calm (no predator stress), room to swim, and creatures having things they like.
    Weights and targets are in `AQ.TUNING.aquarium` (`src/vibe.js` does the maths).
  - **Likes and mood:** each creature has one or two `likes` (decor/plant tags). It visits liked
    things and does a happy idle there with hearts and sparkles. A small icon shows its mood:
    heart = delighted, sparkle = happy, ".." = uneasy, blinking drop = nervous.
  - **Everyday life:** creatures rest on rocks and logs, tuck into hideouts, graze plants, swim
    in schools, nap, drift and blow bubbles. FEED tips a shaker and everyone gathers to munch.
    Predators make smaller tankmates nervous (they hide but are never hurt).
  - **Decor:** basics plus themed pieces for every biome. Dark tanks (trench, cave, vents, lush
    cave) glow around light pieces. Each biome has its own water colours, light and particles
    (`data/aquarium.js`).
  - **Unlocks:** when a tank first reaches 2, 3.5 and 5 stars it unlocks new themed decor for
    that biome. There is no currency or shop.
  - **Overview (TANKS):** stars, species count and who's nervous or hungry, for every tank.

## Sound and music

Everything you hear is generated in code: soft effects, a quiet ambience bed for each place, and
gentle generative music. Sound starts on your first click or key press (browsers don't allow it
before that), and pauses while the tab is hidden.

- **Settings:** title screen → SOUND, or Esc → SOUND. MUSIC and EFFECTS volume, MUTE, and the
  SOUND TEST. They're saved with the game (New Game keeps them). **O** mutes or unmutes anywhere.
- **Sound test:** SOUND → SOUND TEST lists every effect, ambience bed and music piece (day and
  night versions, plus the reward phrase). Click one to hear it. Beds and music loop until clicked
  again. Each entry shows its id.
- **Feel:** effects and ambience are muffled while you're underwater and open up on land (hill,
  shore, station). Places crossfade into each other, and the log, map and pause menu duck the
  music to about half.
- **Music:** ambient by default: slow, with a soft pad that never stops, long airy notes and lots
  of echo (`musicAmbient` in config: 1 = ambient, 0 = livelier and pluckier). Each place has its own
  key, tempo, instruments and short tune (`data/music.js`).
  One shared motif comes back everywhere, voiced by each place's lead instrument. Phrases are
  sparse, with long rests. At night the sea pieces play slower, quieter and darker.
- **Creature sounds:** rare and quiet. One nearby creature makes a little sound every so often,
  by category, or its own `voice:` in `data/creatures.js`.
- **Recordings:** footsteps on sand and grass, and going into and climbing out of the water, use real recordings
  (single steps cut from the walking clips in `assets/audio/`; a random one plays each step).
  To swap any other sound for a file, put it in `assets/audio/`, map its id in
  `AQ.data.audioFiles` (`data/music.js`), and run `node tools/embed-audio.js` so it also plays when
  the game is opened straight from disk. Effects use their id, beds use `amb:<place>`, and music
  uses `music:<piece>`.
- **Tuning** (`AQ.TUNING.audio` in `src/config.js`): `master` (overall volume), `musicAmbient`, `musicPace`
  (tempo), `musicRest` (silence between phrases), `creatureVoiceEvery` (seconds between creature
  sounds), plus the default volumes, ambience level, crossfade time, menu duck, underwater muffle
  and the mute key.

## Languages

The game is ready for translation; English is the only language so far. Every text the player sees
comes from a language file in `data/lang/` (English: `data/lang/en.js`), looked up with `t()`
(`src/lang.js`). A key missing in a language falls back to English. **SETTINGS > OPTIONS > LANGUAGE**
picks the language (saved with your settings); by default the game uses the browser's language if
there's a file for it, otherwise English. Dates in photo captions use the language's format (photo
file names stay plain ASCII), and the pixel font's characters live in `data/glyphs.js`: a character
it doesn't have yet draws as a small box. Rules for adding text: `CLAUDE.md`.

**Checking the game:** `node tools/check-game.js` opens the game in a headless browser, visits every
main screen (title, settings, sound test, the sea, the map, pause, the guided dive, a tip, the hill,
the building, the directory, every tank, the info cards, photo mode, every log tab, every Guide page,
the touch controls, a save panel) and reports console errors and characters missing from the font.
Options: `--lang en`, `--dump file.json` (save the text drawn on every screen) and
`--compare a.json b.json` (compare two dumps), `--shots dir` (screenshots). It needs Playwright:
`npm install --no-save playwright && npx playwright install chromium` (a test tool only; the game itself
has no dependencies).

## Project layout

```
index.html, style.css
data/world.js         world layout: floor profile, biome rects/palettes/props, terrain shapes, tide pools
data/creatures.js     every creature + plant (behaviour, params, spawn rules, hints)
data/decorations.js   aquarium decorations (tags, theme biomes, unlock tiers, glow)
data/aquarium.js      per-biome tank looks (water colours, light, darkness, particles)
data/scenes.js        layout of the aquarium building (floors, ladders, tank spots, pad, windows)
data/sprite-spec.js   sprite size classes + animation rows
assets/manifest.js    sprite list (generated) -> assets/sprites/**.png
src/config.js         ALL tuning constants (swim speed/accel/drag, camera, net, bait, chests...)
src/world.js          builds the pixel mask from data; spatial queries
src/terrain.js        paints each biome into its own low-res pixel bitmap + props
src/behaviors.js      reusable catch behaviour types
src/creatures.js      spawning / simulation / drawing of creatures + plants
src/catching.js       net, pry, bait
src/aquarium.js       tanks, decorating, creature life + moods, info card, overview, undo
src/vibe.js           tank happiness (stars), helping/missing reasons, unlock milestones
src/transition.js     reusable fade-to-black scene transition (AQ.Transition.go)
src/scenes.js         scene system: world / hill / station, scene switching, save restore, prompts
src/miniworld.js      small collision maps for side scenes (ladders, one-way platforms)
src/hill.js           the hill scene with the UFO and its beam
src/station.js        the aquarium building in space (tanks on the walls, directory, beam pad)
src/ui.js             collection log, map, pause
src/gulls.js          distant seagull flocks in the sky (sea + hill)
src/shootingstars.js  night shooting-star streaks (sky, underwater glow, station portholes)
src/keys.js           key bindings: pressed / held checks and key names for the text
src/lang.js           languages: t() lookups, English fallback, plurals, name sorting, date format
data/lang/en.js       every player-visible text, in English (the master copy for translations)
data/glyphs.js        the pixel font's characters (add letters for other languages here)
src/tips.js           one-time tips: events, queue, safe placement, saved as seen
src/dive.js           the optional guided first dive: prompt, steps, checklist, markers
src/guide.js          the GUIDE: a paged field-guide book (title, pause menu, help-line key)
src/savefile.js       EXPORT / IMPORT SAVE, import checks + confirm, the save-recovery choice
src/starfall.js       falling stars + meteor showers: nightly plan, landings, light columns, map/HUD marks
src/bottles.js        message bottles: deterministic, reachable placement, pickup, glint
assets/sprites-embedded.js   base64 copy of the sprites for file:// (tools/embed-sprites.js)
src/audio.js          audio engine: mixer, voice limit, underwater filter, settings, file mapping
src/sfx.js            every sound effect recipe (registered by id)
src/ambience.js       the looping place sounds + their crossfading director
src/music.js          generative music engine + director (pieces in data/music.js)
src/sounddirector.js  per-frame sound hooks: steps, splashes, beam, chimes, creature voices
src/soundtest.js      the SETTINGS panel (SOUND / OPTIONS / TOUCH tabs) and the SOUND TEST screen
src/touch.js          touch controls: pointers, joystick, on-screen buttons, MENU panel, rotate screen
data/lore.js          field notes, one per species (found in message bottles)
data/tutorial.js      tutorial text: help line, controls panel, one-time tips, guided dive, Guide pages
data/music.js         music pieces, scales, motif, creature voice map, audio file mapping
assets/audio/         recorded sounds (+ embedded.js, generated by tools/embed-audio.js)
tools/gen-placeholders.js   writes placeholder PNGs + manifest from the data files
tools/check-game.js         headless check of every main screen (console errors, text dumps, language keys)
tools/sprites.html          animated preview of every sprite
docs/SPRITE_SPEC.md         how to make sprites that drop in cleanly
```

### Adding content (data only)

- **New creature:** add an entry to `data/creatures.js` that uses an existing `catch_behavior`,
  run `node tools/gen-placeholders.js` for a placeholder sprite, and it spawns in its biome.
- **New biome:** add a biome rect, palette and props to `data/world.js`, adjust the `floor`
  profile or add `shapes`, then add creatures with that `biome` id. Its tank, log page and map
  label appear automatically.
- **Real art:** drop PNGs over the placeholders, following `docs/SPRITE_SPEC.md`.

## Milestones

1. Swimming, camera, pixel pipeline: done
2. Tide Pools terrain (terrain-first bitmaps): done
3. Creature data, behaviours, net catching: done
4. Tanks, decorations, idle behaviour, collection log: done
5. Chests with upgrades and respawn: done
6. Remaining biomes through data and terrain: done

## Simple choices made for the open questions

- **Bait:** unlimited. One piece in the water at a time, and dropping a new one replaces it.
  It sinks, lasts 22 s, and lures nearby calm creatures.
- **Decorations:** 13 base pieces plus one themed piece per biome are always available and
  unlimited. Three more per biome unlock through tank happiness. Harvested plants are added with
  counts, and placing one uses one up. Removing a plant returns it to your stock.
- **Fed** lasts 20 real minutes, then fades over 40 more. A hungry tank only loses a little vibe.
- **Tank capacity:** 12 creatures per tank, with extras going to that tank's storage (swap them in
  the FISH tray). Up to 40 decorations per tank.
- **Saving:** automatic to `localStorage` every 10 s, when leaving the aquarium, and on page
  close. Esc → Reset save wipes it.
- **Audio:** all made in code with the Web Audio API (no audio files). See *Sound and music* below.
- **Getting home:** the walk to the hill and the UFO (see above). The title screen's AQUARIUM
  button still opens the tank screen directly. Caught creatures go to their tank immediately.
- Plants can decorate any tank. Only creatures are restricted to their own biome.
- On land, Shift is careful walking (same stealth rule as sneaking underwater), not a sprint.
  Space jumps; the net is left-click only.
- Rare Trenchmaw: each time its slot (re)spawns there's a 45% chance it appears, re-rolled every 60 s.
