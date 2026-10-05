// The diver: momentum swimming, surfacing (gravity in air), knockback, aim direction.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Player = (function () {
  const U = AQ.U;

  function Player(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.facing = 1; this.aimX = 1; this.aimY = 0;
    this.t = 0; this.stun = 0; this.inAir = false; this.sneaking = false;
    this.speedLevel = 1;
    this.anim = 'idle'; this.mode = 'swim';
    this.bubbleT = 0;
  }

  Player.prototype.maxSpeed = function () {
    const T = AQ.TUNING.swim;
    return T.maxSpeed * (1 + (this.speedLevel - 1) * T.boostPerLevel) * (this.sneaking ? T.sneakMult : 1) * (this.heavy > 0 ? U.lerp(1, AQ.TUNING.upgrades.heavySlow, this.heavy) : 1);
  };
  Player.prototype.baseMax = function () { return AQ.TUNING.swim.maxSpeed; };
  // 0..~1.4 "how loud/fast" the player is, relative to base max speed. Creatures read this.
  Player.prototype.noise = function () { return Math.hypot(this.vx, this.vy) / this.baseMax(); };
  Player.prototype.speed = function () { return Math.hypot(this.vx, this.vy); };

  Player.prototype.knock = function (dx, dy, strength) {
    const L = Math.hypot(dx, dy) || 1;
    this.vx = (dx / L) * strength; this.vy = (dy / L) * strength;
    this.stun = AQ.TUNING.knockback.stun;
  };

  // Movement modes: 'swim' (submerged), 'walk' (standing on ground, head above water), 'air' (jumping/falling).
  Player.prototype.update = function (dt, world, input) {
    const T = AQ.TUNING.swim, Wk = AQ.TUNING.walk, hb = T.hitbox;
    this.t += dt;
    this.stun = Math.max(0, this.stun - dt);
    const KB = AQ.TUNING.keys;                         // key bindings (src/keys.js)
    this.sneaking = input.isDown(...KB.sneak);
    const ax = this.stun > 0 ? { x: 0, y: 0 } : input.axis();
    const hasInput = ax.x !== 0 || ax.y !== 0;
    const mult = 1 + (this.speedLevel - 1) * T.boostPerLevel;
    // one-way platforms (ladder tops in side scenes) hold you only while you're not rising or climbing
    if (world.ladderAt) world.oneWayOn = !this.climbing && this.vy >= -1;
    const grounded = this.vy >= -1 && world.boxHits(this.x, this.y + 1.5, hb.w / 2, hb.h / 2);
    // deep enough to submerge your chest -> swim; shallow puddles are just splashed through
    const submerged = world.water(this.x, this.y - (Wk.swimDepth - hb.h / 2)) || (world.water(this.x, this.y) && !grounded);
    this.mode = submerged ? 'swim' : grounded ? 'walk' : 'air';
    this.inAir = !world.water(this.x, this.y);
    const jumpKey = this.stun <= 0 && input.wasPressed(...KB.jump, ...KB.up);

    // ladders (only side scenes have them): up/down on a ladder climbs, Space hops off
    if (world.ladderAt && this.stun <= 0 && this.climbStep(dt, world, input, ax, grounded)) return;

    this.deepWater(dt, world);
    if (this.mode === 'swim') {
      const accel = T.accel * mult * (this.sneaking ? 0.6 : 1);
      if (hasInput) { this.vx += ax.x * accel * dt; this.vy += ax.y * accel * dt; }
      const k = Math.exp(-(hasInput ? T.drag : T.idleDrag) * dt);
      this.vx *= k; this.vy *= k;
      const nearSurface = world.air(this.x, this.y - 6);
      // gentle surface buoyancy so the diver bobs instead of jittering at the waterline
      if (nearSurface && !hasInput) this.vy += 30 * dt;
      // hop out of a pool / onto the shore when there's ground beside you
      if (nearSurface && (ax.y < 0 || input.isDown(...KB.jump)) && (world.solid(this.x + 10 * (ax.x || this.facing), this.y - 2) || world.solid(this.x + 10 * (ax.x || this.facing), this.y + 2))) {
        this.vy = -Wk.jump * 0.85; this.vx += (ax.x || this.facing) * 20;
      }
      const max = this.maxSpeed(), sp = Math.hypot(this.vx, this.vy);
      if (sp > max && this.stun <= 0) { const f = Math.max(max / sp, Math.exp(-7 * dt)); this.vx *= f; this.vy *= f; }
    } else {
      const wmax = Wk.max * mult * (this.sneaking ? Wk.sneakMult : 1);
      const ctl = this.mode === 'walk' ? 1 : Wk.airControl;
      if (ax.x) this.vx += ax.x * Wk.accel * mult * ctl * dt;
      else if (this.mode === 'walk') this.vx *= Math.exp(-Wk.friction * dt);
      if (Math.abs(this.vx) > wmax && this.stun <= 0) this.vx = U.approach(this.vx, Math.sign(this.vx) * wmax, 400 * dt);
      if (this.mode === 'walk') {
        this.vy = 0;
        if (jumpKey) { this.vy = -Wk.jump; this.mode = 'air'; }
      } else {
        this.vy += T.gravity * dt;
        this.vx *= Math.exp(-T.airDrag * dt);
      }
    }

    // face the way you're actually moving (input only decides when nearly still); a net swing keeps its aim
    const netOut = AQ.Catching && AQ.Catching.armOut();
    if (!netOut) {
      if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;
      else if (ax.x) this.facing = ax.x > 0 ? 1 : -1;
    }
    if (hasInput) { this.aimX = ax.x; this.aimY = this.mode === 'swim' ? ax.y : 0; }

    this.move(world, this.vx * dt, this.vy * dt);
    // stick to the ground when walking down slopes
    if (this.mode === 'walk' && this.vy >= 0) {
      for (let k = 1; k <= 4; k++) if (world.boxHits(this.x, this.y + k, hb.w / 2, hb.h / 2)) { this.y += k - 1; break; }
    }

    const sp = this.speed();
    if (this.mode === 'swim') this.anim = netOut ? 'net' : sp > 18 ? 'swim' : 'idle';
    else if (netOut) this.anim = 'standnet';
    else if (this.mode === 'walk') this.anim = Math.abs(this.vx) > 6 ? 'walk' : 'stand';
    else this.anim = 'jump';
    this.bubbleT -= dt * (0.6 + sp / 40);
    if (this.bubbleT <= 0 && this.mode === 'swim') {
      this.bubbleT = U.R.range(0.6, 1.6);
      AQ.FX && AQ.FX.bubble(this.x + this.facing * 7, this.y - 3);
    }
  };

  // DEPTH upgrade: past the limit for your level the water gets heavy. You slow down, the view
  // softens and you're gently nudged back up. Never any damage. (Only in the sea world.)
  Player.prototype.deepWater = function (dt, world) {
    const U2 = AQ.TUNING.upgrades, lvl = (AQ.Game.upgrades && AQ.Game.upgrades.depth) || 0, lim = U2.depthLimitY[Math.min(lvl, U2.depthLimitY.length - 1)];
    const past = world === AQ.World && lim != null && world.water(this.x, this.y) ? this.y - lim : 0;
    const target = past > 0 ? U.clamp(0.35 + past / 30, 0, 1) : 0;
    this.heavy = U.approach(this.heavy || 0, target, dt * 2);
    if (past > 0) {
      this.vy -= (U2.heavyPush + past * 6) * dt;
      if (!AQ.State.flags || !AQ.State.flags.heavyWater) {
        AQ.State.flags = AQ.State.flags || {}; AQ.State.flags.heavyWater = true;
        AQ.HUD.toast(AQ.t('world.heavyWater'), '#9fd8ff', 4);
        AQ.Save && AQ.Save.dirty();
      }
    }
  };

  // Returns true while climbing (the normal walk/swim update is skipped that frame).
  Player.prototype.climbStep = function (dt, world, input, ax, grounded) {
    const hb = AQ.TUNING.swim.hitbox, feet = this.y + hb.h / 2;
    if (!this.climbing) {
      const body = world.ladderAt(this.x, this.y), below = world.ladderAt(this.x, feet + 3);
      if (ax.y < 0 && body && feet > body.top + 1) this.climbing = body;
      else if (ax.y > 0 && below && grounded && feet < below.bottom - 2) this.climbing = below;
      if (!this.climbing) return false;
    }
    const L = this.climbing;
    world.oneWayOn = false;
    this.mode = 'climb'; this.vx = 0;
    this.x += (L.x - this.x) * Math.min(1, dt * 12);
    if (input.wasPressed(...AQ.TUNING.keys.jump)) {        // hop off
      this.climbing = null; this.vy = -AQ.TUNING.walk.jump * 0.6; this.mode = 'air';
      return false;
    }
    this.vy = ax.y * AQ.TUNING.climb.speed;
    this.climbT = (this.climbT || 0) + dt * Math.abs(ax.y);
    this.move(world, 0, this.vy * dt);
    const nf = this.y + hb.h / 2;
    if (ax.y < 0 && nf <= L.top) { this.y = L.top - hb.h / 2 - 0.01; this.vy = 0; this.climbing = null; }   // step out onto the floor above
    else if (ax.y > 0 && nf >= L.bottom - 1) { this.vy = 0; this.climbing = null; }                          // feet on the floor below
    else if (ax.x && !ax.y && nf >= L.bottom - 3) this.climbing = null;                                       // walk off at the bottom
    this.anim = 'climb';
    return true;
  };

  Player.prototype.move = function (world, dx, dy) {
    const hb = AQ.TUNING.swim.hitbox, hw = hb.w / 2, hh = hb.h / 2;
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    if (!steps) return;
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx) {
        if (!world.boxHits(this.x + sx, this.y, hw, hh)) this.x += sx;
        else if (!world.boxHits(this.x + sx, this.y - 1.5, hw, hh)) { this.x += sx; this.y -= 1.5; }
        else if (this.mode === 'walk' && !world.boxHits(this.x + sx, this.y - 3, hw, hh)) { this.x += sx; this.y -= 3; }
        else if (!world.boxHits(this.x + sx, this.y + 1.5, hw, hh)) { this.x += sx; this.y += 1.5; }
        else { this.vx *= -0.15; }
      }
      if (sy) {
        if (!world.boxHits(this.x, this.y + sy, hw, hh)) this.y += sy;
        else { this.vy *= -0.15; }
      }
    }
    this.x = U.clamp(this.x, 8, world.w - 8);
    this.y = U.clamp(this.y, 4, world.h - 6);
  };

  Player.prototype.draw = function (ctx) {
    const blink = this.stun > 0 && !AQ.U.calm() && Math.floor(this.t * 20) % 2;     // (REDUCE FLASHING: no blinking)
    AQ.Assets.draw(ctx, 'player', this.anim, this.x, this.y, { t: this.anim === 'climb' ? this.climbT || 0 : this.t, flip: this.facing < 0, alpha: blink ? 0.5 : 1 });
  };

  return Player;
})();

AQ.Camera = (function () {
  const U = AQ.U;
  const cam = { x: 0, y: 0, w: 320, h: 180 };
  cam.snap = function (p, world) { cam.x = p.x; cam.y = p.y; cam.clamp(world); };
  cam.update = function (dt, p, world) {
    const C = AQ.TUNING.camera;
    const lx = U.clamp(p.vx * C.lookahead, -C.maxLookahead, C.maxLookahead);
    const ly = U.clamp(p.vy * C.lookahead, -C.maxLookahead, C.maxLookahead) * 0.6;
    const k = 1 - Math.exp(-C.stiffness * dt);
    cam.x += (p.x + lx - cam.x) * k;
    cam.y += (p.y + ly - cam.y) * k;
    cam.clamp(world);
  };
  cam.clamp = function (world) {
    world = world || AQ.World;
    cam.x = U.clamp(cam.x, cam.w / 2, world.w - cam.w / 2);
    cam.y = U.clamp(cam.y, cam.h / 2, world.h - cam.h / 2);
  };
  // top-left in integer pixels (pixel-perfect rendering)
  cam.left = () => Math.round(cam.x - cam.w / 2);
  cam.top = () => Math.round(cam.y - cam.h / 2);
  return cam;
})();
