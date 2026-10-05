// The Universal Nursery: one tank (data/aquarium.js specialTanks, `nursery: true`) where every bred egg
// and baby lives, whatever its species or biome, predators included. Courting still happens in the
// parents' tank (src/breeding.js), but the egg or baby always arrives here, never in the parents' tank.
// Only bred creatures (eggs, and babies growing or grown) can be in here, never a caught adult.
// Babies never stress, scare or eat each other, and the nursery has no vibe stars, no unlocks and no
// breeding of its own. Its room (AQ.TUNING.nursery.capacity) counts babies, grown babies and eggs;
// when it's full, breeding pauses everywhere until there's room again.
// Saved state: AQ.State.tanks[nursery] like any tank ({ creatures, storage, decor, eggs, lastFed });
// eggs and babies remember the tank their parents live in (`from`).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Nursery = (function () {
  const N = {};
  N.id = () => { const t = (AQ.data.specialTanks || []).find((s) => s.nursery); return t ? t.id : null; };
  N.is = (tankId) => !!tankId && tankId === N.id();
  N.tank = () => AQ.Collection.tank(N.id());
  N.capacity = () => AQ.TUNING.nursery.capacity;
  N.occupancy = () => { const t = N.tank(); return t.creatures.length + (t.eggs || []).length + (t.storage || []).length; };
  N.room = () => Math.max(0, N.capacity() - N.occupancy());
  N.full = () => N.room() <= 0;
  // bred babies (still growing or grown up) and eggs may live here; caught adults never
  N.canHold = (e) => !!e && (!!e.bornAt || !!e.laidAt);
  // what this tank's parents have waiting in the nursery
  N.fromTank = function (tankId, now = Date.now()) {
    const t = N.tank();
    return {
      eggs: (t.eggs || []).filter((e) => e.from === tankId).length,
      babies: t.creatures.filter((e) => e.from === tankId && AQ.Breeding.isJuvenile(e, now)).length
    };
  };

  // Older saves: babies still growing and eggs waiting in any tank (or its storage) move into the
  // nursery, keeping their sex, colour and birth time. If the nursery fills up, the rest stay where
  // they are (nothing is ever deleted). Anything in the nursery that isn't a bred baby goes home.
  // Safe to run on every load. Returns how many moved in.
  N.migrate = function () {
    const id = N.id();
    if (!id) return 0;
    const tanks = AQ.State.tanks || {}, nt = N.tank(), now = Date.now();
    nt.eggs = nt.eggs || []; nt.storage = nt.storage || [];
    let moved = 0;
    Object.keys(tanks).forEach((tid) => {
      if (tid === id) return;
      const t = tanks[tid];
      (t.eggs || []).slice().forEach((egg) => {
        if (N.full()) return;
        t.eggs.splice(t.eggs.indexOf(egg), 1);
        nt.eggs.push(Object.assign({ from: tid }, egg, { x: 30 + Math.floor(Math.random() * 260) }));
        moved++;
      });
      ['creatures', 'storage'].forEach((list) => {
        (t[list] || []).slice().forEach((e) => {
          if (N.full() || !AQ.Breeding.isJuvenile(e, now)) return;
          t[list].splice(t[list].indexOf(e), 1);
          nt.creatures.push(Object.assign({ from: tid }, e));
          moved++;
        });
      });
      // a courtship whose pair just moved out simply stops (Breeding.tick checks the pair is still there)
    });
    // anything in the nursery that can't be there (a caught adult) goes back to its own tank
    ['creatures', 'storage'].forEach((list) => {
      nt[list].slice().forEach((e) => {
        if (N.canHold(e)) return;
        const def = AQ.Creatures.defs[e.id] || AQ.data.creatures.find((d) => d.id === e.id), home = def && AQ.Tanks.forCreature(def);
        if (!home || home === id) return;
        nt[list].splice(nt[list].indexOf(e), 1);
        const h = AQ.Collection.tank(home);
        (h.creatures.length < AQ.TUNING.tank.capacity ? h.creatures : h.storage).push(e);
      });
    });
    if (nt.storage.length) { nt.creatures.push(...nt.storage); nt.storage.length = 0; }   // the nursery has no storage: everyone is in
    return moved;
  };
  return N;
})();
