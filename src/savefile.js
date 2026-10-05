// Save files: EXPORT SAVE (download), IMPORT SAVE (pick a file, check it, confirm, load) and the
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

  // ---------------------------------------------------------------- export
  SF.exportSave = function (game) {
    try {
      const data = S().snapshot(game), name = `Aquadise-save-${dateOf(data.savedAt)}.json`;
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      SF.lastExport = name;
      message('save.exported', [['save.exported.1', { file: name }], 'save.exported.2']);
      AQ.Audio.play('menu_select');
    } catch (e) { message('save.exportFailed', ['save.exportFailed.1', 'save.exportFailed.2']); }
  };

  // ---------------------------------------------------------------- import
  SF.pickImport = function (game) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (file) SF.importFile(file, game);
    });
    document.body.appendChild(input);
    input.click();
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
    const p = SF.panel, n = p.buttons.length, bw = n === 1 ? 60 : 92;
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
    else if (pick === 'import') { SF.pickImport(game); }
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
    F().draw(g, AQ.t(p.title), 160, r.y + 5, '#fff6dc', { align: 'center', shadow: false });
    p.wrapped.forEach((l, i) => F().draw(g, l, 160, r.y + 15 + i * 8, '#9fd3ee', { align: 'center', shadow: false }));
    for (const b of SF.ui) AQ.Aquarium.button(g, b, SF.hover === b);
  };
  // the small "can't save right now" line for the title / pause screens
  SF.statusLine = () => (S().failed ? AQ.t('save.cantSaveLine') : null);
  return SF;
})();
