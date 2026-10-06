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

  // opts: { align: 'left'|'center'|'right', shadow: color|false, max: px }
  // Long text never overflows: a line wider than `max` (or, without one, wider than the room left on the
  // screen) is squeezed sideways to fit; past AQ.TUNING.text.squeezeMin it is cut short with "..".
  // Text that fits is drawn exactly as always.
  function room(ctx, x, align) {
    const c = ctx.canvas, m = ctx.getTransform ? ctx.getTransform() : null;
    if (!c || !m || m.b || m.c || !m.a) return Infinity;
    const edge = (AQ.TUNING.text && AQ.TUNING.text.screenMargin) || 2, W = c.width, px = m.a * x + m.e;
    const r = align === 'center' ? 2 * Math.min(px - edge, W - edge - px) : align === 'right' ? px - edge : W - edge - px;
    return r / m.a;
  }
  function fit(line, max) {
    const w = width(line);
    if (!(w > max)) return { line, w, k: 1 };
    const lo = (AQ.TUNING.text && AQ.TUNING.text.squeezeMin) || 0.55;
    if (w * lo <= max) return { line, w, k: max / w };
    let cut = line;                                                 // too long even squeezed: cut it short
    while (cut.length > 1 && width(cut + '..') * lo > max) cut = cut.slice(0, -1);
    cut = cut.trimEnd() + '..';
    const cw = width(cut);
    return { line: cut, w: cw, k: Math.min(1, max / cw) };
  }
  function draw(ctx, str, x, y, color = '#fff', opts = {}) {
    str = upper(str);
    const lines = str.split('\n');
    const max = Math.min(opts.max != null ? opts.max : Infinity, room(ctx, x, opts.align));
    lines.forEach((ln, li) => {
      const f = fit(ln, max), line = f.line, w = f.w * f.k;
      let sx = Math.round(opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x);
      const sy = Math.round(y + li * LINE);
      if (f.k < 1) { ctx.save(); ctx.translate(sx, sy); ctx.scale(f.k, 1); sx = 0; }
      const ly = f.k < 1 ? 0 : sy;
      if (opts.shadow !== false) drawLine(ctx, line, sx + 1, ly + 1, opts.shadow || 'rgba(0,0,0,0.55)');
      drawLine(ctx, line, sx, ly, color);
      if (f.k < 1) ctx.restore();
    });
  }
  // how wide a text will be drawn, squeezing included (for laying things out next to it)
  const drawnWidth = (str, max) => { const f = fit(upper(str), max == null ? Infinity : max); return Math.ceil(f.w * f.k); };
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

  return { draw, width, drawnWidth, LINE, GH, has: known, unknown };
})();
