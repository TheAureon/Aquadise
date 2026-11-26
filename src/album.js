// The photo album: every tank photo you take is also kept in the game (the log's PHOTOS tab), with its tank
// and date. In the album you can look at one full size, save it out as a PNG again, set it as a tank's cover
// in the tank overview (TANKS), or delete it. Kept small: at most AQ.TUNING.album.max photos, each a small
// JPEG of the picture as framed. Stored apart from the save (its own browser storage), so backups of your
// game stay small: the album has its own BACK UP / RESTORE (a file with the photos in it).
//
// Saved (separately): { v: 1, photos: [{ id, tank, at, data }], covers: { tankId: photoId } }.
// Text: album.* and log.tab.photos in data/lang/en.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Album = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const AL = { sel: 0, view: false, confirm: 0, imgs: {}, ui: [], scroll: 0 };
  const cfg = () => AQ.TUNING.album;
  const KEY = () => AQ.TUNING.save.key + '-photos';
  let data = null;
  function load() {
    if (data) return data;
    data = { v: 1, photos: [], covers: {} };
    try { const raw = localStorage.getItem(KEY()); if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.photos)) data = { v: 1, photos: d.photos.filter((p) => p && typeof p.data === 'string'), covers: d.covers && typeof d.covers === 'object' ? d.covers : {} }; } } catch (e) { /* no album yet */ }
    return data;
  }
  function store() {
    try { localStorage.setItem(KEY(), JSON.stringify(load())); return true; } catch (e) { return false; }   // (storage full: the photo is still downloaded)
  }
  AL.photos = () => load().photos;
  AL.count = () => AL.photos().length;
  AL.img = function (p) {                                          // the decoded picture (made once, then kept)
    let im = AL.imgs[p.id];
    if (!im) { im = AL.imgs[p.id] = new Image(); im.src = p.data; }
    return im.complete && im.naturalWidth ? im : null;
  };
  // a new photo from the tank screen (src/aquarium.js): kept, unless the album is full
  AL.add = function (canvas, tankId) {
    if (AL.count() >= cfg().max) return 'full';
    let url;
    try { url = canvas.toDataURL('image/jpeg', cfg().quality); } catch (e) { return 'failed'; }
    const p = { id: Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), tank: tankId, at: Date.now(), data: url };
    AL.photos().push(p);
    if (!store()) { AL.photos().pop(); return 'full'; }
    if (AQ.Badges) AQ.Badges.add('albumPhotos');
    return 'kept';
  };
  AL.coverFor = function (tankId) {
    const id = load().covers[tankId], p = id && AL.photos().find((x) => x.id === id);
    return p ? AL.img(p) : null;
  };
  const tankName = (id) => { const b = AQ.Tanks && AQ.Tanks.get(id); return b ? b.name : id; };
  const dateOf = (p) => { const d = new Date(p.at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---------------------------------------------------------------- actions
  function savePng(p) {
    const im = AL.img(p);
    if (!im) return;
    const k = AQ.TUNING.photo.scale, c = document.createElement('canvas');
    c.width = im.naturalWidth * k; c.height = im.naturalHeight * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height);
    const run = () => c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Aquadise-${String(p.tank).replace(/[^a-z0-9]+/gi, '-')}-${dateOf(p)}.png`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, 'image/png');
    if (AQ.SaveFile && AQ.SaveFile.inGesture) AQ.SaveFile.inGesture(run); else run();
    toast('album.saved');
  }
  function setCover(p) {
    const c = load().covers;
    if (c[p.tank] === p.id) delete c[p.tank]; else c[p.tank] = p.id;
    store(); toast(c[p.tank] === p.id ? 'album.coverSet' : 'album.coverOff', { tank: tankName(p.tank) });
    if (c[p.tank] === p.id && AQ.Badges) AQ.Badges.event('cover');
  }
  function remove(p) {
    const d = load(), i = d.photos.indexOf(p);
    if (i < 0) return;
    d.photos.splice(i, 1);
    for (const t in d.covers) if (d.covers[t] === p.id) delete d.covers[t];
    delete AL.imgs[p.id];
    store(); AL.sel = Math.max(0, Math.min(AL.sel, d.photos.length - 1)); toast('album.deleted');
  }
  // the album's own backup: one file with every photo in it
  function backUp() {
    const text = JSON.stringify({ game: 'aquadise-photos', v: 1, photos: AL.photos(), covers: load().covers });
    const run = () => {
      const a = document.createElement('a'), blob = new Blob([text], { type: 'application/octet-stream' });
      const d = new Date();
      a.href = URL.createObjectURL(blob); a.download = `Aquadise-photos-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.aquadise-photos`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    };
    if (AQ.SaveFile && AQ.SaveFile.inGesture) AQ.SaveFile.inGesture(run); else run();
    toast('album.backedUp', { n: AL.count() });
  }
  function restore() {
    const run = () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.aquadise-photos,application/json,application/octet-stream';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        f.text().then((t) => {
          const d = JSON.parse(t);
          if (!d || d.game !== 'aquadise-photos' || !Array.isArray(d.photos)) throw new Error('not an album');
          const have = new Set(AL.photos().map((p) => p.id));
          let n = 0;
          for (const p of d.photos) { if (AL.count() >= cfg().max) break; if (p && typeof p.data === 'string' && /^data:image\//.test(p.data) && !have.has(p.id)) { AL.photos().push({ id: String(p.id), tank: String(p.tank), at: +p.at || Date.now(), data: p.data }); n++; } }
          Object.assign(load().covers, d.covers && typeof d.covers === 'object' ? d.covers : {});
          store(); toast('album.restored', { n });
        }).catch(() => toast('album.restoreFailed'));
      };
      inp.click();
    };
    if (AQ.SaveFile && AQ.SaveFile.inGesture) AQ.SaveFile.inGesture(run); else run();
  }
  function toast(key, vars) { AL.msg = { text: AQ.t(key, vars), t: 3 }; AQ.Audio.play('menu_select'); }

  // ---------------------------------------------------------------- the log's PHOTOS tab (src/ui.js asks)
  const G = { x0: 8, y0: 29, w: 74, h: 38, cols: 4, rows: 3 };
  AL.layout = function (ui) {
    const n = AL.count();
    AL.sel = Math.max(0, Math.min(AL.sel, n - 1));
    const row = Math.floor(AL.sel / G.cols);
    AL.scroll = Math.max(0, Math.min(Math.max(0, Math.ceil(n / G.cols) - G.rows), Math.max(AL.scroll, row - G.rows + 1), row));
    for (let i = AL.scroll * G.cols; i < Math.min(n, (AL.scroll + G.rows) * G.cols); i++) {
      const k = i - AL.scroll * G.cols;
      ui.push({ id: 'photo', i, x: G.x0 + (k % G.cols) * (G.w + 2), y: G.y0 + Math.floor(k / G.cols) * (G.h + 2), w: G.w, h: G.h });
    }
    const bt = [['view', 'album.view'], ['png', 'album.png'], ['cover', 'album.cover'], ['delete', AL.confirm > 0 ? 'album.sure' : 'album.delete'], ['backup', 'album.backup'], ['restore', 'album.restore']];
    bt.forEach(([id, key], k) => ui.push({ id: 'al_' + id, x: 8 + k * 51, y: 152, w: 49, h: 10, label: AQ.t(key), off: !n && id !== 'restore' }));
  };
  AL.update = function (dt, L, game) {
    const I = AQ.Input, m = I.mouse, n = AL.count();
    if (AL.msg && (AL.msg.t -= dt) <= 0) AL.msg = null;
    if (AL.confirm > 0) AL.confirm -= dt;
    if (AL.view) {                                                 // a photo full size: any key or click closes it
      if (I.wasPressed('Escape', 'Enter', 'Space', 'Backspace') || m.pressed[0]) { AL.view = false; AQ.Audio.play('page_turn'); }
      else if (I.wasPressed('ArrowLeft', 'KeyA')) AL.sel = Math.max(0, AL.sel - 1);
      else if (I.wasPressed('ArrowRight', 'KeyD')) AL.sel = Math.min(n - 1, AL.sel + 1);
      return true;
    }
    if (I.wasPressed('KeyA')) AL.sel = Math.max(0, AL.sel - 1);
    if (I.wasPressed('KeyD')) AL.sel = Math.min(n - 1, AL.sel + 1);
    if (I.wasPressed('ArrowUp', 'KeyW')) AL.sel = Math.max(0, AL.sel - G.cols);
    if (I.wasPressed('ArrowDown', 'KeyS')) AL.sel = Math.min(n - 1, AL.sel + G.cols);
    if (m.wheelPx) AL.scroll = Math.max(0, AL.scroll + Math.sign(m.wheelPx));
    if (I.wasPressed('Enter', 'Space') && n) { AL.view = true; AQ.Audio.play('page_turn'); }
    const h = L.hover;
    if (m.pressed[0] && h) {
      const p = AL.photos()[AL.sel];
      if (h.id === 'photo') { if (h.i === AL.sel) AL.view = true; AL.sel = h.i; AQ.Audio.play('menu_move'); }
      else if (h.off) { /* nothing to do */ }
      else if (h.id === 'al_view' && p) { AL.view = true; AQ.Audio.play('page_turn'); }
      else if (h.id === 'al_png' && p) savePng(p);
      else if (h.id === 'al_cover' && p) setCover(p);
      else if (h.id === 'al_delete' && p) { if (AL.confirm > 0) { AL.confirm = 0; remove(p); } else { AL.confirm = 2.5; AQ.Audio.play('menu_move'); } }
      else if (h.id === 'al_backup') backUp();
      else if (h.id === 'al_restore') restore();
    }
    return false;
  };
  AL.draw = function (g, L, C) {
    const photos = AL.photos(), n = photos.length;
    F().draw(g, AQ.t('album.intro'), 6, 19, C.dim, { max: 230 });
    F().draw(g, AQ.t('album.count', { n, max: cfg().max }), 316, 19, C.title, { align: 'right' });
    if (!n) {
      F().draw(g, AQ.t('album.none'), 160, 80, C.dim, { align: 'center', max: 300 });
      F().draw(g, AQ.t('album.none2'), 160, 92, C.hint, { align: 'center', max: 300 });
    }
    const covers = load().covers;
    for (const r of L.ui) {
      if (r.id === 'photo') {
        const p = photos[r.i];
        if (!p) continue;                                            // (just deleted: the grid is laid out again next frame)
        const sel = r.i === AL.sel, im = AL.img(p);
        g.fillStyle = sel ? '#5fc6d9' : L.hover === r ? '#2a5a78' : '#132b40'; g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        if (im) { const s = Math.min((r.w) / im.naturalWidth, (r.h - 8) / im.naturalHeight), w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s); g.imageSmoothingEnabled = true; g.drawImage(im, r.x + Math.round((r.w - w) / 2), r.y, w, h); g.imageSmoothingEnabled = false; }
        F().draw(g, tankName(p.tank).toUpperCase(), r.x + 1, r.y + r.h - 7, sel ? '#ffffff' : '#9fc4d8', { shadow: false, max: r.w - 2 });
        if (covers[p.tank] === p.id) { g.fillStyle = '#ffe9a8'; g.fillRect(r.x + r.w - 5, r.y + 1, 4, 4); }   // (this tank's cover)
      } else if (/^al_/.test(r.id)) AQ.Aquarium.button(g, r, L.hover === r);
    }
    const p = photos[AL.sel];
    if (p) F().draw(g, AQ.t('album.info', { tank: tankName(p.tank).toUpperCase(), date: dateOf(p) }), 160, 144, C.info, { align: 'center', max: 300 });
    if (AL.msg) F().draw(g, AL.msg.text, 160, 166, '#ffe9a8', { align: 'center', max: 300 });
    else F().draw(g, AQ.t('album.keys'), 160, 166, C.hint, { align: 'center', max: 300 });
    if (AL.view && p) {
      g.fillStyle = 'rgba(2,8,16,0.94)'; g.fillRect(0, 0, 320, 180);
      const im = AL.img(p);
      if (im) { const s = Math.min(300 / im.naturalWidth, 150 / im.naturalHeight), w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s); g.imageSmoothingEnabled = true; g.drawImage(im, Math.round((320 - w) / 2), 8, w, h); g.imageSmoothingEnabled = false; }
      F().draw(g, AQ.t('album.viewInfo', { tank: tankName(p.tank).toUpperCase(), date: dateOf(p), n: AL.sel + 1, total: n }), 160, 166, '#cfe8f5', { align: 'center', max: 310 });
    }
  };
  return AL;
})();
