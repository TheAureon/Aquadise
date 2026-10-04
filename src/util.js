// Small math / rng / noise helpers shared by the whole game.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.U = (function () {
  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.approach = (v, target, amt) => (v < target ? Math.min(v + amt, target) : Math.max(v - amt, target));

  // Deterministic RNG (mulberry32)
  U.rng = function (seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  };
  U.R = U.rng(Date.now() & 0xffffffff);   // non-deterministic gameplay rng
  // REDUCE FLASHING (Sound settings): flashes, bursts and fast blinking are softened or held steady
  U.calm = () => !!(AQ.State && AQ.State.settings && AQ.State.settings.reduceFlashing);
  U.rangeOf = (v, r) => (Array.isArray(v) ? (r || U.R).range(v[0], v[1]) : v);

  // Hash-based value noise
  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  U.hash2 = hash2;
  U.noise1 = function (x, seed) {
    const xi = Math.floor(x), xf = x - xi;
    return U.lerp(hash2(xi, 0, seed), hash2(xi + 1, 0, seed), U.smooth(xf));
  };
  U.noise2 = function (x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = U.smooth(x - xi), yf = U.smooth(y - yi);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, xf), U.lerp(c, d, xf), yf);
  };
  U.fbm2 = function (x, y, seed) {
    return U.noise2(x, y, seed) * 0.65 + U.noise2(x * 2.1, y * 2.1, seed + 7) * 0.35;
  };

  // Colors
  U.hex = function (h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  U.mix = (a, b, t) => [
    Math.round(U.lerp(a[0], b[0], t)), Math.round(U.lerp(a[1], b[1], t)), Math.round(U.lerp(a[2], b[2], t))
  ];
  U.scale = (c, f) => [Math.min(255, Math.round(c[0] * f)), Math.min(255, Math.round(c[1] * f)), Math.min(255, Math.round(c[2] * f))];
  U.css = (c, a) => (a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

  // Point in polygon (pts = [[x,y],...])
  U.pointInPoly = function (x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  U.uid = (function () { let n = 0; return () => Date.now().toString(36) + '-' + (n++).toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); })();

  return U;
})();
