// Canvas overlays: collection log, world map, pause menu. All drawn with the pixel font.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.LogUI = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const L = { from: 'play', tab: 'species', biomeIdx: 0, sel: 0, scroll: 0, vsel: 0, vscroll: 0, nsel: 0, nscroll: 0, entry: null, ui: [] };
  const TABS = [['species', 'SPECIES', 44], ['variants', 'VARIANTS', 50], ['notes', 'NOTES', 40]];
  const COLS = 5, CELL_H = 47, HEAD_H = 10, VIEW_H = 94;            // species grid area (y 30..124)
  const VCOLS = 3, VROW_H = 14, VVIEW_H = 128;                      // variants list area (y 30..158)
  const NROW_H = 9, NVIEW_H = 128;                                   // notes list (left column, y 30..158)
  const sil = new Map();
  const CAT_LABEL = { fish: 'Fish', gastropod: 'Gastropod', crustacean: 'Crustacean', amphibian: 'Amphibian', cephalopod: 'Cephalopod', reptile: 'Reptile', mammal: 'Mammal', plant: 'Plant' };
  const logOf = (id) => (AQ.State.log || {})[id] || {};

  const biomes = () => {
    const order = ['tide_pools', 'coral', 'ruins', 'open_ocean', 'vents', 'trench', 'kelp', 'mangrove', 'ice', 'cave', 'lush_cave'];
    const all = AQ.World.biomes.slice();
    return all.sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99);
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
      if (fam) rows.push({ type: 'head', h: HEAD_H, label: ((AQ.data.families[fam] || {}).label || fam).toUpperCase() });
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
      rows.push({ type: 'head', h: HEAD_H, label: (b.short || b.name).toUpperCase() });
      for (let k = 0; k < list.length; k += VCOLS) rows.push({ type: 'cells', h: VROW_H, items: list.slice(k, k + VCOLS).map((d) => ({ d, i: i++ })) });
    });
    return rows;
  }
  // rows of the notes list: a heading per biome, then one row per found note
  function noteRows() {
    const rows = [];
    let i = 0;
    biomes().forEach((b) => {
      const list = entries(b).filter((d) => AQ.Bottles && AQ.Bottles.isFound(d.id) && AQ.data.lore[d.id]);
      if (!list.length) return;
      rows.push({ type: 'head', h: HEAD_H, label: (b.short || b.name).toUpperCase() });
      list.forEach((d) => rows.push({ type: 'cells', h: NROW_H, items: [{ d, i: i++ }] }));
    });
    return rows;
  }
  const fitFrom = (rows, start, view) => { let h = 0, n = 0; for (let r = start; r < rows.length && h + rows[r].h <= view; r++) { h += rows[r].h; n++; } return n; };
  const maxScroll = (rows, view) => { for (let s = 0; s < rows.length; s++) if (s + fitFrom(rows, s, view) >= rows.length) return s; return 0; };
  // move the selection one cell row up/down (same column), scrolling so it (and its heading) stays visible
  function stepRows(rows, sel, scroll, d, view) {
    const r0 = rows.findIndex((r) => r.type === 'cells' && r.items.some((it) => it.i === sel));
    let r = r0 + d;
    while (r >= 0 && r < rows.length && rows[r].type !== 'cells') r += d;
    if (r0 < 0 || r < 0 || r >= rows.length) return [sel, scroll];
    const col = rows[r0].items.findIndex((it) => it.i === sel);
    sel = rows[r].items[Math.min(col, rows[r].items.length - 1)].i;
    if (r < scroll) scroll = r > 0 && rows[r - 1].type === 'head' ? r - 1 : r;
    while (r >= scroll + fitFrom(rows, scroll, view)) scroll++;
    return [sel, scroll];
  }

  // ---------------------------------------------------------------- open / close
  L.open = function (game, from) {
    AQ.Audio.play('log_open');
    L.from = from || game.state;
    game.state = 'log';
    const here = from === 'aquarium' ? AQ.Aquarium.biome : from === 'title' || game.scene !== 'world' ? 'tide_pools' : AQ.World.biomeAt(game.player.x, game.player.y).id;
    L.biomeIdx = Math.max(0, biomes().findIndex((b) => b.id === here));
    L.sel = 0; L.scroll = 0; L.entry = null;
  };
  L.close = function (game) {
    AQ.Audio.play('log_close');
    if (L.from === 'title') { AQ.Title.open(game); return; }
    game.state = L.from === 'aquarium' ? 'aquarium' : 'play';
  };
  function setTab(t) { if (t === L.tab) return; L.tab = t; AQ.Audio.play('page_turn'); }
  function openEntry(d) { L.entry = d; AQ.Audio.play('page_turn'); }
  function setBiome(k) { const n = biomes().length; L.biomeIdx = (L.biomeIdx + k + n) % n; L.sel = 0; L.scroll = 0; AQ.Audio.play('page_turn'); }

  // ---------------------------------------------------------------- layout
  function layout() {
    const ui = [];
    ui.push({ id: 'close', x: 270, y: 3, w: 46, h: 10, label: 'CLOSE' });
    let tx = 316;
    for (let k = TABS.length - 1; k >= 0; k--) { const [id, label, w] = TABS[k]; tx -= w; ui.push({ id: 'tab', tab: id, x: tx, y: 16, w: w - 2, h: 10, label, on: L.tab === id }); }
    if (L.tab === 'species') {
      const b = biomes()[L.biomeIdx], list = entries(b);
      ui.push({ id: 'prev', x: 8, y: 16, w: 10, h: 10, label: '<' });
      ui.push({ id: 'next', x: 152, y: 16, w: 10, h: 10, label: '>' });
      const rows = rowsOf(list), maxS = maxScroll(rows, VIEW_H);
      L.scroll = U.clamp(L.scroll, 0, maxS);
      let y = 30;
      for (let r = L.scroll, n = fitFrom(rows, L.scroll, VIEW_H); r < L.scroll + n; r++) {
        const row = rows[r];
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 302, h: HEAD_H - 2, label: row.label });
        else row.items.forEach((it, c) => ui.push({ id: 'cell', i: it.i, d: it.d, x: 8 + c * 61, y, w: 58, h: 44 }));
        y += row.h;
      }
      if (L.scroll > 0) ui.push({ id: 'up', x: 311, y: 30, w: 8, h: 9, label: '' });
      if (L.scroll < maxS) ui.push({ id: 'down', x: 311, y: 115, w: 8, h: 9, label: '' });
    } else if (L.tab === 'variants') {
      const rows = variantRows(), maxS = maxScroll(rows, VVIEW_H);
      L.vscroll = U.clamp(L.vscroll, 0, maxS);
      let y = 30;
      for (let r = L.vscroll, n = fitFrom(rows, L.vscroll, VVIEW_H); r < L.vscroll + n; r++) {
        const row = rows[r];
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 302, h: HEAD_H - 2, label: row.label });
        else row.items.forEach((it, c) => ui.push({ id: 'vcell', i: it.i, d: it.d, x: 8 + c * 101, y, w: 99, h: VROW_H - 2 }));
        y += row.h;
      }
      if (L.vscroll > 0) ui.push({ id: 'up', x: 311, y: 30, w: 8, h: 9, label: '' });
      if (L.vscroll < maxS) ui.push({ id: 'down', x: 311, y: 149, w: 8, h: 9, label: '' });
    } else if (L.tab === 'notes') {
      const rows = noteRows(), maxS = maxScroll(rows, NVIEW_H);
      L.nscroll = U.clamp(L.nscroll, 0, maxS);
      let y = 30;
      for (let r = L.nscroll, n = fitFrom(rows, L.nscroll, NVIEW_H); r < L.nscroll + n; r++) {
        const row = rows[r];
        if (row.type === 'head') ui.push({ id: 'head', x: 8, y, w: 104, h: HEAD_H - 2, label: row.label });
        else ui.push({ id: 'ncell', i: row.items[0].i, d: row.items[0].d, x: 8, y, w: 104, h: NROW_H - 1 });
        y += row.h;
      }
      if (L.nscroll > 0) ui.push({ id: 'up', x: 114, y: 30, w: 8, h: 9, label: '' });
      if (L.nscroll < maxS) ui.push({ id: 'down', x: 114, y: 149, w: 8, h: 9, label: '' });
    }
    return ui;
  }

  // ---------------------------------------------------------------- update
  L.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    L.ui = layout();
    if (L.entry) {                                                    // a species' full entry page
      if (I.wasPressed('Escape', 'Enter', 'Space', 'Backspace') || m.pressed[0]) { L.entry = null; AQ.Audio.play('page_turn'); }
      return;
    }
    if (I.wasPressed('Escape', 'KeyL')) { L.close(game); return; }
    // tabs: left / right arrows (or A / D)
    const ti = TABS.findIndex((t) => t[0] === L.tab);
    if (I.wasPressed('ArrowLeft', 'KeyA')) setTab(TABS[(ti + TABS.length - 1) % TABS.length][0]);
    if (I.wasPressed('ArrowRight', 'KeyD')) setTab(TABS[(ti + 1) % TABS.length][0]);
    if (L.tab === 'species') {
      if (I.wasPressed('KeyQ')) setBiome(-1);
      if (I.wasPressed('KeyE')) setBiome(1);
      const rows = rowsOf(entries(biomes()[L.biomeIdx]));
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.sel, L.scroll] = stepRows(rows, L.sel, L.scroll, -1, VIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.sel, L.scroll] = stepRows(rows, L.sel, L.scroll, 1, VIEW_H);
      if (m.wheel) L.scroll = U.clamp(L.scroll + Math.sign(m.wheel), 0, maxScroll(rows, VIEW_H));
      const cur = entries(biomes()[L.biomeIdx])[L.sel];
      if (I.wasPressed('Enter', 'Space') && cur) openEntry(cur);
    } else if (L.tab === 'notes') {
      const rows = noteRows();
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.nsel, L.nscroll] = stepRows(rows, L.nsel, L.nscroll, -1, NVIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.nsel, L.nscroll] = stepRows(rows, L.nsel, L.nscroll, 1, NVIEW_H);
      if (m.wheel) L.nscroll = U.clamp(L.nscroll + Math.sign(m.wheel), 0, maxScroll(rows, NVIEW_H));
    } else if (L.tab === 'variants') {
      const rows = variantRows();
      if (I.wasPressed('ArrowUp', 'KeyW')) [L.vsel, L.vscroll] = stepRows(rows, L.vsel, L.vscroll, -1, VVIEW_H);
      if (I.wasPressed('ArrowDown', 'KeyS')) [L.vsel, L.vscroll] = stepRows(rows, L.vsel, L.vscroll, 1, VVIEW_H);
      if (m.wheel) L.vscroll = U.clamp(L.vscroll + Math.sign(m.wheel), 0, maxScroll(rows, VVIEW_H));
    }
    L.ui = layout();
    L.hover = L.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
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
      const k = L.tab === 'species' ? 'scroll' : L.tab === 'variants' ? 'vscroll' : 'nscroll';
      if (h.id === 'up') L[k]--;
      if (h.id === 'down') L[k]++;
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
  // draw a sprite (or its silhouette) centred at (cx, cy), scaled to fit w x h
  function drawIcon(g, key, cx, cy, w, h, shown) {
    const e = AQ.Assets.entry(key);
    if (!e) return;
    const sc = Math.min(1, w / e.fw, h / e.fh);
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    if (shown) AQ.Assets.draw(g, key, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: performance.now() / 1000 });
    else { const s = silhouette(key); if (s) g.drawImage(s, -e.fw / 2, -e.fh / 2); }
    g.restore();
  }
  function arrows(g, r) {
    AQ.Aquarium.button(g, r, L.hover === r);
    g.fillStyle = '#e8fbff';                                         // little triangle arrow
    for (let k = 0; k < 3; k++) g.fillRect(r.x + 4 - k, r.id === 'up' ? r.y + 3 + k : r.y + 5 - k, k * 2 + 1, 1);
  }
  function heading(g, r) {                                           // family / biome heading
    F().draw(g, r.label, r.x + 2, r.y + 1, '#ffd9a8');
    g.fillStyle = 'rgba(255,217,168,0.35)'; g.fillRect(r.x + F().width(r.label) + 6, r.y + 3, r.w - F().width(r.label) - 8, 1);
  }

  // ---------------------------------------------------------------- draw
  L.draw = function (g) {
    g.fillStyle = 'rgba(5,14,26,0.985)'; g.fillRect(0, 0, 320, 180);
    F().draw(g, 'COLLECTION LOG', 8, 5, '#ffe9a8');
    const bp = AQ.Bottles ? AQ.Bottles.progress() : { found: 0, total: 0 };
    F().draw(g, `BOTTLES FOUND ${bp.found}/${bp.total}`, 266, 5, '#bfe6ff', { align: 'right' });
    if (L.entry) { drawEntry(g, L.entry); return; }
    for (const r of L.ui) {
      if (r.id === 'up' || r.id === 'down') arrows(g, r);
      else if (r.id === 'head') heading(g, r);
      else if (r.id === 'cell') drawCell(g, r);
      else if (r.id === 'vcell') drawVariantCell(g, r);
      else if (r.id === 'ncell') drawNoteCell(g, r);
      else AQ.Aquarium.button(g, r, L.hover === r);
    }
    if (L.tab === 'species') drawSpecies(g);
    else if (L.tab === 'variants') drawVariants(g);
    else drawNotes(g);
  };

  function drawSpecies(g) {
    const b = biomes()[L.biomeIdx], list = entries(b), prog = AQ.Collection.progress();
    const bred = AQ.data.creatures.filter((d) => logOf(d.id).bred).length;
    F().draw(g, `CAUGHT ${prog.discovered}/${prog.total}  COMPLETE ${prog.complete}/${prog.total}${bred ? '  ♥' + bred : ''}`, 74, 5, '#9fd3ee');
    const got = list.filter((d) => AQ.Collection.has(d.id)).length, done = list.filter((d) => AQ.Sex.complete(d)).length;
    F().draw(g, `${b.short || b.name} ${got}/${list.length}`, 85, 18, done === list.length ? '#7ef0c0' : '#e8fbff', { align: 'center' });
    // details
    const d = list[L.sel];
    g.fillStyle = '#0d2236'; g.fillRect(4, 126, 312, 51);
    if (d) {
      const has = AQ.Collection.has(d.id);
      F().draw(g, has ? d.name : '???', 10, 130, has ? '#ffe9a8' : '#8aa4b8');
      const tags = [CAT_LABEL[d.category] || d.category, d.is_plant ? 'harvest' : '', d.requires_upgraded_net ? 'needs net lv2' : '',
        d.active === 'night' || d.bloom === 'night' ? 'night only' : d.active === 'day' ? 'day only' : '',
        d.requires_depth ? 'needs depth ' + d.requires_depth : '', d.rare ? 'rare' : '', d.hostile ? 'hostile' : '', d.draft ? 'draft' : ''].filter(Boolean).join(' - ');
      F().draw(g, tags, 310, 130, '#9fd3ee', { align: 'right' });
      if (has && AQ.Sex.has(d)) {
        const lg = logOf(d.id);
        const txt = (AQ.Sex.complete(d) ? 'COMPLETE: BOTH ♂ AND ♀ CAUGHT' : `STILL TO FIND: ${lg.m ? 'A FEMALE ♀' : 'A MALE ♂'}`) + (lg.bred ? '   ♥ BRED' : '');
        F().draw(g, txt, 10, 164, AQ.Sex.complete(d) ? '#7ef0c0' : '#ffcf8a');
      }
      // field notes (from this species' message bottle)
      const gotNote = AQ.Bottles && AQ.Bottles.isFound(d.id);
      F().draw(g, gotNote ? 'FIELD NOTES: PRESS ENTER' : 'NO FIELD NOTES YET', 310, 164, gotNote ? '#ffe9a8' : '#4f6f86', { align: 'right' });
      wrap('Tip: ' + (d.active === 'night' ? 'Comes out at night. ' : d.bloom === 'night' ? 'Opens at night. ' : d.active === 'day' ? 'Only out by day. ' : '') + (d.requires_depth ? `Lives deep: needs the depth upgrade (level ${d.requires_depth}). ` : '') + (d.hint || ''), 75).slice(0, has && AQ.Sex.has(d) ? 3 : 4).forEach((l, i) => F().draw(g, l, 10, 140 + i * 8, '#d8eef8'));
    }
    F().draw(g, 'Q/E: BIOME   LEFT/RIGHT: TABS   ENTER: ENTRY' + (maxScroll(rowsOf(list), VIEW_H) > 0 ? '   UP/DOWN: SCROLL' : '') + '   ESC: CLOSE', 160, 173, '#5f7f96', { align: 'center' });
  }
  function drawCell(g, r) {
    const d = r.d, has = AQ.Collection.has(d.id), sel = r.i === L.sel, lg = logOf(d.id);
    g.fillStyle = sel ? '#24506b' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
    if (sel) { g.fillStyle = '#5fc6d9'; g.fillRect(r.x, r.y, r.w, 1); g.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
    drawIcon(g, keyOf(d), r.x + r.w / 2, r.y + 19, 34, 32, has);
    F().draw(g, has ? 'X' + AQ.State.collection[d.id] : '?', r.x + r.w - 3, r.y + 36, has ? '#ffe9a8' : '#6a8aa0', { align: 'right' });
    if (AQ.Sex.has(d)) {                                             // ♂ / ♀ slots (lit once caught); animals only
      F().draw(g, '♂', r.x + 3, r.y + 36, lg.m ? AQ.Sex.COLOR.m : '#2c4a5e', { shadow: false });
      F().draw(g, '♀', r.x + 8, r.y + 36, lg.f ? AQ.Sex.COLOR.f : '#2c4a5e', { shadow: false });
    }
    if (AQ.Sex.complete(d)) { g.fillStyle = '#7ef0c0'; g.fillRect(r.x + r.w - 4, r.y + 2, 2, 2); }
    if (lg.bred) F().draw(g, '♥', r.x + 3, r.y + 3, '#ff9fc0', { shadow: false });   // bred in a tank
    if (d.draft && !AQ.Sex.has(d)) F().draw(g, 'D', r.x + 3, r.y + 36, '#8aa4b8');
  }

  // VARIANTS tab: every species with a rare colour variant slot, grouped by biome
  function drawVariants(g) {
    const vp = L.variantProgress();
    F().draw(g, `VARIANTS ${vp.got}/${vp.total}`, 74, 5, '#ffd25a');
    F().draw(g, 'RARE COLORS (BRED BABIES ONLY)', 8, 18, '#9fd3ee');
    // the selected entry, on the bottom line
    const rows = variantRows(), it = rows.flatMap((r) => r.items || []).find((x) => x.i === L.vsel);
    g.fillStyle = '#0d2236'; g.fillRect(4, 160, 312, 17);
    if (it) {
      const d = it.d, has = AQ.Collection.has(d.id), v = logOf(d.id).variant;
      const txt = v ? `✦ ${d.name.toUpperCase()}: RARE COLOR BRED` : has ? `${d.name.toUpperCase()}: NOT BRED YET` : '???: NOT DISCOVERED YET';
      F().draw(g, txt, 10, 163, v ? '#ffd25a' : has ? '#d8eef8' : '#8aa4b8');
    }
    F().draw(g, 'LEFT/RIGHT: TABS   UP/DOWN: SCROLL   ESC: CLOSE', 160, 171, '#5f7f96', { align: 'center' });
  }
  function drawVariantCell(g, r) {
    const d = r.d, has = AQ.Collection.has(d.id), v = logOf(d.id).variant, sel = r.i === L.vsel;
    g.fillStyle = sel ? '#24506b' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
    if (sel) { g.fillStyle = '#5fc6d9'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
    const vkey = 'creature.' + d.id + '.v';
    drawIcon(g, v && AQ.Assets.entry(vkey) ? vkey : keyOf(d), r.x + 9, r.y + r.h / 2, 16, 11, has);
    let name = has ? d.name.toUpperCase() : '???';
    while (F().width(name) > 66 && name.length > 3) name = name.slice(0, -2) + '.';
    F().draw(g, name, r.x + 19, r.y + 3, v ? '#ffe9a8' : has ? '#c3dfec' : '#6a8aa0', { shadow: false });
    F().draw(g, '✦', r.x + r.w - 8, r.y + 3, v ? '#ffd25a' : '#2c4a5e', { shadow: false });
  }

  // NOTES tab: every field note found so far, grouped by biome; the selected one is shown on the right
  function drawNotes(g) {
    F().draw(g, 'FIELD NOTES', 74, 5, '#ffe9a8');
    const rows = noteRows(), it = rows.flatMap((r) => r.items || []).find((x) => x.i === L.nsel);
    if (!rows.length) {
      F().draw(g, 'NO FIELD NOTES FOUND YET', 160, 70, '#8aa4b8', { align: 'center' });
      F().draw(g, 'MESSAGE BOTTLES ARE HIDDEN ALL OVER THE SEA, ONE FOR EVERY SPECIES.', 160, 84, '#5f7f96', { align: 'center' });
      F().draw(g, 'EACH ONE HOLDS A RESEARCHER\'S NOTES ON THE CREATURE.', 160, 92, '#5f7f96', { align: 'center' });
    } else if (it) {
      g.fillStyle = '#0d2236'; g.fillRect(124, 30, 192, 128);
      drawNote(g, it.d, 128, 34, 43, 7, 312);
    }
    F().draw(g, 'LEFT/RIGHT: TABS   UP/DOWN: SCROLL   ESC: CLOSE', 160, 171, '#5f7f96', { align: 'center' });
  }
  function drawNoteCell(g, r) {
    const sel = r.i === L.nsel, d = r.d, lore = AQ.data.lore[d.id];
    g.fillStyle = sel ? '#24506b' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
    let t = lore.title.toUpperCase();
    while (F().width(t) > r.w - 4 && t.length > 3) t = t.slice(0, -2) + '.';
    F().draw(g, t, r.x + 2, r.y + 1, sel ? '#ffffff' : '#c3dfec', { shadow: false });
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
    }
    let yy = y + (compact ? 10 : 19);
    lore.lines.forEach((ln) => {
      wrap(AQ.Bottles.text(d.id, ln), cols).forEach((w, k) => { F().draw(g, (k ? '  ' : '- ') + w, x, yy, '#d8eef8'); yy += lh; });
      yy += 1;
    });
    return yy;
  }

  // a species' full entry page (ENTER or click in SPECIES): picture, tip and its Field Notes section
  function drawEntry(g, d) {
    const has = AQ.Collection.has(d.id), lg = logOf(d.id), biome = (biomes().find((b) => b.id === d.biome) || {}).name || '';
    g.fillStyle = '#0d2236'; g.fillRect(4, 16, 312, 151);
    g.fillStyle = '#132b40'; g.fillRect(8, 20, 56, 42);
    drawIcon(g, keyOf(d), 36, 41, 50, 38, has);
    F().draw(g, has ? d.name.toUpperCase() : '???', 70, 21, has ? '#ffe9a8' : '#8aa4b8');
    F().draw(g, (CAT_LABEL[d.category] || d.category).toUpperCase() + '   ' + biome.toUpperCase(), 70, 29, '#9fd3ee');
    if (has) F().draw(g, `CAUGHT X${AQ.State.collection[d.id]}${AQ.Sex.has(d) ? `   ♂ ${lg.m ? 'YES' : 'NO'}  ♀ ${lg.f ? 'YES' : 'NO'}` : ''}${lg.bred ? '   ♥ BRED' : ''}${lg.variant ? '   ✦ RARE COLOR' : ''}`, 70, 37, '#c3dfec');
    wrap('Tip: ' + (d.hint || ''), 60).slice(0, 2).forEach((l, i) => F().draw(g, l, 70, 47 + i * 7, '#d8eef8'));
    // Field Notes section
    g.fillStyle = 'rgba(255,233,168,0.35)'; g.fillRect(8, 65, 304, 1);
    F().draw(g, 'FIELD NOTES', 8, 68, '#ffd9a8');
    if (AQ.Bottles && AQ.Bottles.isFound(d.id) && AQ.data.lore[d.id]) drawNote(g, d, 8, 78, 73, 7, 312, true);
    else wrap(`Not found yet. Somewhere in the ${biome} a message bottle holds these notes.`, 75).forEach((l, i) => F().draw(g, l, 8, 80 + i * 8, '#6a8aa0'));
    F().draw(g, 'ESC / ENTER / CLICK: BACK', 160, 171, '#5f7f96', { align: 'center' });
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
    if (P.panel === 'sound') { AQ.SoundUI.update(game, () => { P.panel = null; }, () => AQ.SoundTest.open(game, 'pause')); return; }
    P.confirm = Math.max(0, P.confirm - dt);
    P.ui = [
      { id: 'resume', x: 110, y: 54, w: 100, h: 14, label: 'RESUME' },
      { id: 'help', x: 110, y: 72, w: 100, h: 14, label: 'SHOW CONTROLS' },
      { id: 'sound', x: 110, y: 90, w: 100, h: 14, label: 'SOUND' },
      { id: 'home', x: 110, y: 108, w: 100, h: 14, label: 'HOME' },
      { id: 'reset', x: 110, y: 132, w: 100, h: 14, label: P.confirm > 0 ? 'CLICK AGAIN TO WIPE' : 'RESET SAVE' }
    ];
    if (I.wasPressed('Escape')) { game.state = 'play'; return; }
    const prev = P.hover;
    P.hover = P.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (P.hover && P.hover !== prev && (!prev || prev.id !== P.hover.id)) AQ.Audio.play('menu_move');
    if (m.pressed[0] && P.hover) {
      AQ.Audio.play('menu_select');
      if (P.hover.id === 'resume') game.state = 'play';
      if (P.hover.id === 'help') { AQ.HUD.helpT = 12; game.state = 'play'; }
      if (P.hover.id === 'sound') { P.panel = 'sound'; AQ.SoundUI.open(); }
      if (P.hover.id === 'home') { AQ.Save.save(game); AQ.Title.open(game); }
      if (P.hover.id === 'reset') { if (P.confirm > 0) AQ.Save.reset(); else P.confirm = 3; }
    }
  };
  P.draw = function (g) {
    g.fillStyle = 'rgba(4,12,24,0.75)'; g.fillRect(0, 0, 320, 180);
    if (P.panel === 'sound') { AQ.SoundUI.draw(g); return; }
    F().draw(g, 'PAUSED', 160, 38, '#ffe9a8', { align: 'center' });
    for (const r of P.ui) AQ.Aquarium.button(g, r, P.hover === r);
    F().draw(g, 'PROGRESS SAVES AUTOMATICALLY', 160, 160, '#8aa4b8', { align: 'center' });
  };
  return P;
})();
