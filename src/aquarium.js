// Home aquarium: one tank per biome. Arrange decorations + harvested plants, watch creatures idle
// (swim / feed / play / rest). Predators stress smaller prey sharing their tank (no harm done).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Aquarium = (function () {
  const U = AQ.U, R = U.R, F = () => AQ.Font;
  const A = { biome: null, fish: [], food: [], bubbles: [], holding: null, tray: 'decor', trayScroll: 0, t: 0, hover: null, ui: [] };
  const TANK = { x: 4, y: 16, w: 312, h: 130, waterTop: 22, sandTop: 126, bottom: 145 };
  const SIZE_RANK = { tiny: 0, small: 1, medium: 2, wide: 2, tall: 2, large: 3, widelarge: 3, huge: 4 };
  const TRAY_Y = 149, CELL = 26;

  const defOf = (id) => AQ.Creatures.defs[id] || AQ.data.creatures.find((d) => d.id === id);
  const decorDef = (id) => AQ.data.decorations.find((d) => d.id === id);
  const biomes = () => AQ.World.biomes.slice().sort((a, b) => order(a) - order(b));
  // tabs follow the left-to-right world order
  function order(b) { return b.rect[0] + (b.id === 'lush_cave' ? 1 : 0) + (b.id === 'cave' ? -1 : 0); }

  // ---------------------------------------------------------------- open / close
  A.open = function (game) {
    game.state = 'aquarium';
    if (!A.biome) {
      const here = AQ.World.biomeAt(game.player.x, game.player.y).id;
      A.biome = here;
    }
    A.prevState = 'play';
    AQ.FX.list.length = 0;
    A.rebuild();
    AQ.Audio.music('aquarium');
  };
  A.close = function (game) {
    cancelHold();
    AQ.FX.list.length = 0;
    game.state = 'play';
    AQ.Save && AQ.Save.save(game);
  };

  A.rebuild = function () {
    const tank = AQ.Collection.tank(A.biome);
    const old = new Map(A.fish.map((f) => [f.uid, f]));
    A.fish = tank.creatures.map((e) => old.get(e.uid) || makeFish(e));
    A.food = [];
    computeStress();
  };

  function makeFish(e) {
    const def = defOf(e.id);
    const loco = def.tank || (def.category === 'crustacean' || def.category === 'gastropod' ? 'crawl' : 'swim');
    const r = AQ.Creatures.spriteR(def);
    const f = {
      uid: e.uid, def, loco, r, key: def.spriteKey || 'creature.' + def.id,
      x: R.range(30, 290), y: loco === 'swim' ? R.range(40, 110) : 0, vx: 0, vy: 0, facing: R.chance(0.5) ? 1 : -1,
      z: R.range(TANK.sandTop + 2, TANK.bottom), state: 'swim', st: R.range(1, 4), t: R.range(0, 9), stress: false, target: null
    };
    if (loco !== 'swim') f.y = f.z - r * 0.6;
    return f;
  }

  function computeStress() {
    const rank = (f) => SIZE_RANK[f.def.sprite_size] || 1;
    A.fish.forEach((f) => {
      const was = f.stress;
      f.stress = !f.def.predator && A.fish.some((o) => o !== f && o.def.predator && rank(o) >= rank(f));
      if (f.stress && !was) { f.state = 'hide'; f.st = 0; f.hideX = R.chance(0.5) ? 18 : 302; }
      if (!f.stress && was) { f.state = 'swim'; f.st = 1; }
    });
  }

  // ---------------------------------------------------------------- simulation
  function steer(f, tx, ty, speed, dt, k = 3) {
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
    const kk = 1 - Math.exp(-k * dt);
    f.vx += ((dx / d) * speed - f.vx) * kk; f.vy += ((dy / d) * speed - f.vy) * kk;
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (Math.abs(f.vx) > 1.5) f.facing = f.vx > 0 ? 1 : -1;
    return d < 4;
  }
  function clampFish(f) {
    f.x = U.clamp(f.x, TANK.x + 8, TANK.x + TANK.w - 8);
    if (f.loco === 'swim') f.y = U.clamp(f.y, TANK.waterTop + 6, TANK.sandTop - 2);
    else f.y = f.z - f.r * 0.6;
  }
  function nextState(f) {
    if (f.stress) { f.state = 'hide'; return; }
    const r = R();
    f.state = r < 0.45 ? 'swim' : r < 0.65 ? 'feed' : r < 0.85 ? 'play' : 'rest';
    f.st = R.range(3, 7);
    f.target = null; f.buddy = null;
    if (f.state === 'play' && f.loco === 'swim') {
      const others = A.fish.filter((o) => o !== f && o.loco === 'swim');
      f.buddy = others.length && R.chance(0.6) ? R.pick(others) : null;
      f.loopC = [f.x, f.y]; f.loopA = 0;
    }
  }

  function updateFish(f, dt) {
    f.t += dt; f.st -= dt;
    // food overrides everything except stress
    const food = !f.stress && A.food.length ? A.food.reduce((a, b) => (Math.hypot(a.x - f.x, a.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y) ? a : b)) : null;
    if (food && (f.loco === 'swim' || food.y > TANK.sandTop - 6)) {
      const reached = f.loco === 'swim' ? steer(f, food.x, food.y, 34, dt, 4) : walk(f, food.x, 18, dt);
      if (reached || Math.hypot(food.x - f.x, food.y - f.y) < 5) { A.food.splice(A.food.indexOf(food), 1); heart(f); }
      clampFish(f); return;
    }
    if (f.st <= 0) nextState(f);
    const sp = f.loco === 'still' ? 0 : f.loco === 'crawl' ? 8 : 16;
    switch (f.state) {
      case 'hide': {
        // stressed: cower in a corner/behind decor, shaking, no feeding or play
        const hx = f.hideX || 18;
        if (f.loco === 'swim') steer(f, hx, TANK.sandTop - 8, 24, dt, 4); else walk(f, hx, 14, dt);
        f.shake = Math.sin(f.t * 40) > 0 ? 1 : 0;
        break;
      }
      case 'swim':
        if (f.loco === 'swim') { if (!f.target || steer(f, f.target[0], f.target[1], sp, dt, 2)) f.target = [R.range(20, 300), R.range(32, 118)]; }
        else if (f.loco === 'crawl') { if (!f.target || walk(f, f.target[0], sp, dt)) f.target = [R.range(20, 300)]; }
        break;
      case 'feed':
        // nibble at the sand / decorations
        if (f.loco === 'swim') { if (!f.target) f.target = [R.range(24, 296), TANK.sandTop - 4]; if (steer(f, f.target[0], f.target[1], sp, dt, 3)) { f.vy = Math.sin(f.t * 12) * 6; } }
        else f.peck = Math.sin(f.t * 10) > 0.6 ? 1 : 0;
        break;
      case 'play':
        if (f.loco === 'swim') {
          if (f.buddy && A.fish.includes(f.buddy)) steer(f, f.buddy.x - f.buddy.facing * 10, f.buddy.y, 30, dt, 4);
          else { f.loopA += dt * 2.6; steer(f, f.loopC[0] + Math.cos(f.loopA) * 18, U.clamp(f.loopC[1] + Math.sin(f.loopA) * 12, 34, 116), 34, dt, 6); }
        } else if (f.loco === 'crawl') { if (!f.target || walk(f, f.target[0], 26, dt)) f.target = [U.clamp(f.x + R.range(-30, 30), 20, 300)]; }
        break;
      case 'rest':
        if (f.loco === 'swim') steer(f, f.x + Math.sin(f.t) * 2, f.y + Math.cos(f.t * 0.7), 3, dt, 1);
        break;
    }
    clampFish(f);
  }
  function walk(f, tx, speed, dt) {
    const dx = tx - f.x;
    if (Math.abs(dx) < 2) return true;
    f.x += Math.sign(dx) * speed * dt; f.facing = dx > 0 ? 1 : -1; f.walking = true;
    return false;
  }
  function heart(f) { AQ.FX.text(f.x, f.y - f.r - 3, '♥', '#ff9fc0'); }

  // ---------------------------------------------------------------- UI layout + input
  function layout() {
    const ui = [];
    ui.push({ id: 'prev', x: 4, y: 2, w: 10, h: 10, label: '<' });
    ui.push({ id: 'next', x: 152, y: 2, w: 10, h: 10, label: '>' });
    ui.push({ id: 'feed', x: 168, y: 2, w: 30, h: 10, label: 'FEED' });
    ui.push({ id: 'log', x: 202, y: 2, w: 26, h: 10, label: 'LOG' });
    ui.push({ id: 'back', x: 260, y: 2, w: 56, h: 10, label: 'BACK (TAB)' });
    ui.push({ id: 'tray_decor', x: 4, y: TRAY_Y, w: 34, h: 10, label: 'DECOR', on: A.tray === 'decor' });
    ui.push({ id: 'tray_fish', x: 4, y: TRAY_Y + 11, w: 34, h: 10, label: 'FISH', on: A.tray === 'fish' });
    ui.push({ id: 'tray_left', x: 40, y: TRAY_Y, w: 8, h: 29, label: '<' });
    ui.push({ id: 'tray_right', x: 308, y: TRAY_Y, w: 8, h: 29, label: '>' });
    const items = trayItems();
    const perPage = Math.floor((308 - 50) / CELL);
    A.trayScroll = U.clamp(A.trayScroll, 0, Math.max(0, items.length - perPage));
    items.slice(A.trayScroll, A.trayScroll + perPage).forEach((it, i) => ui.push(Object.assign({ x: 50 + i * CELL, y: TRAY_Y, w: CELL - 2, h: 29 }, it)));
    return ui;
  }
  function trayItems() {
    const out = [];
    if (A.tray === 'decor') {
      AQ.data.decorations.forEach((d) => out.push({ id: 'item', kind: 'decor', ref: d.id, key: 'decor.' + d.id, name: d.name, count: Infinity }));
      Object.entries(AQ.State.plants).forEach(([id, n]) => { const d = defOf(id); if (d && n > 0) out.push({ id: 'item', kind: 'plant', ref: id, key: 'plant.' + id, name: d.name, count: n }); });
    } else {
      const tank = AQ.Collection.tank(A.biome);
      tank.creatures.forEach((e) => out.push({ id: 'fish', where: 'tank', uid: e.uid, ref: e.id, key: 'creature.' + e.id, name: defOf(e.id).name }));
      tank.storage.forEach((e) => out.push({ id: 'fish', where: 'storage', uid: e.uid, ref: e.id, key: 'creature.' + e.id, name: defOf(e.id).name }));
    }
    return out;
  }

  const hit = (r, m) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;
  const inTank = (m) => m.x >= TANK.x && m.x < TANK.x + TANK.w && m.y >= TANK.y && m.y < TANK.y + TANK.h;

  function placeY(kind, my) { return kind === 'float' ? TANK.waterTop + 1 : U.clamp(Math.round(my), TANK.sandTop + 3, TANK.bottom); }

  A.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, tank = AQ.Collection.tank(A.biome);
    A.t += dt;
    A.ui = layout();
    if (I.wasPressed('Tab') || (I.wasPressed('Escape') && !A.holding)) { A.close(game); return; }
    if (I.wasPressed('KeyL')) { AQ.LogUI.open(game, 'aquarium'); return; }
    if (I.wasPressed('KeyQ', 'ArrowLeft')) switchTank(-1);
    if (I.wasPressed('KeyE', 'ArrowRight')) switchTank(1);
    if (I.wasPressed('KeyF')) feed();
    if (m.wheel) A.trayScroll += m.wheel;
    if ((I.wasPressed('Escape') || m.pressed[2]) && A.holding) { cancelHold(); }

    A.hover = null;
    for (const r of A.ui) if (hit(r, m)) A.hover = r;

    if (m.pressed[0]) {
      const r = A.hover;
      if (r) clickUI(r, game, tank);
      else if (inTank(m)) {
        if (A.holding) place(tank, m);
        else {
          const d = decorAt(tank, m);
          if (d) pickUp(tank, d);
        }
      }
    } else if (m.pressed[2] && !A.holding && inTank(m)) {
      const d = decorAt(tank, m);
      if (d) { removeDecor(tank, d, true); }
    }

    for (const f of A.fish) { f.walking = false; updateFish(f, dt); }
    for (let i = A.food.length - 1; i >= 0; i--) {
      const p = A.food[i];
      p.t += dt;
      if (p.y < TANK.sandTop + 2) p.y += 12 * dt;
      if (p.t > 25) A.food.splice(i, 1);
    }
    // bubbles from bubblers + ambient
    tank.decor.forEach((d) => { const dd = decorDef(d.id); if (d.type === 'decor' && dd && dd.bubbles && R.chance(dt * 4)) A.bubbles.push({ x: d.x + R.range(-1, 1), y: d.y - 6, vy: -R.range(16, 26), p: R() * 6 }); });
    if (R.chance(dt * 1.5)) A.bubbles.push({ x: R.range(10, 310), y: TANK.bottom - 2, vy: -R.range(10, 18), p: R() * 6 });
    for (let i = A.bubbles.length - 1; i >= 0; i--) { const b = A.bubbles[i]; b.y += b.vy * dt; b.x += Math.sin(A.t * 4 + b.p) * 4 * dt; if (b.y < TANK.waterTop + 1) A.bubbles.splice(i, 1); }
    AQ.FX.update(dt, { water: () => true });
  };

  function switchTank(dir) {
    const list = biomes();
    const i = list.findIndex((b) => b.id === A.biome);
    A.biome = list[(i + dir + list.length) % list.length].id;
    A.fish = []; A.holding = null; A.rebuild();
  }
  function feed() {
    for (let i = 0; i < 6; i++) A.food.push({ x: R.range(30, 290), y: TANK.waterTop + R.range(0, 6), t: 0 });
    AQ.Audio.play('feed');
  }

  function clickUI(r, game, tank) {
    switch (r.id) {
      case 'prev': switchTank(-1); break;
      case 'next': switchTank(1); break;
      case 'feed': feed(); break;
      case 'log': AQ.LogUI.open(game, 'aquarium'); break;
      case 'back': A.close(game); break;
      case 'tray_decor': A.tray = 'decor'; A.trayScroll = 0; break;
      case 'tray_fish': A.tray = 'fish'; A.trayScroll = 0; break;
      case 'tray_left': A.trayScroll -= 3; break;
      case 'tray_right': A.trayScroll += 3; break;
      case 'item':
        if (tank.decor.length >= AQ.TUNING.tank.decorCapacity) { AQ.HUD.toast('This tank is full of decorations.', '#ffd56b'); break; }
        if (A.holding) cancelHold();
        A.holding = { kind: r.kind, id: r.ref, key: r.key };
        break;
      case 'fish': {
        const from = r.where === 'tank' ? tank.creatures : tank.storage, to = r.where === 'tank' ? tank.storage : tank.creatures;
        if (r.where === 'storage' && tank.creatures.length >= AQ.TUNING.tank.capacity) { AQ.HUD.toast(`Tank full (${AQ.TUNING.tank.capacity}). Move one to storage first.`, '#ffd56b'); break; }
        const i = from.findIndex((e) => e.uid === r.uid);
        if (i >= 0) to.push(from.splice(i, 1)[0]);
        A.rebuild(); AQ.Save && AQ.Save.dirty();
        break;
      }
    }
  }

  function decorAt(tank, m) {
    const sorted = tank.decor.slice().sort((a, b) => b.y - a.y);
    for (const d of sorted) {
      const e = AQ.Assets.entry(d.type === 'plant' ? 'plant.' + d.id : 'decor.' + d.id);
      if (!e) continue;
      if (m.x >= d.x - e.fw / 2 && m.x < d.x + e.fw / 2 && m.y >= d.y - e.fh && m.y <= d.y + 1) return d;
    }
    return null;
  }
  function place(tank, m) {
    const h = A.holding;
    const kind = h.kind === 'decor' ? (decorDef(h.id).kind || 'floor') : (defOf(h.id).params.drift ? 'float' : 'floor');
    if (h.kind === 'plant' && !h.fromTank) {
      if (!(AQ.State.plants[h.id] > 0)) { A.holding = null; return; }
      AQ.State.plants[h.id]--;
    }
    tank.decor.push({ uid: AQ.U.uid(), type: h.kind, id: h.id, x: Math.round(U.clamp(m.x, TANK.x + 6, TANK.x + TANK.w - 6)), y: placeY(kind, m.y) });
    AQ.FX.puff(m.x, placeY(kind, m.y) - 2, 'rgba(240,230,200,0.6)', 4);
    // keep holding base decor for quick multi-placement; plants need stock
    if (h.fromTank || (h.kind === 'plant' && !(AQ.State.plants[h.id] > 0))) A.holding = null;
    AQ.Save && AQ.Save.dirty();
  }
  function pickUp(tank, d) {
    tank.decor.splice(tank.decor.indexOf(d), 1);
    A.holding = { kind: d.type, id: d.id, key: (d.type === 'plant' ? 'plant.' : 'decor.') + d.id, fromTank: true };
  }
  function cancelHold() {
    const h = A.holding;
    if (h && h.fromTank && h.kind === 'plant') AQ.State.plants[h.id] = (AQ.State.plants[h.id] || 0) + 1;
    A.holding = null;
  }
  function removeDecor(tank, d) {
    tank.decor.splice(tank.decor.indexOf(d), 1);
    if (d.type === 'plant') AQ.State.plants[d.id] = (AQ.State.plants[d.id] || 0) + 1;
    AQ.FX.puff(d.x, d.y - 3, 'rgba(240,230,200,0.6)', 4);
    AQ.Save && AQ.Save.dirty();
  }

  // ---------------------------------------------------------------- drawing
  A.draw = function (g, game) {
    const b = AQ.World.biomeById[A.biome], tank = AQ.Collection.tank(A.biome);
    const pal = b.palette, water = U.hex(b.water || '#3497bd');
    g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, 320, 180);
    // back wall water
    for (let y = TANK.y; y < TANK.y + TANK.h; y += 4) {
      const t = (y - TANK.y) / TANK.h;
      g.fillStyle = U.css(U.mix(U.mix([110, 205, 220], water, 0.45), U.mix([30, 80, 120], water, 0.4), t));
      g.fillRect(TANK.x, y, TANK.w, 4);
    }
    // light rays
    g.save(); g.globalAlpha = 0.07; g.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) { const x = 30 + i * 64 + Math.sin(A.t * 0.4 + i) * 6; g.beginPath(); g.moveTo(x, TANK.waterTop); g.lineTo(x + 12, TANK.waterTop); g.lineTo(x + 40, TANK.sandTop); g.lineTo(x + 20, TANK.sandTop); g.fill(); }
    g.restore();
    // sand
    const top = pal.top.map(U.hex);
    for (let x = TANK.x; x < TANK.x + TANK.w; x++) {
      const sy = TANK.sandTop + Math.round(Math.sin(x * 0.05) * 1.5 + Math.sin(x * 0.13) * 0.8);
      for (let y = sy; y <= TANK.bottom; y++) {
        const k = y - sy, h = U.hash2(x, y, 3);
        g.fillStyle = U.css(k === 0 ? U.scale(top[0], 1.08) : top[(k + (h < 0.3 ? 1 : 0)) % 3 === 0 && k > 4 ? 2 : h < 0.15 ? 2 : k < 5 ? 0 : 1]);
        g.fillRect(x, y, 1, 1);
      }
    }
    // water surface
    for (let x = TANK.x; x < TANK.x + TANK.w; x++) { g.fillStyle = 'rgba(235,255,255,0.7)'; g.fillRect(x, TANK.waterTop + Math.round(Math.sin(x * 0.12 + A.t * 2) * 0.7), 1, 1); }
    g.fillStyle = 'rgba(200,240,255,0.15)'; g.fillRect(TANK.x, TANK.y, TANK.w, TANK.waterTop - TANK.y);

    // depth-sorted decor + creatures
    const items = [];
    tank.decor.forEach((d) => items.push({ z: d.y, d }));
    A.fish.forEach((f) => items.push({ z: f.loco === 'swim' ? f.z : f.z, f }));
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      if (it.d) {
        const d = it.d, key = (d.type === 'plant' ? 'plant.' : 'decor.') + d.id;
        AQ.Assets.draw(g, key, 'idle', d.x, d.y, { t: A.t + d.x * 0.01 });
      } else {
        const f = it.f;
        // soft shadow on the sand
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(Math.round(f.x - f.r * 0.7), Math.round(f.z), Math.round(f.r * 1.4), 1);
        const moving = Math.hypot(f.vx, f.vy) > 5 || f.walking;
        AQ.Assets.draw(g, f.key, moving ? 'move' : 'idle', f.x + (f.shake && f.stress ? 1 : 0), f.y - (f.peck || 0), { t: f.t, flip: f.facing < 0, alpha: f.stress ? 0.8 : 1 });
        if (f.stress && Math.floor(A.t * 2 + f.t) % 2 === 0) { g.fillStyle = '#9fd8ff'; g.fillRect(Math.round(f.x + 3), Math.round(f.y - f.r - 4), 1, 2); g.fillRect(Math.round(f.x + 2), Math.round(f.y - f.r - 2), 3, 1); }
        if (f.state === 'rest' && !f.stress && (f.def.category === 'mammal' || f.def.category === 'reptile')) F().draw(g, 'z', f.x + 4, f.y - f.r - 6 - Math.round((A.t * 4) % 4), '#e8f4ff');
      }
    }
    // food
    g.fillStyle = '#e8873a';
    A.food.forEach((p) => g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1));
    // bubbles
    g.fillStyle = 'rgba(230,250,255,0.8)';
    A.bubbles.forEach((b) => g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1));
    AQ.FX.draw(g);
    // glass frame
    g.fillStyle = '#2b3f55'; g.fillRect(TANK.x - 2, TANK.y - 2, TANK.w + 4, 2); g.fillRect(TANK.x - 2, TANK.y + TANK.h, TANK.w + 4, 2);
    g.fillRect(TANK.x - 2, TANK.y, 2, TANK.h); g.fillRect(TANK.x + TANK.w, TANK.y, 2, TANK.h);
    g.save(); g.globalAlpha = 0.06; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(TANK.x + 20, TANK.y); g.lineTo(TANK.x + 34, TANK.y); g.lineTo(TANK.x + 4, TANK.y + 40); g.lineTo(TANK.x, TANK.y + 40); g.fill();
    g.restore();

    // ghost of held item
    const m = AQ.Input.mouse;
    if (A.holding && inTank(m)) {
      const kind = A.holding.kind === 'decor' ? (decorDef(A.holding.id).kind || 'floor') : (defOf(A.holding.id).params.drift ? 'float' : 'floor');
      AQ.Assets.draw(g, A.holding.key, 'idle', m.x, placeY(kind, m.y), { alpha: 0.6, t: A.t });
    }
    // hover tooltip on creatures
    if (!A.holding && inTank(m)) {
      const f = A.fish.find((f) => Math.abs(f.x - m.x) < f.r + 2 && Math.abs(f.y - m.y) < f.r + 2);
      if (f) tip(g, f.def.name + (f.stress ? ' (STRESSED)' : ''), m.x, m.y - 10, f.stress ? '#9fd8ff' : '#fff');
    }

    drawBars(g, tank, b);
  };

  function tip(g, text, x, y, col) {
    const w = F().width(text) + 6;
    const tx = U.clamp(Math.round(x - w / 2), 2, 318 - w);
    g.fillStyle = 'rgba(6,16,30,0.85)'; g.fillRect(tx, Math.round(y) - 2, w, 9);
    F().draw(g, text, tx + 3, y, col, { shadow: false });
  }
  A.tip = tip;

  function button(g, r, hover) {
    g.fillStyle = r.on ? '#2e7d96' : hover ? '#24506b' : '#16334a';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(160,220,240,0.35)'; g.fillRect(r.x, r.y, r.w, 1);
    if (r.label) F().draw(g, r.label, r.x + r.w / 2, r.y + Math.floor((r.h - 5) / 2), '#e8fbff', { align: 'center' });
  }
  A.button = button;

  function drawBars(g, tank, b) {
    // top bar
    g.fillStyle = '#0b1a2c'; g.fillRect(0, 0, 320, 14);
    const name = `${b.name} (${tank.creatures.length}/${AQ.TUNING.tank.capacity})`;
    F().draw(g, name, 83, 4, '#ffe9a8', { align: 'center' });
    // tray
    g.fillStyle = '#0b1a2c'; g.fillRect(0, TRAY_Y - 1, 320, 32);
    for (const r of A.ui) {
      const hover = A.hover === r;
      if (r.id === 'item' || r.id === 'fish') {
        g.fillStyle = hover ? '#24506b' : (A.holding && A.holding.id === r.ref && r.id === 'item') ? '#2e7d96' : '#132b40';
        g.fillRect(r.x, r.y, r.w, r.h);
        const e = AQ.Assets.entry(r.key);
        if (e) {
          const sc = Math.min(1, 20 / Math.max(e.fw, e.fh));
          g.save(); g.translate(r.x + r.w / 2, r.y + 12); g.scale(sc, sc);
          AQ.Assets.draw(g, r.key, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: 0 });
          g.restore();
        }
        if (r.id === 'item' && r.count !== Infinity) F().draw(g, 'x' + r.count, r.x + r.w - 1, r.y + 23, '#ffe9a8', { align: 'right' });
        if (r.id === 'fish') F().draw(g, r.where === 'tank' ? 'IN' : 'OUT', r.x + r.w / 2, r.y + 23, r.where === 'tank' ? '#7ef0c0' : '#a8b8c8', { align: 'center' });
      } else button(g, r, hover);
    }
    const items = trayItems();
    if (!items.length) F().draw(g, A.tray === 'fish' ? 'NO CREATURES FROM THIS BIOME YET' : 'NOTHING HERE YET', 178, TRAY_Y + 12, '#8aa4b8', { align: 'center' });
    // hints
    if (A.hover && (A.hover.id === 'item' || A.hover.id === 'fish')) {
      tip(g, A.hover.id === 'fish' ? `${A.hover.name}: CLICK TO MOVE ${A.hover.where === 'tank' ? 'TO STORAGE' : 'INTO TANK'}` : `${A.hover.name}: CLICK, THEN CLICK IN TANK`, A.hover.x + 12, TRAY_Y - 10, '#fff');
    } else if (A.holding) tip(g, 'CLICK TO PLACE - RIGHT CLICK / ESC TO STOP', 160, TRAY_Y - 10, '#ffe9a8');
    else if (!tank.creatures.length && !tank.decor.length) tip(g, 'CATCH CREATURES FROM THIS BIOME TO FILL THIS TANK', 160, 70, '#cfe8ff');
    else if (inTank(AQ.Input.mouse) && decorAt(tank, AQ.Input.mouse)) tip(g, 'CLICK: MOVE   RIGHT CLICK: REMOVE', 160, TRAY_Y - 10, '#cfe8ff');
  }

  return A;
})();
