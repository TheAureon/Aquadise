// Breeding in the tanks. Optional and gentle: nothing is ever needed from it.
// A ♂ and ♀ adult of the same species living in the same tank may court when the tank is happy
// (vibe >= minStars), recently fed, nobody is nervous, and there is room. After courting, egg-laying
// species lay an egg that hatches; others have a baby straight away. Babies grow up over time.
//
// Everything runs on real timestamps (Date.now), checked every few seconds wherever you are in the
// game, so nothing depends on watching a tank. Growth is worked out from each baby's birth time.
// Saved state (inside AQ.State.tanks[id]): court {a, b, id, progress}, eggs [{uid,id,laidAt,x}],
// lastBirth, lastTick; and on creatures: bornAt (babies). AQ.State.log[id].bred = first baby born.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Breeding = (function () {
  const B = { t: 0 }, MIN = 60000;
  const cfg = () => AQ.TUNING.breeding;
  const defOf = (id) => (AQ.Creatures && AQ.Creatures.defs[id]) || AQ.data.creatures.find((d) => d.id === id);

  B.laysEggs = (d) => (d.eggs != null ? !!d.eggs : d.category !== 'mammal');
  B.isJuvenile = (e, now = Date.now()) => !!e.bornAt && now - e.bornAt < cfg().growMinutes * MIN;
  B.growLeftMin = (e, now = Date.now()) => Math.max(0, Math.ceil((e.bornAt + cfg().growMinutes * MIN - now) / MIN));
  B.occupancy = (tank) => tank.creatures.length + (tank.eggs || []).length;
  B.courting = (tank) => (tank && tank.court ? [tank.court.a, tank.court.b] : null);

  // pairs that could breed: adults of one species, a ♂ and a ♀ (or any two of a sexless species)
  B.pairs = function (tank, now = Date.now()) {
    const by = {};
    tank.creatures.forEach((e) => { if (!B.isJuvenile(e, now)) (by[e.id] = by[e.id] || []).push(e); });
    const out = [];
    for (const id in by) {
      const list = by[id], d = defOf(id);
      if (!d) continue;
      if (AQ.Sex.has(d)) { const m = list.find((e) => e.sex === 'm'), f = list.find((e) => e.sex === 'f'); if (m && f) out.push([m, f]); }
      else if (list.length >= 2) out.push([list[0], list[1]]);
    }
    return out;
  };

  // why a tank with a pair isn't breeding right now (null = it can)
  B.blocker = function (tank, vibe, now = Date.now()) {
    const c = cfg();
    if (B.occupancy(tank) >= AQ.TUNING.tank.capacity) return 'full';
    if (vibe.stressed) return 'nervous';
    if (AQ.Vibe.fedLevel(tank, now) < c.fedLevel) return 'hungry';
    if (vibe.stars < c.minStars) return 'vibe';
    if (tank.lastBirth && now - tank.lastBirth < c.cooldownMinutes * MIN) return 'resting';
    return null;
  };

  // one plain-language line for the vibe tooltip (or null if there's no pair to talk about)
  B.describe = function (tankId, tank, vibe, now = Date.now()) {
    if (!cfg().enabled) return null;
    const eggs = (tank.eggs || []).length, babies = tank.creatures.filter((e) => B.isJuvenile(e, now)).length;
    if (tank.court) {
      const d = defOf(tank.court.id);
      return { text: `A PAIR OF ${(d ? d.name : 'CREATURES').toUpperCase()} IS COURTING ♥`, good: true };
    }
    if (eggs) return { text: eggs > 1 ? `${eggs} EGGS ARE ON THE WAY` : 'AN EGG IS ON THE WAY', good: true };
    const pairs = B.pairs(tank, now);
    if (!pairs.length) return babies ? { text: babies > 1 ? `${babies} BABIES ARE GROWING UP` : 'A BABY IS GROWING UP', good: true } : null;
    const why = B.blocker(tank, vibe, now);
    if (why === 'full') return { text: 'BREEDING PAUSED: THE TANK IS FULL', good: false };
    if (why === 'nervous') return { text: 'BREEDING PAUSED: SOMEONE IS NERVOUS', good: false };
    if (why === 'hungry') return { text: 'FEED THEM AND A PAIR MAY COURT', good: false };
    if (why === 'vibe') return { text: `A PAIR COULD COURT AT ${cfg().minStars} STARS`, good: false };
    if (why === 'resting') return { text: 'RESTING AFTER A NEW ARRIVAL', good: true };
    return { text: 'A PAIR MAY START COURTING SOON', good: true };
  };

  function announce(text, tankId) {
    const A = AQ.Aquarium, G = AQ.Game;
    if (G && G.state === 'aquarium' && A.biome === tankId && A.note) A.note(text, '#ffb0d0', 4);
    else if (AQ.HUD) AQ.HUD.toast(text, '#ffb0d0', 4);
  }
  function tankName(id) { const t = AQ.Tanks.get(id); return t ? (t.short || t.name) : id; }
  function arrive(tankId, tank, id, now) {
    const d = defOf(id), e = { uid: AQ.U.uid(), id, bornAt: now };
    const sex = AQ.Sex.random(d);
    if (sex) e.sex = sex;
    const rare = Math.random() < cfg().variantChance;           // a rare colour variant (only ever bred)
    if (rare) { e.variant = true; AQ.Sex.logOf(id).variant = true; }
    // never past the tank's limit: a baby born into a full tank waits in storage
    (tank.creatures.length < AQ.TUNING.tank.capacity ? tank.creatures : (tank.storage = tank.storage || [])).push(e);
    AQ.Sex.logOf(id).bred = true;
    AQ.Audio.play('baby');
    if (AQ.Tips) AQ.Tips.event('baby');
    announce(rare ? `A rare-coloured baby ${d.name} was born in the ${tankName(tankId)} tank!` : `A baby ${d.name} was born in the ${tankName(tankId)} tank!`, tankId);
    return e;
  }

  // One check over every tank. Cheap: a few array scans per tank.
  B.tick = function (now = Date.now()) {
    const c = cfg();
    if (!c.enabled) return;
    const tanks = AQ.State.tanks || {};
    let changed = false;
    for (const id in tanks) {
      const tank = tanks[id];
      const elapsed = tank.lastTick ? Math.max(0, now - tank.lastTick) : 0;
      tank.lastTick = now;
      // eggs hatch
      if (tank.eggs && tank.eggs.length) {
        for (let i = tank.eggs.length - 1; i >= 0; i--) if (now - tank.eggs[i].laidAt >= c.eggMinutes * MIN) { arrive(id, tank, tank.eggs[i].id, now); tank.eggs.splice(i, 1); changed = true; }
      }
      if (tank.creatures.length < 2) { if (tank.court) { tank.court = null; changed = true; } continue; }
      // the courting pair must still be here, grown up and together
      if (tank.court) {
        const a = tank.creatures.find((e) => e.uid === tank.court.a), b = tank.creatures.find((e) => e.uid === tank.court.b);
        if (!a || !b) { tank.court = null; changed = true; }
      }
      const pairs = B.pairs(tank, now);
      if (!pairs.length) continue;
      if (AQ.Tips && pairs.some((p) => p[0].sex && p[1].sex)) AQ.Tips.event('pair');
      const vibe = AQ.Vibe.evaluate(id), why = B.blocker(tank, vibe, now);
      if (why && why !== 'resting') continue;                     // paused: courtship (if any) waits
      if (!tank.court) {
        if (why === 'resting' || Math.random() > c.startChance) continue;
        const p = pairs[Math.floor(Math.random() * pairs.length)];
        tank.court = { a: p[0].uid, b: p[1].uid, id: p[0].id, progress: 0 };
        AQ.Audio.play('court');
        if (AQ.Tips) AQ.Tips.event('court');
        changed = true;
        continue;
      }
      tank.court.progress += elapsed;
      if (tank.court.progress >= c.courtMinutes * MIN) {
        const sp = tank.court.id, d = defOf(sp);
        tank.court = null; tank.lastBirth = now; changed = true;
        if (d && B.laysEggs(d)) {
          tank.eggs = tank.eggs || [];
          tank.eggs.push({ uid: AQ.U.uid(), id: sp, laidAt: now, x: 30 + Math.floor(Math.random() * 260) });
          AQ.Sex.logOf(sp);
          announce(`The ${d.name} pair laid an egg in the ${tankName(id)} tank!`, id);
        } else arrive(id, tank, sp, now);
      }
    }
    if (changed && AQ.Save) AQ.Save.dirty();
  };

  B.update = function (dt) {
    B.t += dt;
    if (B.t >= cfg().checkSeconds) { B.t = 0; B.tick(Date.now()); }
  };
  return B;
})();
