// Reusable catch behaviours. Each creature in data/creatures.js names one via `catch_behavior`
// and tunes it with `params`. A behaviour sets, every frame:
//   c.catchable   can the net catch it right now?
//   c.pryable     can it be pried out by holding the net?
//   c.targetAlpha visibility (camouflage, hiding, plumes)
//   c.hostileActive  contact knocks the player back
//   c.icon        small marker drawn above it ('!', '?', 'zz' ...)
// and moves the creature with the helpers below.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Behaviors = (function () {
  const U = AQ.U, R = U.R;
  const B = {};

  // ------------------------------------------------------------------ helpers
  const H = {};
  B.helpers = H;

  // Steer toward (tx, ty) with smooth turning; returns true when close.
  H.swimTo = function (c, tx, ty, speed, dt, turn = 5) {
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const k = 1 - Math.exp(-turn * dt);
    const vx = d > 0.5 ? (dx / d) * speed : 0, vy = d > 0.5 ? (dy / d) * speed : 0;
    c.vx += (vx - c.vx) * k; c.vy += (vy - c.vy) * k;
    H.integrate(c, dt);
    return d < 4;
  };
  H.brake = function (c, dt, k = 4) { c.vx *= Math.exp(-k * dt); c.vy *= Math.exp(-k * dt); H.integrate(c, dt); };
  H.integrate = function (c, dt) {
    const W = AQ.World;
    // a water creature that ended up in the air (after a leap, a knock, a respawn) falls back in
    if (!c.allowAir && W.air(c.x, c.y)) {
      c.vy = Math.max(c.vy, 0) + 260 * dt;
      // fall, but never into rock or ice (check each direction on its own)
      const fx = c.x + c.vx * dt * 0.5, fy = c.y + c.vy * dt;
      if (!W.solid(fx, c.y)) c.x = fx; else c.vx *= -0.3;
      if (!W.solid(c.x, fy)) c.y = fy; else c.vy = 0;
      return;
    }
    const nx = c.x + c.vx * dt, ny = c.y + c.vy * dt;
    const okWater = (x, y) => W.open(x, y) && (c.allowAir || !W.air(x, y));
    if (okWater(nx, ny)) { c.x = nx; c.y = ny; }
    else if (okWater(nx, c.y)) { c.x = nx; c.vy *= -0.3; c.target = null; }
    else if (okWater(c.x, ny)) { c.y = ny; c.vx *= -0.3; c.target = null; }
    else { c.vx *= -0.3; c.vy *= -0.3; c.target = null; }
    if (Math.abs(c.vx) > 1) c.facing = c.vx > 0 ? 1 : -1;
    c.moving = Math.hypot(c.vx, c.vy) > 6;
  };
  // Random swim target near home that is open water.
  H.pickTarget = function (c, radius, yMin) {
    const W = AQ.World;
    for (let i = 0; i < 12; i++) {
      const tx = c.hx + R.range(-radius, radius), ty = c.hy + R.range(-radius * 0.6, radius * 0.6);
      if (yMin !== undefined && ty < yMin) continue;
      if (W.water(tx, ty) && W.lineClear(c.x, c.y, tx, ty)) return [tx, ty];
    }
    return [c.hx, c.hy];
  };
  H.wander = function (c, dt, speed, radius) {
    if (radius <= 0) { H.brake(c, dt); return; }
    c.wt = (c.wt || 0) - dt;
    if (!c.target || c.wt <= 0) { c.target = H.pickTarget(c, radius, AQ.World.sea + 6); c.wt = R.range(2, 5); }
    if (H.swimTo(c, c.target[0], c.target[1], speed, dt, 2.5)) { c.target = null; }
  };
  // Floor crawling: walk left/right, snap to the ground below.
  H.crawl = function (c, dt, speed, radius = 40) {
    const W = AQ.World;
    if (!c.dir) c.dir = R.chance(0.5) ? 1 : -1;
    c.ct = (c.ct || 0) - dt;
    if (c.ct <= 0) { c.ct = R.range(2, 6); if (R.chance(0.35)) c.dir *= -1; c.pause = R.chance(0.3) ? R.range(0.5, 2) : 0; }
    if (c.pause > 0) { c.pause -= dt; c.moving = false; return; }
    H.crawlStep(c, c.dir * speed * dt, radius);
  };
  H.crawlStep = function (c, dx, radius = 9999) {
    const W = AQ.World, half = c.foot || c.r * 0.6;
    const nx = c.x + dx;
    if (Math.abs(nx - c.hx) > radius) { c.dir = -Math.sign(nx - c.hx); return false; }
    const g = W.groundBelow(nx, c.y - 6, 16);
    if (g === null || !W.open(nx, g - half - 1) || W.air(nx, g - half - 1) && !c.allowAir) { c.dir = -(c.dir || 1); return false; }
    c.x = nx; c.y = g - half;
    if (dx) c.facing = dx > 0 ? 1 : -1;
    c.moving = Math.abs(dx) > 0.001;
    return true;
  };
  H.fleeDir = function (c, ctx) {
    const d = ctx.dist || 1;
    let fx = -ctx.dx / d, fy = -ctx.dy / d;
    const a = R.range(-0.4, 0.4), cs = Math.cos(a), sn = Math.sin(a);
    return [fx * cs - fy * sn, fx * sn + fy * cs];
  };
  H.flee = function (c, ctx, speed, dt) {
    if (!c.fdir || R.chance(dt * 1.5)) c.fdir = H.fleeDir(c, ctx);
    const tx = c.x + c.fdir[0] * 50, ty = Math.max(AQ.World.sea + 8, c.y + c.fdir[1] * 50);
    H.swimTo(c, tx, ty, speed, dt, 8);
  };
  H.careless = (c, ctx, r, noise) => ctx.dist < r && ctx.noise > (noise !== undefined ? noise : (c.p.carelessNoise !== undefined ? c.p.carelessNoise : AQ.TUNING.stealth.carelessNoise));
  // Universal bait: calm creatures with lure !== false swim to bait and feed (less alert while feeding).
  H.lure = function (c, ctx, dt, speed) {
    c.feeding = false;
    if (c.p.lure === false || !ctx.bait) return false;
    const b = ctx.bait, d = Math.hypot(b.x - c.x, b.y - c.y);
    if (d > AQ.TUNING.bait.lureRadius || !AQ.World.lineClear(c.x, c.y, b.x, b.y)) return false;
    if (d > 7) {
      if (c.p.crawl || c.movement === 'crawl') H.crawlStep(c, Math.sign(b.x - c.x) * speed * dt);
      else H.swimTo(c, b.x, b.y - 3, speed, dt, 4);
    } else { c.feeding = true; H.brake(c, dt); c.facing = b.x > c.x ? 1 : -1; if (R.chance(dt * 1.2)) AQ.FX.text(c.x, c.y - c.r - 4, '♥', '#ff9fc0'); }
    return true;
  };
  H.alertMark = (c, t = 0.8) => { c.iconT = t; c.icon = '!'; };
  // Calm idle movement shared by many behaviours.
  H.idle = function (c, dt) {
    const p = c.p;
    if (p.crawl || c.movement === 'crawl') H.crawl(c, dt, p.speed || 6, p.wanderR !== undefined ? p.wanderR : 40);
    else if (c.movement === 'still') H.brake(c, dt);
    else H.wander(c, dt, p.speed || 12, p.wanderR !== undefined ? p.wanderR : 50);
  };

  // ------------------------------------------------------------------ behaviours

  // Can't escape; the challenge is spotting it (low alpha, optional shimmer trail).
  B.spotting = {
    update(c, ctx, dt) {
      const p = c.p;
      if (c.movement !== 'still') {
        if (p.inch) { c.it = (c.it || 0) - dt; if (c.it <= 0) { c.it = R.range(3, 6); c.inchT = 0.8; } if (c.inchT > 0) { c.inchT -= dt; H.crawl(c, dt, 4, 30); } else c.moving = false; }
        else H.crawl(c, dt, p.speed || 2, 30);
      }
      c.targetAlpha = ctx.dist < (p.revealDist || 34) || c.moving && p.inch ? 0.95 : (p.alpha || 0.35);
      c.catchable = true;
      if (p.trail && c.moving) { c.trT = (c.trT || 0) - dt; if (c.trT <= 0) { c.trT = 0.35; AQ.FX.trail(c.x - c.facing * 3, c.y + c.r * 0.4, p.trail); } }
    }
  };

  // Calm until approached carelessly, then reacts: flee | hide (optionally pry-able) | dive | leap.
  B.wary = {
    init(c) { c.state = 'calm'; if (c.p.bask || c.p.onIce) { c.allowAir = !!c.p.onIce; } },
    update(c, ctx, dt) {
      const p = c.p, W = AQ.World;
      c.st -= dt;
      c.pryable = false; c.hidden = false; c.icon = c.iconT > 0 ? c.icon : null;
      const alertR = (p.alertR || 50) * (c.feeding ? 0.55 : 1) * (c.state === 'dived' ? 1.6 : 1);
      if (c.state === 'calm' || c.state === 'dived') {
        c.catchable = true;
        c.targetAlpha = p.alpha && ctx.dist > 40 ? p.alpha : 1;
        if (H.careless(c, ctx, alertR, c.state === 'dived' ? 0.25 : undefined)) { this.react(c, ctx); return; }
        if (c.state === 'dived') {
          H.wander(c, dt, 16, 50);
          if (c.st <= 0) { c.state = 'return'; }
          return;
        }
        if (p.bask) {
          c.feeding = false;
          if (p.onIce) { c.vx = 0; c.vy = 0; c.moving = false; }
          else H.swimTo(c, c.hx + Math.sin(c.t * 0.3) * 6, W.sea + 3, 6, dt, 2);
          c.icon = c.iconT > 0 ? c.icon : 'zz';
          return;
        }
        if (!H.lure(c, ctx, dt, (p.speed || 12) * 1.8)) H.idle(c, dt);
      } else if (c.state === 'flee') {
        c.catchable = false;
        if (c.movement === 'crawl') { if (!H.crawlStep(c, c.dir * (p.fleeSpeed || 40) * 0.7 * dt, 140)) c.dir = -c.dir; }
        else H.flee(c, ctx, p.fleeSpeed || 65, dt);
        if (c.st <= 0) c.state = 'return';
      } else if (c.state === 'hide') {
        c.catchable = false; c.hidden = true; c.pryable = !!p.pry;
        c.targetAlpha = 0.3; H.brake(c, dt, 8);
        if (c.st <= 0 && !H.careless(c, ctx, alertR * 1.3, 0.2)) c.state = 'calm';
      } else if (c.state === 'dive') {
        c.catchable = false; c.allowAir = false;
        H.swimTo(c, c.hx + c.facing * 40, c.hy + 90, p.fleeSpeed || 70, dt, 6);
        if (c.st <= 0) { c.state = 'dived'; c.st = U.rangeOf(p.hideTime || [6, 10]); }
      } else if (c.state === 'leap') {
        c.catchable = false; c.hidden = true; c.allowAir = true;
        if (!c.perch) { c.perch = [c.hx + R.range(-24, 24), W.sea - R.range(8, 14)]; }
        H.swimTo(c, c.perch[0], c.perch[1], 60, dt, 6);
        if (c.st <= 0 && ctx.dist > alertR) { c.state = 'return'; c.perch = null; }
      } else if (c.state === 'return') {
        c.catchable = true; c.targetAlpha = 1;
        const ty = p.bask ? W.sea + 3 : c.hy;
        if (p.onIce) c.allowAir = true;
        const arrived = c.movement === 'crawl'
          ? (Math.abs(c.hx - c.x) < 3 || !H.crawlStep(c, Math.sign(c.hx - c.x) * 12 * dt))
          : H.swimTo(c, c.hx, ty, (p.speed || 12) * 2.2, dt, 3);
        if (arrived || (c.movement !== 'crawl' && Math.hypot(c.hx - c.x, ty - c.y) < 6)) { if (p.onIce) { c.x = c.hx; c.y = c.hy; } c.state = 'calm'; }
        if (H.careless(c, ctx, alertR)) this.react(c, ctx);
      }
    },
    react(c, ctx) {
      const p = c.p;
      H.alertMark(c);
      AQ.Audio.play('spook');
      switch (p.reaction) {
        case 'hide': c.state = 'hide'; c.st = U.rangeOf(p.hideTime || [4, 7]); AQ.FX.puff(c.x, c.y, 'rgba(200,190,170,0.6)', 5); break;
        case 'dive': c.state = 'dive'; c.st = 1.4; AQ.FX.puff(c.x, c.y, 'rgba(230,250,255,0.8)', 8); break;
        case 'leap': c.state = 'leap'; c.st = U.rangeOf(p.hideTime || [4, 7]); break;
        default: c.state = 'flee'; c.st = U.rangeOf(p.fleeTime || [1.2, 2]); c.fdir = null; c.dir = ctx.dx > 0 ? -1 : 1;
      }
    }
  };

  // Camouflaged: low alpha while still; reveals while moving. Variants: pulse, relocate, freeze, buried.
  B.camouflage = {
    init(c) { c.mt = U.rangeOf(c.p.moveEvery || [3, 7]); c.near = 0; },
    update(c, ctx, dt) {
      const p = c.p;
      c.catchable = true;
      c.mt -= dt;
      if (c.moveT > 0) {
        c.moveT -= dt;
        if (p.crawl || p.buried || c.movement === 'crawl') H.crawlStep(c, c.dir * (p.moveSpeed || 22) * dt, 70);
        else H.swimTo(c, c.target[0], c.target[1], p.moveSpeed || 22, dt, 4);
        c.targetAlpha = p.buried ? 0.7 : 0.9;
        if (p.buried && R.chance(dt * 12)) AQ.FX.puff(c.x - c.facing * 4, c.y + 2, 'rgba(210,190,140,0.6)', 1);
      } else {
        if (!(p.crawl || p.buried)) H.brake(c, dt); else c.moving = false;
        let a = p.alpha || 0.12;
        if (p.freezeOnApproach) {
          if (ctx.dist < 52) a = p.alpha; else { a = p.visibleAlpha || 0.9; H.crawl(c, dt, 6, 30); }
        }
        if (p.revealDist && (ctx.dist < p.revealDist || c.revealed)) { a = 0.95; if (p.stayRevealed) c.revealed = true; }
        if (p.pulse) {
          c.pt = (c.pt === undefined ? U.rangeOf(p.pulseEvery) : c.pt) - dt;
          if (c.pt < 0) { a = 1; c.glow = 1; if (c.pt < -0.6) c.pt = U.rangeOf(p.pulseEvery); } else c.glow = 0;
        }
        c.targetAlpha = a;
        if (c.mt <= 0 && !(p.freezeOnApproach && ctx.dist < 52)) {
          c.mt = U.rangeOf(p.moveEvery || [3, 7]);
          c.moveT = U.rangeOf(p.moveTime || [0.6, 1.2]);
          c.dir = R.chance(0.5) ? 1 : -1;
          c.target = H.pickTarget(c, 30);
        }
      }
      // "Wait too long and it shifts away": relocate after the player lingers nearby
      if (p.relocate) {
        c.near = ctx.dist < 56 ? c.near + dt : Math.max(0, c.near - dt);
        if (c.near > (p.relocateAfter || 4)) {
          c.near = 0;
          AQ.FX.puff(c.x, c.y, 'rgba(255,200,180,0.7)', 8);
          const spot = AQ.Creatures.findSpot(c.def, 'floor', c.hx, 80, c.slot && c.slot.sp);
          if (spot) { c.x = spot[0]; c.y = spot[1]; c.hx = spot[0]; c.hy = spot[1]; }
          c.alpha = 0;
        }
      }
      if (p.startle && H.careless(c, ctx, 30)) { c.moveT = 0.8; c.dir = ctx.dx > 0 ? -1 : 1; c.target = H.pickTarget(c, 40); }
    }
  };

  // Calm -> (startled) run away fast and erratically -> pause (catch window) -> calm.
  B.dart = {
    init(c) { c.state = 'calm'; },
    update(c, ctx, dt) {
      const p = c.p;
      c.st -= dt;
      c.icon = c.iconT > 0 ? c.icon : null;
      if (c.state === 'calm') {
        c.catchable = true; c.targetAlpha = 1;
        if (H.careless(c, ctx, (p.alertR || 50) * (c.feeding ? 0.55 : 1))) { c.state = 'run'; c.st = U.rangeOf(p.runTime || [1, 1.6]); H.alertMark(c); c.dir = ctx.dx > 0 ? -1 : 1; return; }
        if (!H.lure(c, ctx, dt, 18)) H.idle(c, dt);
      } else if (c.state === 'run') {
        c.catchable = false;
        if (p.erratic && R.chance(dt * 3)) c.dir *= -1;
        if (p.crawl) { if (!H.crawlStep(c, c.dir * (p.runSpeed || 70) * dt, 120)) c.dir *= -1; }
        else H.flee(c, ctx, p.runSpeed || 70, dt);
        if (c.st <= 0) { c.state = 'pause'; c.st = U.rangeOf(p.pauseTime || [1.4, 2]); }
      } else if (c.state === 'pause') {
        c.catchable = true; c.moving = false; c.icon = '...';
        if (!p.crawl) H.brake(c, dt);
        if (c.st <= 0) { c.state = 'calm'; c.hx = c.x; c.hy = c.y; }
      }
    }
  };

  // Cycles through data-defined phases (surfacing windows, bursts, plumes, coiling...).
  B.timing = {
    init(c) { c.pi = R.int(0, c.p.phases.length - 1); c.st = U.rangeOf(c.p.phases[c.pi].dur); this.enter(c); },
    enter(c) {
      const ph = c.p.phases[c.pi];
      if (ph.move === 'burst') { const a = R.chance(0.5) ? 0 : Math.PI; c.vx = Math.cos(a) * ph.speed; c.vy = R.range(-10, 10); }
      c.target = null; c.fleeT = 0;
    },
    update(c, ctx, dt) {
      const ph = c.p.phases[c.pi], W = AQ.World;
      c.st -= dt;
      if (c.st <= 0) { c.pi = (c.pi + 1) % c.p.phases.length; c.st = U.rangeOf(c.p.phases[c.pi].dur); this.enter(c); return; }
      c.catchable = !!ph.catchable;
      c.targetAlpha = ph.alpha !== undefined ? ph.alpha : 1;
      c.icon = ph.label || null;
      if (ph.alertR && c.fleeT <= 0 && H.careless(c, ctx, ph.alertR, ph.carelessNoise)) { c.fleeT = 1.6; H.alertMark(c); }
      if (c.fleeT > 0) { c.fleeT -= dt; c.catchable = false; H.flee(c, ctx, 60, dt); return; }
      if (ph.plume && R.chance(dt * 14)) AQ.FX.puff(c.x + R.range(-6, 6), c.y + 4, 'rgba(190,180,170,0.55)', 1);
      switch (ph.move) {
        case 'still': if (c.movement === 'crawl' || c.p.crawl) c.moving = false; else H.brake(c, dt, 3); break;
        case 'wander': if (c.movement === 'crawl') H.crawl(c, dt, ph.speed || 8, 50); else H.wander(c, dt, ph.speed || 20, c.p.wanderR || 60); break;
        case 'surface': H.swimTo(c, c.hx, W.sea + 4, ph.speed || 30, dt, 3); break;
        case 'deep': if (!c.target) c.target = [c.hx + R.range(-40, 40), c.hy + R.range(60, 110)]; if (!W.water(c.target[0], c.target[1])) c.target = [c.hx, c.hy + 30]; H.swimTo(c, c.target[0], c.target[1], ph.speed || 30, dt, 3); break;
        case 'burst': H.integrate(c, dt); if (Math.abs(c.x - c.hx) > 160) c.vx = -c.vx; break;
        default: H.swimTo(c, c.hx, c.hy, ph.speed || 20, dt);
      }
    }
  };

  const inArea = (c, x) => { const a = c.def.spawn && c.def.spawn.area; return !a || (x >= a[0] - 20 && x <= a[1] + 20); };
  // Schools: members follow a shared roaming anchor; the school flees together (except a straggler).
  B.school = {
    init(c) { c.state = 'calm'; },
    update(c, ctx, dt) {
      const s = c.school, p = c.p;
      if (!s) return;
      // the school object is updated once per frame by its first member
      if (s.frame !== AQ.Creatures.frame) { s.frame = AQ.Creatures.frame; this.updateSchool(s, c, ctx, dt); }
      const a = s.t * 0.6 + c.slotN * 1.7;
      const spread = 9 * (2 - (p.tight || 1) * 0.6) + (c.straggler ? 16 : 0);
      let tx = s.x + Math.cos(a) * spread + c.ox, ty = s.y + Math.sin(a * 1.3) * spread * 0.6 + c.oy;
      if (c.straggler) { tx -= s.vx * 0.5; ty -= s.vy * 0.5; }
      const fleeing = s.fleeT > 0;
      const speed = (fleeing ? p.fleeSpeed || 75 : (p.speed || 22) * 1.5) * (c.straggler ? 0.75 : 1);
      if (c.leapT > 0) {
        // leap: a short arc out of the water; it only ends once the fish is back in the water
        c.leapT -= dt; c.allowAir = true; c.vy += 220 * dt; H.integrate(c, dt);
        if (c.leapT <= 0 && !AQ.World.water(c.x, c.y)) c.leapT = 0.05;
        if (c.leapT <= 0) c.allowAir = false;
      } else H.swimTo(c, tx, ty, speed, dt, 4);
      if (p.leap && c.y < AQ.World.sea + 10 && !fleeing && R.chance(dt * 0.15)) { c.leapT = 0.7; c.vy = -95; c.vx = c.facing * 40; }
      c.catchable = (!fleeing || c.straggler) && !(c.leapT > 0);
      c.targetAlpha = s.covered ? 0.45 : 1;
      c.icon = c.iconT > 0 ? c.icon : null;
    },
    updateSchool(s, c, ctx, dt) {
      const p = c.p, W = AQ.World;
      s.t += dt; s.fleeT -= dt;
      const bait = ctx.bait && Math.hypot(ctx.bait.x - s.x, ctx.bait.y - s.y) < AQ.TUNING.bait.lureRadius * 1.2 ? ctx.bait : null;
      const d = Math.hypot(ctx.P.x - s.x, ctx.P.y - s.y);
      s.covered = p.cover && !bait && s.fleeT <= 0;
      const alertR = (p.alertR || 60) * (bait ? 0.5 : 1) * (s.covered ? 1.3 : 1);
      if (s.fleeT <= 0 && d < alertR && (ctx.noise > (s.covered ? 0.25 : (p.carelessNoise || 0.5)))) {
        s.fleeT = 2.2; if (s.members[0]) H.alertMark(s.members[0]);
        const L = d || 1; s.fx = (s.x - ctx.P.x) / L; s.fy = (s.y - ctx.P.y) / L;
      }
      let tx, ty, sp = p.speed || 22;
      if (s.fleeT > 0) { tx = s.x + s.fx * 60; ty = s.y + s.fy * 30; sp = p.fleeSpeed || 75; }
      else if (bait) { tx = bait.x; ty = bait.y - 8; }
      else if (p.cover) { tx = s.hx + Math.sin(s.t * 0.4) * 12; ty = s.hy + Math.cos(s.t * 0.3) * 8; }
      else {
        if (!s.target || Math.hypot(s.target[0] - s.x, s.target[1] - s.y) < 10) {
          const roam = p.roam || 120;
          const area = c.def.spawn && c.def.spawn.area, ax0 = area ? area[0] : 0, ax1 = area ? area[1] : W.w;   // stay in its own waters
          for (let i = 0; i < 10; i++) {
            const ry = p.roamY != null ? p.roamY : roam * 0.3;      // how far up/down it roams (default: a flat band)
            const t = [U.clamp(s.hx + R.range(-roam, roam), ax0, ax1), U.clamp(s.hy + R.range(-ry, ry), W.sea + (p.leap ? 6 : 16), p.maxY || W.h)];
            if (W.water(t[0], t[1])) { s.target = t; break; }
          }
          if (!s.target) s.target = [s.hx, s.hy];
        }
        [tx, ty] = s.target;
      }
      const dx = tx - s.x, dy = ty - s.y, L = Math.hypot(dx, dy) || 1, k = 1 - Math.exp(-2 * dt);
      s.vx += ((dx / L) * sp - s.vx) * k; s.vy += ((dy / L) * sp - s.vy) * k;
      const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
      if (W.water(nx, ny) && W.depthDist(nx, ny + 6) === 0 && W.water(nx, ny - 6) && ny <= (p.maxY || W.h) && inArea(c, nx)) { s.x = nx; s.y = ny; } else { s.vx *= -0.5; s.vy *= -0.5; s.target = null; }
    }
  };

  // Approaches and circles the player; only catchable during a brief "linger" (?) moment.
  B.curious = {
    init(c) { c.lt = U.rangeOf([2.5, 4]); },
    update(c, ctx, dt) {
      const p = c.p;
      c.lt -= dt;
      c.icon = null;
      if (c.dodgeT > 0) { c.dodgeT -= dt; c.catchable = false; H.flee(c, ctx, 120, dt); return; }
      if (ctx.dist < (p.approachR || 120) && ctx.noise < 1.2) {
        if (c.lt < 0) {
          c.catchable = true; c.icon = '?'; H.brake(c, dt, 6); c.facing = ctx.dx > 0 ? 1 : -1;
          if (c.lt < -0.9) c.lt = U.rangeOf([2.5, 4]);
          return;
        }
        c.catchable = false;
        const a = c.t * 1.4 + c.seed;
        H.swimTo(c, ctx.P.x + Math.cos(a) * (p.keepDist || 24), Math.max(AQ.World.sea + 8, ctx.P.y + Math.sin(a) * (p.keepDist || 24) * 0.6), 55, dt, 3);
      } else { c.catchable = true; if (!H.lure(c, ctx, dt, 30)) H.wander(c, dt, 20, 90); }
    },
    onSwing(c) { if (!c.catchable) { c.dodgeT = 0.8; c.fdir = null; H.alertMark(c, 0.5); } }
  };

  // Drifts with the current. Optional faint sting if handled carelessly.
  B.drift = {
    update(c, ctx, dt) {
      const p = c.p;
      c.catchable = true; c.targetAlpha = p.alpha || 1;
      const tx = c.hx + Math.sin(c.t * 0.13 + c.seed) * 60, ty = c.hy + Math.sin(c.t * 0.21 + c.seed * 2) * 18;
      H.swimTo(c, tx, ty, p.speed || 5, dt, 1);
    },
    onCaught(c, ctx) {
      if (c.p.sting && ctx.noise > AQ.TUNING.stealth.carelessNoise) {
        ctx.P.knock(ctx.dx || 1, ctx.dy, AQ.TUNING.knockback.light);
        AQ.HUD.toast('Ouch! A faint sting.', '#ffb0d8');
      }
    }
  };

  // Moves between patrol points. Catch it by waiting motionless at a point. onSpook: swerve | flee.
  B.patrol = {
    init(c) {
      const span = c.p.span || 90;
      c.points = [[c.hx - span, c.hy], [c.hx + span, c.hy]];
      if (!c.p.crawl) c.points.push([c.hx, c.hy + R.range(-30, 30)]);
      c.points = c.points.filter((pt) => AQ.World.water(pt[0], pt[1]) || c.p.crawl);
      if (c.points.length < 2) c.points = [[c.hx - 30, c.hy], [c.hx + 30, c.hy]];
      c.pi = 0; c.wait = 0; c.state = 'patrol';
    },
    update(c, ctx, dt) {
      const p = c.p;
      c.icon = c.iconT > 0 ? c.icon : null;
      c.st -= dt;
      const still = ctx.noise < (p.stillNoise || 0.12);
      if (c.state === 'patrol') {
        c.catchable = still;
        if (!still && ctx.dist < (p.noticeR || 60)) {
          H.alertMark(c);
          c.state = p.onSpook === 'flee' ? 'flee' : 'swerve'; c.st = p.onSpook === 'flee' ? 2.2 : 1.6;
          c.dir = ctx.dx > 0 ? -1 : 1; c.fdir = null;
        }
        if (c.wait > 0) { c.wait -= dt; if (p.crawl) c.moving = false; else H.brake(c, dt); return; }
        const t = c.points[c.pi];
        let arrived;
        if (p.crawl) { const dx = t[0] - c.x; arrived = Math.abs(dx) < 3 || !H.crawlStep(c, Math.sign(dx) * (p.speed || 16) * dt); }
        else arrived = H.swimTo(c, t[0], t[1], p.speed || 26, dt, 2);
        if (arrived) { c.pi = (c.pi + 1) % c.points.length; c.wait = U.rangeOf([1, 2.5]); }
      } else if (c.state === 'swerve') {
        c.catchable = false;
        H.flee(c, ctx, (p.speed || 26) * 2, dt);
        if (c.st <= 0) c.state = 'patrol';
      } else if (c.state === 'flee') {
        c.catchable = true; // fast but doesn't dodge: get ahead of it
        if (p.crawl) { if (!H.crawlStep(c, c.dir * (p.fleeSpeed || 70) * dt, 200)) c.dir = -c.dir; }
        else H.flee(c, ctx, p.fleeSpeed || 70, dt);
        if (c.st <= 0) c.state = 'patrol';
      }
      c.hostileActive = !!p.bump && !still && ctx.dist < 30;
    }
  };

  // Lurks (low alpha). Careless approach -> lunges (hostile contact). Slow approach -> catchable.
  B.ambush = {
    init(c) { c.state = 'lurk'; },
    update(c, ctx, dt) {
      const p = c.p, W = AQ.World;
      c.st -= dt; c.icon = c.iconT > 0 ? c.icon : null;
      c.hostileActive = false;
      if (c.state === 'lurk') {
        c.catchable = true; c.targetAlpha = ctx.dist < 40 ? 0.85 : (p.alpha || 0.4);
        if (p.surface) H.swimTo(c, c.hx + Math.sin(c.t * 0.2) * 8, W.sea + 3, 5, dt, 2);
        else if (!H.lure(c, ctx, dt, 16)) H.swimTo(c, c.hx + Math.sin(c.t * 0.3) * 6, c.hy + Math.sin(c.t * 0.5) * 3, 5, dt, 2);
        if (H.careless(c, ctx, p.aggroR || 50, p.carelessNoise || 0.45) && !c.feeding) {
          c.state = 'lunge'; c.st = 0.7; H.alertMark(c); AQ.Audio.play('lunge');
          const L = ctx.dist || 1; c.vx = (ctx.dx / L) * (p.lungeSpeed || 130); c.vy = (ctx.dy / L) * (p.lungeSpeed || 130);
        }
      } else if (c.state === 'lunge') {
        c.catchable = false; c.targetAlpha = 1; c.hostileActive = true;
        H.integrate(c, dt);
        if (c.st <= 0) { c.state = 'retreat'; c.st = 3; }
      } else {
        c.catchable = false;
        if (H.swimTo(c, c.hx, p.surface ? W.sea + 3 : c.hy, 30, dt, 3) || c.st <= 0) c.state = 'lurk';
      }
    }
  };

  // Hidden until coaxed: by bait ('bait'), by waiting quietly nearby ('quiet'), or either.
  B.coax = {
    init(c) { c.state = 'hidden'; c.quiet = 0; },
    update(c, ctx, dt) {
      const p = c.p;
      c.st -= dt; c.icon = c.iconT > 0 ? c.icon : null;
      const baitNear = ctx.bait && Math.hypot(ctx.bait.x - c.hx, ctx.bait.y - c.hy) < AQ.TUNING.bait.lureRadius;
      if (c.state === 'hidden') {
        c.catchable = false; c.hidden = true; c.targetAlpha = 0;
        c.x += (c.hx - c.x) * Math.min(1, dt * 6); c.y += (c.hy - c.y) * Math.min(1, dt * 6);
        if (R.chance(dt * 0.6)) AQ.FX.bubble(c.hx + R.range(-3, 3), c.hy - 2);
        const quietOK = ctx.dist < (p.quietR || 70) && ctx.noise < 0.1;
        c.quiet = quietOK ? c.quiet + dt : 0;
        const wantsBait = (p.emerge === 'bait' || p.emerge === 'either') && baitNear;
        const wantsQuiet = (p.emerge === 'quiet' || p.emerge === 'either') && c.quiet > (p.quietTime || 3);
        if (wantsBait || wantsQuiet) { c.state = 'out'; c.st = U.rangeOf(p.outTime || [6, 9]); c.icon = '?'; c.iconT = 1; c.y = c.hy - 4; }
      } else {
        c.hidden = false; c.catchable = true; c.targetAlpha = 1;
        if (!H.lure(c, ctx, dt, 12)) H.swimTo(c, c.hx + Math.sin(c.t) * 6, c.hy - 8, 6, dt, 2);
        if (H.careless(c, ctx, p.hideR || 42, p.carelessNoise || 0.4) || (c.st <= 0 && !c.feeding)) { c.state = 'hidden'; c.quiet = 0; H.alertMark(c, 0.5); }
      }
    }
  };

  // Raises its guard when you come close; hover still for a moment and it relaxes (catchable).
  B.defensive = {
    init(c) { c.state = 'calm'; c.still = 0; },
    update(c, ctx, dt) {
      const p = c.p;
      c.icon = null;
      if (ctx.dist > (p.alertR || 46) * 1.4) { c.state = 'calm'; c.still = 0; }
      if (c.state === 'calm') {
        c.catchable = false;
        if (!H.lure(c, ctx, dt, 10)) H.crawl(c, dt, 5, 30);
        if (ctx.dist < (p.alertR || 46)) { c.state = 'guard'; c.still = 0; }
      } else if (c.state === 'guard') {
        c.catchable = false; c.moving = false; c.icon = '!'; c.facing = ctx.dx > 0 ? 1 : -1;
        c.still = ctx.noise < 0.15 ? c.still + dt : Math.max(0, c.still - dt * 2);
        if (c.still > (p.relaxTime || 2)) { c.state = 'relaxed'; AQ.FX.text(c.x, c.y - 10, '...', '#dfe'); }
      } else {
        c.catchable = true; c.moving = false; c.icon = null;
        if (H.careless(c, ctx, 30, 0.6)) { c.state = 'guard'; c.still = 0; }
      }
      // catchable while far away and unaware (you can't net from far anyway)
      if (c.state === 'calm' && ctx.dist > (p.alertR || 46)) c.catchable = true;
    },
    onSwing(c, ctx) {
      if (c.state === 'guard' && ctx.dist < 30) {
        if (c.p.withdraw) { AQ.FX.text(c.x, c.y - c.r - 4, '...', '#dfe'); AQ.HUD.toast('It pulls into its shell. Wait for it to relax.', '#cfe8ff'); return; }
        ctx.P.knock(ctx.dx || 1, ctx.dy - 4, AQ.TUNING.knockback.light);
        AQ.HUD.toast('Pinched! Wait for it to relax.', '#ffd56b');
      }
    }
  };

  // Lives inside a tide pool. Netting the pool is a chance roll; misses empty the pool for a while.
  B.tidepool = {
    init(c) { c.state = 'in'; this.place(c); },
    place(c) {
      const pools = AQ.World.pools || [];
      if (!pools.length) return;
      const taken = new Set(AQ.Creatures.list.filter((o) => o !== c && o.pool).map((o) => o.pool.id));
      const free = pools.filter((p) => !taken.has(p.id));
      c.pool = (free.length ? R.pick(free) : R.pick(pools));
      c.x = c.hx = c.pool.x; c.y = c.hy = c.pool.surface + Math.max(2, Math.min(5, Math.round(c.pool.depth / 2)));
    },
    update(c, ctx, dt) {
      c.st -= dt;
      c.allowAir = true;
      if (c.state === 'empty') { c.targetAlpha = 0; c.catchable = false; if (c.st <= 0) { this.place(c); c.state = 'in'; } return; }
      // darting around inside the pool: the visible "there's one in here" cue
      c.catchable = true;
      c.targetAlpha = 0.55 + Math.sin(c.t * 9) * 0.3;
      if (!c.dt2 || c.dt2 < 0) { c.dt2 = R.range(0.2, 0.7); c.tx2 = c.pool.x + R.range(-c.pool.w / 4, c.pool.w / 4); }
      c.dt2 -= dt;
      c.x += (c.tx2 - c.x) * Math.min(1, dt * 10); c.facing = c.tx2 > c.x ? 1 : -1; c.moving = true;
      if (R.chance(dt * 1.5)) AQ.FX.sparkle(c.x, c.pool.surface, '#e8ffff', 1);
    },
    // returns true if the catch succeeds
    tryCatch(c, ctx) {
      const chance = c.p.chance + (ctx.P.sneaking ? c.p.sneakBonus : 0);
      if (R() < chance) return true;
      c.state = 'empty'; c.st = U.rangeOf([10, 18]);
      AQ.FX.sparkle(c.x, c.pool.surface, '#bff', 8);
      AQ.HUD.toast('Splash! It slipped away.', '#bfefff');
      return false;
    }
  };

  // Hops between rock pools (above the waterline). Catchable resting or mid-hop.
  B.hopper = {
    init(c) { c.state = 'rest'; c.st = U.rangeOf(c.p.restTime); c.allowAir = true; this.pickAnchor(c, true); },
    pickAnchor(c, snap) {
      const pools = AQ.World.pools || [];
      if (!pools.length) return;
      const choices = pools.filter((p) => p !== c.anchor);
      c.anchor = R.pick(choices.length ? choices : pools);
      const side = R.chance(0.5) ? -1 : 1;
      c.ax = c.anchor.x + side * (c.anchor.w / 2 + 4);
      const g = AQ.World.groundBelow(c.ax, c.anchor.surface - 14, 30);
      c.ay = (g === null ? c.anchor.surface : g) - (c.foot || c.r * 0.6);
      if (snap) { c.x = c.hx = c.ax; c.y = c.hy = c.ay; }
    },
    update(c, ctx, dt) {
      c.st -= dt; c.catchable = true; c.targetAlpha = 1;
      if (c.state === 'rest') {
        c.moving = false;
        if (c.st <= 0 || H.careless(c, ctx, c.p.alertR || 36)) {
          if (c.st > 0) H.alertMark(c, 0.5);
          c.state = 'hop'; c.sx = c.x; c.sy = c.y; this.pickAnchor(c); c.st = c.p.hopTime || 0.9; c.hopT = c.st;
        }
      } else {
        const t = 1 - c.st / c.hopT;
        c.x = U.lerp(c.sx, c.ax, t); c.y = U.lerp(c.sy, c.ay, t) - Math.sin(t * Math.PI) * 30;
        c.facing = c.ax > c.sx ? 1 : -1; c.moving = true;
        if (c.st <= 0) { c.state = 'rest'; c.st = U.rangeOf(c.p.restTime); c.x = c.ax; c.y = c.ay; c.hx = c.x; c.hy = c.y; }
      }
    }
  };

  // Barely reacts at all.
  // MIRROR: while you're near and moving, it dances: it copies your swimming, mirrored left-right.
  // Hold still for a moment and it relaxes and drifts up to you - then it can be netted.
  // params: range (px, 70), calmTime (s still before it relaxes, 0.9), approach (px/s, 26), mirror (0..1, 0.9)
  B.mirror = {
    update(c, ctx, dt) {
      const p = c.p, P = ctx.P, range = p.range || 70;
      c.catchable = false; c.targetAlpha = 1;
      if (ctx.dist > range) { c.calm = 0; c.icon = null; H.idle(c, dt); return; }
      const still = Math.hypot(P.vx, P.vy) < 6;
      c.calm = still ? (c.calm || 0) + dt : 0;
      if (c.calm >= (p.calmTime || 0.9)) {
        // relaxed: drift closer and stay a moment
        c.catchable = true;
        c.facing = ctx.dx > 0 ? 1 : -1;
        if (ctx.dist > 14) H.swimTo(c, P.x - Math.sign(ctx.dx || 1) * 12, P.y, p.approach || 26, dt, 3); else H.brake(c, dt);
        if (c.iconT <= 0) { c.icon = '♥'; c.iconT = 1.2; }
        return;
      }
      // dancing: mirror your movement (your left is its right), staying near its home
      const k = p.mirror !== undefined ? p.mirror : 0.9, home = p.wanderR || 60;
      let tx = c.x - P.vx * k * 0.25, ty = c.y + P.vy * k * 0.25;
      tx = U.clamp(tx, c.hx - home, c.hx + home); ty = U.clamp(ty, Math.max(AQ.World.sea + 8, c.hy - home * 0.6), c.hy + home * 0.6);
      H.swimTo(c, tx, ty, Math.max(10, Math.hypot(P.vx, P.vy) * k), dt, 6);
      if (Math.abs(P.vx) > 4) c.facing = P.vx > 0 ? -1 : 1;
      if (c.iconT <= 0 && !still) { c.icon = '~'; c.iconT = 0.6; }
    },
    missText: 'It mirrors you! Stay still and let it come to you.'
  };

  // LURE: a bright glowing decoy bobs on a stalk; the real creature waits still and dim beside it.
  // The decoy can't be netted (it just puffs and flickers) and flickers when you get close, as a hint.
  // Rushing in carelessly makes the real one duck for a second.
  // params: decoyDist (px, 12), decoyColor ('#d8ff8a'), alpha (real creature visibility, 0.55), glow (light radius, 26)
  B.lure = {
    init(c) { c.decoy = { x: c.x, y: c.y, a: 1, flick: 0 }; },
    update(c, ctx, dt) {
      const p = c.p, d = c.decoy;
      H.brake(c, dt);
      c.moving = false;
      // the decoy bobs ahead of the creature
      d.x = c.x + c.facing * (p.decoyDist || 12) + Math.sin(c.t * 1.3 + c.seed) * 2;
      d.y = c.y - (c.r * 0.6) + Math.sin(c.t * 2.1 + c.seed) * 2.5;
      const nearD = Math.hypot(ctx.P.x - d.x, ctx.P.y - d.y) < 40;
      d.flick = Math.max(0, d.flick - dt);
      d.a = d.flick > 0 ? (Math.sin(c.t * 60) > 0 ? 1 : 0.15) : nearD ? (Math.sin(c.t * 9) > -0.3 ? 1 : 0.35) : 0.85 + 0.15 * Math.sin(c.t * 3);
      c.duck = Math.max(0, (c.duck || 0) - dt);
      if (H.careless(c, ctx, 26) && !c.duck) { c.duck = 1; H.alertMark(c, 0.6); }
      c.catchable = !c.duck;
      c.targetAlpha = c.duck ? 0.2 : (p.alpha !== undefined ? p.alpha : 0.55);
    },
    // the net touched the decoy, not the creature
    decoyHit(c) { c.decoy.flick = 0.6; AQ.FX.puff(c.decoy.x, c.decoy.y, 'rgba(230,255,180,0.7)', 5); },
    draw(g, c) {
      const d = c.decoy, col = c.p.decoyColor || '#d8ff8a';
      if (!d) return;
      // a thin stalk from the creature's head to the glowing bulb
      g.globalAlpha = Math.min(1, c.alpha + 0.3) * 0.8; g.fillStyle = 'rgba(60,70,50,0.9)';
      const hx = c.x + c.facing * c.r * 0.5, hy = c.y - c.r * 0.5;
      for (let i = 0; i <= 6; i++) { const t = i / 6; g.fillRect(Math.round(hx + (d.x - hx) * t), Math.round(hy + (d.y - hy) * t - Math.sin(t * Math.PI) * 3), 1, 1); }
      const x = Math.round(d.x), y = Math.round(d.y);
      g.globalAlpha = d.a * 0.22; g.fillStyle = col; g.fillRect(x - 4, y - 3, 9, 7); g.fillRect(x - 3, y - 4, 7, 9);
      g.globalAlpha = d.a * 0.5; g.fillRect(x - 2, y - 2, 5, 5);
      g.globalAlpha = d.a; g.fillRect(x - 1, y - 1, 3, 3); g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
      g.globalAlpha = 1;
    },
    missText: 'Just a glowing decoy! The real one is hiding beside it.'
  };

  // MID-AIR: cruises just under the surface and leaps out in an arc every few seconds.
  // It can only be netted while it's in the air.
  // params: leapEvery ([min, max] s, [2.5, 4.5]), leap (jump speed, 125), speed (cruise, 22), depth (px below surface, 14)
  B.midair = {
    init(c) { c.leapT = R.range(1, 3); c.inLeap = false; },
    update(c, ctx, dt) {
      const p = c.p, W = AQ.World;
      c.targetAlpha = 1;
      if (c.inLeap) {
        c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (W.solid(c.x, c.y)) { c.x -= c.vx * dt; c.y -= c.vy * dt; c.vx *= -0.3; }
        c.catchable = W.air(c.x, c.y);
        c.moving = true;
        if (c.vy > 0 && W.water(c.x, c.y) && c.y > W.sea + 2) {
          c.inLeap = false; c.allowAir = false; c.vy *= 0.3;
          AQ.FX.puff(c.x, W.sea, 'rgba(230,250,255,0.8)', 6);
        }
        return;
      }
      c.catchable = false; c.allowAir = false;
      // cruise back and forth a little under the surface
      const ty = W.sea + (p.depth || 14);
      if (!c.dirX) c.dirX = c.facing || 1;
      if (Math.abs(c.x - c.hx) > (p.wanderR || 90)) c.dirX = -Math.sign(c.x - c.hx);
      H.swimTo(c, c.x + c.dirX * 30, ty, p.speed || 22, dt, 3);
      c.leapT -= dt;
      if (c.leapT <= 0 && c.y < W.sea + 30) {
        const e = p.leapEvery || [2.5, 4.5];
        c.leapT = R.range(e[0], e[1]);
        c.inLeap = true; c.allowAir = true;
        c.vy = -(p.leap || 125); c.vx = c.dirX * 45; c.facing = c.dirX;
        AQ.FX.puff(c.x, W.sea, 'rgba(230,250,255,0.8)', 6);
      }
    },
    missText: 'Too quick underwater. Net it mid-leap!'
  };

  B.easy = {
    update(c, ctx, dt) { c.catchable = true; c.targetAlpha = 1; if (!H.lure(c, ctx, dt, 10)) H.wander(c, dt, c.p.speed || 7, 40); }
  };

  // Flees whenever you get close; never dodges the net, so intercept it. tightBonus: faster near walls.
  B.flee = {
    update(c, ctx, dt) {
      const p = c.p, W = AQ.World;
      c.catchable = true; c.targetAlpha = 1;
      if (ctx.dist < (p.alertR || 60)) {
        let tight = 0;
        for (const [ox, oy] of [[12, 0], [-12, 0], [0, 12], [0, -12]]) if (W.solid(c.x + ox, c.y + oy)) tight++;
        H.flee(c, ctx, (p.fleeSpeed || 50) * (1 + (tight >= 2 ? p.tightBonus || 0 : 0)), dt);
      } else if (!H.lure(c, ctx, dt, 14)) H.wander(c, dt, 10, 50);
    }
  };

  // Clings to a wall/ceiling. pry: must be pried by holding the net.
  B.clinger = {
    update(c) { c.catchable = !c.p.pry; c.pryable = !!c.p.pry; c.targetAlpha = 1; c.moving = false; }
  };

  // Plants: harvested with the net, regrow after a while. drift: floats around the surface.
  B.plant = {
    update(c, ctx, dt) {
      // night-blooming plants (bloom: 'night') are closed buds by day: they can't be harvested then
      c.closed = c.def.bloom === 'night' && AQ.Clock && !AQ.Clock.isNight();
      c.catchable = !c.harvested && !c.closed; c.targetAlpha = c.harvested ? 0.25 : 1;
      const want = c.closed && AQ.Assets.has(c.def.spriteKey + '.closed') ? c.def.spriteKey + '.closed' : c.def.spriteKey;
      if (c.key !== want) c.key = want;
      if (c.harvested) { c.st -= dt; if (c.st <= 0) { c.harvested = false; AQ.FX.sparkle(c.x, c.y - 4, '#cfffbf', 5); } }
      if (c.p.drift) { c.allowAir = true; c.x = c.hx + Math.sin(c.t * 0.05 + c.seed) * 80; c.y = AQ.World.sea + 1 + Math.sin(c.t * 1.2) * 0.8; c.facing = Math.cos(c.t * 0.05 + c.seed) > 0 ? 1 : -1; }
    }
  };

  return B;
})();
