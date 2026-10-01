// Sprite loading from assets/manifest.js. Missing files fall back to a magenta box so
// broken art is obvious but never crashes the game.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Assets = (function () {
  const sprites = {};   // key -> { img, entry }

  function load(onProgress) {
    const list = Object.entries((AQ.manifest && AQ.manifest.sprites) || {});
    let done = 0;
    return Promise.all(list.map(([key, entry]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { sprites[key] = { img, entry }; done++; onProgress && onProgress(done / list.length); resolve(); };
      img.onerror = () => {
        console.warn('[assets] missing sprite', entry.file);
        sprites[key] = { img: fallback(entry), entry }; done++; resolve();
      };
      img.src = 'assets/' + entry.file;
    })));
  }

  function fallback(entry) {
    let cols = 1, rows = 1;
    for (const k in entry.anims) { const a = entry.anims[k]; cols = Math.max(cols, (a.col || 0) + a.frames); rows = Math.max(rows, a.row + 1); }
    const c = document.createElement('canvas');
    c.width = cols * entry.fw; c.height = rows * entry.fh;
    const x = c.getContext('2d');
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      x.fillStyle = '#ff00ff'; x.fillRect(i * entry.fw + 2, j * entry.fh + 2, entry.fw - 4, entry.fh - 4);
    }
    return c;
  }

  function has(key) { return !!sprites[key]; }
  function entry(key) { return sprites[key] && sprites[key].entry; }

  // Draws sprite `key`, animation `anim`, at world-space pixel (x, y) (anchor-aligned).
  // opts: { t (seconds, for frame selection), frame, flip, alpha, scale }
  function draw(ctx, key, anim, x, y, opts = {}) {
    const s = sprites[key];
    if (!s) return;
    const e = s.entry;
    const a = e.anims[anim] || e.anims.idle || e.anims[Object.keys(e.anims)[0]];
    const f = opts.frame !== undefined ? opts.frame % a.frames : Math.floor((opts.t || 0) * a.fps) % a.frames;
    const sx = ((a.col || 0) + f) * e.fw, sy = a.row * e.fh;
    const ax = e.anchor[0], ay = e.anchor[1];
    const prevA = ctx.globalAlpha;
    if (opts.alpha !== undefined) ctx.globalAlpha = prevA * opts.alpha;
    const px = Math.round(x), py = Math.round(y);
    if (opts.flip) {
      ctx.save();
      ctx.translate(px + (e.fw - ax), py - ay);
      ctx.scale(-1, 1);
      ctx.drawImage(s.img, sx, sy, e.fw, e.fh, 0, 0, e.fw, e.fh);
      ctx.restore();
    } else {
      ctx.drawImage(s.img, sx, sy, e.fw, e.fh, px - ax, py - ay, e.fw, e.fh);
    }
    ctx.globalAlpha = prevA;
  }

  return { load, draw, has, entry, sprites };
})();
