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

