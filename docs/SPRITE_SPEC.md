# Aquadise sprite spec

Every character, creature, plant and decoration is a **PNG sprite sheet** listed in
`assets/manifest.js`. Replace a placeholder PNG with real art of the **same name and layout** and
it shows up in game with no code changes.

## Sheet layout

- Frames are laid out **left to right**, animations **top to bottom** (one row per animation).
- All frames in a sheet are the same size: the entry's `fw` × `fh`.
- **Everything faces RIGHT.** The engine mirrors sprites for left-facing movement.
- Transparent background (RGBA PNG), no anti-aliasing or soft edges. Hard pixels only.
- Draw at 1:1. Don't upscale. The game renders at 320×180 and scales up with nearest-neighbour.
- Keep a 1 px transparent margin inside each frame so outlines aren't clipped. (The placeholder
  generator now enforces this: it measures all frames and shifts or slightly shrinks the art to fit.)
- A dark 1 px outline and top-light / bottom-shadow shading match the placeholders and terrain.

## Size classes (frame size in px)

| class       | frame   | used for                                                    |
|-------------|---------|-------------------------------------------------------------|
| `tiny`      | 12 × 12 | snails, minnows, gobies, small decor                       |
| `small`     | 16 × 16 | most fish, crabs, newts, small plants                      |
| `medium`    | 24 × 24 | otters, seals, lanternjaw, larger plants                   |
| `large`     | 32 × 32 | blue runner, sea-lizard, cave crawler, castle/arch decor    |
| `huge`      | 48 × 48 | reeftooth, trenchmaw                                        |
| `tall`      | 16 × 32 | bell kelp, pillar                                           |
| `wide`      | 32 × 16 | eels, snakes, weed mat, driftwood                           |
| `widelarge` | 48 × 24 | dwarf croc                                                  |
| `mediumlong`| 28 × 24 | crimsonback (a mid-size fish that is a little longer)       |

The player diver frame is 28 × 40 (anchor 14,20). The swimming and upright poses are the same size (about 22 px). A creature's class is its `sprite_size` in `data/creatures.js`.

## Animations (rows)

| kind               | row 0                      | row 1                    | row 2                  |
|--------------------|----------------------------|--------------------------|------------------------|
| creature           | `idle`: 4 frames @ 5 fps   | `move`: 4 frames @ 10 fps | —                      |
| plant              | `idle` (sway): 4 @ 3 fps   | —                        | —                      |
| decoration         | `idle`: 1 frame            | —                        | —                      |
| player (28×40)     | `idle`: 4 @ 5 fps          | `swim`: 6 @ 12 fps       | `net` swing: 4 @ 14 fps |
| player, cont.      | row 3 `stand`: 2 @ 2 fps   | row 4 `walk`: 4 @ 9 fps  | row 5 `jump`: 1 frame   |
| chest (16×16)      | col 0 `closed`, col 1 `open` (one row, 2 frames)        |                        |
| bait (8×8)         | `idle` glint: 2 @ 3 fps    |                          |                        |

So a `small` creature sheet is **64 × 32** (4 frames × 16 px, 2 rows), and a `huge` one is 192 × 96.

Camouflage, hiding, stress and similar states are done by the engine (transparency, shaking,
icons), so they need no extra rows.

## Anchor points

The anchor is the pixel inside a frame that sits on the entity's world position.

- **Player:** anchor (14,20). Swimming poses are centred on it (about 22 px long). In the
  upright rows (stand/walk/jump/standnet), the feet go on row 24 (anchor + 4, the bottom of the
  collision box) and the figure is about 22 px tall, matching the swimming size. `standnet` is the upright pose without the front arm, because
  the game draws the reaching arm during a net swing.
- **Creatures, player, bait:** the frame centre `(floor(fw/2), floor(fh/2))`. Centre the body in the frame.
- **Plants, decorations, chests:** bottom-centre `(floor(fw/2), fh-1)`. The bottom row of pixels
  touches the ground, so don't leave empty rows under the base.
- Ceiling clingers (Frost Isopod) are flipped vertically by the engine. Draw them upright.

## Male / female variants

Every animal with two sexes has two sheets with the same size, rows and anchor:

- `creatures/<id>.png` (key `creature.<id>`) is the base art and is used for **females**.
- `creatures/<id>_m.png` (key `creature.<id>.m`) is used for **males**.

The placeholder male is the same art plus a small bright cyan marking on top of the body. Real art
can make the difference anything readable (colour, fin, crest), but keep the size and anchor. If a
`_m` sheet is missing, males fall back to the base sheet. Species with `sexes: 'none'` (and plants)
have no male sheet.

## Juveniles (babies born in the tanks)

Every animal also has a juvenile sheet, `creatures/<id>_baby.png` (key `creature.<id>.baby`), with the
**same frame size, rows and anchor** as the adult. The placeholder is the adult art drawn about 60%
size and lighter, centred in the frame. Babies use it until they grow up, then switch to the adult
(♂ or ♀) sheet. If it's missing, the adult sheet is used.

## Rare colour variants (bred babies only)

A baby born in a tank has a small chance (`AQ.TUNING.breeding.variantChance`) of being a rare colour
variant of its species; wild creatures never are. Each animal has three variant sheets, all with the
same size, rows and anchor as the normal ones:

- `creatures/<id>_v.png` (key `creature.<id>.v`): the variant adult (female / default)
- `creatures/<id>_v_m.png` (key `creature.<id>.v.m`): the variant male
- `creatures/<id>_baby_v.png` (key `creature.<id>.baby.v`): the variant juvenile

The placeholders are the normal sheets with every colour rotated around the colour wheel (a fixed
amount per species, 100–260°). A family can override this with a pattern instead
(`AQ.data.families.<family>.variantArt` in `data/creatures.js`, using the placeholder `speckle` option):
the axolotls' rare variant is white with gold speckles, so it never matches one of the five natural
colours (pink, gold, cyan, green, blue). Real art can paint any variant it likes, such as albino, golden or
dusk-coloured. Draw it on the same frames, and the game picks it up automatically. A missing variant
sheet falls back to the normal one.

## File naming

```
assets/sprites/creatures/<creature_id>.png    e.g. creatures/drift_snail.png   (female / default)
assets/sprites/creatures/<creature_id>_m.png  e.g. creatures/drift_snail_m.png (male)
assets/sprites/creatures/<creature_id>_baby.png  e.g. creatures/drift_snail_baby.png (juvenile)
assets/sprites/creatures/<creature_id>_v.png / _v_m.png / _baby_v.png   (rare colour variant: adult, male, juvenile)
assets/sprites/plants/<plant_id>.png          e.g. plants/bell_kelp.png
assets/sprites/decor/<decoration_id>.png      e.g. decor/castle.png
assets/sprites/misc/player.png | chest.png | bait.png
```

IDs are the `id` fields in `data/creatures.js` and `data/decorations.js` (lowercase, underscores).

Decorations are one static frame, face right (the aquarium can flip them), and sit on their bottom
row. Floating pieces (`kind: 'float'`, like the buoy and lily pad) hang from the surface: `hang` in
`data/decorations.js` sets how many pixels of the sprite dip below the waterline. Pieces with a `glow`
colour light up dark tanks around them, so leave their bright parts bright.

## Starfall (falling-star creatures and their tank)

These follow every rule above (sizes, rows, anchors, ♂ / juvenile / rare-variant sheets); they're
listed here because their placeholder shapes are new.

| key | size class | placeholder | notes |
|---|---|---|---|
| `creature.starfall_minnow` | tiny (12 × 12) | `fish` + `starry` | pale, with a row of tiny belly lamps that twinkle frame to frame |
| `creature.aerolite_crab` | small (16 × 16) | `crab` + `rocky` | a pitted grey space-rock shell with faint warm (orange) cracks |
| `creature.comet_ray` | widelarge (48 × 24) | `ray` (new) | wide flapping wings, small head, star spots; a long thin tail ending in a white glowing tip (keep the tail inside the frame) |
| `decor.stardust_patch` | small (16 × 16) | `stardust` | a low mound of dark sand with glinting specks (`glow`) |
| `decor.meteorite_rock` | medium (24 × 24) | `meteorite` | dark pitted rock with glowing orange cracks (`glow`) |
| `decor.crater_bowl` | wide (32 × 16) | `crater` | a shallow crater: raised rim, dark hollow (a hideout) |
| `decor.star_lantern` | tall (16 × 32) | `starlantern` | a slim post with a glowing five-point star on top (`glow`) |

The creatures glow in the sea (`light` in `data/creatures.js`), so keep their bright parts bright.

## Universal Nursery decorations

Soft, warm pastels (pink, cream, lilac, pale blue) with gentle outlines: the nursery's water is a
light pink-to-blue gradient, so keep a dark-enough outline for them to read against it.

| key | size class | placeholder | notes |
|---|---|---|---|
| `decor.shell_cradle` | small (16 × 16) | `shellcradle` | an open pink scallop shell lined with something soft and cream |
| `decor.bubble_mobile` | medium (24 × 24) | `bubblemobile` | floats: a little hanging mobile, a string from the top and three bubble charms (pink, pale blue, pink) dangling below. It hangs from the water's surface (`hang` in data/decorations.js) |
| `decor.soft_sand_mound` | wide (32 × 16) | `sandmound` | a low, round mound of pale sand with a few pastel specks |
| `ui.gradcap` | 8 × 8, 2 frames @ 2 fps (the tassel swings), centre anchor | `uigradcap` | a tiny dark graduation cap with a gold tassel, drawn over grown babies in the nursery (just above-left of the creature) |
| `ui.radio` | 12 × 12, 2 frames (the game picks: 0 quiet, 1 the light on), centre anchor | `uiradio` | the station's little radio (station requests): a teal box with a speaker grille, a stubby antenna and a light that blinks when a request arrives. Drawn on the requests tracker and its question |
| `ui.pane` | 8 × 8, 2 frames @ 0.5 fps (a slow glint), centre anchor | `uipane` | glass panes, the tank-building material: a small stack of two pale-blue panes. Drawn in the HUD counter (top right), on the tank screen and on the panes tip |
| `decor.pebble_nest` | small (16 × 16) | `pebblenest` | a ring of round grey-pink pebbles around a soft yellow hollow |

## Tutorial UI

| key | frame | frames | anchor | notes |
|---|---|---|---|---|
| `ui.icons` | 12 × 12 | 7 (one picture per frame, drawn by frame number) | centre | small icons on the tip boxes: 0 alert (!), 1 moon, 2 star, 3 heart, 4 open book, 5 footprints (sneak), 6 sparkle. Soft bright colours with a dark outline; they sit on a dark navy box. |

| `ui.marker` | 16 × 16 | 4 @ 5 fps (a pulse) | centre | the guided dive's glowing ring around the thing to do: a thin pale-gold ring with a soft dark edge on both sides (so it reads on bright sand and in the dark), growing and shrinking a little |
| `ui.arrow` | 8 × 8 | 4 @ 5 fps (a bob) | centre | the small pale-gold arrow pointing down at the marker (or at you, for "drop bait") |

## Touch controls

Drawn big (about 50-80 screen pixels across), at whole-pixel scale, semi-transparent over the game or
in the black side bars, so keep shapes bold and simple with a dark outline.

| key | frame | frames | anchor | notes |
|---|---|---|---|---|
| `ui.touch` | 16 × 16 | 13 (one picture per frame, drawn by frame number) | centre | frame 0 is the round button base (a dark see-through disc with a pale rim), drawn under every icon; icons: 1 jump (up arrow), 2 bait (a pellet), 3 sneak (footprints), 4 interact (an open hand), 5 menu (three bars), 6 close (x), 7 back (arrow), 8 view (an eye), 9 shutter (a camera), 10 left, 11 right, 12 listen (an ear with two pale-cyan sound waves: the hydrophone's hold-to-listen button, also the hydrophone tips' icon). Icons in pale white (interact in warm yellow), inside the rim. |
| `ui.stick` | 32 × 32 | 2 | centre | the joystick: 0 the ring (thin pale rim, faint dark fill, four small direction dots), 1 the knob (a pale blue ball, half the ring's size) |

The tip box itself is drawn in code (a dark navy panel with a warm yellow top edge and a small ×).

## Hidden callers (the hydrophone update)

These follow every rule above (sizes, rows, anchors, ♂ / juvenile / rare-variant sheets). They hide
nearly see-through in the sea, so their real art can be subtle; in a tank they show normally.

| key | size class | placeholder | notes |
|---|---|---|---|
| `creature.chime_shrimp` | small (16 × 16) | `shrimp` (new) | a curled, segmented pink body, fanned tail, little legs, two long antennae with tiny pale bell tips that glint every other frame |
| `creature.chirrup_frog` | small (16 × 16) | `frog` + `throat` | a green frog whose pale vocal sac swells and shrinks frame to frame |
| `creature.hollow_piper` | mediumlong (28 × 24) | `fish` + `pipe` | a long thin tube-snouted fish with a row of dark holes along its side, like a flute |
| `creature.echoshell_snail` | small (16 × 16) | `snail` + `echo` | a pale blue-grey snail with two pale ripple rings on its shell |
| `creature.murmur_seal` | medium (24 × 24) | `seal` (new) | a plump pale seal pup: small head, big dark eye, whiskers, soft spots, flippers |
| `creature.deep_drummer` | large (32 × 32) | `fish` + `drum` | a deep-bodied dusky fish with a round, taut drum-skin patch on its flank that trembles |

## Badges

Each badge in `data/achievements.js` names an `icon`; the picture is the sprite `badge.<icon>`
(`assets/sprites/ui/badge_<icon>.png`), 12 × 12, anchored in the centre, **6 frames in one row**:

| frame | shows |
|---|---|
| 0 | earned |
| 1 | not earned yet: a dark silhouette of the same picture (no colour) |
| 2-5 | earned, with the tier mark in the lower right corner (bronze, silver, gold, a pale gem for a 4th tier) |

The placeholder (`badgeicon` in `src/placeholder-art.js`) is a round medallion in the icon's colour with
a pale symbol: `shell` (coral pink, a fan shell), `fish` (blue), `heart` (pink), `egg` (peach), `bottle`
(mint, a message bottle), `moon` (lavender, a crescent), `star` (gold), `camera` (steel blue), `crown`
(gold, Aquadise and Gold Standard), `ear` (cyan, the hydrophone badges) and `secret` (violet, a "?").
To use real art, draw the same 6 frames into `badge_<icon>.png` and mark the manifest entry
`custom: true`. A new icon name needs one line in `tools/gen-placeholders.js` (the list of icons) and its
name in `tools/check-badges.js` (ICONS). Badge cards, toasts and the BADGES tab use these frames; the
trophy wall's plaques are drawn in code (below).

## The trophy wall (badges)

The trophy wing's shell, back wall and floor reuse the building's tiles (`tile.station_hull`,
`tile.station_wall`, `tile.station_floor`). The wooden shelves, the plaques (4 × 5 px, bronze / silver /
gold with a dot in the badge group's colour) and the Aquadise cup are drawn in code in
`src/station.js` (`drawTrophyWall`); badge icons themselves are `badge.<icon>` sprites (see Badges).

## Using a different layout

If a generated sheet needs a different frame size or frame count, edit its entry in
`assets/manifest.js` (`fw`, `fh`, `anchor`, `anims`) and add `"custom": true`. The placeholder
generator (`node tools/gen-placeholders.js`) will then leave that entry and its PNG alone. Without
`--force`, the generator never overwrites an existing PNG.

Preview every sheet, animated, at `tools/sprites.html` (served from a local web server).

## Scene pieces (the hill, the UFO, the aquarium building)

All live in `assets/sprites/scene/`. Replace a PNG with real art of the same size.

| key                  | size     | frames            | anchor        | notes |
|----------------------|----------|-------------------|---------------|-------|
| `misc.signpost`      | 16 × 24  | 1                 | bottom-centre | at the edge of Tide Pools, pointing left |
| `misc.ufo`           | 64 × 32  | 4 @ 6 fps         | centre        | hovers over the hilltop |
| `misc.beam`          | 32 × 96  | 4 @ 8 fps         | top-centre    | drawn translucent ("lighter" blend), stretched to the beam's width and length |
| `misc.beampad`       | 40 × 12  | 4 @ 6 fps         | bottom-centre | the beam pad in the building |
| `misc.bottle`        | 12 × 14  | 4 @ 4 fps         | bottom-centre | message bottle (drawn upright: the game tips it over on the seabed and bobs it at the surface); a glint slides down the glass |
| `misc.console`       | 20 × 28  | 4 @ 6 fps         | bottom-centre | the tank directory |
| `misc.tank_frame`    | 64 × 44  | 1                 | bottom-centre | keep the window (x 4..59, y 4..35) transparent: the live tank shows through it |
| `bg.hill_sky`        | 320 × 180| 1                 | top-left      | fixed backdrop behind the hill |
| `bg.space`           | 320 × 180| 1                 | top-left      | must tile seamlessly (it scrolls slowly) |
| `bg.planet_ringed`, `bg.planet_small` | 56 × 32, 20 × 20 | 1 | top-left | distant planets |
| `tile.hill`          | 32 × 48  | 1                 | top-left      | row 0 = the grass surface, lower rows = soil by depth; tiles sideways |
| `tile.station_wall`, `tile.station_hull` | 32 × 32 | 1 | top-left | tiling wall / outer hull panels |
| `tile.station_floor` | 32 × 8   | 1                 | top-left      | row 0 is the walking surface |
| `tile.ladder`        | 16 × 8   | 1                 | top-left      | repeats vertically |

The player sheet also has row 7 `climb` (2 frames @ 6 fps), shown while on a ladder.
The hill's shape comes from `AQ.TUNING.hill`, and the building's layout from `data/scenes.js`, so the
art only supplies textures and props.

## Embedded copy for file://

`assets/sprites-embedded.js` holds a base64 copy of every sprite in the manifest. The game only uses
it when `index.html` is opened straight from disk (file://), so tank photos can be saved there
(browsers block saving canvases drawn from file:// images). `tools/gen-placeholders.js` refreshes it
automatically; after replacing PNGs by hand, run `node tools/embed-sprites.js`.
