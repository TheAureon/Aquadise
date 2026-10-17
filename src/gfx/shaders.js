// The shader layer's GLSL (WebGL1), as strings. Every pass draws one screen-covering triangle.
// Textures uploaded from canvases are flipped on upload (UNPACK_FLIP_Y) so canvases and framebuffers
// share one orientation: vUv (0,0) is the bottom-left. "Image y" (0 = top, as the game thinks) is
// 1.0 - vUv.y. Colours are premultiplied by alpha everywhere.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Shaders = (function () {
  const S = {};
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
  // HIGH), so each level compiles only what it uses.
  S.composite = (level) => PREC + `
#define Q_${level.toUpperCase()} 1
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
uniform vec4 uFx;            // vignette, grain, bloom, time
uniform float uUIOn;
` + SHARP + `
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  float imgY = 1.0 - uv.y;
  vec4 w = sharp(uWorld, uv, uTex, uOut);
  vec3 c = w.rgb + uBg * (1.0 - w.a);
  // ---- depth fog (the sea, under the surface line): toward deep blue-teal, flatter, softer
  float under = uFogB.x < 0.0 ? 1.0 : smoothstep(uFogB.x - 0.004, uFogB.x + 0.02, imgY);
  float fog = uFog.a * under * (0.72 + 0.28 * imgY);
#if defined(Q_MEDIUM) || defined(Q_HIGH)
  // softening "in the distance": away from the middle of the screen (where the diver is), never on it
  float far = smoothstep(0.18, 0.62, length((uv - 0.5) * vec2(1.6, 1.0)));
  if (fog * far > 0.01) {
    // a few taps around the pixel (more and wider the deeper it gets)
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
  // ---- vignette (soft corners) and film grain (very faint; off on LOW and with REDUCE FLASHING)
  vec2 q = uv - 0.5;
  c *= 1.0 - uFx.x * smoothstep(0.32, 0.85, dot(q, q) * 2.2);
#if defined(Q_MEDIUM) || defined(Q_HIGH)
  if (uFx.y > 0.0) c += (hash(floor(uv * uOut) + uFx.w) - 0.5) * uFx.y;
#endif
  c = clamp(c, 0.0, 1.0);
  // ---- the interface, crisp and untouched, on top (premultiplied "over")
  if (uUIOn > 0.5) { vec4 ui = sharp(uUI, uv, uUITex, uOut); c = ui.rgb + c * (1.0 - ui.a); }
  gl_FragColor = vec4(c, 1.0);
}`;
  return S;
})();
