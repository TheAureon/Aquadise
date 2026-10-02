// Tank "vibe" (happiness): a gentle 0-5 star score per tank, plus plain-language reasons.
// Pure calculation over saved tank data + data files; tuning lives in AQ.TUNING.aquarium.
// Nothing here punishes: low vibe just means "here's what would make it nicer".
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Vibe = (function () {
  const U = AQ.U;
  const V = {};
  const T = () => AQ.TUNING.aquarium;
  const SIZE_RANK = { tiny: 0, small: 1, medium: 2, wide: 2, tall: 2, large: 3, widelarge: 3, huge: 4 };

  const creatureDef = (id) => (AQ.Creatures && AQ.Creatures.defs[id]) || AQ.data.creatures.find((d) => d.id === id);
  const decorDef = (id) => AQ.data.decorations.find((d) => d.id === id);
  V.creatureDef = creatureDef; V.decorDef = decorDef;

  // Tags a placed decor item provides (plants are decor too).
  V.tagsOf = function (item) {
    if (item.type === 'plant') { const d = creatureDef(item.id); return ['plant'].concat((d && d.tags) || []); }
    const d = decorDef(item.id); return (d && d.tags) || [];
  };
  // Does a placed item match this tank's theme? (a biome tank's own biome; a predator tank's themes)
  V.matchesTheme = function (item, tankId) {
    const themes = AQ.Tanks.themesOf(tankId);
    if (item.type === 'plant') { const d = creatureDef(item.id); return !!d && themes.indexOf(d.biome) >= 0; }
    const d = decorDef(item.id); return !!(d && d.biomes && d.biomes.some((b) => themes.indexOf(b) >= 0));
  };
  // Nervous creatures. Predators live in their own tanks now, so the only thing that makes anyone
  // nervous is crowding: past AQ.TUNING.aquarium.nervousAbove creatures, the smallest few get
  // nervous (one per creature over the limit). Nobody is ever hurt.
  V.stressedIds = function (creatures) {
    const out = new Set(), over = creatures.length - T().nervousAbove;
    if (over <= 0) return out;
    const rank = (e) => { const d = creatureDef(e.id); return d ? (SIZE_RANK[d.sprite_size] || 1) : 1; };
    creatures.slice().sort((a, b) => rank(a) - rank(b)).slice(0, over).forEach((e) => out.add(e.uid));
    return out;
  };
  // 1 = recently fed ... 0 = hungry (fades slowly over real time; nothing bad ever happens).
  V.fedLevel = function (tank, now = Date.now()) {
    if (!tank.lastFed) return 0;
    const min = (now - tank.lastFed) / 60000, t = T();
    if (min <= t.fedFreshMinutes) return 1;
    return U.clamp(1 - (min - t.fedFreshMinutes) / t.fedFadeMinutes, 0, 1);
  };
  // Likes a creature has that are present somewhere in the tank.
  V.likesPresent = function (def, decor) {
    const likes = (def && def.likes) || [];
    if (!likes.length) return { likes, present: [] };
    const have = new Set();
    decor.forEach((d) => V.tagsOf(d).forEach((t) => have.add(t)));
    return { likes, present: likes.filter((l) => have.has(l)) };
  };

  const pretty = (t) => t.replace(/_/g, ' ');

  // Full evaluation of a tank. Returns { score (0..1), stars (0..5 in halves), parts, helps, missing }.
  V.evaluate = function (biomeId) {
    const tank = AQ.Collection.tank(biomeId), cfg = T(), w = cfg.weights;
    const b = AQ.Tanks.get(biomeId), short = (b && (b.short || b.name)) || biomeId;
    const decor = tank.decor || [], creatures = tank.creatures || [];
    const nonPlant = decor.filter((d) => d.type !== 'plant'), plants = decor.filter((d) => d.type === 'plant');
    const kinds = new Set(decor.map((d) => d.type + ':' + d.id)).size;
    const parts = {};
    parts.decor = decor.length ? 0.6 * Math.min(1, kinds / cfg.decorVarietyTarget) + 0.4 * Math.min(1, decor.length / cfg.decorAmountTarget) : 0;
    parts.theme = Math.min(1, decor.filter((d) => V.matchesTheme(d, biomeId)).length / cfg.themeTarget);
    parts.plants = Math.min(1, plants.length / cfg.plantTarget);
    const n = creatures.length;
    let stressed = new Set(), wants = [];
    if (n) {
      stressed = V.stressedIds(creatures);
      parts.fed = V.fedLevel(tank);
      parts.calm = 1 - (stressed.size / n) * cfg.stressPenalty;
      parts.space = n <= cfg.comfortable ? 1 : U.lerp(1, cfg.crowdedFloor, (n - cfg.comfortable) / Math.max(1, AQ.TUNING.tank.capacity - cfg.comfortable));
      let liked = 0, withLikes = 0;
      creatures.forEach((e) => {
        const d = creatureDef(e.id); if (!d || !d.likes || !d.likes.length) return;
        withLikes++;
        const lp = V.likesPresent(d, decor);
        if (lp.present.length) liked++; else wants.push({ name: d.name, like: lp.likes[0] });
      });
      parts.likes = withLikes ? liked / withLikes : 1;
    } else { parts.fed = 0; parts.calm = 0; parts.space = 0; parts.likes = 0; }

    let sum = 0, wsum = 0;
    for (const k in w) { sum += (parts[k] || 0) * w[k]; wsum += w[k]; }
    const score = wsum ? sum / wsum : 0;
    const stars = Math.round(score * 10) / 2;   // 0, 0.5, ... 5

    const helps = [], missing = [];
    const good = (k) => parts[k] >= 0.75;
    if (!n) missing.push('NO CREATURES YET - CATCH SOME!');
    if (good('decor')) helps.push('LOTS OF DECOR VARIETY'); else missing.push(decor.length < cfg.decorAmountTarget / 2 ? 'ADD MORE DECOR' : 'ADD DIFFERENT KINDS OF DECOR');
    const themeName = (AQ.Tanks.isPredatorTank(biomeId) ? (AQ.World.biomeById[AQ.Tanks.themesOf(biomeId)[1]] || {}).short || short : short).toUpperCase();
    if (good('theme')) helps.push(`FEELS LIKE THE ${themeName}`); else missing.push(`ADD ${themeName} DECOR OR PLANTS`);
    if (good('plants')) helps.push('PLANTS TO GRAZE ON'); else missing.push('ADD PLANTS (HARVEST THEM IN THE WILD)');
    if (n) {
      if (good('fed')) helps.push('RECENTLY FED'); else missing.push(parts.fed > 0 ? 'GETTING PECKISH - FEED THEM' : 'HUNGRY - PRESS FEED');
      if (stressed.size) missing.push(`${stressed.size} NERVOUS - A BIT CROWDED`); else helps.push('EVERYONE IS CALM');
      if (good('space')) helps.push('PLENTY OF ROOM'); else missing.push('A LITTLE CROWDED');
      if (good('likes')) helps.push('THEY HAVE THINGS THEY LIKE');
      wants.slice(0, 2).forEach((wn) => missing.push(`${wn.name.toUpperCase()} WOULD LIKE ${pretty(wn.like).toUpperCase()}`));
    }
    return { score, stars, parts, helps, missing, stressed: stressed.size, creatures: n };
  };

  // ---- happiness milestones -> new decor (no currency, no shop)
  V.unlockStars = (dd) => (dd.unlock.stars != null ? dd.unlock.stars : T().unlockStars[U.clamp((dd.unlock.tier || 1) - 1, 0, T().unlockStars.length - 1)]);
  V.isUnlocked = (dd) => !dd.unlock || !!(AQ.State.unlocks && AQ.State.unlocks[dd.id]);
  V.lockedFor = (biomeId) => AQ.data.decorations.filter((d) => d.unlock && (d.unlock.tank || d.unlock.biome) === biomeId && !V.isUnlocked(d))
    .sort((a, b) => V.unlockStars(a) - V.unlockStars(b));
  V.nextUnlock = (biomeId) => { const l = V.lockedFor(biomeId)[0]; return l ? { def: l, stars: V.unlockStars(l) } : null; };
  // Remember a tank's best stars; returns decor that just got unlocked by it.
  V.recordBest = function (biomeId, stars) {
    const st = AQ.State;
    st.tankBest = st.tankBest || {}; st.unlocks = st.unlocks || {};
    if (stars > (st.tankBest[biomeId] || 0)) { st.tankBest[biomeId] = stars; AQ.Save && AQ.Save.dirty(); }
    const best = st.tankBest[biomeId] || 0, fresh = [];
    V.lockedFor(biomeId).forEach((d) => { if (best >= V.unlockStars(d)) { st.unlocks[d.id] = true; fresh.push(d); } });
    if (fresh.length) AQ.Save && AQ.Save.dirty();
    return fresh;
  };

  return V;
})();
