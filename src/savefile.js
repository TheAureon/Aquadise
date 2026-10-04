// Save files: EXPORT SAVE (download), IMPORT SAVE (pick a file, check it, confirm, load) and the
// recovery choice when the save can't be read. Available from the title screen and the pause menu.
// Imported saves go through the same loading + migration as any save (the page reloads into them).
// Small modal panels drawn over the title / pause screen; they never crash on a bad file.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SaveFile = (function () {
  const F = () => AQ.Font, S = () => AQ.Save;
  const SF = { panel: null, ui: [] };
  const cfg = () => AQ.TUNING.saveFile;
  const dateOf = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : 'an unknown date'; };
  SF.open = () => !!SF.panel;
  const message = (title, lines) => { SF.panel = { kind: 'msg', title, lines, buttons: [['ok', 'OK']] }; };

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
      message('SAVE EXPORTED', [`Downloaded as ${name}.`, 'Keep it somewhere safe. IMPORT SAVE loads it back.']);
      AQ.Audio.play('menu_select');
    } catch (e) { message('EXPORT DIDN\'T WORK', ['Your browser wouldn\'t create the file.', 'Your progress is untouched.']); }
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
    notsave: ['THAT\'S NOT AN AQUADISE SAVE', ['This file isn\'t a save from Aquadise.', 'Nothing was changed.']],
    damaged: ['THAT SAVE LOOKS DAMAGED', ['Some of it is missing or broken, so it wasn\'t loaded.', 'Nothing was changed.']],
    newer: ['THAT SAVE IS FROM A NEWER VERSION', ['It was made by a newer Aquadise than this one.', 'Nothing was changed.']],
    unreadable: ['THAT FILE COULDN\'T BE READ', ['It may be too big, empty or not a text file.', 'Nothing was changed.']]
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
    SF.panel = { kind: 'confirm', data, title: 'REPLACE YOUR CURRENT SAVE?',
      lines: [`This save: ${caught}/${total} species, saved ${data.savedAt ? dateOf(data.savedAt) : 'with an older version'}.`, 'Your current save is kept as the backup.'],
      buttons: [['replace', 'REPLACE'], ['cancel', 'CANCEL']] };
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
    message('SAVE LOADED', ['Loaded for this session.', 'Progress can\'t be saved right now: EXPORT SAVE to keep it.']);
  }

  // ---------------------------------------------------------------- recovery (the save can't be read)
  SF.openRecover = function () {
    const b = S().backup;
    SF.panel = b
      ? { kind: 'recover', title: 'YOUR SAVE COULDN\'T BE READ', lines: [`A backup from ${dateOf(b.savedAt)} is safe and sound.`, 'Restore it, or start fresh (the unreadable save is kept aside).'], buttons: [['restore', 'RESTORE BACKUP'], ['fresh', 'START FRESH']] }
      : { kind: 'recover', title: 'YOUR SAVE COULDN\'T BE READ', lines: ['There is no backup to restore.', 'Import a save file, or start fresh (the old one is kept aside).'], buttons: [['import', 'IMPORT SAVE'], ['fresh', 'START FRESH']] };
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
    p.wrapped = [].concat(...p.lines.map((l) => wrapPx(l.toUpperCase(), BOX_W - 14)));     // text always fits inside the box
    const h = 35 + p.wrapped.length * 8, x = 160 - BOX_W / 2, y = Math.round(90 - h / 2);
    p.rect = { x, y, w: BOX_W, h };
    SF.ui = p.buttons.map(([id, label], i) => ({ id, label, x: Math.round(160 - (n * bw + (n - 1) * 8) / 2 + i * (bw + 8)), y: y + h - 15, w: bw, h: 11, warn: id === 'fresh' || id === 'freshyes' }));
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
    else if (pick === 'fresh') SF.panel = { kind: 'freshconfirm', title: 'START FRESH?', lines: ['The unreadable save is kept aside, not deleted.', 'You start a brand-new game.'], buttons: [['freshyes', 'START FRESH'], ['back', 'BACK']] };
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
    F().draw(g, p.title, 160, r.y + 5, '#fff6dc', { align: 'center', shadow: false });
    p.wrapped.forEach((l, i) => F().draw(g, l, 160, r.y + 15 + i * 8, '#9fd3ee', { align: 'center', shadow: false }));
    for (const b of SF.ui) AQ.Aquarium.button(g, b, SF.hover === b);
  };
  // the small "can't save right now" line for the title / pause screens
  SF.statusLine = () => (S().failed ? 'PROGRESS CAN\'T BE SAVED RIGHT NOW - EXPORT SAVE STILL WORKS' : null);
  return SF;
})();
