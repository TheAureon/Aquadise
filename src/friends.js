// Creature friendships. Spend calm moments near a wild creature (close by, moving slowly or sneaking, the
// net away) and each kind slowly gets to know you: one "visit" per calm stay (a species can only count
// one visit every AQ.TUNING.friends.visitCooldown seconds), and after enough visits that species is your
// friend. Then, in the wild, one of them that sees you calmly swims along beside you for a few seconds,
// glows softly while you're near, and now and then leaves a little gift where it was: a shell (a
// keepsake, counted for a badge) or a shiny bit of glass (a glass pane). In your tanks, a friend's cousins
// show a small heart. The log marks friends with a heart. Nothing is ever lost if you never do it, and
// catching works exactly as before (you can still catch a friend's kind).
//
// Only creatures that swim about freely follow (not hidden, buried, crawling, clinging or calling ones).
// Saved: AQ.State.friends = { visits: { species: n }, keepsakes: n } (numbers only).
// Tuning: AQ.TUNING.friends. Text: friend.* in data/lang/en.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Friends = (function () {
  const U = AQ.U;
  const F = { near: null, calmT: 0, last: {}, gifts: [], giftT: 0 };
  const cfg = () => AQ.TUNING.friends;
  const st = () => { const s = AQ.State.friends = AQ.State.friends && typeof AQ.State.friends === 'object' ? AQ.State.friends : {}; s.visits = s.visits || {}; s.keepsakes = s.keepsakes || 0; return s; };
  F.visits = (id) => st().visits[id] || 0;
  F.isFriend = (id) => F.visits(id) >= cfg().visitsNeeded;
  F.count = () => Object.keys(st().visits).filter(F.isFriend).length;
  const canFollow = (c) => !c.def.is_plant && c.movement === 'swim' && !c.hidden && !c.caller && !c.landing && !c.leaving && ['drift', 'curious', 'wary', 'school', 'dart', 'easy', 'flee', 'patrol', 'midair', 'mirror', 'tidepool'].indexOf(c.def.catch_behavior) >= 0;
  const calm = (P) => {
    const K = AQ.Catching, speed = Math.hypot(P.vx || 0, P.vy || 0);
    return !(K && (K.swinging() || K.holdNet)) && (P.sneaking || speed < cfg().calmSpeed);
  };

  F.update = function (dt, game) {
    if (!cfg().enabled || game.scene !== 'world' || game.state !== 'play' || !AQ.Creatures) return;
    const P = game.player, C = cfg();
    // the nearest wild creature you're calmly beside
    let best = null, bd = C.visitRange;
    for (const c of AQ.Creatures.near(P.x, P.y, C.visitRange)) {
      if (c.def.is_plant || c.alpha < 0.3 || c.fadedOut) continue;
      const d = Math.hypot(c.x - P.x, c.y - P.y);
      if (d < bd) { bd = d; best = c; }
    }
    if (best && calm(P)) {
      if (F.near !== best) { F.near = best; F.calmT = 0; }
      F.calmT += dt;
      const id = best.def.id, now = performance.now() / 1000;
      if (F.calmT >= C.visitSeconds && (!F.last[id] || now - F.last[id] > C.visitCooldown)) {
        F.last[id] = now; F.calmT = -999;                              // (one visit per stay)
        const was = F.isFriend(id);
        st().visits[id] = F.visits(id) + 1;
        AQ.FX.text(best.x, best.y - best.r - 4, '♥', '#ff9fc0');
        if (!was && F.isFriend(id)) {
          if (AQ.HUD) AQ.HUD.toast(AQ.t('friend.made', { name: best.def.name }), '#ffb8d8', 5);
          if (AQ.Badges) AQ.Badges.addTo('friends', id);
          AQ.Audio.play('hearts');
        } else if (F.visits(id) === Math.ceil(C.visitsNeeded / 2) && AQ.HUD) AQ.HUD.toast(AQ.t('friend.likes', { name: best.def.name }), '#ffd8e8', 4);
        if (AQ.Save) AQ.Save.dirty();
      }
    } else { F.near = null; F.calmT = 0; }
    // friends nearby: one swims along beside you for a while, and now and then leaves a gift
    for (const c of AQ.Creatures.list) {
      if (!F.isFriend(c.def.id) || !canFollow(c)) { if (c.follow > 0) endFollow(c); continue; }
      const d = Math.hypot(c.x - P.x, c.y - P.y);
      c.friendNear = d < C.glowRange;
      if (c.follow > 0) {
        c.follow -= dt;
        const side = c.followSide || 1, tx = P.x - (P.facing || 1) * 14 * side, ty = P.y - 8 + side * 6;
        c.hx = tx; c.hy = ty;                                          // (its own wandering now centres on you)
        c.vx += ((tx - c.x) * 2 - c.vx) * Math.min(1, dt * 3); c.vy += ((ty - c.y) * 2 - c.vy) * Math.min(1, dt * 3);
        if (!AQ.World.water(c.x + c.vx * dt, c.y + c.vy * dt)) { c.vx *= -0.3; c.vy *= -0.3; }
        else { c.x += c.vx * dt * 0.5; c.y += c.vy * dt * 0.5; }
        c.facing = c.vx >= 0 ? 1 : -1;
        if (c.follow <= 0) endFollow(c);
      } else if (d < C.followRange && calm(P) && !(c.followRest > 0)) { c.follow = U.R.range(C.followSeconds[0], C.followSeconds[1]); c.followSide = U.R.chance(0.5) ? 1 : -1; c.homeSave = [c.hx, c.hy]; }
      if (c.followRest > 0) c.followRest -= dt;
      if (c.friendNear) {
        c.giftT = (c.giftT == null ? U.R.range(C.giftEvery[0], C.giftEvery[1]) : c.giftT) - dt;
        if (c.giftT <= 0) { c.giftT = U.R.range(C.giftEvery[0], C.giftEvery[1]); dropGift(c); }
      }
    }
    // picking up gifts
    for (let i = F.gifts.length - 1; i >= 0; i--) {
      const g = F.gifts[i];
      g.t += dt;
      if (g.vy) { g.y += g.vy * dt; if (AQ.World.solid(g.x, g.y + 2)) g.vy = 0; }
      if (Math.hypot(P.x - g.x, P.y - g.y) < 12) {
        F.gifts.splice(i, 1);
        if (g.kind === 'glass' && AQ.Panes) { AQ.Panes.add(1); if (AQ.HUD) AQ.HUD.toast(AQ.t('friend.giftGlass'), '#bff0ff', 4); }
        else { st().keepsakes = st().keepsakes + 1; if (AQ.Badges) AQ.Badges.add('keepsakes'); if (AQ.HUD) AQ.HUD.toast(AQ.t('friend.giftShell'), '#ffe9a8', 4); }
        AQ.Audio.play('bottle'); AQ.FX.sparkle(g.x, g.y, '#fff3c8', 6);
        if (AQ.Save) AQ.Save.dirty();
      } else if (g.t > cfg().giftStays) F.gifts.splice(i, 1);
    }
  };
  function endFollow(c) { c.follow = 0; c.followRest = cfg().followRest; if (c.homeSave) { c.hx = c.homeSave[0]; c.hy = c.homeSave[1]; c.homeSave = null; } }   // (back home)
  function dropGift(c) {
    if (F.gifts.length >= 3) return;
    F.gifts.push({ x: c.x, y: c.y + 2, vy: 18, t: 0, kind: U.R.chance(cfg().glassShare) ? 'glass' : 'shell', from: c.def.name });
  }

  // the gifts lying about, and a soft heart over a friend near you (world px, ctx translated)
  F.draw = function (ctx) {
    const t = AQ.Render.t;
    for (const g of F.gifts) {
      const tw = U.calm() ? 1 : 0.7 + 0.3 * Math.sin(t * 4 + g.x);
      if (g.kind === 'glass') { ctx.fillStyle = `rgba(190,240,255,${tw.toFixed(2)})`; ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 1, 3, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(g.x), Math.round(g.y) - 1, 1, 1); }
      else { ctx.fillStyle = '#f2d9c4'; ctx.fillRect(Math.round(g.x) - 2, Math.round(g.y), 5, 1); ctx.fillRect(Math.round(g.x) - 1, Math.round(g.y) - 1, 3, 1); ctx.fillStyle = '#d8a890'; ctx.fillRect(Math.round(g.x), Math.round(g.y) - 1, 1, 2); }
    }
    if (!AQ.Creatures) return;
    for (const c of AQ.Creatures.list) {
      if (!c.friendNear || !F.isFriend(c.def.id)) continue;
      if (!U.calm() && Math.floor(t * 1.2 + c.seed) % 3 === 2) continue;   // (now and then; held steady with REDUCE FLASHING)
      heart(ctx, Math.round(c.x) - 1, Math.round(c.y - c.r) - 6);
    }
  };
  function heart(ctx, x, y) { ctx.fillStyle = '#ff9fc0'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1); ctx.fillRect(x, y + 1, 3, 1); ctx.fillRect(x + 1, y + 2, 1, 1); }
  F.heart = heart;
  // friends glow softly while you're near (real light: GRAPHICS MEDIUM / HIGH, and the 2D lights)
  F.lights = function (L) {
    if (!AQ.Creatures) return;
    for (const c of AQ.Creatures.list) if (c.friendNear && F.isFriend(c.def.id)) L.push({ x: c.x, y: c.y, r: 16, color: '#ffc8e0', power: 0.45 });
  };
  return F;
})();
