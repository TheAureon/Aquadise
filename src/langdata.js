// Text for the data files. The data files (data/*.js) hold ids and numbers only; their text lives in
// the language files (data/lang/). This gives the data objects their text back as live lookups, so the
// rest of the game keeps reading creature.name, biome.short, page.lines... as before, always in the
// current language:
//   creatures         name, hint                     creature.<id>.name / .hint
//   creature families label                          family.<id>
//   decorations       name                           decor.<id>
//   biomes            name, short; zones: name       biome.<id>.name / .short, zone.<biome>.<n>
//   doors             name (from their kind)         world.door / world.hatch
//   predator + special tanks: name, short, tiny      tank.<id>.name / .short / .tiny
//   field notes       AQ.data.lore[id]: title, sci, lines   lore.<id>.title / .sci / .<n>
//   tutorial          help lines, controls, dive, guide pages, tips   help.*, controls.*, dive.*, guide.*, tip.*
//   music             piece + stinger labels          music.<id>
// Load right after the data files (index.html).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.LangData = (function () {
  const LD = {};
  const t = (k, v) => AQ.Lang.t(k, v);
  const getter = (obj, field, fn) => Object.defineProperty(obj, field, { get: fn, configurable: true, enumerable: true });
  // how many numbered keys <prefix>.1, .2 ... English has (lists of lines)
  LD.count = (prefix) => { const en = AQ.langFiles.en; let n = 0; while (en[`${prefix}.${n + 1}`] != null) n++; return n; };
  // numbered lines <prefix>.1 .. .n   (LANG_PREFIX: 'help.'  LANG_PREFIX: 'dive.prompt.'  LANG_PREFIX: 'dive.nice.')
  const lines = (prefix, n) => Array.from({ length: n }, (_, i) => t(`${prefix}.${i + 1}`));

  // a predator / special tank def (also used on the copies src/tanks.js makes)
  LD.bindTank = function (tk) {
    getter(tk, 'name', () => t(`tank.${tk.id}.name`)); getter(tk, 'short', () => t(`tank.${tk.id}.short`)); getter(tk, 'tiny', () => t(`tank.${tk.id}.tiny`));
    return tk;
  };

  LD.bind = function () {
    const D = AQ.data;
    D.creatures.forEach((d) => { getter(d, 'name', () => t(`creature.${d.id}.name`)); getter(d, 'hint', () => t(`creature.${d.id}.hint`)); });
    Object.keys(D.families || {}).forEach((id) => getter(D.families[id], 'label', () => t(`family.${id}`)));
    D.decorations.forEach((d) => getter(d, 'name', () => t(`decor.${d.id}`)));
    D.world.biomes.forEach((b) => {
      getter(b, 'name', () => t(`biome.${b.id}.name`)); getter(b, 'short', () => t(`biome.${b.id}.short`));
      (b.zones || []).forEach((z, i) => getter(z, 'name', () => t(`zone.${b.id}.${i + 1}`)));
    });
    (D.world.doors || []).forEach((d) => getter(d, 'name', () => t(`world.${d.kind}`)));
    (D.predatorTanks || []).concat(D.specialTanks || []).forEach(LD.bindTank);
    // field notes: one per species that has them in English
    D.lore = {};
    D.creatures.forEach((c) => {
      if (AQ.langFiles.en[`lore.${c.id}.title`] == null) return;
      const n = LD.count(`lore.${c.id}`), L = {};
      getter(L, 'title', () => t(`lore.${c.id}.title`)); getter(L, 'sci', () => t(`lore.${c.id}.sci`)); getter(L, 'lines', () => lines(`lore.${c.id}`, n));
      D.lore[c.id] = L;
    });
    // the tutorial (data/tutorial.js holds the structure and how many lines each part has)
    const T = D.tutorial, nHelp = T.helpLines, nTouch = T.touchHelpLines, nControls = T.controls;
    getter(T, 'helpLines', () => lines('help', nHelp));
    getter(T, 'touchHelpLines', () => lines('help.touch', nTouch));
    getter(T, 'controls', () => Array.from({ length: nControls }, (_, i) => [t(`controls.${i + 1}`), t(`controls.${i + 1}.keys`)]));
    const pr = T.dive.prompt, nPrompt = pr.lines, steps = T.dive.steps, nNice = T.dive.nice;
    getter(pr, 'title', () => t('dive.prompt.title')); getter(pr, 'lines', () => lines('dive.prompt', nPrompt));
    getter(pr, 'yes', () => t('dive.prompt.yes')); getter(pr, 'no', () => t('dive.prompt.no'));
    // (a step can have its own wording with touch controls: dive.step.<id>.touch)
    T.dive.steps = steps.map((id) => { const s = { id }; getter(s, 'text', () => (AQ.Touch && AQ.Touch.active() && AQ.Lang.has(`dive.step.${id}.touch`, 'en') ? t(`dive.step.${id}.touch`) : t(`dive.step.${id}`))); return s; });
    getter(T.dive, 'nice', () => lines('dive.nice', nNice));
    T.guide.forEach((pg) => {
      const n = pg.lines, needs = pg.lineNeeds || {};
      getter(pg, 'title', () => t(`guide.${pg.id}.title`));
      getter(pg, 'lines', () => Array.from({ length: n }, (_, i) => (needs[i + 1] ? { needs: needs[i + 1], text: t(`guide.${pg.id}.${i + 1}`) } : t(`guide.${pg.id}.${i + 1}`))));
    });
    T.tips.forEach((tip) => getter(tip, 'lines', () => [t(`tip.${tip.id}`)]));
    // music labels (the sound test)
    ['pieces', 'stingers'].forEach((grp) => Object.keys(D.music[grp]).forEach((id) => getter(D.music[grp][id], 'label', () => t(`music.${id}`))));
  };
  return LD;
})();
AQ.LangData.bind();
