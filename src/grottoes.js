// Hidden grottoes: small secret rooms behind a patch of cracked rock, a couple in each part of the sea that
// reaches the surface. Swing the net at the crack and hold it there to pry the rock loose: it crumbles, and
// a little water-filled room opens behind it, with one of three things inside:
//   scene   a little scene: an old treasure corner, a crystal garden, a forgotten statue (softly lit)
//   plant   a plant of that region growing in the dark (harvest it like any other; it grows back next visit)
//   bottle  a message bottle with a letter someone left there (the log: NOTES > GROTTOES)
// Found grottoes stay open (saved) and are marked on the map; a Guide line explains the cracks.
//
// Placement is worked out once from the world, the same every time (seeded): only where solid rock is
// thick enough to hold a room (with a margin, so no room ever breaks into other water), with open water in
// front that you can reach from the start without any upgrade, away from chests and bottles.
// The rock stays solid until it's pried open; then the room is carved into the world and cut out of the
// terrain picture (and again after the seasons redraw it). Nothing can spawn inside a closed grotto.
// Saved: AQ.State.grottoes = { found: { index: 1 }, letters: { index: 1 } } (numbers only).
// Tuning: AQ.TUNING.grottoes. Text: grotto.* and grotto.letter.<region>.* in data/lang/en.js.
// LANG_PREFIX: 'grotto.letter.'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Grottoes = (function () {
  const U = AQ.U;
  const G = { list: [], pry: null, plants: [] };
  const cfg = () => AQ.TUNING.grottoes;
  const st = () => { const s = AQ.State.grottoes = AQ.State.grottoes && typeof AQ.State.grottoes === 'object' ? AQ.State.grottoes : {}; s.found = s.found || {}; s.letters = s.letters || {}; return s; };
  G.isOpen = (g) => !!st().found[g.i];
  G.foundCount = () => G.list.filter(G.isOpen).length;

  // ---------------------------------------------------------------- where they are
  const SCENES = [['barrel', 'treasure', 'amphora'], ['cave_crystals', 'geode', 'glow_stone'], ['seashell', 'statue_head', 'broken_column']];   // (decoration ids)
  // A grotto lies behind a rock face, sideways into a wall (dx = +-1) or down into the seabed (dy = 1): the
  // crack is on the face at (fx, fy), the room's centre (cx, cy) a plug's thickness and a room's half-size in.
  G.init = function () {
    const W = AQ.World, C = cfg(), rng = U.rng((AQ.data.world.seed || 1) * 31 + 7), canReach = AQ.Bottles && AQ.Bottles.reachable ? AQ.Bottles.reachable() : () => true;
    const lim = AQ.TUNING.upgrades.depthLimitY[0] - 12, avoid = [];
    if (AQ.Chests) AQ.Chests.list.forEach((c) => avoid.push([c.x, c.y]));
    if (AQ.Bottles) AQ.Bottles.list.forEach((b) => avoid.push([b.x, b.y]));
    G.list = [];
    const regions = AQ.data.world.biomes.filter((b) => b.rect[1] === 0 && AQ.data.weather && AQ.data.weather.regions[b.id]);
    const solidIn = (cx, cy, rx, ry) => {                          // every pixel of this ellipse (and its margin) is rock
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue;
        if (!W.solid(cx + x, cy + y)) return false;
      }
      return true;
    };
    // a face here, in this direction? -> the grotto, or null
    const fits = (b, x, y, dx, dy) => {
      const fx = x + dx, fy = y + dy;
      if (!W.solid(fx, fy) || !W.water(x, y) || !W.water(x - dx * 6, y - dy * 6) || !canReach(x - dx * 4, y - dy * 4)) return null;
      // the face must be a flat-ish wall / floor across the crack
      for (let k = -4; k <= 4; k += 4) if (!W.solid(fx + dy * k, fy + dx * k)) return null;
      const rx = C.room[0], ry = C.room[1], cx = fx + dx * (C.plug + rx), cy = fy + dy * (C.plug + ry);
      if (!solidIn(cx, cy, rx + C.margin, ry + C.margin)) return null;
      const h = Math.ceil(C.plug / 2);                              // (the plug: rock all the way from the face to the room)
      if (!solidIn(fx + dx * (h + 1), fy + dy * (h + 1), dx ? h : C.plugH + 2, dy ? h : C.plugH + 2)) return null;
      if ((W.biomeAt(cx, cy) || {}).id !== b.id || avoid.some(([ax, ay]) => Math.hypot(ax - cx, ay - cy) < C.awayFrom)) return null;
      return { biome: b.id, fx, fy, dx, dy, cx, cy };
    };
    regions.forEach((b) => {
      const cands = [];
      for (let x = b.rect[0] + 24; x < b.rect[0] + b.rect[2] - 24; x += 6) {
        for (let y = W.sea + 20; y < lim; y += 2) {
          if (!W.water(x, y)) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) { const g = fits(b, x, y, dx, dy); if (g) cands.push(g); }
        }
      }
      let made = 0;
      for (let tries = 0; tries < 400 && made < C.perRegion && cands.length; tries++) {
        const g = cands[Math.floor(rng.range(0, cands.length))];
        if (G.list.some((o) => Math.hypot(o.cx - g.cx, o.cy - g.cy) < C.apart)) continue;
        const i = G.list.length;
        G.list.push(Object.assign(g, { i, kind: C.kinds[i % C.kinds.length], scene: SCENES[i % SCENES.length] }));
        made++;
      }
    });
    G.list.forEach((g) => { if (G.isOpen(g)) open(g, true); });
  };

  // ---------------------------------------------------------------- opening one
  // carve the room (and the plug of rock in front of it) into the world, and out of the terrain picture
  function carve(g) {
    const W = AQ.World, C = cfg(), rx = C.room[0], ry = C.room[1];
    const inRoom = (x, y) => ((x - g.cx) * (x - g.cx)) / (rx * rx) + ((y - g.cy) * (y - g.cy)) / (ry * ry) <= 1;
    const P = plugRect(g), x0 = Math.min(P.x, g.cx - rx) - 1, x1 = Math.max(P.x + P.w, g.cx + rx) + 1, y0 = Math.min(P.y, g.cy - ry), y1 = Math.max(P.y + P.h, g.cy + ry);
    const inPlug = (x, y) => x >= P.x && x < P.x + P.w && y >= P.y && y < P.y + P.h;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inRoom(x, y) || inPlug(x, y)) W.mask[y * W.w + x] = 0;   // (0 = water)
    cutPicture(g);
  }
  // the plug of rock between the face and the room
  function plugRect(g) {
    const C = cfg();
    if (g.dx) { const x = Math.min(g.fx, g.cx); return { x, y: g.fy - C.plugH, w: Math.abs(g.cx - g.fx) + 1, h: C.plugH * 2 + 1 }; }
    return { x: g.fx - C.plugH, y: g.fy, w: C.plugH * 2 + 1, h: g.cy - g.fy + 1 };
  }
  function cutPicture(g) {
    const C = cfg(), rx = C.room[0], ry = C.room[1];
    for (const ch of AQ.Terrain.chunks) {
      if (g.cx + rx + C.plug < ch.x || g.cx - rx - C.plug > ch.x + ch.w || g.cy + ry + C.plug < ch.y || g.cy - ry - C.plug > ch.y + ch.h) continue;
      [ch.canvas, ch.front].forEach((cv) => {
        if (!cv) return;
        const c = cv.getContext('2d'), ox = g.cx - ch.x, oy = g.cy - ch.y, P = plugRect(g);
        c.save(); c.globalCompositeOperation = 'destination-out';
        c.beginPath(); c.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2); c.fill();
        c.fillRect(P.x - ch.x, P.y - ch.y, P.w, P.h);
        c.restore();
        if (cv === ch.canvas) {                                      // a darker rim inside the rock
          c.save(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
          c.beginPath(); c.ellipse(ox, oy, rx + 0.5, ry + 0.5, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        }
      });
    }
  }
  G.recut = () => G.list.forEach((g) => { if (G.isOpen(g)) cutPicture(g); });   // (after the seasons redraw the terrain)
  function open(g, quiet) {
    carve(g);
    if (g.kind === 'plant') growPlant(g);
    if (quiet) return;
    st().found[g.i] = 1;
    for (let k = 0; k < 18; k++) AQ.FX.puff(g.fx + U.R.range(-6, 6), g.fy + U.R.range(-6, 6), 'rgba(190,180,160,0.7)', 2);
    AQ.Audio.play('chest');
    if (AQ.HUD) AQ.HUD.toast(AQ.t('grotto.found'), '#ffe9a8', 5);
    if (AQ.Badges) AQ.Badges.addTo('grottoes', String(g.i));
    if (AQ.Save) AQ.Save.dirty();
  }
  function growPlant(g) {
    const plants = AQ.data.creatures.filter((d) => d.is_plant && d.biome === g.biome && !d.season && !d.bloom);
    const def = plants.length ? plants[g.i % plants.length] : null;
    if (!def || !AQ.Creatures) { g.kind = 'scene'; return; }
    const W = AQ.World, x = g.cx;
    let y = g.cy;
    while (y < g.cy + cfg().room[1] + 2 && !W.solid(x, y + 1)) y++;
    const c = AQ.Creatures.spawnAt(AQ.Creatures.defs[def.id] || def, x, y);
    if (c) G.plants.push(c);
  }
  // the net held on a crack (src/catching.js asks): true while it's prying one
  G.pryAt = function (net, dt) {
    const g = G.list.find((x) => !G.isOpen(x) && Math.hypot(x.fx - net.x, x.fy - net.y) < net.r + 8);
    if (!g) { if (G.pry) G.pry.p = 0; G.pry = null; return false; }
    if (!G.pry || G.pry.g !== g) G.pry = { g, p: 0 };
    G.pry.p += dt / cfg().pryTime;
    if (U.R.chance(dt * 12)) AQ.FX.puff(g.fx, g.fy + U.R.range(-6, 6), 'rgba(200,190,170,0.6)', 1);
    if (G.pry.p >= 1) { G.pry = null; open(g, false); }
    return true;
  };

  // ---------------------------------------------------------------- each frame
  G.update = function (dt, game) {
    if (game.scene !== 'world' || game.state !== 'play') return;
    const P = game.player;
    // a grotto's bottle: swim into it to take the letter
    for (const g of G.list) {
      if (g.kind !== 'bottle' || !G.isOpen(g) || st().letters[g.i]) continue;
      const b = bottleAt(g);
      if (Math.hypot(P.x - b.x, P.y - b.y) < 12) {
        st().letters[g.i] = 1;
        AQ.Audio.play('bottle');
        if (AQ.HUD) AQ.HUD.toast(AQ.t('grotto.letterFound'), '#ffe9a8', 5);
        if (AQ.Save) AQ.Save.dirty();
      }
    }
  };
  const bottleAt = (g) => ({ x: g.cx, y: g.cy + cfg().room[1] - 4 });
  // the letters you've found (the log's NOTES > GROTTOES)
  G.letters = () => G.list.filter((g) => g.kind === 'bottle' && st().letters[g.i]).map((g) => ({ id: 'grotto:' + g.biome, region: g.biome, name: '', sighting: true }));
  (function lore() {
    const L = AQ.data.lore = AQ.data.lore || {};
    G.ensureLore = function () {
      AQ.data.world.biomes.forEach((b) => {
        const key = `grotto.letter.${b.id}`;
        if (L['grotto:' + b.id] || AQ.langFiles.en[`${key}.title`] == null) return;
        const o = {};
        Object.defineProperty(o, 'title', { get: () => AQ.t(`${key}.title`), enumerable: true });
        Object.defineProperty(o, 'sci', { get: () => AQ.t('grotto.letterFrom', { place: (b.short || b.name || '').toUpperCase() }), enumerable: true });
        Object.defineProperty(o, 'lines', { get: () => [1, 2, 3].map((n) => AQ.t(`${key}.${n}`)), enumerable: true });
        L['grotto:' + b.id] = o;
      });
    };
  })();

  // ---------------------------------------------------------------- drawing
  // behind the creatures: the crack on a closed grotto, the inside of an open one
  G.draw = function (ctx, game) {
    const cam = AQ.Camera, l = cam.left(), t = cam.top(), C = cfg(), time = AQ.Render.t;
    for (const g of G.list) {
      if (g.cx < l - 60 || g.cx > l + cam.w + 60 || g.cy < t - 40 || g.cy > t + cam.h + 40) continue;
      if (!G.isOpen(g)) {
        // the crack: a bold dark zigzag along the rock face with fissures running in, lighter chips, a few
        // loose pebbles on top, and now and then a faint glint
        const along = (k, depth) => [g.fx + (g.dx ? g.dx * depth : k), g.fy + (g.dx ? k : g.dy * depth)];
        const dot = (k, d, col) => { const [x, y] = along(k, d); ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
        for (let k = -C.plugH - 1; k <= C.plugH + 1; k++) { const z = [1, 2, 3, 2][(k + 8 + g.i) % 4]; dot(k, z, 'rgba(8,10,16,0.85)'); dot(k, z + 1, 'rgba(8,10,16,0.45)'); }
        for (const k0 of [-4, 0, 4]) for (let d = 3; d < 7; d++) dot(k0 + ((d + g.i) % 2), d, 'rgba(8,10,16,0.7)');
        for (let k = -C.plugH; k <= C.plugH; k += 2) dot(k, 1 + ((k + g.i) & 1) * 3, 'rgba(230,220,200,0.45)');
        for (const k of [-5, -1, 3]) dot(k, -1, 'rgba(150,140,128,0.95)');           // loose pebbles at the face
        const glint = U.calm() ? 0.5 : Math.max(0, Math.sin(time * 0.9 + g.i * 1.7)) ** 6;
        if (glint > 0.05) { const [x, y] = along(0, 2); ctx.fillStyle = `rgba(255,250,220,${(0.9 * glint).toFixed(3)})`; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
        if (G.pry && G.pry.g === g) { ctx.fillStyle = 'rgba(255,233,168,0.9)'; ctx.fillRect(g.fx - 6, g.fy - C.plugH - 5, Math.round(12 * G.pry.p), 2); }   // how far it's prised
        continue;
      }
      // inside: a little shade, then what it holds
      ctx.fillStyle = 'rgba(0,12,24,0.22)';
      ctx.beginPath(); ctx.ellipse(g.cx, g.cy, C.room[0] - 1, C.room[1] - 1, 0, 0, Math.PI * 2); ctx.fill();
      const floor = g.cy + C.room[1] - 2;
      if (g.kind === 'scene') g.scene.forEach((id, k) => { if (AQ.Assets.entry('decor.' + id)) AQ.Assets.draw(ctx, 'decor.' + id, 'idle', g.cx + (k - 1) * 9, floor - (k === 1 ? 1 : 0)); });
      if (g.kind === 'bottle' && !st().letters[g.i]) { const b = bottleAt(g); AQ.Assets.draw(ctx, 'misc.bottle', 'idle', b.x, b.y, { t: time }); }
    }
  };
  // a soft light inside each open grotto (it glows a little in the dark)
  G.lights = function (L) { for (const g of G.list) if (G.isOpen(g)) L.push({ x: g.cx, y: g.cy, r: 22, color: g.kind === 'scene' ? '#ffe9b0' : '#bff0ff', power: 0.55 }); };
  // the map: found grottoes marked
  G.drawMap = function (g, ox, oy, S) {
    for (const gr of G.list) if (G.isOpen(gr)) { g.fillStyle = '#7ff0e0'; g.fillRect(Math.round(ox + gr.cx / S) - 1, Math.round(oy + gr.cy / S) - 1, 2, 2); }
  };
  return G;
})();
