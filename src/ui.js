// Canvas overlays: collection log, world map, pause menu. All drawn with the pixel font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.LogUI = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const L = { from: 'play', biomeIdx: 0, sel: 0, ui: [] };
  const sil = new Map();
  const CAT_LABEL = { fish: 'Fish', gastropod: 'Gastropod', crustacean: 'Crustacean', amphibian: 'Amphibian', cephalopod: 'Cephalopod', reptile: 'Reptile', mammal: 'Mammal', plant: 'Plant' };

  const biomes = () => {
    const order = ['tide_pools', 'coral', 'ruins', 'open_ocean', 'vents', 'trench', 'kelp', 'mangrove', 'ice', 'cave', 'lush_cave'];
    const all = AQ.World.biomes.slice();
    return all.sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99);
  };
  const entries = (b) => AQ.data.creatures.filter((d) => d.biome === b.id);

  L.open = function (game, from) {
    L.from = from || game.state;
    game.state = 'log';
    const here = from === 'aquarium' ? AQ.Aquarium.biome : from === 'title' || game.scene !== 'world' ? 'tide_pools' : AQ.World.biomeAt(game.player.x, game.player.y).id;
    L.biomeIdx = Math.max(0, biomes().findIndex((b) => b.id === here));
    L.sel = 0;
  };
  L.close = function (game) {
    if (L.from === 'title') { AQ.Title.open(game); return; }
    game.state = L.from === 'aquarium' ? 'aquarium' : 'play';
  };

  function layout() {
    const b = biomes()[L.biomeIdx], list = entries(b), ui = [];
    ui.push({ id: 'prev', x: 8, y: 16, w: 10, h: 10, label: '<' });
    ui.push({ id: 'next', x: 152, y: 16, w: 10, h: 10, label: '>' });
    ui.push({ id: 'close', x: 270, y: 3, w: 46, h: 10, label: 'CLOSE' });
    list.forEach((d, i) => ui.push({ id: 'cell', i, d, x: 8 + (i % 5) * 61, y: 30 + Math.floor(i / 5) * 47, w: 58, h: 44 }));
    return ui;
  }

  L.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, n = biomes().length;
    L.ui = layout();
    if (I.wasPressed('Escape', 'KeyL')) { L.close(game); return; }
    if (I.wasPressed('KeyQ', 'ArrowLeft', 'KeyA')) { L.biomeIdx = (L.biomeIdx + n - 1) % n; L.sel = 0; }
    if (I.wasPressed('KeyE', 'ArrowRight', 'KeyD')) { L.biomeIdx = (L.biomeIdx + 1) % n; L.sel = 0; }
    L.hover = L.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (L.hover && L.hover.id === 'cell') L.sel = L.hover.i;
    if (m.pressed[0] && L.hover) {
      if (L.hover.id === 'prev') { L.biomeIdx = (L.biomeIdx + n - 1) % n; L.sel = 0; }
      if (L.hover.id === 'next') { L.biomeIdx = (L.biomeIdx + 1) % n; L.sel = 0; }
      if (L.hover.id === 'close') L.close(game);
    }
  };

  function silhouette(key) {
    if (sil.has(key)) return sil.get(key);
    const e = AQ.Assets.entry(key); if (!e) return null;
    const c = document.createElement('canvas'); c.width = e.fw; c.height = e.fh;
    const x = c.getContext('2d');
    x.drawImage(AQ.Assets.sprites[key].img, 0, 0, e.fw, e.fh, 0, 0, e.fw, e.fh);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#0a1828'; x.fillRect(0, 0, e.fw, e.fh);
    sil.set(key, c);
    return c;
  }

  function wrap(text, max) {
    const words = text.toUpperCase().split(' '), lines = [];
    let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur);
    return lines;
  }

  L.draw = function (g) {
    const b = biomes()[L.biomeIdx], list = entries(b), prog = AQ.Collection.progress();
    g.fillStyle = 'rgba(5,14,26,0.94)'; g.fillRect(0, 0, 320, 180);
    F().draw(g, 'COLLECTION LOG', 8, 5, '#ffe9a8');
    const bred = AQ.data.creatures.filter((d) => ((AQ.State.log || {})[d.id] || {}).bred).length;
    F().draw(g, `DISCOVERED ${prog.discovered}/${prog.total}  COMPLETE ${prog.complete}/${prog.total}${bred ? '  BRED ' + bred : ''}`, 74, 5, '#9fd3ee');
    const got = list.filter((d) => AQ.Collection.has(d.id)).length, done = list.filter((d) => AQ.Sex.complete(d)).length;
    F().draw(g, `${b.name} ${got}/${list.length}`, 85, 18, done === list.length ? '#7ef0c0' : '#e8fbff', { align: 'center' });
    for (const r of L.ui) {
      if (r.id !== 'cell') { AQ.Aquarium.button(g, r, L.hover === r); continue; }
      const d = r.d, has = AQ.Collection.has(d.id), sel = r.i === L.sel;
      g.fillStyle = sel ? '#24506b' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
      if (sel) { g.fillStyle = '#5fc6d9'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
      const key = d.spriteKey || ((d.is_plant ? 'plant.' : 'creature.') + d.id), e = AQ.Assets.entry(key);
      if (e) {
        const sc = Math.min(1, 34 / e.fw, 32 / e.fh);
        g.save(); g.translate(r.x + r.w / 2, r.y + 19); g.scale(sc, sc);
        if (has) AQ.Assets.draw(g, key, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: performance.now() / 1000 });
        else { const s = silhouette(key); if (s) g.drawImage(s, -e.fw / 2, -e.fh / 2); }
        g.restore();
      }
      F().draw(g, has ? 'X' + AQ.State.collection[d.id] : '?', r.x + r.w - 3, r.y + 36, has ? '#ffe9a8' : '#6a8aa0', { align: 'right' });
      // ♂ / ♀ slots (lit once caught); animals only
      if (AQ.Sex.has(d)) {
        const L = (AQ.State.log || {})[d.id] || {};
        F().draw(g, '♂', r.x + 3, r.y + 36, L.m ? AQ.Sex.COLOR.m : '#2c4a5e', { shadow: false });
        F().draw(g, '♀', r.x + 8, r.y + 36, L.f ? AQ.Sex.COLOR.f : '#2c4a5e', { shadow: false });
      }
      if (AQ.Sex.complete(d)) { g.fillStyle = '#7ef0c0'; g.fillRect(r.x + r.w - 4, r.y + 2, 2, 2); }
      if (((AQ.State.log || {})[d.id] || {}).bred) F().draw(g, '♥', r.x + 3, r.y + 3, '#ff9fc0', { shadow: false });   // bred in a tank
      if (d.draft && !AQ.Sex.has(d)) F().draw(g, 'D', r.x + 3, r.y + 36, '#8aa4b8');
    }
    // details
    const d = list[L.sel];
    g.fillStyle = '#0d2236'; g.fillRect(4, 126, 312, 51);
    if (d) {
      const has = AQ.Collection.has(d.id);
      F().draw(g, has ? d.name : '???', 10, 130, has ? '#ffe9a8' : '#8aa4b8');
      const tags = [CAT_LABEL[d.category] || d.category, d.is_plant ? 'harvest' : '', d.requires_upgraded_net ? 'needs net lv2' : '',
        d.active === 'night' ? 'night only' : d.active === 'day' ? 'day only' : '', d.rare ? 'rare' : '', d.hostile ? 'hostile' : '', d.draft ? 'draft' : ''].filter(Boolean).join(' - ');
      F().draw(g, tags, 310, 130, '#9fd3ee', { align: 'right' });
      if (has && AQ.Sex.has(d)) {
        const L = (AQ.State.log || {})[d.id] || {};
        const txt = (AQ.Sex.complete(d) ? 'COMPLETE: BOTH ♂ AND ♀ CAUGHT' : `STILL TO FIND: ${L.m ? 'A FEMALE ♀' : 'A MALE ♂'}`) + (L.bred ? '   ♥ BRED IN YOUR AQUARIUM' : '');
        F().draw(g, txt, 10, 164, AQ.Sex.complete(d) ? '#7ef0c0' : '#ffcf8a');
      }
      wrap('Tip: ' + (d.active === 'night' ? 'Comes out at night. ' : d.active === 'day' ? 'Only out by day. ' : '') + (d.hint || ''), 75).slice(0, has && AQ.Sex.has(d) ? 3 : 4).forEach((l, i) => F().draw(g, l, 10, 140 + i * 8, '#d8eef8'));
    }
    F().draw(g, 'Q/E OR ARROWS: BIOME   ESC: CLOSE', 160, 173, '#5f7f96', { align: 'center' });
  };
  return L;
})();

AQ.MapUI = (function () {
  const F = () => AQ.Font;
  return {
    draw(g, game) {
      const mm = AQ.Terrain.minimap; if (!mm) return;
      const S = mm.scale, w = mm.canvas.width, h = mm.canvas.height;
      const ox = Math.round((320 - w) / 2), oy = 38;
      g.fillStyle = 'rgba(4,12,24,0.96)'; g.fillRect(0, 0, 320, 180);
      F().draw(g, 'MAP', 160, 10, '#ffe9a8', { align: 'center' });
      g.fillStyle = '#5fc6d9'; g.fillRect(ox - 1, oy - 1, w + 2, h + 2);
      g.drawImage(mm.canvas, ox, oy);
      // biome labels at open-water centroids, nudged apart
      const placed = [];
      mm.labels.slice().sort((p, q) => p.x - q.x).forEach((L) => {
        const text = (L.b.short || L.b.name).toUpperCase(), w = F().width(text);
        let x = Math.round(ox + L.x - w / 2), y = Math.round(oy + L.y - 2);
        x = Math.max(2, Math.min(318 - w, x));
        for (let k = 0; k < 8 && placed.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + 7 && y + 7 > r.y); k++) y += 7;
        placed.push({ x, y, w });
        F().draw(g, text, x, y, '#e8fbff', { shadow: 'rgba(0,0,0,0.9)' });
      });
      if (AQ.Chests) for (const c of AQ.Chests.list) { g.fillStyle = '#ffd56b'; g.fillRect(Math.round(ox + c.x / S) - 1, Math.round(oy + c.y / S) - 1, 2, 2); }
      const P = game.player;
      if (Math.floor(game.time * 4) % 2) { g.fillStyle = '#ff5a7a'; g.fillRect(Math.round(ox + P.x / S) - 1, Math.round(oy + P.y / S) - 1, 3, 3); }
      F().draw(g, 'YOU', ox + P.x / S, oy + P.y / S + 4, '#ff9fb0', { align: 'center' });
      F().draw(g, 'GOLD = CHESTS   M / ESC: CLOSE', 160, 160, '#8aa4b8', { align: 'center' });
    }
  };
})();

AQ.PauseUI = (function () {
  const F = () => AQ.Font;
  const P = { ui: [], confirm: 0 };
  P.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    P.confirm = Math.max(0, P.confirm - dt);
    P.ui = [
      { id: 'resume', x: 110, y: 60, w: 100, h: 14, label: 'RESUME' },
      { id: 'help', x: 110, y: 80, w: 100, h: 14, label: 'SHOW CONTROLS' },
      { id: 'home', x: 110, y: 100, w: 100, h: 14, label: 'HOME' },
      { id: 'reset', x: 110, y: 126, w: 100, h: 14, label: P.confirm > 0 ? 'CLICK AGAIN TO WIPE' : 'RESET SAVE' }
    ];
    if (I.wasPressed('Escape')) { game.state = 'play'; return; }
    P.hover = P.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (m.pressed[0] && P.hover) {
      if (P.hover.id === 'resume') game.state = 'play';
      if (P.hover.id === 'help') { AQ.HUD.helpT = 12; game.state = 'play'; }
      if (P.hover.id === 'home') { AQ.Save.save(game); AQ.Title.open(game); }
      if (P.hover.id === 'reset') { if (P.confirm > 0) AQ.Save.reset(); else P.confirm = 3; }
    }
  };
  P.draw = function (g) {
    g.fillStyle = 'rgba(4,12,24,0.75)'; g.fillRect(0, 0, 320, 180);
    F().draw(g, 'PAUSED', 160, 40, '#ffe9a8', { align: 'center' });
    for (const r of P.ui) AQ.Aquarium.button(g, r, P.hover === r);
    F().draw(g, 'PROGRESS SAVES AUTOMATICALLY', 160, 160, '#8aa4b8', { align: 'center' });
  };
  return P;
})();
