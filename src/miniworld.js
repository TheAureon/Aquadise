// Small self-contained collision maps for side scenes (the hill, the aquarium building).
// Same query interface the player uses on the big world (solid / water / air / boxHits ...),
// plus ladders and one-way platforms (you can stand on them, and climb or jump up through them).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.MiniWorld = function (w, h) {
  const WATER = 0, SOLID = 1, AIR = 2;
  const W = { w, h, sea: h + 1000, mask: new Uint8Array(w * h).fill(AIR), ladders: [], oneWay: [], oneWayOn: true };

  W.fillRect = function (x, y, rw, rh, v = SOLID) {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(h, Math.ceil(y + rh)); yy++)
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(w, Math.ceil(x + rw)); xx++) W.mask[yy * w + xx] = v;
  };
  // ground surface per column: everything at or below surface[x] is solid
  W.fillGround = function (surface) {
    for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.round(surface[x])); y < h; y++) W.mask[y * w + x] = SOLID;
  };
  W.addLadder = (x, top, bottom) => { W.ladders.push({ x, top, bottom }); };
  W.addOneWay = (x, y, pw) => { W.oneWay.push({ x, y, w: pw }); };

  W.at = function (x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= w || y >= h) return SOLID;
    if (y < 0) return AIR;
    return W.mask[y * w + x];
  };
  W.solid = (x, y) => W.at(x, y) === SOLID;
  W.water = () => false;
  W.air = (x, y) => W.at(x, y) !== SOLID;
  W.open = (x, y) => W.at(x, y) !== SOLID;
  W.boxHits = function (cx, cy, hw, hh) {
    const x0 = Math.floor(cx - hw), x1 = Math.floor(cx + hw - 0.001), y0 = Math.floor(cy - hh), y1 = Math.floor(cy + hh - 0.001);
    for (let x = x0; x <= x1; x += 2) { if (W.solid(x, y0) || W.solid(x, y1)) return true; }
    if (W.solid(x1, y0) || W.solid(x1, y1)) return true;
    for (let y = y0; y <= y1; y += 2) { if (W.solid(x0, y) || W.solid(x1, y)) return true; }
    // one-way platforms only catch your feet, and only while you're not rising or climbing
    if (W.oneWayOn) for (const p of W.oneWay) if (x1 >= p.x && x0 < p.x + p.w && y1 >= p.y && y1 <= p.y + 2) return true;
    return false;
  };
  W.groundBelow = function (x, y, max = 400) {
    for (let i = 0; i <= max; i++) if (W.solid(x, y + i)) return y + i;
    return null;
  };
  W.lineClear = () => true;
  // ladder whose climbable column contains (x, y)
  W.ladderAt = function (x, y) {
    for (const L of W.ladders) if (Math.abs(x - L.x) <= 6 && y >= L.top - 3 && y <= L.bottom) return L;
    return null;
  };
  // is (x, y) a spot the player can stand in?
  W.standable = function (x, y) {
    const hb = AQ.TUNING.swim.hitbox;
    return x > 8 && x < w - 8 && y > 4 && y < h - 6 && !W.boxHits(x, y, hb.w / 2, hb.h / 2);
  };
  return W;
};
