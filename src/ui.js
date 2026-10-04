// Canvas overlays: collection log, world map, pause menu. All drawn with the pixel font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.LogUI = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const L = { from: 'play', tab: 'species', biomeIdx: 0, sel: 0, scroll: 0, vsel: 0, vscroll: 0, nsel: 0, nscroll: 0, entry: null, ui: [],
    sy: 0, vsy: 0, nsy: 0 };   // scroll / vscroll / nscroll: target offsets in px; sy / vsy / nsy: the eased offsets drawn
  const TABS = [['species', 'SPECIES', 42], ['variants', 'VARIANTS', 46], ['notes', 'NOTES', 34]];
  // one look for every tab: header bar (title, tabs, bottles, close), a context row, the content, a footer hint
  const C = { bg: '#06101c', bar: '#0b1a2c', line: '#1c3a52', panel: '#0d2236', title: '#ffe9a8', text: '#d8eef8', dim: '#8aa4b8', info: '#9fd3ee', hint: '#4f6f86', good: '#7ef0c0', warn: '#ffcf8a', gold: '#ffd25a' };
  const COLS = 5, CELL_H = 47, HEAD_H = 10, VIEW_H = 94;            // species grid area (y 30..124)
  const VCOLS = 4, VROW_H = 33, VVIEW_H = 110;                      // variants cards area (y 30..140)
  const NROW_H = 10, NVIEW_H = 134;                                  // notes list (left column, y 30..164)
  const WHEEL = 0.3;                                                 // px scrolled per px of wheel / trackpad movement
  const sil = new Map();
  const CAT_LABEL = { fish: 'Fish', gastropod: 'Gastropod', crustacean: 'Crustacean', amphibian: 'Amphibian', cephalopod: 'Cephalopod', reptile: 'Reptile', mammal: 'Mammal', plant: 'Plant' };
  const logOf = (id) => (AQ.State.log || {})[id] || {};

  const biomes = () => {
    const order = ['tide_pools', 'coral', 'ruins', 'open_ocean', 'vents', 'trench', 'kelp', 'mangrove', 'ice', 'cave', 'lush_cave'];
    const all = AQ.World.biomes.slice();
    // special tanks (Starfall) get a page of their own, after the sea biomes
    return all.sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99).concat(AQ.data.specialTanks || []);
  };
  // a biome's species, with each family (AQ.data.families) kept together where its first member is
  const entries = (b) => {
    const out = [], seen = {};
    for (const d of AQ.data.creatures) {
      if (d.biome !== b.id) continue;
      if (!d.family) { out.push(d); continue; }
      if (seen[d.family]) continue;
      seen[d.family] = true;
      AQ.data.creatures.forEach((x) => { if (x.family === d.family && x.biome === b.id) out.push(x); });
    }
    return out;
  };
  // species that have a rare colour variant slot: rare colours only come from bred babies, so only
  // species that can breed (animals with sexes) have one; plants and sexless species don't
  L.hasVariant = (d) => !d.is_plant && AQ.Sex.has(d);
  L.variantProgress = () => {
    const all = AQ.data.creatures.filter(L.hasVariant);
    return { got: all.filter((d) => logOf(d.id).variant).length, total: all.length };
  };

  // ---------------------------------------------------------------- rows (shared by the grids)
  // rows of the species grid: family headings ('head') and rows of up to COLS cells ('cells')
  function rowsOf(list) {
    const rows = [];
    let i = 0;
    while (i < list.length) {
      const fam = list[i].family;
      const rest = list.slice(i), nf = rest.findIndex((d) => d.family);
      const n = fam ? rest.findIndex((d) => d.family !== fam) < 0 ? rest.length : rest.findIndex((d) => d.family !== fam) : nf < 0 ? rest.length : nf;
      if (fam) { const fl = rest.slice(0, n); rows.push({ type: 'head', h: HEAD_H, label: ((AQ.data.families[fam] || {}).label || fam).toUpperCase(), count: `${fl.filter((d) => AQ.Collection.has(d.id)).length}/${fl.length}` }); }
      for (let k = 0; k < n; k += COLS) rows.push({ type: 'cells', h: CELL_H, items: list.slice(i + k, i + Math.min(n, k + COLS)).map((d, j) => ({ d, i: i + k + j })) });
      i += n;
    }
    return rows;
  }
  // rows of the variants list: a heading per biome, then rows of VCOLS entries
  function variantRows() {
    const rows = [];
    let i = 0;
    biomes().forEach((b) => {
      const list = entries(b).filter(L.hasVariant);
      if (!list.length) return;
      rows.push({ type: 'head', h: HEAD_H, label: (b.short || b.name).toUpperCase(), count: `${list.filter((d) => logOf(d.id).variant).length}/${list.length}` });
      for (let k = 0; k < list.length; k += VCOLS) rows.push({ type: 'cells', h: VROW_H, items: list.slice(k, k + VCOLS).map((d) => ({ d, i: i++ })) });
    });
    return rows;
  }
  // rows of the notes list: a heading per biome, then one row per found note
  function noteRows() {
    const rows = [];
    let i = 0;
    biomes().forEach((b) => {
      const all = entries(b).filter((d) => AQ.data.lore[d.id]), list = all.filter((d) => AQ.Bottles && AQ.Bottles.isFound(d.id));
      if (!list.length) return;
      rows.push({ type: 'head', h: HEAD_H, label: (b.short || b.name).toUpperCase(), count: `${list.length}/${all.length}` });
      list.forEach((d) => rows.push({ type: 'cells', h: NROW_H, items: [{ d, i: i++ }] }));
    });
    return rows;
  }
  // Lists scroll by pixels: the target offset moves in steps (wheel, keys, arrows) and the drawn
  // offset glides after it, so rows slide in and out under a clip instead of jumping.
  const tops = (rows) => { const t = []; let y = 0; rows.forEach((r) => { t.push(y); y += r.h; }); t.push(y); return t; };
  const maxScroll = (rows, view) => Math.max(0, tops(rows)[rows.length] - view);
  // scroll just enough that entry `sel` (and the heading right above it) is in view
  function reveal(rows, sel, scroll, view) {
    const r = rows.findIndex((row) => row.type === 'cells' && row.items.some((it) => it.i === sel));
    if (r < 0) return scroll;
    const t = tops(rows), top = r > 0 && rows[r - 1].type === 'head' ? t[r - 1] : t[r], bottom = t[r] + rows[r].h;
    if (top < scroll) scroll = top;
    if (bottom > scroll + view) scroll = bottom - view;
    return U.clamp(scroll, 0, maxScroll(rows, view));
  }
  // move the selection one cell row up/down (same column), scrolling so it stays visible
  function stepRows(rows, sel, scroll, d, view) {
    const r0 = rows.findIndex((r) => r.type === 'cells' && r.items.some((it) => it.i === sel));
    let r = r0 + d;
    while (r >= 0 && r < rows.length && rows[r].type !== 'cells') r += d;
    if (r0 < 0 || r < 0 || r >= rows.length) return [sel, scroll];
    const col = rows[r0].items.findIndex((it) => it.i === sel);
    sel = rows[r].items[Math.min(col, rows[r].items.length - 1)].i;
    return [sel, reveal(rows, sel, scroll, view)];
  }
  // lay out the rows visible at offset `cur` inside the band top..top+view; place(row, y) adds items
  function placeRows(ui, rows, cur, top, view, place) {
    const t = tops(rows), off = Math.round(cur), clip = { y0: top, y1: top + view };
    rows.forEach((row, r) => {
      const y = top + t[r] - off;
      if (y + row.h <= top || y >= top + view) return;
      const n = ui.length; place(row, y);
      for (let k = n; k < ui.length; k++) ui[k].clip = clip;
    });
  }

  // ---------------------------------------------------------------- open / close
  L.open = function (game, from) {
    AQ.Audio.play('log_open');
    if (AQ.Dive) AQ.Dive.event('log');
    L.from = from || game.state;
    game.state = 'log';
    const here = from === 'aquarium' ? AQ.Aquarium.biome : from === 'title' || game.scene !== 'world' ? 'tide_pools' : AQ.World.biomeAt(game.player.x, game.player.y).id;
    L.biomeIdx = Math.max(0, biomes().findIndex((b) => b.id === here));
    L.sel = 0; L.scroll = 0; L.sy = 0; L.entry = null;
  };
  L.close = function (game) {
    AQ.Audio.play('log_close');
    if (AQ.Tips) AQ.Tips.event('logClosed');      // its tip waits until you're back out (no tips inside menus)
    if (L.from === 'title') { AQ.Title.open(game); return; }
    game.state = L.from === 'aquarium' ? 'aquarium' : 'play';
  };
  function setTab(t) { if (t === L.tab) return; L.tab = t; AQ.Audio.play('page_turn'); }
  function openEntry(d) { L.entry = d; AQ.Audio.play('page_turn'); }
  // entry page < >: the previous / next species in this biome; the list's selection follows along
  function stepEntry(k) {
    const list = entries(biomes()[L.biomeIdx]);
    if (list.length < 2) return;
    L.sel = (L.sel + k + list.length) % list.length; L.entry = list[L.sel];
    L.scroll = reveal(rowsOf(list), L.sel, L.scroll, VIEW_H);
    AQ.Audio.play('menu_move');
  }
  function setBiome(k) { const n = biomes().length; L.biomeIdx = (L.biomeIdx + k + n) % n; L.sel = 0; L.scroll = 0; L.sy = 0; AQ.Audio.play('page_turn'); }

  // ---------------------------------------------------------------- layout
  function layout() {
    const ui = [];
    ui.push({ id: 'close', x: 280, y: 2, w: 36, h: 10, label: 'CLOSE' });
    let tx = 68;
    for (const [id, label, w] of TABS) { ui.push({ id: 'tab', tab: id, x: tx, y: 2, w, h: 10, label, on: L.tab === id }); tx += w + 2; }
    if (L.entry) {                                                    // entry page: browse the biome's species
      ui.push({ id: 'eprev', x: 268, y: 20, w: 10, h: 10, label: '<' });
      ui.push({ id: 'enext', x: 302, y: 20, w: 10, h: 10, label: '>' });
      return ui;
    }
    if (L.tab === 'species') {
      const b = biomes()[L.biomeIdx], list = entries(b);
      // biome picker: < NAME > then one dot per biome (click a dot to jump there)
      ui.push({ id: 'prev', x: 4, y: 17, w: 10, h: 10, label: '<' });
      ui.push({ id: 'next', x: 104, y: 17, w: 10, h: 10, label: '>' });
      biomes().forEach((bb, k) => ui.push({ id: 'dot', k, b: bb, x: 119 + k * 7, y: 17, w: 7, h: 10 }));
      const rows = rowsOf(list), maxS = maxScroll(rows, VIEW_H);
      L.scroll = U.clamp(L.scroll, 0, maxS);
      placeRows(ui, rows, L.sy, 30, VIEW_H, (row, y) => {
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 302, h: HEAD_H - 2, label: row.label, count: row.count });
        else row.items.forEach((it, c) => ui.push({ id: 'cell', i: it.i, d: it.d, x: 8 + c * 61, y, w: 58, h: CELL_H - 3 }));
      });
      if (L.scroll > 0) ui.push({ id: 'up', x: 311, y: 30, w: 8, h: 9, label: '' });
      if (L.scroll < maxS) ui.push({ id: 'down', x: 311, y: 115, w: 8, h: 9, label: '' });
    } else if (L.tab === 'variants') {
      const rows = variantRows(), maxS = maxScroll(rows, VVIEW_H);
      L.vscroll = U.clamp(L.vscroll, 0, maxS);
      placeRows(ui, rows, L.vsy, 30, VVIEW_H, (row, y) => {
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 302, h: HEAD_H - 2, label: row.label, count: row.count });
        else row.items.forEach((it, c) => ui.push({ id: 'vcell', i: it.i, d: it.d, x: 8 + c * 76, y, w: 74, h: VROW_H - 3 }));
      });
      if (L.vscroll > 0) ui.push({ id: 'up', x: 311, y: 30, w: 8, h: 9, label: '' });
      if (L.vscroll < maxS) ui.push({ id: 'down', x: 311, y: 131, w: 8, h: 9, label: '' });
    } else if (L.tab === 'notes') {
      const rows = noteRows(), maxS = maxScroll(rows, NVIEW_H);
      L.nscroll = U.clamp(L.nscroll, 0, maxS);
      placeRows(ui, rows, L.nsy, 30, NVIEW_H, (row, y) => {
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 104, h: HEAD_H - 2, label: row.label, count: row.count });
        else ui.push({ id: 'ncell', i: row.items[0].i, d: row.items[0].d, x: 8, y, w: 104, h: NROW_H - 2 });
      });
      if (L.nscroll > 0) ui.push({ id: 'up', x: 114, y: 30, w: 8, h: 9, label: '' });
      if (L.nscroll < maxS) ui.push({ id: 'down', x: 114, y: 155, w: 8, h: 9, label: '' });
    }
    return ui;
  }

  // ---------------------------------------------------------------- update
  L.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    // the drawn offsets glide toward their targets
    const k = 1 - Math.exp(-dt * 16);
    for (const [cur, to] of [['sy', 'scroll'], ['vsy', 'vscroll'], ['nsy', 'nscroll']]) {
      L[cur] += (L[to] - L[cur]) * k;
      if (Math.abs(L[to] - L[cur]) < 0.4) L[cur] = L[to];
    }
    L.ui = layout();
    if (L.entry) {                                                    // a species' full entry page
      L.hover = L.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
      const h = m.pressed[0] && L.hover;
      if (I.wasPressed('ArrowLeft', 'KeyA', 'KeyQ') || (h && h.id === 'eprev')) stepEntry(-1);
      else if (I.wasPressed('ArrowRight', 'KeyD', 'KeyE') || (h && h.id === 'enext')) stepEntry(1);
      else if (I.wasPressed('Escape', 'Enter', 'Space', 'Backspace') || m.pressed[0]) { L.entry = null; AQ.Audio.play('page_turn'); }
      return;
    }
    if (I.wasPressed('Escape', 'KeyL')) { L.close(game); return; }
    // tabs: left / right arrows (or A / D)
    const ti = TABS.findIndex((t) => t[0] === L.tab);
    if (I.wasPressed('ArrowLeft')) setTab(TABS[(ti + TABS.length - 1) % TABS.length][0]);
    if (I.wasPressed('ArrowRight')) setTab(TABS[(ti + 1) % TABS.length][0]);
    // A / D: sideways through the grid (the arrows' left / right switch tabs)
    const side = I.wasPressed('KeyA') ? -1 : I.wasPressed('KeyD') ? 1 : 0;
    if (L.tab === 'species') {
      if (I.wasPressed('KeyQ')) setBiome(-1);
      if (I.wasPressed('KeyE')) setBiome(1);
      const rows = rowsOf(entries(biomes()[L.biomeIdx])), n = entries(biomes()[L.biomeIdx]).length;
      if (side && n) { L.sel = U.clamp(L.sel + side, 0, n - 1); L.scroll = reveal(rows, L.sel, L.scroll, VIEW_H); }
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.sel, L.scroll] = stepRows(rows, L.sel, L.scroll, -1, VIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.sel, L.scroll] = stepRows(rows, L.sel, L.scroll, 1, VIEW_H);
      if (m.wheelPx) L.scroll = U.clamp(L.scroll + m.wheelPx * WHEEL, 0, maxScroll(rows, VIEW_H));
      const cur = entries(biomes()[L.biomeIdx])[L.sel];
      if (I.wasPressed('Enter', 'Space') && cur) openEntry(cur);
    } else if (L.tab === 'notes') {
      const rows = noteRows();
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.nsel, L.nscroll] = stepRows(rows, L.nsel, L.nscroll, -1, NVIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.nsel, L.nscroll] = stepRows(rows, L.nsel, L.nscroll, 1, NVIEW_H);
      if (m.wheelPx) L.nscroll = U.clamp(L.nscroll + m.wheelPx * WHEEL, 0, maxScroll(rows, NVIEW_H));
    } else if (L.tab === 'variants') {
      const rows = variantRows(), n = rows.reduce((a, r) => a + (r.items ? r.items.length : 0), 0);
      if (side && n) { L.vsel = U.clamp(L.vsel + side, 0, n - 1); L.vscroll = reveal(rows, L.vsel, L.vscroll, VVIEW_H); }
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.vsel, L.vscroll] = stepRows(rows, L.vsel, L.vscroll, -1, VVIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.vsel, L.vscroll] = stepRows(rows, L.vsel, L.vscroll, 1, VVIEW_H);
      if (m.wheelPx) L.vscroll = U.clamp(L.vscroll + m.wheelPx * WHEEL, 0, maxScroll(rows, VVIEW_H));
    }
    L.ui = layout();
    L.hover = L.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h && (!r.clip || (m.y >= r.clip.y0 && m.y < r.clip.y1)));
    const moved = m.x !== L.mx || m.y !== L.my || m.pressed[0];   // the mouse only takes over when it moves
    const moved2 = L.hover && L.hover.id === 'cell' && L.hover.i !== L.sel;   // this click is only selecting it
    if (L.hover && moved && L.hover.id === 'cell') L.sel = L.hover.i;
    if (L.hover && moved && L.hover.id === 'vcell') L.vsel = L.hover.i;
    if (L.hover && moved && L.hover.id === 'ncell') L.nsel = L.hover.i;
    L.mx = m.x; L.my = m.y;
    if (m.pressed[0] && L.hover) {
      const h = L.hover;
      if (h.id === 'tab') setTab(h.tab);
      if (h.id === 'cell' && h.i === L.sel && !moved2) openEntry(h.d);            // click the selected one again: its entry page
      if (h.id === 'prev') setBiome(-1);
      if (h.id === 'next') setBiome(1);
      if (h.id === 'dot' && h.k !== L.biomeIdx) setBiome(h.k - L.biomeIdx);
      const k = L.tab === 'species' ? 'scroll' : L.tab === 'variants' ? 'vscroll' : 'nscroll';
      if (h.id === 'up') L[k] = Math.max(0, L[k] - 30);
      if (h.id === 'down') L[k] += 30;                                  // clamped by layout()
      if (h.id === 'close') L.close(game);
    }
  };

  // ---------------------------------------------------------------- drawing helpers
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
  L.silhouette = silhouette;
  function wrap(text, max) {
    const words = text.toUpperCase().split(' '), lines = [];
    let cur = '';
    for (const w of words) { if ((cur + ' ' + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
    if (cur) lines.push(cur);
    return lines;
  }
  L.wrap = wrap;
  const keyOf = (d) => d.spriteKey || ((d.is_plant ? 'plant.' : 'creature.') + d.id);
  // draw a sprite (or its silhouette) centred at (cx, cy), scaled to fit w x h; small sprites are
  // blown up by whole steps (up to maxScale) so they stay crisp
  function drawIcon(g, key, cx, cy, w, h, shown, maxScale = 1) {
    const e = AQ.Assets.entry(key);
    if (!e) return;
    // fit and centre the visible pixels, not the padded frame
    const v = e.vis || [0, 0, e.fw - 1, e.fh - 1], vw = v[2] - v[0] + 1, vh = v[3] - v[1] + 1;
    const fit = Math.min(w / vw, h / vh), sc = fit >= 1 ? Math.max(1, Math.min(maxScale, Math.floor(fit))) : fit;
    const mx = Math.round((v[0] + v[2] + 1) / 2), my = Math.round((v[1] + v[3] + 1) / 2);
    g.save(); g.translate(Math.round(cx), Math.round(cy)); g.scale(sc, sc);
    if (shown) AQ.Assets.draw(g, key, 'idle', e.anchor[0] - mx, e.anchor[1] - my, { t: performance.now() / 1000 });
    else { const s = silhouette(key); if (s) g.drawImage(s, -mx, -my); }
    g.restore();
  }
  function arrows(g, r) {
    AQ.Aquarium.button(g, r, L.hover === r);
    g.fillStyle = '#e8fbff';                                         // little triangle arrow
    for (let k = 0; k < 3; k++) g.fillRect(r.x + 4 - k, r.id === 'up' ? r.y + 3 + k : r.y + 5 - k, k * 2 + 1, 1);
  }
  function heading(g, r) {                                           // family / biome heading, with its count
    const cw = r.count ? F().width(r.count) + 4 : 0, lw = F().width(r.label);
    F().draw(g, r.label, r.x + 2, r.y + 1, '#ffd9a8', { shadow: false });
    g.fillStyle = 'rgba(255,217,168,0.25)'; g.fillRect(r.x + lw + 6, r.y + 3, r.w - lw - 8 - cw, 1);
    if (r.count) F().draw(g, r.count, r.x + r.w, r.y + 1, C.dim, { align: 'right', shadow: false });
  }
  // a little pixel tick (no tick in the font)
  function tick(g, x, y, col) { g.fillStyle = col; g.fillRect(x, y + 2, 1, 1); g.fillRect(x + 1, y + 3, 1, 1); g.fillRect(x + 2, y + 2, 1, 1); g.fillRect(x + 3, y + 1, 1, 1); g.fillRect(x + 4, y, 1, 1); }
  function fitText(t, w) { if (F().width(t) <= w) return t; while (F().width(t + '.') > w && t.length > 3) t = t.slice(0, -1).trimEnd(); return t + '.'; }
  // a card's name: inside a family group the family word is already in the heading ("AZALEA AXOLOTL" -> "AZALEA")
  function shortName(d) {
    const n = d.name.toUpperCase(), fam = d.family && ((AQ.data.families[d.family] || {}).label || d.family).toUpperCase();
    return fam && n.endsWith(' ' + fam) ? n.slice(0, -fam.length - 1) : n;
  }
  function outline(g, r, col) { g.fillStyle = col; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1); g.fillRect(r.x, r.y, 1, r.h); g.fillRect(r.x + r.w - 1, r.y, 1, r.h); }

  // ---------------------------------------------------------------- draw
  L.draw = function (g) {
    g.fillStyle = C.bg; g.fillRect(0, 0, 320, 180);
    // header bar: title, tabs, bottles found, close
    g.fillStyle = C.bar; g.fillRect(0, 0, 320, 14); g.fillStyle = C.line; g.fillRect(0, 14, 320, 1);
    F().draw(g, 'COLLECTION LOG', 6, 4, C.title, { shadow: false });
    const bp = AQ.Bottles ? AQ.Bottles.progress() : { found: 0, total: 0 };
    F().draw(g, `BOTTLES FOUND ${bp.found}/${bp.total}`, 276, 4, C.info, { align: 'right', shadow: false });
    for (const r of L.ui) if (r.id === 'tab' || r.id === 'close') AQ.Aquarium.button(g, r, L.hover === r);
    g.fillStyle = C.line; g.fillRect(0, 168, 320, 1);              // footer separator
    if (L.entry) { drawEntry(g, L.entry); return; }
    for (const r of L.ui) {
      if (r.id === 'tab' || r.id === 'close') continue;
      if (r.clip) { g.save(); g.beginPath(); g.rect(0, r.clip.y0, 320, r.clip.y1 - r.clip.y0); g.clip(); drawItem(g, r); g.restore(); }
      else drawItem(g, r);
    }
    if (L.tab === 'species') drawSpecies(g);
    else if (L.tab === 'variants') drawVariants(g);
    else drawNotes(g);
  };
  function drawItem(g, r) {
    {
      if (r.id === 'up' || r.id === 'down') arrows(g, r);
      else if (r.id === 'head') heading(g, r);
      else if (r.id === 'cell') drawCell(g, r);
      else if (r.id === 'vcell') drawVariantCell(g, r);
      else if (r.id === 'ncell') drawNoteCell(g, r);
      else if (r.id === 'dot') drawDot(g, r);
      else AQ.Aquarium.button(g, r, L.hover === r);
    }
  }

  // one dot per biome: the current one is big and bright, finished biomes are green
  function drawDot(g, r) {
    const list = entries(r.b), cur = r.k === L.biomeIdx, hov = L.hover === r;
    const done = list.length && list.every((d) => AQ.Sex.complete(d)), any = list.some((d) => AQ.Collection.has(d.id));
    g.fillStyle = cur ? '#ffe9a8' : done ? C.good : any ? (hov ? '#9fd3ee' : '#4f7f9c') : (hov ? '#4f7f9c' : '#24425a');
    if (cur) g.fillRect(r.x + 1, r.y + 2, 5, 5); else g.fillRect(r.x + 2, r.y + 3, 3, 3);
  }
  function drawSpecies(g) {
    const b = biomes()[L.biomeIdx], list = entries(b), prog = AQ.Collection.progress();
    const bred = AQ.data.creatures.filter((d) => logOf(d.id).bred).length;
    const got = list.filter((d) => AQ.Collection.has(d.id)).length, done = list.filter((d) => AQ.Sex.complete(d)).length;
    F().draw(g, fitText((b.short || b.name).toUpperCase(), 86), 59, 19, done === list.length ? C.good : C.title, { align: 'center' });
    // overall progress, right-aligned: caught, complete (both sexes), bred
    let x = 316;
    const stat = (label, val, col) => { const w = F().width(val); F().draw(g, val, x, 19, col, { align: 'right' }); x -= w + 3; F().draw(g, label, x, 19, C.hint, { align: 'right', shadow: false }); x -= F().width(label) + 7; };
    if (bred) stat('BRED', '' + bred, '#ff9fc0');
    stat('DONE', `${prog.complete}/${prog.total}`, C.good);
    stat('CAUGHT', `${prog.discovered}/${prog.total}`, C.info);
    // details of the selected species
    const d = list[L.sel];
    g.fillStyle = C.panel; g.fillRect(4, 127, 312, 39);
    g.fillStyle = C.line; g.fillRect(4, 127, 312, 1);
    if (d) {
      const has = AQ.Collection.has(d.id);
      F().draw(g, has ? d.name.toUpperCase() : '???', 9, 131, has ? C.title : C.dim);
      const tags = [CAT_LABEL[d.category] || d.category, d.is_plant ? 'harvest' : '', d.requires_upgraded_net ? 'needs net lv2' : '',
        d.active === 'night' || d.bloom === 'night' ? 'night only' : d.active === 'day' ? 'day only' : '',
        d.event === 'star' ? 'falling stars only' : d.event === 'shower' ? 'meteor showers only' : '',
        d.requires_depth ? 'needs depth ' + d.requires_depth : '', d.rare ? 'rare' : '', d.hostile ? 'hostile' : '', d.draft ? 'draft' : ''].filter(Boolean).join(' - ');
      F().draw(g, tags.toUpperCase(), 311, 131, C.info, { align: 'right' });
      const tip = (d.active === 'night' ? 'Comes out at night. ' : d.bloom === 'night' ? 'Opens at night. ' : d.active === 'day' ? 'Only out by day. ' : '') + (d.requires_depth ? `Lives deep: needs the depth upgrade (level ${d.requires_depth}). ` : '') + (d.hint || '');
      const tl = wrap(tip, 75);
      tl.slice(0, 2).forEach((l, i) => F().draw(g, l + (i === 1 && tl.length > 2 ? '...' : ''), 9, 140 + i * 7, C.text));
      // bottom line: what's left to catch (left), field notes (right)
      if (has && AQ.Sex.has(d)) {
        const lg = logOf(d.id);
        F().draw(g, AQ.Sex.complete(d) ? 'BOTH ♂ AND ♀ CAUGHT' : `STILL TO FIND: ${lg.m ? 'A FEMALE ♀' : 'A MALE ♂'}`, 9, 157, AQ.Sex.complete(d) ? C.good : C.warn);
      } else if (!has) F().draw(g, 'NOT CAUGHT YET', 9, 157, C.dim);
      const gotNote = AQ.Bottles && AQ.Bottles.isFound(d.id);
      F().draw(g, gotNote ? 'FIELD NOTES FOUND' : 'NO FIELD NOTES YET', 311, 157, gotNote ? C.title : C.hint, { align: 'right' });
    }
    footer(g, [['WASD', 'MOVE'], ['ENTER', 'OPEN'], ['Q/E', 'BIOME'], ['LEFT/RIGHT', 'TABS'], ['ESC', 'CLOSE']]);
  }
  // a species card: picture, name, ♂/♀ slots and how many caught; ♥ = bred, tick = both sexes caught
  function drawCell(g, r) {
    const d = r.d, has = AQ.Collection.has(d.id), sel = r.i === L.sel, lg = logOf(d.id), done = AQ.Sex.complete(d);
    g.fillStyle = sel ? '#1f4862' : has ? '#132b40' : '#0f2335'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = has ? '#18364e' : '#112739'; g.fillRect(r.x + 1, r.y + 1, r.w - 2, 25);        // picture well
    drawIcon(g, keyOf(d), r.x + r.w / 2, r.y + 14, r.w - 6, 23, has, 2);
    F().draw(g, fitText(has ? shortName(d) : '???', r.w - 4), r.x + r.w / 2, r.y + 28, has ? (sel ? '#ffffff' : C.text) : '#5a7a90', { align: 'center', shadow: false });
    if (AQ.Sex.has(d)) {                                             // ♂ / ♀ slots (lit once caught); animals only
      F().draw(g, '♂', r.x + 3, r.y + 36, lg.m ? AQ.Sex.COLOR.m : '#2c4a5e', { shadow: false });
      F().draw(g, '♀', r.x + 9, r.y + 36, lg.f ? AQ.Sex.COLOR.f : '#2c4a5e', { shadow: false });
    } else if (d.draft) F().draw(g, 'D', r.x + 3, r.y + 36, '#8aa4b8');
    F().draw(g, has ? 'X' + AQ.State.collection[d.id] : '', r.x + r.w - 3, r.y + 36, '#ffe9a8', { align: 'right', shadow: false });
    if (lg.bred) F().draw(g, '♥', r.x + 3, r.y + 3, '#ff9fc0', { shadow: false });   // bred in a tank
    if (done) tick(g, r.x + r.w - 8, r.y + 3, C.good);
    if (sel) outline(g, r, '#5fc6d9');
    else if (L.hover === r) outline(g, r, '#2f6684');
  }

  // VARIANTS tab: every species that can have a rare colour, as "normal -> rare" cards grouped by
  // biome. The rare colour stays a gold "?" until one is bred; the panel says what to do next.
  // where a species stands on the way to its rare colour, and the next step
  function variantStatus(d) {
    const lg = logOf(d.id), name = d.name.toUpperCase();
    if (lg.variant) return { stage: 4, head: `✦ ${name}: RARE COLOR BRED!`, next: 'YOU HAVE ONE. LOOK FOR IT IN ITS TANK.' };
    if (!AQ.Collection.has(d.id)) return { stage: 0, head: '???: NOT DISCOVERED YET', next: 'CATCH ONE FIRST. ITS RARE COLOR CAN ONLY BE BRED, NEVER CAUGHT.' };
    if (!(lg.m && lg.f)) return { stage: 1, head: `${name}: NOT BRED YET`, next: `STEP 1: CATCH A ${lg.m ? 'FEMALE ♀' : 'MALE ♂'} TOO, SO YOU HAVE A PAIR.` };
    const tid = AQ.Tanks.forCreature(d), t = AQ.Tanks.get(tid), tank = AQ.Collection.tank(tid), tn = t ? (t.short || t.name).toUpperCase() : 'ITS';
    const here = tank.creatures.filter((e) => e.id === d.id);
    const paired = here.some((e) => e.sex === 'm') && here.some((e) => e.sex === 'f');
    const odds = Math.round(1 / AQ.TUNING.breeding.variantChance);
    if (!paired) return { stage: 2, head: `${name}: NOT BRED YET`, next: `STEP 2: PUT A ♂ AND A ♀ TOGETHER IN THE ${tn} TANK.` };
    return { stage: 3, head: `${name}: A PAIR LIVES IN THE ${tn} TANK ♥`, next: `KEEP THE TANK HAPPY (${AQ.TUNING.breeding.minStars}+ STARS) AND FED. ABOUT 1 BABY IN ${odds} IS A RARE COLOR.` };
  }
  function drawVariants(g) {
    const vp = L.variantProgress();
    F().draw(g, 'BREED A PAIR IN A TANK: NOW AND THEN A BABY IS A RARE COLOR', 6, 19, C.dim);
    F().draw(g, `${vp.got}/${vp.total}`, 316, 19, C.gold, { align: 'right' });
    F().draw(g, '✦', 316 - F().width(`${vp.got}/${vp.total}`) - 4, 19, C.gold, { align: 'right', shadow: false });
    // the selected species: where it stands and the next step
    const rows = variantRows(), it = rows.flatMap((r) => r.items || []).find((x) => x.i === L.vsel);
    g.fillStyle = C.panel; g.fillRect(4, 142, 312, 24); g.fillStyle = C.line; g.fillRect(4, 142, 312, 1);
    if (it) {
      const st = variantStatus(it.d);
      F().draw(g, st.head, 9, 146, st.stage === 4 ? C.gold : st.stage ? C.title : C.dim);
      wrap(st.next, 75).slice(0, 2).forEach((l, i) => F().draw(g, l, 9, 154 + i * 7, st.stage === 4 ? C.good : C.text));
    }
    footer(g, [['WASD', 'MOVE'], ['WHEEL', 'SCROLL'], ['LEFT/RIGHT', 'TABS'], ['ESC', 'CLOSE']]);
  }
  function drawVariantCell(g, r) {
    const d = r.d, has = AQ.Collection.has(d.id), sel = r.i === L.vsel, st = variantStatus(d), bred = st.stage === 4;
    g.fillStyle = sel ? '#1f4862' : bred ? '#2a2a1c' : has ? '#132b40' : '#0f2335'; g.fillRect(r.x, r.y, r.w, r.h);
    // normal colour  >  rare colour
    const wy = r.y + 2, ww = 30, wh = 17, nx = r.x + 2, vx = r.x + r.w - ww - 2;
    g.fillStyle = has ? '#18364e' : '#112739'; g.fillRect(nx, wy, ww, wh);
    drawIcon(g, keyOf(d), nx + ww / 2, wy + wh / 2, ww - 4, wh - 3, has, 2);
    F().draw(g, '>', r.x + r.w / 2, wy + 6, bred ? C.gold : '#4f6f86', { align: 'center', shadow: false });
    g.fillStyle = bred ? '#3a3420' : '#141f2a'; g.fillRect(vx, wy, ww, wh);
    const vkey = keyOf(d) + '.v';
    if (bred) drawIcon(g, AQ.Assets.entry(vkey) ? vkey : keyOf(d), vx + ww / 2, wy + wh / 2, ww - 4, wh - 3, true, 2);
    else {
      // not bred yet: the box shows what's missing (the panel below spells it out)
      const lg = logOf(d.id), mid = vx + ww / 2;
      if (st.stage === 1) F().draw(g, lg.m ? '♀' : '♂', mid, wy + 6, AQ.Sex.COLOR[lg.m ? 'f' : 'm'], { align: 'center', shadow: false });
      else if (st.stage === 2) { F().draw(g, '♂', mid - 3, wy + 6, AQ.Sex.COLOR.m, { align: 'center', shadow: false }); F().draw(g, '♀', mid + 3, wy + 6, AQ.Sex.COLOR.f, { align: 'center', shadow: false }); }
      else if (st.stage === 3) F().draw(g, '♥', mid, wy + 6 - (Math.floor(performance.now() / 400) % 2), '#ff9fc0', { align: 'center', shadow: false });
      else F().draw(g, '?', mid, wy + 6, '#5a5030', { align: 'center', shadow: false });
    }
    outline(g, { x: vx, y: wy, w: ww, h: wh }, bred ? '#ffd25a' : st.stage === 3 && (AQ.U.calm() || Math.floor(performance.now() / 500) % 2) ? '#a08a40' : '#3a3420');
    F().draw(g, fitText(has ? d.name.toUpperCase() : '???', r.w - 4), r.x + r.w / 2, r.y + 22, bred ? '#ffe9a8' : has ? (sel ? '#ffffff' : C.text) : '#5a7a90', { align: 'center', shadow: false });
    if (sel) outline(g, r, '#5fc6d9');
    else if (L.hover === r) outline(g, r, '#2f6684');
  }

  // NOTES tab: every field note found so far, grouped by biome; the selected one is shown on the right
  function drawNotes(g) {
    const rows = noteRows(), it = rows.flatMap((r) => r.items || []).find((x) => x.i === L.nsel), bp = AQ.Bottles.progress();
    F().draw(g, 'FIELD NOTES FROM MESSAGE BOTTLES', 6, 19, C.dim);
    F().draw(g, `${bp.found}/${bp.total}`, 316, 19, C.title, { align: 'right' });
    F().draw(g, 'NOTES', 316 - F().width(`${bp.found}/${bp.total}`) - 4, 19, C.hint, { align: 'right', shadow: false });
    if (!rows.length) {
      AQ.Assets.draw(g, 'misc.bottle', 'idle', 160, 78, { t: performance.now() / 1000 });
      F().draw(g, 'NO FIELD NOTES FOUND YET', 160, 88, C.dim, { align: 'center' });
      F().draw(g, 'MESSAGE BOTTLES ARE HIDDEN ALL OVER THE SEA, ONE FOR EVERY SPECIES.', 160, 100, C.hint, { align: 'center' });
      F().draw(g, 'EACH ONE HOLDS A RESEARCHER\'S NOTES ON THE CREATURE.', 160, 108, C.hint, { align: 'center' });
    } else if (it) {
      g.fillStyle = C.panel; g.fillRect(124, 30, 192, 136);
      g.fillStyle = C.line; g.fillRect(124, 30, 192, 1);
      drawNote(g, it.d, 129, 35, 43, 7, 311);
    }
    footer(g, [['W/S', 'PICK A NOTE'], ['WHEEL', 'SCROLL'], ['LEFT/RIGHT', 'TABS'], ['ESC', 'CLOSE']]);
  }
  function drawNoteCell(g, r) {
    const sel = r.i === L.nsel, d = r.d, lore = AQ.data.lore[d.id];
    g.fillStyle = sel ? '#1f4862' : L.hover === r ? '#183a52' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
    if (sel) { g.fillStyle = '#5fc6d9'; g.fillRect(r.x, r.y, 2, r.h); }
    F().draw(g, fitText(lore.title.toUpperCase(), r.w - 8), r.x + 5, r.y + 1, sel ? '#ffffff' : '#c3dfec', { shadow: false });
  }
  // a field note: epithet, scientific-style name, then the lines ({name} hidden until caught).
  // compact: epithet and scientific name share one line (the entry page already shows the name)
  function drawNote(g, d, x, y, cols, lh, right, compact) {
    const lore = AQ.data.lore[d.id], has = AQ.Collection.has(d.id);
    F().draw(g, lore.title.toUpperCase(), x, y, '#ffe9a8');
    if (compact) F().draw(g, lore.sci.toUpperCase(), right, y, '#9fd3ee', { align: 'right' });
    else {
      F().draw(g, lore.sci.toUpperCase(), x, y + 8, '#9fd3ee');
      F().draw(g, has ? d.name.toUpperCase() : '???', right, y + 8, has ? '#c3dfec' : '#6a8aa0', { align: 'right' });
      g.fillStyle = C.line; g.fillRect(x, y + 16, right - x, 1);
    }
    let yy = y + (compact ? 10 : 20);
    lore.lines.forEach((ln) => {
      wrap(AQ.Bottles.text(d.id, ln), cols).forEach((w, k) => { if (!k) { g.fillStyle = '#5fc6d9'; g.fillRect(x + 1, yy + 2, 2, 2); } F().draw(g, w, x + 6, yy, '#d8eef8'); yy += lh; });
      yy += 2;
    });
    return yy;
  }

  // a species' full entry page (ENTER or click in SPECIES): portrait + record on the left, name, tip
  // and the Field Notes on the right; < > browse the biome's species
  function drawEntry(g, d) {
    const has = AQ.Collection.has(d.id), lg = logOf(d.id), biome = (biomes().find((b) => b.id === d.biome) || {}).name || '';
    const bottleIn = (biomes().find((b) => b.id === (d.bottle || d.biome)) || {}).name || biome;   // where its message bottle lies
    const list = entries(biomes()[L.biomeIdx]);
    g.fillStyle = C.panel; g.fillRect(4, 17, 312, 149);
    // portrait
    g.fillStyle = '#18364e'; g.fillRect(8, 20, 76, 56);
    outline(g, { x: 8, y: 20, w: 76, h: 56 }, has ? '#2f6684' : '#1c3a52');
    drawIcon(g, keyOf(d), 46, 48, 70, 50, has, 3);
    // record under the portrait
    const rec = [];
    if (has) rec.push(['CAUGHT', 'X' + AQ.State.collection[d.id], C.title]);
    if (has && AQ.Sex.has(d)) { rec.push(['MALE ♂', lg.m ? 'YES' : 'NOT YET', lg.m ? AQ.Sex.COLOR.m : C.hint]); rec.push(['FEMALE ♀', lg.f ? 'YES' : 'NOT YET', lg.f ? AQ.Sex.COLOR.f : C.hint]); }
    if (lg.bred) rec.push(['BRED', '♥ YES', '#ff9fc0']);
    if (lg.variant) rec.push(['RARE COLOR', '✦ YES', C.gold]);
    if (!has) rec.push(['NOT CAUGHT YET', '', C.dim]);
    rec.forEach(([k, v, col], i) => { F().draw(g, k, 9, 81 + i * 8, C.dim, { shadow: false }); if (v) F().draw(g, v, 83, 81 + i * 8, col, { align: 'right', shadow: false }); });
    // name, tags, tip
    const X = 92, W = 312 - X;
    F().draw(g, has ? d.name.toUpperCase() : '???', X, 21, has ? C.title : C.dim);
    F().draw(g, (CAT_LABEL[d.category] || d.category).toUpperCase() + ' - ' + biome.toUpperCase(), X, 30, C.info);
    for (const r of L.ui) if (r.id === 'eprev' || r.id === 'enext') AQ.Aquarium.button(g, r, L.hover === r);
    F().draw(g, `${L.sel + 1}/${list.length}`, 290, 22, C.dim, { align: 'center', shadow: false });
    const tl = wrap('Tip: ' + (d.hint || ''), Math.floor(W / 4));
    tl.slice(0, 3).forEach((l, i) => F().draw(g, l, X, 40 + i * 7, C.text));
    // Field Notes section
    g.fillStyle = 'rgba(255,217,168,0.25)'; g.fillRect(X, 64, W, 1);
    F().draw(g, 'FIELD NOTES', X, 68, '#ffd9a8');
    if (AQ.Bottles && AQ.Bottles.isFound(d.id) && AQ.data.lore[d.id]) drawNote(g, d, X, 78, Math.floor((W - 6) / 4), 7, 312, true);
    else {
      AQ.Assets.draw(g, 'misc.bottle', 'idle', X + W / 2, 108, { t: performance.now() / 1000, alpha: 0.5 });
      F().draw(g, 'NOT FOUND YET', X + W / 2, 116, C.dim, { align: 'center' });
      wrap(`A message bottle somewhere in the ${bottleIn} holds these notes.`, Math.floor(W / 4)).forEach((l, i) => F().draw(g, l, X + W / 2, 126 + i * 8, C.hint, { align: 'center', shadow: false }));
    }
    footer(g, [['LEFT/RIGHT', 'PREV / NEXT SPECIES'], ['ESC', 'BACK TO THE LIST']]);
  }
  // footer hints: [key, action] pairs, keys brighter than what they do, centred as one line
  function footer(g, pairs) {
    const gap = 12, parts = pairs.map(([k, a]) => [k, a, F().width(k) + 4 + F().width(a)]);
    let x = Math.round(160 - (parts.reduce((s, p) => s + p[2], 0) + gap * (parts.length - 1)) / 2);
    for (const [k, a, w] of parts) { F().draw(g, k, x, 172, C.dim, { shadow: false }); F().draw(g, a, x + F().width(k) + 4, 172, C.hint, { shadow: false }); x += w + gap; }
  }
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
      if (AQ.Starfall) AQ.Starfall.drawMap(g, ox, oy, S, game.time);
      const P = game.player;
      if (AQ.U.calm() || Math.floor(game.time * 4) % 2) { g.fillStyle = '#ff5a7a'; g.fillRect(Math.round(ox + P.x / S) - 1, Math.round(oy + P.y / S) - 1, 3, 3); }
      F().draw(g, 'YOU', ox + P.x / S, oy + P.y / S + 4, '#ff9fb0', { align: 'center' });
      const fallen = AQ.Starfall && AQ.Starfall.waiting().length;
      F().draw(g, `GOLD = CHESTS${fallen ? '   SPARKLE = FALLEN STAR' : ''}   M / ESC: CLOSE`, 160, 160, '#8aa4b8', { align: 'center' });
    }
  };
})();

AQ.PauseUI = (function () {
  const F = () => AQ.Font;
  const P = { ui: [], confirm: 0 };
  P.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    if (P.panel === 'sound') { AQ.SoundUI.update(game, () => { P.panel = null; }, () => AQ.SoundTest.open(game, 'pause')); return; }
    P.confirm = Math.max(0, P.confirm - dt);
    if (AQ.SaveFile && AQ.SaveFile.update(game)) return;        // a save-file panel (import confirm, messages) is up
    const rows = [['resume', 'RESUME'], ['help', 'SHOW CONTROLS'], ['guide', 'GUIDE'], ['tutorial', AQ.Dive && AQ.Dive.active() ? 'RESTART TUTORIAL' : 'TUTORIAL'], ['sound', 'SOUND'], ['files'], ['home', 'HOME']];
    P.ui = [];
    rows.forEach(([id, label], i) => {
      const y = 38 + i * 14;
      if (id === 'files') { P.ui.push({ id: 'export', x: 110, y, w: 49, h: 12, label: 'EXPORT SAVE' }, { id: 'import', x: 161, y, w: 49, h: 12, label: 'IMPORT SAVE' }); return; }
      P.ui.push({ id, x: 110, y, w: 100, h: 12, label });
    });
    P.ui.push({ id: 'reset', x: 110, y: 38 + rows.length * 14 + 4, w: 100, h: 12, label: P.confirm > 0 ? 'CLICK AGAIN TO WIPE' : 'RESET SAVE' });
    if (I.wasPressed('Escape')) { game.state = 'play'; return; }
    const prev = P.hover;
    P.hover = P.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (P.hover && P.hover !== prev && (!prev || prev.id !== P.hover.id)) AQ.Audio.play('menu_move');
    if (m.pressed[0] && P.hover) {
      AQ.Audio.play('menu_select');
      if (P.hover.id === 'resume') game.state = 'play';
      if (P.hover.id === 'help') { AQ.HUD.helpT = 12; game.state = 'play'; }
      if (P.hover.id === 'guide') AQ.Guide.open(game, 'pause');
      if (P.hover.id === 'export') AQ.SaveFile.exportSave(game);
      if (P.hover.id === 'import') AQ.SaveFile.pickImport(game);
      if (P.hover.id === 'tutorial') { game.state = 'play'; if (game.scene !== 'world') AQ.HUD.toast('The guided dive starts when you are back in the sea.', '#cfe8ff', 4); AQ.Dive.start(game); }
      if (P.hover.id === 'sound') { P.panel = 'sound'; AQ.SoundUI.open(); }
      if (P.hover.id === 'home') { AQ.Save.save(game); AQ.Title.open(game); }
      if (P.hover.id === 'reset') { if (P.confirm > 0) AQ.Save.reset(); else P.confirm = 3; }
    }
  };
  P.draw = function (g) {
    g.fillStyle = 'rgba(4,12,24,0.75)'; g.fillRect(0, 0, 320, 180);
    if (P.panel === 'sound') { AQ.SoundUI.draw(g); return; }
    F().draw(g, 'PAUSED', 160, 26, '#ffe9a8', { align: 'center' });
    for (const r of P.ui) AQ.Aquarium.button(g, r, P.hover === r);
    const warn = AQ.SaveFile && AQ.SaveFile.statusLine();
    F().draw(g, warn || 'PROGRESS SAVES AUTOMATICALLY', 160, 162, warn ? '#ffcf8a' : '#8aa4b8', { align: 'center' });
    if (AQ.SaveFile) AQ.SaveFile.draw(g);
  };
  return P;
})();
