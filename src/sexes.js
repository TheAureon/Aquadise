// Male / female. Every animal is ♂ or ♀; plants have none. A species can override with
// `sexes: 'none'` in data/creatures.js (then it shows no sex and is "complete" on its first catch).
// Wild spawns lean toward the sex you're still missing (AQ.TUNING.sexes.missingBias).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Sex = (function () {
  const S = {};
  S.SYMBOL = { m: '♂', f: '♀' };
  S.COLOR = { m: '#7fd0ff', f: '#ff9fc0' };
  S.NAME = { m: 'MALE', f: 'FEMALE' };

  // does this species come in two sexes?
  S.has = (def) => !!def && !def.is_plant && def.sexes !== 'none';
  S.logOf = (id) => { const L = AQ.State.log = AQ.State.log || {}; return L[id] || (L[id] = {}); };

  // pick a sex for a new wild creature: 50/50, nudged toward the one you haven't caught yet
  S.roll = function (def) {
    if (!S.has(def)) return null;
    const L = (AQ.State.log || {})[def.id] || {}, bias = AQ.TUNING.sexes.missingBias;
    let pM = 0.5;
    if (L.m && !L.f) pM = 0.5 - bias; else if (L.f && !L.m) pM = 0.5 + bias;
    return Math.random() < pM ? 'm' : 'f';
  };
  S.random = (def) => (S.has(def) ? (Math.random() < 0.5 ? 'm' : 'f') : null);

  // sprite for this creature: males use the `creature.<id>.m` sheet when it exists
  // rare colour variants (bred babies) use `creature.<id>.v` (and `.v.m` for males)
  S.spriteKey = function (def, sex, variant) {
    let base = def.spriteKey || ('creature.' + def.id);
    if (variant && AQ.Assets.has(base + '.v')) base += '.v';
    return sex === 'm' && AQ.Assets.has(base + '.m') ? base + '.m' : base;
  };
  S.babyKey = function (def, variant) {
    const base = (def.spriteKey || ('creature.' + def.id)) + '.baby';
    if (variant && AQ.Assets.has(base + '.v')) return base + '.v';
    return AQ.Assets.has(base) ? base : null;
  };

  // collection-log status for a species
  S.discovered = (id) => !!AQ.State.collection[id];
  S.complete = function (def) {
    if (!S.discovered(def.id)) return false;
    if (!S.has(def)) return true;
    const L = (AQ.State.log || {})[def.id] || {};
    return !!(L.m && L.f);
  };

  // Old saves: give every creature already caught a sex, and fill the log's ♂/♀ slots from them.
  S.migrate = function () {
    const St = AQ.State, find = (id) => AQ.data.creatures.find((d) => d.id === id);
    St.log = St.log || {};
    Object.values(St.tanks || {}).forEach((t) => ['creatures', 'storage'].forEach((k) => (t[k] || []).forEach((e) => {
      const def = find(e.id);
      if (!def) return;
      if (S.has(def) && e.sex !== 'm' && e.sex !== 'f') e.sex = S.random(def);
      if (e.sex) S.logOf(e.id)[e.sex] = true;
    })));
    // a species in the log with no living creature to read from: mark one random slot
    Object.keys(St.collection || {}).forEach((id) => {
      const def = find(id), L = S.logOf(id);
      if (def && S.has(def) && !L.m && !L.f) L[S.random(def)] = true;
    });
  };
  return S;
})();
