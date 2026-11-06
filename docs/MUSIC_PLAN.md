# Music plan: ATARAXIA and DELTA

Status: **Stage 3 done** (the NOW PLAYING toast, the jukebox, songs from audio files, the Guide's MUSIC
page). Stages 1 and 2 are done too. Next: Stage 4 (the WAV preview export, tools/check-music.js, the full
test pass).

The new music has two parts, in the game's cozy, airy piano-and-bell ambient style (C418, the quiet moments
of Stardew Valley, a soft chiptune touch at night):

- **ATARAXIA**: a calm background that plays all the time, everywhere, day and night, and never asks for
  attention. Nothing in it can be hummed.
- **DELTA**: real composed songs (about 10, 2 to 4 minutes each) that play every so often. The player
  chooses how often.

Hard rules that shape every stage:
- No build step, no libraries, no network.
- Web Audio only, hosted or opened from a file.
- Nothing needs hearing, and nothing about gameplay changes.
- The existing volume, mute, ducks and audio unlock all keep working.
- No clicks, and a limiter at the end.
- A capped number of voices, with nodes cleaned up.
- All text goes through `t()`.
- Tuning lives in config.js.

---

## 1. How music works today (the audit)

### The pieces involved

| File | What it does now |
|---|---|
| `src/audio.js` (`AQ.Audio`) | Creates the `AudioContext` on the first tap or key (unlock). Builds the mixer (below), handles MUSIC/EFFECTS volume, mute, menu duck (`setDuck`), the hydrophone duck (`setListen`) and the underwater filter. `settle()` holds a place change for 1.2 s so swimming back and forth over a border doesn't flip the music. Suspends the context when the tab is hidden and resumes it when the tab returns. Also has the effect voice budget (`maxVoices`), the recording loader and synth helpers. |
| `src/music.js` (`AQ.Music`) | The generative music: instrument recipes, phrase generator, scheduler (`pump`) and director (`wanted` / `update`), plus the two reward stingers (`stinger('reward')`, `stinger('shower')`). |
| `data/music.js` | One "piece" per place: root, scale, bpm, which instrument plays lead / pad / bass / arp, a short melody, chord roots, rest lengths and a `night` flag. Also scales, the shared motif and the stingers. |
| `src/sounddirector.js` | Once a frame: mute key, calls `Music.update` and `Ambience.update`, footsteps, splashes, dusk and dawn chimes, creature voices. |
| `src/ambience.js` | Place beds (waves, drips, wind...) on their own bus. **Not touched by this plan.** |
| `src/soundtest.js` | SETTINGS (SOUND tab: MUSIC and EFFECTS volume, MUTE) and the SOUND TEST (tabs: effects, ambience, music, hydrophone, badges, requests). |
| `src/hydrophone.js` | LISTEN ducks music and ambience (`AQ.Audio.setListen`, `hydrophone.duck` 0.65). |

### The mixer today

```
sfx ──┐
amb ──┴─> env (underwater lowpass) ─┬───────────────────────> shared compressor ─> master ─> speakers
                                    └─> shared reverb ───────┘
music ─┬──────────────────────────────────────────────────────┘
       ├─> shared reverb (send 0.35..0.75)
       └─> one echo (0.62 s, feedback 0.32, lowpass 1.8 kHz)
```

`musicBus.gain` = MUSIC slider × menu duck × hydrophone duck. Mute sets the master gain to 0.

### How the director picks music (kept as the rule for Ataraxia)

`AQ.Music.wanted(game)`, in order:
1. A Sound Test piece, if one is being tested.
2. **title**: the title screen, or the log opened from it.
3. **aquarium**: the tank screens, or the log opened from them.
4. **station**: the aquarium building in space.
5. **hill**: the hill, with a `:night` version.
6. **The sea**: the biome under the player (`tide_pools`, `coral`, `ruins`, `open_ocean`, `vents`, `trench`, `kelp`, `mangrove`, `ice`, `cave`, `lush_cave`), with `:night` versions at night.

That gives **15 places** in all.

Swimming between biomes waits for `settle` (1.2 s), then crossfades over `crossfadeSeconds` (3 s). Anything else (title, tanks, scene changes) switches at once. The log, map and pause menu duck the music to `menuDuck` (0.5).

### What's weak about the current sound (my diagnosis)

Reading the code, from most to least important:

1. **No meter and no harmony.** Phrase notes start at random fractions of a beat (0.5, 1, 1.5...). Phrases have random lengths, and a new chord starts with every phrase. Nothing lines up with a bar, so notes start and stop in unmusical places.
2. **The melody is shifted, not harmonised.** `noteOf(p, n.step + chord)` moves the whole melody up the scale by the chord's root, instead of choosing notes that fit the chord. The same motif gets a different mode each time, so it sounds wandering and accidental rather than intended.
3. **No phrase shape and no ending.** There are no cadences and no sense of question and answer. Phrases stop and are followed by a random rest, with no build, no climax and no resolution. Everything plays at the same velocity (0.8–1.0) and the same loudness for minutes on end.
4. **Thin instruments.** The "piano" is a triangle plus two sines through a fixed lowpass. It has no hammer or felt attack, no brightness that changes with velocity, and no body, so it sounds like a toy organ. The bell is two partials with no shimmer. The pad is two saws through a static 520 Hz filter. Nothing moves inside a held note.
5. **Pads are block chords in parallel.** Every chord is a root-position triad in the same octave, retriggered from silence with a 1.8 s attack. Chords jump in parallel with no voice leading, and every new phrase "breathes in" again, which is audible as a restart.
6. **Place changes restart the music.** Crossfading means starting a brand-new piece from nothing: new pad attack, new phrase. So you hear a beginning every time you cross a border.
7. **The mix is mono and hissy.** The reverb is 2.8 s of plain white noise with no high-frequency damping, so the tail is bright and hissy instead of warm. It has no predelay, so the dry sound and the reverb blur together. There is no stereo placement or movement. The echo is a fixed 0.62 s that doesn't follow the tempo.
8. **Music shares a compressor with the effects.** When a splash or a catch sound plays, the shared compressor pulls the music down (pumping). There is no limiter at the end, so a pile-up can clip.
9. **Places sound alike.** One fixed `LEVEL` (0.24) for every place, and the same few recipes, so places differ mostly by scale and bpm. Depth makes no difference (the trench is as loud and bright as the tide pools, only slower). Night is the same piece slower, quieter and in a minor scale.
10. **The scheduler depends on the frame rate.** Notes are scheduled 0.3 s ahead from the game's frame update. A hitch longer than that (a garbage-collection pause, a slow phone) causes a gap. When the tab is hidden the context is suspended, which is good, but anything that fell behind is skipped instead of shifted.
11. **Cleanup is loose.** Every note makes 3 oscillators, a filter and a gain. They are never explicitly disconnected (they're left to the garbage collector after `stop`). Pieces disconnect their output with a `setTimeout`. That's fine for sparse music, but a denser song player needs real accounting.

---

## 2. What's kept, what's replaced

**Kept as is:**
- `AQ.Audio`: the context, the unlock on the first tap or key (phones and Safari), suspend and resume when the tab is hidden, `settings()` (MUSIC/EFFECTS/mute), `setDuck` (menus), `setListen` (hydrophone), `settle()`, the underwater filter, the effect voice budget and the recording loader.
- `musicBus` as the single entry point that MUSIC volume, mute and both ducks act on.
- The place rule in `wanted()` (section 1), as the place list for Ataraxia.
- Sound effects, creature voices, ambience, hydrophone sounds and the Sound Test's existing effect / ambience / hydrophone / badges / requests tabs.
- The two reward stingers (`reward`, `shower`). These are effect-like moments and stay as they are, redone on the new instruments only if they would clash.

**Replaced:**
- `src/music.js`'s instruments, phrase generator and pieces. Ataraxia takes over (Stage 1) in a new `src/ataraxia.js`. The old file leaves the build path (`index.html`) and stays in git history.
- `data/music.js`'s `pieces` (the `scales`, `motif` and the `audioFiles` / `creatureVoices` sections stay). Ataraxia's place settings go in a new `data/ataraxia.js`.
- The music path in the mixer (below). Effects keep their own path and the shared reverb.

**New:**
- `src/musicmix.js`: the music mixer.
- `src/instruments.js`: the synthesized instruments.
- `src/ataraxia.js`: the always-on layer.
- `src/delta.js`: the song player and the frequency logic.
- `data/songs.js`: the composed songs.
- Later: `src/jukebox.js`, `assets/music/manifest.js`, `tools/check-music.js`.

Every new module takes the `AudioContext` as a parameter, never `AQ.Audio.ctx` directly. That lets the exact same instruments, mixer and songs render into an `OfflineAudioContext` for the preview export and the checker (Stage 4).

---

## 3. The new music path (Stage 1)

```
instruments ─> per-instrument group gain ─> stereo panner (slow drift) ─┬─> dry ───────────────┐
  (piano, bell, glass, harp, marimba, pad,                              ├─> reverb send ─> reverb (generated, ─┤
   sub, chip lead / arp, percussion)                                    │      predelay, damped, ~5 s)       │
                                                                        └─> echo send ─> tape echo (wow,      │
                                                                               lowpass in the loop, ping-pong)┘
                                                                                                │
                              warmth lowpass (gentle) ─> glue compressor ─> limiter ─> musicBus ─> master
```

**Two layers inside it**, each with its own gain:
- `ataraxiaGain`: dips to a thin bed under a song.
- `deltaGain`: songs.

**Reverb:** generated once at start-up from noise. It's stereo, with each channel decorrelated. It has a short predelay (about 25 ms) and its high end decays faster than its low end (made by filtering the noise in slices), so the tail is warm and soft rather than hissy. It's about 5 s long, with a gentle 6–8 kHz high-cut on the return.

**Tape echo:** about a dotted quarter at each song's tempo (Ataraxia uses a fixed slow time). A slow LFO adds "wow" to the delay time, there's a lowpass in the feedback loop so each repeat gets darker, and the repeats ping-pong left and right at a low level.

**Glue and limiter:** a soft compressor (ratio about 2, slow) holds the music together. Then a fast limiter (high ratio, threshold about −3 dB) sits just before `musicBus`, so music can never clip.

**Effects:** they stay on their own path and lightly share the existing effects reverb, so they stay clear and dry. Music no longer goes through the effects' compressor, so a splash can't pump the music. A final safety limiter goes on the master as well.

**Levels:** each instrument group has its own level (`music.levels` in config.js). Ataraxia sits clearly below Delta (target about 6–8 dB quieter on average). The whole music path still follows MUSIC volume, mute and the two ducks.

### Instruments (all synthesized, Stage 1)

Every note has a soft attack and release; no note ever starts or stops at full level.

| Instrument | How it's made |
|---|---|
| Felt piano | Three partials, slightly detuned and slightly stretched (bright overtones a little sharp, like a real string). A short filtered "felt" noise tap for the attack. A lowpass that opens with velocity, then closes as the note decays. A small "body" resonance. Two-stage decay (a quick drop, then a long tail). |
| Bell / glass | Inharmonic partials (×1, ×2.76, ×5.4, ×8.9) with slightly different decays, plus a slow shimmer: a tiny vibrato on the upper partials. |
| Harp / pluck | A bright start that darkens quickly (filter envelope), with a short decay. |
| Marimba | A sine with a quick 4× "tine" overtone, warm and short. |
| Warm pad | Several layers that drift very slowly in detune, a slow filter movement and a long attack and release. In Ataraxia the pad voices are **long-lived**: they glide to the next chord's notes (voice leading) instead of restarting. |
| Sub bass | A deep sine with a touch of triangle, a slow attack and no click. |
| Chip lead / arp (night) | A soft square through a lowpass, with gentle vibrato, quiet. |
| Brush percussion (only some Delta songs) | A hushed shaker (filtered noise), a soft clave (a short damped sine) and a heartbeat kick (a low sine with a gentle pitch drop). |

**Human touches:** timing moves by ±a few ms, velocity varies a little around the written dynamic, pads drift in pitch by a few cents, and each note gets a slightly different brightness.

**Voice cap:** at most `music.maxVoices` (about 24) music voices at once. When full, a new note takes the place of the quietest, oldest one, which is faded out over 50 ms, never cut. Each note uses at most about 4–6 nodes, and every one is disconnected `onended`. A live counter (`AQ.MusicMix.stats()`: notes alive, notes started, nodes alive) lets tests check that nothing piles up.

**Scheduling:** notes are queued about 0.5–1 s ahead on the audio clock. Both the game loop and a small `setInterval` (about 100 ms) feed the queue, so a dropped frame never leaves a gap. When the tab is hidden the context is suspended (as now), so the audio clock stops with it and nothing drifts when you come back.

---

## 4. ATARAXIA (Stage 1)

**What it is:** a slowly evolving bed made of:
- A **pad** on a drone or a very slow chord change (a new chord every 15–40 s, voice-led, gliding).
- A soft **sub** under it.
- **Now and then, one note:** a bell, a soft piano note or a pluck, placed at random with long silences (8–30 s) and never forming a tune. A note picks a chord tone or a gentle color tone of the current chord, and a note is never followed by a step-wise neighbour, so it can't become a melody.

**Each place has its own setting** in `data/ataraxia.js`:
- key / drone note and a small set of slow chords;
- pad color (warm, glassy, airy);
- which sparse instruments it uses and how rarely;
- brightness and level.

The sea biomes, from bright to dark:
- `tide_pools` (bright, major);
- `coral` (warm, lydian);
- `kelp` (green, dorian);
- `mangrove` (earthy);
- `ruins` (old, aeolian);
- `open_ocean` (wide, lydian);
- `ice` (glassy);
- `cave` and `lush_cave` (dark; lush is warmer);
- `vents` (deep, low);
- `trench` (deepest, darkest, quietest).

Plus `title`, `hill`, `station` (glassy, spacey) and `aquarium` (gentle).

**Things that follow the moment:**
- **Depth** (the sea): the deeper the player, the lower the pad's filter and the quieter it gets, so the trench is dark and hushed.
- **Time of day** (`AQ.Clock.daylight()`): brighter by day; at night softer, slower (rarer notes) and slightly lower, with a faint chiptune sparkle note now and then.
- **"Weather":** the game has no weather system. The one thing like it is a **meteor-shower night** (`AQ.Starfall.showerTonight()`). On those nights Ataraxia adds a rare high glass shimmer.

**Place changes:** the same `settle` rule as today, but no restart. The pad voices keep sounding and glide to the new place's notes. Filter and level ease over `ataraxia.crossfadeSeconds` (about 6 s). If the new place uses a different pad color, the old layer fades out while the new one fades in over the same time, so there's never a gap.

**Level:** quiet enough to talk over (a target average level is checked in Stage 4). It dips to `delta.bedLevel` (a thin bed) while a Delta song plays.

**Sound Test:** a new ATARAXIA tab lists every place × day/night, so each version can be heard on demand.

---

## 5. DELTA (Stage 2)

### Song format (`data/songs.js`)

```js
{ id: 'delta', place: 'title', time: 'any' | 'day' | 'night', alt: 'tide_day',   // the day version a night song falls back to
  key: 'D', mode: 'major', bpm: 72, meter: [3, 4], swing: 0,
  chords: { I: ['D3', 'A3', 'D4', 'F#4'], vi: [...], ... },                      // voicings with inversions, written out
  form: ['intro', 'A', 'B', 'A2', 'bridge', 'A3', 'outro'],
  sections: {
    A: { bars: 8, chords: ['I', 'I', 'vi', 'IV/6', ...],                           // one per bar (or 'I:2 V:2' for half-bars)
         melody: 'F#4:2 E4:1 D4:1 | A4:3 r:1 | ...',                               // written note by note, with rests
         counter: '...', bass: 'D2:4 | ...', perc: 'shaker:x.x.', inst: { melody: 'piano', counter: 'bell', pad: 'pad', bass: 'sub' },
         dyn: 0.6, transpose: 0 },                                                  // transpose: a key change
  } }
```

`src/delta.js` turns the data into scheduled notes:
- Small timing and velocity variation, so a repeated section is never identical.
- Dynamics that breathe across the form: quieter intro, fuller middle, soft ending.
- Outros that really end on a held chord that rings out.
- Optional key changes (`transpose`) in the last section.

### The songs (about 10, one album)

| Song | Mood and place |
|---|---|
| DELTA | The title theme and the album's signature motif. The other songs quote it. |
| Tide pools | Sunlit shoreline. |
| Coral | Reef. |
| Kelp | Kelp forest. |
| Open ocean | Wide and spacious. |
| Deep / trench | Dark and slow. |
| Cave | Echoing. |
| Hill | Pastoral. |
| Station | Space, glassy. |
| Night | Soft chiptune texture. |

Each song has a 4–8 note motif that returns, varied, across its sections. Some songs get a day/night pairing, so a night-only song has a day version of the place's song as the alternative.

### Playing rules

- **One song at a time.** A song never plays over another and never changes mid-song. Ataraxia carries the place underneath.
- **Song start:** Ataraxia dips to a thin bed. Song end: it returns by itself, smoothly.
- **Waiting:** songs wait during the hydrophone's LISTEN, the photo-mode shutter and the guided dive's first steps, and start when that moment ends.
- **Title screen:** plays DELTA once per visit (unless the frequency is OFF), then Ataraxia.
- **Frequency (SETTINGS > SOUND > DELTA, saved; default SOMETIMES):**

  | Setting | About |
  |---|---|
  | OFF | never |
  | RARELY | one song every 25 min |
  | SOMETIMES | every 10 min |
  | OFTEN | every 4 min |
  | ALWAYS | back to back with about 20 s between |

  - Intervals are randomized ±25 %.
  - The same song never plays twice in a row, and songs not heard recently are preferred.
  - Changing the setting lets a playing song finish. OFF fades it out over a few seconds.
- **ATARAXIA ON/OFF** (default ON). Both off means no music at all, but effects and ambience still play.
- **Sound Test:** every song can be played and stopped, with its length and the playing position shown.

---

## 6. Settings, saves, text

- **New settings in `AQ.State.settings.music`:** `{ delta: 'sometimes', ataraxia: true, titles: true }`.
- **Songs heard:** `AQ.State.music = { heard: { <songId>: <times> }, lastSongs: [...] }`.
  - `AQ.State.settings` already carries over everywhere. The new `AQ.State.music` key gets added to `Save.apply`, which copies keys one by one.
  - Old saves simply get the defaults (no version bump needed, the same way `panes` was added).
  - Backups and save codes are snapshots of the whole `AQ.State`, so both fields are included automatically. That's tested in Stage 4.
- **Text:** every name, setting label, toast and Guide line goes in `data/lang/en.js`, under `music.*`, `settings.delta.*`, `soundtest.ataraxia`, `guide.music.*` and so on. Song titles are language strings too.
- **Tuning:** a `music` section in `src/config.js` with readable names and short comments (levels, reverb, echo, voice cap, frequency minutes, bed level, crossfade).

---

## 7. Performance budget and how it's measured

- **Voices:** at most about 24 music voices at once. Ataraxia alone is usually 4–6 (the pad layers, the sub and the occasional note). A song adds about 8–14.
- **Nodes:** the pad and sub are long-lived, so Ataraxia creates almost no nodes per minute. Song notes create about 4–6 nodes each, disconnected when they end.
- **Measuring:**
  - `AQ.MusicMix.stats()` reports notes and nodes alive over a simulated 30-minute session.
  - Frame time comes from the game's own frame timer.
  - Audio cost is measured by rendering 60 s offline and comparing it with real time.
  - Numbers are reported after Stages 1 and 2.
- **Phones:** `lowEffects` (the existing LOW EFFECTS setting) also halves the reverb length and the voice cap.

---

## 8. Stages

1. **Stage 1:** the music mixer and instruments; Ataraxia replaces the old music; the Sound Test ATARAXIA tab; checks for place changes, long runs, node counts and the tab returning from the background.
2. **Stage 2:** the song format, the player, about 10 composed songs, the frequency and ATARAXIA settings, ducking and waiting rules, title-screen DELTA, songs in the Sound Test.
3. **Stage 3:**
   - the NOW PLAYING toast and SONG TITLES setting;
   - the jukebox (the station's jukebox and a MUSIC page);
   - songs from player-supplied audio files (`assets/music/manifest.js`), with loudness matching, and `docs/ADDING_MUSIC.md`;
   - a Guide MUSIC page.
4. **Stage 4:** the WAV preview and EXPORT ALL (a testing flag), `tools/check-music.js` (data validity and offline-render loudness, peaks, silences, spectrum), the full test pass, and the list of what can't be verified by ear.

## 9. Risks and limits

- **Nobody can hear it while it's being built.** Composition is done by music theory (voice leading, form, register, range) and checked by measurement: loudness, peaks, spectrum, silence. The WAV export (Stage 4) is how the result really gets judged.
- **Offline vs live:** `OfflineAudioContext` runs the same nodes, so renders should match closely. The known differences:
  - The random human variation differs per run (a fixed seed makes exports repeatable).
  - There's no menu or hydrophone ducking in an export.
  - Recordings (Stage 3 files) only render if they've already been decoded.
- **Real audio files from `file://`:** browsers may block `fetch` for local files. The game already handles this for effects with `tools/embed-audio.js`, and Stage 3 uses the same approach (with a size warning).

## 10. The songs (Stage 2), and what each should sound like

| Song | Place, time | Key, tempo | Meant to sound like |
|---|---|---|---|
| DELTA | title | D major → E, 72, 4/4 | The album's theme: a calm felt-piano melody (the "A F# E D E" motif) over a warm pad, harp arpeggios in the middle, a glassy bridge, then the theme lifted a step for its last return and a soft ending on the motif. |
| SEA GLASS MORNING | tide pools, mangrove; day | G major → A, 96, 3/4 waltz | Sunny and light: marimba melody, harp "oom-pah" on beats 2 and 3, a hushed shaker in the middle section, a lift to A for the last verse. |
| CORAL LANTERNS | coral, ruins; day | E major (lydian), 76 | Warm and shimmering: harp melody with the raised 4th (A#) giving a floating colour, high glass counterlines, a marimba-arpeggio middle. |
| GREEN CATHEDRAL | kelp, mangrove | D dorian, 66 | Swaying and green: piano melody with dorian's bright 6th (B over D minor), harp arpeggios, a middle section in F that quotes the motif. |
| BLUE MILE | open ocean, ice | C lydian → D, 60 | Wide and slow: long bell notes, lots of space and rests, a deep sub instead of a plucked bass, a lift to D lydian. |
| LANTERN BELOW | trench, vents, ruins | A minor, 54 | Dark and tender: sparse low piano phrases, glass notes, a soft "lub-dub" heartbeat in the middle, ends on A minor. |
| DRIP GARDEN | cave, lush cave | F major → G, 63 | Playful and echoing: marimba melody, rare clave "drips", high glass answers, lifts to G. |
| KITE WEATHER | hill; day | G major → A, 104, 3/4 waltz | Breezy: harp melody, soft piano chords on the off-beats, shaker in the middle, lifts to A. |
| ORBIT GARDEN | station, aquarium | E major, 70 | Spacey and gentle: bell melody, soft chiptune arpeggios, harp in the middle section. |
| MOON POOL | everywhere at night | B flat major, 64 | Sleepy and nostalgic: a soft chiptune lead, chip arpeggios, a piano middle section that quotes the motif. |

Measured (offline renders at the default MUSIC volume): every song is 2:17 to 3:24, peaks about -10 to -12 dB
(no clipping), average loudness -27 to -30 dB (within 3 dB of each other; Ataraxia sits about 3 to 8 dB
below), a loudness shape that rises from the intro to the last section and falls into the ending, at
most 32 notes ringing and all nodes freed by the end.
