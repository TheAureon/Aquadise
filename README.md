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
| jump (on land)      | W / Up                                   |
| sneak (slow, quiet) | hold Shift                               |
| net                 | Space / J, or left-click (aims at the mouse) |
| pry a stuck creature| keep holding the net after the swing     |
| drop bait           | B / K, or right-click                    |
| aquarium            | Tab                                      |
| collection log      | L                                        |
| map                 | M                                        |
| pause / home / reset | Esc                                     |
| help overlay        | H                                        |

In the aquarium: **Q/E** switch tanks, **F** feeds. Click a tray item, then click in the tank to
place it. Click a placed item to move it, and right-click it to remove it. The **FISH** tray moves
creatures between the tank and storage.

## How it plays

- **Title screen (home):** the world drifts by behind the logo. Continue, New Game (asks to
  confirm when a save exists) or Controls. Esc → Home returns to it from the game.

- **Catching.** Creatures react to how close and how fast you are. Sneak, or drop bait to lure
  them out, then net them. Each species uses a reusable catch behaviour (hides, darts, schools,
  camouflage, timing windows, patrols, needs coaxing, and so on). The log lists a tip for every species.
- **Tide Pools are dry land** (merged from the Milestone 2 prototype): you walk and jump on the
  shore and only swim once the water is deep enough to submerge you. Shallow pools are splashed
  through and deep ones can be swum in. Tap a pool with the net to try for a Glasswinged Minnow.
- **No fail state.** Hostile creatures only knock you back. Air is unlimited.
- **Progression** comes only from chests: a bigger net (3 levels) and faster swimming (3 levels).
  Six chests exist at a time, and they despawn and respawn around the world.
- **Aquarium.** One tank per biome, and a creature can only live in its own biome's tank.
  Predators sharing a tank with smaller creatures make them stressed (they hide, shake, and stop
  playing or feeding). Nothing gets hurt.

## Project layout

```
index.html, style.css
data/world.js         world layout: floor profile, biome rects/palettes/props, terrain shapes, tide pools
data/creatures.js     every creature + plant (behaviour, params, spawn rules, hints)
data/decorations.js   base aquarium decorations
data/sprite-spec.js   sprite size classes + animation rows
assets/manifest.js    sprite list (generated) -> assets/sprites/**.png
src/config.js         ALL tuning constants (swim speed/accel/drag, camera, net, bait, chests...)
src/world.js          builds the pixel mask from data; spatial queries
src/terrain.js        paints each biome into its own low-res pixel bitmap + props
src/behaviors.js      reusable catch behaviour types
src/creatures.js      spawning / simulation / drawing of creatures + plants
src/catching.js       net, pry, bait
src/aquarium.js       tanks, decorating, idle behaviour, stress
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
- **Decorations:** 13 base decorations are always available and unlimited. Harvested plants are
  added with counts, and placing one uses one up. Removing a plant returns it to your stock.
- **Tank capacity:** 12 creatures per tank, with extras going to that tank's storage (swap them in
  the FISH tray). Up to 40 decorations per tank.
- **Saving:** automatic to `localStorage` every 10 s, when leaving the aquarium, and on page
  close. Esc → Reset save wipes it.
- **Audio:** stubbed. `src/audio.js` has no-op `play()`/`music()` hooks that are already called
  at the right moments.
- **Getting home:** Tab opens the aquarium from anywhere. Caught creatures go to their tank
  immediately.
- Plants can decorate any tank. Only creatures are restricted to their own biome.
- On land, Shift is careful walking (same stealth rule as sneaking underwater), not a sprint.
  W/Up jumps, because Space is the net.
- Rare Trenchmaw: each time its slot (re)spawns there's a 45% chance it appears, re-rolled every 60 s.
