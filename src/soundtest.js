// SOUND settings panel (title screen + pause menu) and the SOUND TEST screen.
//   AQ.SoundUI     MUSIC / EFFECTS volume, MUTE, a way into the sound test. Saved with the game.
//   AQ.SoundTest   every effect, ambience bed and music piece, each playable (state 'soundtest').
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.SoundUI = (function () {
  const F = () => AQ.Font, A = AQ.Audio;
  const S = { sel: 0, ui: [] };
  const BOX = { x: 64, y: 34, w: 192, h: 142 };
  const ROWS = ['music', 'sfx', 'mute', 'hints', 'resettips', 'test', 'back'];
  const Y = { music: 49, sfx: 61, mute: 74, hints: 97, resettips: 110, test: 127, back: 141 };   // row positions

  S.open = function () { S.sel = 0; };
  function layout() {
    const st = A.settings(), ui = [];
    [['music', Y.music], ['sfx', Y.sfx]].forEach(([k, y]) => {
      ui.push({ id: k + '-', row: k, x: 132, y, w: 10, h: 9, label: '-' });
      ui.push({ id: k + '+', row: k, x: 210, y, w: 10, h: 9, label: '+' });
      ui.push({ id: k + 'bar', row: k, x: 145, y, w: 62, h: 9, bar: st[k] });
    });
    ui.push({ id: 'mute', row: 'mute', x: 132, y: Y.mute, w: 88, h: 10, label: st.mute ? 'MUTED' : 'SOUND ON', warn: st.mute });
    // tutorial tips (src/tips.js): on / off, and show them all again
    const hints = !AQ.Tips || AQ.Tips.hintsOn();
    ui.push({ id: 'hints', row: 'hints', x: 132, y: Y.hints, w: 88, h: 10, label: hints ? 'HINTS ON' : 'HINTS OFF' });
    ui.push({ id: 'resettips', row: 'resettips', x: 132, y: Y.resettips, w: 88, h: 10, label: S.resetDone > 0 ? 'TIPS RESET!' : 'RESET TIPS' });
    ui.push({ id: 'test', row: 'test', x: 110, y: Y.test, w: 100, h: 11, label: 'SOUND TEST' });
    ui.push({ id: 'back', row: 'back', x: 110, y: Y.back, w: 100, h: 11, label: 'BACK' });
    return ui;
  }
  function nudge(row, dir) {
    if (row !== 'music' && row !== 'sfx') return;
    A.setVolume(row, A.settings()[row] + dir * 0.1);
    A.play('menu_move');
  }
  function activate(id, game, onBack, onTest) {
    if (id === 'mute') { A.toggleMute(); A.play('menu_select'); }
    else if (id === 'hints') { AQ.Tips.setHints(!AQ.Tips.hintsOn()); A.play('menu_select'); AQ.Save && AQ.Save.dirty(); }
    else if (id === 'resettips') { AQ.Tips.reset(); S.resetDone = 2; A.play('menu_select'); AQ.Save && AQ.Save.dirty(); }
    else if (id === 'test') { A.play('menu_select'); onTest(); }
    else if (id === 'back') { A.play('menu_select'); AQ.Save && AQ.Save.save(game); onBack(); }
    else if (/[-+]$/.test(id)) nudge(id.slice(0, -1), id.endsWith('+') ? 1 : -1);
  }
  // returns nothing; calls onBack() / onTest() when the player leaves the panel
  S.update = function (game, onBack, onTest) {
    const I = AQ.Input, m = I.mouse;
    S.resetDone = Math.max(0, (S.resetDone || 0) - 1 / 60);
    S.ui = layout();
    if (I.rawPressed('Escape')) { AQ.Save && AQ.Save.save(game); A.play('menu_select'); onBack(); return; }
    if (I.rawPressed('ArrowUp', 'KeyW')) { S.sel = (S.sel + ROWS.length - 1) % ROWS.length; A.play('menu_move'); }
    if (I.rawPressed('ArrowDown', 'KeyS')) { S.sel = (S.sel + 1) % ROWS.length; A.play('menu_move'); }
    if (I.rawPressed('ArrowLeft', 'KeyA')) nudge(ROWS[S.sel], -1);
    if (I.rawPressed('ArrowRight', 'KeyD')) nudge(ROWS[S.sel], 1);
    S.hover = S.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (S.hover && (m.x !== S.mx || m.y !== S.my)) S.sel = ROWS.indexOf(S.hover.row);
    S.mx = m.x; S.my = m.y;
    if (m.pressed[0] && S.hover) {
      if (S.hover.bar != null) { A.setVolume(S.hover.row, (m.x - S.hover.x + 3) / S.hover.w); A.play('menu_move'); }
      else activate(S.hover.id, game, onBack, onTest);
    } else if (I.rawPressed('Enter', 'Space')) {
      const row = ROWS[S.sel];
      if (row !== 'music' && row !== 'sfx') activate(row, game, onBack, onTest);
    }
  };
  S.draw = function (g) {
    const st = A.settings();
    g.fillStyle = 'rgba(6,20,38,0.94)'; g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    g.fillStyle = 'rgba(110,240,239,0.6)'; g.fillRect(BOX.x, BOX.y, BOX.w, 1); g.fillRect(BOX.x, BOX.y + BOX.h - 1, BOX.w, 1);
    F().draw(g, 'SOUND', 160, BOX.y + 4, '#6ef0ef', { align: 'center', shadow: false });
    F().draw(g, 'HINTS', 80, Y.hints - 10, '#6ef0ef', { shadow: false });
    g.fillStyle = 'rgba(110,240,239,0.25)'; g.fillRect(104, Y.hints - 8, 136, 1);
    const label = { music: ['MUSIC', Y.music + 2], sfx: ['EFFECTS', Y.sfx + 2], mute: ['MUTE', Y.mute + 3], hints: ['TIPS', Y.hints + 3], resettips: ['SEE AGAIN', Y.resettips + 3] };
    for (const k in label) F().draw(g, label[k][0], 80, label[k][1], ROWS[S.sel] === k ? '#ffffff' : '#9fd3ee', { shadow: false });
    const selRow = ROWS[S.sel], arrowY = Y[selRow] + (selRow === 'music' || selRow === 'sfx' ? 2 : 3);
    F().draw(g, '>', selRow === 'test' || selRow === 'back' ? 102 : 73, arrowY, '#6ef0ef', { shadow: false });
    for (const r of S.ui) {
      if (r.bar != null) {
        for (let i = 0; i < 10; i++) { g.fillStyle = i < Math.round(r.bar * 10) ? (st.mute ? '#5f7a8c' : '#6ef0ef') : '#16334a'; g.fillRect(r.x + i * 6 + 1, r.y + 2, 5, 5); }
        F().draw(g, `${Math.round(r.bar * 100)}%`, 238, r.y + 2, '#c3dfec', { align: 'right', shadow: false });
      } else AQ.Aquarium.button(g, Object.assign({}, r, { on: ROWS[S.sel] === r.row && !r.warn }), S.hover === r);
    }
    F().draw(g, `${AQ.Keys.name('mute')}: QUICK MUTE ANYWHERE`, 160, BOX.y + BOX.h - 10, '#7fa4ba', { align: 'center', shadow: false });
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
    if (cur) F().draw(g, `ID: ${cur.key}${A.hasRecording(cur.key) ? '  (RECORDING)' : ''}${kind === 'sfx' ? '' : kind === 'amb' ? '  (LOOPS - CLICK AGAIN TO STOP)' : cur.stinger ? '  (PLAYS OVER THE MUSIC)' : '  (CLICK AGAIN TO STOP)'}`, 8, 162, '#8fb6cc');
    F().draw(g, 'CLICK / ENTER: PLAY   Q/E: SWITCH LIST   ESC: BACK', 160, 172, '#5f7f96', { align: 'center' });
  };
  return T;
})();
