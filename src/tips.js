// One-time tips: small, friendly, never blocking. The text lives in data/tutorial.js (AQ.data.tutorial.tips).
// The game calls AQ.Tips.event(name) at the right moments (and a few conditions are checked here each
// frame); a matching tip that hasn't been seen joins a queue. One tip shows at a time, with a gap between
// them, only out in the world ('play') or on the tank screen ('tank'): never during a transition,
// mid-netting, in photo mode or in a menu (pause, map, log, sound test, title). It stays a few seconds
// (longer for longer text) and goes away on any key press or click (Esc and clicks on the box are used up).
// Seen tips are saved (AQ.State.tutorial.seen); HINTS off in the sound settings hides them all.
// Events: noticed bait catch logClosed chest heavy evening bottle starfall shower ufo station tank flash
//         tankstar unlock pair court baby bumped nursery panes wideTank tankTab
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Tips = (function () {
  const U = AQ.U;
  const T = { queue: [], cur: null, gap: 0, rect: null };
  const cfg = () => AQ.TUNING.tips;
  const data = () => (AQ.data.tutorial && AQ.data.tutorial.tips) || [];
  const st = () => (AQ.State.tutorial = AQ.State.tutorial || { seen: {} });
  T.hintsOn = () => !AQ.State.settings || AQ.State.settings.hints !== false;
  T.setHints = (on) => { AQ.State.settings = AQ.State.settings || {}; AQ.State.settings.hints = !!on; if (!on) { T.queue.length = 0; T.cur = null; } };
  T.seen = (id) => !!st().seen[id];
  T.reset = () => { st().seen = {}; T.queue.length = 0; T.cur = null; T.gap = 0; };
  const available = (tip) => !tip.needs || !!AQ[tip.needs];

  // ---------------------------------------------------------------- what a returning player already knows
  const KNOWN = {
    caughtAny: () => Object.keys(AQ.State.collection || {}).length > 0,
    chest: () => { const u = AQ.State.upgrades || {}; return u.net > 1 || u.speed > 1 || u.lantern > 0 || u.depth > 0; },
    deep: () => !!(AQ.State.flags && AQ.State.flags.heavyWater) || ((AQ.State.upgrades || {}).depth || 0) > 0,
    night: () => caught((d) => d.active === 'night' || d.bloom === 'night') || ((AQ.State.starfall || {}).night || 0) > 0,
    bottle: () => Object.keys(AQ.State.bottles || {}).length > 0,
    star: () => ((AQ.State.starfall || {}).lastStar || 0) > 0 || caught((d) => !!d.event),
    station: () => !!(AQ.State.flags && AQ.State.flags.visitedStation) || tankActivity(),
    tank: () => tankActivity(),
    tankstar: () => Object.keys(AQ.State.unlocks || {}).length > 0 || Object.values(AQ.State.tankBest || {}).some((v) => v > 0),
    pair: () => KNOWN.bred() || Object.values(AQ.State.tanks || {}).some((t) => (t.creatures || []).some((a) => a.sex === 'm' && t.creatures.some((b) => b.id === a.id && b.sex === 'f'))),
    bred: () => Object.values(AQ.State.log || {}).some((l) => l.bred),
    bumped: () => caught((d) => !!d.knockback || !!d.hostile),
    graduated: () => !!(AQ.State.flags && AQ.State.flags.graduated),
    panes: () => (AQ.State.panes || 0) > 0 || !!(AQ.State.flags && AQ.State.flags.panes)
  };
  function caught(test) { return Object.keys(AQ.State.collection || {}).some((id) => { const d = AQ.data.creatures.find((x) => x.id === id); return d && test(d); }); }
  function tankActivity() { return Object.values(AQ.State.tanks || {}).some((t) => (t.decor || []).length || t.lastFed) || Object.keys(AQ.State.tankBest || {}).length > 0; }
  // An older save (from before tips existed): mark every tip the player's own progress shows they know.
  T.inferFromProgress = function () {
    const s = st();
    for (const tip of data()) if ((tip.known || []).some((k) => KNOWN[k] && KNOWN[k]())) s.seen[tip.id] = true;
  };

  // ---------------------------------------------------------------- events
  T.event = function (name) {
    if (!T.hintsOn()) return;
    for (const tip of data()) {
      if (tip.on.indexOf(name) < 0 || T.seen(tip.id) || !available(tip)) continue;
      if (T.queue.indexOf(tip) < 0 && T.cur !== tip) T.queue.push(tip);
    }
  };

  // where tips may show right now: 'play' | 'tank' | null (nowhere)
  function context(game) {
    if (AQ.Transition && AQ.Transition.active) return null;
    if (AQ.Dive && AQ.Dive.blocksTips()) return null;           // the "guided dive?" question is up
    if (game.state === 'play') {
      const K = AQ.Catching;
      if (game.scene === 'world' && K && (K.swing || K.pryTarget || K.hold > 0)) return null;   // mid-netting
      return 'play';
    }
    if (game.state === 'aquarium') { const A = AQ.Aquarium; return A.view === 'tank' && !A.photo.on ? 'tank' : null; }
    return null;
  }
  const fits = (tip, ctx) => ctx && (tip.where === 'any' || tip.where === ctx);

  // ---------------------------------------------------------------- update (before the game reads input)
  T.update = function (dt, game) {
    const c = cfg(), I = AQ.Input;
    const ctx = context(game);
    // conditions the game doesn't announce itself
    if (game.state === 'play') {
      if (game.scene === 'world' && game.player.heavy > 0.3) T.event('heavy');
      if ((game.scene === 'world' || game.scene === 'hill') && AQ.Clock && (AQ.Clock.phase() === 'dusk' || AQ.Clock.phase() === 'night')) T.event('evening');
      if (game.scene === 'hill' && AQ.Hill && AQ.Hill.playerInBeam) T.event('ufo');
      if (game.scene === 'station') T.event('station');
    }
    if (!T.hintsOn()) { T.cur = null; T.queue.length = 0; return; }
    if (T.cur) {
      const cur = T.cur;
      if (!fits(cur.tip, ctx)) { cur.away = (cur.away || 0) + dt; if (cur.away > 0.5) end(); return; }   // left its screen: it's done
      cur.away = 0; cur.t += dt;
      // any key or click closes it (after a short moment, so a key you were already pressing doesn't)
      const m = I.mouse, overBox = T.rect && m.x >= T.rect.x && m.y >= T.rect.y && m.x < T.rect.x + T.rect.w && m.y < T.rect.y + T.rect.h;
      if (overBox && (m.pressed[0] || m.pressed[2])) { m.pressed[0] = m.pressed[2] = false; end(); return; }   // a click on the box is used up
      if (cur.t > c.dismissGrace && (I.anyPressed() || m.pressed[0] || m.pressed[2])) { if (I.rawPressed('Escape')) I.consume('Escape'); end(); return; }
      if (cur.t >= cur.life) end();
      return;
    }
    T.gap -= dt;
    if (T.gap > 0 || !ctx) return;
    const i = T.queue.findIndex((tip) => fits(tip, ctx) && !T.seen(tip.id));
    if (i < 0) return;
    const tip = T.queue.splice(i, 1)[0];
    // key names filled in from the bindings, then wrapped to the box (a long key name never spills out)
    const room = c.maxWidth - (tip.icon ? 24 : 10) - 10, lines = [];
    // the tip's lines flow together as one short paragraph, wrapped to the box (no orphaned words)
    wrapPx(tip.lines.map((l) => AQ.Keys.fill(l)).join(' ').toUpperCase(), room).forEach((w) => lines.push(w));
    const chars = lines.join('').length;
    T.cur = { tip, lines, t: 0, life: U.clamp(c.baseSeconds + chars * c.perChar, c.baseSeconds, c.maxSeconds) };
    st().seen[tip.id] = true;                 // seen once it shows (never repeats, even after a reload)
    AQ.Audio.play('tip_new');
    AQ.Save && AQ.Save.dirty();
  };
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const word of text.split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && F().width(t) > px) { out.push(cur); cur = word; } else cur = t; }
    if (cur) out.push(cur);
    return out;
  }
  function end() { T.cur = null; T.rect = null; T.gap = cfg().gapSeconds; }
  T.showing = () => !!T.cur;

  // ---------------------------------------------------------------- drawing
  // Safe spots: out in the world, the top-centre band under the area banner (between the upgrade pips
  // and the counter / clock; the toasts and the controls hint are at the bottom). On the tank screen,
  // the bottom-left of the tank, over the sand (the tank's own hints stay out of its way: T.overlaps).
  const F = () => AQ.Font;
  T.draw = function (g, game) {
    const cur = T.cur;
    if (!cur || !fits(cur.tip, context(game))) { T.rect = null; return; }
    const w = Math.min(cfg().maxWidth, Math.max(...cur.lines.map((l) => F().width(l))) + (cur.tip.icon ? 24 : 10) + 10);
    const h = Math.max(cur.lines.length * 7 + 8, cur.tip.icon ? 20 : 0);
    const x = game.state === 'aquarium' ? 8 : Math.round(160 - w / 2), y = game.state === 'aquarium' ? 145 - h - 3 : 16;
    T.rect = { x, y, w, h };
    const a = U.clamp(Math.min(cur.t * 6, (cur.life - cur.t) * 2), 0, 1);
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(6,18,34,0.94)'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffe9a8'; g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(255,233,168,0.25)'; g.fillRect(x, y + h - 1, w, 1);
    let tx = x + 5;
    if (cur.tip.icon) { drawIcon(g, cur.tip.icon, x + 10, y + h / 2); tx = x + 20; }
    cur.lines.forEach((l, i) => F().draw(g, l, tx, y + 4 + i * 7, i === 0 ? '#fff6dc' : '#d8eef8', { shadow: false }));
    // a small close mark (clicking the box also closes it)
    g.fillStyle = '#8aa4b8'; g.fillRect(x + w - 6, y + 3, 1, 1); g.fillRect(x + w - 4, y + 3, 1, 1); g.fillRect(x + w - 5, y + 4, 1, 1); g.fillRect(x + w - 6, y + 5, 1, 1); g.fillRect(x + w - 4, y + 5, 1, 1);
    g.restore();
  };
  function drawIcon(g, icon, cx, cy) {
    if (/^ui:/.test(icon)) { AQ.Assets.draw(g, 'ui.icons', 'idle', cx, cy, { frame: +icon.slice(3) }); return; }
    const e = AQ.Assets.entry(icon);
    if (!e) return;
    const sc = Math.min(1, 12 / Math.max(e.fw, e.fh));
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    AQ.Assets.draw(g, icon, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: AQ.Render.t });
    g.restore();
  }
  // other text can ask whether it would sit under the tip box (and step aside)
  T.overlaps = function (x, y, w, h) { const r = T.rect; return !!r && x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y; };
  return T;
})();
