// SAVE & BACKUP (title screen + pause menu): one calm panel for keeping your game safe.
//   - how saving stands ("Your progress saves automatically in this browser.", last saved, last backup)
//   - BACK UP MY GAME: a backup file (Aquadise-backup-YYYY-MM-DD-HHMM.aquadise, the same save data inside
//     as always), downloaded, or through the share sheet on phones; then "Backup saved!" with WHERE IS IT?
//   - RESTORE A BACKUP: choose a backup file (.aquadise, or an older .json save), checked carefully,
//     confirmed, then loaded through the usual loading + migration (the page reloads into it)
//   - ERASE MY PROGRESS, small and apart, asking twice and offering a backup first
// Also the recovery choice when the save can't be read (with the SAFETY COPY: the automatic hidden copy
// of the previous save, src/save.js). Words for players: BACK UP / RESTORE, never export / import.
// The panels are drawn over the title / pause screen; they never crash on a bad file.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SaveFile = (function () {
  const F = () => AQ.Font, S = () => AQ.Save;
  const SF = { panel: null, ui: [], sel: 0 };
  const cfg = () => AQ.TUNING.saveFile;
  const pad = (n) => String(n).padStart(2, '0');
  const shownDate = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? AQ.Lang.date(d) : AQ.t('save.unknownDate'); };
  SF.open = () => !!SF.panel;
  // panels hold language keys; the text is looked up when drawn (title, lines: keys or [key, values])
  const message = (title, lines, buttons) => { SF.panel = { kind: 'msg', title, lines, buttons: buttons || [['ok', 'ui.ok']] }; };

  // ---------------------------------------------------------------- when things happened, in plain words
  // fine: "just now", "3 minutes ago", "2 hours ago"; coarse (backups): "today", "yesterday", "3 days ago"
  SF.ago = function (iso, coarse) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (isNaN(t)) return AQ.t('save.ago.never');
    const now = new Date(), mins = Math.max(0, (now - t) / 60000);
    if (!coarse) {
      if (mins < 1) return AQ.t('save.ago.justNow');
      if (mins < 60) return AQ.t('save.ago.minutes', { n: Math.floor(mins) });
      if (mins < 24 * 60) return AQ.t('save.ago.hours', { n: Math.floor(mins / 60) });
    }
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((day(now) - day(new Date(t))) / 86400000);
    return days <= 0 ? AQ.t('save.ago.today') : days === 1 ? AQ.t('save.ago.yesterday') : AQ.t('save.ago.days', { n: days });
  };
  // the last backup (kept in the save: AQ.State.backups.lastAt)
  const backups = () => (AQ.State.backups = AQ.State.backups || {});
  SF.lastBackup = () => backups().lastAt || null;
  SF.daysSinceBackup = () => { const b = SF.lastBackup(); return b ? (Date.now() - new Date(b).getTime()) / 86400000 : Infinity; };

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
  SF.inGesture = inGesture;
  const runPending = () => { const fn = pending; pending = null; if (fn) fn(); };
  ['pointerup', 'mouseup', 'touchend', 'keyup'].forEach((ev) => window.addEventListener(ev, runPending, true));

  // ---------------------------------------------------------------- back up
  // The file: the save as it is now (the same JSON as every save, so older builds' files and these are
  // read the same way). The name has the local time down to the minute, so a second backup the same day
  // never clashes. A generic file type (application/octet-stream), so browsers keep the .aquadise ending
  // instead of adding .json or .txt.
  const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  SF.fileName = (d) => `Aquadise-backup-${stamp(d)}.aquadise`;
  SF.MIME = 'application/octet-stream';
  const touchy = () => !!(AQ.Touch && AQ.Touch.active()) || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  // the backup's contents (it records itself as the last backup, so a restore keeps that date)
  SF.backupText = function (game, kind) {
    const b = backups(), prev = { lastAt: b.lastAt, kind: b.kind };
    b.lastAt = new Date().toISOString(); b.kind = kind || 'file';
    try { return JSON.stringify(S().snapshot(game), null, 1); } catch (e) { Object.assign(b, prev); throw e; }
  };
  SF.backedUp = function (kind) {
    const b = backups(); b.lastAt = new Date().toISOString(); b.kind = kind || 'file';
    AQ.Save && AQ.Save.save(AQ.Game);
  };
  SF.backUp = function (game, then) {
    let text, name;
    try { name = SF.fileName(); text = SF.backupText(game, 'file'); } catch (e) { message('save.backupFailed', ['save.backupFailed.1', 'save.nothingChanged']); return; }
    SF.panel = { kind: 'msg', title: 'save.backingUp', lines: ['save.oneMoment'], buttons: [['ok', 'ui.ok']] };
    inGesture(() => backUpNow(text, name, then));
  };
  function backUpNow(text, name, then) {
    const done = (shared) => {
      SF.backedUp('file');
      SF.lastFile = name;
      SF.panel = { kind: 'msg', title: 'save.backedUp', lines: [['save.backedUp.1', { file: name }], shared ? 'save.backedUp.shared' : 'save.backedUp.2'],
        buttons: then === 'erase' ? [['where', 'save.whereBtn'], ['erase1', 'save.eraseNow'], ['ok', 'ui.ok']] : shared ? [['ok', 'ui.ok']] : [['where', 'save.whereBtn'], ['ok', 'ui.ok']] };
      AQ.Audio.play('menu_select');
    };
    const failed = () => message('save.backupFailed', ['save.backupFailed.1', 'save.backupFailed.2']);
    // phones: the share sheet (Save to Files, Drive, a message...), when the browser can share files
    try {
      const file = typeof File === 'function' ? new File([text], name, { type: SF.MIME }) : null;
      if (file && touchy() && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file], title: name }).then(() => done(true), (e) => {
          if (e && e.name === 'AbortError') message('save.notShared', ['save.notShared.1']);
          else if (download(text, name)) done(false); else failed();
        });
        return;
      }
    } catch (e) { /* no share sheet here: a download instead */ }
    if (download(text, name)) done(false); else failed();
  }
  function download(text, name) {
    try {
      const blob = new Blob([text], { type: SF.MIME }), a = document.createElement('a');
      if (!('download' in a)) return false;
      a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- WHERE IS IT? (steps for this browser)
  SF.browser = function () {
    const ua = navigator.userAgent || '', mac = /Mac/i.test(navigator.platform || ua);
    if (/iPhone|iPad|iPod/i.test(ua) || (mac && navigator.maxTouchPoints > 1)) return { id: 'ios' };
    if (/Android/i.test(ua)) return { id: 'android' };
    if (/Edg\//.test(ua)) return { id: 'edge', keys: mac ? 'OPTION+CMD+L' : 'CTRL+J' };
    if (/Firefox\//.test(ua)) return { id: 'firefox', keys: mac ? 'CMD+SHIFT+J' : 'CTRL+SHIFT+Y' };
    if (/Chrome\/|Chromium\//.test(ua) && !/OPR\//.test(ua)) return { id: 'chrome', keys: mac ? 'OPTION+CMD+L' : 'CTRL+J' };
    if (/Safari\//.test(ua)) return { id: 'safari', keys: 'OPTION+CMD+L' };
    return { id: 'other' };
  };
  SF.whereIsIt = whereIsIt;
  function whereIsIt() {
    const b = SF.browser(), n = AQ.LangData ? AQ.LangData.count(`save.where.${b.id}`) : 4, lines = [];
    for (let i = 1; i <= n; i++) lines.push([`save.where.${b.id}.${i}`, { keys: b.keys || '', file: SF.lastFile || SF.fileName() }]);
    lines.push('save.where.keep');
    SF.panel = { kind: 'msg', title: 'save.where', lines, left: true, buttons: [['ok', 'ui.ok']] };
  }

  // ---------------------------------------------------------------- restore
  SF.chooseFile = function (game) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.aquadise,.json,application/json,application/octet-stream,text/plain';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (file) SF.restoreFile(file, game);
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
  SF.refuse = (why) => { const r = REFUSE[why] || REFUSE.damaged; message(r[0], r[1]); return false; };
  // check a file; if it's good, ask before replacing the current game
  SF.restoreFile = function (file, game) {
    if (!file || file.size > cfg().maxImportBytes || file.size === 0) return Promise.resolve(SF.refuse('unreadable'));
    return file.text().then((text) => SF.restoreText(text, game), () => SF.refuse('unreadable'));
  };
  // check save data (text); if it's good, ask before replacing the current game
  SF.restoreText = function (text, game) {
    let data = null;
    try { data = S().parse(text); } catch (e) { return SF.refuse('notsave'); }
    return SF.restoreData(data, game);
  };
  SF.restoreData = function (data, game) {
    const verdict = S().check(data);
    if (verdict !== 'ok') return SF.refuse(verdict);
    const caught = Object.keys(data.state.collection || {}).length, total = AQ.Collection.progress().total;
    SF.panel = { kind: 'confirm', data, title: 'save.replace',
      lines: [data.savedAt ? ['save.replace.1', { n: caught, total, date: shownDate(data.savedAt) }] : ['save.replace.1old', { n: caught, total }], 'save.replace.2'],
      buttons: [['replace', 'save.replaceBtn'], ['cancel', 'ui.cancel']] };
    return true;
  };
  // A backup being restored keeps the latest "last backup" date: its own (it was a backup when it was
  // made, so at least its save time), or this browser's if that's newer.
  function keepBackupDate(data) {
    const mine = SF.lastBackup(), st = data.state, theirs = (st.backups && st.backups.lastAt) || data.savedAt || null;
    const t = (x) => (x ? new Date(x).getTime() || 0 : 0), best = t(mine) >= t(theirs) ? mine : theirs;
    st.backups = Object.assign({}, st.backups || {}, best ? { lastAt: best } : {});
  }
  // load a save object the normal way: write it, then reload so it goes through the usual loading + migration
  function loadSave(data, game, isBackup) {
    if (isBackup) keepBackupDate(data);
    if (S().writeRaw(data)) { S().wiped = true; window.onbeforeunload = null; location.reload(); return; }
    // storage blocked: load it for this session only
    S().apply(data, game);
    game.upgrades = AQ.State.upgrades; game.player.speedLevel = game.upgrades.speed;
    if (AQ.Aquarium) { AQ.Aquarium.fish = []; AQ.Aquarium.biome = null; }
    if (AQ.Starfall) AQ.Starfall.init();
    AQ.Scenes.restore(game, game.scene, game.player.x, game.player.y);
    message('save.loaded', ['save.loaded.1', 'save.loaded.2']);
  }
  SF.loadSave = loadSave;

  // ---------------------------------------------------------------- recovery (the save can't be read)
  SF.openRecover = function () {
    const b = S().backup;
    SF.panel = b
      ? { kind: 'recover', title: 'save.recover', lines: [['save.recover.safety', { date: shownDate(b.savedAt) }], 'save.recover.safety2'], buttons: [['restore', 'save.useSafetyBtn'], ['fresh', 'save.freshBtn']] }
      : { kind: 'recover', title: 'save.recover', lines: ['save.recover.none', 'save.recover.none2'], buttons: [['file', 'save.restoreBtn'], ['fresh', 'save.freshBtn']] };
  };

  // ---------------------------------------------------------------- the SAVE & BACKUP panel
  const HUB = { x: 22, y: 12, w: 276, h: 158 };
  // from: 'title' | 'pause'. On the title screen with no save, RESTORE is the one to press.
  SF.openHub = function (game, from) {
    SF.panel = { kind: 'hub', from, title: 'save.hub' };
    SF.sel = SF.hasProgress() ? 0 : 1;
    AQ.Audio.play('menu_select');
  };
  SF.hasProgress = () => (AQ.Title && AQ.Title.hasProgress ? AQ.Title.hasProgress() : Object.keys(AQ.State.collection || {}).length > 0);
  function hubLayout() {
    const x = HUB.x, y = HUB.y, w = HUB.w, cx = x + w / 2, prog = SF.hasProgress();
    const ui = [
      { id: 'backup', x: cx - 90, y: y + 52, w: 180, h: 15, label: AQ.t('save.backupBtn'), big: true, off: !prog },
      { id: 'file', x: cx - 90, y: y + 71, w: 180, h: 15, label: AQ.t('save.restoreBtn'), big: true }
    ];
    ui.push({ id: 'erase', x: x + 8, y: y + HUB.h - 15, w: 84, h: 10, label: AQ.t('save.eraseBtn'), small: true, warn: true, off: !prog });
    ui.push({ id: 'close', x: x + w - 58, y: y + HUB.h - 15, w: 50, h: 10, label: AQ.t('ui.close') });
    return ui;
  }
  function hubLines() {
    const failed = S().failed || S().blocked;
    const out = [[failed ? 'save.status.cant' : 'save.status.auto', null, failed ? '#ffcf8a' : '#d8eef8']];
    if (!failed) out.push(['save.status.lastSaved', { when: SF.ago(S().lastSavedAt) }, '#9fd3ee']);
    out.push(['save.status.lastBackup', { when: SF.lastBackup() ? SF.ago(SF.lastBackup(), true) : AQ.t('save.ago.never') }, '#9fd3ee']);
    return out;
  }
  function hubUpdate(game) {
    const I = AQ.Input, m = I.mouse, ui = SF.ui = hubLayout(), live = ui.filter((r) => !r.off);
    SF.hover = ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h) || null;
    if (SF.hover && SF.hover.off) SF.hover = null;
    if (I.rawPressed('ArrowDown', 'KeyS', 'Tab')) { SF.sel = (SF.sel + 1) % ui.length; while (ui[SF.sel].off) SF.sel = (SF.sel + 1) % ui.length; AQ.Audio.play('menu_move'); }
    if (I.rawPressed('ArrowUp', 'KeyW')) { SF.sel = (SF.sel + ui.length - 1) % ui.length; while (ui[SF.sel].off) SF.sel = (SF.sel + ui.length - 1) % ui.length; AQ.Audio.play('menu_move'); }
    if (SF.hover && (m.x !== SF.mx || m.y !== SF.my)) SF.sel = ui.indexOf(SF.hover);
    SF.mx = m.x; SF.my = m.y;
    let pick = m.pressed[0] && SF.hover ? SF.hover.id : null;
    if (!pick && I.rawPressed('Enter', 'Space') && ui[SF.sel] && !ui[SF.sel].off) pick = ui[SF.sel].id;
    if (!pick && I.rawPressed('Escape')) pick = 'close';
    void live;
    return pick;
  }
  function hubDraw(g) {
    const x = HUB.x, y = HUB.y, w = HUB.w, cx = x + w / 2;
    g.fillStyle = 'rgba(4,10,20,0.6)'; g.fillRect(0, 0, 320, 180);
    g.fillStyle = 'rgba(6,18,34,0.97)'; g.fillRect(x, y, w, HUB.h);
    g.fillStyle = '#6ef0ef'; g.fillRect(x, y, w, 1);
    F().draw(g, AQ.t('save.hub'), cx, y + 5, '#fff6dc', { align: 'center', shadow: false, max: w - 10 });
    // how saving stands
    g.fillStyle = '#0d2236'; g.fillRect(x + 6, y + 15, w - 12, 31);
    hubLines().forEach(([k, v, col], i) => F().draw(g, AQ.t(k, v || undefined), x + 11, y + 19 + i * 8, col, { shadow: false, max: w - 22 }));
    // the two big buttons (RESTORE lit when there's nothing to back up yet)
    const ui = SF.ui = SF.ui.length ? SF.ui : hubLayout(), prog = SF.hasProgress();
    ui.forEach((r, i) => {
      const lit = !r.off && (SF.sel === i || SF.hover === r);
      if (r.big) {
        const main = (r.id === 'backup' && prog) || (r.id === 'file' && !prog);
        g.fillStyle = r.off ? '#122030' : lit ? '#2e7d96' : main ? '#1f5a72' : '#16334a'; g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = r.off ? '#22384c' : lit ? '#bff6ff' : '#6ef0ef'; g.fillRect(r.x, r.y, r.w, 1);
        F().draw(g, r.label, r.x + r.w / 2, r.y + 5, r.off ? '#4f6f86' : '#ffffff', { align: 'center', shadow: false, max: r.w - 8 });
      } else AQ.Aquarium.button(g, Object.assign({}, r, { on: lit && !r.warn }), lit);
    });
    // the plain explainer (and, with nothing saved yet, where to restore)
    const hint = AQ.t(prog ? 'save.explain' : 'save.explainNew');
    wrapPx(hint.toUpperCase(), w - 24).slice(0, 3).forEach((l, i) => F().draw(g, l, cx, y + 93 + i * 8, '#8aa4b8', { align: 'center', shadow: false }));
    g.fillStyle = '#1c3a52'; g.fillRect(x + 6, y + HUB.h - 20, w - 12, 1);
  }

  // ---------------------------------------------------------------- erase (asks twice, backup first offered)
  function eraseAsk() {
    SF.panel = { kind: 'erase', title: 'save.erase', lines: ['save.erase.1', 'save.erase.2'], buttons: [['erasebackup', 'save.eraseBackupFirst'], ['erase1', 'save.eraseAnyway'], ['hub', 'ui.cancel']] };
  }
  function eraseSure() {
    SF.panel = { kind: 'erase', title: 'save.eraseSure', lines: ['save.eraseSure.1'], buttons: [['erase2', 'save.eraseBtnFinal'], ['hub', 'ui.cancel']] };
  }

  // ---------------------------------------------------------------- the paste box (save codes: stage 3 uses it)
  // A real text box over the game (typing goes to it, not the game).
  SF.textBox = function (mode, text, game, onDone) {
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
    if (mode === 'paste') btn(T('save.box.restore'), () => { const v = box.value.trim(); SF.closeBox(); if (v) (onDone || SF.restoreText)(v, game || AQ.Game); else SF.panel = null; }, true);
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
    p.wrapped = [];
    p.lines.forEach((l, i) => { const ws = wrapPx(tx(l).toUpperCase(), BOX_W - 14); ws.forEach((w) => p.wrapped.push(w)); if (p.left && i < p.lines.length - 1) p.wrapped.push(''); });
    if (p.left) p.wrapped = p.wrapped.filter((w, i, a) => w || (i > 0 && a[i - 1]));   // (steps: a small gap between them)
    const lh = p.left ? 7 : 8, h = 35 + p.wrapped.length * lh, x = 160 - BOX_W / 2, y = Math.round(90 - h / 2);
    p.rect = { x, y, w: BOX_W, h, lh };
    SF.ui = p.buttons.map(([id, label], i) => ({ id, label: AQ.t(label), x: Math.round(160 - (n * bw + (n - 1) * 8) / 2 + i * (bw + 8)), y: y + h - 15, w: bw, h: 11, warn: /^(fresh|freshyes|erase1|erase2)$/.test(id) }));
  }
  // returns true while a panel is up (the screen underneath ignores input)
  SF.update = function (game) {
    if (!SF.panel) return false;
    const I = AQ.Input, m = I.mouse;
    let pick;
    if (SF.panel.kind === 'hub') pick = hubUpdate(game);
    else {
      layout();
      SF.hover = SF.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
      if (SF.panel.kind === 'box') {                               // the text box over the game has the input
        if (I.rawPressed('Escape')) { I.consume('Escape'); SF.closeBox(); SF.panel = null; }
        else if (m.pressed[0] && SF.hover) { m.pressed[0] = false; SF.closeBox(); SF.panel = null; }
        return true;
      }
      pick = m.pressed[0] && SF.hover ? SF.hover.id : null;
      if (!pick && I.rawPressed('Escape')) pick = SF.panel.kind === 'recover' ? null : SF.panel.buttons[SF.panel.buttons.length - 1][0];   // Esc = the safe choice
      if (!pick && I.rawPressed('Enter') && SF.panel.kind === 'msg') pick = SF.panel.buttons[SF.panel.buttons.length - 1][0];
    }
    if (!pick) return true;
    I.consume('Escape', 'Enter'); m.pressed[0] = false;
    const p = SF.panel, back = () => (S().blocked ? SF.openRecover() : p.from || SF.from ? SF.openHub(game, p.from || SF.from) : (SF.panel = null));
    if (p.kind === 'hub') SF.from = p.from;
    if (pick !== 'backup' && pick !== 'file') AQ.Audio.play('menu_select');
    if (pick === 'close') { SF.panel = null; SF.from = null; }
    else if (pick === 'ok' || pick === 'cancel' || pick === 'hub') back();
    else if (pick === 'backup') SF.backUp(game);
    else if (pick === 'file') { SF.panel = null; SF.chooseFile(game); }
    else if (pick === 'where') whereIsIt();
    else if (pick === 'erase') eraseAsk();
    else if (pick === 'erasebackup') SF.backUp(game, 'erase');
    else if (pick === 'erase1') eraseSure();
    else if (pick === 'erase2') { SF.panel = null; S().reset(); }
    else if (pick === 'replace') { SF.panel = null; loadSave(p.data, game, true); }
    else if (pick === 'restore') { S().blocked = false; SF.panel = null; loadSave(S().backup, game, false); }
    else if (pick === 'fresh') SF.panel = { kind: 'freshconfirm', title: 'save.fresh', lines: ['save.fresh.1', 'save.fresh.2'], buttons: [['freshyes', 'save.freshBtn'], ['back', 'ui.back']] };
    else if (pick === 'freshyes') { S().setAsideUnreadable(); SF.panel = null; }
    else if (pick === 'back') SF.openRecover();
    else if (SF.onPick) SF.onPick(pick, p, game);                   // (later additions)
    return true;
  };
  SF.draw = function (g) {
    if (!SF.panel) return;
    if (SF.panel.kind === 'hub') { hubDraw(g); return; }
    layout();
    const p = SF.panel, r = p.rect;
    g.fillStyle = 'rgba(4,10,20,0.6)'; g.fillRect(0, 0, 320, 180);
    g.fillStyle = 'rgba(6,18,34,0.97)'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = p.kind === 'recover' || p.kind === 'freshconfirm' || p.kind === 'erase' ? '#ffcf8a' : '#6ef0ef'; g.fillRect(r.x, r.y, r.w, 1);
    F().draw(g, AQ.t(p.title), 160, r.y + 5, '#fff6dc', { align: 'center', shadow: false, max: BOX_W - 10 });
    p.wrapped.forEach((l, i) => F().draw(g, l, p.left ? r.x + 7 : 160, r.y + 15 + i * r.lh, '#9fd3ee', { align: p.left ? 'left' : 'center', shadow: false }));
    for (const b of SF.ui) AQ.Aquarium.button(g, b, SF.hover === b);
  };
  // the small "can't save right now" line for the title / pause screens
  SF.statusLine = () => (S().failed ? AQ.t('save.cantSaveLine') : null);
  return SF;
})();
