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
| collection log      | L                                        |
| map                 | M                                        |
| pause / home / reset | Esc                                     |
| help overlay        | H                                        |

In the aquarium: **Q/E** switch tanks, **F** feeds, **T** (or TANKS) shows every tank at a glance.
Click a tray item, then click in the tank to place it. Click a placed item to move it, and right-click
it to remove it. **X** flips the held or hovered piece, **Z** moves it in front of / behind everything,
**U** (or UNDO, Ctrl+Z) undoes the last decor change, and CLEAR (click twice) empties the tank's decor.
Click a creature for its info card. Hover the stars for what's helping and what's missing. The
**FISH** tray moves creatures between the tank and storage.

## How it plays

- **Title screen (home):** the world drifts by behind the logo. Continue, New Game (asks to
  confirm when a save exists) or Controls. Esc → Home returns to it from the game.

- **Catching.** Creatures react to how close and how fast you are. Sneak, or drop bait to lure
  them out, then net them. Each species uses a reusable catch behaviour (hides, darts, schools,
  camouflage, timing windows, patrols, needs coaxing, and so on). The log lists a tip for every species.
- **Tide Pools are dry land** (merged from the Milestone 2 prototype): you walk and jump on the
  shore and only swim once the water is deep enough to submerge you. Shallow pools are splashed
  through and deep ones can be swum in. Tap a pool with the net to try for a Glasswinged Minnow.
- **The sunken ship** in the Sunken Ruins has a door at the bow, a cabin door and two hatches.
  They open by themselves as you swim up and close behind you (listed in `data/world.js` `doors`).
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
tools/gen-placeholders.js   writes placeholder PNGs + manifest from the data files
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
- **Audio:** stubbed. `src/audio.js` has no-op `play()`/`music()` hooks that are already called
  at the right moments.
- **Getting home:** the walk to the hill and the UFO (see above). The title screen's AQUARIUM
  button still opens the tank screen directly. Caught creatures go to their tank immediately.
- Plants can decorate any tank. Only creatures are restricted to their own biome.
- On land, Shift is careful walking (same stealth rule as sneaking underwater), not a sprint.
  Space jumps; the net is left-click only.
- Rare Trenchmaw: each time its slot (re)spawns there's a 45% chance it appears, re-rolled every 60 s.
