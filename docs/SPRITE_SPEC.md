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
- Keep a 1 px transparent margin inside each frame so outlines aren't clipped.
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

The player diver frame is 24 × 32 (anchor 12,16), which leaves headroom for the upright pose. A creature's class is its `sprite_size` in `data/creatures.js`.

## Animations (rows)

| kind               | row 0                      | row 1                    | row 2                  |
|--------------------|----------------------------|--------------------------|------------------------|
| creature           | `idle`: 4 frames @ 5 fps   | `move`: 4 frames @ 10 fps | —                      |
| plant              | `idle` (sway): 4 @ 3 fps   | —                        | —                      |
| decoration         | `idle`: 1 frame            | —                        | —                      |
| player (24×32)     | `idle`: 4 @ 5 fps          | `swim`: 6 @ 12 fps       | `net` swing: 4 @ 14 fps |
| player, cont.      | row 3 `stand`: 2 @ 2 fps   | row 4 `walk`: 4 @ 9 fps  | row 5 `jump`: 1 frame   |
| chest (16×16)      | col 0 `closed`, col 1 `open` (one row, 2 frames)        |                        |
| bait (8×8)         | `idle` glint: 2 @ 3 fps    |                          |                        |

So a `small` creature sheet is **64 × 32** (4 frames × 16 px, 2 rows), and a `huge` one is 192 × 96.

Camouflage, hiding, stress and similar states are done by the engine (transparency, shaking,
icons), so they need no extra rows.

## Anchor points

The anchor is the pixel inside a frame that sits on the entity's world position.

- **Player:** anchor (12,16). Swimming poses are centred on it. In the upright rows
  (stand/walk/jump/standnet), the feet go on row 20 (anchor + 4, the bottom of the collision box)
  and the figure is about 18 px tall. `standnet` is the upright pose without the front arm, because
  the game draws the reaching arm during a net swing.
- **Creatures, player, bait:** the frame centre `(floor(fw/2), floor(fh/2))`. Centre the body in the frame.
- **Plants, decorations, chests:** bottom-centre `(floor(fw/2), fh-1)`. The bottom row of pixels
  touches the ground, so don't leave empty rows under the base.
- Ceiling clingers (Frost Isopod) are flipped vertically by the engine. Draw them upright.

## File naming

```
assets/sprites/creatures/<creature_id>.png    e.g. creatures/drift_snail.png
assets/sprites/plants/<plant_id>.png          e.g. plants/bell_kelp.png
assets/sprites/decor/<decoration_id>.png      e.g. decor/castle.png
assets/sprites/misc/player.png | chest.png | bait.png
```

IDs are the `id` fields in `data/creatures.js` and `data/decorations.js` (lowercase, underscores).

## Using a different layout

If a generated sheet needs a different frame size or frame count, edit its entry in
`assets/manifest.js` (`fw`, `fh`, `anchor`, `anims`) and add `"custom": true`. The placeholder
generator (`node tools/gen-placeholders.js`) will then leave that entry and its PNG alone. Without
`--force`, the generator never overwrites an existing PNG.

Preview every sheet, animated, at `tools/sprites.html` (served from a local web server).
