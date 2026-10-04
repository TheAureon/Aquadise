// The GUIDE: a small paged field-guide book. Open it from the title screen, the pause menu or with the
// guide key during play (shown on the help line). Left / right (or A / D, or a click on the arrows) turns
// the page; Esc or the guide key closes it. Pages come from data/tutorial.js (guide); a page or line that
// needs a feature the build doesn't have is left out. Key names and config numbers are filled in live.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Guide = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const G = { page: 0, from: 'play', ui: [] };
  const has = (needs) => !needs || !!AQ[needs];
  G.pages = () => (AQ.data.tutorial.guide || []).filter((p) => has(p.needs));

  // {k:action} keys, {c:path.to.value} config numbers, {inv:path} "1 in N" for a chance
  const cfgAt = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), AQ.TUNING);
  G.fill = (text) => AQ.Keys.fill(text)
    .replace(/\{c:([\w.]+)\}/g, (m, p) => String(cfgAt(p)))
    .replace(/\{inv:([\w.]+)\}/g, (m, p) => String(Math.round(1 / cfgAt(p))));

  G.open = function (game, from) {
    G.from = from || game.state; G.prev = game.state;
    game.state = 'guide';
    G.page = U.clamp(G.page, 0, G.pages().length - 1);
    AQ.Audio.play('log_open');
  };
  G.close = function (game) {
    AQ.Audio.play('log_close');
    game.state = G.prev === 'pause' ? 'pause' : G.prev === 'title' ? 'title' : 'play';
  };
  function turn(d) {
    const n = G.pages().length, np = U.clamp(G.page + d, 0, n - 1);
    if (np !== G.page) { G.page = np; AQ.Audio.play('page_turn'); }
  }

  // ---------------------------------------------------------------- layout + input
  const BOOK = { x: 12, y: 10, w: 296, h: 158 };
  function layout() {
    const n = G.pages().length, ui = [];
    ui.push({ id: 'prev', x: BOOK.x + 8, y: BOOK.y + BOOK.h - 16, w: 30, h: 11, label: '<', off: G.page <= 0 });
    ui.push({ id: 'next', x: BOOK.x + BOOK.w - 38, y: BOOK.y + BOOK.h - 16, w: 30, h: 11, label: '>', off: G.page >= n - 1 });
    ui.push({ id: 'close', x: BOOK.x + BOOK.w - 40, y: BOOK.y + 4, w: 34, h: 10, label: 'CLOSE' });
    return ui;
  }
  G.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    G.ui = layout();
    G.hover = G.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (I.rawPressed('Escape') || AQ.Keys.pressed('guide')) { G.close(game); return; }
    if (I.rawPressed('ArrowLeft', 'KeyA')) turn(-1);
    if (I.rawPressed('ArrowRight', 'KeyD')) turn(1);
    if (m.pressed[0] && G.hover) {
      if (G.hover.id === 'prev') turn(-1);
      else if (G.hover.id === 'next') turn(1);
      else if (G.hover.id === 'close') G.close(game);
    }
  };

  // ---------------------------------------------------------------- drawing
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && F().width(t) > px) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function illustration(g, icon, cx, cy, force) {
    if (/^ui:/.test(icon)) {
      g.save(); g.translate(cx, cy); g.scale(3, 3); AQ.Assets.draw(g, 'ui.icons', 'idle', 0, 0, { frame: +icon.slice(3) }); g.restore();
      return;
    }
    const e = AQ.Assets.entry(icon); if (!e) return;
    const v = e.vis || [0, 0, e.fw - 1, e.fh - 1], vw = v[2] - v[0] + 1, vh = v[3] - v[1] + 1;
    const sc = force || Math.max(1, Math.min(3, Math.floor(Math.min(52 / vw, 52 / vh))));
    const mx = Math.round((v[0] + v[2] + 1) / 2), my = Math.round((v[1] + v[3] + 1) / 2);
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    AQ.Assets.draw(g, icon, 'idle', e.anchor[0] - mx, e.anchor[1] - my, { t: AQ.Render.t });
    g.restore();
  }
  G.draw = function (g) {
    const pages = G.pages(), p = pages[G.page];
    g.fillStyle = 'rgba(4,10,20,0.82)'; g.fillRect(0, 0, 320, 180);
    // the book: warm paper pages with a spine down the middle-left
    const b = BOOK;
    g.fillStyle = '#3a2a1e'; g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    g.fillStyle = '#efe4c8'; g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = '#e2d4b0'; g.fillRect(b.x + 82, b.y, 2, b.h);
    g.fillStyle = 'rgba(120,90,60,0.18)'; g.fillRect(b.x + 84, b.y, 3, b.h);
    F().draw(g, 'FIELD GUIDE', b.x + 8, b.y + 6, '#8a5a3a', { shadow: false });
    if (!p) return;
    // left: the picture, in a soft blue window
    g.fillStyle = '#c8dde6'; g.fillRect(b.x + 10, b.y + 22, 64, 64);
    g.fillStyle = '#a9c8d6'; g.fillRect(b.x + 10, b.y + 80, 64, 6);
    illustration(g, p.icon, b.x + 42, b.y + 52, p.scale);
    F().draw(g, `PAGE ${G.page + 1} OF ${pages.length}`, b.x + 42, b.y + 94, '#8a7a5a', { align: 'center', shadow: false });
    // right: title + text
    const X = b.x + 94, W = b.x + b.w - 8 - X;
    F().draw(g, p.title.toUpperCase(), X, b.y + 22, '#3a5a7a', { shadow: false });
    g.fillStyle = 'rgba(58,90,122,0.4)'; g.fillRect(X, b.y + 30, W, 1);
    let y = b.y + 36;
    for (const ln of p.lines) {
      const line = typeof ln === 'string' ? ln : has(ln.needs) ? ln.text : null;
      if (!line) continue;
      wrapPx(G.fill(line).toUpperCase(), W).forEach((w, k) => { F().draw(g, (k ? '  ' : '') + w, X, y, '#3a3226', { shadow: false }); y += 8; });
      y += 2;
    }
    // footer: arrows, page dots, how to close
    for (const r of G.ui) AQ.Aquarium.button(g, r, G.hover === r && !r.off);
    pages.forEach((_, i) => { g.fillStyle = i === G.page ? '#3a5a7a' : '#c4b48e'; g.fillRect(Math.round(160 - pages.length * 3.5 + i * 7), b.y + b.h - 11, 4, 4); });
    F().draw(g, AQ.Keys.fill('LEFT / RIGHT: TURN    ESC / {k:guide}: CLOSE'), 160, b.y + b.h + 4, '#8aa4b8', { align: 'center', shadow: false });
  };
  return G;
})();
