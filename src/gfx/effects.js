// Every effect of the shader layer (src/gfx/), in one list: what it is, which quality levels draw it,
// whether it moves, and how REDUCE FLASHING (AQ.U.calm()) tames it. The testing keys switch these on and
// off one at a time (AQ.TUNING.debug.gfx), and tools/check-graphics.js reads this list: it shows each
// effect per level and flags any effect that moves but has no REDUCE FLASHING handling it can find.
//   level: the AQ.TUNING.graphics.levels flag that turns it on ('all' = every level above CLASSIC)
//   moves: it animates (then `calm` must say what REDUCE FLASHING does, and `proof` must be found in `file`)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.GfxEffects = {
  grade:    { level: 'all', moves: false, what: 'colour grading by place and time of day (blends slowly with the clock)' },
  fog:      { level: 'all', moves: false, what: 'depth fog in the sea (bluer, flatter, softer the deeper you are)' },
  bloom:    { level: 'bloom', moves: false, what: 'a soft glow round bright things' },
  vignette: { level: 'all', moves: false, what: 'darker corners' },
  grain:    { level: 'grain', moves: true, what: 'very faint film grain',
              calm: 'off', file: 'src/gfx/gfx.js', proof: /calm\(\) \? 0 : c\.grain\.amount/ },
  light:    { level: 'light', moves: true, what: 'real lights: the lamp cone, glowing creatures, lanterns; flickering lights',
              calm: 'no flicker', file: 'src/gfx/gfx.js', proof: /L\.flicker && !calmNow/ },
  water:    { level: 'water', moves: true, what: 'god rays, caustics, plankton, refraction, the glint path on the surface',
              calm: 'half speed; the glint becomes a steady band', file: 'src/gfx/shaders.js', proof: /mix\(glint, 0\.25 \+ 0\.2 \* glint, uCam\.w\)/ },
  sky:      { level: 'sky', moves: true, what: 'drifting clouds, the sun / moon glow, the UFO beam glow',
              calm: 'half speed (the effects clock)', file: 'src/gfx/gfx.js', proof: /calm\(\) \? cfg\(\)\.calmSpeed : 1/ },
  glass:    { level: 'scenes', moves: true, what: 'tank glass: edges, reflections, a slow sweeping highlight; the water tint',
              calm: 'the highlight fainter (tanks.sweepCalm) and half speed', file: 'src/gfx/gfx.js', proof: /calm\(\) \? T\.sweepCalm : 1/ },
  space:    { level: 'scenes', moves: true, what: 'the station: nebula, soft stars, planet rims; dim rooms and soft shadows',
              calm: 'no star twinkle; the nebula drifts at half speed', file: 'src/gfx/shaders.js', proof: /float tw = 1\.0 - uCam\.w/ },
  streaks:  { level: 'scenes', moves: true, what: 'glowing trails on shooting stars, falling stars and meteors; the landing light',
              calm: 'dimmer (calm.streakAlpha) and slower', file: 'src/shootingstars.js', proof: /calm\(\) \? AQ\.TUNING\.calm\.streakAlpha : 1/ },
  lift:     { level: 'scenes', moves: true, what: 'the diver glows as the UFO beam lifts them',
              calm: 'gentler (graphics.liftCalm)', file: 'src/gfx/gfx.js', proof: /calm\(\) \? c\.liftCalm : 1/ },
  fade:     { level: 'scenes', moves: true, what: 'soft cross-fades between screens; a smooth fade to black',
              calm: 'already smooth and slow: eased, never a flash', file: 'src/transition.js', proof: /AQ\.U\.calm\(\) \|\| \(AQ\.Gfx/ }
};
