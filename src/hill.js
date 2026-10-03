// The hill past the far edge of Tide Pools: a small side-view scene (not on the world map).
// Foot of the hill on the right (walk off the right edge to go back), a gentle slope up to a flat
// top on the left, where a UFO hovers with a soft beam. Stand in the beam + interact -> beam up.
// Sizes come from AQ.TUNING.hill / AQ.TUNING.beam; art is the sky backdrop, a ground tile, the UFO
// and the beam sprites (all swappable, see docs/SPRITE_SPEC.md).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Hill = (function () {
  const U = AQ.U, R = U.R;
  const H = { mode: 'walk', t: 0, motes: [] };
  let W = null, G = null, canvas = null;

  H.build = function () {
    const c = AQ.TUNING.hill;
    const w = Math.round(c.topWidth + c.slopeLength + c.bottomFlat);
    const h = Math.round(Math.max(180, c.rise + c.ufoHeight + 120));
    const base = h - 30, top = base - c.rise;
    const surface = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      const u = U.clamp((x - c.topWidth) / c.slopeLength, 0, 1);
      const s = u * u * (3 - 2 * u);                                   // smooth, gentle slope
      surface[x] = Math.round(U.lerp(top, base, s) + (U.noise1(x * 0.05, 4) - 0.5) * 2);
    }
    W = AQ.MiniWorld(w, h);
    W.fillGround(surface);
    W.fillRect(0, top - 14, 9, 14);                                    // a mossy rock at the hilltop's far end
    G = { w, h, base, top, surface, beamX: Math.round(c.topWidth * 0.55), ufoY: top - c.ufoHeight };
    canvas = null;                                                     // painted lazily (needs the tile image)
  };
  H.world = () => W;
  H.geom = () => G;
  H.zoneName = () => 'The Hill';
  H.valid = (x, y) => W.standable(x, y) && W.boxHits(x, y + 3, 5, 4);   // standing on ground

  H.enter = function (game, spawn) {
    const P = game.player;
    H.mode = 'walk'; H.t = 0; H.lifted = false;
    if (spawn === 'fromStation') {
      // arrive in the beam, floating gently down onto the hilltop
      H.mode = 'land'; P.x = G.beamX; P.y = G.ufoY + 22; P.facing = 1;
    } else {
      // from Tide Pools (or a safe fallback): at the foot of the hill, facing up it
      P.x = G.w - 24; P.y = G.surface[G.w - 24] - 5; P.facing = -1;
    }
  };

  function inBeam(P) { return Math.abs(P.x - G.beamX) <= AQ.TUNING.beam.width / 2 && P.mode === 'walk'; }

  H.update = function (dt, game, input) {
    const P = game.player, B = AQ.TUNING.beam;
    H.t += dt;
    H.playerInBeam = H.mode === 'walk' && inBeam(P);       // (the UFO tip watches this)
    if (H.mode === 'walk') {
      P.update(dt, W, input);
      // back down to Tide Pools off the right edge
      if (P.x >= G.w - 10 && input.axis().x > 0 && !AQ.Transition.active) AQ.Scenes.go(game, 'world', 'fromHill');
      if (inBeam(P) && input.wasPressed(...AQ.TUNING.interactKeys)) { H.mode = 'lift'; P.vx = P.vy = 0; }
    } else if (H.mode === 'lift') {
      // the beam carries you up into the UFO
      P.t += dt; P.anim = 'jump';
      P.x += (G.beamX - P.x) * Math.min(1, dt * 4);
      P.y -= B.liftSpeed * dt * Math.min(1, 0.3 + H.t);
      if (R.chance(dt * 14)) AQ.FX.sparkle(P.x + R.range(-6, 6), P.y + R.range(-6, 10), '#bff6ff', 2);
      if (P.y < G.ufoY + 18 && !H.lifted) { H.lifted = true; AQ.Scenes.go(game, 'station', 'fromHill'); }
    } else if (H.mode === 'land') {
      P.t += dt; P.anim = 'jump';
      const ground = G.surface[Math.round(P.x)] - AQ.TUNING.swim.hitbox.h / 2;
      P.y = Math.min(ground, P.y + B.landSpeed * dt);
      if (R.chance(dt * 10)) AQ.FX.sparkle(P.x + R.range(-6, 6), P.y + R.range(-4, 8), '#bff6ff', 2);
      if (P.y >= ground) { H.mode = 'walk'; P.anim = 'stand'; }
    }
    AQ.Camera.update(dt, P, W);
    AQ.FX.update(dt, W);
    // drifting motes of light around the beam
    if (R.chance(dt * 6)) H.motes.push({ x: G.beamX + R.range(-B.width / 2, B.width / 2), y: G.top - R.range(0, 6), v: R.range(8, 18), life: R.range(2, 4), t: 0 });
    for (let i = H.motes.length - 1; i >= 0; i--) { const m = H.motes[i]; m.t += dt; m.y -= m.v * dt; m.x += Math.sin(m.t * 3 + m.v) * 4 * dt; if (m.t > m.life) H.motes.splice(i, 1); }
  };

  // Ground bitmap: the hill tile sampled by depth below the surface, plus a few flowers and the rock.
  function paint() {
    const tile = AQ.Assets.sprites['tile.hill'];
    canvas = document.createElement('canvas'); canvas.width = G.w; canvas.height = G.h;
    const g = canvas.getContext('2d');
    // Columns of the tile image, shifted down to follow the surface. Only drawImage is used (no pixel
    // reads), so this also works when the game is opened straight from a file (file://).
    for (let x = 0; x < G.w; x++) {
      const sy = Math.max(0, G.surface[x]);
      if (tile) {
        const img = tile.img, tw = img.width, th = img.height, tx = x % tw;
        g.drawImage(img, tx, 0, 1, th, x, sy, 1, th);
        for (let y = sy + th; y < G.h; y += 12) g.drawImage(img, tx, th - 12, 1, 12, x, y, 1, 12);   // deeper soil repeats
      } else { g.fillStyle = '#78aa50'; g.fillRect(x, sy, 1, G.h - sy); }
    }
    const r = U.rng(9);
    for (let k = 0; k < 40; k++) {                                     // little flowers + grass tufts
      const x = Math.round(r.range(12, G.w - 6)), y = G.surface[x];
      if (Math.abs(x - G.beamX) < 10) continue;
      g.fillStyle = '#5a9a44'; g.fillRect(x, y - 2, 1, 2);
      if (k % 3) { g.fillStyle = ['#ffd0e0', '#fff1a8', '#ffffff', '#c8b0ff'][k % 4]; g.fillRect(x, y - 3, 1, 1); }
    }
    g.fillStyle = '#7a7a86'; g.fillRect(0, G.top - 14, 9, 14); g.fillStyle = '#9a9aa8'; g.fillRect(0, G.top - 14, 8, 2);   // the rock
    g.fillStyle = '#6fa456'; g.fillRect(0, G.top - 15, 7, 1);
    // a worn little patch where the beam touches down
    for (let x = G.beamX - 9; x <= G.beamX + 9; x++) { const y = G.surface[x]; g.fillStyle = (x + y) % 2 ? '#b4e08a' : '#a6d47c'; g.fillRect(x, y, 1, 1); }
  }

  // The hill's sky follows the same clock as the sea: blue by day, a starry navy at night, and the
  // painted sunset backdrop (bg.hill_sky) fading in at dawn and dusk. Distant hills + sea below.
  const HILLS_DAY = [[124, 157, 190], [104, 140, 176]], HILLS_NIGHT = [[40, 46, 84], [30, 34, 66]];
  const SEA_DAY = [79, 169, 201], SEA_NIGHT = [26, 45, 85];
  const mixRGB = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
  function drawSky(ctx, t) {
    const R = AQ.Render, sky = R.skyCols(), d = AQ.Clock.daylight(), tw = AQ.Clock.twilight(), h = AQ.Clock.hour();
    for (let y = 0; y < 150; y += 2) { ctx.fillStyle = U.css(U.mix(sky[0], sky[1], y / 150)); ctx.fillRect(0, y, 320, 2); }
    if (d < 0.95) {                                            // stars
      for (let i = 0; i < 46; i++) {
        ctx.globalAlpha = (1 - d) * (0.45 + 0.4 * Math.sin(t * (1 + (i % 3)) + i));
        ctx.fillStyle = i % 5 ? '#e8f0ff' : '#fff6d0'; ctx.fillRect((i * 97 + 13) % 320, (i * 53) % 120, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // the sun crosses the sky by day, the moon by night
    const c = AQ.TUNING.clock, sunUp = (h - c.dawnHour) / (c.duskHour + c.duskHours - c.dawnHour);
    const moonUp = (((h - (c.duskHour + c.duskHours)) % 24) + 24) % 24 / (24 - (c.duskHour + c.duskHours - c.dawnHour));
    const body = (u, r, col) => { if (u < 0 || u > 1 || tw > 0.7) return; ctx.globalAlpha = 1 - tw / 0.7; const x = 20 + u * 280, y = 140 - Math.sin(u * Math.PI) * 110; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; };
    body(sunUp, 9, '#fff2c0'); body(moonUp, 6, '#e8eeff');
    const k = 1 - d;
    ctx.fillStyle = mixRGB(HILLS_DAY[0], HILLS_NIGHT[0], k);
    for (let x = 0; x < 320; x++) { const y = 134 - Math.sin(x * 0.02 + 1) * 6 - Math.sin(x * 0.051) * 3; ctx.fillRect(x, Math.round(y), 1, 152 - Math.round(y)); }
    ctx.fillStyle = mixRGB(HILLS_DAY[1], HILLS_NIGHT[1], k);
    for (let x = 0; x < 320; x++) { const y = 142 - Math.sin(x * 0.033 + 4) * 5; ctx.fillRect(x, Math.round(y), 1, 152 - Math.round(y)); }
    ctx.fillStyle = mixRGB(SEA_DAY, SEA_NIGHT, k); ctx.fillRect(0, 152, 320, 28);
    ctx.fillStyle = `rgba(255,255,255,${(0.35 * d + 0.1).toFixed(2)})`;
    for (let i = 0; i < 12; i++) ctx.fillRect(((i * 61 + Math.floor(t * 4)) % 330) - 5, 156 + (i * 7) % 20, 4, 1);
    // the painted sunset fades in over everything at dawn and dusk
    const art = AQ.Assets.sprites['bg.hill_sky'];
    if (art && tw > 0.02) { ctx.globalAlpha = Math.min(1, tw * 1.3); ctx.drawImage(art.img, 0, 0); ctx.globalAlpha = 1; }
    if (AQ.ShootingStars) AQ.ShootingStars.draw(ctx, AQ.Game);   // night streaks
    if (AQ.Gulls) AQ.Gulls.draw(ctx, AQ.Game, sky);   // distant seagulls
  }

  H.drawBeam = function (ctx, x, y0, y1, alpha) {
    const s = AQ.Assets.sprites['misc.beam'], B = AQ.TUNING.beam;
    if (!s) return;
    const e = s.entry, f = Math.floor(AQ.Render.t * e.anims.idle.fps) % e.anims.idle.frames;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(s.img, f * e.fw, 0, e.fw, e.fh, Math.round(x - B.width / 2), Math.round(y0), Math.round(B.width), Math.round(y1 - y0));
    ctx.restore();
  };

  H.draw = function (ctx, game) {
    if (!canvas) paint();
    const cam = AQ.Camera, left = cam.left(), top = cam.top(), t = AQ.Render.t, B = AQ.TUNING.beam;
    drawSky(ctx, t);
    ctx.drawImage(canvas, -left, -top);
    ctx.save(); ctx.translate(-left, -top);
    AQ.Assets.draw(ctx, 'misc.signpost', 'idle', G.w - 30, G.surface[G.w - 30] + 1, { flip: true });   // points back to Tide Pools
    game.player.draw(ctx);
    ctx.restore();
    // night falls on the hill too (the beam and the UFO's lights stay bright, drawn after this)
    const night = 1 - AQ.Clock.daylight();
    if (night > 0.02) { ctx.fillStyle = `rgba(10,16,40,${(night * 0.45).toFixed(3)})`; ctx.fillRect(0, 0, 320, 180); }
    ctx.save(); ctx.translate(-left, -top);
    // UFO + beam
    const uy = G.ufoY + Math.sin(t * 1.2) * 2;
    const pulse = B.glow * (0.85 + 0.15 * Math.sin(t * 3));
    H.drawBeam(ctx, G.beamX, uy + 6, G.top + 2, pulse);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse * 0.5;      // soft pool of light on the grass
    ctx.fillStyle = '#c8c0ff'; ctx.beginPath(); ctx.ellipse(G.beamX, G.top + 1, B.width / 2 + 3, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#e8fbff';
    for (const m of H.motes) { ctx.globalAlpha = Math.sin(m.t / m.life * Math.PI) * 0.8; ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1); }
    ctx.globalAlpha = 1;
    AQ.Assets.draw(ctx, 'misc.ufo', 'idle', G.beamX, uy, { t });
    AQ.FX.draw(ctx);
    ctx.restore();
    const P = game.player;
    if (H.mode === 'walk' && inBeam(P) && !AQ.Transition.active) AQ.Scenes.prompt(ctx, P.x - left, P.y - top - 22, 'BEAM UP');
  };

  AQ.Scenes.register('hill', H);
  return H;
})();
