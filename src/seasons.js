// The seasons: spring, summer, autumn and winter, cycling over real days (AQ.TUNING.seasons.daysPerSeason
// each, about a week by default). A new game (and an older save, the first time) starts on the first day
// of spring. Each season eases into the next over the last few hours of the one before.
//
// How each one looks (data/seasons.js): the sky and the sunlit water lean toward the season's colours
// (spring's green shallows, summer's brightness, autumn's warm gold, winter's cold pale blue); the
// plants of the coral shelf, the kelp forest, the tide pools and the open ocean change colour (the terrain
// is redrawn when the season turns; nothing moves); coral spawn drifts up off the reef in spring; ice
// floes drift past the ice shelf and snow falls over the ice in winter; on the hill the grass turns gold
// with leaves drifting down in autumn, and lies under snow in winter. Every graphics level, CLASSIC
// included. Shown on the HUD (a small mark by the sun / moon) and the map (season and day).
//
// Saved: AQ.State.seasons = { origin } (the moment the first spring began, a number). Tuning:
// AQ.TUNING.seasons. Testing: debug.season (one season), debug.seasonKeys (4 steps to the next).
// Names: season.<id>; the line when one arrives: season.arrive.<id> (data/lang/en.js).
// LANG_PREFIX: 'season.'  LANG_PREFIX: 'season.arrive.'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Seasons = (function () {
  const U = AQ.U;
  const S = { forced: null, look: null, lastId: null, bits: [], hillBits: [], rebuilding: [] };
  const cfg = () => AQ.TUNING.seasons;
  const D = () => AQ.data.seasons;
  const DAY = 86400000;
  const smooth = (t) => t * t * (3 - 2 * t);
  const st = () => {
    const s = AQ.State.seasons = AQ.State.seasons && typeof AQ.State.seasons === 'object' ? AQ.State.seasons : {};
    if (typeof s.origin !== 'number') s.origin = Date.now();
    return s;
  };
  S.on = () => cfg().enabled;

  // ---------------------------------------------------------------- which season
  // where we are in the year: 0 - 4 (0 = the first moment of spring), from real time
  S.progress = function (now = Date.now()) {
    const order = D().order, f = S.forced || (AQ.TUNING.debug.season && order.indexOf(AQ.TUNING.debug.season) >= 0 ? AQ.TUNING.debug.season : null);
    if (f) return order.indexOf(f) + 0.5;
    const len = cfg().daysPerSeason * DAY, p = (now - st().origin) / len;
    return ((p % 4) + 4) % 4;
  };
  S.index = (now) => Math.floor(S.progress(now)) % 4;
  S.id = (now) => D().order[S.index(now)];
  S.day = (now) => Math.min(cfg().daysPerSeason, Math.floor((S.progress(now) % 1) * cfg().daysPerSeason) + 1);
  // how much of each season shows right now: the current one, easing into the next near its end
  S.weights = function (now) {
    const p = S.progress(now), i = Math.floor(p) % 4, f = p - Math.floor(p), order = D().order, w = {};
    order.forEach((id) => { w[id] = 0; });
    const b = Math.min(0.5, cfg().blendHours / 24 / cfg().daysPerSeason);
    const k = f > 1 - b ? smooth((f - (1 - b)) / b) : 0;
    if (!S.on()) { w.summer = 1; return w; }                       // (seasons switched off: a plain summer, as before)
    w[order[i]] += 1 - k; w[order[(i + 1) % 4]] += k;
    return w;
  };
  // the season the plants are drawn in (whichever shows more)
  S.lookId = function () { const w = S.weights(); return D().order.reduce((a, b) => (w[b] > w[a] ? b : a)); };

  // is a seasonal creature or plant out? (seasons switched off: always, so nothing is missed)
  S.allows = (def) => !def.season || !S.on() || S.lookId() === def.season;
  // spring is spawning season: breeding starts more often and tanks rest less between babies
  S.springBreeding = () => (S.on() ? S.weights().spring : 0);

  // ---------------------------------------------------------------- colours
  const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  // the sky's colours [top, horizon], leaning toward the season's
  S.skyTint = function (cols) {
    if (!S.on()) return cols;
    const w = S.weights(), d = AQ.Clock ? AQ.Clock.daylight() : 1;
    let top = cols[0], bot = cols[1];
    for (const id in w) {
      if (w[id] <= 0) continue;
      const s = D().looks[id].sky, k = s.k * w[id] * d;            // (by day; the night sky stays the night's)
      top = mixC(top, s.top, k); bot = mixC(bot, s.bottom, k);
    }
    return [top, bot];
  };
  // the plants' colours for a prop spec (the terrain asks while drawing a biome)
  S.propSpec = function (biome, spec) {
    if (!S.on() || spec.noSeason) return spec;
    if (S.look == null) S.look = S.lookId();                       // (what the terrain is drawn in now)
    const L = D().looks[S.look], cols = L.plants[biome] && L.plants[biome][spec.type];
    if (!cols) return spec;
    const front = spec.layer === 'front';
    return Object.assign({}, spec, { colors: front ? cols.map((h) => { const c = U.hex(h); return `rgb(${Math.round(c[0] * 0.6)},${Math.round(c[1] * 0.6)},${Math.round(c[2] * 0.6)})`; }) : cols });
  };
  // the biomes whose plants change with the seasons (redrawn when it turns)
  const plantBiomes = () => { const out = new Set(); D().order.forEach((id) => Object.keys(D().looks[id].plants).forEach((b) => out.add(b))); return [...out]; };
  // the sunlit water's tint at a spot along the sea: [r, g, b, strength], blended between the seasons
  function waterAt(x) {
    const w = S.weights(), reg = AQ.Weather ? AQ.Weather.regionAt(x).id : null;
    let c = [0, 0, 0], a = 0;
    for (const id in w) {
      if (w[id] <= 0) continue;
      const W = D().looks[id].water, t = (reg && W[reg]) || W.all;
      if (!t) continue;
      const k = w[id] * t[3];
      c = [c[0] + t[0] * k, c[1] + t[1] * k, c[2] + t[2] * k]; a += k;
    }
    return a > 0 ? [c[0] / a, c[1] / a, c[2] / a, a] : null;
  }

  // ---------------------------------------------------------------- every frame
  const rnd = (a, b) => a + Math.random() * (b - a);
  S.update = function (dt, game) {
    if (!game || game.state === 'loading') return;
    const look = S.lookId();
    if (S.look == null) S.look = look;
    if (look !== S.look) {                                         // the season turned: redraw the plants, the hill
      S.look = look;
      S.rebuilding = plantBiomes();
      if (AQ.Hill && AQ.Hill.repaint) AQ.Hill.repaint();
    }
    if (S.rebuilding.length) AQ.Terrain.rebuild(AQ.World, [S.rebuilding.shift()]);   // (one biome a frame)
    const id = S.id();
    if (S.lastId && id !== S.lastId && game.state === 'play' && AQ.HUD) AQ.HUD.toast(AQ.t(`season.arrive.${id}`), '#ffe9a8', 5);
    S.lastId = id;
    if (game.state !== 'play' && game.state !== 'map' && game.state !== 'pause') return;
    if (game.scene === 'world') seaBits(dt); else if (game.scene === 'hill') hillBits(dt);
    debugKey(game);
  };
  const lowFx = () => U.lowFx();
  // the sea's drifting things: coral spawn rising (spring, the coral shelf), snow over the ice (winter)
  function seaBits(dt) {
    const w = S.weights(), cam = AQ.Camera, l = cam.left(), t = cam.top(), Wd = AQ.World, sea = Wd.sea, D0 = D();
    const coral = Wd.biomeById.coral.rect, inCoral = l + cam.w > coral[0] && l < coral[0] + coral[2] && t + cam.h > sea;
    const wantSpawn = inCoral ? Math.round(cfg().spawnBits * w.spring * (lowFx() ? 0.5 : 1)) : 0;
    const inSnow = l + cam.w > D0.snow[0] && l < D0.snow[1] && sea - t > 0;
    const wantSnow = inSnow ? Math.round(cfg().snowBits * w.winter * (lowFx() ? 0.5 : 1)) : 0;
    let nSpawn = 0, nSnow = 0;
    for (let i = S.bits.length - 1; i >= 0; i--) {
      const b = S.bits[i];
      b.t += dt;
      if (b.kind === 'spawn') { b.y -= b.v * dt; b.x += Math.sin(b.t * 0.8 + b.s) * 3 * dt; nSpawn++; }
      else { b.y += b.v * dt; b.x += Math.sin(b.t * 1.3 + b.s) * 6 * dt; nSnow++; }
      const gone = b.t > b.life || b.x < l - 30 || b.x > l + cam.w + 30 || (b.kind === 'spawn' ? b.y < sea + 4 : b.y > sea);
      if (gone) { S.bits.splice(i, 1); if (b.kind === 'spawn') nSpawn--; else nSnow--; }
    }
    for (; nSpawn < wantSpawn; nSpawn++) {
      const x = rnd(Math.max(l, coral[0]), Math.min(l + cam.w, coral[0] + coral[2])), y = rnd(Math.max(sea + 20, t), t + cam.h);
      if (Wd.water(x, y)) S.bits.push({ kind: 'spawn', x, y, v: rnd(4, 9), t: 0, life: rnd(5, 9), s: rnd(0, 6), c: Math.random() < 0.6 ? '#ffd8e8' : '#fff6f0' });
      else break;
    }
    for (; nSnow < wantSnow; nSnow++) S.bits.push({ kind: 'snow', x: rnd(Math.max(l, D0.snow[0]), Math.min(l + cam.w, D0.snow[1])), y: t - rnd(0, 40) + (S.bits.length < 4 ? rnd(0, 80) : 0), v: rnd(10, 18), t: 0, life: 20, s: rnd(0, 6) });
  }
  // the hill: leaves drifting down (autumn), snowflakes (winter); screen px
  function hillBits(dt) {
    const w = S.weights(), wantLeaves = Math.round(cfg().leafBits * w.autumn * (lowFx() ? 0.5 : 1)), wantSnow = Math.round(cfg().snowBits * w.winter * (lowFx() ? 0.5 : 1));
    let nl = 0, ns = 0;
    const ground = AQ.Hill && AQ.Hill.groundAt ? AQ.Hill.groundAt : () => 152;
    for (let i = S.hillBits.length - 1; i >= 0; i--) {
      const b = S.hillBits[i];
      b.t += dt; b.y += b.v * dt; b.x += (Math.sin(b.t * (b.kind === 'leaf' ? 1.6 : 1.1) + b.s) * (b.kind === 'leaf' ? 14 : 6) + (b.kind === 'leaf' ? 6 : 0)) * dt;
      if (b.y >= ground(Math.round(b.x)) || b.x > 340 || b.x < -20) S.hillBits.splice(i, 1); else if (b.kind === 'leaf') nl++; else ns++;
    }
    const LEAF = ['#e8a040', '#d8702c', '#f0c850', '#c85a2a'];
    for (; nl < wantLeaves; nl++) S.hillBits.push({ kind: 'leaf', x: rnd(-10, 320), y: S.hillBits.length < wantLeaves ? rnd(-10, 140) : -rnd(2, 20), v: rnd(10, 18), t: 0, s: rnd(0, 6), c: LEAF[Math.floor(Math.random() * LEAF.length)] });
    for (; ns < wantSnow; ns++) S.hillBits.push({ kind: 'snow', x: rnd(-10, 320), y: S.hillBits.length < wantSnow ? rnd(-10, 140) : -rnd(2, 20), v: rnd(9, 16), t: 0, s: rnd(0, 6) });
  }
  function debugKey(game) {
    const d = AQ.TUNING.debug;
    if (!d.seasonKeys || !AQ.Input.rawPressed(d.seasonKey)) return;
    const order = D().order, i = S.forced ? order.indexOf(S.forced) : S.index();
    S.forced = order[(i + 1) % 4];
    if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.season', { season: AQ.t(`season.${S.forced}`) }), '#cfe8ff');
  }

  // ---------------------------------------------------------------- drawing
  // the sunlit water's tint (after the world's light and shade), in 16 px columns that blend at the borders
  S.drawWater = function (ctx, cam) {
    if (!S.on()) return;
    const l = cam.left(), top = cam.top(), seaY = AQ.World.sea - top, depth = cfg().tintDepth;
    if (seaY + depth < 0 || seaY > cam.h) return;
    const y0 = Math.max(0, Math.round(seaY)), y1 = Math.min(cam.h, Math.round(seaY + depth));
    if (y1 <= y0) return;
    const day = AQ.Clock ? 0.35 + 0.65 * AQ.Clock.daylight() : 1;
    for (let x = -(((l % 16) + 16) % 16); x < cam.w; x += 16) {
      const c = waterAt(l + x + 8);
      if (!c) continue;
      const a = Math.min(0.25, c[3]) * day, g = ctx.createLinearGradient(0, seaY, 0, seaY + depth);
      const rgb = `${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])}`;
      g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x, y0, 16, y1 - y0);
    }
  };
  // coral spawn, snow over the ice and the ice floes (world px; after the water's surface line)
  const FLOES = [];
  (function () { const r = U.rng(41), F = () => AQ.data.seasons.floes; let x = F()[0]; while (x < F()[1]) { const w = Math.round(r.range(8, 28)); FLOES.push({ x, w, s: r.range(0, 6) }); x += w + Math.round(r.range(6, 30)); } })();
  S.drawSea = function (ctx, cam) {
    if (!S.on()) return;
    const l = cam.left(), t = cam.top(), w = S.weights();
    for (const b of S.bits) {
      const fade = Math.min(1, b.t / 1.5, (b.life - b.t) / 1.5);
      ctx.globalAlpha = Math.max(0, fade) * (b.kind === 'spawn' ? 0.85 : 0.9);
      ctx.fillStyle = b.kind === 'spawn' ? b.c : '#f4f8ff';
      ctx.fillRect(Math.round(b.x - l), Math.round(b.y - t), 1, 1);
    }
    ctx.globalAlpha = 1;
    // winter's ice floes past the ice shelf: they melt away (fade) as spring comes
    if (w.winter > 0.02) {
      const seaY = AQ.World.sea - t, time = AQ.Render.t * (U.calm() ? 0.5 : 1);
      if (seaY < -4 || seaY > cam.h + 4) return;
      ctx.globalAlpha = Math.min(1, w.winter * 1.2);
      for (const f of FLOES) {
        const x = Math.round(f.x - l), bob = Math.round(Math.sin(time * 1.1 + f.s) * 0.6);
        if (x + f.w < 0 || x > cam.w || AQ.World.solid(f.x, AQ.World.sea)) continue;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, seaY - 3 + bob, f.w - 2, 1);
        ctx.fillStyle = '#e6f2fc'; ctx.fillRect(x, seaY - 2 + bob, f.w, 2);
        ctx.fillStyle = '#a8cbe6'; ctx.fillRect(x, seaY + bob, f.w, 1);
        ctx.fillStyle = 'rgba(140,196,230,0.55)'; ctx.fillRect(x + 1, seaY + 1 + bob, f.w - 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  };
  S.drawHill = function (ctx) {
    for (const b of S.hillBits) {
      ctx.fillStyle = b.kind === 'leaf' ? b.c : '#f4f8ff';
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.kind === 'leaf' ? 2 : 1, 1);
    }
  };
  // the hill's look in the current season (its ground is repainted when the season turns)
  S.hillLook = () => D().looks[S.look || S.lookId()].hill;
  S.hillsTint = function (cols) {                                  // the far hills: autumn's brown, winter's white
    const w = S.weights();
    let out = cols.slice();
    for (const id in w) { const h = D().looks[id].hill.hills; if (h && w[id] > 0) out = mixC(out, h, w[id] * 0.5); }
    return out;
  };

  // ---------------------------------------------------------------- the HUD and the map
  const G = {
    spring: { rows: ['.#.#.', '#####', '.###.', '..#..', '.##..'], col: '#ffb8d8', low: '#7ee08e' },
    summer: { rows: ['..#..', '.###.', '#####', '.###.', '..#..'], col: '#ffd060' },
    autumn: { rows: ['...##', '..###', '.###.', '###..', '#....'], col: '#f0a040' },
    winter: { rows: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'], col: '#dcecff' }
  };
  S.drawGlyph = function (ctx, x, y, id = S.id(), alpha = 0.9) {
    const g = G[id];
    if (!g) return;
    ctx.globalAlpha = alpha;
    g.rows.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = 'rgba(4,12,24,0.75)'; ctx.fillRect(x + rx + 1, y + ry + 1, 1, 1); } }));
    g.rows.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { ctx.fillStyle = g.low && ry >= 3 ? g.low : g.col; ctx.fillRect(x + rx, y + ry, 1, 1); } }));
    ctx.globalAlpha = 1;
  };
  S.drawHud = function (ctx, x, y, game) { if (S.on() && game.scene !== 'station') S.drawGlyph(ctx, x, y); };
  S.mapLine = () => AQ.t('map.season', { season: AQ.t(`season.${S.id()}`), n: S.day(), total: cfg().daysPerSeason });
  return S;
})();
