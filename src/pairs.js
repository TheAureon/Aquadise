// ONE PAIR EACH (the tank screen's TANK tab): arrange a tank so it shows one ♂ and one ♀ of every
// species that lives there (two of a species without sexes), bringing creatures in from the tank's
// storage and sending the extra ones to storage. Nothing is ever lost: creatures only move between the
// tank and its own storage.
//   AQ.Pairs.plan(tankId)    what it would do (nothing changes): { toStorage, toTank, shown, leftOut,
//                            singles, need, cap, needSize, changes }
//   AQ.Pairs.apply(plan)     do it
// Which individual is shown, best first: a rare variant (✦), then an adult over a still-growing baby,
// then one already in the tank (so nothing visibly swaps for no reason), then the oldest. A courting
// pair stays together (they're already a ♂ and a ♀ in the tank), so courting never breaks.
// If every pair doesn't fit the tank's room, complete pairs go in first (the species you have the most
// of first), then the singles; the rest is left out (in storage) and `needSize` says which size fits all.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Pairs = (function () {
  const P = {};
  const defOf = (id) => (AQ.Creatures && AQ.Creatures.defs[id]) || AQ.data.creatures.find((d) => d.id === id);
  // when a creature arrived: a bred one's birth, else the time inside its id (AQ.U.uid starts with it)
  function since(e) {
    if (e.bornAt) return e.bornAt;
    const t = parseInt(String(e.uid).split('-')[0], 36);
    return t > 1e12 && t < 1e13 ? t : Infinity;          // (very old ids carry no time: their list order decides)
  }

  P.plan = function (tankId, now = Date.now()) {
    const tank = AQ.Collection.tank(tankId), cap = AQ.Tanks.capacity(tankId);
    const court = new Set(AQ.Breeding.courting(tank) || []);
    const all = tank.creatures.map((e, i) => ({ e, inTank: true, order: i })).concat(tank.storage.map((e, i) => ({ e, inTank: false, order: 1000 + i })));
    const rank = (a, b) => (court.has(b.e.uid) - court.has(a.e.uid))
      || (!!b.e.variant - !!a.e.variant)
      || (AQ.Breeding.isJuvenile(a.e, now) - AQ.Breeding.isJuvenile(b.e, now))
      || (b.inTank - a.inTank)
      || (since(a.e) - since(b.e)) || (a.order - b.order);
    // per species: the chosen ones (a ♂ and a ♀, or two of a sexless species)
    const by = {};
    all.forEach((c) => (by[c.e.id] = by[c.e.id] || []).push(c));
    const groups = Object.keys(by).map((id) => {
      const list = by[id].slice().sort(rank), d = defOf(id);
      let pick;
      if (d && AQ.Sex.has(d)) pick = ['m', 'f'].map((s) => list.find((c) => c.e.sex === s)).filter(Boolean);
      else pick = list.slice(0, 2);
      return { id, name: d ? d.name : id, owned: list.length, pick };
    });
    const need = groups.reduce((a, g) => a + g.pick.length, 0);
    // what fits: complete pairs first (most-owned species first), then singles
    const byOwned = (a, b) => b.owned - a.owned || AQ.Lang.compare(a.name, b.name);
    const chosen = new Set(), leftOut = [];
    let room = cap;
    const pairs = groups.filter((g) => g.pick.length === 2).sort(byOwned), singles = groups.filter((g) => g.pick.length === 1).sort(byOwned);
    pairs.forEach((g) => { if (room >= 2) { g.pick.forEach((c) => chosen.add(c)); room -= 2; g.shown = 2; } else g.shown = 0; });
    singles.concat(pairs.filter((g) => !g.shown)).forEach((g) => { if (room >= 1) { chosen.add(g.pick[0]); room--; g.shown = (g.shown || 0) + 1; } });
    groups.forEach((g) => { if ((g.shown || 0) < g.pick.length) leftOut.push({ id: g.id, name: g.name, missing: g.pick.length - (g.shown || 0) }); });
    const toStorage = all.filter((c) => c.inTank && !chosen.has(c)).map((c) => c.e.uid);
    const toTank = all.filter((c) => !c.inTank && chosen.has(c)).map((c) => c.e.uid);
    return {
      tankId, toStorage, toTank, cap, need, leftOut,
      shown: chosen.size,
      singles: singles.map((g) => g.name),                 // species with only one sex so far (shown alone: fine)
      needSize: need > cap ? AQ.Tanks.sizeFor(tankId, need) : null,
      changes: toStorage.length + toTank.length
    };
  };

  P.apply = function (plan) {
    const tank = AQ.Collection.tank(plan.tankId);
    const move = (uids, from, to) => uids.forEach((uid) => { const i = from.findIndex((e) => e.uid === uid); if (i >= 0) to.push(from.splice(i, 1)[0]); });
    move(plan.toStorage, tank.creatures, tank.storage);   // out first, so there's room coming in
    move(plan.toTank, tank.storage, tank.creatures);
    AQ.Save && AQ.Save.dirty();
  };
  return P;
})();
