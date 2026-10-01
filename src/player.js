// The diver: momentum swimming, surfacing (gravity in air), knockback, aim direction.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Player = (function () {
  const U = AQ.U;

  function Player(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.facing = 1; this.aimX = 1; this.aimY = 0;
    this.t = 0; this.stun = 0; this.inAir = false; this.sneaking = false;
    this.speedLevel = 1;
    this.anim = 'idle';
    this.bubbleT = 0;
  }

  Player.prototype.maxSpeed = function () {
    const T = AQ.TUNING.swim;
    return T.maxSpeed * (1 + (this.speedLevel - 1) * T.boostPerLevel) * (this.sneaking ? T.sneakMult : 1);
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

  Player.prototype.update = function (dt, world, input) {
    const T = AQ.TUNING.swim;
    this.t += dt;
    this.stun = Math.max(0, this.stun - dt);
    this.sneaking = input.isDown('ShiftLeft', 'ShiftRight');
    const ax = this.stun > 0 ? { x: 0, y: 0 } : input.axis();
    const hasInput = ax.x !== 0 || ax.y !== 0;
    const mult = 1 + (this.speedLevel - 1) * T.boostPerLevel;
    this.inAir = world.air(this.x, this.y);

    if (this.inAir) {
      this.vy += T.gravity * dt;
      this.vx += ax.x * T.accel * 0.25 * dt;
      this.vx *= Math.exp(-T.airDrag * dt);
    } else {
      const accel = T.accel * mult * (this.sneaking ? 0.6 : 1);
      if (hasInput) { this.vx += ax.x * accel * dt; this.vy += ax.y * accel * dt; }
      const d = hasInput ? T.drag : T.idleDrag;
      const k = Math.exp(-d * dt);
      this.vx *= k; this.vy *= k;
      // gentle surface buoyancy so the diver bobs instead of jittering at the waterline
      if (world.air(this.x, this.y - 3) && !hasInput) this.vy += 30 * dt;
      const max = this.maxSpeed(), sp = Math.hypot(this.vx, this.vy);
      if (sp > max && this.stun <= 0) { const f = Math.max(max / sp, Math.exp(-7 * dt)); this.vx *= f; this.vy *= f; }
    }

    if (ax.x) this.facing = ax.x > 0 ? 1 : -1;
    if (hasInput) { this.aimX = ax.x; this.aimY = ax.y; }

    this.move(world, this.vx * dt, this.vy * dt);

    const sp = this.speed();
    this.anim = AQ.Catching && AQ.Catching.swinging() ? 'net' : sp > 18 ? 'swim' : 'idle';
    this.bubbleT -= dt * (0.6 + sp / 40);
    if (this.bubbleT <= 0 && !this.inAir) {
      this.bubbleT = U.R.range(0.6, 1.6);
      AQ.FX && AQ.FX.bubble(this.x + this.facing * 7, this.y - 3);
    }
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
    const blink = this.stun > 0 && Math.floor(this.t * 20) % 2;
    AQ.Assets.draw(ctx, 'player', this.anim, this.x, this.y, { t: this.t, flip: this.facing < 0, alpha: blink ? 0.5 : 1 });
  };

  return Player;
})();

AQ.Camera = (function () {
  const U = AQ.U;
  const cam = { x: 0, y: 0, w: 320, h: 180 };
  cam.snap = function (p) { cam.x = p.x; cam.y = p.y; cam.clamp(); };
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
