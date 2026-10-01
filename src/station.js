// The aquarium building, floating in space. A cosy side-view interior with normal gravity:
// walk, jump, climb ladders between floors, and walk up to a tank display to tend it (interact).
// Ground floor: the beam pad (back down to the hill) and the tank directory (overview of all tanks).
// Layout: data/scenes.js (AQ.data.station). Art: space backdrop, planets, wall/floor/hull/ladder
// tiles, tank frame, console and beam pad sprites (all swappable, see docs/SPRITE_SPEC.md).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Station = (function () {
  const U = AQ.U, R = U.R, F = () => AQ.Font;
  const St = { mode: 'walk', t: 0, dust: [] };
  let W = null, L = null, canvas = null, tanks = [];

  St.build = function () {
    L = AQ.data.station;
    const h = L.hull, T = h.thick;
    W = AQ.MiniWorld(L.width, L.height);
    W.fillRect(h.x, h.y, h.w, T);                                        // roof
    W.fillRect(h.x, h.y, T, h.h); W.fillRect(h.x + h.w - T, h.y, T, h.h); // side walls
    W.fillRect(h.x, L.floors[0], h.w, h.y + h.h - L.floors[0]);           // ground floor + underside
    for (let i = 1; i < L.floors.length; i++) W.fillRect(h.x, L.floors[i], h.w, L.floorThick);
    L.ladders.forEach((ld) => {
      const top = L.floors[ld.floor + 1], bottom = L.floors[ld.floor];
      W.fillRect(ld.x - 7, top, 14, L.floorThick, AQ.World.AIR);         // hole through the floor above...
      W.addOneWay(ld.x - 7, top, 14);                                    // ...that you can still stand on
      W.addLadder(ld.x, top, bottom);
    });
    canvas = null;
  };
  St.world = () => W;
  St.zoneName = () => 'Aquarium Station';
  St.valid = (x, y) => W.standable(x, y) && W.boxHits(x, y + 3, 5, 4) && x > L.hull.x + 10 && x < L.hull.x + L.hull.w - 10 && y > L.hull.y && y < L.floors[0];

  function biomeOrder() { return AQ.World.biomes.slice().sort((a, b) => (a.rect[0] + (a.id === 'lush_cave' ? 1 : 0) + (a.id === 'cave' ? -1 : 0)) - (b.rect[0] + (b.id === 'lush_cave' ? 1 : 0) + (b.id === 'cave' ? -1 : 0))); }
  function layoutTanks() {
    const bs = biomeOrder();
    tanks = L.tanks.slice(0, bs.length).map((t, i) => ({ x: t.x, floor: t.floor, y: L.floors[t.floor], b: bs[i] }));
  }

  St.enter = function (game, spawn) {
    const P = game.player, fy = L.floors[0];
    layoutTanks();
    St.t = 0; St.leaving = false;
    P.x = L.pad.x; P.y = fy - AQ.TUNING.swim.hitbox.h / 2 - 0.01; P.facing = -1; P.anim = 'stand';
    St.mode = spawn === 'fromHill' ? 'beamin' : 'walk';
  };

  // what's in front of the player right now: a tank, the console or the pad
  function nearby(P) {
    const feet = P.y + AQ.TUNING.swim.hitbox.h / 2;
    const fl = L.floors.findIndex((y) => Math.abs(feet - y) < 3);
    if (fl < 0 || P.mode !== 'walk') return null;
    if (fl === 0 && Math.abs(P.x - L.pad.x) < 13) return { kind: 'pad', text: 'BEAM DOWN TO THE HILL' };
    if (fl === 0 && Math.abs(P.x - L.console.x) < 11) return { kind: 'console', text: 'TANK DIRECTORY' };
    const t = tanks.find((k) => k.floor === fl && Math.abs(P.x - k.x) < 26);
    if (t) return { kind: 'tank', tank: t, text: `TEND THE ${(t.b.short || t.b.name).toUpperCase()} TANK` };
    return null;
  }

  St.update = function (dt, game, input) {
    const P = game.player;
    St.t += dt;
    if (!tanks.length) layoutTanks();
    if (St.mode === 'walk') {
      P.update(dt, W, input);
      const n = nearby(P);
      if (n && input.wasPressed(...AQ.TUNING.interactKeys)) {
        if (n.kind === 'pad') { St.mode = 'beamout'; St.t = 0; P.vx = 0; P.x = L.pad.x; }
        else if (n.kind === 'tank') { AQ.Aquarium.open(game, 'station', n.tank.b.id); return; }
        else if (n.kind === 'console') { AQ.Aquarium.open(game, 'station', AQ.Aquarium.biome || 'tide_pools'); AQ.Aquarium.openOverview(); return; }
      }
    } else if (St.mode === 'beamin' || St.mode === 'beamout') {
      P.t += dt; P.anim = 'stand';
      if (R.chance(dt * 18)) AQ.FX.sparkle(P.x + R.range(-6, 6), P.y + R.range(-14, 6), '#bff6ff', 2);
      if (St.mode === 'beamin' && St.t > 0.9) St.mode = 'walk';
      if (St.mode === 'beamout' && St.t > 0.5 && !St.leaving) { St.leaving = true; AQ.Scenes.go(game, 'hill', 'fromStation'); }
    }
    AQ.Camera.update(dt, P, W);
    AQ.FX.update(dt, W);
    if (St.dust.length < 30 && R.chance(dt * 8)) St.dust.push({ x: R.range(0, L.width), y: R.range(0, L.height), vx: R.range(-3, 3), vy: R.range(-2, 2), life: R.range(6, 12), t: 0 });
    for (let i = St.dust.length - 1; i >= 0; i--) { const d = St.dust[i]; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.t > d.life) St.dust.splice(i, 1); }
  };

  // ---------------------------------------------------------------- building bitmap (painted once)
  // Only drawImage / patterns are used to paint (no pixel reads), so this works from file:// too.
  function paint() {
    const h = L.hull, T = h.thick;
    canvas = document.createElement('canvas'); canvas.width = L.width; canvas.height = L.height;
    const g = canvas.getContext('2d');
    const pat = (key, fallback) => { const sp = AQ.Assets.sprites[key]; return sp ? g.createPattern(sp.img, 'repeat') : fallback; };
    const inner = { x0: h.x + T, x1: h.x + h.w - T, y0: h.y + T };
    const corner = 14;   // rounded hull corners
    g.save();
    g.beginPath();
    g.moveTo(h.x + corner, h.y); g.lineTo(h.x + h.w - corner, h.y); g.arc(h.x + h.w - corner, h.y + corner, corner, -Math.PI / 2, 0);
    g.lineTo(h.x + h.w, h.y + h.h - corner); g.arc(h.x + h.w - corner, h.y + h.h - corner, corner, 0, Math.PI / 2);
    g.lineTo(h.x + corner, h.y + h.h); g.arc(h.x + corner, h.y + h.h - corner, corner, Math.PI / 2, Math.PI);
    g.lineTo(h.x, h.y + corner); g.arc(h.x + corner, h.y + corner, corner, Math.PI, Math.PI * 1.5);
    g.closePath(); g.clip();
    g.fillStyle = pat('tile.station_hull', '#8a96a6'); g.fillRect(h.x, h.y, h.w, h.h);
    g.fillStyle = pat('tile.station_wall', '#2c3e52'); g.fillRect(inner.x0, inner.y0, inner.x1 - inner.x0, L.floors[0] - inner.y0);
    g.restore();
    // portholes in the back wall: cut out so space shows through
    const holes = L.windows.map(([wx, fl]) => ({ x: wx, y: L.floors[fl] - 50, r: 11 }));
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    holes.forEach((w) => { for (let y = -w.r; y <= w.r; y++) { const half = Math.floor(Math.sqrt(Math.max(0, (w.r - 0.5) ** 2 - y * y))); if (half > 0) g.fillRect(w.x - half, w.y + y, half * 2, 1); } });
    g.restore();
    holes.forEach((w) => {                                                // brass window rims + glass glint
      for (let a = 0; a < Math.PI * 2; a += 0.04) {
        g.fillStyle = Math.sin(a) < -0.3 ? '#e8c27a' : '#a8844a';
        g.fillRect(Math.round(w.x + Math.cos(a) * (w.r + 0.5)), Math.round(w.y + Math.sin(a) * (w.r + 0.5)), 1, 1);
      }
      g.fillStyle = 'rgba(220,240,255,0.18)'; g.fillRect(w.x - 6, w.y - 6, 2, 2); g.fillRect(w.x - 4, w.y - 7, 2, 1);
    });
    // floors (tile), with the ladder holes left open
    const floorT = AQ.Assets.sprites['tile.station_floor'];
    L.floors.forEach((fy) => {
      for (let x = inner.x0; x < inner.x1; x += 32) {
        if (floorT) g.drawImage(floorT.img, 0, 0, Math.min(32, inner.x1 - x), 8, x, fy, Math.min(32, inner.x1 - x), 8);
        else { g.fillStyle = '#9aa8b4'; g.fillRect(x, fy, 32, 8); }
      }
    });
    L.ladders.forEach((ld) => {
      const top = L.floors[ld.floor + 1];
      g.clearRect(ld.x - 7, top + 1, 14, L.floorThick - 1);
      g.fillStyle = '#d8e2ea'; g.fillRect(ld.x - 7, top, 14, 1);          // the walkable lip over the hole
      const lad = AQ.Assets.sprites['tile.ladder'];
      for (let y = top - 4; y < L.floors[ld.floor]; y += 8) {
        if (lad) g.drawImage(lad.img, 0, 0, 16, Math.min(8, L.floors[ld.floor] - y), ld.x - 8, y, 16, Math.min(8, L.floors[ld.floor] - y));
        else { g.fillStyle = '#c8a050'; g.fillRect(ld.x - 6, y, 12, 2); }
      }
    });
    // ceiling lamps (warm) in every room
    L.floors.forEach((fy, i) => {
      const ceil = i === L.floors.length - 1 ? inner.y0 : L.floors[i + 1] + L.floorThick;
      for (let x = inner.x0 + 40; x < inner.x1 - 20; x += 96) { g.fillStyle = '#3a4a5a'; g.fillRect(x - 5, ceil, 10, 2); g.fillStyle = '#ffe6a8'; g.fillRect(x - 4, ceil + 2, 8, 1); }
    });
    // signs
    const sign = (x, y, text, col) => { const w = F().width(text) + 6; g.fillStyle = '#16283a'; g.fillRect(x - w / 2, y - 2, w, 9); g.fillStyle = col; g.fillRect(x - w / 2, y - 2, w, 1); F().draw(g, text, x, y, col, { align: 'center', shadow: false }); };
    sign(L.pad.x, L.floors[0] - 66, 'BEAM PAD', '#9feff0');
    sign(L.console.x, L.floors[0] - 66, 'DIRECTORY', '#ffe08a');
    sign(inner.x0 + 70, L.floors[2] - 70, 'AQUARIUM STATION', '#ffd0e0');
    // potted plants
    L.plants.forEach(([px, fl]) => {
      const fy = L.floors[fl];
      g.fillStyle = '#b4643a'; g.fillRect(px - 4, fy - 6, 8, 6); g.fillStyle = '#d07a48'; g.fillRect(px - 5, fy - 7, 10, 2);
      g.fillStyle = '#5fa04a'; for (let k = 0; k < 7; k++) g.fillRect(px - 5 + k * 1.6, fy - 9 - (k % 3) * 3, 1, 3 + (k % 3) * 2);
      g.fillStyle = '#8fd06a'; g.fillRect(px - 1, fy - 15, 1, 2); g.fillRect(px + 3, fy - 12, 1, 2);
    });
    // outside: antenna, solar wings and soft thrusters (the building floats)
    g.fillStyle = '#7a8696'; g.fillRect(300, h.y - 16, 2, 16); g.fillStyle = '#ff9fd0'; g.fillRect(299, h.y - 18, 4, 3);
    for (const [x0, dir] of [[h.x, -1], [h.x + h.w, 1]]) {
      g.fillStyle = '#6a7686'; g.fillRect(dir < 0 ? x0 - 18 : x0, h.y + 100, 18, 3);
      for (let k = 0; k < 2; k++) {
        const px = dir < 0 ? x0 - 18 - 30 : x0 + 18, py = h.y + 70 + k * 40;
        g.fillStyle = '#24407a'; g.fillRect(px, py, 30, 28);
        g.fillStyle = '#3a64a8'; for (let yy = py + 1; yy < py + 28; yy += 4) g.fillRect(px + 1, yy, 28, 1);
        for (let xx = px + 1; xx < px + 30; xx += 6) g.fillRect(xx, py + 1, 1, 26);
        g.fillStyle = '#8a96a6'; g.fillRect(px, py, 30, 1); g.fillRect(px, py + 27, 30, 1);
      }
      g.fillStyle = '#6a7686'; g.fillRect(dir < 0 ? x0 - 18 : x0, h.y + 84, 3, 40);
    }
  }

  // ---------------------------------------------------------------- drawing
  function drawSpace(ctx, left, top) {
    const sp = AQ.Assets.sprites['bg.space'], t = AQ.Render.t;
    if (sp) {
      const ox = -(((left * 0.15) % 320) + 320) % 320, oy = -(((top * 0.15) % 180) + 180) % 180;
      for (let x = ox; x < 320; x += 320) for (let y = oy; y < 180; y += 180) ctx.drawImage(sp.img, x, y);
    } else { ctx.fillStyle = '#0b0f26'; ctx.fillRect(0, 0, 320, 180); }
    const pr = AQ.Assets.sprites['bg.planet_ringed'], ps = AQ.Assets.sprites['bg.planet_small'];
    if (pr) ctx.drawImage(pr.img, Math.round(230 - left * 0.3 + 60), Math.round(30 - top * 0.3 + 40));
    if (ps) ctx.drawImage(ps.img, Math.round(40 - left * 0.25 + 30), Math.round(120 - top * 0.25 + 30));
    for (let i = 0; i < 14; i++) {                                         // a few twinkling stars on top
      const x = (i * 97 + 13) % 320, y = (i * 53 + 29) % 180, a = 0.5 + 0.5 * Math.sin(t * (1 + i % 3) + i);
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.8).toFixed(2)})`; ctx.fillRect(x, y, 1, 1);
    }
  }
  function drawTank(ctx, tk) {
    const frame = AQ.Assets.sprites['misc.tank_frame'], fw = 64, fh = 44, x0 = tk.x - fw / 2, y0 = tk.y - fh;
    const ix = x0 + 4, iy = y0 + 4, iw = fw - 8, ih = fh - 12, b = tk.b, tank = AQ.Collection.tank(b.id), t = AQ.Render.t;
    // the tank's own water + backdrop, cropped to the window
    const bd = AQ.Aquarium.backdropOf(b), sw = Math.round(bd.height * iw / ih);
    ctx.drawImage(bd, Math.round((bd.width - sw) / 2), 0, sw, bd.height, ix, iy, iw, ih);
    const st = AQ.Aquarium.styleOf(b.id);
    if (st.dark) { ctx.fillStyle = `rgba(2,6,16,${st.dark * 0.6})`; ctx.fillRect(ix, iy, iw, ih); }
    // its creatures, drifting about
    tank.creatures.slice(0, 7).forEach((e, k) => {
      const key = 'creature.' + e.id, en = AQ.Assets.entry(key), def = AQ.Creatures.defs[e.id];
      if (!en || !def) return;
      const sc = Math.min(0.6, 11 / Math.max(en.fw, en.fh));
      const u = String(e.uid), seed = (u.charCodeAt(0) + u.charCodeAt(u.length - 1) * 7 + k * 13) % 100;
      const crawl = def.category === 'crustacean' || def.category === 'gastropod' || def.tank === 'crawl' || def.tank === 'still';
      const sx = Math.sin(t * (0.25 + seed / 400) + seed), fx = ix + iw / 2 + sx * (iw / 2 - 7);
      const fy = crawl ? iy + ih - 4 : iy + 8 + ((seed * 3) % (ih - 16)) + Math.sin(t * 0.8 + seed) * 2;
      const facing = Math.cos(t * (0.25 + seed / 400) + seed) >= 0 ? 1 : -1;
      ctx.save(); ctx.translate(Math.round(fx), Math.round(fy)); ctx.scale(sc, sc);
      AQ.Assets.draw(ctx, key, 'idle', 0, 0, { t: t + k, flip: facing < 0 });
      ctx.restore();
    });
    if (!tank.creatures.length) F().draw(ctx, 'EMPTY', tk.x, iy + ih / 2 - 2, 'rgba(230,250,255,0.55)', { align: 'center', shadow: false });
    ctx.fillStyle = 'rgba(220,245,255,0.12)'; ctx.fillRect(ix + 2, iy + 1, 6, ih - 2);       // glass sheen
    if (frame) AQ.Assets.draw(ctx, 'misc.tank_frame', 'idle', tk.x, tk.y, {});
    // name above, star pips on the plate
    F().draw(ctx, (b.short || b.name).toUpperCase(), tk.x, y0 - 7, '#e8fbff', { align: 'center', shadow: 'rgba(4,12,24,0.8)' });
    if (!tk.v || t - tk.vT > 1) { tk.v = AQ.Vibe.evaluate(b.id); tk.vT = t; }   // refreshed once a second
    const v = tk.v;
    for (let i = 0; i < 5; i++) { ctx.fillStyle = v.stars >= i + 1 ? '#ffd25a' : v.stars >= i + 0.5 ? '#c8a050' : '#3a4a5a'; ctx.fillRect(tk.x - 10 + i * 4, tk.y - 4, 3, 2); }
  }

  St.draw = function (ctx, game) {
    if (!canvas) paint();
    if (!tanks.length) layoutTanks();
    const cam = AQ.Camera, left = cam.left(), top = cam.top(), t = AQ.Render.t, P = game.player;
    drawSpace(ctx, left, top);
    ctx.save(); ctx.translate(-left, -top);
    ctx.fillStyle = 'rgba(230,240,255,0.5)';
    for (const d of St.dust) { ctx.globalAlpha = Math.sin(d.t / d.life * Math.PI) * 0.6; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    ctx.globalAlpha = 1;
    // soft thruster glow under the building
    const h = L.hull;
    for (const x of [h.x + 120, h.x + h.w - 120]) { ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4 + x); ctx.fillStyle = '#9feff0'; ctx.fillRect(x - 6, h.y + h.h, 12, 3); ctx.globalAlpha *= 0.5; ctx.fillRect(x - 4, h.y + h.h + 3, 8, 4); }
    ctx.globalAlpha = 1;
    ctx.drawImage(canvas, 0, 0);
    // warm pools of lamp light
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    L.floors.forEach((fy, i) => {
      const ceil = i === L.floors.length - 1 ? h.y + h.thick : L.floors[i + 1] + L.floorThick;
      for (let x = h.x + h.thick + 40; x < h.x + h.w - h.thick - 20; x += 96) {
        ctx.globalAlpha = 0.05; ctx.fillStyle = '#ffd890';
        ctx.beginPath(); ctx.moveTo(x - 4, ceil + 3); ctx.lineTo(x + 4, ceil + 3); ctx.lineTo(x + 22, fy); ctx.lineTo(x - 22, fy); ctx.fill();
      }
    });
    ctx.restore();
    tanks.forEach((tk) => drawTank(ctx, tk));
    AQ.Assets.draw(ctx, 'misc.console', 'idle', L.console.x, L.floors[0], { t });
    AQ.Assets.draw(ctx, 'misc.beampad', 'idle', L.pad.x, L.floors[0] + 2, { t });
    // the pad's idle shimmer, brighter while beaming
    const beaming = St.mode !== 'walk';
    AQ.Hill.drawBeam(ctx, L.pad.x, L.floors[0] - 60, L.floors[0], (beaming ? 0.75 : 0.18) * AQ.TUNING.beam.glow * (0.85 + 0.15 * Math.sin(t * 3)));
    // the player (fades in / out while beaming)
    const a = St.mode === 'beamin' ? U.clamp(St.t / 0.8, 0, 1) : St.mode === 'beamout' ? U.clamp(1 - St.t / 0.5, 0, 1) : 1;
    ctx.globalAlpha = a; P.draw(ctx); ctx.globalAlpha = 1;
    AQ.FX.draw(ctx);
    ctx.restore();
    const n = St.mode === 'walk' && !AQ.Transition.active && nearby(P);
    if (n) AQ.Scenes.prompt(ctx, P.x - left, P.y - top - 22, n.text);
  };

  AQ.Scenes.register('station', St);
  return St;
})();
