// Message bottles: one per species, each holding that species' field notes (data/lore.js).
// They sit on the seabed, on the Tide Pools shore or float at the surface, always in their species'
// biome, and glint softly so they can be found. Swim (or walk) into one to pick it up, like a chest.
// Found bottles are saved (AQ.State.bottles) and never come back.
//
// Placement is deterministic: the same spots every time (seeded from the world seed + species id),
// only where the player can be (the sea scene's own validity check), reachable from the start
// without any upgrade (a flood fill that stops at the level-0 depth limit), and spread apart.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Bottles = (function () {
  const U = AQ.U, R = U.R;
  const B = { list: [], t: 0 };
  const cfg = () => AQ.TUNING.bottles;
  const found = () => (AQ.State.bottles = AQ.State.bottles || {});

  B.isFound = (id) => !!found()[id];
  B.progress = () => {
    const ids = AQ.data.creatures.filter((d) => AQ.data.lore && AQ.data.lore[d.id]).map((d) => d.id);
    return { found: ids.filter((id) => B.isFound(id)).length, total: ids.length };
  };
  // the note's text with {name} filled in: the real name once caught, "this creature" until then
  B.text = (id, s) => s.replace(/\{name\}/g, AQ.Collection.has(id) ? AQ.Creatures.defs[id] ? AQ.Creatures.defs[id].name : id : 'this creature');

  // ---------------------------------------------------------------- reachability (level 0)
  // Coarse grid (CELL px) of places the player can be, flood-filled from the start. Air only counts
  // near the waterline (walking on the shore, hopping out of pools), never the open sky.
  const CELL = 4;
  function reachable() {
    const W = AQ.World, valid = AQ.Scenes.list.world.valid;
    const lim = AQ.TUNING.upgrades.depthLimitY[0] - 6, top = W.sea - cfg().airBand;
    const gw = Math.ceil(W.w / CELL), gh = Math.ceil(W.h / CELL), seen = new Uint8Array(gw * gh);
    const ok = (cx, cy) => { const x = cx * CELL + 2, y = cy * CELL + 2; return y >= top && y <= lim && valid(x, y); };
    const st = AQ.data.world.playerStart, q = [];
    const s0 = Math.floor(st[0] / CELL) + Math.floor(st[1] / CELL) * gw;
    seen[s0] = 1; q.push(s0);
    for (let h = 0; h < q.length; h++) {
      const i = q[h], cx = i % gw, cy = (i / gw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = nx + ny * gw;
        if (seen[j] || !ok(nx, ny)) continue;
        seen[j] = 1; q.push(j);
      }
    }
    return (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx >= 0 && cy >= 0 && cx < gw && cy < gh && !!seen[cx + cy * gw]; };
  }

  // Every possible bottle spot, by biome: seabed (water above solid), the surface of open water
  // (floating) and dry ground right by the waterline (the shore).
  function candidates(canReach) {
    const W = AQ.World, out = {}, lim = AQ.TUNING.upgrades.depthLimitY[0] - 10, c = cfg(), valid = AQ.Scenes.list.world.valid;
    const add = (x, y, kind) => {
      const b = W.biomeAt(x, y);
      // the player must fit right there (the scene's own check) and that spot must be reachable
      if (!b || !valid(x, y - 5) || !canReach(x, y - 5)) return;
      (out[b.id] = out[b.id] || []).push({ x, y, kind });
    };
    for (let x = 12; x < W.w - 12; x += c.scanStep) {
      // floating at the surface: open water at the sea line with sky above
      if (W.water(x, W.sea + 1) && W.air(x, W.sea - 1) && W.water(x, W.sea + 8)) add(x, W.sea + 1, 'float');
      for (let y = W.sea - c.airBand; y < Math.min(W.h - 2, lim); y++) {
        if (!W.solid(x, y + 1) || W.solid(x, y)) continue;
        // on the seabed (in water) or on the shore (dry ground just above the waterline)
        if (W.water(x, y) && W.water(x, y - 6)) add(x, y + 1, 'floor');
        else if (W.air(x, y) && y >= W.sea - c.airBand && !W.poolAt(x, y)) add(x, y + 1, 'shore');
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- placement (deterministic)
  B.init = function () {
    const t0 = performance.now();
    const canReach = reachable(), all = candidates(canReach), placed = [];
    B.spots = all;                                   // also where falling stars may land (src/starfall.js)
    const seed0 = (AQ.data.world.seed || 1) * 7919;
    B.list = [];
    for (const d of AQ.data.creatures) {
      if (!AQ.data.lore || !AQ.data.lore[d.id]) continue;
      const where = d.bottle || d.biome;            // creatures with no sea biome (Starfall) name one with `bottle`
      const pool = all[where] || [];
      if (!pool.length) { console.warn('[bottles] no reachable spot in', where, 'for', d.id); continue; }
      let h = seed0; for (const ch of d.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const rng = U.rng(h);
      // mostly on the seabed / shore, sometimes floating (cfg().floatShare), when the biome has both
      const ground = pool.filter((s) => s.kind !== 'float'), floats = pool.filter((s) => s.kind === 'float');
      const from = !floats.length ? ground : !ground.length ? floats : rng() < cfg().floatShare ? floats : ground;
      let pick = null;
      for (let tries = 0; tries < 200 && !pick; tries++) {
        const s = from[Math.floor(rng() * from.length)];
        const gap = tries < 150 ? cfg().minSpacing : cfg().minSpacing / 3;    // spread out; relax if crowded
        if (!placed.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < gap)) pick = s;
      }
      pick = pick || from[0];
      placed.push(pick);
      B.list.push({ id: d.id, x: pick.x, y: pick.y, kind: pick.kind, ph: rng() * 6, taken: 0 });
    }
    B.ms = Math.round(performance.now() - t0);
  };

  // ---------------------------------------------------------------- update / draw
  B.update = function (dt, game) {
    const P = game.player, r = cfg().pickupRadius;
    B.t += dt;
    for (const b of B.list) {
      if (b.taken) { b.taken += dt; continue; }
      if (B.isFound(b.id)) continue;
      const y = drawY(b);
      if (Math.abs(P.x - b.x) < 180 && Math.abs(P.y - y) < 110 && R.chance(dt * cfg().glintPerSecond)) AQ.FX.sparkle(b.x + R.range(-3, 3), y - R.range(2, 7), '#e8fbff', 1);
      if (Math.hypot(P.x - b.x, P.y - (y - 4)) < r) pickUp(b);
    }
  };
  function pickUp(b) {
    found()[b.id] = true;
    b.taken = 0.001;
    AQ.FX.sparkle(b.x, drawY(b) - 4, '#fff7c2', 10);
    AQ.Audio.play('bottle');
    const d = AQ.Creatures.defs[b.id], p = B.progress();
    AQ.HUD.toast(`Message in a bottle! Field notes on ${AQ.Collection.has(b.id) ? d.name : 'a mystery creature'} (L)`, '#ffe9a8', 4);
    AQ.HUD.toast(`Bottles found ${p.found}/${p.total}`, '#cfe8ff', 3);
    AQ.Save && AQ.Save.dirty();
  }
  // floating bottles bob on the swell; the others rest on the ground
  const drawY = (b) => (b.kind === 'float' ? b.y + Math.round(Math.sin(B.t * 1.6 + b.ph) * 1.2) : b.y);
  B.draw = function (g) {
    const cam = AQ.Camera, l = cam.left(), t = cam.top();
    for (const b of B.list) {
      if (b.x < l - 20 || b.x > l + cam.w + 20 || b.y < t - 20 || b.y > t + cam.h + 20) continue;
      if (B.isFound(b.id) && !(b.taken > 0 && b.taken < 0.8)) continue;
      const a = b.taken ? Math.max(0, 1 - b.taken / 0.8) : 1;
      const tilt = b.kind === 'float' ? Math.sin(B.t * 1.2 + b.ph) * 0.15 : 0.35;     // resting bottles lie tipped over
      g.save(); g.translate(b.x, drawY(b) - (b.taken ? b.taken * 12 : 0)); g.rotate(tilt);
      AQ.Assets.draw(g, 'misc.bottle', 'idle', 0, 0, { t: B.t + b.ph, alpha: a });
      g.restore();
    }
  };
  B.lights = function (L) {
    for (const b of B.list) if (!B.isFound(b.id)) L.push({ x: b.x, y: b.y - 4, r: cfg().glowRadius, color: '#d8f4ff', power: 0.45 });
  };
  return B;
})();
