// Doors in the sea world (the sunken ship's door + hatches). Listed in data/world.js `doors`.
// A shut door is solid for the player; stand next to it and press interact (E) to open or close it.
// Vertical doors (taller than wide) swing toward you; hatches (wider than tall) flip up on a hinge.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Doors = (function () {
  const U = AQ.U, D = { list: [] };
  const REACH = 16;     // how close (px) you need to be to use a door
  const SPEED = 4;      // opens in ~0.25 s

  D.init = function () {
    D.list = ((AQ.data.world && AQ.data.world.doors) || []).map((d) => Object.assign({ open: 0, want: 0 }, d));
  };
  const shut = (d) => d.open < 0.5;
  const vertical = (d) => d.h > d.w;

  // Is this box blocked by a shut door? (called from AQ.World.boxHits)
  D.blocks = function (x0, y0, x1, y1) {
    for (const d of D.list) if (shut(d) && x1 >= d.x && x0 < d.x + d.w && y1 >= d.y && y0 < d.y + d.h) return true;
    return false;
  };
  function nearest(P) {
    let best = null, bd = REACH;
    for (const d of D.list) {
      const dx = Math.max(d.x - P.x, 0, P.x - (d.x + d.w)), dy = Math.max(d.y - P.y, 0, P.y - (d.y + d.h));
      const dist = Math.hypot(dx, dy);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }
  D.update = function (dt, game, input) {
    const P = game.player, hb = AQ.TUNING.swim.hitbox;
    const d = nearest(P);
    if (d && input.wasPressed(...AQ.TUNING.interactKeys)) {
      if (d.want) {
        // don't shut it on yourself
        const inside = P.x + hb.w / 2 >= d.x && P.x - hb.w / 2 < d.x + d.w && P.y + hb.h / 2 >= d.y && P.y - hb.h / 2 < d.y + d.h;
        if (!inside) d.want = 0;
      } else d.want = 1;
      AQ.Audio.play('door');
    }
    for (const k of D.list) k.open = U.approach(k.open, k.want, dt * SPEED);
  };

  // world-space drawing (wooden door / hatch with a brass handle)
  D.draw = function (ctx) {
    const wood = '#8a5b33', dark = '#5a3a20', light = '#a8743f', brass = '#f2c14e';
    for (const d of D.list) {
      const k = d.open;
      if (vertical(d)) {
        // the frame stays; the leaf narrows as it swings toward you, then shows as a thin edge
        ctx.fillStyle = dark; ctx.fillRect(d.x - 1, d.y - 1, d.w + 2, 1);
        const w = Math.max(1, Math.round(d.w * (1 - k) + 2 * k)), x = d.x + (k > 0.5 ? -2 : 0);
        ctx.fillStyle = k > 0.5 ? light : wood; ctx.fillRect(x, d.y, w, d.h);
        ctx.fillStyle = dark; ctx.fillRect(x, d.y + Math.round(d.h / 3), w, 1); ctx.fillRect(x, d.y + Math.round(d.h * 2 / 3), w, 1);
        if (k < 0.5) { ctx.fillStyle = brass; ctx.fillRect(d.x + d.w - 1, d.y + Math.round(d.h / 2), 1, 2); }
      } else {
        // hatch: hinged on its left end, flips up to stand on end
        const len = Math.round(d.w * (1 - k) + d.h * k), tall = Math.round(d.h * (1 - k) + d.w * k);
        ctx.fillStyle = wood; ctx.fillRect(d.x, d.y + d.h - tall, len, tall);
        ctx.fillStyle = dark;
        if (k < 0.5) { for (let x = d.x + 5; x < d.x + d.w - 2; x += 6) ctx.fillRect(x, d.y, 1, d.h); ctx.fillStyle = brass; ctx.fillRect(d.x + d.w - 4, d.y + 1, 2, 1); }
        else ctx.fillRect(d.x, d.y + d.h - tall, 1, tall);
      }
    }
  };
  // screen-space "E: OPEN DOOR" prompt
  D.drawPrompt = function (ctx, game) {
    const P = game.player, d = nearest(P);
    if (!d || AQ.Transition.active) return;
    const cam = AQ.Camera;
    AQ.Scenes.prompt(ctx, P.x - cam.left(), P.y - cam.top() - 22, `${d.want ? 'CLOSE' : 'OPEN'} ${d.name || 'DOOR'}`);
  };
  return D;
})();
