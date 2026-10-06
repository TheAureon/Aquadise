// Persistent player progress: collection log, harvested plant inventory, tanks. Saved by save.js.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.State = {
  collection: {},   // id -> number caught / harvested
  plants: {},       // id -> plants in inventory (usable as decorations)
  tanks: {},        // tankId (biome id or predator tank id) -> { creatures: [{uid,id}], storage: [{uid,id}], decor: [{uid,type,id,x,y}] }
  upgrades: { net: 1, speed: 1, lantern: 0, depth: 0 },
  panes: 0,         // glass panes (building material for the tanks; src/panes.js)
  unlocks: {},      // decorId -> true once unlocked by a tank's happiness
  tankBest: {},     // biomeId -> best stars that tank has ever reached
  settings: {},     // player options (e.g. stationZoomOut)
  log: {},          // species id -> { m: true, f: true } sexes caught (plants: none)
  clock: null,      // { hour } of the day/night clock (null -> starts at AQ.TUNING.clock.startHour)
  flags: {},        // one-time things already shown (e.g. heavyWater toast)
  bottles: {}       // species id -> true once its message bottle (field notes) is found
};

AQ.Collection = (function () {
  const Col = {};
  const S = () => AQ.State;

  Col.tank = function (biome) {
    const t = S().tanks;
    if (!t[biome]) t[biome] = { creatures: [], storage: [], decor: [] };
    return t[biome];
  };

  // Records a catch; returns true if this species is new to the log.
  Col.recordCatch = function (def, sex) {
    const isNew = !S().collection[def.id];
    S().collection[def.id] = (S().collection[def.id] || 0) + 1;
    const tank = Col.tank(AQ.Tanks.forCreature(def));   // biome tank, or a predator tank
    if (AQ.Sex.has(def) && sex !== 'm' && sex !== 'f') sex = AQ.Sex.random(def);
    const entry = { uid: AQ.U.uid(), id: def.id };
    if (sex) { entry.sex = sex; AQ.Sex.logOf(def.id)[sex] = true; }
    if (tank.creatures.length < AQ.Tanks.capacity(AQ.Tanks.forCreature(def))) tank.creatures.push(entry); else tank.storage.push(entry);
    AQ.Save && AQ.Save.dirty();
    return isNew;
  };
  Col.recordHarvest = function (def) {
    const isNew = !S().collection[def.id];
    S().collection[def.id] = (S().collection[def.id] || 0) + 1;
    S().plants[def.id] = (S().plants[def.id] || 0) + 1;
    AQ.Save && AQ.Save.dirty();
    return isNew;
  };

  // discovered = caught either sex (or harvested); complete = both sexes (or one catch, if no sexes)
  Col.progress = function () {
    const all = AQ.data.creatures;
    const discovered = all.filter((d) => S().collection[d.id]).length;
    return { caught: discovered, discovered, complete: all.filter((d) => AQ.Sex.complete(d)).length, total: all.length };
  };
  Col.has = (id) => !!S().collection[id];
  return Col;
})();
