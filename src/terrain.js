// Terrain bitmaps (milestone 1: flat placeholder colouring; replaced by the pixel-art generator in M2).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Terrain = (function () {
  const T = { chunks: [], lights: [] };
  T.build = function (W) {
    T.chunks = [];
    W.biomes.forEach((b) => {
      const [rx, ry, rw, rh] = b.rect;
      const x0 = Math.max(0, rx), y0 = Math.max(0, ry), w = Math.min(W.w, rx + rw) - x0, h = Math.min(W.h, ry + rh) - y0;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
      const rock = AQ.U.hex(b.palette.rock[0]), top = AQ.U.hex(b.palette.top[0]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const wx = x0 + x, wy = y0 + y;
        if (!W.solid(wx, wy) || W.biomeAt(wx, wy) !== b) continue;
        const col = W.depthDist(wx, wy) <= 4 ? top : rock, i = (y * w + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      T.chunks.push({ x: x0, y: y0, w, h, canvas: c });
    });
  };
  T.draw = function (ctx, cam) {
    const l = cam.left(), t = cam.top();
    for (const c of T.chunks) {
      if (c.x > l + cam.w || c.x + c.w < l || c.y > t + cam.h || c.y + c.h < t) continue;
      ctx.drawImage(c.canvas, c.x - l, c.y - t);
    }
  };
  return T;
})();
