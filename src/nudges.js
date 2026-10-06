// Friendly nudges for a player who seems stuck: a short, light line in the tip-box style, now and then.
// Three situations, watched only during active play in the sea (never in a menu, the guided dive, a
// transition, photo mode or the tank screens: those aren't 'play' in the sea):
//   spam    many net swings and no catch in a short time, or clicking very fast for a few seconds
//   drought no catch for a long stretch of active play (a new game with nothing caught: a bit sooner)
//   mash    pressing a key that does nothing here, over and over (the interact key in the sea, say)
// Each situation only ever shows its own lines (shuffled: a type doesn't repeat a line until all of its
// lines have shown). A drought line can carry a small REDO TUTORIAL button (src/redo.js).
// Never pauses or blocks anything; gone after a few seconds or when you do something else.
// Rate limits, thresholds and the on/off switch: AQ.TUNING.nudges. HINTS off (settings) turns them off too.
// Text: nudge.<type>.<n> in data/lang/en.js (how many per type: AQ.data.tutorial.nudges).
// Saved: AQ.State.nudges = { bags: { type: [line numbers still to show] } } (numbers only).
// LANG_PREFIX: 'nudge.spam.'  LANG_PREFIX: 'nudge.drought.'  LANG_PREFIX: 'nudge.mash.'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Nudges = (function () {
  const U = AQ.U;
  const N = { cur: null, swings: [], clicks: [], keys: {}, shown: [], lastShown: -1e9, lastCatch: -1e9, dry: 0, lastInput: 0, t: 0, ui: [], debugNext: 0 };
  const cfg = () => AQ.TUNING.nudges;
  const TYPES = ['spam', 'drought', 'mash'];
  const ICON = { spam: 'creature.glasswinged_minnow', drought: 'ui:3', mash: 'ui:2' };
  const COLOR = { spam: '#9fe8ff', drought: '#ffd8e8', mash: '#ffe9a8' };
  const store = () => (AQ.State.nudges = AQ.State.nudges && typeof AQ.State.nudges === 'object' ? AQ.State.nudges : { bags: {} });

  N.on = () => cfg().enabled && (!AQ.Tips || AQ.Tips.hintsOn());
  // the moments that count: playing in the sea, nothing else going on
  function active(game) {
    if (game.state !== 'play' || game.scene !== 'world') return false;
    if (AQ.Transition && AQ.Transition.active) return false;
    if (AQ.Dive && (AQ.Dive.prompt || AQ.Dive.active())) return false;    // the guided dive teaches on its own
    if (AQ.Touch && AQ.Touch.menuOpen) return false;
    if (AQ.Redo && AQ.Redo.dialog) return false;
    return true;
  }
  // somewhere quiet to show one: no tip, no toast on screen
  const quiet = () => !(AQ.Tips && AQ.Tips.showing()) && !(AQ.HUD.toasts && AQ.HUD.toasts.length);

  // ---------------------------------------------------------------- what the game tells us
  N.swing = function () { if (active(AQ.Game)) N.swings.push(N.t); };
  N.caught = function () {
    N.lastCatch = N.t; N.dry = 0; N.swings.length = 0; N.clicks.length = 0;
    if (N.cur && N.cur.type !== 'mash') N.cur = null;                    // (a catch: the moment has passed)
  };

  // keys that do something in the sea: everything else pressed there "does nothing"
  function usefulKeys() {
    const T = AQ.TUNING, K = AQ.Keys, out = new Set();
    ['left', 'right', 'up', 'down', 'jump', 'sneak', 'bait', 'log', 'map', 'help', 'pause', 'guide', 'mute'].forEach((a) => K.list(a).forEach((c) => out.add(c)));
    const d = T.debug;
    if (d.timeSkip) out.add(d.timeSkipKey);
    if (d.starKeys) { out.add(d.fallStarKey); out.add(d.showerKey); }
    if (d.tutorialReset) out.add(d.tutorialResetKey);
    if (d.tabOpensAquarium) out.add('Tab');
    if (d.nudges) out.add(d.nudgeKey);
    return out;
  }
  const IGNORE = /^(Shift|Control|Alt|Meta|CapsLock|F\d+|Escape)/;

  // ---------------------------------------------------------------- update (play state, after the tip / dive / log button had the mouse)
  N.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, c = cfg();
    N.t += dt;
    // TESTING ONLY: a key that shows a nudge right now, cycling through the three kinds
    if (AQ.TUNING.debug.nudgeKey && AQ.TUNING.debug.nudges && I.wasPressed(AQ.TUNING.debug.nudgeKey) && game.state === 'play') {
      show(TYPES[N.debugNext++ % TYPES.length], true);
    }
    if (N.cur) updateCur(dt, game);
    if (!N.on() || !active(game)) return;
    const codes = I.pressedCodes(), anyInput = codes.length || m.pressed[0] || m.pressed[2] || I.axis().x || I.axis().y || m.down[0];
    if (anyInput) N.lastInput = N.t;
    // the drought clock only runs while you're really playing (not while you're away from the keys)
    if (N.t - N.lastInput < c.drought.idleGrace) N.dry += dt;
    // fast clicking (left button presses in the sea)
    if (m.pressed[0]) N.clicks.push(N.t);
    // keys that do nothing here
    const useful = usefulKeys();
    codes.forEach((code) => { if (useful.has(code) || IGNORE.test(code)) return; (N.keys[code] = N.keys[code] || []).push(N.t); });
    trim();
    if (N.cur) return;
    // what's going on?
    const s = c.spam, k = c.mash, tooFast = N.clicks.length >= Math.ceil(s.fastClicks * s.fastSeconds) && N.clicks[0] >= N.t - s.fastSeconds;
    if (N.swings.length >= s.swings || tooFast) { if (show('spam')) { N.swings.length = 0; N.clicks.length = 0; } return; }
    for (const code in N.keys) if (N.keys[code].length >= k.presses) { if (show('mash', false, code)) N.keys = {}; return; }
    const caughtAny = Object.keys(AQ.State.collection || {}).length > 0;
    if (N.dry >= (caughtAny ? c.drought.seconds : c.drought.newGameSeconds)) { if (show('drought')) N.dry = 0; }
  };
  function trim() {
    const c = cfg(), cutS = N.t - c.spam.seconds, cutF = N.t - c.spam.fastSeconds, cutK = N.t - c.mash.seconds;
    while (N.swings.length && N.swings[0] < cutS) N.swings.shift();
    while (N.clicks.length && N.clicks[0] < cutF) N.clicks.shift();
    for (const code in N.keys) { const a = N.keys[code]; while (a.length && a[0] < cutK) a.shift(); if (!a.length) delete N.keys[code]; }
    while (N.shown.length && N.shown[0] < N.t - c.windowSeconds) N.shown.shift();
  }
  // may one show now? (rate limits; the testing key skips them)
  function allowed() {
    const c = cfg();
    if (N.t - N.lastShown < c.minGap) return false;
    if (N.shown.length >= c.maxPerWindow) return false;
    if (N.t - N.lastCatch < c.afterCatch) return false;
    return quiet();
  }
  // the next line of a type, from its shuffled bag (saved, so a reload doesn't start the bag over)
  function nextLine(type) {
    const n = (AQ.data.tutorial.nudges || {})[type] || 0, bags = store().bags = store().bags || {};
    let bag = Array.isArray(bags[type]) ? bags[type].filter((x) => x >= 1 && x <= n) : [];
    if (!bag.length) { bag = Array.from({ length: n }, (_, i) => i + 1); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    const pick = bag.shift(); bags[type] = bag;
    AQ.Save && AQ.Save.dirty();
    return pick;
  }
  function show(type, force, code) {
    if (!force && !allowed()) return false;
    const line = nextLine(type);
    if (!line) return false;
    N.cur = { type, key: `nudge.${type}.${line}`, t: 0, life: cfg().showSeconds, code, button: type === 'drought' && cfg().droughtRedoButton && !!AQ.Redo };
    N.lastShown = N.t; N.shown.push(N.t);
    AQ.Audio.play('tip_new');
    return true;
  }
  N.show = (type) => show(type, true);              // (the tests and the testing key)

  // it goes after a few seconds, or once you do something else (not the thing it's about)
  function updateCur(dt, game) {
    const cur = N.cur, I = AQ.Input, m = I.mouse;
    cur.t += dt;
    if (cur.t >= cur.life || game.state !== 'play' || game.scene !== 'world' || (AQ.Transition && AQ.Transition.active)) { N.cur = null; N.rect = null; return; }
    // the REDO TUTORIAL button (drought only): its click is used up
    const b = N.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    N.hover = b || null;
    if (m.pressed[0] && b) { m.pressed[0] = false; N.cur = null; N.rect = null; AQ.Redo.ask(game, 'nudge'); return; }
    if (m.pressed[0] && N.rect && m.x >= N.rect.x && m.y >= N.rect.y && m.x < N.rect.x + N.rect.w && m.y < N.rect.y + N.rect.h) { m.pressed[0] = false; N.cur = null; N.rect = null; return; }   // a click on the box closes it
    if (cur.t < cfg().dismissGrace) return;
    const codes = I.pressedCodes().filter((c) => c !== cur.code);
    const other = codes.length || (m.pressed[0] && cur.type !== 'spam') || m.pressed[2];
    if (other) { N.cur = null; N.rect = null; }
  }

  // ---------------------------------------------------------------- drawing (the tip-box look, top centre)
  const F = () => AQ.Font;
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && F().width(t) > px) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  N.draw = function (g, game) {
    const cur = N.cur;
    N.ui = [];
    if (!cur || game.state !== 'play' || game.scene !== 'world') { N.rect = null; return; }
    const maxW = AQ.TUNING.tips.maxWidth, lines = wrapPx(AQ.t(cur.key).toUpperCase(), maxW - 34);
    const bw = cur.button ? Math.max(64, F().width(AQ.t('redo.btn')) + 8) : 0;
    const w = Math.min(maxW, Math.max(...lines.map((l) => F().width(l)), bw) + 34), h = Math.max(lines.length * 7 + 8, 20) + (cur.button ? 13 : 0);
    const x = Math.round(160 - w / 2), y = 16;
    N.rect = { x, y, w, h };
    const a = U.clamp(Math.min(cur.t * 6, (cur.life - cur.t) * 2), 0, 1);
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(6,18,34,0.94)'; g.fillRect(x, y, w, h);
    g.fillStyle = COLOR[cur.type]; g.fillRect(x, y, w, 1);
    g.fillStyle = 'rgba(255,233,168,0.25)'; g.fillRect(x, y + h - 1, w, 1);
    icon(g, ICON[cur.type], x + 10, y + Math.min(h, 20) / 2 + (cur.button ? 0 : 0));
    lines.forEach((l, i) => F().draw(g, l, x + 20, y + 4 + i * 7, i === 0 ? '#fff6dc' : '#d8eef8', { shadow: false }));
    if (cur.button) {
      const r = { id: 'redo', x: x + 20, y: y + h - 12, w: bw, h: 9, label: AQ.t('redo.btn') };
      N.ui.push(r);
      AQ.Aquarium.button(g, r, N.hover === r);
    }
    g.restore();
  };
  function icon(g, ic, cx, cy) {
    if (/^ui:/.test(ic)) { AQ.Assets.draw(g, 'ui.icons', 'idle', cx, cy, { frame: +ic.slice(3) }); return; }
    const e = AQ.Assets.entry(ic); if (!e) return;
    const sc = Math.min(1, 12 / Math.max(e.fw, e.fh));
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    AQ.Assets.draw(g, ic, 'idle', 0, e.anchor[1] === e.fh - 1 ? e.fh / 2 : 0, { t: AQ.Render.t });
    g.restore();
  }
  N.showing = () => !!N.cur;
  N.overlaps = function (x, y, w, h) { const r = N.rect; return !!r && x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y; };
  return N;
})();
