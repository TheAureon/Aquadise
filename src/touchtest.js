// TOUCH TEST (SETTINGS > TOUCH > TOUCH TEST): a screen for checking the touch controls on a real phone.
// Every on-screen control shows and works here (nothing in the game reacts); each finger gets a numbered
// ring (drawn by src/touch.js on its own canvas), and the screen lists what each finger is doing, the
// joystick's values, which buttons are held, the screen and button sizes, the safe area (notches) and a
// BUZZ button to try the vibration. BACK (or Esc) returns to the settings.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.TouchTest = (function () {
  const T = { ui: [], from: 'title', taps: [] };
  const F = () => AQ.Font;
  T.open = function (game, from) {
    T.from = from; T.taps = [];
    game.state = 'touchtest';
  };
  function close(game) {
    if (AQ.Touch) AQ.Touch.leaveTest();
    AQ.Audio.play('menu_select');
    if (T.from === 'title') { AQ.Title.open(game); AQ.Title.panel = 'sound'; }
    else { game.state = 'pause'; AQ.PauseUI.panel = 'sound'; }
    AQ.SoundUI.tab = 'touch';
  }
  function layout() {
    return [
      { id: 'back', x: 270, y: 2, w: 46, h: 10, label: AQ.t('ui.back') },
      { id: 'buzz', x: 270, y: 14, w: 46, h: 10, label: AQ.t('touchtest.buzz'), off: !(AQ.Touch && AQ.Touch.canVibrate()) }
    ];
  }
  T.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    T.ui = layout();
    T.taps.forEach((t) => { t.t += dt; });
    T.taps = T.taps.filter((t) => t.t < 1.5);
    if (I.rawPressed('Escape')) { close(game); return; }
    if (!m.pressed[0]) return;
    const hit = T.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (hit && hit.id === 'back') { close(game); return; }
    if (hit && hit.id === 'buzz') { if (!hit.off) { try { navigator.vibrate(AQ.TUNING.touch.vibrate.unlock); } catch (e) { /* silent */ } AQ.Audio.play('menu_move'); } return; }
    T.taps.push({ x: m.x, y: m.y, t: 0 });                          // a tap on the game: marked where it landed
  };
  const fix = (v) => (v >= 0 ? ' ' : '') + v.toFixed(2);
  T.draw = function (g) {
    const Tc = AQ.Touch, t = (k, v) => AQ.t(k, v);
    g.fillStyle = '#071526'; g.fillRect(0, 0, 320, 180);
    g.fillStyle = 'rgba(110,240,239,0.08)';
    for (let x = 0; x < 320; x += 20) g.fillRect(x, 0, 1, 180);    // a faint grid, to see where taps land
    for (let y = 0; y < 180; y += 20) g.fillRect(0, y, 320, 1);
    F().draw(g, t('touchtest.title'), 8, 4, '#6ef0ef', { shadow: false });
    const lines = [];
    if (!Tc || !Tc.active()) lines.push([t('touchtest.off'), '#ffcf8a']);
    else lines.push([t('touchtest.hint'), '#9fd3ee']);
    const ps = Tc ? [...Tc.pointers.values()] : [];
    lines.push([ps.length ? t('touchtest.fingers', { n: ps.length }) : t('touchtest.none'), '#ffffff']);
    ps.slice(0, 5).forEach((p, i) => {
      const n = i + 1;
      if (p.role === 'stick') lines.push([t('touchtest.finger.stick', { n }), '#ffe9a8']);
      else if (p.role === 'btn') lines.push([t('touchtest.finger.btn', { n, name: t(`touchtest.btn.${p.btn}`) }), '#ffe9a8']);
      else if (p.role === 'tap') { const at = AQ.Input.mouse; lines.push([t('touchtest.finger.tap', { n, x: Math.round(at.x), y: Math.round(at.y) }), '#ffe9a8']); }
      else lines.push([t('touchtest.finger.none', { n }), '#8aa4b8']);
    });
    const st = AQ.Input.stick;
    lines.push([t('touchtest.stick', { x: fix(st.x), y: fix(st.y) }), '#cfe8ff']);
    const held = Tc ? Tc.heldNames() : [];
    lines.push([held.length ? t('touchtest.held', { list: held.join(', ') }) : t('touchtest.heldNone'), '#cfe8ff']);
    if (Tc) {
      const L = Tc.L || {};
      lines.push([t('touchtest.screen', { w: window.innerWidth, h: window.innerHeight, px: L.size || 0, size: t(`settings.size.${Tc.sizeName()}`) }), '#8aa4b8']);
      const s = Tc.safe; lines.push([t('touchtest.safe', { t: Math.round(s.t), r: Math.round(s.r), b: Math.round(s.b), l: Math.round(s.l) }), '#8aa4b8']);
    }
    lines.forEach(([txt, col], i) => F().draw(g, txt, 8, 28 + i * 9, col, { shadow: false, max: 304 }));   // (below BACK / BUZZ)
    // where taps landed (game px)
    for (const tp of T.taps) { g.globalAlpha = 1 - tp.t / 1.5; g.fillStyle = '#ffe9a8'; g.fillRect(tp.x - 3, tp.y, 7, 1); g.fillRect(tp.x, tp.y - 3, 1, 7); g.globalAlpha = 1; }
    for (const r of T.ui) AQ.Aquarium.button(g, r, false);
  };
  return T;
})();
