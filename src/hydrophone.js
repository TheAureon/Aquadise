// The HYDROPHONE (the fifth upgrade, EAR in the HUD, levels 0-3) and listening.
//   Hearing range: AQ.TUNING.hydrophone.range[level] (world px). Anything that calls (a tracker creature,
//   a testing source) calls AQ.Hydro.call(src): within range it plays its sound from where it is (stereo,
//   quieter and duller with distance: AQ.Audio.playAt) AND shows a small ripple there, whose centre is a
//   little vague (jittered by up to hydrophone.jitter px, less when you're closer and the higher your
//   level). A call heard off screen shows a brief arrow at the screen's edge instead.
//   ACCESSIBILITY: nothing needs hearing. Every call that makes a sound in range also shows a ripple or an
//   edge arrow at the same range, so with the sound off the game plays exactly the same.
//   LISTEN (hydrophone level 1+): hold the listen key (keys.listen; touch: the ear button). The world dims a
//   little, music and ambience duck, you move a bit slower, every source in range pulses with big ripples,
//   and sources off screen get an arrow at the screen's edge (bigger and brighter = closer). Letting go
//   brings everything back smoothly. It never pauses the game and never blocks the net. It only works while
//   playing in the sea; leaving the sea or opening a menu ends it.
//   Sources: AQ.Hydro.sources() = creatures with `c.caller` (src/behaviors.js tracker) + testing sources.
//   A source: { x, y, sound, req (hydrophone level needed), echo, quietUntil } ; src.heard = last heard spot.
//   Testing: AQ.TUNING.debug.hydrophone = max level, a few testing sources near the start, and an overlay
//   with every source's true position (magenta crosses), even ones you can't hear.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Hydro = (function () {
  const U = AQ.U, R = U.R;
  const H = { k: 0, listening: false, ripples: [], flashes: [], debugSrc: [], heardAny: false };
  const cfg = () => AQ.TUNING.hydrophone;
  const dbg = () => !!AQ.TUNING.debug.hydrophone;
  H.max = () => cfg().max;
  H.level = () => { const g = AQ.Game; return Math.min(H.max(), (g && g.upgrades && g.upgrades.hydro) || 0); };
  H.range = (lvl = H.level()) => cfg().range[Math.min(lvl, cfg().range.length - 1)];
  H.unlocked = () => H.level() >= 1;
  // TESTING ONLY flag: max level (topped up whenever a game loads or starts, like debug.hundredPanes)
  H.debugTopUp = function () { if (dbg() && AQ.State.upgrades) AQ.State.upgrades.hydro = H.max(); };

  // ---------------------------------------------------------------- sources
  H.sources = function () {
    const out = H.debugSrc.slice();
    if (AQ.Creatures) for (const c of AQ.Creatures.list) if (c.caller && !c.fadedOut) out.push(c.caller);
    return out;
  };
  const P = () => AQ.Game.player;
  const inSea = (game) => game.state === 'play' && game.scene === 'world';
  // can you hear this source right now? (in the sea, within range, and your level is high enough)
  H.hears = function (src, game = AQ.Game) {
    if (!game || !inSea(game)) return false;
    if ((src.req || 0) > H.level()) return false;
    return Math.hypot(src.x - P().x, src.y - P().y) <= H.range();
  };
  // where you think it is: jittered, less when close and with a better hydrophone
  function guess(src) {
    const c = cfg(), d = Math.hypot(src.x - P().x, src.y - P().y);
    const err = c.jitter * U.clamp(d / H.range(), c.minJitterK, 1) * c.jitterLevel[Math.min(H.level(), c.jitterLevel.length - 1)];
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * err;
    return { x: src.x + Math.cos(a) * r, y: src.y + Math.sin(a) * r };
  }
  const onScreen = (x, y, m = 0) => { const l = AQ.Camera.left(), t = AQ.Camera.top(); return x >= l - m && x < l + 320 + m && y >= t - m && y < t + 180 + m; };

  // a source calls: its sound (spatial) + a ripple (or an edge arrow when it's off screen). Returns heard.
  H.call = function (src, opts = {}) {
    const game = AQ.Game;
    if (!game || !H.hears(src, game)) return false;
    const g = guess(src), d = Math.hypot(src.x - P().x, src.y - P().y);
    src.heard = { x: g.x, y: g.y, t: 0 };
    if (src.sound) AQ.Audio.playAt(src.sound, src.x, src.y, { range: H.range(), key: src.key || src.sound, vol: opts.vol });
    ripple(g.x, g.y, false, src.color, opts.faint);
    if (!onScreen(g.x, g.y, 4)) flash(g.x, g.y, d);
    if (opts.echo) {                                     // an echo: a fainter ripple a moment later, a little way off
      const e = opts.echo;
      setTimeout(() => { if (H.hears(src)) { ripple(g.x + e.dx, g.y + e.dy, false, src.color, true); if (src.echoSound) AQ.Audio.playAt(src.echoSound, src.x + e.dx, src.y + e.dy, { range: H.range(), key: (src.key || src.sound) + ':echo', vol: 0.6 }); } }, e.delay * 1000);
    }
    if (!H.heardAny) { H.heardAny = true; if (AQ.Tips) AQ.Tips.event('heard'); }
    return true;
  };
  function ripple(x, y, big, col, faint) {
    const c = cfg().ripple;
    H.ripples.push({ x, y, t: 0, life: big ? c.bigLife : c.life, r1: big ? c.bigRadius : c.radius, col: col || c.color, a: faint ? c.faintAlpha : 1 });
    if (H.ripples.length > c.max) H.ripples.shift();
  }
  H.ripple = ripple;
  function flash(x, y, d) { H.flashes.push({ x, y, d, t: 0, life: cfg().edgeFlashSeconds }); if (H.flashes.length > 8) H.flashes.shift(); }

  // ---------------------------------------------------------------- update (every frame, any screen)
  H.update = function (dt, game) {
    const c = cfg(), L = c.listen, I = AQ.Input;
    // listening: held key (or the touch ear button), only while playing in the sea
    const can = inSea(game) && H.unlocked() && !(AQ.Transition && AQ.Transition.active) && !(AQ.Touch && AQ.Touch.menuOpen) && !(AQ.Redo && AQ.Redo.dialog);
    const want = can && AQ.Keys.down('listen');
    if (want !== H.listening) {
      H.listening = want;
      AQ.Audio.play(want ? 'listen_on' : 'listen_off');
      if (want && AQ.Tips) AQ.Tips.event('listen');
    }
    const target = H.listening ? 1 : 0, was = H.k;
    H.k = target > H.k ? Math.min(1, H.k + dt / L.fade) : Math.max(0, H.k - dt / L.fade);
    if (!inSea(game) && game.state !== 'pause' && game.state !== 'map' && game.state !== 'log' && game.state !== 'guide') H.k = 0;   // left the sea: at once
    if (H.k !== was || (H.k === 0 && was !== 0)) AQ.Audio.setListen(H.k * (1 - L.duck));
    if (game.player) game.player.listenMul = U.lerp(1, L.slow, H.k);
    // testing sources
    if (dbg() && inSea(game)) debugSources(dt, game);
    if (!inSea(game)) return;
    // listening: every source in range pulses now and then (big ripples at the guessed spot)
    if (H.listening) for (const s of H.sources()) {
      s.pulseT = (s.pulseT || R() * L.pulseEvery) - dt;
      if (s.pulseT > 0) continue;
      s.pulseT = L.pulseEvery;
      if (!H.hears(s, game) || (s.quietUntil && game.time < s.quietUntil)) continue;
      const g = guess(s); s.heard = { x: g.x, y: g.y, t: 0 };
      ripple(g.x, g.y, true, s.color);
    }
    for (let i = H.ripples.length - 1; i >= 0; i--) if ((H.ripples[i].t += dt) > H.ripples[i].life) H.ripples.splice(i, 1);
    for (let i = H.flashes.length - 1; i >= 0; i--) if ((H.flashes[i].t += dt) > H.flashes[i].life) H.flashes.splice(i, 1);
  };
  // TESTING: a few calling sources in the water near the start (only with debug.hydrophone)
  function debugSources(dt, game) {
    if (!H.debugSrc.length) {
      const W = AQ.World, s = AQ.data.world.playerStart;
      [[140, 30], [260, 110], [380, 170], [250, 320]].forEach(([dx, dy], i) => {   // all within EAR 3's range of the start
        let x = s[0] + dx, y = W.sea + dy;
        for (let k = 0; k < 40 && !W.water(x, y); k++) y += 6;
        H.debugSrc.push({ x, y, sound: 'call_test', key: 'call_test:' + i, req: i % 4, t: 1 + i * 0.7, debug: true, label: 'TEST ' + (i + 1) + ' (EAR ' + (i % 4) + ')' });
      });
    }
    for (const s of H.debugSrc) { s.t -= dt; if (s.t <= 0) { s.t = cfg().debugEvery; H.call(s); } }
  }

  // ---------------------------------------------------------------- drawing (after the lighting, screen px)
  function ring(g, cx, cy, r, alpha, col) {
    const n = Math.max(12, Math.round(r * 5));
    g.fillStyle = col; g.globalAlpha = alpha;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.75), 1, 1); }
    g.globalAlpha = 1;
  }
  H.ring = ring;
  // an arrow at the screen's edge pointing toward (x, y) (world): bigger and brighter = closer
  function edgeArrow(g, x, y, d, alpha, col) {
    const l = AQ.Camera.left(), t = AQ.Camera.top(), cx = 160, cy = 90, dx = x - (l + cx), dy = y - (t + cy);
    const k = Math.min((150) / Math.abs(dx || 1e-6), (80) / Math.abs(dy || 1e-6)), ex = cx + dx * k, ey = cy + dy * k, ang = Math.atan2(dy, dx);
    const near = U.clamp(1 - d / H.range(), 0, 1), L = cfg().listen, size = Math.round(U.lerp(L.arrowMin, L.arrowMax, near));
    g.save(); g.translate(Math.round(ex), Math.round(ey)); g.rotate(ang);
    g.globalAlpha = alpha * (0.45 + 0.55 * near);
    g.fillStyle = 'rgba(4,12,24,0.7)';
    g.beginPath(); g.moveTo(size + 1, 1); g.lineTo(-size + 1, -size * 0.7 + 1); g.lineTo(-size + 1, size * 0.7 + 1); g.fill();
    g.fillStyle = col || cfg().ripple.color;
    g.beginPath(); g.moveTo(size, 0); g.lineTo(-size, -size * 0.7); g.lineTo(-size, size * 0.7); g.fill();
    g.restore();
  }
  H.draw = function (g, game) {
    if (game.scene !== 'world' || (game.state !== 'play' && game.state !== 'map' && game.state !== 'pause')) return;
    const l = AQ.Camera.left(), t = AQ.Camera.top(), L = cfg().listen;
    if (H.k > 0) { g.fillStyle = `rgba(4,10,24,${(L.dim * H.k).toFixed(3)})`; g.fillRect(0, 0, 320, 180); }   // listening: the world dims a little
    for (const r of H.ripples) {
      const k = r.t / r.life, rad = 1 + (r.r1 - 1) * k, a = (1 - k) * r.a;
      ring(g, r.x - l, r.y - t, rad, a * 0.9, r.col);
      if (r.r1 > 20 && k > 0.25) ring(g, r.x - l, r.y - t, rad * 0.6, a * 0.5, r.col);    // a second, inner ring on big ones
    }
    for (const f of H.flashes) edgeArrow(g, f.x, f.y, f.d, Math.min(1, (f.life - f.t) * 2), cfg().ripple.color);
    // listening: an arrow at the edge for each source in range that's off screen
    if (H.k > 0.05) for (const s of H.sources()) {
      if (!H.hears(s, game) || (s.quietUntil && game.time < s.quietUntil)) continue;
      const at = s.heard || s;
      if (onScreen(at.x, at.y, -4)) continue;
      edgeArrow(g, at.x, at.y, Math.hypot(s.x - P().x, s.y - P().y), H.k, s.color);
    }
    if (dbg()) {                                    // TESTING overlay: every source's true position
      for (const s of H.sources()) {
        const x = Math.round(s.x - l), y = Math.round(s.y - t), heard = H.hears(s, game);
        g.fillStyle = heard ? '#ff4fd8' : '#8a3a7a';
        g.fillRect(x - 3, y, 7, 1); g.fillRect(x, y - 3, 1, 7);
        AQ.Font.draw(g, (s.label || (s.def ? s.def.id : s.sound || '?')).toUpperCase(), x + 4, y - 7, heard ? '#ff9fe8' : '#b06aa0', { shadow: 'rgba(0,0,0,0.8)' });
      }
      AQ.Font.draw(g, `EAR ${H.level()}  RANGE ${H.range()}`, 4, 50, '#ff9fe8', { shadow: 'rgba(0,0,0,0.8)' });
      g.strokeStyle = 'rgba(255,79,216,0.25)'; g.beginPath(); g.ellipse(Math.round(P().x - l), Math.round(P().y - t), H.range(), H.range(), 0, 0, Math.PI * 2); g.stroke();
    }
  };
  H.end = function () { H.listening = false; H.k = 0; AQ.Audio.setListen(1); if (AQ.Game && AQ.Game.player) AQ.Game.player.listenMul = 1; };
  return H;
})();
