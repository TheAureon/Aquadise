// The shader layer's GLSL (WebGL1), as strings. Every pass draws one screen-covering triangle.
// Textures uploaded from canvases are flipped on upload (UNPACK_FLIP_Y) so canvases and framebuffers
// share one orientation: vUv (0,0) is the bottom-left. "Image y" (0 = top, as the game thinks) is
// 1.0 - vUv.y. Colours are premultiplied by alpha everywhere.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Shaders = (function () {
  const S = {};
  // every light's share of a pixel (the light map, S.lights)
  const LOOP = `    for (int i = 0; i < MAXL; i++) {
      if (float(i) >= uLN) break;
      vec4 L = uL[i]; vec4 LC = uLC[i];
      vec2 d = tp - L.xy;
      float dist = length(d), r = max(L.z, 1.0);
      if (dist > r * 1.2) continue;
      float f = pow(1.0 - smoothstep(0.15, 1.0, dist / r), 1.3) * L.w;
      float kind = LC.a;                                              // 0 point, +-1 the lamp, 2 a ceiling lamp, 3 a soft area light
      if (kind == 2.0) f *= mix(0.3, 1.0, smoothstep(-0.1, 0.5, d.y / max(dist, 0.001)));   // a pool of light below it
      else if (abs(kind) == 1.0) {                                    // the lamp: a soft cone ahead, a little all round
        float ahead = smoothstep(-0.2, 0.6, d.x * kind / max(dist, 0.001));
        f *= mix(0.45, 1.0, ahead);
        tint += uLampCol.rgb * f * uLampCol.a;
      }
      lit = 1.0 - (1.0 - lit) * (1.0 - clamp(f * 0.88, 0.0, 1.0));
      if (LC.r + LC.g + LC.b > 0.0) {
        if (kind < 2.0) glow += LC.rgb * exp(-(dist * dist) / (r * r * 0.2)) * L.w;   // its own coloured glow
        tint += LC.rgb * f * 0.35;                                    // what it touches takes its colour
      }
    }
`;
  // highp where the GPU has it in fragment shaders (most do; some old phones only have mediump)
  const PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';

  S.vertex = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // ---------------------------------------------------------------- sharp upscale (shared)
  // "Sharp bilinear": inside a texel the colour is flat; only a seam one output pixel wide blends between
  // neighbours, so pixels stay square at any scale (also the fractional ones phones use) with no shimmer.
  const SHARP = `
vec4 sharp(sampler2D t, vec2 uv, vec2 texSize, vec2 outSize) {
  vec2 texel = uv * texSize;
  vec2 scale = max(outSize / texSize, vec2(1.0));
  vec2 base = floor(texel);
  vec2 d = fract(texel) - 0.5;
  vec2 range = 0.5 - 0.5 / scale;
  vec2 f = (d - clamp(d, -range, range)) * scale + 0.5;
  return texture2D(t, (base + f) / texSize);
}`;

  // ---------------------------------------------------------------- bloom: bright parts, downsampled
  S.bright = PREC + `
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uSrcSize;
uniform vec2 uBright;        // threshold, soft knee
void main() {
  // a 4-tap box (the target is smaller than the source)
  vec2 o = 0.5 / uSrcSize;
  vec3 c = (texture2D(uSrc, vUv + vec2(-o.x, -o.y)).rgb + texture2D(uSrc, vUv + vec2(o.x, -o.y)).rgb
          + texture2D(uSrc, vUv + vec2(-o.x, o.y)).rgb + texture2D(uSrc, vUv + vec2(o.x, o.y)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float k = clamp((br - uBright.x + uBright.y) / (2.0 * uBright.y), 0.0, 1.0);
  float w = br > uBright.x ? 1.0 : k * k * uBright.y / max(br, 0.0001);
  gl_FragColor = vec4(c * w, 1.0);
}`;
  // a separable gaussian blur (9 taps, using linear filtering for 5 fetches); uDir = one texel step
  S.blur = PREC + `
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb * 0.2270270270;
  c += texture2D(uSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(uSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

  // ---------------------------------------------------------------- the composite (to the screen)
  // world (effects) + interface (untouched) -> the visible canvas. Quality is a #define (LOW / MEDIUM /
  // HIGH), so each level compiles only what it uses. MAXL = how many lights the level takes.
  S.maxLights = { high: 24, medium: 12, low: 1 };
  // pass 'scene' (MEDIUM / HIGH): the world with every effect into a framebuffer a whole number of times the
  // world's size (graphics.levels.*.fxScale), so the heavy work doesn't grow with the screen; S.final then
  // upscales it sharply and adds the vignette, grain and interface. LOW does it all in one cheap pass.
  S.counts = { streaks: 4, holes: 4, ao: 8 };
  // kind: which scenes this program draws ('world': the sea, hill and title; 'station'; 'tank': the tank
  // screen and photos), so each carries only the code it needs
  S.kinds = ['world', 'station', 'tank'];
  S.composite = (level, pass, kind) => PREC + `
#define Q_${level.toUpperCase()} 1
#define K_${(kind || 'world').toUpperCase()} 1
${pass === 'scene' ? '#define PASS_SCENE 1' : ''}
#define NS ${S.counts.streaks}
#define NHOLE ${S.counts.holes}
varying vec2 vUv;
uniform sampler2D uWorld;
uniform sampler2D uUI;
uniform sampler2D uBloom;
uniform vec2 uTex;           // the world texture's size (320 x 180)
uniform vec2 uUITex;         // the interface texture's size
uniform vec2 uOut;           // the visible canvas's size in device pixels
uniform vec3 uBg;            // behind transparent world pixels (the page's own background)
uniform vec4 uGradeA;        // gain r, g, b, saturation
uniform vec4 uGradeB;        // contrast, brightness, split-tone strength, (unused)
uniform vec3 uShadow;        // the colour shadows lean toward
uniform vec4 uFog;           // fog colour rgb, amount (0 = none)
uniform vec4 uFogB;          // surface line (image y 0-1; < 0 = no sky), desaturation, contrast loss, softening (texels)
uniform vec4 uFx;            // vignette, grain, bloom, grain seed
uniform float uUIOn;
// ---- Stage 2: light, water, sky (MEDIUM / HIGH)
uniform vec4 uCam;           // camera left, top (world px), time (s, already slowed for REDUCE FLASHING), calm (0 / 1)
uniform vec4 uScene;         // kind (0 other, 1 sea, 2 hill), daylight, twilight, sea level (world y)
uniform vec4 uDark;          // darkness colour rgb, amount (0 = none: the 2D layer did it, or it's light)
uniform float uLN;           // how many lights (S.lights drew them into the light map)
uniform sampler2D uLightA;   // the light map: tint rgb (x 0.5), how lit (0-1)
uniform sampler2D uLightB;   // ...and the coloured lights' own glow rgb (x 0.5)
uniform vec2 uGlow;          // coloured lights' own glow: always, extra in the dark
uniform vec4 uWater;         // god rays, caustics, refraction, plankton (strengths, 0 = off)
uniform vec3 uRayCol;        // the light in the water (warm sun, blue moon)
uniform vec4 uSurf;          // surface line (image y, < 0 none), glint path strength, its x (texture px), reflection
uniform vec3 uSurfCol;       // the glint's colour
uniform vec4 uSky;           // sky: gradient a, b (t = a + b * texture y), clouds amount, sky line (texture y; below: no sky)
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform vec4 uSun;           // sun / moon x, y (texture px), glow radius, strength
uniform vec3 uSunCol;
uniform vec4 uBeam;          // the UFO beam: x, top y, bottom y (texture px), strength
// ---- Stage 3: tanks, the station, streaks, the beam-up (MEDIUM / HIGH; kind 3 station, 4 tank screen)
uniform vec4 uRoomA;         // station: the hull's inside (x0, y0, x1, y1, texture px); tank: the glass
uniform vec4 uRoomB;         // station: the trophy wing's inside; tank: water top, sand top (texture y)
uniform vec4 uTint;          // tank: its water's colour rgb, how much
uniform vec4 uGlass;         // tank glass: bright edges, reflections, the slow highlight's position (tank px), its strength
uniform vec3 uHole[NHOLE];   // station: portholes on screen: x, y, radius
uniform vec4 uSpace;         // station: nebula, stars, parallax x, y
uniform vec3 uNebA;
uniform vec3 uNebB;
uniform vec4 uPlanet[2];     // station: planets: x, y, radius, rim light
uniform vec4 uSA[NS];        // streaks (shooting / falling stars): head x, y, direction x, y
uniform vec4 uSB[NS];        // their trail length, strength, width, (unused)
uniform float uSN;
uniform vec3 uStreakCol;
uniform vec4 uLift;          // the beam-up: the diver's x, y, glow (0 = not lifting)
` + SHARP + `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// "water-coloured": blue-leaning pixels (the sea's own colour), so effects meant for open water skip rock and sprites
float waterMask(vec3 c) { return smoothstep(0.06, 0.2, c.b - c.r); }
#if defined(Q_MEDIUM) || defined(Q_HIGH)
float inRect(vec2 p, vec4 r) { return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
// space: soft stars in cells; the bright ones get a little lens glow; tw = twinkle (0 with REDUCE FLASHING)
float starLayer(vec2 p, float cell, float t, float tw) {
  vec2 id = floor(p / cell), f = fract(p / cell);
  float h = hash(id + cell);
  if (h < 0.82) return 0.0;
  vec2 c = vec2(hash(id + 1.7), hash(id + 9.3)) * 0.8 + 0.1;
  float d = length((f - c) * cell), b = (h - 0.82) / 0.18;
  float s = smoothstep(1.2, 0.0, d) * (0.35 + 0.65 * b) + exp(-d / 2.4) * b * b * 0.3;
  return s * (1.0 - tw * 0.25 * (0.5 + 0.5 * sin(t * (0.5 + h) + h * 40.0)));
}
float rays(vec2 wp, float t) {
  float x = wp.x + (wp.y - uScene.w) * 0.35;
  float a = sin(x * 0.045 + t * 0.21) * 0.5 + 0.5, b = sin(x * 0.083 - t * 0.15 + 1.7) * 0.5 + 0.5;
  float r = pow(a * b, 3.0);
  #ifdef Q_HIGH
  float c = sin(x * 0.021 + t * 0.09 + 4.0) * 0.5 + 0.5;
  r += 0.6 * pow(c * a, 4.0);
  #endif
  return r;
}
float caustics(vec2 p, float t) {
  p *= 0.085;
  float v = sin(p.x * 1.3 + sin(p.y * 1.1 + t * 0.5) * 1.2 + t * 0.35) + sin(p.y * 1.7 + sin(p.x * 0.9 - t * 0.42) * 1.4 - t * 0.27);
  float k = pow(1.0 - clamp(abs(v) * 0.5, 0.0, 1.0), 6.0);
  #ifdef Q_HIGH
  p *= 1.9;
  float w = sin(p.x * 1.1 - sin(p.y * 1.3 - t * 0.38) * 1.1) + sin(p.y * 0.9 + sin(p.x * 1.5 + t * 0.31) * 1.3);
  k = max(k, 0.6 * pow(1.0 - clamp(abs(w) * 0.5, 0.0, 1.0), 7.0));
  #endif
  return k;
}
// drifting specks at a few depths: near ones small and sharp, far ones soft and dim
float specks(vec2 sp, vec2 cam, float t, float layer) {
  float cell = 14.0 + layer * 9.0, par = 1.0 - layer * 0.28;
  vec2 p = sp + cam * par + vec2(sin(t * 0.07 + layer) * 6.0 + t * (1.5 + layer), -t * (1.2 - layer * 0.3));
  vec2 id = floor(p / cell), f = fract(p / cell);
  float h = hash(id + layer * 17.0);
  if (h < 0.78) return 0.0;                                          // (about one cell in five has a speck)
  vec2 c = vec2(hash(id + 3.1), hash(id + 7.7)) * 0.7 + 0.15;
  float d = length((f - c) * cell);
  float size = 0.6 + layer * 1.1;
  return smoothstep(size + 0.6, size * 0.3, d) * (1.0 - layer * 0.35) * (0.6 + 0.4 * h);
}
float fbm(vec2 p) {
  float v = 0.5 * vnoise(p);
  #ifdef Q_HIGH
  v += 0.25 * vnoise(p * 2.03 + 3.1) + 0.125 * vnoise(p * 4.1 + 7.7);
  return v / 0.875;
  #else
  v += 0.25 * vnoise(p * 2.03 + 3.1);
  return v / 0.75;
  #endif
}
#endif
void main() {
  vec2 uv = vUv;
  float imgY = 1.0 - uv.y;
  vec2 tp = vec2(uv.x, imgY) * uTex;                                  // this pixel in texture px (y down)
  float t = uCam.z;
#if defined(Q_HIGH) && defined(K_WORLD)
  // ---- refraction: just under the surface line, water rows sway by whole pixels (sprites never move)
  if (uWater.z > 0.0 && uSurf.x >= 0.0) {
    float below = imgY - uSurf.x;
    if (below > 0.0 && below < 0.09) {
      float sh = floor(sin(tp.y * 0.9 + t * 1.1) * uWater.z * (1.0 - below / 0.09) + 0.5);
      vec2 uv2 = uv + vec2(sh / uTex.x, 0.0);
      if (waterMask(texture2D(uWorld, uv).rgb) > 0.9 && waterMask(texture2D(uWorld, uv2).rgb) > 0.9) uv = uv2;
    }
  }
#endif
  vec4 w = sharp(uWorld, uv, uTex, uOut);
  vec3 c = w.rgb + uBg * (1.0 - w.a);
  vec3 base = c;
  float wm = waterMask(base);
  // ---- depth fog (the sea, under the surface line): toward deep blue-teal, flatter, softer
  float under = uFogB.x < 0.0 ? 1.0 : smoothstep(uFogB.x - 0.004, uFogB.x + 0.02, imgY);
  float fog = uFog.a * under * (0.72 + 0.28 * imgY);
#if defined(Q_MEDIUM) || defined(Q_HIGH)
  #ifdef K_WORLD
  // softening "in the distance": away from the middle of the screen (where the diver is), never on it
  float far = smoothstep(0.18, 0.62, length((uv - 0.5) * vec2(1.6, 1.0)));
  if (fog * far > 0.01) {
    vec2 o = uFogB.w * fog * far / uTex;
    vec3 s = texture2D(uWorld, uv + vec2(o.x, 0.0)).rgb + texture2D(uWorld, uv - vec2(o.x, 0.0)).rgb;
  #ifdef Q_HIGH
    s += texture2D(uWorld, uv + vec2(0.0, o.y)).rgb + texture2D(uWorld, uv - vec2(0.0, o.y)).rgb;
    s *= 0.25;
  #else
    s *= 0.5;
  #endif
    c = mix(c, s, clamp(fog * far * 0.8, 0.0, 0.55));
  }
  #endif
  vec2 wp = uCam.xy + tp;                                             // this pixel in world px
  float sea = uScene.x == 1.0 ? 1.0 : 0.0;
  float lumB = dot(base, vec3(0.299, 0.587, 0.114));
  float tankG = 0.0, tankW = 0.0;                                     // the tank screen: inside the glass / in its water
#ifdef K_TANK
  tankG = inRect(tp, uRoomA); tankW = tankG * step(uRoomB.x, tp.y);
#endif
  float uw = sea * (uSurf.x < 0.0 ? 1.0 : smoothstep(uSurf.x, uSurf.x + 0.01, imgY)) + tankW;   // under the water
  // ---- a tank's water takes its own colour (a little)
#ifdef K_TANK
  if (tankW > 0.0) c = mix(c, min(uTint.rgb * lumB / max(dot(uTint.rgb, vec3(0.299, 0.587, 0.114)), 0.05), 1.0), uTint.a);   // (its hue, the same brightness)
#endif
  // ---- underwater light, before the dark: god rays on open water, caustics dancing on rock and sand
  if (uw > 0.0) {
    float depth = max(0.0, wp.y - uScene.w);
    float fade = exp(-depth / 260.0);
    float open = max(wm, tankW);                                      // (all of a tank's water counts as open water)
    if (uWater.x > 0.0) c += uRayCol * rays(wp, t) * uWater.x * fade * (0.35 + 0.65 * open) * uw * (1.0 - 0.75 * lumB * tankW);   // (pale tanks: gentler, never white)
#ifdef K_TANK
    if (uWater.y > 0.0) {
      float sand = smoothstep(uRoomB.y - 3.0, uRoomB.y + 2.0, tp.y);  // on the sand (and what rests on it), not the open water
      if (sand > 0.0) c += c * uRayCol * caustics(wp, t) * uWater.y * sand * tankW;
    }
#else
    if (uWater.y > 0.0 && wm < 0.9) {
      // only on surfaces that touch the water (a few pixels from it), not inside solid ground
      vec2 o = 3.0 / uTex;
      float near = max(waterMask(texture2D(uWorld, uv + vec2(o.x, -o.y)).rgb), waterMask(texture2D(uWorld, uv - vec2(o.x, -o.y)).rgb));
      c += c * uRayCol * caustics(wp, t) * uWater.y * exp(-depth / 420.0) * (1.0 - wm) * near * uw;
    }
#endif
  }
  // ---- the station: space outside (nebula, soft stars, planets lit at the rim by a distant sun) and soft
  // shadows inside where things meet the floor; its dimness only inside the building
  float darkMask = 1.0, sunMask = 1.0;
#ifdef K_STATION
  {
    float inRoom = max(inRect(tp, uRoomA), inRect(tp, uRoomB)), hole = 0.0;
    for (int i = 0; i < NHOLE; i++) { vec3 h = uHole[i]; if (h.z > 0.0) hole = max(hole, 1.0 - step(h.z, length(tp - h.xy))); }
    float outside = max(1.0 - inRoom, hole);
    darkMask = inRoom * (1.0 - hole); sunMask = outside;
    float space = outside * (1.0 - smoothstep(0.07, 0.16, lumB));    // (only the dark of space, never the hull)
    if (space > 0.0) {
      vec2 sp = tp + uSpace.zw * 0.08;
      float n = fbm(sp * 0.011 + vec2(t * 0.003, 0.0)), m = vnoise(sp * 0.007 + 11.0);
      vec3 neb = mix(uNebA, uNebB, m) * smoothstep(0.4, 0.92, n) * uSpace.x;
      float tw = 1.0 - uCam.w;
      float st = starLayer(tp + uSpace.zw * 0.05, 9.0, t, tw) * 0.55 + starLayer(tp + uSpace.zw * 0.12, 15.0, t + 3.0, tw);
      c += (neb + vec3(0.86, 0.9, 1.0) * st * uSpace.y) * space;
    }
    for (int i = 0; i < 2; i++) {
      vec4 p = uPlanet[i];
      if (p.w <= 0.0) continue;
      vec2 d = tp - p.xy; float r = length(d);
      if (r > p.z + 9.0) continue;
      float facing = max(0.0, dot(d / max(r, 0.001), normalize(uSun.xy - p.xy)));
      float rim = smoothstep(p.z - 3.0, p.z - 0.5, r) * (1.0 - smoothstep(p.z - 0.5, p.z + 0.6, r));
      float atm = r > p.z ? exp(-(r - p.z) / 2.5) : 0.0;
      c += uSunCol * (rim * 0.55 + atm * 0.3) * facing * p.w * outside;
    }
    if (darkMask > 0.0 && uLN > 0.0) c *= 1.0 - texture2D(uLightB, uv).a * darkMask;   // (the soft shadows, in the light map)
  }
#endif
  // ---- darkness and real lights (night, caves, the deep): smooth and coloured, from the light map
  float litK = 1.0;                                                   // how lit this pixel is (1 = no darkness here)
  if (uDark.a > 0.0 || uLN > 0.0) {
    vec4 la = texture2D(uLightA, uv);                                 // (worked out once per world pixel: S.lights)
    float lit = la.a;
    vec3 tint = la.rgb * 2.0, glow = texture2D(uLightB, uv).rgb * 2.0;
    float da = uDark.a * darkMask;
    c = mix(c, uDark.rgb, da * (1.0 - lit));
    litK = max(1.0 - da, lit);
    c += c * tint + glow * (uGlow.x + uGlow.y * uDark.a);   // (coloured glow: stronger the darker it is)
  }
  // ---- plankton and floating specks (underwater): sharp near ones, soft far ones
  if (uWater.w > 0.0 && uw > 0.0) {
    vec2 sp = tp;
    float k = specks(sp, uCam.xy, t, 0.0) + specks(sp, uCam.xy, t, 1.0);
  #ifdef Q_HIGH
    k += specks(sp, uCam.xy, t, 2.0);
  #endif
    c += vec3(0.75, 0.9, 1.0) * k * uWater.w * uw * max(wm, tankW) * (0.4 + 0.6 * uScene.y) * mix(0.15, 1.0, litK);   // (open water only; in the dark you see them near light)
  }
#ifdef K_WORLD
  // ---- the surface: a soft reflection band and a gentle glint path under the sun / moon
  if (uSurf.x >= 0.0 && uSurf.y > 0.0) {
    float below = imgY - uSurf.x;
    if (below > 0.0 && below < 0.12) {
      float band = 1.0 - below / 0.12;
      float path = exp(-pow((tp.x - uSurf.z) / (14.0 + below * 220.0), 2.0));
      float glint = smoothstep(0.72, 0.95, vnoise(vec2(tp.x * 0.55, tp.y * 1.6 + t * 0.6)));
      glint = mix(glint, 0.25 + 0.2 * glint, uCam.w);              // (REDUCE FLASHING: a steady soft path, no sparkle)
      c += uSurfCol * glint * path * band * uSurf.y;
      c += uSkyBot * uSurf.w * band * band * wm;
    }
  }
  // ---- the sky: soft clouds behind everything (only where the pixel is the sky's own colour), the sun's glow
  if (imgY * uTex.y < uSky.w) {
    float st = clamp(uSky.x + uSky.y * tp.y, 0.0, 1.0);
    vec3 skyc = mix(uSkyTop, uSkyBot, st);
    float isSky = 1.0 - smoothstep(0.03, 0.09, length(base - skyc));
    if (uSky.z > 0.0 && isSky > 0.0) {
      vec2 cp = vec2(tp.x + uCam.x * 0.05 + t * 1.6, tp.y * 2.4) * 0.018;
      float n = fbm(cp);
      float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.35, 1.0 - st);
      float edge = smoothstep(0.5, 0.58, n) - smoothstep(0.58, 0.7, n);
      vec3 ccol = mix(skyc, vec3(1.0, 0.98, 0.95), 0.45 + 0.35 * uScene.y) + uSunCol * 0.25 * edge;
      c = mix(c, ccol, cl * uSky.z * isSky);
    }
  }
#endif
  if (uSun.w > 0.0) {
    float d = length(tp - uSun.xy);
    c += uSunCol * uSun.w * exp(-d / uSun.z) * sunMask;
  }
#ifdef K_WORLD
  // ---- the UFO beam: a soft volumetric glow around it
  if (uBeam.w > 0.0 && tp.y > uBeam.y - 6.0 && tp.y < uBeam.z + 4.0) {
    float dx = abs(tp.x - uBeam.x);
    float along = smoothstep(uBeam.y - 6.0, uBeam.y + 12.0, tp.y) * (1.0 - smoothstep(uBeam.z - 2.0, uBeam.z + 4.0, tp.y));
    c += vec3(0.78, 0.74, 1.0) * exp(-dx / 9.0) * uBeam.w * along;
  }
  // ---- the beam-up: the diver glows as the beam lifts them
  if (uLift.z > 0.0) {
    float d = length(tp - uLift.xy);
    c += vec3(0.82, 0.78, 1.0) * uLift.z * (0.4 * exp(-d / 10.0) + 0.14 * exp(-d / 40.0));
  }
#endif
  // ---- shooting / falling stars: a soft glowing trail and a halo round the head (eased in and out, no flash)
#if defined(K_WORLD) || defined(K_STATION)
  for (int i = 0; i < NS; i++) {
    if (float(i) >= uSN) break;
    vec4 A = uSA[i], B = uSB[i];
    vec2 d = tp - A.xy;
    float behind = -dot(d, A.zw);
    if (behind < -12.0 || behind > B.x + 12.0) continue;
    float across = abs(d.x * A.w - d.y * A.z);
    float trail = exp(-across / B.z) * (1.0 - clamp(behind / B.x, 0.0, 1.0)) * step(0.0, behind);
    c += uStreakCol * (trail * 0.3 + exp(-length(d) / (B.z * 2.5)) * 0.45) * B.y;
  }
#endif
  // ---- tank glass: brighter edges, faint fixed reflections, a highlight sweeping very slowly across
#ifdef K_TANK
  if (tankG > 0.0) {
    float ex = min(tp.x - uRoomA.x, uRoomA.z - tp.x), ey = min(tp.y - uRoomA.y, uRoomA.w - tp.y);
    float rim = exp(-max(min(ex, ey), 0.0) / 2.2);
    float dg = wp.x + tp.y * 0.55;                                    // (diagonal, fixed to the glass as it scrolls)
    float refl = pow(0.5 + 0.5 * sin(dg * 0.031), 14.0) + 0.5 * pow(0.5 + 0.5 * sin(dg * 0.067 + 1.3), 22.0);
    c += vec3(0.8, 0.93, 1.0) * (rim * uGlass.x + refl * uGlass.y);
    c += vec3(1.0, 0.98, 0.94) * exp(-pow((dg - uGlass.z) / 16.0, 2.0)) * uGlass.w;
  }
#endif
#endif
  // ---- colour grading: gain, saturation, contrast, brightness, a split tone in the shadows
  c *= uGradeA.rgb;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(lum), c, uGradeA.a);
  c = (c - 0.5) * uGradeB.x + 0.5 + uGradeB.y;
  c += uShadow * uGradeB.z * (1.0 - lum) * (1.0 - lum);
  // ---- fog colour and flatness on top of the grade
  if (fog > 0.0) {
    float l2 = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(l2), fog * uFogB.y);
    c = mix(c, (c - 0.12) * (1.0 - uFogB.z) + 0.12, fog);        // flatter in the deep (around a dark middle: the dark stays dark)
    c = mix(c, uFog.rgb * (0.6 + l2), fog * 0.4);                    // (darkness stays dark: the fog tints, it doesn't lift)
  }
#if defined(Q_MEDIUM) || defined(Q_HIGH)
  // ---- bloom: the bright parts' soft glow (a little dimmed in thick fog)
  c += texture2D(uBloom, uv).rgb * uFx.z * (1.0 - fog * 0.5);
#endif
#ifdef PASS_SCENE
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
#else
  // ---- vignette (soft corners) and the interface, crisp and untouched, on top (premultiplied "over")
  vec2 q = uv - 0.5;
  c *= 1.0 - uFx.x * smoothstep(0.32, 0.85, dot(q, q) * 2.2);
  c = clamp(c, 0.0, 1.0);
  if (uUIOn > 0.5) { vec4 ui = sharp(uUI, uv, uUITex, uOut); c = ui.rgb + c * (1.0 - ui.a); }
  gl_FragColor = vec4(c, 1.0);
#endif
}`;
  // ---------------------------------------------------------------- the light map (MEDIUM / HIGH)
  // Every light, worked out once per world pixel (the world texture's size) instead of per screen pixel;
  // lights are soft, so the composite's smooth (bilinear) sampling keeps them smooth. out 0: tint rgb x 0.5
  // and how lit (alpha); out 1: the coloured lights' own glow x 0.5. maxl: fewer lights when the graphics
  // chip has little room for uniforms (src/gfx/gfx.js works it out).
  // ao (out 1, the station): its alpha holds the soft contact shadows where things meet the floors
  S.lights = (maxl, out, ao) => PREC + `
#define MAXL ${maxl}
#define NAO ${S.counts.ao}
${ao ? '#define AO 1' : ''}
varying vec2 vUv;
uniform vec2 uTex;
uniform vec4 uL[MAXL];       // lights: x, y (texture px), radius, power
uniform vec4 uLC[MAXL];      // their colour rgb (0 = plain white light), kind (0 point, +-1 the lamp facing right / left, 2 a ceiling lamp, 3 a soft area light)
uniform float uLN;           // how many lights
uniform vec4 uLampCol;       // the lamp's colour, its tint strength
#ifdef AO
uniform vec4 uFloors;        // floor lines (texture y; far away = none)
uniform vec4 uCeils;         // ceilings
uniform vec4 uAO[NAO];       // things standing on a floor: centre x, floor y, half width, strength
// a soft shadow band just above a line (a floor) or just below one (a ceiling, with negated values)
float band(float y, float edge, float h) { float d = edge - y; return d > 0.0 && d < h ? (1.0 - d / h) * (1.0 - d / h) : 0.0; }
#endif
void main() {
  vec2 tp = vec2(vUv.x, 1.0 - vUv.y) * uTex;
  float lit = 0.0, ao = 0.0;
  vec3 glow = vec3(0.0), tint = vec3(0.0);
` + LOOP + `#ifdef AO
  ao = (band(tp.y, uFloors.x, 7.0) + band(tp.y, uFloors.y, 7.0) + band(tp.y, uFloors.z, 7.0) + band(tp.y, uFloors.w, 7.0)) * 0.2
     + (band(-tp.y, -uCeils.x, 6.0) + band(-tp.y, -uCeils.y, 6.0) + band(-tp.y, -uCeils.z, 6.0) + band(-tp.y, -uCeils.w, 6.0)) * 0.16;
  for (int i = 0; i < NAO; i++) {
    vec4 o = uAO[i];
    if (o.w <= 0.0) continue;
    float dy = o.y - tp.y, dx = abs(tp.x - o.x);
    if (dy > 0.0 && dy < 5.0) ao += o.w * (1.0 - dy / 5.0) * (1.0 - smoothstep(o.z - 3.0, o.z + 5.0, dx));
  }
#endif
  gl_FragColor = ${out ? 'vec4(glow * 0.5, clamp(ao, 0.0, 0.5))' : 'vec4(tint * 0.5, lit)'};
}`;
  // the second pass for MEDIUM / HIGH: the finished world (S.composite 'scene') -> the screen, sharp, plus
  // the vignette, film grain (very faint; off with REDUCE FLASHING) and the interface on top
  S.final = PREC + `
varying vec2 vUv;
uniform sampler2D uSrc;
uniform sampler2D uUI;
uniform vec2 uSrcSize;
uniform vec2 uUITex;
uniform vec2 uOut;
uniform vec4 uFx;            // vignette, grain, (bloom), grain seed
uniform float uUIOn;
uniform sampler2D uPrev;     // the last frame of the scene we just left, for a soft cross-fade
uniform float uXf;           // how much of it still shows (0 = none)
` + SHARP + `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = sharp(uSrc, vUv, uSrcSize, uOut).rgb;
  if (uXf > 0.0) c = mix(c, sharp(uPrev, vUv, uSrcSize, uOut).rgb, uXf);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uFx.x * smoothstep(0.32, 0.85, dot(q, q) * 2.2);
  if (uFx.y > 0.0) c += (hash(floor(vUv * uOut) + uFx.w) - 0.5) * uFx.y;
  c = clamp(c, 0.0, 1.0);
  if (uUIOn > 0.5) { vec4 ui = sharp(uUI, vUv, uUITex, uOut); c = ui.rgb + c * (1.0 - ui.a); }
  gl_FragColor = vec4(c, 1.0);
}`;
  return S;
})();
