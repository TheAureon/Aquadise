// Net swinging, prying (hold the net), and bait.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Catching = (function () {
  const U = AQ.U, R = U.R;
  const K = { swing: null, bait: null, hold: 0, pryTarget: null };

  K.swinging = () => !!K.swing;
  K.armOut = () => !!(K.swing || K.holdNet);
  const T = () => AQ.TUNING.net;

  function aimFrom(game, useMouse) {
    const P = game.player, I = AQ.Input, cam = AQ.Camera;
    let ax, ay;
    if (useMouse) { ax = I.mouse.x + cam.left() - P.x; ay = I.mouse.y + cam.top() - P.y; }
    else { ax = P.aimX; ay = P.aimY; if (!ax && !ay) ax = P.facing; }
    const L = Math.hypot(ax, ay) || 1;
    return [ax / L, ay / L];
  }

  function netCircle(game, aim, sweep) {
    const P = game.player, lvl = game.upgrades.net;
    const a = Math.atan2(aim[1], aim[0]) + sweep;
    const reach = T().reach[lvl];
    return { x: P.x + Math.cos(a) * reach, y: P.y + Math.sin(a) * reach, r: T().radius[lvl] };
  }

  function ctxFor(game, c) {
    const P = game.player;
    return { P, dx: P.x - c.x, dy: P.y - c.y, dist: Math.hypot(P.x - c.x, P.y - c.y), noise: P.noise() };
  }
  const centerOf = (c) => (c.def.is_plant ? [c.x, c.y - 5] : [c.x, c.y]);

  K.update = function (dt, game) {
    const I = AQ.Input, P = game.player;
    const mousePress = AQ.Keys.pressed('net'), keyPress = false;   // the net (left click by default; AQ.TUNING.keys.net)
    const holding = AQ.Keys.down('net');

    if ((mousePress || keyPress) && !K.swing) {
      const aim = aimFrom(game, mousePress);
      K.swing = { t: 0, aim, hits: new Set(), msg: false };
      if (aim[0]) P.facing = aim[0] > 0 ? 1 : -1;
      AQ.Audio.play('swing');
      // some creatures react to the swing itself (curious dodgers, defensive pinchers)
      for (const c of AQ.Creatures.near(P.x, P.y, 48)) if (c.bhv.onSwing) c.bhv.onSwing(c, ctxFor(game, c));
    }

    if (K.swing) {
      const s = K.swing;
      s.t += dt;
      const prog = s.t / T().swingTime;
      if (s.t >= T().activeFrom && s.t <= T().activeTo) {
        const net = netCircle(game, s.aim, U.lerp(-0.8, 0.8, U.clamp((s.t - T().activeFrom) / (T().activeTo - T().activeFrom), 0, 1)));
        s.net = net;
        checkHits(game, net, s);
      }
      if (prog >= 1) { K.swing = null; K.holdAim = s.aim; }
    }

    // Hold the net after a swing to pry clinging/hidden creatures loose.
    if (!K.swing && holding && K.holdAim) {
      K.hold += dt;
      const net = netCircle(game, K.holdAim, 0);
      K.holdNet = net;
      let target = null;
      for (const c of AQ.Creatures.near(net.x, net.y, 40)) {
        if (!c.pryable) continue;
        if (Math.hypot(c.x - net.x, c.y - net.y) < net.r + c.r) { target = c; break; }
      }
      if (target !== K.pryTarget) { if (K.pryTarget) K.pryTarget.pryProgress = 0; K.pryTarget = target; }
      if (target) {
        target.pryProgress = (target.pryProgress || 0) + dt / T().pryTime;
        if (R.chance(dt * 10)) AQ.FX.puff(target.x, target.y, 'rgba(200,190,170,0.5)', 1);
        if (target.pryProgress >= 1) { target.pryProgress = 0; K.pryTarget = null; tryCatch(game, target, true); }
      }
    } else {
      if (K.pryTarget) K.pryTarget.pryProgress = 0;
      K.pryTarget = null; K.hold = 0; K.holdNet = null;
      if (!holding) K.holdAim = null;
    }

    // Bait
    if (AQ.Keys.pressed('bait')) {
      if (P.inAir) AQ.HUD.toast('Bait only works underwater.', '#cde');
      else {
        K.bait = { x: P.x + P.facing * 6, y: P.y + 2, t: 0, vy: 0 };
        AQ.FX.puff(K.bait.x, K.bait.y, 'rgba(240,170,100,0.5)', 4);
        AQ.Audio.play('bait');
        if (AQ.Tips) AQ.Tips.event('bait');
      }
    }
    if (K.bait) {
      const b = K.bait, W = AQ.World;
      b.t += dt;
      if (!W.solid(b.x, b.y + 3)) { b.y += AQ.TUNING.bait.sinkSpeed * dt; }
      if (R.chance(dt * 3)) AQ.FX.add({ type: 'trail', x: b.x + R.range(-2, 2), y: b.y, vy: -3, life: 1.2, color: '#f2b27a' });
      if (b.t > AQ.TUNING.bait.lifetime) K.bait = null;
    }
  };

  function checkHits(game, net, s) {
    for (const c of AQ.Creatures.near(net.x, net.y, 60)) {
      if (s.hits.has(c)) continue;
      const [cx, cy] = centerOf(c);
      // tide-pool dwellers: hitting the pool counts
      if (c.pool) {
        const p = c.pool;
        if (Math.abs(net.x - p.x) < p.w / 2 + net.r && Math.abs(net.y - p.surface) < net.r + 6) {
          s.hits.add(c);
          if (c.catchable && c.bhv.tryCatch(c, ctxFor(game, c))) tryCatch(game, c);
        }
        continue;
      }
      const onBody = Math.hypot(cx - net.x, cy - net.y) <= net.r + c.r * 0.8;
      // a lure's glowing decoy: netting it only makes it puff and flicker
      if (!onBody && c.decoy && c.bhv.decoyHit && Math.hypot(c.decoy.x - net.x, c.decoy.y - net.y) <= net.r + 3) {
        s.hits.add(c); c.bhv.decoyHit(c);
        if (!s.msg) { s.msg = true; AQ.HUD.toast(c.bhv.missText, '#cfe8ff'); }
        continue;
      }
      if (!onBody) continue;
      s.hits.add(c);
      if (c.def.is_plant) { harvest(game, c); continue; }
      if (c.catchable) tryCatch(game, c);
      else if (!s.msg) {
        s.msg = true;
        AQ.HUD.toast(c.hidden ? (c.pryable ? 'It\'s wedged in! Hold the net to pry.' : 'It\'s hiding out of reach.') : (c.bhv.missText && !c.decoy) ? c.bhv.missText : 'It slipped away!', '#cfe8ff');
        AQ.FX.puff(cx, cy, 'rgba(255,255,255,0.5)', 3);
      }
    }
  }

  function harvest(game, c) {
    if (c.harvested) return;
    if (c.closed) { AQ.HUD.toast(`The ${c.def.name} is closed tight. Come back at night.`, '#cfe8ff'); AQ.FX.puff(c.x, c.y - 4, 'rgba(255,255,255,0.4)', 3); return; }
    const ctx = ctxFor(game, c);
    if (c.p.sting && ctx.noise > AQ.TUNING.stealth.carelessNoise) {
      game.player.knock(ctx.dx || 1, ctx.dy - 3, AQ.TUNING.knockback.light);
      AQ.HUD.toast(`Ow! ${c.def.name} stings when rushed.`, '#ffb08a');
      return;
    }
    c.harvested = true;
    c.st = AQ.TUNING.plants.regrowTime;
    const isNew = AQ.Collection.recordHarvest(c.def);
    AQ.FX.sparkle(c.x, c.y - 5, '#cfffbf', 8);
    AQ.HUD.toast(`Harvested ${c.def.name}!${isNew ? '  NEW!' : ''}`, isNew ? '#ffe36b' : '#cfffbf');
    AQ.Audio.play('harvest');
  }

  function tryCatch(game, c, pried) {
    if (c.def.requires_upgraded_net && game.upgrades.net < 2) {
      AQ.HUD.toast('Too strong for this net! Find a better net in a chest.', '#ffb08a');
      if (c.def.hostile) game.player.knock(game.player.x - c.x || 1, game.player.y - c.y, AQ.TUNING.knockback.light);
      c.icon = '!'; c.iconT = 1;
      return;
    }
    const ctx = ctxFor(game, c);
    if (c.bhv.onCaught) c.bhv.onCaught(c, ctx);
    AQ.Creatures.remove(c);
    const isNew = AQ.Collection.recordCatch(c.def, c.sex);
    AQ.FX.sparkle(c.x, c.y, '#fff7c2', 12);
    AQ.FX.text(c.x, c.y - 8, pried ? 'PRIED!' : 'GOT IT!', '#ffe36b');
    AQ.HUD.toast(`Caught ${c.def.name}!${isNew ? '  NEW!' : ''}`, isNew ? '#ffe36b' : '#ffffff', 3);
    AQ.Audio.play('catch', { rare: !!c.def.rare });
    if (AQ.Tips) AQ.Tips.event('catch');
  }

  K.draw = function (g, game) {
    const P = game.player;
    if (K.bait) AQ.Assets.draw(g, 'bait', 'idle', K.bait.x, K.bait.y, { t: K.bait.t });
    const net = K.swing ? K.swing.net || netCircle(game, K.swing.aim, -0.8) : K.holdNet;
    if (!net) return;
    // the robot's arm reaches from the shoulder toward the net (2px white, dark outline, elbow + hand)
    const swim = P.mode === 'swim';
    const sx = P.x + P.facing * (swim ? 4 : 3), sy = P.y + (swim ? 0 : -9);
    let dx = net.x - sx, dy = net.y - sy;
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const reach = Math.min(8, L - 2), hx = sx + dx * reach, hy = sy + dy * reach;
    const pts = [];
    for (let t = 0; t <= reach; t += 0.5) pts.push([Math.round(sx + dx * t), Math.round(sy + dy * t)]);
    g.fillStyle = '#262c37'; pts.forEach(([x, y]) => g.fillRect(x - 1, y - 1, 4, 4));
    g.fillStyle = '#eef1f7'; pts.forEach(([x, y]) => g.fillRect(x, y, 2, 2));
    const ex = Math.round(sx + dx * reach * 0.5), ey = Math.round(sy + dy * reach * 0.5);
    g.fillStyle = '#3b4352'; g.fillRect(ex, ey, 2, 2);                     // elbow joint
    g.fillStyle = '#3b4352'; g.fillRect(Math.round(hx), Math.round(hy), 2, 2); // hand
    g.fillStyle = '#6ef0ef'; g.fillRect(Math.round(sx + dx * 2), Math.round(sy + dy * 2), 1, 1);
    // net handle: thin black string from the hand to the hoop
    const n = 14, h0x = hx + 1, h0y = hy + 1;
    g.fillStyle = '#14161c';
    for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(Math.round(U.lerp(h0x, net.x, t * 0.85)), Math.round(U.lerp(h0y, net.y, t * 0.85)), 1, 1); }
    // hoop + mesh
    const r = net.r;
    g.fillStyle = 'rgba(235,245,255,0.95)';
    for (let a = 0; a < Math.PI * 2; a += 1 / r) g.fillRect(Math.round(net.x + Math.cos(a) * r), Math.round(net.y + Math.sin(a) * r), 1, 1);
    g.fillStyle = 'rgba(220,240,255,0.35)';
    for (let y = -r + 2; y < r; y += 3) for (let x = -r + 2; x < r; x += 3) if (x * x + y * y < r * r) g.fillRect(Math.round(net.x + x), Math.round(net.y + y), 1, 1);
  };

  return K;
})();
