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
  AQ.Lang.onChange(() => { canvas = null; });           // the signs are painted into the background: repaint in the new language

  St.build = function () {
    L = AQ.data.station;
    const h = L.hull, T = h.thick;
    W = AQ.MiniWorld(L.width, L.height);
    W.fillRect(h.x, h.y, h.w, T);                                        // roof
    W.fillRect(h.x, h.y, T, h.h); W.fillRect(h.x + h.w - T, h.y, T, h.h); // side walls
    W.fillRect(h.x, L.floors[0], h.w, h.y + h.h - L.floors[0]);           // ground floor + underside
    const wg = L.wing;
    if (wg) {                                                            // the trophy wing off the ground floor
      W.fillRect(h.x + h.w - T, wg.top + T, T, L.floors[0] - wg.top - T, AQ.World.AIR);   // a doorway through the hull
      W.fillRect(wg.x, wg.top, wg.w, T);                                 // its roof...
      W.fillRect(wg.x + wg.w - T, wg.top, T, h.y + h.h - wg.top);        // ...end wall...
      W.fillRect(wg.x, L.floors[0], wg.w, h.y + h.h - L.floors[0]);      // ...and floor
    }
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
  St.zoneName = () => AQ.t('station.name');
  // the building's outline: the hull, plus the trophy wing
  St.bounds = () => { const h = L.hull, wg = L.wing; return { x: h.x, y: h.y, w: (wg ? Math.max(h.x + h.w, wg.x + wg.w) : h.x + h.w) - h.x, h: h.h }; };
  St.valid = (x, y) => { const b = St.bounds(); return W.standable(x, y) && W.boxHits(x, y + 3, 5, 4) && x > b.x + 10 && x < b.x + b.w - 10 && y > L.hull.y && y < L.floors[0]; };

  // tank slots straight from data/scenes.js (b = the tank def, or null for an empty slot)
  function layoutTanks() {
    tanks = L.tanks.map((t) => ({ x: t.x, floor: t.floor, y: L.floors[t.floor], b: t.tank ? AQ.Tanks.get(t.tank) : null }));
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
    if (fl === 0 && Math.abs(P.x - L.pad.x) < 13) return { kind: 'pad', text: AQ.t('station.beamDown') };
    if (fl === 0 && Math.abs(P.x - L.console.x) < 11) return { kind: 'console', text: AQ.t('station.directory') };
    if (fl === 0 && L.trophyWall && P.x > L.trophyWall.x0 + 4 && P.x < L.trophyWall.x1 - 4) return { kind: 'trophy', text: AQ.t('station.trophies') };
    const t = tanks.find((k) => k.b && k.floor === fl && Math.abs(P.x - k.x) < 26);
    if (t) return { kind: 'tank', tank: t, text: AQ.t('station.tend', { tank: (t.b.short || t.b.name).toUpperCase() }) };
    return null;
  }

  St.update = function (dt, game, input) {
    const P = game.player;
    St.t += dt;
    if (!tanks.length) layoutTanks();
    if (St.mode === 'walk') {
      if (input.wasPressed(AQ.TUNING.station.zoomKey)) St.toggleZoom();
      trophyHover();
      P.update(dt, W, input);
      const n = nearby(P);
      if (n && input.wasPressed(...AQ.TUNING.interactKeys)) {
        if (n.kind === 'pad') { St.mode = 'beamout'; St.t = 0; P.vx = 0; P.x = L.pad.x; }
        else if (n.kind === 'tank') { AQ.Aquarium.open(game, 'station', n.tank.b.id); return; }
        else if (n.kind === 'console') { AQ.Aquarium.open(game, 'station', AQ.Aquarium.biome || 'tide_pools'); AQ.Aquarium.openOverview(); return; }
        else if (n.kind === 'trophy') { AQ.LogUI.openBadges(game, 'play'); return; }      // the log's BADGES tab
      }
    } else if (St.mode === 'beamin' || St.mode === 'beamout') {
      P.t += dt; P.anim = 'stand';
      if (R.chance(dt * 18)) AQ.FX.sparkle(P.x + R.range(-6, 6), P.y + R.range(-14, 6), '#bff6ff', 2);
      if (St.mode === 'beamin' && St.t > 0.9) St.mode = 'walk';
      if (St.mode === 'beamout' && St.t > 0.5 && !St.leaving) { St.leaving = true; AQ.Scenes.go(game, 'hill', 'fromStation'); }
    }
    AQ.Camera.update(dt, P, W);
    if (zoomAmt >= 0) zoomAmt = U.approach(zoomAmt, St.zoomedOut() ? 1 : 0, dt / AQ.TUNING.station.zoomSeconds);
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
    const wg = L.wing;
    if (wg) {                                                             // the trophy wing: its shell (rounded outer corners) and inside
      const x1 = wg.x + wg.w, y1 = h.y + h.h, c = 10;
      g.save(); g.beginPath();
      g.moveTo(wg.x - 1, wg.top); g.lineTo(x1 - c, wg.top); g.arc(x1 - c, wg.top + c, c, -Math.PI / 2, 0);
      g.lineTo(x1, y1 - c); g.arc(x1 - c, y1 - c, c, 0, Math.PI / 2); g.lineTo(wg.x - 1, y1); g.closePath(); g.clip();
      g.fillStyle = pat('tile.station_hull', '#8a96a6'); g.fillRect(wg.x - 1, wg.top, wg.w + 1, y1 - wg.top);
      g.restore();
      g.fillStyle = pat('tile.station_wall', '#2c3e52'); g.fillRect(h.x + h.w - T, wg.top + T, x1 - T - (h.x + h.w - T), L.floors[0] - wg.top - T);
      g.fillStyle = 'rgba(255,210,120,0.06)'; g.fillRect(wg.x, wg.top + T, wg.w - T, L.floors[0] - wg.top - T);   // a warm, gallery-like glow
      g.save(); g.beginPath(); g.rect(h.x + h.w - 14, L.floors[0], 15, y1 - L.floors[0]); g.clip();               // (fill the hull's rounded corner where they join)
      g.fillStyle = pat('tile.station_hull', '#8a96a6'); g.fillRect(h.x + h.w - 14, L.floors[0], 15, y1 - L.floors[0]); g.restore();
      // the wall's wooden backing board and its shelves (the plaques are drawn live: src/station.js drawTrophyWall)
      const tw = L.trophyWall, rows = AQ.data.badgeGroups.filter((x) => x !== 'final').length;
      g.fillStyle = '#3a2a1e'; g.fillRect(tw.x0 - 3, tw.top - 3, tw.x1 - tw.x0 + 6, rows * tw.row + 4);
      g.fillStyle = '#4a3626'; g.fillRect(tw.x0 - 2, tw.top - 2, tw.x1 - tw.x0 + 4, rows * tw.row + 2);
      for (let r = 0; r < rows; r++) { g.fillStyle = '#7a5a3a'; g.fillRect(tw.x0 - 2, tw.top + r * tw.row + 6, tw.x1 - tw.x0 + 4, 1); g.fillStyle = '#2e2016'; g.fillRect(tw.x0 - 2, tw.top + r * tw.row + 7, tw.x1 - tw.x0 + 4, 1); }
    }
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
    L.floors.forEach((fy, fi) => {
      const xEnd = fi === 0 && L.wing ? L.wing.x + L.wing.w - T : inner.x1;   // (the ground floor runs on into the trophy wing)
      for (let x = inner.x0; x < xEnd; x += 32) {
        if (floorT) g.drawImage(floorT.img, 0, 0, Math.min(32, xEnd - x), 8, x, fy, Math.min(32, xEnd - x), 8);
        else { g.fillStyle = '#9aa8b4'; g.fillRect(x, fy, Math.min(32, xEnd - x), 8); }
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
    if (L.wing) { const lx = L.wing.x + L.wing.w / 2 - 4, ly = L.wing.top + T; g.fillStyle = '#3a4a5a'; g.fillRect(lx - 5, ly, 10, 2); g.fillStyle = '#ffe6a8'; g.fillRect(lx - 4, ly + 2, 8, 1); }
    // signs
    const sign = (x, y, text, col) => { const w = Math.min(F().width(text), 68) + 6; g.fillStyle = '#16283a'; g.fillRect(x - w / 2, y - 2, w, 9); g.fillStyle = col; g.fillRect(x - w / 2, y - 2, w, 1); F().draw(g, text, x, y, col, { align: 'center', shadow: false, max: 68 }); };   // signs stay narrow: a long name squeezes
    (L.signs || []).forEach(([id, sx, fl, col]) => sign(sx, L.floors[fl] - (fl === 0 ? 66 : 72), AQ.t(`sign.${id}`), col));
    // potted plants
    L.plants.forEach(([px, fl]) => {
      const fy = L.floors[fl];
      g.fillStyle = '#b4643a'; g.fillRect(px - 4, fy - 6, 8, 6); g.fillStyle = '#d07a48'; g.fillRect(px - 5, fy - 7, 10, 2);
      g.fillStyle = '#5fa04a'; for (let k = 0; k < 7; k++) g.fillRect(px - 5 + k * 1.6, fy - 9 - (k % 3) * 3, 1, 3 + (k % 3) * 2);
      g.fillStyle = '#8fd06a'; g.fillRect(px - 1, fy - 15, 1, 2); g.fillRect(px + 3, fy - 12, 1, 2);
    });
    // outside: antenna, solar wings and soft thrusters (the building floats)
    const ax = h.x + Math.round(h.w / 2);
    g.fillStyle = '#7a8696'; g.fillRect(ax, h.y - 16, 2, 16); g.fillStyle = '#ff9fd0'; g.fillRect(ax - 1, h.y - 18, 4, 3);
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
  function drawSpace(ctx, left, top, vw = 320, vh = 180) {
    const sp = AQ.Assets.sprites['bg.space'], t = AQ.Render.t;
    if (sp) {
      const ox = -(((left * 0.15) % 320) + 320) % 320, oy = -(((top * 0.15) % 180) + 180) % 180;
      for (let x = ox; x < vw; x += 320) for (let y = oy; y < vh; y += 180) ctx.drawImage(sp.img, x, y);
    } else { ctx.fillStyle = '#0b0f26'; ctx.fillRect(0, 0, vw, vh); }
    const pr = AQ.Assets.sprites['bg.planet_ringed'], ps = AQ.Assets.sprites['bg.planet_small'];
    if (pr) ctx.drawImage(pr.img, Math.round(230 - left * 0.3 + 60), Math.round(30 - top * 0.3 + 40));
    if (ps) ctx.drawImage(ps.img, Math.round(40 - left * 0.25 + 30), Math.round(120 - top * 0.25 + 30));
    for (let i = 0; i < 14; i++) {                                         // a few twinkling stars on top
      const x = (i * 97 + 13) % 320, y = (i * 53 + 29) % 180, a = 0.5 + 0.5 * Math.sin(t * (1 + i % 3) + i);
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.8).toFixed(2)})`; ctx.fillRect(x, y, 1, 1);
    }
    if (AQ.ShootingStars) AQ.ShootingStars.drawSpace(ctx, left, top);   // a streak outside the portholes
  }
  function drawTank(ctx, tk) {
    const frame = AQ.Assets.sprites['misc.tank_frame'], fw = 64, fh = 44, x0 = tk.x - fw / 2, y0 = tk.y - fh;
    const ix = x0 + 4, iy = y0 + 4, iw = fw - 8, ih = fh - 12, b = tk.b, t = AQ.Render.t;
    if (!b) {
      // an empty, unlit slot waiting for a future tank
      ctx.fillStyle = '#0a1420'; ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = 'rgba(160,200,230,0.06)'; ctx.fillRect(ix + 2, iy + 1, 6, ih - 2);
      if (frame) { ctx.globalAlpha = 0.6; AQ.Assets.draw(ctx, 'misc.tank_frame', 'idle', tk.x, tk.y, {}); ctx.globalAlpha = 1; }
      return;
    }
    const tank = AQ.Collection.tank(b.id), st = AQ.Aquarium.styleOf(b.id);
    // a calm, warm glow around a tank's window (the Nursery), so it's easy to spot from the walkway
    if (st.windowGlow) {
      const c = AQ.U.hex(st.windowGlow), a = AQ.U.calm() ? 0.22 : 0.2 + 0.04 * Math.sin(t * 0.9);
      const rg = ctx.createRadialGradient(tk.x, iy + ih / 2, 4, tk.x, iy + ih / 2, fw * 0.75);
      rg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`); rg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = rg; ctx.fillRect(tk.x - fw, y0 - 14, fw * 2, fh + 24);
    }
    // the tank's own water + backdrop, cropped to the window
    // (a bigger tank is wider than its window: the view pans slowly from one end to the other and back,
    // AQ.TUNING.station.windowPanSeconds; a size-0 tank shows its middle, as always)
    const bd = AQ.Aquarium.backdropOf(b), sw = Math.round(bd.height * iw / ih), spare = bd.width - sw, base = AQ.Tanks.width(b.id, 0) - sw;
    const pan = spare > base ? 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / AQ.TUNING.station.windowPanSeconds) : 0.5;
    ctx.drawImage(bd, Math.round(spare * pan), 0, sw, bd.height, ix, iy, iw, ih);
    if (st.dark) { ctx.fillStyle = `rgba(2,6,16,${st.dark * 0.6})`; ctx.fillRect(ix, iy, iw, ih); }
    // its creatures, drifting about
    tank.creatures.slice(0, 7 + 3 * AQ.Tanks.size(b.id)).forEach((e, k) => {   // (a bigger tank shows a few more)
      const def = AQ.Creatures.defs[e.id], juv = AQ.Breeding.isJuvenile(e);
      const key = !def ? 'creature.' + e.id : juv && AQ.Sex.babyKey(def, e.variant) ? AQ.Sex.babyKey(def, e.variant) : AQ.Sex.spriteKey(def, e.sex, e.variant), en = AQ.Assets.entry(key);
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
    (tank.eggs || []).slice(0, 5).forEach((egg, k) => {                    // eggs resting on the sand
      const ex = Math.round(ix + 8 + k * 9), ey = iy + ih - 4;
      ctx.fillStyle = 'rgba(40,30,20,0.5)'; ctx.fillRect(ex - 1, ey - 2, 4, 3);
      ctx.fillStyle = '#fff0dc'; ctx.fillRect(ex, ey - 2, 2, 2); ctx.fillRect(ex, ey - 3, 1, 1);
    });
    if (!tank.creatures.length && !(tank.eggs || []).length) F().draw(ctx, AQ.t('station.empty'), tk.x, iy + ih / 2 - 2, 'rgba(230,250,255,0.55)', { align: 'center', shadow: false });
    ctx.fillStyle = 'rgba(220,245,255,0.12)'; ctx.fillRect(ix + 2, iy + 1, 6, ih - 2);       // glass sheen
    if (frame) AQ.Assets.draw(ctx, 'misc.tank_frame', 'idle', tk.x, tk.y, {});
    // name above, star pips on the plate
    if (!noLabels) F().draw(ctx, AQ.Tanks.labelFor(b, 90), tk.x, y0 - 7, '#e8fbff', { align: 'center', shadow: 'rgba(4,12,24,0.8)', max: 90 });
    if (!tk.v || t - tk.vT > 1) { tk.v = AQ.Vibe.evaluate(b.id); tk.vT = t; }   // refreshed once a second
    const v = tk.v;
    if (v.nursery) {                                // no stars: how full it is (and a warning mark when it's full: breeding pauses)
      F().draw(ctx, `♥ ${AQ.Nursery.occupancy()}/${AQ.Nursery.capacity()}`, tk.x, tk.y - 6, AQ.Nursery.full() ? '#ffcf8a' : '#ffd8e8', { align: 'center', shadow: false });
      if (AQ.Nursery.full()) AQ.Nursery.drawWarning(ctx, ix + iw - 10, iy + 2, t);
      return;
    }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = v.stars >= i + 1 ? '#ffd25a' : v.stars >= i + 0.5 ? '#c8a050' : '#3a4a5a'; ctx.fillRect(tk.x - 10 + i * 4, tk.y - 4, 3, 2); }
  }

  // ---------------------------------------------------------------- optional zoomed-out view
  // V toggles between following the player and a view of the whole building (every tank at once).
  // You keep full control of the robot either way. Default + key: AQ.TUNING.station; the choice is saved.
  let zoomAmt = -1, full = null, noLabels = false;
  St.zoomedOut = () => {
    const s = AQ.State.settings;
    return s && s.stationZoomOut != null ? s.stationZoomOut : AQ.TUNING.station.zoomedOutByDefault;
  };
  St.toggleZoom = () => {
    AQ.State.settings = AQ.State.settings || {};
    AQ.State.settings.stationZoomOut = !St.zoomedOut();
    AQ.Save && AQ.Save.dirty();
  };
  const ease = (x) => x * x * (3 - 2 * x);

  // porthole centres (building space), for streaks passing outside
  St.portholes = () => (L ? L.windows : []).map(([wx, fl]) => ({ x: wx, y: L.floors[fl] - 50 }));
  St.draw = function (ctx, game) {
    if (!canvas) paint();
    if (!tanks.length) layoutTanks();
    const cfg = AQ.TUNING.station, want = St.zoomedOut() ? 1 : 0;
    if (zoomAmt < 0) zoomAmt = want;                                     // first frame: no animation
    const P = game.player, cam = AQ.Camera;
    if (zoomAmt <= 0) {
      renderScene(ctx, game, cam.left(), cam.top(), 320, 180);
      drawPrompt(ctx, P, cam.left(), cam.top(), 1);
      drawTrophyTip(ctx, cam.left(), cam.top());
    } else {
      // render the whole building once, then show a (scaled) window of it
      if (!full) { full = document.createElement('canvas'); full.width = L.width; full.height = L.height; }
      const fg = full.getContext('2d'); fg.imageSmoothingEnabled = false;
      noLabels = zoomAmt > 0.5;                                           // shrunk labels blur; redrawn crisp below
      renderScene(fg, game, 0, 0, L.width, L.height);
      noLabels = false;
      const h = St.bounds(), e = ease(zoomAmt);
      const fit = Math.min(320 / (h.w + cfg.zoomMargin * 2), 180 / (h.h + cfg.zoomMargin * 2));
      const z = U.lerp(1, fit, e);
      const cx = U.lerp(cam.x, h.x + h.w / 2, e), cy = U.lerp(cam.y, h.y + h.h / 2, e);
      const sw = 320 / z, sh = 180 / z;
      const sx = U.clamp(cx - sw / 2, 0, Math.max(0, L.width - sw)), sy = U.clamp(cy - sh / 2, 0, Math.max(0, L.height - sh));
      ctx.fillStyle = '#0b0f26'; ctx.fillRect(0, 0, 320, 180);
      ctx.save();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';   // soft downscale instead of dropped pixels
      ctx.drawImage(full, sx, sy, sw, sh, 0, 0, 320, 180);
      ctx.restore();
      if (zoomAmt > 0.5) {
        ctx.globalAlpha = U.clamp((zoomAmt - 0.5) * 3, 0, 1);
        // room for each label = distance to the nearest neighbouring slot on the same floor
        const room = (tk) => Math.min(...tanks.filter((o) => o !== tk && o.floor === tk.floor).map((o) => Math.abs(o.x - tk.x)), 200) * z - 4;
        tanks.filter((tk) => tk.b).forEach((tk) => F().draw(ctx, AQ.Tanks.labelFor(tk.b, room(tk)), Math.round((tk.x - sx) * z), Math.round((tk.y - 44 - sy) * z) - 7, '#e8fbff', { align: 'center', shadow: 'rgba(4,12,24,0.9)', max: room(tk) }));
        // a full nursery: its warning mark, crisp and full size over the shrunk building
        const nt = AQ.Nursery && AQ.Nursery.full() && tanks.find((tk) => tk.b && AQ.Nursery.is(tk.b.id));
        if (nt) AQ.Nursery.drawWarning(ctx, Math.round((nt.x - sx) * z) - 3, Math.round((nt.y - 44 - sy) * z) + 1, AQ.Render.t);
        if (L.wing) F().draw(ctx, AQ.t('sign.trophies'), Math.round((L.wing.x + L.wing.w / 2 - 4 - sx) * z), Math.round((L.trophyWall.top - 16 - sy) * z) - 4, '#ffe9a8', { align: 'center', shadow: 'rgba(4,12,24,0.9)', max: 70 });   // the trophy wing
        ctx.globalAlpha = 1;
      }
      drawPrompt(ctx, P, sx, sy, z);
    }
    if (St.mode === 'walk' && !AQ.Transition.active) {
      const F = AQ.Font, txt = AQ.t(St.zoomedOut() ? 'station.followRobot' : 'station.seeAll', { key: AQ.Keys.name('stationView') });
      const helpOn = AQ.HUD.showHelp && AQ.HUD.helpT > 0;              // above the controls hint while it's showing
      const touch = AQ.Touch && AQ.Touch.active();                     // (touch: centred, clear of the on-screen buttons in the corners)
      ctx.globalAlpha = 0.75; F.draw(ctx, txt, touch ? 160 : 316, helpOn ? 158 : 172, '#cfe8ff', { align: touch ? 'center' : 'right', shadow: 'rgba(4,12,24,0.85)', max: touch ? 180 : 312 }); ctx.globalAlpha = 1;
    }
  };
  function drawPrompt(ctx, P, left, top, z) {
    const n = St.mode === 'walk' && !AQ.Transition.active && nearby(P);
    if (n) AQ.Scenes.prompt(ctx, (P.x - left) * z, (P.y - top) * z - 10 - 12 * z, n.text);
  }

  // ---------------------------------------------------------------- the trophy wall (badges)
  // One shelf per badge group (data/achievements.js), a plaque for every badge earned (bronze / silver /
  // gold for a tiered one's highest tier) and a faint empty slot for each one still to come (hidden
  // badges only once earned; badges.trophyEmptySlots off hides the empty slots). Aquadise stands on top.
  // Plaques earned while you were away pop into place, with a little sparkle, when you next see the wall.
  function wallSlots() {
    const tw = L.trophyWall, B = AQ.Badges, out = [];
    if (!tw || !B) return out;
    const groups = AQ.data.badgeGroups.filter((x) => x !== 'final');
    groups.forEach((grp, r) => {
      const list = AQ.data.badges.filter((b) => b.group === grp), step = 6, w = list.length * step - 2;
      const x0 = Math.round((tw.x0 + tw.x1) / 2 - w / 2);
      list.forEach((b, k) => out.push({ b, x: x0 + k * step, y: tw.top + r * tw.row, w: 4, h: 5 }));
    });
    const fin = AQ.data.badges.find((b) => b.group === 'final');
    if (fin) out.push({ b: fin, x: tw.x0 + 2, y: tw.top - 14, w: 7, h: 9, big: true });   // the final goal: a cup on top, left of the sign
    return out;
  }
  const popping = new Map();                                               // id -> seconds since its pop started
  function drawTrophyWall(ctx, left, vw) {
    const B = AQ.Badges, tw = L.trophyWall;
    if (!B || !tw) return;
    const st = AQ.State.badges, shown = st.wall || (st.wall = {}), empty = AQ.TUNING.badges.trophyEmptySlots, calm = AQ.U.calm(), t = AQ.Render.t;
    const visible = tw.x1 > left - 4 && tw.x0 < left + vw + 4;
    let delay = 0;
    for (const s of wallSlots()) {
      const tier = B.tier(s.b.id), was = shown[s.b.id] || 0;
      if (tier > was && visible && !popping.has(s.b.id)) {                  // earned while you were away: pops in (one after another)
        popping.set(s.b.id, -delay); delay += 0.12; shown[s.b.id] = tier; AQ.Save && AQ.Save.dirty();
      }
      if (tier < was) shown[s.b.id] = tier;                                 // (reset by the testing keys)
      const p = popping.get(s.b.id);
      if (tier === 0 || (p != null && p < 0) || (tier > (shown[s.b.id] || 0))) {
        if (!(s.b.hidden && tier === 0) && empty) { ctx.fillStyle = 'rgba(255,240,200,0.10)'; ctx.fillRect(s.x, s.y, s.w, 1); ctx.fillRect(s.x, s.y + s.h - 1, s.w, 1); ctx.fillRect(s.x, s.y, 1, s.h); ctx.fillRect(s.x + s.w - 1, s.y, 1, s.h); }
        continue;
      }
      let k = 1;
      if (p != null) { k = Math.min(1, p / 0.35); if (p >= 0 && p - 1 / 60 < 0) AQ.FX.sparkle(s.x + s.w / 2, s.y + s.h / 2, '#ffe9a8', calm ? 2 : 6); }
      const col = s.b.tiers ? B.TIER_COL[Math.min(tier, 4) - 1] : '#ffd25a', w = Math.max(1, Math.round(s.w * k)), h = Math.max(1, Math.round(s.h * k));
      const x = Math.round(s.x + (s.w - w) / 2), y = Math.round(s.y + s.h - h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + 1, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
      if (k >= 1) {
        ctx.fillStyle = B.groupCol(s.b.group); ctx.fillRect(x + 1, y + 1, w - 2, s.big ? 4 : 2);   // the badge's little colour mark
        if (s.big) { ctx.fillStyle = col; ctx.fillRect(x - 1, y + 1, 1, 3); ctx.fillRect(x + w, y + 1, 1, 3); }   // cup handles
        if (!calm && (Math.floor(t * 0.7 + s.x * 0.37) % 9) === 0) { ctx.fillStyle = '#fffbe8'; ctx.fillRect(x, y, 1, 1); }   // a slow glint
      }
    }
    for (const [id, p] of popping) { const n = p + 1 / 60; if (n > 0.5) popping.delete(id); else popping.set(id, n); }
    // the count, top right of the wall
    const n = B.count();
    F().draw(ctx, `${n.earned}/${n.total}`, tw.x1, tw.top - 11, '#ffe9a8', { align: 'right', shadow: false });
  }
  // a tiny tooltip with the badge's name (mouse hover, or where a finger last tapped)
  let tipSlot = null;
  function trophyHover() {
    tipSlot = null;
    if (St.zoomedOut() || !L.trophyWall) return;
    const m = AQ.Input.mouse, wx = m.x + AQ.Camera.left(), wy = m.y + AQ.Camera.top(), B = AQ.Badges;
    for (const s of wallSlots()) {
      if (wx >= s.x - 1 && wx < s.x + s.w + 1 && wy >= s.y - 1 && wy < s.y + s.h + 1 && !(s.b.hidden && !B.earned(s.b.id))) { tipSlot = s; break; }
    }
  }
  function drawTrophyTip(ctx, left, top) {
    if (!tipSlot) return;
    const B = AQ.Badges, s = tipSlot, got = B.earned(s.b.id), text = (got ? B.name(s.b) : B.name(s.b, 1)).toUpperCase() + (got ? '' : '  ' + AQ.t('badge.notYet'));
    const w = Math.min(200, F().width(text) + 6), x = Math.round(U.clamp(s.x - left + s.w / 2 - w / 2, 2, 318 - w)), y = Math.round(s.y - top - 11);
    ctx.fillStyle = 'rgba(6,18,34,0.92)'; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = got ? '#ffd25a' : '#5fc6d9'; ctx.fillRect(x, y, w, 1);
    F().draw(ctx, text, x + 3, y + 2, got ? '#ffe9a8' : '#c3dfec', { shadow: false, max: w - 6 });
  }
  St.wallSlots = wallSlots;

  function renderScene(ctx, game, left, top, vw, vh) {
    const t = AQ.Render.t, P = game.player;
    drawSpace(ctx, left, top, vw, vh);
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
    drawTrophyWall(ctx, left, vw);
    AQ.Assets.draw(ctx, 'misc.console', 'idle', L.console.x, L.floors[0], { t });
    AQ.Assets.draw(ctx, 'misc.beampad', 'idle', L.pad.x, L.floors[0] + 2, AQ.U.calm() ? { frame: 0 } : { t });
    // the pad's idle shimmer, brighter while beaming
    const beaming = St.mode !== 'walk';
    // REDUCE FLASHING: the beam eases up instead of jumping bright, and doesn't pulse
    St.beamK = U.approach(St.beamK || 0.18, beaming ? (AQ.U.calm() ? 0.45 : 0.75) : 0.18, AQ.U.calm() ? 0.02 : 1);
    AQ.Hill.drawBeam(ctx, L.pad.x, L.floors[0] - 60, L.floors[0], St.beamK * AQ.TUNING.beam.glow * (AQ.U.calm() ? 0.85 : 0.85 + 0.15 * Math.sin(t * 3)));
    // the player (fades in / out while beaming)
    const a = St.mode === 'beamin' ? U.clamp(St.t / 0.8, 0, 1) : St.mode === 'beamout' ? U.clamp(1 - St.t / 0.5, 0, 1) : 1;
    ctx.globalAlpha = a; P.draw(ctx); ctx.globalAlpha = 1;
    AQ.FX.draw(ctx);
    ctx.restore();
  }

  AQ.Scenes.register('station', St);
  return St;
})();
