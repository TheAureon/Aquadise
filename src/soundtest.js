// SOUND settings panel (title screen + pause menu) and the SOUND TEST screen.
//   AQ.SoundUI     MUSIC / EFFECTS volume, MUTE, a way into the sound test. Saved with the game.
//   AQ.SoundTest   every effect, ambience bed and music piece, each playable (state 'soundtest').
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SoundUI = (function () {
  const F = () => AQ.Font, A = AQ.Audio;
  // The SETTINGS panel (title screen + pause menu), in tabs: SOUND, OPTIONS, TOUCH. Everything is saved
  // with the game (AQ.State.settings / the audio settings).
  const S = { sel: 0, ui: [], tab: 'sound' };
  const BOX = { x: 52, y: 22, w: 216, h: 154 };
  const TABS = [['sound', 'SOUND'], ['options', 'OPTIONS'], ['touch', 'TOUCH']];
  const set = () => (AQ.State.settings = AQ.State.settings || {});
  const touchMode = () => set().touchControls || 'auto';
  // the rows of each tab: bar (a volume), btn (a toggle / cycle, `value` is its label), wide (an action)
  function rows() {
    const st = A.settings();
    if (S.tab === 'sound') return [
      { id: 'music', kind: 'bar', label: 'MUSIC', bar: st.music }, { id: 'sfx', kind: 'bar', label: 'EFFECTS', bar: st.sfx },
      { id: 'mute', kind: 'btn', label: 'MUTE', value: st.mute ? 'MUTED' : 'SOUND ON', warn: st.mute },
      { id: 'test', kind: 'wide', value: 'SOUND TEST' }];
    if (S.tab === 'options') return [
      { id: 'hints', kind: 'btn', label: 'TIPS', value: !AQ.Tips || AQ.Tips.hintsOn() ? 'HINTS ON' : 'HINTS OFF' },
      { id: 'resettips', kind: 'btn', label: 'SEE AGAIN', value: S.resetDone > 0 ? 'TIPS RESET!' : 'RESET TIPS' },
      { id: 'flashing', kind: 'btn', label: 'FLASHING', value: AQ.U.calm() ? 'REDUCED' : 'NORMAL', on: AQ.U.calm() },
      { id: 'language', kind: 'btn', label: AQ.t('settings.language'), value: AQ.Lang.name(AQ.Lang.code), off: AQ.Lang.available().length < 2 }];
    return [
      { id: 'touchmode', kind: 'btn', label: 'TOUCH CONTROLS', value: touchMode().toUpperCase() },
      { id: 'swap', kind: 'btn', label: 'SIDES', value: set().swapSides ? 'SWAPPED' : 'NORMAL', on: !!set().swapSides }].concat(S.extraTouchRows ? S.extraTouchRows() : []);
  }
  const order = () => ['tabs'].concat(rows().map((r) => r.id), ['back']);
  S.open = function () { S.sel = 0; };
  function layout() {
    const ui = [];
    TABS.forEach(([id, label], i) => ui.push({ id: 'tab:' + id, row: 'tabs', x: BOX.x + 10 + i * 66, y: BOX.y + 14, w: 64, h: 11, label, on: S.tab === id }));
    rows().forEach((r, i) => {
      const y = BOX.y + 34 + i * 15;
      if (r.kind === 'bar') {
        ui.push({ id: r.id + '-', row: r.id, x: 146, y, w: 10, h: 9, label: '-' });
        ui.push({ id: r.id + '+', row: r.id, x: 224, y, w: 10, h: 9, label: '+' });
        ui.push({ id: r.id + 'bar', row: r.id, x: 159, y, w: 62, h: 9, bar: r.bar });
      } else if (r.kind === 'wide') ui.push({ id: r.id, row: r.id, x: 110, y, w: 100, h: 11, label: r.value });
      else ui.push({ id: r.id, row: r.id, x: 146, y, w: 106, h: 10, label: r.value, warn: r.warn, on2: r.on, off: r.off });
      ui.push({ id: 'label:' + r.id, row: r.id, label: r.label, y, text: true });
    });
    ui.push({ id: 'back', row: 'back', x: 110, y: BOX.y + BOX.h - 22, w: 100, h: 11, label: 'BACK' });
    return ui;
  }
  function nudge(row, dir) {
    if (row === 'tabs') { const i = TABS.findIndex((t) => t[0] === S.tab); S.tab = TABS[(i + dir + TABS.length) % TABS.length][0]; A.play('menu_move'); return; }
    if (row !== 'music' && row !== 'sfx') return;
    A.setVolume(row, A.settings()[row] + dir * 0.1);
    A.play('menu_move');
  }
  function activate(id, game, onBack, onTest) {
    const dirty = () => { A.play('menu_select'); AQ.Save && AQ.Save.dirty(); };
    if (id.startsWith('tab:')) { S.tab = id.slice(4); A.play('menu_move'); }
    else if (id === 'mute') { A.toggleMute(); A.play('menu_select'); }
    else if (id === 'hints') { AQ.Tips.setHints(!AQ.Tips.hintsOn()); dirty(); }
    else if (id === 'flashing') { set().reduceFlashing = !AQ.U.calm(); dirty(); }
    else if (id === 'language') {                 // the next language that exists (only the ones with a file)
      const list = AQ.Lang.available(), next = list[(list.indexOf(AQ.Lang.code) + 1) % list.length];
      if (list.length > 1) { set().language = AQ.Lang.set(next); dirty(); }
    }
    else if (id === 'resettips') { AQ.Tips.reset(); S.resetDone = 2; dirty(); }
    else if (id === 'touchmode') { const m = ['auto', 'on', 'off'], i = m.indexOf(touchMode()); set().touchControls = m[(i + 1) % 3]; if (AQ.Touch) AQ.Touch.refresh(); dirty(); }
    else if (id === 'swap') { set().swapSides = !set().swapSides; dirty(); }
    else if (S.activateExtra && S.activateExtra(id, game, dirty)) { /* handled by a later addition */ }
    else if (id === 'test') { A.play('menu_select'); onTest(); }
    else if (id === 'back') { A.play('menu_select'); AQ.Save && AQ.Save.save(game); onBack(); }
    else if (/[-+]$/.test(id)) nudge(id.slice(0, -1), id.endsWith('+') ? 1 : -1);
  }
  // returns nothing; calls onBack() / onTest() when the player leaves the panel
  S.update = function (game, onBack, onTest) {
    const I = AQ.Input, m = I.mouse;
    S.resetDone = Math.max(0, (S.resetDone || 0) - 1 / 60);
    S.ui = layout();
    const ord = order();
    if (S.sel >= ord.length) S.sel = ord.length - 1;
    if (I.rawPressed('Escape')) { AQ.Save && AQ.Save.save(game); A.play('menu_select'); onBack(); return; }
    if (I.rawPressed('ArrowUp', 'KeyW')) { S.sel = (S.sel + ord.length - 1) % ord.length; A.play('menu_move'); }
    if (I.rawPressed('ArrowDown', 'KeyS')) { S.sel = (S.sel + 1) % ord.length; A.play('menu_move'); }
    if (I.rawPressed('ArrowLeft', 'KeyA')) nudge(ord[S.sel], -1);
    if (I.rawPressed('ArrowRight', 'KeyD')) nudge(ord[S.sel], 1);
    S.hover = S.ui.find((r) => !r.text && m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (S.hover && (m.x !== S.mx || m.y !== S.my)) S.sel = Math.max(0, ord.indexOf(S.hover.row));
    S.mx = m.x; S.my = m.y;
    if (m.pressed[0] && S.hover) {
      if (S.hover.bar != null) { A.setVolume(S.hover.row, (m.x - S.hover.x + 3) / S.hover.w); A.play('menu_move'); }
      else activate(S.hover.id, game, onBack, onTest);
    } else if (I.rawPressed('Enter', 'Space')) {
      const row = ord[S.sel];
      if (row === 'tabs') nudge('tabs', 1);
      else if (row !== 'music' && row !== 'sfx') activate(row, game, onBack, onTest);
    }
  };
  S.draw = function (g) {
    const st = A.settings(), ord = order(), selRow = ord[S.sel];
    g.fillStyle = 'rgba(6,20,38,0.95)'; g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    g.fillStyle = 'rgba(110,240,239,0.6)'; g.fillRect(BOX.x, BOX.y, BOX.w, 1); g.fillRect(BOX.x, BOX.y + BOX.h - 1, BOX.w, 1);
    F().draw(g, 'SETTINGS', 160, BOX.y + 4, '#6ef0ef', { align: 'center', shadow: false });
    g.fillStyle = 'rgba(110,240,239,0.25)'; g.fillRect(BOX.x + 8, BOX.y + 28, BOX.w - 16, 1);
    for (const r of S.ui) {
      if (r.text) { F().draw(g, r.label, 66, r.y + (rows().find((x) => x.id === r.row).kind === 'bar' ? 2 : 3), selRow === r.row ? '#ffffff' : '#9fd3ee', { shadow: false }); continue; }
      if (r.bar != null) {
        for (let i = 0; i < 10; i++) { g.fillStyle = i < Math.round(r.bar * 10) ? (st.mute ? '#5f7a8c' : '#6ef0ef') : '#16334a'; g.fillRect(r.x + i * 6 + 1, r.y + 2, 5, 5); }
        F().draw(g, `${Math.round(r.bar * 100)}%`, 258, r.y + 2, '#c3dfec', { align: 'right', shadow: false });
      } else if (r.row === 'tabs') AQ.Aquarium.button(g, r, S.hover === r || (selRow === 'tabs' && r.on));   // the open tab is lit
      else AQ.Aquarium.button(g, Object.assign({}, r, { on: (r.on || r.on2 || selRow === r.row) && !r.warn }), S.hover === r);
    }
    if (selRow !== 'tabs' && selRow !== 'back') { const r = S.ui.find((u) => u.text && u.row === selRow); if (r) F().draw(g, '>', 59, r.y + 3, '#6ef0ef', { shadow: false }); }
    const foot = S.tab === 'sound' ? `${AQ.Keys.name('mute')}: QUICK MUTE ANYWHERE` : S.tab === 'touch' ? (AQ.Touch && AQ.Touch.active() ? 'TOUCH CONTROLS ARE ON' : 'TOUCH CONTROLS ARE OFF RIGHT NOW') : 'SAVED WITH YOUR GAME';
    F().draw(g, foot, 160, BOX.y + BOX.h - 8, '#7fa4ba', { align: 'center', shadow: false });
  };
  return S;
})();

AQ.SoundTest = (function () {
  const F = () => AQ.Font, A = AQ.Audio;
  const T = { tab: 0, sel: 0, ui: [], from: 'title' };
  const TABS = [['sfx', 'EFFECTS'], ['amb', 'AMBIENCE'], ['music', 'MUSIC']];
  const COLS = 4, CW = 76, CH = 8, STEP = 9, X0 = 8, Y0 = 28;

  T.open = function (game, from) {
    T.from = from; T.prevState = game.state; T.sel = 0;
    game.state = 'soundtest';
  };
  function items() {
    const kind = TABS[T.tab][0];
    if (kind === 'music') return AQ.Music.catalog().map((p) => ({ id: p.id, label: p.label, stinger: p.stinger, key: 'music:' + p.id.split(':')[0] }));
    const list = A.list(kind);
    if (kind === 'sfx') {
      const order = [];
      list.forEach((s) => { if (order.indexOf(s.group) < 0) order.push(s.group); });
      list.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
    }
    return list.map((s) => ({ id: kind === 'amb' ? s.bed : s.id, label: s.label, key: s.id }));
  }
  function layout() {
    const ui = TABS.map(([, name], i) => ({ id: 'tab', i, x: 60 + i * 68, y: 14, w: 64, h: 10, label: name, on: i === T.tab }));
    ui.push({ id: 'back', x: 270, y: 2, w: 46, h: 10, label: 'BACK' });
    items().forEach((it, i) => ui.push({ id: 'item', i, it, x: X0 + (i % COLS) * (CW + 2), y: Y0 + Math.floor(i / COLS) * STEP, w: CW, h: CH, label: it.label }));
    return ui;
  }
  const playing = (it) => (TABS[T.tab][0] === 'amb' ? AQ.Ambience.test === it.id : TABS[T.tab][0] === 'music' ? AQ.Music.test === it.id : false);
  function trigger(it) {
    const kind = TABS[T.tab][0];
    if (kind === 'sfx') A.play(it.id, { important: true });
    else if (kind === 'amb') AQ.Ambience.test = AQ.Ambience.test === it.id ? null : it.id;
    else if (it.stinger) AQ.Music.stinger(it.id);
    else AQ.Music.test = AQ.Music.test === it.id ? null : it.id;
  }
  function setTab(i) { T.tab = (i + TABS.length) % TABS.length; T.sel = 0; A.play('menu_move'); }
  function close(game) {
    AQ.Music.test = null; AQ.Ambience.test = null;
    A.play('menu_select');
    if (T.from === 'title') { AQ.Title.open(game); AQ.Title.panel = 'sound'; }
    else { game.state = 'pause'; AQ.PauseUI.panel = 'sound'; }
  }

  T.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    T.ui = layout();
    const n = items().length;
    if (I.rawPressed('Escape')) { close(game); return; }
    if (I.rawPressed('KeyQ', 'Tab')) setTab(T.tab + (I.isDown('ShiftLeft', 'ShiftRight') ? -1 : 1));
    if (I.rawPressed('KeyE')) setTab(T.tab + 1);
    const mv = (d) => { T.sel = Math.max(0, Math.min(n - 1, T.sel + d)); A.play('menu_move'); };
    if (I.rawPressed('ArrowLeft', 'KeyA')) mv(-1);
    if (I.rawPressed('ArrowRight', 'KeyD')) mv(1);
    if (I.rawPressed('ArrowUp', 'KeyW')) mv(-COLS);
    if (I.rawPressed('ArrowDown', 'KeyS')) mv(COLS);
    T.hover = T.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (T.hover && T.hover.id === 'item' && (m.x !== T.mx || m.y !== T.my)) T.sel = T.hover.i;
    T.mx = m.x; T.my = m.y;
    if (m.pressed[0] && T.hover) {
      if (T.hover.id === 'tab') setTab(T.hover.i);
      else if (T.hover.id === 'back') close(game);
      else if (T.hover.id === 'item') trigger(T.hover.it);
    } else if (I.rawPressed('Enter', 'Space')) { const it = items()[T.sel]; if (it) trigger(it); }
  };

  T.draw = function (g) {
    g.fillStyle = '#06101e'; g.fillRect(0, 0, 320, 180);
    F().draw(g, 'SOUND TEST', 8, 4, '#ffe9a8');
    const st = A.settings();
    if (st.mute) F().draw(g, `MUTED - PRESS ${AQ.TUNING.audio.muteKey.replace('Key', '')}`, 160, 4, '#ffb08a', { align: 'center' });
    let cur = null;
    for (const r of T.ui) {
      if (r.id !== 'item') { AQ.Aquarium.button(g, r, T.hover === r); continue; }
      const sel = r.i === T.sel, on = playing(r.it);
      if (sel) cur = r.it;
      g.fillStyle = on ? '#2e7d96' : sel ? '#24506b' : '#132b40'; g.fillRect(r.x, r.y, r.w, r.h);
      if (sel) { g.fillStyle = '#6ef0ef'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
      F().draw(g, (on ? '> ' : '') + r.label, r.x + 3, r.y + 1, on ? '#ffffff' : '#c3dfec', { shadow: false });
    }
    const kind = TABS[T.tab][0];
    if (cur) F().draw(g, `ID: ${cur.key.replace(/_/g, ' ')}${A.hasRecording(cur.key) ? '  (RECORDING)' : ''}${kind === 'sfx' ? '' : kind === 'amb' ? '  (LOOPS - CLICK AGAIN TO STOP)' : cur.stinger ? '  (PLAYS OVER THE MUSIC)' : '  (CLICK AGAIN TO STOP)'}`, 8, 162, '#8fb6cc');
    F().draw(g, 'CLICK / ENTER: PLAY   Q/E: SWITCH LIST   ESC: BACK', 160, 172, '#5f7f96', { align: 'center' });
  };
  return T;
})();
