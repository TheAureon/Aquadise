// REDO TUTORIAL: run the guided first dive (src/dive.js) again, from anywhere. Offered by the pause
// menu, the title screen, the Guide (and a friendly nudge, src/nudges.js).
//   1. A small question first: "Redo the tutorial?" (when you're away from the Tide Pools' start, it says
//      you'll go there and come back after), with "Also show the tips again?" YES / NO (NO by default).
//   2. If you're elsewhere (the hill, the building, a tank screen, far out at sea, the title screen), a fade
//      takes you to the Tide Pools' starting spot and the dive starts there. Where you were is kept in the
//      save (AQ.State.tutorial.redo), so it's remembered across a reload.
//   3. When the dive finishes, is skipped through or stopped, a fade takes you back where you were (the
//      scene's own safety check moves you to a safe spot if that one isn't valid any more), with a toast.
// It never changes your progress: the log, upgrades, bottles, tanks and breeding stay as they are. (The
// dive's easy minnow is a real creature: catching it counts as a normal catch, as always.) Tips are
// marked unseen again only if you chose YES. Tuning: AQ.TUNING.redo.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Redo = (function () {
  const R = { dialog: null, ui: [] };
  const F = () => AQ.Font;
  const tut = () => (AQ.State.tutorial = AQ.State.tutorial || { seen: {} });
  const start = () => AQ.data.world.playerStart;
  R.pending = () => tut().redo || null;            // the trip back, while a redo is under way

  // where you are now, as a place to come back to
  function here(game) {
    const P = game.player, A = AQ.Aquarium;
    const ret = { scene: game.scene || 'world', x: Math.round(P.x), y: Math.round(P.y) };
    if (game.state === 'aquarium' || (game.state === 'log' && AQ.LogUI.from === 'aquarium')) { ret.tank = A.biome; ret.tankFrom = A.returnTo || 'play'; }
    return ret;
  }
  // already standing near the Tide Pools' start? then the dive just starts here (no trip)
  function nearStart(game) {
    const s = start(), P = game.player;
    return game.scene === 'world' && game.state !== 'aquarium' && Math.hypot(P.x - s[0], P.y - s[1]) < AQ.TUNING.redo.nearStart;
  }

  // ---------------------------------------------------------------- the question
  R.ask = function (game, from) {
    const away = from === 'title' || !nearStart(game);
    R.dialog = { from, away, tips: false, prevState: game.state };
    AQ.Audio.play('menu_select');
  };
  function layout() {
    const d = R.dialog, T = AQ.t, lines = [T('redo.q')].concat(d.away ? [T('redo.away1'), T('redo.away2')] : []);
    const w = Math.min(300, Math.max(190, ...lines.map((l) => F().width(l) + 14))), h = 22 + lines.length * 7 + 30;
    const x = Math.round(160 - w / 2), y = Math.round(90 - h / 2), ty = y + 14 + lines.length * 7 + 3;
    const tw = F().width(T('redo.tipsQ')), bx = Math.round(160 - (tw + 4 + 30 + 2 + 30) / 2) + tw + 4;
    const ui = [
      { id: 'tips_yes', x: bx, y: ty - 2, w: 30, h: 9, label: T('redo.yes'), on: d.tips },
      { id: 'tips_no', x: bx + 32, y: ty - 2, w: 30, h: 9, label: T('redo.no'), on: !d.tips },
      { id: 'go', x: Math.round(160 - 64), y: y + h - 15, w: 62, h: 11, label: T('redo.go'), on: true },
      { id: 'cancel', x: Math.round(160 + 2), y: y + h - 15, w: 62, h: 11, label: T('ui.cancel') }
    ];
    return { x, y, w, h, lines, ty, tx: bx - tw - 4, ui };
  }
  // while the question is up it has the keyboard and mouse to itself (any screen); true = it used the frame
  R.update = function (game) {
    if (!R.dialog) return false;
    const I = AQ.Input, m = I.mouse, L = layout();
    R.ui = L.ui;
    R.hover = L.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h) || null;
    const d = R.dialog;
    if (I.rawPressed('Escape')) { I.consume('Escape'); R.dialog = null; AQ.Audio.play('menu_move'); return true; }
    if (I.rawPressed('KeyY')) { d.tips = true; AQ.Audio.play('menu_move'); }
    if (I.rawPressed('KeyN')) { d.tips = false; AQ.Audio.play('menu_move'); }
    if (I.rawPressed('Enter', 'NumpadEnter')) { I.consume('Enter'); go(game); return true; }
    if (m.pressed[0]) {
      m.pressed[0] = false;
      if (R.hover) {
        if (R.hover.id === 'tips_yes') { d.tips = true; AQ.Audio.play('menu_move'); }
        else if (R.hover.id === 'tips_no') { d.tips = false; AQ.Audio.play('menu_move'); }
        else if (R.hover.id === 'go') go(game);
        else if (R.hover.id === 'cancel') { R.dialog = null; AQ.Audio.play('menu_move'); }
      }
    }
    return true;
  };
  R.draw = function (g) {
    if (!R.dialog) return;
    const L = layout(), d = R.dialog;
    g.fillStyle = 'rgba(4,10,20,0.5)'; g.fillRect(0, 0, 320, 180);
    g.fillStyle = 'rgba(6,18,34,0.96)'; g.fillRect(L.x, L.y, L.w, L.h);
    g.fillStyle = '#7ef0c0'; g.fillRect(L.x, L.y, L.w, 1);
    F().draw(g, AQ.t('redo.title'), 160, L.y + 4, '#ffe9a8', { align: 'center', shadow: false, max: L.w - 10 });
    L.lines.forEach((l, i) => F().draw(g, l, 160, L.y + 13 + i * 7, i ? '#9fd3ee' : '#e8fbff', { align: 'center', shadow: false, max: L.w - 10 }));
    F().draw(g, AQ.t('redo.tipsQ'), L.tx, L.ty, '#cfe8ff', { shadow: false });
    L.ui.forEach((b) => AQ.Aquarium.button(g, b, R.hover === b));
    void d;
  };

  // ---------------------------------------------------------------- there and back
  function go(game) {
    const d = R.dialog; R.dialog = null;
    if (!d) return;
    AQ.Audio.play('menu_select');
    if (d.tips && AQ.Tips) AQ.Tips.reset();                   // only if you said YES
    const begin = () => {
      game.state = 'play';
      if (AQ.Dive) AQ.Dive.start(game);
      AQ.HUD.helpT = 0;
      AQ.Save && AQ.Save.dirty();
    };
    if (!d.away) { begin(); return; }
    tut().redo = here(game);                                   // the way back (saved)
    if (game.state === 'aquarium' && AQ.Aquarium) AQ.Aquarium.leaveQuietly();   // a piece you were carrying goes back
    AQ.Transition.go(() => {
      const s = start();
      game.state = 'play';
      AQ.Scenes.restore(game, 'world', s[0], s[1]);
      if (AQ.Title) AQ.FX.list.length = 0;
      AQ.HUD.bannerT = 0; AQ.HUD.lastZone = '';
      begin();
    });
  };
  // the dive is over (finished, skipped through or stopped): back to where you were
  R.diveEnded = function (game) {
    const ret = R.pending();
    if (!ret) return;
    delete tut().redo;
    AQ.Save && AQ.Save.dirty();
    game = game || AQ.Game;
    AQ.Transition.go(() => {
      game.state = 'play';
      AQ.Scenes.restore(game, ret.scene || 'world', ret.x, ret.y);   // (validated: a safe spot if this one isn't)
      if (ret.tank && AQ.Aquarium && AQ.Tanks.get(ret.tank)) AQ.Aquarium.open(game, ret.tankFrom || 'play', ret.tank);
    }, { done: () => AQ.HUD.toast(AQ.t('redo.back'), '#7ef0c0', 4) });
  };
  return R;
})();
