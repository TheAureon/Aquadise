// Releasing creatures back to the sea (the tank screen: RELEASE on an info card, RELEASE EXTRAS and
// SELECT TO RELEASE on the TANK tab). A released creature leaves your collection for good: it's simply
// removed from its tank or storage. Nothing else changes: the log's discovered species, the ♂ / ♀
// slots, the rare-variant marks, the "bred" marker and the catch counts all stay exactly as they are
// (this file never touches AQ.State.log or AQ.State.collection). No wild respawn trick either.
//   AQ.Release.reasons(tankId, entry)   why this one deserves a second look: 'rare' (✦), 'last' (the last
//                                       ♂ / ♀ of its species you have, or the last one of a species
//                                       without sexes), 'nursery', 'growing'   ([] = an ordinary extra)
//   AQ.Release.extras(tankId)           RELEASE EXTRAS: the storage creatures it would release. It keeps
//                                       one pair of each species (tank + storage, chosen like ONE PAIR
//                                       EACH), every rare variant, the last of a sex and anything growing,
//                                       and never takes anything out of the tank itself or the nursery.
//   AQ.Release.release(tankId, uids)    remove them; returns the entries released
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Release = (function () {
  const R = {};
  const defOf = (id) => (AQ.Creatures && AQ.Creatures.defs[id]) || AQ.data.creatures.find((d) => d.id === id);
  const tanks = () => AQ.State.tanks || {};
  // how many of this species (and sex) you have anywhere: every tank, its storage and the nursery
  R.countOwned = function (id, sex) {
    let n = 0;
    Object.values(tanks()).forEach((t) => ['creatures', 'storage'].forEach((k) => (t[k] || []).forEach((e) => { if (e.id === id && (!sex || e.sex === sex)) n++; })));
    return n;
  };
  R.reasons = function (tankId, e, now = Date.now()) {
    const out = [], d = defOf(e.id);
    if (e.variant) out.push('rare');
    const sexed = d && AQ.Sex.has(d) && e.sex;
    if (R.countOwned(e.id, sexed ? e.sex : null) <= 1) out.push('last');
    if (AQ.Nursery && AQ.Nursery.is(tankId)) out.push('nursery');
    else if (AQ.Breeding.isJuvenile(e, now)) out.push('growing');
    return out;
  };
  R.extras = function (tankId, now = Date.now()) {
    if (AQ.Nursery && AQ.Nursery.is(tankId)) return [];
    const tank = AQ.Collection.tank(tankId);
    // the pair each species keeps: the same choice ONE PAIR EACH makes (best ♂ + best ♀, or two)
    const keep = new Set(), all = tank.creatures.concat(tank.storage), by = {};
    all.forEach((e) => (by[e.id] = by[e.id] || []).push(e));
    const plan = AQ.Pairs.plan(tankId, now);
    const shownNow = new Set(tank.creatures.filter((e) => plan.toStorage.indexOf(e.uid) < 0).map((e) => e.uid).concat(plan.toTank));
    Object.keys(by).forEach((id) => {
      const d = defOf(id), list = by[id], best = (pred) => list.filter(pred).sort((a, b) => shownNow.has(b.uid) - shownNow.has(a.uid))[0];
      if (d && AQ.Sex.has(d)) ['m', 'f'].forEach((s) => { const e = best((x) => x.sex === s); if (e) keep.add(e.uid); });
      else list.filter((x) => shownNow.has(x.uid)).concat(list).slice(0, 2).forEach((e) => keep.add(e.uid));
    });
    return tank.storage.filter((e) => !keep.has(e.uid) && !R.reasons(tankId, e, now).length);
  };
  R.release = function (tankId, uids) {
    const tank = AQ.Collection.tank(tankId), out = [];
    ['creatures', 'storage'].forEach((k) => {
      for (let i = tank[k].length - 1; i >= 0; i--) if (uids.indexOf(tank[k][i].uid) >= 0) out.push(tank[k].splice(i, 1)[0]);
    });
    if (tank.court && (uids.indexOf(tank.court.a) >= 0 || uids.indexOf(tank.court.b) >= 0)) delete tank.court;   // a courting pair simply stops
    if (out.length) AQ.Save && AQ.Save.dirty();
    return out;
  };
  return R;
})();
