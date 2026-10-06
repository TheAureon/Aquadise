// The collection-log button: the discovered counter in the HUD's top-right corner ("31/77", src/hud.js)
// with a small book beside it. Clicking or tapping it opens the collection log, exactly like the log key.
//   - It shows the counter exactly as before; hover lights it up, holding it down presses it in.
//   - A click on it is used up: it never swings the net or reaches anything underneath.
//   - With touch, its hit area grows to a comfortable thumb size (AQ.TUNING.logButton.touchPx); it looks
//     the same.
//   - It's dimmed and does nothing whenever the log key wouldn't work: a scene transition, the guided
//     dive's first question, the touch MENU panel, or any screen other than play / map.
//   - Until it's been clicked once (saved: AQ.State.flags.logButton), it glows gently now and then
//     (AQ.TUNING.logButton.pulseEvery / pulseSeconds), so players who don't read know it's a button.
// Works wherever the HUD counter shows: the sea (also with the map open), the hill and the aquarium building.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.LogButton = (function () {
  const B = { down: false, t: 0 };
  const cfg = () => AQ.TUNING.logButton;
  const F = () => AQ.Font;
  const touch = () => !!(AQ.Touch && AQ.Touch.active());
  B.used = () => !!(AQ.State.flags && AQ.State.flags.logButton);

  // where it is (game px): the number right-aligned at the edge as before, the book just left of it
  B.rect = function () {
    const vw = AQ.TUNING.view.w, c = AQ.Collection.progress(), txt = `${c.discovered}/${c.total}`, w = F().width(txt);
    return { x: vw - 4 - w - 11, y: 1, w: w + 13, h: 10, txt };
  };
  // the part that answers a click: the button itself with the mouse, a thumb-sized area with touch
  function hitRect() {
    const r = B.rect();
    if (!touch()) return r;
    const canvas = document.getElementById('game'), scale = canvas ? canvas.getBoundingClientRect().width / AQ.TUNING.view.w : 1;
    const need = cfg().touchPx / Math.max(0.5, scale), w = Math.max(r.w, need), h = Math.max(r.h, need * 0.8);
    const vw = AQ.TUNING.view.w, x = Math.min(vw - w, r.x + r.w / 2 - w / 2);
    const mr = AQ.TUNING.touch.menuGameRect;           // never over the touch MENU button just below
    return { x, y: 0, w, h: Math.min(h, mr ? mr[1] - 1 : h) };
  }
  const inR = (r, m) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;

  // can it open the log right now? (the same moments the log key works: see src/game.js)
  B.enabled = function (game) {
    if (game.state !== 'play' && game.state !== 'map') return false;
    if (AQ.Transition && (AQ.Transition.active || AQ.Transition.blocking())) return false;
    if (AQ.Dive && AQ.Dive.prompt) return false;                // the guided dive's first question is up
    if (AQ.Touch && AQ.Touch.menuOpen) return false;
    return !!AQ.LogUI;
  };

  // before anything else reads the mouse this frame: a press on the button belongs to the button
  B.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    B.t += dt;
    const on = B.enabled(game), over = m.inside !== false && inR(hitRect(), m);
    B.hover = on && over && !touch();
    if (m.pressed[0] && over && (game.state === 'play' || game.state === 'map')) {
      m.pressed[0] = false;                                     // used up: never a net swing
      if (on) { B.down = true; AQ.Audio.play('menu_move'); }
      return false;
    }
    if (B.down && !m.down[0]) {
      B.down = false;
      if (on && over) {                                         // let go over it: open the log
        AQ.State.flags = AQ.State.flags || {};
        if (!AQ.State.flags.logButton) { AQ.State.flags.logButton = true; AQ.Save && AQ.Save.dirty(); }
        AQ.LogUI.open(game);
        I.endFrame();
        return true;
      }
    }
    return false;
  };

  // the glow, 0..1: a soft swell now and then until it has been clicked once
  function glow() {
    if (B.used()) return 0;
    const c = cfg(), p = B.t % c.pulseEvery;
    if (p > c.pulseSeconds) return 0;
    return Math.sin(p / c.pulseSeconds * Math.PI) * (AQ.U.calm() ? 0.6 : 1);
  }
  // a tiny closed book (7 x 7): a gold cover with a darker spine, a title band and pale page edges
  function book(g, x, y, col, shadow) {
    const px = (a, b, w = 1, h = 1) => { g.fillRect(x + a, y + b, w, h); };
    if (shadow) { g.fillStyle = shadow; g.fillRect(x + 1, y + 1, 7, 7); }
    g.fillStyle = col; px(1, 0, 5, 7);
    g.fillStyle = '#b8862e'; px(0, 0, 1, 7);                     // the spine
    g.fillStyle = '#f4f0e0'; px(6, 1, 1, 5);                     // page edges
    g.fillStyle = 'rgba(90,60,20,0.85)'; px(2, 2, 3, 1); px(2, 4, 3, 1);   // a title on the cover
  }

  B.draw = function (ctx, game) {
    const r = B.rect(), on = B.enabled(game), SH = 'rgba(4,12,24,0.75)', pressed = B.down && on, gl = on ? glow() : 0;
    const dy = pressed ? 1 : 0;
    if (gl > 0) {                                               // the gentle "I'm a button" glow
      ctx.fillStyle = `rgba(255,233,168,${(0.28 * gl).toFixed(3)})`; ctx.fillRect(r.x - 2, r.y - 1, r.w + 4, r.h + 2);
      ctx.fillStyle = `rgba(255,233,168,${(0.18 * gl).toFixed(3)})`; ctx.fillRect(r.x - 3, r.y, r.w + 6, r.h);
    }
    if (B.hover || pressed) {
      ctx.fillStyle = pressed ? 'rgba(46,125,150,0.85)' : 'rgba(36,80,107,0.75)'; ctx.fillRect(r.x, r.y + dy, r.w, r.h);
      ctx.fillStyle = 'rgba(160,220,240,0.5)'; ctx.fillRect(r.x, r.y + dy, r.w, 1);
    }
    ctx.globalAlpha = on ? 0.85 + 0.15 * gl : 0.4;
    book(ctx, r.x + 2, r.y + 1 + dy, B.hover || pressed ? '#fff3c8' : '#ffe9a8', B.hover || pressed ? null : SH);
    F().draw(ctx, r.txt, AQ.TUNING.view.w - 4, 4 + dy, B.hover || pressed ? '#fff6dc' : '#ffe9a8', { align: 'right', shadow: B.hover || pressed ? false : SH });
    ctx.globalAlpha = 1;
    // the tooltip (mouse only): just left of the button
    if (B.hover && !pressed) {
      const tip = AQ.t('hud.logTip', { key: AQ.Keys.name('log') }), w = F().width(tip) + 6, x = r.x - w - 3;
      ctx.fillStyle = 'rgba(6,18,34,0.92)'; ctx.fillRect(x, r.y, w, r.h);
      ctx.fillStyle = '#5fc6d9'; ctx.fillRect(x, r.y, w, 1);
      F().draw(ctx, tip, x + 3, r.y + 2, '#e8fbff', { shadow: false });
    }
  };
  return B;
})();
