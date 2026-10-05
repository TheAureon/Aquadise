// Tiny 3x5 bitmap font so HUD text stays crisp on the low-res canvas.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Font = (function () {
  // the character table lives in data/glyphs.js (add glyphs there); anything missing draws as a small box
  const BOXKEY = '\u0000box';
  const G = Object.assign({}, AQ.data.glyphs, { [BOXKEY]: ['###', '#.#', '#.#', '#.#', '###'] });
  const known = (ch) => G[ch] !== undefined && ch !== BOXKEY;
  const unknown = new Set();               // characters drawn that have no glyph yet (tools/check-game.js lists them)
  // most glyphs are 3 wide; a few (♂ ♀) are wider - each glyph advances by its own width + 1
  const GW = 5, GH = 5, LINE = 7;
  const gw = (k) => (G[k] ? G[k][0].length : 3);
  const adv = (ch) => gw(ch) + 1;
  const atlases = new Map();
  const keys = Object.keys(G);

  function atlas(color) {
    let a = atlases.get(color);
    if (a) return a;
    const c = document.createElement('canvas');
    c.width = keys.length * GW; c.height = GH;
    const x = c.getContext('2d');
    x.fillStyle = color;
    const index = {};
    keys.forEach((k, i) => {
      index[k] = i;
      G[k].forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') x.fillRect(i * GW + rx, ry, 1, 1); });
    });
    a = { canvas: c, index };
    atlases.set(color, a);
    return a;
  }

  // upper case with the current language's rules (English: the same as toUpperCase)
  const upper = (s) => { try { return String(s).toLocaleUpperCase(AQ.Lang ? AQ.Lang.locale() : 'en'); } catch (e) { return String(s).toUpperCase(); } };
  function width(str) { let w = 0; for (const ch of upper(str)) w += adv(ch); return Math.max(0, w - 1); }

  // opts: { align: 'left'|'center'|'right', shadow: color|false }
  function draw(ctx, str, x, y, color = '#fff', opts = {}) {
    str = upper(str);
    const lines = str.split('\n');
    lines.forEach((line, li) => {
      let w = width(line);
      let sx = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x);
      const sy = Math.round(y + li * LINE);
      if (opts.shadow !== false) drawLine(ctx, line, sx + 1, sy + 1, opts.shadow || 'rgba(0,0,0,0.55)');
      drawLine(ctx, line, sx, sy, color);
    });
  }
  function drawLine(ctx, line, x, y, color) {
    const a = atlas(color);
    let cx = x;
    for (const ch of line) {
      // a character the font doesn't have yet draws as a small box (never nothing, never an error)
      const k = known(ch) ? ch : BOXKEY, gi = a.index[k];
      if (k === BOXKEY) unknown.add(ch);
      if (gi !== undefined) ctx.drawImage(a.canvas, gi * GW, 0, gw(k), GH, cx, y, gw(k), GH);
      cx += adv(ch);
    }
  }

  return { draw, width, LINE, GH, has: known, unknown };
})();
