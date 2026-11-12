# Roadmap

Everything from the idea list except Visitors and the tide-pool piano, with German as the second language.
Grouped into eight updates and built one stage at a time. Each stage is finished, tested and reported (with
how to try it and what can be tweaked) before the next starts, and nothing is ever left broken between
stages. The project rules apply throughout:
- all text goes through `t()` with English in `data/lang/en.js`;
- saves store ids and numbers only, and old saves keep loading;
- touch works everywhere;
- REDUCE FLASHING is respected;
- tuning lives in `src/config.js`;
- `tools/check-game.js` must show no console errors.

## The order, and why

| # | Update | Stages | Why here |
|---|---|---|---|
| A | Reach and polish (Safari / phones, real recordings) | 2 | Foundations first: everything after it gets tested on the same footing |
| B | Weather | 3 | The biggest change to how the sea feels; seasons and creatures build on it |
| C | Seasons | 3 | Uses weather's systems (sky, tints, spawns, music moods) |
| D | Life in the sea | 4 | New things to find: lights at night, migrations, grottoes, creature friends |
| E | The aquarium and station | 4 | Photo album, tank lighting, the café / gift shop, the family tree |
| F | Sound extras | 2 | Creature songs and the nursery lullaby, on the new music engine |
| G | Comfort | 2 | Idle mode and daily surprises, once there is lots to show and find |
| H | German (Deutsch) | 3 | Last, so every text from A–G is translated once, in its final wording |

If you'd rather have German sooner, H can move to the front. The catch: every later update then needs its
own German pass, which I'd do at the end of each update.

---

## A. Reach and polish

**A1. Safari, iPhone and Android readiness.** *(Done.)*
- Go through the code for what those browsers do differently:
  - audio unlock on the first touch, and `webkitAudioContext` / older OfflineAudioContext;
  - CompressionStream, used by save codes, with its fallback;
  - the file picker and downloads (backups, photos, previews);
  - pointer and touch events, safe areas and screen rotation.
- Fix what's found.
- Add a LOW EFFECTS check on slow devices, a frame-time watch for the music, and a memory check.
- Write `docs/DEVICE_TESTING.md`: a short checklist for you to run on a real iPhone, iPad and Android phone
  (what to tap, what you should hear and see), since that can't be done from here.

**A2. Real recordings for signature sounds.** *(Done.)*
- Make effects work like the music's audio files: drop a recording into `assets/audio/`, add one line, and
  it's loudness-matched and used (with several takes picked at random).
- Prepare slots and placeholders for bubbles, the net swish, a catch, splashes and the hydrophone ping.
- `docs/ADDING_SOUNDS.md` in plain language.
- Note: I can't record or download licensed audio from here. This stage builds the path; the recordings
  are yours (or from a free library you choose).

## B. Weather

**B1. The weather system and how it looks.** *(Done.)*
- Weather by sea region, changing slowly over real time: calm, breezy, choppy, rain, fog, and a rare storm
  night. It's saved, and the weather shows on the HUD icon.
- **How it looks:**
  - rain streaks above the water and rings on the surface;
  - waves that grow;
  - fog that thickens the depth haze;
  - storm clouds.

  It works on every graphics level, including CLASSIC.
- **REDUCE FLASHING:** no lightning flash, only a soft distant glow.
- **The map:** shows today's weather per region.

**B2. How it sounds.**
- Rain and wind ambience beds, muffled underwater.
- Ataraxia leans darker and softer in rain, hazier in fog, and lower and slower in a storm.
- The hydrophone hears less in a storm.
- A rain shower sounds different from the surface and from below.

**B3. Weather life.**
- A few creatures that only appear in some weather (a fog-only drifter, a rain-loving surface fish, a
  storm-night visitor).
- Log entries and field notes, a weather Guide page, and a gentle badge or two.
- No weather is ever bad for the player: nothing is lost, nothing gets harder.

## C. Seasons

**C1. The season clock and how it looks.**
- Spring, summer, autumn and winter, cycling over real days (the length is a setting; the default is
  about one real week each).
- **Each place's look shifts:** spring coral bloom and green shallows, summer brightness, autumn gold
  kelp and drifting leaves on the hill, winter ice reaching further and snow on the hill.
- Shown on the HUD and the map.

**C2. Seasonal life and things to find.**
- Seasonal creatures and plants, and seasonal decorations unlocked as usual.
- **Spawning in spring:** more babies.
- **Migrations:** ties in with D2.
- The log shows which season a creature is found in.

**C3. Seasonal sound and polish.**
- Ataraxia's colour per season, and Delta picks favouring seasonal songs. There could be one new song per
  season later, written the same way as the others.
- A Guide page, badges, and saves.
- A setting to pause the seasons (stay in your favourite one).

## D. Life in the sea

**D1. Night lights.** Glowing plankton that sparkle where you swim at night, brighter on clear nights and in
caves. Lantern creatures leave soft trails. Uses the shader lights, with a CLASSIC fallback and a REDUCE
FLASHING-gentle version.

**D2. Rare migrations.**
- Now and then a whale, a manta school or a turtle line crosses the open ocean.
- You hear it on the hydrophone before you see it, and a small field note is added.
- Never catchable, just watched; a badge for seeing each one.

**D3. Hidden grottoes.**
- Small secret rooms behind cracked coral or rock that the net can pry open, a few in each region.
- Inside: a bottle, a rare plant or a little scene.
- They're marked on the map once found, and appear in a Guide line.

**D4. Creature friendships.**
- Visiting a wild creature often (calm, sneaking, no net) makes it friendlier.
- A friend follows you for a few seconds, glows when you're near, and now and then leaves a shell or a
  shiny thing.
- A friend's caught cousins in your tanks get a heart.
- Nothing is lost if you never do it.

## E. The aquarium and station

**E1. The photo album.**
- Tank photos you take are kept in the game (a PHOTOS page in the log), with the date and tank.
- You can delete them, set one as a tank's cover in the directory, and save them out as PNG as now.
- A photo badge set.
- Kept small: a limited number of photos, compressed, stored separately from the main save so backups
  stay small. Their own backup option is included.

**E2. Tank lighting and moods.** Each tank gets a light switch with a few moods: daylight, golden hour,
moonlight, glow. The windows in the station show it too.

**E3. The café / gift shop.** A new small room in the station, decorated with things you've unlocked,
plushies of creatures you've bred, posters of your photos. Purely to walk through and enjoy.

**E4. The family tree.** The log shows each species' generations: who bred whom, colour variants passed
down, nursery graduates.

## F. Sound extras

**F1. Creature songs.** Each family hums a tiny motif. In a tank, the creatures you keep add their motifs to
that tank's Ataraxia, softly, so a full tank sings a little.

**F2. The nursery lullaby.** A soft lullaby (written like the Delta songs) plays in the nursery when babies
are growing. It's listed in the jukebox once heard.

## G. Comfort

**G1. Idle mode.** Leave the game untouched (or choose IDLE in the pause menu) and the camera drifts slowly
through your tanks and the sea with the music, like a screensaver. Any key or tap ends it.

**G2. Daily surprises.** Each new real day, a bottle washes up, a shell appears or a tank gets a visitor
decoration. There are no streaks and no penalty for missing days.

## H. German (Deutsch)

**H1. The letters.** Ä, Ö and Ü (and ß) in the pixel font, drawn in its style. Check that every screen still
fits German's longer words with the PSEUDO language and a German sample.

**H2. The translation.**
- All of the game's text (about 2,500 lines, by then a few hundred more), with German plural forms.
- Uses the existing `tools/lang-csv.js`, so a native speaker can review or edit it in a spreadsheet.
- I'll translate it carefully and naturally, but a native speaker's read is still worth it for the tone.

**H3. Layout and polish.**
- `node tools/check-game.js --lang de` screenshots of every screen, with shorter wording where text
  squeezes.
- The Guide, the songs' names, docs and the README.
- The game picks German automatically on a German browser.
