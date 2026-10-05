// Breeding in the tanks. Optional and gentle: nothing is ever needed from it.
// A ♂ and ♀ adult of the same species living in the same tank may court when the tank is happy
// (vibe >= minStars), recently fed and nobody is nervous. When the courtship finishes, the egg (or the
// baby, for species with live young) appears in the Universal Nursery (src/nursery.js), never in the
// parents' tank, so the parents' tank never fills up from breeding. Eggs hatch there, and babies grow
// up there. When the nursery is full, breeding pauses everywhere until there's room.
//
// Everything runs on real timestamps (Date.now), checked every few seconds wherever you are in the
// game, so nothing depends on watching a tank. Growth is worked out from each baby's birth time.
// Saved state (inside AQ.State.tanks[id]): court {a, b, id, progress}, lastBirth, lastTick; in the
// nursery: eggs [{uid, id, laidAt, x, from}] and babies {uid, id, sex, variant, bornAt, from}
// (`from` = the parents' tank). AQ.State.log[id].bred = first baby born.
// Testing: AQ.TUNING.debug.fastNursery makes courting, hatching and growing up take seconds.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Breeding = (function () {
  const B = { t: 0 }, MIN = 60000;
  const cfg = () => AQ.TUNING.breeding;
  const defOf = (id) => (AQ.Creatures && AQ.Creatures.defs[id]) || AQ.data.creatures.find((d) => d.id === id);
  const fast = () => !!(AQ.TUNING.debug && AQ.TUNING.debug.fastNursery);
  // how long each step takes, in ms (minutes from AQ.TUNING.breeding, or seconds in the fast test mode)
  B.ms = (step) => (fast() ? AQ.TUNING.debug.fastNurserySeconds[step] * 1000 : cfg()[step + 'Minutes'] * MIN);
  const nursery = () => AQ.Nursery;

  B.laysEggs = (d) => (d.eggs != null ? !!d.eggs : d.category !== 'mammal');
  B.isJuvenile = (e, now = Date.now()) => !!e.bornAt && now - e.bornAt < B.ms('grow');
  B.growLeftMs = (e, now = Date.now()) => (e.bornAt ? Math.max(0, e.bornAt + B.ms('grow') - now) : 0);
  B.growLeftMin = (e, now = Date.now()) => Math.ceil(B.growLeftMs(e, now) / MIN);
  // "12 MIN" / "40 SEC": time left until a baby is grown up
  B.growLeftText = function (e, now = Date.now()) {
    const ms = B.growLeftMs(e, now);
    return ms >= MIN ? `${Math.ceil(ms / MIN)} MIN` : `${Math.max(1, Math.ceil(ms / 1000))} SEC`;
  };
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

  // why a tank with a pair isn't breeding right now (null = it can). The parents' tank being full
  // doesn't matter any more: the egg / baby goes to the nursery.
  B.blocker = function (tank, vibe, now = Date.now()) {
    const c = cfg();
    if (nursery() && nursery().full()) return 'nursery';
    if (vibe.stressed) return 'nervous';
    if (AQ.Vibe.fedLevel(tank, now) < c.fedLevel) return 'hungry';
    if (vibe.stars < c.minStars) return 'vibe';
    if (tank.lastBirth && now - tank.lastBirth < B.ms('cooldown')) return 'resting';
    return null;
  };

  // plain-language lines for the vibe tooltip: { text, good, also } (also = a second, nursery line), or null
  B.describe = function (tankId, tank, vibe, now = Date.now()) {
    if (!cfg().enabled || (nursery() && nursery().is(tankId))) return null;
    const waiting = nursery() ? nursery().fromTank(tankId, now) : { eggs: 0, babies: 0 };
    const also = waiting.eggs ? { text: 'EGG ON THE WAY TO THE NURSERY', good: true } : waiting.babies ? { text: 'A BABY IS IN THE NURSERY', good: true } : null;
    const out = (text, good) => ({ text, good, also });
    if (tank.court) {
      const d = defOf(tank.court.id);
      if (nursery() && nursery().full()) return out('BREEDING PAUSED: THE NURSERY IS FULL, GRADUATE SOME BABIES', false);
      return out(`A PAIR OF ${(d ? d.name : 'CREATURES').toUpperCase()} IS COURTING ♥`, true);
    }
    const legacy = (tank.eggs || []).length;                   // an egg from an older save, waiting for room in the nursery
    if (legacy) return out(legacy > 1 ? `${legacy} EGGS ARE WAITING FOR THE NURSERY` : 'AN EGG IS WAITING FOR THE NURSERY', true);
    const pairs = B.pairs(tank, now);
    if (!pairs.length) { const babies = tank.creatures.filter((e) => B.isJuvenile(e, now)).length; return babies ? out(babies > 1 ? `${babies} BABIES ARE GROWING UP` : 'A BABY IS GROWING UP', true) : (also ? { text: also.text, good: true } : null); }
    const why = B.blocker(tank, vibe, now);
    if (why === 'nursery') return out('BREEDING PAUSED: THE NURSERY IS FULL, GRADUATE SOME BABIES', false);
    if (why === 'nervous') return out('BREEDING PAUSED: SOMEONE IS NERVOUS', false);
    if (why === 'hungry') return out('FEED THEM AND A PAIR MAY COURT', false);
    if (why === 'vibe') return out(`A PAIR COULD COURT AT ${cfg().minStars} STARS`, false);
    if (why === 'resting') return out('RESTING AFTER A NEW ARRIVAL', true);
    return out('A PAIR MAY START COURTING SOON', true);
  };

  function announce(text) {
    const A = AQ.Aquarium, G = AQ.Game;
    if (G && G.state === 'aquarium' && A.note) A.note(text, '#ffb0d0', 4);
    else if (AQ.HUD) AQ.HUD.toast(text, '#ffb0d0', 4);
  }
  // a new baby, straight into the nursery (keeps species, sex, rare colour and birth time)
  function arrive(id, from, now) {
    const d = defOf(id), e = { uid: AQ.U.uid(), id, bornAt: now, from };
    const sex = AQ.Sex.random(d);
    if (sex) e.sex = sex;
    const rare = Math.random() < cfg().variantChance;           // a rare colour variant (only ever bred)
    if (rare) { e.variant = true; AQ.Sex.logOf(id).variant = true; }
    nursery().tank().creatures.push(e);
    AQ.Sex.logOf(id).bred = true;
    AQ.Audio.play('baby');
    if (AQ.Tips) AQ.Tips.event('baby');
    announce(rare ? `A rare-coloured baby ${d.name} was born! It's in the nursery.` : `A baby ${d.name} was born! It's in the nursery.`);
    return e;
  }

  // One check over every tank. Cheap: a few array scans per tank.
  B.tick = function (now = Date.now()) {
    const c = cfg(), N = nursery();
    if (!c.enabled || !N || !N.id()) return;
    const tanks = AQ.State.tanks || {}, nid = N.id();
    let changed = false;
    // eggs in the nursery hatch (an egg already has its place there, so a baby always fits)
    const nt = N.tank();
    for (let i = (nt.eggs || []).length - 1; i >= 0; i--) {
      const egg = nt.eggs[i];
      if (now - egg.laidAt >= B.ms('egg')) { nt.eggs.splice(i, 1); arrive(egg.id, egg.from, now); changed = true; }
    }
    for (const id in tanks) {
      if (id === nid) continue;                                     // nothing courts in the nursery
      const tank = tanks[id];
      const elapsed = tank.lastTick ? Math.max(0, now - tank.lastTick) : 0;
      tank.lastTick = now;
      // an egg from an older save still in this tank: it moves to the nursery once there's room
      if (tank.eggs && tank.eggs.length) {
        for (let i = tank.eggs.length - 1; i >= 0 && !N.full(); i--) { const egg = tank.eggs.splice(i, 1)[0]; (nt.eggs = nt.eggs || []).push(Object.assign({ from: id }, egg)); changed = true; }
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
        if (why === 'resting' || (!fast() && Math.random() > c.startChance)) continue;
        const p = pairs[Math.floor(Math.random() * pairs.length)];
        tank.court = { a: p[0].uid, b: p[1].uid, id: p[0].id, progress: 0 };
        AQ.Audio.play('court');
        if (AQ.Tips) AQ.Tips.event('court');
        changed = true;
        continue;
      }
      tank.court.progress += elapsed;
      if (tank.court.progress >= B.ms('court')) {
        const sp = tank.court.id, d = defOf(sp), parents = [tank.court.a, tank.court.b];
        tank.court = null; tank.lastBirth = now; changed = true;
        if (d && B.laysEggs(d)) {
          (nt.eggs = nt.eggs || []).push({ uid: AQ.U.uid(), id: sp, laidAt: now, x: 30 + Math.floor(Math.random() * 260), from: id });
          AQ.Sex.logOf(sp);
          announce(`The ${d.name} pair laid an egg! It's in the nursery.`);
        } else arrive(sp, id, now);
        if (AQ.Aquarium && AQ.Aquarium.sparkleParents) AQ.Aquarium.sparkleParents(id, parents);   // only if you're looking at their tank
      }
    }
    if (changed && AQ.Save) AQ.Save.dirty();
  };

  B.update = function (dt) {
    B.t += dt;
    const every = fast() ? AQ.TUNING.debug.fastNurserySeconds.check : cfg().checkSeconds;
    if (B.t >= every) { B.t = 0; B.tick(Date.now()); }
  };
  return B;
})();
