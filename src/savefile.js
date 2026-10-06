// Save files: EXPORT SAVE (a file: download, or the share sheet on phones; COPY SAVE TEXT as a fallback),
// IMPORT SAVE (choose a file or paste save text, check it, confirm, load) and the
// recovery choice when the save can't be read. Available from the title screen and the pause menu.
// Imported saves go through the same loading + migration as any save (the page reloads into them).
// Small modal panels drawn over the title / pause screen; they never crash on a bad file.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SaveFile = (function () {
  const F = () => AQ.Font, S = () => AQ.Save;
  const SF = { panel: null, ui: [] };
  const cfg = () => AQ.TUNING.saveFile;
  // a save's date: YYYY-MM-DD for file names (plain ASCII), the language's own format on screen
  const dateOf = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : 'unknown'; };
  const shownDate = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? AQ.Lang.date(d) : AQ.t('save.unknownDate'); };
  SF.open = () => !!SF.panel;
  // panels hold language keys; the text is looked up when drawn (title, lines: keys or [key, values])
  const message = (title, lines) => { SF.panel = { kind: 'msg', title, lines, buttons: [['ok', 'ui.ok']] }; };

  // ---------------------------------------------------------------- inside the click itself
  // Browsers only allow a download, the share sheet, the clipboard and the file picker during the click /
  // tap / key press itself, and some (Safari, phones, embedded pages) are strict about it. The game sees a
  // click a frame later, so these jobs wait for the button to be let go (still the same gesture) and run
  // right there; if no release comes they run shortly after anyway.
  let pending = null;
  function inGesture(fn) {
    pending = fn;
    setTimeout(() => { if (pending === fn) { pending = null; fn(); } }, cfg().gestureWaitMs);
  }
  const runPending = () => { const fn = pending; pending = null; if (fn) fn(); };
  ['pointerup', 'mouseup', 'touchend', 'keyup'].forEach((ev) => window.addEventListener(ev, runPending, true));

  // ---------------------------------------------------------------- export
  // EXPORT SAVE: a .json file. On phones (where the browser offers it) through the share sheet, so it can
  // go to Files / Drive / a message; everywhere else as a download. The message after it always offers
  // COPY SAVE TEXT too, because some browsers and embedded pages silently refuse downloads.
  const saveText = (game) => JSON.stringify(S().snapshot(game), null, 1);
  const fileName = (game) => `Aquadise-save-${dateOf(new Date().toISOString())}.json`;
  const touchy = () => !!(AQ.Touch && AQ.Touch.active()) || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  SF.exportSave = function (game) {
    let text, name;
    try { text = saveText(game); name = fileName(game); } catch (e) { message('save.exportFailed', ['save.exportFailed.1', 'save.exportFailed.2']); return; }
    SF.panel = { kind: 'msg', title: 'save.exporting', lines: ['save.exporting.1'], buttons: [['ok', 'ui.ok']] };
    inGesture(() => exportNow(text, name));
  };
  function exportNow(text, name) {
    const done = () => {
      SF.lastExport = name;
      SF.panel = { kind: 'msg', title: 'save.exported', lines: [['save.exported.1', { file: name }], 'save.exported.2', 'save.exported.3'], buttons: [['copy', 'save.copyBtn'], ['ok', 'ui.ok']], text };
      AQ.Audio.play('menu_select');
    };
    const failed = () => { SF.panel = { kind: 'msg', title: 'save.exportFailed', lines: ['save.exportFailed.1', 'save.exportFailed.3'], buttons: [['copy', 'save.copyBtn'], ['ok', 'ui.ok']], text }; };
    // phones: the share sheet (Save to Files...), when the browser can share files
    try {
      const file = typeof File === 'function' ? new File([text], name, { type: 'application/json' }) : null;
      if (file && touchy() && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: name }).then(() => {
          SF.lastExport = name;
          SF.panel = { kind: 'msg', title: 'save.shared', lines: ['save.shared.1', 'save.exported.2'], buttons: [['copy', 'save.copyBtn'], ['ok', 'ui.ok']], text };
        }, (e) => {
          if (e && e.name === 'AbortError') SF.panel = { kind: 'msg', title: 'save.notShared', lines: ['save.notShared.1'], buttons: [['copy', 'save.copyBtn'], ['ok', 'ui.ok']], text };
          else download(text, name) ? done() : failed();
        });
        return;
      }
    } catch (e) { /* no share sheet here: a download instead */ }
    if (download(text, name)) done(); else failed();
  }
  function download(text, name) {
    try {
      const blob = new Blob([text], { type: 'application/json' }), a = document.createElement('a');
      if (!('download' in a)) return false;
      a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  }
  // COPY SAVE TEXT: to the clipboard, or (if the browser won't) shown in a box to copy by hand
  function copyText(text) {
    const shown = () => SF.textBox('copy', text);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => { SF.panel = { kind: 'msg', title: 'save.copied', lines: ['save.copied.1', 'save.copied.2'], buttons: [['ok', 'ui.ok']] }; }, shown);
        return;
      }
    } catch (e) { /* fall through */ }
    shown();
  }

  // ---------------------------------------------------------------- the text box (copy by hand / paste)
  // A real text box over the game (typing goes to it, not the game), for when files and the clipboard are
  // out of reach: 'copy' shows the save text selected, 'paste' takes save text and imports it.
  SF.textBox = function (mode, text, game) {
    SF.closeBox();
    const T = AQ.t, wrap = document.createElement('div'), box = document.createElement('textarea');
    wrap.className = 'aq-form';
    wrap.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50;width:min(90vw,560px);background:#0b1a2c;border:2px solid #6ef0ef;padding:12px;font:14px monospace;color:#e8fbff;box-sizing:border-box';
    const head = document.createElement('div');
    head.textContent = T(mode === 'copy' ? 'save.box.copy' : 'save.box.paste');
    head.style.cssText = 'margin-bottom:8px;line-height:1.4';
    box.value = mode === 'copy' ? text : '';
    box.readOnly = mode === 'copy';
    box.spellcheck = false;
    box.style.cssText = 'width:100%;height:40vh;max-height:260px;box-sizing:border-box;background:#06121f;color:#cfeefa;border:1px solid #2e7d96;font:12px monospace;padding:6px';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
    const btn = (label, fn, main) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = `font:14px monospace;padding:8px 14px;cursor:pointer;border:1px solid #6ef0ef;color:#e8fbff;background:${main ? '#2e7d96' : '#16334a'}`; b.addEventListener('click', fn); row.appendChild(b); return b; };
    if (mode === 'paste') btn(T('save.box.import'), () => { const v = box.value.trim(); SF.closeBox(); if (v) SF.importText(v, game || AQ.Game); else SF.panel = null; }, true);
    btn(T(mode === 'copy' ? 'ui.close' : 'ui.cancel'), () => { SF.closeBox(); SF.panel = null; });
    // Esc closes it (typing here never reaches the game, so the box listens for itself)
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); SF.closeBox(); SF.panel = null; } });
    wrap.appendChild(head); wrap.appendChild(box); wrap.appendChild(row);
    document.body.appendChild(wrap);
    SF.box = wrap;
    SF.panel = { kind: 'box', title: mode === 'copy' ? 'save.box.copyTitle' : 'save.box.pasteTitle', lines: ['save.box.hint'], buttons: [['boxclose', 'ui.close']] };
    setTimeout(() => { box.focus(); if (mode === 'copy') box.select(); }, 30);
  };
  SF.closeBox = function () { if (SF.box) { SF.box.remove(); SF.box = null; } };

  // ---------------------------------------------------------------- import
  // IMPORT SAVE: choose a .json file, or paste save text (from COPY SAVE TEXT)
  SF.importMenu = function () {
    SF.panel = { kind: 'importmenu', title: 'save.importHow', lines: ['save.importHow.1'], buttons: [['file', 'save.chooseFile'], ['paste', 'save.pasteBtn'], ['cancel', 'ui.cancel']] };
  };
  SF.pickImport = function (game) {
    if (!SF.panel) { SF.importMenu(); return; }        // from a menu button: ask which way first
    SF.chooseFile(game);
  };
  SF.chooseFile = function (game) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (file) SF.importFile(file, game);
    });
    document.body.appendChild(input);
    inGesture(() => input.click());
  };
  const REFUSE = {
    notsave: ['save.notSave', ['save.notSave.1', 'save.nothingChanged']],
    damaged: ['save.damaged', ['save.damaged.1', 'save.nothingChanged']],
    newer: ['save.newer', ['save.newer.1', 'save.nothingChanged']],
    unreadable: ['save.unreadable', ['save.unreadable.1', 'save.nothingChanged']]
  };
  // check a file; if it's good, ask before replacing the current save
  SF.importFile = function (file, game) {
    if (!file || file.size > cfg().maxImportBytes || file.size === 0) { const r = REFUSE.unreadable; message(r[0], r[1]); return Promise.resolve(false); }
    return file.text().then((text) => SF.importText(text, game), () => { const r = REFUSE.unreadable; message(r[0], r[1]); return false; });
  };
  SF.importText = function (text, game) {
    let data = null;
    try { data = S().parse(text); } catch (e) { const r = REFUSE.notsave; message(r[0], r[1]); return false; }
    const verdict = S().check(data);
    if (verdict !== 'ok') { const r = REFUSE[verdict] || REFUSE.damaged; message(r[0], r[1]); return false; }
    const caught = Object.keys(data.state.collection || {}).length, total = AQ.Collection.progress().total;
    SF.panel = { kind: 'confirm', data, title: 'save.replace',
      lines: [data.savedAt ? ['save.replace.1', { n: caught, total, date: shownDate(data.savedAt) }] : ['save.replace.1old', { n: caught, total }], 'save.replace.2'],
      buttons: [['replace', 'save.replaceBtn'], ['cancel', 'ui.cancel']] };
    return true;
  };
  // load a save object the normal way: write it, then reload so it goes through the usual loading + migration
  function loadSave(data, game) {
    if (S().writeRaw(data)) { S().wiped = true; window.onbeforeunload = null; location.reload(); return; }
    // storage blocked: load it for this session only
    S().apply(data, game);
    game.upgrades = AQ.State.upgrades; game.player.speedLevel = game.upgrades.speed;
    if (AQ.Aquarium) { AQ.Aquarium.fish = []; AQ.Aquarium.biome = null; }
    if (AQ.Starfall) AQ.Starfall.init();
    AQ.Scenes.restore(game, game.scene, game.player.x, game.player.y);
    message('save.loaded', ['save.loaded.1', 'save.loaded.2']);
  }

  // ---------------------------------------------------------------- recovery (the save can't be read)
  SF.openRecover = function () {
    const b = S().backup;
    SF.panel = b
      ? { kind: 'recover', title: 'save.recover', lines: [['save.recover.backup', { date: shownDate(b.savedAt) }], 'save.recover.backup2'], buttons: [['restore', 'save.restoreBtn'], ['fresh', 'save.freshBtn']] }
      : { kind: 'recover', title: 'save.recover', lines: ['save.recover.none', 'save.recover.none2'], buttons: [['import', 'ui.importSave'], ['fresh', 'save.freshBtn']] };
  };

  // ---------------------------------------------------------------- panel input + drawing
  const BOX_W = 248;
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && F().width(t) > px) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function layout() {
    const p = SF.panel, n = p.buttons.length, bw = n === 1 ? 60 : n === 3 ? 74 : 92;
    const tx = (l) => (Array.isArray(l) ? AQ.t(l[0], l[1]) : AQ.t(l));
    p.wrapped = [].concat(...p.lines.map((l) => wrapPx(tx(l).toUpperCase(), BOX_W - 14)));     // text always fits inside the box
    const h = 35 + p.wrapped.length * 8, x = 160 - BOX_W / 2, y = Math.round(90 - h / 2);
    p.rect = { x, y, w: BOX_W, h };
    SF.ui = p.buttons.map(([id, label], i) => ({ id, label: AQ.t(label), x: Math.round(160 - (n * bw + (n - 1) * 8) / 2 + i * (bw + 8)), y: y + h - 15, w: bw, h: 11, warn: id === 'fresh' || id === 'freshyes' }));
  }
  // returns true while a panel is up (the screen underneath ignores input)
  SF.update = function (game) {
    if (!SF.panel) return false;
    const I = AQ.Input, m = I.mouse;
    layout();
    SF.hover = SF.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (SF.panel.kind === 'box') {                                 // the text box over the game has the input
      if (I.rawPressed('Escape')) { I.consume('Escape'); SF.closeBox(); SF.panel = null; }
      else if (m.pressed[0] && SF.hover) { m.pressed[0] = false; SF.closeBox(); SF.panel = null; }
      return true;
    }
    let pick = m.pressed[0] && SF.hover ? SF.hover.id : null;
    if (!pick && I.rawPressed('Escape')) pick = SF.panel.kind === 'recover' ? null : SF.panel.buttons[SF.panel.buttons.length - 1][0];   // Esc = the safe choice
    if (!pick && I.rawPressed('Enter') && SF.panel.kind === 'msg') pick = 'ok';
    if (!pick) return true;
    I.consume('Escape', 'Enter'); m.pressed[0] = false;
    AQ.Audio.play('menu_select');
    const p = SF.panel;
    if (pick === 'ok' || pick === 'cancel') SF.panel = null;
    else if (pick === 'replace') { SF.panel = null; loadSave(p.data, game); }
    else if (pick === 'restore') { S().blocked = false; SF.panel = null; loadSave(S().backup, game); }
    else if (pick === 'import') SF.importMenu();
    else if (pick === 'file') { SF.panel = null; SF.chooseFile(game); }
    else if (pick === 'paste') SF.textBox('paste', '', game);
    else if (pick === 'copy') { const text = p.text; SF.panel = { kind: 'msg', title: 'save.copying', lines: ['save.exporting.1'], buttons: [['ok', 'ui.ok']] }; inGesture(() => copyText(text)); }
    else if (pick === 'fresh') SF.panel = { kind: 'freshconfirm', title: 'save.fresh', lines: ['save.fresh.1', 'save.fresh.2'], buttons: [['freshyes', 'save.freshBtn'], ['back', 'ui.back']] };
    else if (pick === 'freshyes') { S().setAsideUnreadable(); SF.panel = null; }
    else if (pick === 'back') SF.openRecover();
    return true;
  };
  SF.draw = function (g) {
    if (!SF.panel) return;
    layout();
    const p = SF.panel, r = p.rect;
    g.fillStyle = 'rgba(4,10,20,0.6)'; g.fillRect(0, 0, 320, 180);
    g.fillStyle = 'rgba(6,18,34,0.97)'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = p.kind === 'recover' || p.kind === 'freshconfirm' ? '#ffcf8a' : '#6ef0ef'; g.fillRect(r.x, r.y, r.w, 1);
    F().draw(g, AQ.t(p.title), 160, r.y + 5, '#fff6dc', { align: 'center', shadow: false, max: BOX_W - 10 });
    p.wrapped.forEach((l, i) => F().draw(g, l, 160, r.y + 15 + i * 8, '#9fd3ee', { align: 'center', shadow: false }));
    for (const b of SF.ui) AQ.Aquarium.button(g, b, SF.hover === b);
  };
  // the small "can't save right now" line for the title / pause screens
  SF.statusLine = () => (S().failed ? AQ.t('save.cantSaveLine') : null);
  return SF;
})();
