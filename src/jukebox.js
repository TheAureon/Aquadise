// The JUKEBOX: the MUSIC page (the pause menu's MUSIC, or the jukebox by the station's directory). Lists every
// DELTA song; one shows by name once you've heard it begin somewhere, before that as "???" with its place.
// Pick any heard song to play it: PREVIOUS / PLAY-PAUSE / STOP / NEXT, a position bar, SHUFFLE and REPEAT ONE
// (both saved). While the jukebox plays, the frequency setting waits and Ataraxia stays a thin bed under it;
// closing the page keeps the music going until STOP (or the end of the list). Nothing is gated behind it.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Jukebox = (function () {
  const F = () => AQ.Font, D = () => AQ.Delta;
  const J = { sel: 0, scroll: 0, ui: [], on: false, prev: 'play' };
  const BOX = { x: 12, y: 8, w: 296, h: 164 }, ROW = 9, ROWS = 10, LIST_Y = 26;
  const set = () => { const s = (AQ.State.settings = AQ.State.settings || {}); return (s.music = s.music || {}); };
  J.shuffle = () => !!set().shuffle;
  J.repeat = () => !!set().repeat;
  J.active = () => J.on;
  J.list = () => (D() ? D().all() : []);
  J.heard = (s) => !!(AQ.State.music && AQ.State.music.heard && AQ.State.music.heard[s.id]);
  const heardList = () => J.list().filter(J.heard);
  // how an unheard song shows: "???" and its place (a night song: AT NIGHT)
  function hint(s) {
    if (s.time === 'night') return AQ.t('jukebox.night');
    const p = (s.places || [])[0];
    return p ? AQ.t(`music.${p}`) : '';
  }

  J.open = function (game) {
    J.prev = game.state === 'pause' ? 'pause' : 'play';
    game.state = 'jukebox';
    const cur = D() && D().playing(), list = J.list();
    J.sel = Math.max(0, cur ? list.indexOf(cur) : list.findIndex(J.heard));
    AQ.Audio.play('log_open');
  };
  J.close = function (game) { AQ.Audio.play('log_close'); game.state = J.prev; };

  // ---------------------------------------------------------------- playing
  J.play = function (s) {
    if (!s || !J.heard(s) || !D() || !D().player) return;
    J.on = true; J.cur = s.id;
    D().begin(s, 'jukebox');
  };
  J.toggle = function () {                                         // PLAY / PAUSE
    const P = D() && D().player;
    if (!P) return;
    if (P.song && D().how === 'jukebox') { if (P.paused != null) P.resume(); else P.pause(); return; }
    J.play(J.list()[J.sel] && J.heard(J.list()[J.sel]) ? J.list()[J.sel] : heardList()[0]);
  };
  J.stop = function () { J.on = false; if (D() && D().playing()) D().player.stop(AQ.TUNING.delta.pauseFade); };
  // the next (or previous) heard song: in list order, or a random other one with SHUFFLE
  function step(dir) {
    const h = heardList();
    if (!h.length) return null;
    if (J.shuffle() && h.length > 1) { let s; do { s = h[Math.floor(Math.random() * h.length)]; } while (s.id === J.cur); return s; }
    const i = h.findIndex((s) => s.id === J.cur);
    return h[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + h.length) % h.length];
  }
  J.next = () => J.play(step(1));
  J.prevSong = () => J.play(step(-1));
  // the song ran out (src/delta.js): repeat it, or go on to the next
  J.ended = function () { if (!J.on) return; J.play(J.repeat() ? D().byId(J.cur) : step(1)); };

  // ---------------------------------------------------------------- layout + input
  function layout() {
    const ui = [], list = J.list();
    J.scroll = Math.max(0, Math.min(J.scroll, list.length - ROWS));
    if (J.sel < J.scroll) J.scroll = J.sel; else if (J.sel >= J.scroll + ROWS) J.scroll = J.sel - ROWS + 1;
    ui.push({ id: 'close', x: BOX.x + BOX.w - 46, y: BOX.y + 4, w: 40, h: 10, label: AQ.t('ui.close') });
    list.slice(J.scroll, J.scroll + ROWS).forEach((s, k) => ui.push({ id: 'song', i: J.scroll + k, s, x: BOX.x + 8, y: LIST_Y + k * ROW, w: BOX.w - 16, h: ROW - 1 }));
    const P = D() && D().player, mine = P && P.song && D().how === 'jukebox', paused = mine && P.paused != null;
    const y = BOX.y + BOX.h - 18, row = [
      { id: 'prev', w: 22, label: AQ.t('jukebox.prev') }, { id: 'toggle', w: 40, label: AQ.t(mine && !paused ? 'jukebox.pause' : 'jukebox.play') },
      { id: 'stop', w: 32, label: AQ.t('jukebox.stop'), off: !mine }, { id: 'next', w: 22, label: AQ.t('jukebox.next') },
      { id: 'shuffle', w: 56, label: AQ.t('jukebox.shuffle'), on: J.shuffle() }, { id: 'repeat', w: 66, label: AQ.t('jukebox.repeat'), on: J.repeat() }];
    AQ.Aquarium.fitRow(row, BOX.x + 8, BOX.x + BOX.w - 8, 3, 'left');
    let x = BOX.x + 8;
    row.forEach((r) => { if (r.x == null) { r.x = x; } x = r.x + r.w + 3; r.y = y; r.h = 11; ui.push(r); });
    return ui;
  }
  J.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, list = J.list();
    J.ui = layout();
    if (I.rawPressed('Escape')) { J.close(game); return; }
    const mv = (d) => { J.sel = Math.max(0, Math.min(list.length - 1, J.sel + d)); AQ.Audio.play('menu_move'); };
    if (I.rawPressed('ArrowUp', 'KeyW')) mv(-1);
    if (I.rawPressed('ArrowDown', 'KeyS')) mv(1);
    if (I.rawPressed('ArrowLeft', 'KeyA')) J.prevSong();
    if (I.rawPressed('ArrowRight', 'KeyD')) J.next();
    if (m.wheel) { J.scroll += m.wheel > 0 ? 1 : -1; J.sel = Math.max(J.scroll, Math.min(J.scroll + ROWS - 1, J.sel)); }
    J.hover = J.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (J.hover && J.hover.id === 'song' && (m.x !== J.mx || m.y !== J.my)) J.sel = J.hover.i;
    J.mx = m.x; J.my = m.y;
    const act = (id, r) => {
      if (id === 'close') J.close(game);
      else if (id === 'song') { if (J.heard(r.s)) { J.play(r.s); AQ.Audio.play('menu_select'); } }
      else if (id === 'toggle') J.toggle();
      else if (id === 'stop') J.stop();
      else if (id === 'next') J.next();
      else if (id === 'prev') J.prevSong();
      else if (id === 'shuffle') { set().shuffle = !J.shuffle(); AQ.Save && AQ.Save.dirty(); AQ.Audio.play('menu_select'); }
      else if (id === 'repeat') { set().repeat = !J.repeat(); AQ.Save && AQ.Save.dirty(); AQ.Audio.play('menu_select'); }
    };
    if (m.pressed[0] && J.hover && !J.hover.off) act(J.hover.id, J.hover);
    else if (I.rawPressed('Enter')) { const s = list[J.sel]; if (s && J.heard(s)) J.play(s); }
    else if (I.rawPressed('Space')) J.toggle();
  };

  J.draw = function (g) {
    g.fillStyle = 'rgba(4,10,20,0.7)'; g.fillRect(0, 0, 320, 180);
    AQ.Kit.enter(g, 'jukebox'); AQ.Kit.rise(g);
    AQ.Kit.panel(g, BOX, { edge: '#ffb0d8' });
    const list = J.list(), h = heardList();
    F().draw(g, AQ.t('jukebox.title'), BOX.x + 8, BOX.y + 6, '#ffe9a8', { shadow: false, max: 80 });
    F().draw(g, AQ.t('jukebox.count', { n: h.length, total: list.length }), BOX.x + BOX.w - 52, BOX.y + 6, '#8fb6cc', { align: 'right', shadow: false, max: 150 });
    const P = D() && D().player, playing = P && P.song, sel = list[J.sel];
    for (const r of J.ui) {
      if (r.id !== 'song') { AQ.Aquarium.button(g, r, J.hover === r); continue; }
      const known = J.heard(r.s), on = playing && P.song === r.s, picked = r.i === J.sel;
      g.fillStyle = on ? '#24506b' : picked ? '#1b3a52' : '#0f2335'; AQ.Kit.rounded(g, r.x, r.y, r.w, r.h);
      if (picked) { g.fillStyle = '#6ef0ef'; g.fillRect(r.x + 1, r.y + r.h - 1, r.w - 2, 1); }
      const name = known ? AQ.Delta.title(r.s) : AQ.t('jukebox.unknown', { place: hint(r.s) });
      F().draw(g, (on ? '> ' : '') + name, r.x + 4, r.y + 2, known ? (on ? '#ffffff' : '#cfe8ff') : '#5f7f96', { shadow: false, max: r.w - 40 });
      if (known) F().draw(g, AQ.Delta.clock(AQ.Delta.length(r.s)), r.x + r.w - 4, r.y + 2, '#8fb6cc', { align: 'right', shadow: false });
    }
    // what's playing, and where it is
    const by = BOX.y + BOX.h - 31;
    if (playing) {
      const len = AQ.Delta.length(P.song), pos = AQ.Delta.position(), w = BOX.w - 16;
      g.fillStyle = '#132b40'; g.fillRect(BOX.x + 8, by + 8, w, 3);
      g.fillStyle = P.paused != null ? '#8fb6cc' : '#6ef0ef'; g.fillRect(BOX.x + 8, by + 8, Math.round(w * Math.min(1, pos / Math.max(1, len))), 3);
      F().draw(g, AQ.t('jukebox.now', { title: AQ.Delta.title(P.song), pos: AQ.Delta.clock(pos), len: AQ.Delta.clock(len) }), BOX.x + 8, by, '#e8fbff', { shadow: false, max: BOX.w - 16 });
    } else F().draw(g, AQ.t(h.length ? (sel && !J.heard(sel) ? 'jukebox.notYet' : 'jukebox.idle') : 'jukebox.empty'), BOX.x + 8, by, '#8fb6cc', { shadow: false, max: BOX.w - 16 });
    AQ.Kit.leave(g);
    F().draw(g, AQ.t('jukebox.footer'), 160, 174, '#5f7f96', { align: 'center', max: 316 });
  };
  return J;
})();
