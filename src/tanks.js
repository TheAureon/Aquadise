// The tank registry: every tank in the aquarium building, biome tanks and predator tanks alike.
// A tank "def" looks like a biome (id, name, short, palette, water, index, dark) so the tank screen,
// the building, the vibe and the overview treat them all the same.
//   AQ.Tanks.list()          all tanks, in building order (ground floor first, left to right): biome tanks,
//                            special tanks (data/aquarium.js specialTanks, e.g. Starfall) and predator tanks
//   AQ.Tanks.get(id)         one tank def
//   AQ.Tanks.forCreature(d)  which tank a creature lives in (predators -> their predator tank)
//   AQ.Tanks.themesOf(id)    biomes whose decor/plants count as "on theme" for that tank
//   AQ.Tanks.migrate()       move any creature sitting in the wrong tank to its home (old saves)
//   AQ.Tanks.size / capacity / decorCapacity / width / expandCost / expand   bigger tanks (SIZE 0..3)
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Tanks = (function () {
  const T = {};
  let defs = null, order = null;

  function build() {
    defs = {};
    AQ.World.biomes.forEach((b) => { defs[b.id] = Object.assign(b, { kind: 'biome', themes: [b.id] }); });
    (AQ.data.predatorTanks || []).forEach((p, i) => {
      defs[p.id] = AQ.LangData.bindTank(Object.assign({ kind: 'predator', index: 40 + i, dark: (AQ.data.tankStyles[p.id] || {}).dark || 0 }, p, { themes: [p.id].concat(p.themes || []) }));
    });
    // special tanks that aren't a sea biome (Starfall)
    (AQ.data.specialTanks || []).forEach((p, i) => {
      defs[p.id] = AQ.LangData.bindTank(Object.assign({ kind: 'special', index: 60 + i, dark: (AQ.data.tankStyles[p.id] || {}).dark || 0 }, p, { themes: [p.id].concat((p.themes || []).filter((t) => t !== p.id)) }));
    });
    // building order from the slots in data/scenes.js; any tank without a slot goes at the end
    const slots = (AQ.data.station && AQ.data.station.tanks) || [];
    const sorted = slots.slice().sort((a, b) => a.floor - b.floor || a.x - b.x);
    order = sorted.map((s) => s.tank).filter((id) => id && defs[id]);
    Object.keys(defs).forEach((id) => { if (order.indexOf(id) < 0) order.push(id); });
  }
  const ensure = () => { if (!defs) build(); };

  T.list = () => { ensure(); return order.map((id) => defs[id]); };
  T.get = (id) => { ensure(); return defs[id] || null; };
  // shortest readable label for a tank (used when space is tight)
  // (a biome's tiny name: biome.<id>.tiny in data/lang/ where there is one, else the first word of its short name)
  T.tinyName = (d) => (d.tiny || (AQ.Lang.has(`biome.${d.id}.tiny`, 'en') ? AQ.t(`biome.${d.id}.tiny`) : '') || (d.short || d.name).split(' ')[0]).toUpperCase();
  // the longest of name -> short -> tiny that fits in `px` pixels
  T.labelFor = function (d, px) {
    const F = AQ.Font, opts = [(d.short || d.name).toUpperCase(), T.tinyName(d)];
    return opts.find((t) => F.width(t) <= px) || opts[opts.length - 1];
  };
  // a tank's name for file names: plain ASCII letters and digits (from the English name), e.g. TidePools
  T.fileName = (d) => String(AQ.Lang.tEn(d.kind === 'biome' ? `biome.${d.id}.short` : `tank.${d.id}.short`) || d.id).replace(/[^A-Za-z0-9]/g, '') || d.id;
  T.isPredatorTank = (id) => { const d = T.get(id); return !!d && d.kind === 'predator'; };
  T.isNursery = (id) => { const d = T.get(id); return !!d && !!d.nursery; };
  T.themesOf = (id) => { const d = T.get(id); return d ? d.themes : [id]; };
  // ---------------------------------------------------------------- tank size (SIZE 0..3, saved per tank)
  // AQ.State.tanks[id].size (missing = 0, today's tank). Each level is wider, holds more creatures and
  // more decor; the numbers are AQ.TUNING.tank (the nursery's room: AQ.TUNING.nursery.capacity).
  const TT = () => AQ.TUNING.tank;
  const at = (arr, lvl) => (Array.isArray(arr) ? arr[Math.min(lvl, arr.length - 1)] : arr);
  T.maxSize = () => TT().expandCost.length;
  T.size = (id) => { const t = AQ.State.tanks && AQ.State.tanks[id]; return Math.max(0, Math.min(T.maxSize(), (t && t.size) | 0)); };
  T.capacity = (id, lvl = T.size(id)) => (T.isNursery(id) ? at(AQ.TUNING.nursery.capacity, lvl) : at(TT().capacity, lvl));
  T.decorCapacity = (id, lvl = T.size(id)) => at(TT().decorCapacity, lvl);
  T.width = (id, lvl = T.size(id)) => at(TT().width, lvl);
  // how much bigger than a size-0 tank (crowding thresholds scale with it, so a bigger tank is never
  // "crowded" at the numbers it was built for)
  T.roomScale = (id) => T.capacity(id) / T.capacity(id, 0);
  // panes needed for the next level (null at the maximum)
  T.expandCost = (id) => { const l = T.size(id); return l >= T.maxSize() ? null : TT().expandCost[l]; };
  // the smallest size whose capacity is at least n (null if even the biggest isn't enough)
  T.sizeFor = (id, n) => { for (let l = 0; l <= T.maxSize(); l++) if (T.capacity(id, l) >= n) return l; return null; };
  // EXPAND: uses the panes and makes the tank one size bigger. Returns 'ok' | 'max' | 'panes'.
  T.expand = function (id) {
    const cost = T.expandCost(id);
    if (cost == null) return 'max';
    if (!AQ.Panes.spend(cost)) return 'panes';
    const t = AQ.Collection.tank(id);
    t.size = T.size(id) + 1;
    AQ.Save && AQ.Save.dirty();
    return 'ok';
  };
  // a new creature (a catch, a graduate going home...): into the tank if there's room, else its storage
  T.room = (id) => Math.max(0, T.capacity(id) - AQ.Collection.tank(id).creatures.length);

  T.forCreature = function (def) {
    if (!def) return null;
    if (def.predator) {
      const groups = AQ.data.predatorTanks || [];
      const g = groups.find((p) => (p.members || []).indexOf(def.id) >= 0) || groups.find((p) => (p.themes || []).indexOf(def.biome) >= 0) || groups[0];
      if (g) return g.id;
    }
    return def.biome;
  };

  // Old saves (or regrouped predators): move every creature to its home tank. Nothing is ever lost:
  // if the home tank is full it goes to that tank's storage. Returns how many moved.
  T.migrate = function () {
    const tanks = AQ.State.tanks || {};
    let moved = 0;
    Object.keys(tanks).forEach((id) => {
      const t = tanks[id];
      if (AQ.Nursery && AQ.Nursery.is(id)) return;               // babies stay in the nursery until they graduate
      ['creatures', 'storage'].forEach((list) => {
        for (let i = (t[list] || []).length - 1; i >= 0; i--) {
          const e = t[list][i], def = AQ.Creatures.defs[e.id] || AQ.data.creatures.find((d) => d.id === e.id);
          const home = def && T.forCreature(def);
          if (!home || home === id) continue;
          t[list].splice(i, 1);
          const h = AQ.Collection.tank(home);
          // predators were often parked in storage to stop them stressing prey: now they get their own tank
          if (h.creatures.length < T.capacity(home)) h.creatures.push(e); else h.storage.push(e);
          moved++;
        }
      });
    });
    return moved;
  };
  return T;
})();
