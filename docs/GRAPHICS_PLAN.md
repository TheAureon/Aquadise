# Graphics plan: the shader layer

Goal: keep the 320 x 180 pixel-art game exactly as it is, and put a real-time WebGL layer between "the
frame is drawn" and "the frame is on screen", for colour grading, depth fog, light, glow and water.
CLASSIC keeps the current look with no WebGL at all.

## 1. How the game renders today (Stage 0 audit)

### The loop (src/game.js)
- `loop(ts)`: fixed 60 Hz updates (`update(STEP)`, up to 6 catch-up steps), then **one `draw()` per
  animation frame**. A frame error is caught and logged once; the game never stops.
- `draw()` = `drawScene()` + REDO TUTORIAL's question + `Transition.draw` (the stepped fade to black) +
  `Touch.drawOverlay` (the touch controls, on their own canvas).

### The canvases
| canvas | size | what it holds | how it reaches the screen |
|---|---|---|---|
| `#game` | 320 x 180 (`AQ.TUNING.view`) | everything: world, HUD, menus, text | CSS scales it (`image-rendering: pixelated`); `fit()` picks a **whole-number** scale with a mouse, any scale (>= 0.5) with touch |
| `AQ.Render.light` | 320 x 180, offscreen | the darkness overlay (night, caves, deep) with holes cut for lights | drawn onto `#game` by `Render.lighting` |
| terrain bitmaps (`AQ.Terrain`) | world-sized, offscreen | the painted seabed, rocks, back walls | `drawImage` per frame (only the visible part) |
| hill / station paint canvases | scene-sized, offscreen | the hill, the building | `drawImage` per frame |
| station `full` | whole building | the zoomed-out view, re-rendered each frame | scaled down with smoothing |
| photo canvases (`composePhoto`) | tank size, then x `photo.scale` | the tank + frame + caption | `toBlob` → PNG download |
| `#touch` | the window, device pixels | the touch controls | its own fixed layer (redrawn only when it changes) |

Input (`src/input.js`) maps a pointer to game pixels with `#game`'s on-screen rectangle and its
`width` (320). Touch (`src/touch.js`) reads the same rectangle.

### Every place the picture is drawn or tinted
World (sea): `Render.background` (sky / water colour bands from a blurred biome tint field, light
shafts, night stars, marine snow) → `ShootingStars.draw`, `Gulls.draw` → `Terrain.draw` → chests,
bottles, doors, creatures, the player, the net, `FX` particles → `Terrain.drawFront` →
`Render.surface` (the wavy water line) → **`Render.lighting`** (darkness overlay; lights cut stepped
holes; coloured lights add a `lighter` glow) → **`Render.twilightTint`** (warm gradient at dawn / dusk)
→ `ShootingStars.drawWater`, `Starfall.draw`, `Dive.drawWorld`, **`Hydro.draw`** (a dim while
listening, ripples) → **`Render.heavyHaze`** (the DEEP haze + vignette) → `Terrain.drawGlow`.

Lights already exist as a list: `collectLights()` in game.js gathers the player's lamp (the LAMP
upgrade widens it), terrain lights, fireflies, glowing creatures (`Creatures.lights`), chests, bottles
and fallen stars into `G.lights` = `[{ x, y, r, color?, power?, flicker? }]` in world pixels.

Hill (`src/hill.js`): sky sprite, painted hill, the player, a flat night overlay, then the UFO beam
(`lighter`), its pool of light, motes, the UFO, FX, the beam-up prompt.

Station (`src/station.js`): space background + planets + twinkles, the painted building, lamp-light
cones (`lighter`), every tank window (backdrop, creatures, a radial glow for the nursery), the trophy
wall, console, beam pad, the player; the whole-building view renders all of it to `full` and scales it.

Tank screen (`src/aquarium.js`): the tank (backdrop, swaying light shafts, decor, creatures, bubbles,
glass frame), then its interface (tray, buttons, cards, notes), or photo mode's frame.

Title (`src/title.js`): the sea world drawn under the menu (`Title.drawBack`), then the logo and menu.

Interface: HUD, toasts, tips, the guided-dive panel, nudges, the requests tracker, badge toasts, map,
log, guide, pause, settings, save panels, Transition — all drawn into `#game` after the world.

Placeholder art: `tools/gen-placeholders.js` draws every sprite (shapes in `src/placeholder-art.js`)
into PNGs + `assets/manifest.js`; `tools/embed-sprites.js` packs them as base64 into
`assets/sprites-embedded.js`, which is what loads when the game is opened from a file (`file://`).

## 2. The render abstraction (Stage 0, done)

`src/gfx/gfx.js` (`AQ.Gfx`) is the one place a frame is presented:

- `beginFrame(game)` before anything is drawn,
- `markWorld()` at the boundary where the **world** ends and the **interface** begins (once a frame;
  called from `drawScene` for the sea / title / hill / station, inside `Aquarium.draw` between the tank
  and its interface, at the start of interface-only screens: sound test, touch test, the tanks
  overview; `draw()` marks it as a fallback),
- `present(game)` when the frame is finished.

In CLASSIC all three do nothing: `#game` is still what you see, so nothing looks different.

## 3. The shader layer (Stage 1 built the pipeline; Stages 2-3 add to it)

```
 game draws world  ──► markWorld(): upload #game as the WORLD texture, then clear #game
 game draws UI     ──► present(): upload #game (now only the interface, transparent) as the UI texture
                       WebGL canvas (#view, device pixels):
                         world texture ─► effects (grade, fog, bloom, light, water) ─► sharp upscale
                         UI texture    ─► sharp upscale, drawn on top, untouched by effects
```

- **Two textures, one 2D canvas.** The game keeps drawing into `#game` as today. At `markWorld` the
  world is uploaded and `#game` cleared to transparent; the rest of the frame (interface) is uploaded
  at `present`. "Over" blending is associative, so world + interface composed on the GPU is exactly
  what the single canvas would have shown. Effects only ever touch the world texture, so HUD, text,
  buttons and the touch controls stay crisp and readable.
- **The visible canvas.** A new `#view` WebGL canvas sits exactly over `#game` (same CSS box), sized
  in device pixels, `pointer-events: none`. `#game` stays in the page (made invisible with
  `opacity: 0`, not `display: none`) so input mapping, touch and `fit()` keep working unchanged.
- **Sharp upscale.** The low-res textures use NEAREST sampling with a "sharp bilinear" shader
  (bilinear only inside a 1-pixel seam band between texels), so pixels stay square at any scale,
  including the fractional scales used on phones, with no shimmer.
- **Soft effects at screen resolution.** Light, fog, glow and water are worked out per screen pixel
  from smooth inputs (depth, light list, time), so they stay smooth while the sprites stay crisp. Bloom
  runs on small downsampled textures (half / quarter of the world texture) and is added on top.
- **Inputs to the shader** per frame (no allocation: one reused Float32Array): time, the clock
  (daylight, twilight, night), scene id, the camera's world position and depth, the lamp level, the
  light list (capped per quality level), REDUCE FLASHING, quality flags.
- **Quality levels** (SETTINGS > OPTIONS > GRAPHICS): HIGH, MEDIUM, LOW, CLASSIC. A first-run test picks
  the default; a governor steps down one level if the frame rate stays low (never up). Saved in
  `AQ.State.settings.graphics`; old saves migrate to the auto-picked default.
- **Photo mode / exports** run the photo canvas through the same effect pass into an offscreen
  framebuffer, read it back and save that (CLASSIC: as now).

## 4. Risks and how they're handled

| risk | handling |
|---|---|
| **Input coordinate mapping** | `#game` keeps its CSS box and `width = 320`; `#view` copies that box exactly and ignores the pointer. Every button kind gets clicked in the tests. |
| **Touch controls** | They stay on their own `#touch` canvas above everything, untouched by effects. `Touch.toScreen` / `gameRect` still read `#game`. |
| **Photo mode** | Exports go through the effect pass (`AQ.Gfx.processImage`); CLASSIC unchanged. If reading back fails, the photo is saved without effects rather than failing. |
| **Resizing / high-DPI** | `#view` is resized on `resize` / `visualViewport` changes to `cssSize x devicePixelRatio` (capped by quality level). |
| **Fractional scales (phones)** | Today nearest-neighbour CSS scaling gives uneven pixel widths there; the sharp-bilinear shader fixes that. |
| **WebGL missing / shader fails / context lost** | Each step checked; on any failure → CLASSIC (`#game` visible again), no error shown. `webglcontextlost` → CLASSIC at once; `webglcontextrestored` → rebuild, return to the chosen level. |
| **file:// "tainted canvas"** | Uploading a canvas to WebGL needs it to be origin-clean. Sprites from `file://` PNGs would taint `#game`; the game already loads the embedded base64 copies when opened from a file (data: URLs are clean), so uploads work. If an upload still throws a SecurityError, the game drops to CLASSIC for the session and says nothing breaks; hosted versions are unaffected. |
| **Safari** | WebGL1 only (no WebGL2 features), `highp` not assumed in fragment shaders (`mediump` default, `highp` only where supported), no float textures needed, premultiplied alpha handled explicitly. |
| **Performance** | Two texture uploads of 320 x 180 per frame (cheap), effects cost scales with quality (resolution cap, light count, bloom taps). A frame-time overlay (debug flag) and per-scene measurements each stage. |
| **REDUCE FLASHING** | Every animated term multiplies its speed / amplitude by a calm factor from config; flicker and grain off. |
| **Readability** | Interface is never on the world texture; effects that dim (fog, vignette) are capped in config. |

## 5. Status

- **Stage 1 (done):** `src/gfx/gl.js` (helpers), `src/gfx/shaders.js` (sharp upscale, grading, depth fog,
  bloom chain, vignette, grain, the interface on top), `src/gfx/gfx.js` (levels, first-run pick,
  governor, context loss / restore, `processImage` for photos, testing keys + frame-time overlay). The
  world / interface split works as planned: `#game` stays in the page with `opacity: 0`, `#view` copies
  its box exactly, so mouse, touch and the log button map as before.
- **file://** tested in Chromium: works (embedded sprites). If a browser still refuses to let WebGL read
  the canvas, `texImage2D` throws a SecurityError; the game catches it and stays CLASSIC for the session.
- **Stage 2 (done):** light, water and sky in the composite shader (MEDIUM / HIGH). Darkness + the light
  list move into the shader (`Gfx.takeLighting`; LOW / CLASSIC keep the 2D overlay); the lamp is a cone;
  creature `glow` data; god rays, caustics (only near open water: a "water-coloured" mask), plankton at
  depths, surface reflection + glint path, refraction (HIGH); clouds (only on pixels matching the sky
  gradient), sun / moon glow, the sunset sun, the beam's glow. The old 2D light shafts and marine snow are
  skipped when the shader draws water.
  **Performance:** the first version ran the whole effect shader per screen pixel; on a software renderer
  at 1280 x 720 that was 3-7 fps on MEDIUM / HIGH. Now MEDIUM / HIGH render the world with effects into a
  framebuffer at 2x / 3x of 320 x 180 (`levels.*.fxScale`), and a tiny second pass (`Shaders.final`)
  scales it up sharply and adds vignette, grain and the interface. Measured (Chromium + SwiftShader, a
  software renderer, 1280 x 720; real graphics chips are many times faster and weren't available to test):

  | scene | CLASSIC | LOW | MEDIUM | HIGH |
  |---|---|---|---|---|
  | sea day | 60 | 31 | 16 | 8 |
  | sea night | 60 | 35 | 19 | 9 |
  | deep | 60 | 32 | 16 | 8 |
  | hill | 60 | 36 | 21 | 11 |
  | station | 60 | 37 | 21 | 12 |
  | tank | 60 | 37 | 23 | 11 |

  JavaScript cost of the layer: 0.3-1.2 ms a frame. The first-run pick already sends software renderers to
  CLASSIC, and the governor steps down if a real machine can't keep up.
- **Stage 3 (done):** tanks, the station and special scenes (MEDIUM / HIGH, `levels.*.scenes`).
  - **Scene kinds:** each level compiles one composite program per kind of scene (`world`: sea, hill,
    title; `station`; `tank`: the tank screen and photos), so each carries only the code it needs.
    `uScene.x`: 1 sea, 2 hill, 3 station, 4 tank.
  - **The light map:** lights are no longer looped per screen pixel. `Shaders.lights` draws them once per
    world pixel into two small textures (tint + how lit; glow + the station's soft contact shadows) and
    the composite samples them smoothly. This also frees the composite's uniform room: the light count
    is set by the graphics chip's room (`MAX_FRAGMENT_UNIFORM_VECTORS`), so phones with little room get
    fewer lights instead of no effects.
  - **Tanks:** `Aquarium.gfxInfo` gives the glass on screen, water line, sand, style, mood and lights
    (glowing decor, glowing creatures). The 2D shafts and sand ripples step aside (`Gfx.tankWater`).
  - **Station:** `Station.gfxInfo` gives the rooms (dim inside), floors / ceilings and what stands on them
    (soft shadows), on-screen portholes (space shows through), the planets (rim light from a distant
    sun) and the building's lights (robot, pad, console, tank windows, ceiling lamps, trophy wall,
    portholes). Its words (tank names, the nursery's count, "empty", the trophy count, prompts, the view
    hint) now draw after the world (`St.drawUI`, `H.drawUI` for the hill's prompt), so effects never
    touch them; in CLASSIC the order on screen is unchanged.
  - **Streaks:** `ShootingStars.gfxStreaks`, `Starfall.gfxStreaks` hand the shader up to 4 streaks; a
    landing adds a light that swells and fades (`Starfall.lights`).
  - **Transitions:** two effect framebuffers; when the screen changes (`viewKey`), the old one's last frame
    cross-fades into the new one in the final pass (not under a fade to black). The fade to black is
    smooth while the shader layer is on.
  - **Measured** (same setup as Stage 2: Chromium + SwiftShader, a software renderer, 1280 x 720; fps):

    | scene | CLASSIC | LOW | MEDIUM | HIGH |
    |---|---|---|---|---|
    | sea day | 60 | 34 | 18 | 10 |
    | sea night | 60 | 33 | 21 | 11 |
    | deep | 60 | 34 | 18 | 10 |
    | hill | 60 | 35 | 22 | 11 |
    | station | 60 | 31 | 14 | 7 |
    | tank | 60 | 37 | 22 | 15 |

    The light map made the sea faster than after Stage 2 even with the new work. JavaScript cost of the
    layer: 0.3-1.2 ms a frame. Real graphics chips weren't available to measure.
