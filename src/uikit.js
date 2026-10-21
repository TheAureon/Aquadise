// The shared look of the game's menus: buttons, panels, on / off switches and "cycle" arrows. Every screen
// draws its buttons with AQ.Kit.button (AQ.Aquarium.button is the same function), so the whole game keeps
// one style. Colours: AQ.TUNING.ui.
//   AQ.Kit.button(g, r, hover)        r = { x, y, w, h, label, on, warn, off, pane }; hover also means
//                                     "picked with the keyboard" (it gets a light ring); held down, it sinks
//   AQ.Kit.panel(g, r, { edge, title, shadow })   an opaque box with rounded corners and a soft shadow
//   AQ.Kit.toggle(g, x, y, on, dim)   a 13x7 switch (knob right + lit = on)
//   AQ.Kit.cycle(g, r, col)           small < > marks at a button's ends: clicking steps through choices
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Kit = (function () {
  const K = {};
  const F = () => AQ.Font;
  const cfg = () => AQ.TUNING.ui;

  // a box with its four corner pixels cut off (reads as rounded at this size)
  function rounded(g, x, y, w, h) { g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, 1, h - 2); g.fillRect(x + w - 1, y + 1, 1, h - 2); }
  // a 1px outline of that shape
  function ring(g, x, y, w, h) { g.fillRect(x + 1, y, w - 2, 1); g.fillRect(x + 1, y + h - 1, w - 2, 1); g.fillRect(x, y + 1, 1, h - 2); g.fillRect(x + w - 1, y + 1, 1, h - 2); }
  K.rounded = rounded; K.ring = ring;

  K.button = function (g, r, hover) {
    const c = cfg().button, m = AQ.Input && AQ.Input.mouse;
    const live = hover && !r.off;
    const down = live && m && m.down[0] && m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;
    g.fillStyle = r.off ? c.off : r.warn ? (live ? c.warnHover : c.warn) : r.on ? (live ? c.onHover : c.on) : live ? c.hover : c.fill;
    rounded(g, r.x, r.y, r.w, r.h);
    if (!down) {                                    // light from above: a bright top edge and a darker bottom edge
      g.fillStyle = c.shine; g.fillRect(r.x + 1, r.y, r.w - 2, 1);
      g.fillStyle = c.shade; g.fillRect(r.x + 1, r.y + r.h - 1, r.w - 2, 1);
    } else { g.fillStyle = c.shade; g.fillRect(r.x + 1, r.y, r.w - 2, 1); }   // held down: shadow on top instead
    if (live) { g.globalAlpha = 0.6; g.fillStyle = c.ring; ring(g, r.x, r.y, r.w, r.h); g.globalAlpha = 1; }
    const dy = down ? cfg().pressShift : 0, iw = r.pane ? 9 : 0;   // a pane icon after the label (EXPAND: 20 ▢)
    if (r.label) F().draw(g, r.label, r.x + (r.w - iw) / 2, r.y + Math.floor((r.h - 5) / 2) + dy, r.off ? c.textOff : c.text, { align: 'center', max: r.w - 2 - iw });   // a long label squeezes to fit
    if (iw) { g.globalAlpha = r.off ? 0.45 : 1; AQ.Assets.draw(g, 'ui.pane', 'idle', r.x + r.w - 7, r.y + 5 + dy, { frame: 0 }); g.globalAlpha = 1; }
  };

  K.panel = function (g, r, o = {}) {
    const c = cfg().panel;
    if (o.shadow !== false) { g.fillStyle = c.shadow; rounded(g, r.x + 2, r.y + 2, r.w, r.h); }
    g.fillStyle = o.fill || c.fill; rounded(g, r.x, r.y, r.w, r.h);
    g.fillStyle = o.edge || c.edge; ring(g, r.x, r.y, r.w, r.h);
    g.fillStyle = c.shine; g.fillRect(r.x + 2, r.y + 1, r.w - 4, 1);
    if (o.title) F().draw(g, o.title, r.x + r.w / 2, r.y + 5, o.titleColor || c.title, { align: 'center', shadow: false, max: r.w - 8 });
  };

  K.toggle = function (g, x, y, on, dim) {
    const c = cfg().toggle;
    g.globalAlpha = dim ? 0.45 : 1;
    g.fillStyle = on ? c.on : c.off; rounded(g, x, y, 13, 7);
    g.fillStyle = 'rgba(0,8,16,0.35)'; g.fillRect(x + 1, y + 6, 11, 1);
    g.fillStyle = on ? c.knob : c.knobOff; rounded(g, on ? x + 7 : x + 1, y + 1, 5, 5);
    g.globalAlpha = 1;
  };

  K.cycle = function (g, r, col) {
    const cy = r.y + Math.floor(r.h / 2), l = r.x + 3, rt = r.x + r.w - 4;
    g.fillStyle = col || 'rgba(232,251,255,0.55)';
    g.fillRect(l, cy, 1, 1); g.fillRect(l + 1, cy - 1, 1, 3);           // <
    g.fillRect(rt, cy, 1, 1); g.fillRect(rt - 1, cy - 1, 1, 3);         // >
  };

  return K;
})();
