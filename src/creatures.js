// Creature + plant entities in the world: spawning from data, simulation, drawing, respawn.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Creatures = (function () {
  const U = AQ.U, R = U.R;
  const C = { list: [], slots: [], defs: {} };
  const SURF_CACHE = {};

  C.init = function () {
    C.list = []; C.slots = [];
    const fams = AQ.data.families || {}, famDone = {};
    for (const def of AQ.data.creatures) {
      C.defs[def.id] = def;
      def.params = def.params || {};
      def.spriteKey = (def.is_plant ? 'plant.' : 'creature.') + def.id;
      if (def.event) continue;                    // falling-star creatures: no wild spawn (src/starfall.js places them)
      if (!AQ.World.biomeById[def.biome]) { console.warn('[creatures] unknown biome', def.biome, def.id); continue; }
      // a family with shared slots (AQ.data.families): its members take turns, picked by weight
      const fam = def.family && fams[def.family];
      if (fam && fam.slots) {
        if (famDone[def.family]) continue;
        famDone[def.family] = true;
        const pool = AQ.data.creatures.filter((d) => d.family === def.family).map((d) => ({ def: d, w: (fam.weights || {})[d.id] != null ? fam.weights[d.id] : 1 }));
        pool.forEach((p) => { C.defs[p.def.id] = p.def; p.def.params = p.def.params || {}; p.def.spriteKey = 'creature.' + p.def.id; });
        for (let i = 0; i < fam.slots; i++) { const slot = { def, timer: 0, members: [], pool }; C.slots.push(slot); spawnSlot(slot); }
        continue;
      }
      // spawn.extra: more places this creature also lives, each { n, at, area, y } like spawn itself
      const groups = [def.spawn || { at: 'water' }].concat((def.spawn && def.spawn.extra) || []);
      groups.forEach((sp, gi) => {
        for (let i = 0; i < (sp.n || 1); i++) {
          const slot = { def, timer: 0, members: [], sp: gi ? sp : null };
          C.slots.push(slot);
          spawnSlot(slot);
        }
      });
    }
  };

  function spriteR(def) {
    const e = AQ.Assets.entry(def.spriteKey);
    return e ? Math.max(3, Math.min(e.fw, e.fh * 1.4) * 0.32) : 5;
  }
  C.spriteR = spriteR;
  // pixels from the sprite's anchor down to its lowest visible pixel (so it stands on the ground)
  function footOf(def) {
    const e = AQ.Assets.entry(def.spriteKey || ((def.is_plant ? 'plant.' : 'creature.') + def.id));
    return e && e.vis ? e.vis[3] - e.anchor[1] + 1 : spriteR(def) * 0.6;
  }
  function headOf(def) {
    const e = AQ.Assets.entry(def.spriteKey || ((def.is_plant ? 'plant.' : 'creature.') + def.id));
    return e && e.vis ? e.anchor[1] - e.vis[1] : spriteR(def) * 0.6;
  }
  C.footOf = footOf;

  function movementOf(def) {
    if (def.is_plant || def.catch_behavior === 'clinger') return 'still';
    if (def.params.crawl) return 'crawl';
    if (def.category === 'crustacean' || def.category === 'gastropod') return 'crawl';
    return 'swim';
  }

  function makeCreature(def, x, y, slot) {
    const c = {
      def, p: def.params, slot, x, y, hx: x, hy: y, vx: 0, vy: 0, facing: R.chance(0.5) ? 1 : -1,
      t: R.range(0, 10), st: 0, seed: R.range(0, 100), alpha: 0, targetAlpha: 1,
      catchable: true, pryable: false, hidden: false, hostileActive: false, hitCD: 0,
      icon: null, iconT: 0, r: spriteR(def), foot: footOf(def), movement: movementOf(def), harvested: false,
      sex: AQ.Sex ? AQ.Sex.roll(def) : null
    };
    c.key = AQ.Sex ? AQ.Sex.spriteKey(def, c.sex) : def.spriteKey;
    if (AQ.World.air(x, y)) c.allowAir = true;   // lives on dry land
    c.bhv = AQ.Behaviors[def.catch_behavior] || AQ.Behaviors.easy;
    if (def.catch_behavior === 'clinger' && def.spawn && def.spawn.at === 'ceiling') c.flipY = true;
    if (c.bhv.init) c.bhv.init(c);
    C.list.push(c);
    return c;
  }

  // one creature at (x, y) with no slot (it never respawns): falling-star creatures
  C.spawnAt = function (def, x, y) { def.params = def.params || {}; def.spriteKey = def.spriteKey || 'creature.' + def.id; return makeCreature(def, x, y, null); };

  function spawnSlot(slot) {
    if (slot.pool) slot.def = pickWeighted(slot.pool);           // family slot: which member turns up this time
    const def = slot.def, sp = slot.sp || def.spawn || { at: 'water' };
    if (AQ.Clock && !AQ.Clock.activeFor(def)) { slot.timer = 8; return; }   // night-only (or day-only): wait for its hours
    if (def.rare !== undefined && R() > def.rare) { slot.timer = 60; return; }
    if (def.catch_behavior === 'school') {
      const spot = C.findSpot(def, sp.at, undefined, undefined, sp);
      if (!spot) { slot.timer = 10; return; }
      const size = R.int(def.params.size ? def.params.size[0] : 5, def.params.size ? def.params.size[1] : 7);
      const school = { x: spot[0], y: spot[1], hx: spot[0], hy: spot[1], vx: 0, vy: 0, t: 0, fleeT: 0, members: [] };
      for (let i = 0; i < size; i++) {
        const m = makeCreature(def, spot[0] + R.range(-10, 10), spot[1] + R.range(-6, 6), slot);
        m.school = school;
        m.slotN = i;
        m.ox = R.range(-4, 4); m.oy = R.range(-3, 3);
        m.straggler = !!def.params.straggler && i === size - 1;
        school.members.push(m);
        slot.members.push(m);
      }
      return;
    }
    const spot = C.findSpot(def, sp.at, undefined, undefined, sp);
    if (!spot) { slot.timer = 15; return; }
    slot.members.push(makeCreature(def, spot[0], spot[1], slot));
  }

  function pickWeighted(pool) {
    const total = pool.reduce((a, p) => a + Math.max(0, p.w), 0);
    let r = R() * total;
    for (const p of pool) { r -= Math.max(0, p.w); if (r <= 0) return p.def; }
    return pool[pool.length - 1].def;
  }

  // ---------------------------------------------------------------- placement
  function columnSurfaces(b, x, kind) {
    const W = AQ.World, out = [];
    const y0 = Math.max(b.rect[1], kind === 'ice_top' ? W.sea - 16 : kind === 'ground' ? 0 : W.sea), y1 = Math.min(W.h - 1, b.rect[1] + b.rect[3]);
    for (let y = y0; y < y1; y++) {
      const here = W.at(x, y);
      if (kind === 'floor' && here === W.WATER && W.solid(x, y + 1) && W.biomeAt(x, y) === b) out.push(y + 1);
      if (kind === 'ceiling' && here === W.WATER && W.solid(x, y - 1) && y > W.sea + 2 && W.biomeAt(x, y) === b) out.push(y - 1);
      if (kind === 'ground' && here !== W.SOLID && W.solid(x, y + 1) && !W.poolAt(x, y) && W.biomeAt(x, y) === b) out.push(y + 1);
      if (kind === 'ice_top' && here === W.AIR && W.solid(x, y + 1) && y < W.sea && W.biomeAt(x, y) === b) out.push(y + 1);
    }
    return out;
  }

  // Returns a creature-centre position for placement kind `at`, or null.
  C.findSpot = function (def, at, nearX, radius, spawn) {
    const W = AQ.World, b = W.biomeById[def.biome], sp = spawn || def.spawn || {};
    const r = spriteR(def);
    const [bx, by, bw, bh] = b.rect;
    let x0 = Math.max(bx, (sp.area && sp.area[0]) || bx), x1 = Math.min(bx + bw, (sp.area && sp.area[1]) || bx + bw);
    if (nearX !== undefined) { x0 = Math.max(x0, nearX - radius); x1 = Math.min(x1, nearX + radius); }
    const yOK = (y) => !sp.y || (y >= sp.y[0] && y <= sp.y[1]);
    const plant = def.is_plant;
    for (let tries = 0; tries < 300; tries++) {
      const x = Math.floor(R.range(x0, x1));
      if (at === 'ground') {
        // any surface, dry land included (Tide Pools)
        const list = columnSurfaces(b, x, 'ground').filter(yOK);
        if (!list.length) continue;
        const g = R.pick(list);
        if (plant) return [x, g];
        if (W.open(x, g - r * 1.2)) return [x, g - footOf(def)];
        continue;
      }
      if (at === 'floor' || at === 'reef' || at === 'ceiling' || at === 'ice_top') {
        const list = columnSurfaces(b, x, at === 'reef' ? 'floor' : at).filter(yOK);
        if (!list.length) continue;
        const g = R.pick(list);
        if (at === 'ceiling') return [x, g + 1 + footOf(def)];   // drawn upside-down: its 'feet' touch the ceiling
        if (at === 'ice_top') {
          // must be near the edge of the ice so it's reachable from the water
          let edge = false;
          for (let dx = -14; dx <= 14 && !edge; dx += 2) edge = W.water(x + dx, W.sea + 3) && !W.solid(x + dx, W.sea - 1);
          if (!edge) continue;
          return [x, g - footOf(def)];
        }
        if (plant) return [x, g];
        if (at === 'reef') { const y = g - R.range(8, 26); if (W.water(x, y) && W.water(x, y - r)) return [x, y]; continue; }
        if (W.water(x, g - r * 1.2)) return [x, g - footOf(def)];
      } else if (at === 'surface') {
        const y = W.sea + 3;
        if (plant) return [x, W.sea + 1];
        if (W.water(x, y) && W.water(x, y + 10) && W.biomeAt(x, y + 10) === b) return [x, y + r * 0.3];
      } else if (at === 'wall') {
        const y = R.range(Math.max(by, W.sea), by + bh);
        if (!yOK(y) || !W.water(x, y) || W.biomeAt(x, y) !== b) continue;
        const dir = R.chance(0.5) ? 1 : -1;
        for (let k = 1; k < 80; k++) if (W.solid(x + dir * k, y)) { const px = x + dir * (k - r * 0.7); if (W.water(px, y)) return [px, y]; break; }
      } else if (at === 'pool') {
        const pools = W.pools || [];
        if (pools.length) { const p = R.pick(pools); return [p.x, p.surface + 2]; }
      } else { // water
        const y = R.range(Math.max(by, W.sea + 8), by + bh);
        if (!yOK(y) || W.biomeAt(x, y) !== b) continue;
        if (W.water(x, y) && W.water(x + 8, y) && W.water(x - 8, y) && W.water(x, y + 8) && W.water(x, y - 8)) return [x, y];
      }
    }
    if (at === 'ice_top') return C.findSpot(def, 'surface', nearX, radius, spawn);
    return null;
  };

  // ---------------------------------------------------------------- update
  const ctx = {};
  // Safety net: a visible swimmer that somehow ended up inside rock (a knock, a leap) is moved to
  // the nearest open water instead of staying stuck there.
  function unstick(c) {
    const W = AQ.World;
    for (let r = 2; r <= 40; r += 2) for (let a = 0; a < 16; a++) {
      const x = c.x + Math.cos(a / 16 * Math.PI * 2) * r, y = c.y + Math.sin(a / 16 * Math.PI * 2) * r;
      if (W.water(x, y)) { c.x = x; c.y = y; c.vx = c.vy = 0; c.target = null; return; }
    }
  }
  C.frame = 0;
  C.update = function (dt, game) {
    C.frame++;
    const P = game.player, simR = AQ.TUNING.creatures.simRadius;
    ctx.P = P; ctx.noise = P.noise(); ctx.bait = AQ.Catching ? AQ.Catching.bait : null;
    for (const c of C.list.slice()) {
      const dx = P.x - c.x, dy = P.y - c.y;
      const far = Math.abs(dx) > simR || Math.abs(dy) > simR;
      // out of its hours and nowhere near you: it has simply gone home
      if (far && c.def.active && AQ.Clock && !AQ.Clock.activeFor(c.def)) { C.remove(c); if (c.slot) c.slot.timer = 8; continue; }
      if (far) continue;
      ctx.dx = dx; ctx.dy = dy; ctx.dist = Math.hypot(dx, dy);
      c.t += dt; c.iconT -= dt; c.hitCD -= dt;
      c.bhv.update(c, ctx, dt);
      if (c.def.active && AQ.Clock && !AQ.Clock.activeFor(c.def)) leave(c, dt);
      if (c.movement === 'swim' && !c.hidden && AQ.World.solid(c.x, c.y)) unstick(c);
      c.alpha += (c.targetAlpha - c.alpha) * Math.min(1, dt * (c.leaving ? 1 : 5));
      if (c.cap !== undefined) {                 // fading away (a falling star's creature at the end of its stay)
        c.alpha = Math.min(c.alpha, c.cap);
        if (c.cap < 0.35) { c.catchable = false; c.pryable = false; }
      }
      if (c.hostileActive && c.hitCD <= 0 && ctx.dist < c.r + 7) {
        const k = AQ.TUNING.knockback[c.def.knockback === 'strong' ? 'strong' : 'light'];
        P.knock(dx || 1, dy - 2, k);
        c.hitCD = 1.2;
        AQ.FX.puff(P.x, P.y, 'rgba(255,255,255,0.7)', 6);
        AQ.HUD.toast(c.def.knockback === 'strong' ? `${c.def.name} shoves you away!` : `${c.def.name} bumps you.`, '#ffcf9a');
        AQ.Audio.play('bump');
        if (AQ.Tips) AQ.Tips.event('bumped');
      }
    }
    // respawn empty slots out of the player's sight
    for (const s of C.slots) {
      if (s.members.length) continue;
      s.timer -= dt;
      if (s.timer <= 0) spawnSlot(s);
    }
  };

  // Out of its hours (e.g. a night creature at dawn): it can't be netted any more and slowly fades
  // away: swimmers drift off and down, crawlers and plants sink into the ground (burrow / close up).
  function leave(c, dt) {
    if (!c.leaving) { c.leaving = true; c.leaveDir = R.chance(0.5) ? 1 : -1; }
    c.catchable = false; c.pryable = false; c.targetAlpha = 0; c.hostileActive = false;
    if (c.movement === 'swim') { c.x += c.leaveDir * 10 * dt; c.y += 4 * dt; c.facing = c.leaveDir; }
    else c.y += 2 * dt;
    if (c.alpha < 0.04) { C.remove(c); if (c.slot) c.slot.timer = 8; }
  }

  // Removes a caught creature and schedules its slot to respawn once empty.
  C.remove = function (c) {
    const i = C.list.indexOf(c);
    if (i >= 0) C.list.splice(i, 1);
    if (c.onRemove) c.onRemove(c);
    const s = c.slot;
    if (s) {
      s.members = s.members.filter((m) => m !== c);
      if (c.school) c.school.members = c.school.members.filter((m) => m !== c);
      if (!s.members.length) s.timer = AQ.TUNING.creatures.respawnTime;
    }
  };

  C.near = function (x, y, r) { return C.list.filter((c) => Math.abs(c.x - x) < r && Math.abs(c.y - y) < r); };

  // ---------------------------------------------------------------- drawing
  function onScreen(c) {
    const cam = AQ.Camera, l = cam.left() - 40, t = cam.top() - 40;
    return c.x > l && c.x < l + cam.w + 80 && c.y > t && c.y < t + cam.h + 80;
  }
  C.drawBack = function (g) {
    for (const c of C.list) {
      if (!onScreen(c)) continue;
      if (c.p.home && AQ.Assets.has(c.p.home)) AQ.Assets.draw(g, c.p.home, 'idle', c.hx, c.hy + c.foot);
      if (c.alpha < 0.02) continue;
      AQ.Assets.draw(g, c.key || c.def.spriteKey, c.moving ? 'move' : 'idle', c.x, c.y, { t: c.t, flip: c.facing < 0, flipY: c.flipY, alpha: Math.min(1, c.alpha) });
      if (c.bhv.draw) c.bhv.draw(g, c);          // extras (e.g. a lure's glowing decoy)
    }
  };
  C.drawFront = function (g) {
    const F = AQ.Font;
    for (const c of C.list) {
      if (!onScreen(c)) continue;
      // markers only near the diver, so the screen doesn't fill up with symbols
      const P = AQ.Game.player, near = Math.abs(c.x - P.x) < 90 && Math.abs(c.y - P.y) < 70;
      const icon = c.icon;
      if (icon && near && c.alpha > 0.2) {
        const col = icon === '!' ? '#ffdf5a' : icon === '?' ? '#9fe8ff' : '#e8f4ff';
        F.draw(g, icon, c.x, c.y - c.r - 9 + Math.round(Math.sin(c.t * 4)), col, { align: 'center' });
      }
      if (c.pryProgress > 0) {
        const w = 14, x = Math.round(c.x - w / 2), y = Math.round(c.y - c.r - 6);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 1, w + 2, 4);
        g.fillStyle = '#ffd56b'; g.fillRect(x, y, Math.round(w * c.pryProgress), 2);
      }
    }
  };
  C.lights = function (L) {
    const cam = AQ.Camera, l = cam.left() - 60, t = cam.top() - 60;
    for (const c of C.list) {
      if (c.decoy && c.x > l && c.x < l + cam.w + 120 && c.y > t && c.y < t + cam.h + 120) L.push({ x: c.decoy.x, y: c.decoy.y, r: c.p.glow || 26, color: c.p.decoyColor || '#d8ff8a', power: c.decoy.a * Math.max(0.5, c.alpha) });
      const lt = c.def.light;
      if (!lt || c.harvested || c.x < l || c.x > l + cam.w + 120 || c.y < t || c.y > t + cam.h + 120) continue;
      if (lt.pulse && !c.glow) continue;
      if (c.closed) continue;                    // a night bloom closed for the day
      const yy = c.def.is_plant ? c.y - 5 : c.y;
      L.push({ x: c.x + (c.def.art && c.def.art.lure ? c.facing * c.r : 0), y: yy, r: lt.r, color: lt.color, power: Math.max(0.4, c.alpha) });
    }
  };

  return C;
})();
