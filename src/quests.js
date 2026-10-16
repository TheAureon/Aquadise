// STATION REQUESTS: AQ.Quests. The station's directory console (STATION, a little friendly voice) sends short,
// gentle requests by radio, one at a time, wherever you are. There are NO rewards: nothing is given, nothing
// changes, nothing is lost by ignoring one. No timers, no failure, no expiry. The requests are data
// (data/quests.js), their words are quest.* in data/lang/en.js.
//
// Progress is read from the badge system (src/achievements.js): the same counters, checks and events, so
// nothing is counted twice. AQ.Badges.event(...) passes each moment on here; a counter changing pokes a
// re-check. The current request is checked a couple of times a second, wherever you are.
//
// The OFF switch: SETTINGS > OPTIONS > REQUESTS, or TURN OFF REQUESTS in the tracker's "..." menu (asks
// once). When off, nothing about requests is drawn, played, announced or counted; progress stays in the
// save, and turning them back on resumes where it was (anything already done meanwhile is marked done
// quietly). AQ.TUNING.quests.enabled = false switches the whole feature off for everyone.
//
// When it starts: after the first catch (or once the guided dive is over or skipped), at a calm moment,
// the game asks once ("Want them?" YES / NO THANKS). Older saves get the same question, and any request
// their progress already shows is marked done quietly (no celebration).
//
// Saved in AQ.State.quests: { v, asked, on, done: { id: date }, cur, skips: { id: n }, seq, collapsed }.
// Testing: AQ.TUNING.debug.quests (keys in config.js): complete / skip the current request, reset all,
// and an overlay with the current request's condition and counters.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Quests = (function () {
  const Q = { ui: [], asking: false, wait: 0, calmT: 0, checkT: 0, intro: 0, thanks: [], blink: 0, menu: false, confirm: false, overlay: false, rect: null };
  const cfg = () => AQ.TUNING.quests;
  const dbg = () => AQ.TUNING.debug;
  const F = () => AQ.Font;
  const list = () => AQ.data.quests || [];
  const fresh = () => ({ v: 1, asked: false, on: null, done: {}, cur: null, skips: {}, seq: 0, collapsed: false });
  const st = () => {
    const s = AQ.State.quests && typeof AQ.State.quests === 'object' ? AQ.State.quests : (AQ.State.quests = fresh());
    if (!s.done || typeof s.done !== 'object') s.done = {};
    if (!s.skips || typeof s.skips !== 'object') s.skips = {};
    return s;
  };
  const dirty = () => { if (AQ.Save) AQ.Save.dirty(); };
  Q.byId = (id) => list().find((q) => q.id === id) || null;

  // ---------------------------------------------------------------- on / off
  Q.enabled = () => cfg().enabled !== false;                         // the whole feature (config.js)
  Q.on = () => Q.enabled() && st().on === true;                      // the player's choice
  Q.setOn = function (on) {
    const s = st();
    s.on = !!on; s.asked = true; Q.asking = false; Q.menu = false; Q.confirm = false;
    if (on) { catchUp(); Q.wait = cfg().firstDelay; }
    else { Q.intro = 0; Q.thanks.length = 0; Q.blink = 0; }          // (nothing about them shows while off)
    dirty();
  };

  // ---------------------------------------------------------------- conditions (the badge system's)
  const available = (q) => !q.needs || !!AQ[q.needs];
  function valueOf(cond) {
    const B = AQ.Badges;
    if (!B || !cond) return 0;
    if (cond.counter) return B.counter(cond.counter);
    if (cond.check) { const c = B.CHECKS[cond.check]; return c ? c.value(cond) : 0; }
    return 0;
  }
  const targetOf = (q) => (q.target == null ? 1 : q.target);
  const holds = (cond, target) => !!cond && (cond.counter || cond.check) && valueOf(cond) >= (target == null ? 1 : target);
  // { n, target } for the tracker's count (null for a moment: it either happens or not)
  Q.progress = function (q) {
    if (!q || q.cond.event) return null;
    const t = targetOf(q);
    return t > 1 ? { n: Math.min(t, valueOf(q.cond)), target: t } : null;
  };
  // already true (a counter / check reached, or the `also` check that shows the moment happened)
  Q.satisfied = (q) => holds(q.cond, targetOf(q)) || (q.cond.also ? holds(q.cond.also, q.cond.also.target) : false);
  Q.done = (id) => !!st().done[id];
  const ready = (q) => available(q) && !Q.done(q.id) && (!q.after || Q.done(q.after) || !available(Q.byId(q.after) || {})) && (!q.requires || holds(q.requires, q.requires.target));
  // the next one in line: data order, a skipped one goes to the back
  function nextReady() {
    const s = st();
    return list().map((q, i) => ({ q, i })).filter((x) => ready(x.q) && x.q.id !== s.cur)
      .sort((a, b) => ((s.skips[a.q.id] || 0) - (s.skips[b.q.id] || 0)) || (a.i - b.i))
      .map((x) => x.q)[0] || null;
  }
  // everything the save already shows is done, quietly (no celebration, nothing stacks up)
  function catchUp() {
    const s = st();
    let changed = true, n = 0;
    while (changed) {
      changed = false;
      for (const q of list()) if (available(q) && !Q.done(q.id) && Q.satisfied(q)) { s.done[q.id] = new Date().toISOString(); changed = true; n++; if (s.cur === q.id) s.cur = null; }
    }
    if (n) dirty();
    return n;
  }
  Q.catchUp = catchUp;
  Q.count = () => { const a = list().filter(available); return { done: a.filter((q) => Q.done(q.id)).length, total: a.length }; };
  Q.current = () => (Q.on() && st().cur ? Q.byId(st().cur) : null);

  // ---------------------------------------------------------------- what happens
  // a moment from the badge system (catch, log, ufo...): only the current request listens for it
  Q.event = function (name, data) {
    if (name === 'catch') Q.caught = true;                           // (the one-time question waits for a first catch)
    const q = Q.current();
    if (!q || q.cond.event !== name) return;
    const m = q.cond.match || {};
    if (Object.keys(m).some((k) => (data || {})[k] !== m[k])) return;
    complete(q);
  };
  Q.poke = () => { Q.checkT = 0; };                                  // a counter changed: check again now
  function complete(q, quiet) {
    const s = st();
    if (Q.done(q.id)) return;
    s.done[q.id] = new Date().toISOString();
    if (s.cur === q.id) s.cur = null;
    delete s.skips[q.id];
    Q.intro = 0; Q.menu = false;
    Q.wait = cfg().arriveDelay;
    dirty();
    if (quiet) return;
    // the thank-you (shown on the tracker as soon as it can be seen; at most 2 wait, extras merge)
    if (Q.thanks.length >= 2) { const last = Q.thanks[Q.thanks.length - 1]; last.merged = (last.merged || 1) + 1; }
    else Q.thanks.push({ id: q.id, t: 0 });
    if (Q.count().done >= Q.count().total) Q.allDone = true;
  }
  Q.complete = complete;
  // a new request arrives (when it can be seen)
  function arrive() {
    const q = nextReady();
    if (!q) return false;
    st().cur = q.id;
    Q.intro = cfg().introSeconds; Q.blink = cfg().blinkSeconds;
    st().collapsed = false;
    AQ.Audio.play('tip_new');
    if (AQ.Tips) AQ.Tips.event('request');
    dirty();
    return true;
  }
  Q.skip = function () {
    const s = st(), q = Q.current();
    if (!q) return;
    s.seq = (s.seq || 0) + 1; s.skips[q.id] = s.seq;                 // to the back of the line, no penalty
    s.cur = null; Q.intro = 0; Q.menu = false;
    Q.wait = cfg().skipDelay;
    dirty();
  };

  // ---------------------------------------------------------------- where it can show
  // the tracker: playing (sea, hill, station), nothing in the way
  function visible(game) {
    if (!Q.on() || !game || game.state !== 'play') return false;
    if (AQ.Transition && AQ.Transition.active) return false;
    if (AQ.Dive && (AQ.Dive.active() || AQ.Dive.prompt)) return false;   // (the guided dive has the left side)
    if (AQ.Redo && AQ.Redo.dialog) return false;
    return true;
  }
  Q.visible = visible;
  // a calm moment for the one-time question: playing, nothing else up, not mid-catch
  function calm(game) {
    if (!game || game.state !== 'play' || (AQ.Transition && AQ.Transition.active)) return false;
    if (AQ.Dive && (AQ.Dive.active() || AQ.Dive.prompt)) return false;
    if ((AQ.Tips && AQ.Tips.showing()) || (AQ.Nudges && AQ.Nudges.showing()) || (AQ.Redo && AQ.Redo.dialog) || (AQ.Touch && AQ.Touch.menuOpen)) return false;
    const K = AQ.Catching;
    if (K && (K.swing || K.pryTarget || K.hold > 0)) return false;
    return true;
  }
  const readyToAsk = () => Q.caught || Object.keys(AQ.State.collection || {}).length > 0 || !!((AQ.State.tutorial || {}).diveAsked && !(AQ.Dive && (AQ.Dive.active() || AQ.Dive.prompt)));

  // ---------------------------------------------------------------- every frame (any screen)
  Q.tick = function (dt, game) {
    debugKeys(game);
    if (game && game.state !== 'play') { Q.ui = []; Q.rect = null; Q.promptRect = null; }   // (its buttons only exist while playing)
    if (!Q.enabled() || !game || game.state === 'title' || game.state === 'loading') return;
    const s = st();
    // the one-time question
    if (!s.asked && !Q.asking) {
      if (readyToAsk() && calm(game)) { Q.calmT += dt; if (Q.calmT >= cfg().askDelay) { Q.asking = true; AQ.Audio.play('tip_new'); } }
      else Q.calmT = 0;
    }
    if (!Q.on()) return;
    // the current request: checked a couple of times a second (and right after a counter changes)
    Q.checkT -= dt;
    if (Q.checkT <= 0) {
      Q.checkT = cfg().checkSeconds;
      const q = Q.current();
      if (q && !available(q)) s.cur = null;
      else if (q && Q.satisfied(q)) complete(q);
    }
    const vis = visible(game);
    for (const th of Q.thanks.slice(0, 1)) if (vis) th.t += dt;     // (the thank-you waits until it can be seen)
    if (Q.thanks.length && Q.thanks[0].t >= cfg().thanksSeconds) Q.thanks.shift();
    if (vis) { Q.intro = Math.max(0, Q.intro - dt); Q.blink = Math.max(0, Q.blink - dt); }
    // the next request: after a pause, when it can be seen (and after any thank-you)
    if (!s.cur) {
      Q.wait -= dt;
      if (Q.wait <= 0 && vis && !Q.thanks.length) { catchUp(); if (!arrive()) Q.wait = cfg().recheckSeconds; }
    }
  };

  // ---------------------------------------------------------------- layout (game px)
  const X = 4, MENU_W = 96;
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const w of String(text).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && F().width(t) > px) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  const vars = (q) => { const p = Q.progress(q) || { n: 0, target: targetOf(q) }; return { station: AQ.t('quest.station'), n: p.n, target: p.target, min: cfg().fillMin }; };
  const say = (key, q) => AQ.Keys.fill(AQ.t(key, vars(q))).toUpperCase();
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // what the tracker shows right now: the thank-you, the new request's radio message, or the request
  function mode() {
    if (Q.thanks.length) return 'thanks';
    if (!Q.current()) return null;
    if (Q.intro > 0) return 'intro';
    return st().collapsed ? 'icon' : 'track';
  }
  Q.layout = function (game) {
    Q.ui = []; Q.rect = null; Q.lines = null; Q.mode = null;
    if (Q.asking) {
      const w = 236, h = 46, x = 160 - w / 2, y = 18;
      Q.promptRect = { x, y, w, h };
      Q.ui.push({ id: 'yes', x: x + 40, y: y + h - 15, w: 64, h: 11, label: AQ.t('quest.ask.yes') });
      Q.ui.push({ id: 'no', x: x + w - 104, y: y + h - 15, w: 64, h: 11, label: AQ.t('quest.ask.no') });
      return;
    }
    Q.promptRect = null;
    if (!visible(game)) return;
    if (Q.confirm) {
      const w = 200, h = 40, x = 160 - w / 2, y = 22;
      Q.promptRect = { x, y, w, h };
      Q.ui.push({ id: 'offyes', x: x + 22, y: y + h - 15, w: 60, h: 11, label: AQ.t('quest.off.yes'), warn: true });
      Q.ui.push({ id: 'offno', x: x + w - 82, y: y + h - 15, w: 60, h: 11, label: AQ.t('ui.cancel') });
      return;
    }
    let md = mode();
    if (!md) return;
    // a world prompt ("OPEN THE KELP TANK") over the tracker's spot: the tracker folds to its icon meanwhile
    const pa = AQ.Scenes && AQ.Scenes.promptAt;
    if (md === 'track' && pa && pa.rect && AQ.Render.t - pa.t < 0.25 && overlaps(pa.rect, { x: X, y: cfg().trackerY, w: cfg().trackerW, h: 30 })) md = 'icon';
    Q.mode = md;
    const c = cfg();
    let w, lines;
    if (md === 'icon') { w = 14; lines = []; }
    else if (md === 'thanks') {
      const th = Q.thanks[0], q = Q.byId(th.id);
      w = c.messageW; lines = wrapPx(th.merged ? AQ.t('quest.manyDone', { n: th.merged }).toUpperCase() : say(`quest.${q.id}.thanks`, q), w - 24).slice(0, 4);
    } else if (md === 'intro') { const q = Q.current(); w = c.messageW; lines = wrapPx(say(`quest.${q.id}.intro`, q), w - 24).slice(0, 5); }
    else { const q = Q.current(); w = c.trackerW; lines = wrapPx(say(`quest.${q.id}`, q), w - 44).slice(0, 2); }
    const prog = md === 'track' ? Q.progress(Q.current()) : null;
    const h = md === 'icon' ? 14 : Math.max(16, (md === 'track' ? 4 : 11) + lines.length * 7 + (prog ? 7 : 0) + 3);
    let y = c.trackerY;
    const r = { x: X, y, w, h };
    // never under the tip box, a nudge or the guided dive's panel: below them instead
    for (const o of [AQ.Tips && AQ.Tips.rect, AQ.Nudges && AQ.Nudges.rect, AQ.Dive && AQ.Dive.panelRect]) if (o && overlaps(r, o)) r.y = Math.max(r.y, o.y + o.h + 3);
    Q.rect = r; Q.lines = lines; Q.prog = prog;
    Q.ui.push({ id: md === 'icon' ? 'expand' : md === 'track' ? 'collapse' : md === 'intro' ? 'introok' : 'thanksok', x: r.x, y: r.y, w: r.w - (md === 'track' || md === 'intro' ? 13 : 0), h: r.h, body: true });
    if (md === 'track' || md === 'intro') Q.ui.push({ id: 'menu', x: r.x + r.w - 13, y: r.y, w: 13, h: 10, label: '...' });
    if (Q.menu && (md === 'track' || md === 'intro')) {
      Q.ui.push({ id: 'skip', x: r.x + r.w - MENU_W, y: r.y + r.h + 2, w: MENU_W, h: 11, label: AQ.t('quest.menu.skip') });
      Q.ui.push({ id: 'off', x: r.x + r.w - MENU_W, y: r.y + r.h + 14, w: MENU_W, h: 11, label: AQ.t('quest.menu.off') });
    }
  };
  // the screen spots the requests use right now (the touch joystick never takes a touch there)
  Q.rects = () => [Q.rect, Q.promptRect].concat(Q.ui.filter((u) => !u.body)).filter(Boolean);

  // ---------------------------------------------------------------- input (play; before the scene, so a click here never swings the net)
  Q.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    Q.layout(game);
    if (!Q.ui.length) { Q.hover = null; return; }
    const hit = Q.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h) || null;
    Q.hover = hit;
    const click = m.pressed[0] && hit;
    if (Q.asking) {
      if ((click && hit.id === 'yes') || I.rawPressed('Enter')) { I.consume('Enter'); m.pressed[0] = false; AQ.Audio.play('menu_select'); Q.setOn(true); return; }
      if ((click && hit.id === 'no') || I.rawPressed('Escape')) { I.consume('Escape'); m.pressed[0] = false; AQ.Audio.play('menu_select'); Q.setOn(false); return; }
      if (m.pressed[0] && inside(Q.promptRect, m)) m.pressed[0] = false;
      return;
    }
    if (Q.confirm) {
      if ((click && hit.id === 'offyes')) { m.pressed[0] = false; AQ.Audio.play('menu_select'); Q.setOn(false); return; }
      if ((click && hit.id === 'offno') || I.rawPressed('Escape')) { I.consume('Escape'); m.pressed[0] = false; AQ.Audio.play('menu_move'); Q.confirm = false; return; }
      if (m.pressed[0] && inside(Q.promptRect, m)) m.pressed[0] = false;
      return;
    }
    if (Q.menu && I.rawPressed('Escape')) { I.consume('Escape'); Q.menu = false; return; }
    if (!m.pressed[0]) return;
    if (!hit) { if (Q.menu) { Q.menu = false; m.pressed[0] = false; } return; }   // a tap elsewhere just closes the menu
    m.pressed[0] = false;
    const s = st();
    if (hit.id === 'menu') { Q.menu = !Q.menu; AQ.Audio.play('menu_move'); }
    else if (hit.id === 'skip') { AQ.Audio.play('menu_select'); Q.skip(); }
    else if (hit.id === 'off') { AQ.Audio.play('menu_select'); Q.menu = false; Q.confirm = true; }
    else if (hit.id === 'collapse') { s.collapsed = true; Q.menu = false; AQ.Audio.play('menu_move'); dirty(); }
    else if (hit.id === 'expand') { s.collapsed = false; AQ.Audio.play('menu_move'); dirty(); }
    else if (hit.id === 'introok') { Q.intro = 0; AQ.Audio.play('menu_move'); }
    else if (hit.id === 'thanksok') { Q.thanks.shift(); AQ.Audio.play('menu_move'); }
  };
  const inside = (r, m) => !!r && m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;

  // ---------------------------------------------------------------- drawing
  function panel(g, r, edge) {
    g.fillStyle = 'rgba(6,18,34,0.92)'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = edge; g.fillRect(r.x, r.y, r.w, 1);
    g.fillStyle = 'rgba(110,240,239,0.18)'; g.fillRect(r.x, r.y + r.h - 1, r.w, 1);
  }
  function radio(g, cx, cy) {
    const on = Q.blink > 0 && (AQ.U.calm() || Math.floor(performance.now() / 250) % 2 === 0);
    if (AQ.Assets && AQ.Assets.entry('ui.radio')) AQ.Assets.draw(g, 'ui.radio', 'idle', cx, cy, { frame: on ? 1 : 0 });
  }
  function prompt(g, title, lines) {
    const r = Q.promptRect;
    panel(g, r, '#6ef0ef');
    radio(g, r.x + 9, r.y + 8);
    F().draw(g, title, 160, r.y + 4, '#fff6dc', { align: 'center', shadow: false, max: r.w - 30 });
    lines.forEach((l, i) => F().draw(g, l.toUpperCase(), 160, r.y + 12 + i * 7, '#9fd3ee', { align: 'center', shadow: false, max: r.w - 8 }));
    for (const b of Q.ui) if (!b.body) AQ.Aquarium.button(g, b, Q.hover === b);   // (YES and NO THANKS look the same)
  }
  Q.draw = function (g, game) {
    if (!Q.enabled()) return;
    if (Q.asking && Q.promptRect && game.state === 'play') {
      prompt(g, AQ.t('quest.ask.title'), [AQ.t('quest.ask.1', { station: AQ.t('quest.station') }), AQ.t('quest.ask.2')]);
      return;
    }
    if (!Q.on() || !visible(game)) return;
    Q.layout(game);                                                   // (what's shown may have changed since the last update)
    if (Q.confirm && Q.promptRect) { prompt(g, AQ.t('quest.off.title'), [AQ.t('quest.off.1')]); return; }
    const r = Q.rect, md = Q.mode, q = Q.current();
    if (!r || (!q && md !== 'thanks')) return;
    if (md === 'icon') {
      panel(g, r, '#6ef0ef');
      radio(g, r.x + 7, r.y + 7);
      if (Q.hover && Q.hover.id === 'expand') { g.fillStyle = 'rgba(110,240,239,0.15)'; g.fillRect(r.x, r.y, r.w, r.h); }
      return;
    }
    panel(g, r, md === 'thanks' ? '#7ef0c0' : '#6ef0ef');
    if (md === 'thanks') {
      // a little green tick (Stage 2 adds the celebration)
      const tx = r.x + 6, ty = r.y + 6;
      g.fillStyle = '#7ef0c0'; g.fillRect(tx, ty + 3, 2, 2); g.fillRect(tx + 2, ty + 5, 2, 2); g.fillRect(tx + 4, ty + 3, 2, 2); g.fillRect(tx + 6, ty + 1, 2, 2); g.fillRect(tx + 8, ty - 1, 2, 2);
      F().draw(g, AQ.t('quest.thanksTitle'), r.x + 18, r.y + 3, '#7ef0c0', { shadow: false, max: r.w - 22 });
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 18, r.y + 11 + i * 7, '#e8fbff', { shadow: false }));
      return;
    }
    radio(g, r.x + 8, r.y + 8);
    if (md === 'intro') {
      F().draw(g, AQ.t('quest.from', { station: AQ.t('quest.station') }), r.x + 18, r.y + 3, '#ffe9a8', { shadow: false, max: r.w - 34 });
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 18, r.y + 11 + i * 7, '#e8fbff', { shadow: false }));
    } else {
      if (AQ.Badges && q) AQ.Badges.drawIcon(g, { id: q.id, icon: q.icon, group: 'first' }, r.x + r.w - 20, r.y + 8, true);
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 18, r.y + 4 + i * 7, '#e8fbff', { shadow: false, max: r.w - 44 }));
      if (Q.prog) F().draw(g, AQ.t(AQ.Lang.has(`quest.${q.id}.progress`, 'en') ? `quest.${q.id}.progress` : 'quest.progress', { n: Q.prog.n, target: Q.prog.target }), r.x + 18, r.y + 4 + Q.lines.length * 7, '#ffe9a8', { shadow: false, max: r.w - 44 });
    }
    // the "..." button and its little menu
    const mb = Q.ui.find((u) => u.id === 'menu');
    if (mb) { g.fillStyle = Q.menu || Q.hover === mb ? 'rgba(110,240,239,0.3)' : 'rgba(110,240,239,0.1)'; g.fillRect(mb.x, mb.y + 1, mb.w, mb.h - 1); F().draw(g, '...', mb.x + mb.w / 2, mb.y + 2, '#cfe8ff', { align: 'center', shadow: false }); }
    for (const b of Q.ui) if (b.id === 'skip' || b.id === 'off') AQ.Aquarium.button(g, b, Q.hover === b);
  };

  // ---------------------------------------------------------------- loading
  // a game loads (Save.apply): an older save (no requests yet) gets the one-time question later and
  // marks done, quietly, whatever it has already done once requests are on
  Q.loaded = function () {
    const s = st();
    Q.asking = false; Q.menu = false; Q.confirm = false; Q.intro = 0; Q.thanks.length = 0; Q.caught = false; Q.calmT = 0;
    if (Q.on()) { catchUp(); Q.wait = cfg().firstDelay; }
    if (s.cur && (!Q.byId(s.cur) || Q.done(s.cur))) s.cur = null;
  };
  Q.newGame = function () {
    const keep = AQ.State.quests && AQ.State.quests.asked ? { asked: true, on: AQ.State.quests.on } : {};   // (the answer carries over, like settings)
    AQ.State.quests = Object.assign(fresh(), keep);
    Q.loaded();
  };

  // ---------------------------------------------------------------- testing (AQ.TUNING.debug.quests)
  function debugKeys(game) {
    const d = dbg();
    if (!d.quests) return;
    const I = AQ.Input;
    if (I.wasPressed(d.questCompleteKey)) { const q = Q.current(); if (q) complete(q); else if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.questNone'), '#cfe8ff'); }
    if (I.wasPressed(d.questSkipKey)) Q.skip();
    if (I.wasPressed(d.questResetKey)) { AQ.State.quests = Object.assign(fresh(), { asked: true, on: true }); Q.loaded(); Q.wait = 1; if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.questReset'), '#cfe8ff'); }
    if (I.wasPressed(d.questOverlayKey)) Q.overlay = !Q.overlay;
  }
  Q.drawOverlay = function (g) {
    if (!Q.overlay || !dbg().quests) return;
    const s = st(), q = s.cur ? Q.byId(s.cur) : null, n = Q.count(), rows = [];
    rows.push(`REQUESTS ${n.done}/${n.total}  ${Q.enabled() ? (s.on === true ? 'ON' : s.on === false ? 'OFF' : 'NOT ASKED') : 'DISABLED'}`);
    rows.push(q ? `NOW: ${q.id} (${q.chapter})` : `NOW: NONE  NEXT IN ${Math.max(0, Q.wait).toFixed(1)}S`);
    if (q) {
      const c = q.cond;
      rows.push(c.event ? `EVENT ${c.event}${c.match ? ' ' + JSON.stringify(c.match) : ''}` : `${c.counter ? 'COUNTER ' + c.counter : 'CHECK ' + c.check}: ${valueOf(c)}/${targetOf(q)}`);
      if (c.also) rows.push(`ALSO ${c.also.counter || c.also.check}${c.also.badge ? ' ' + c.also.badge : ''}: ${valueOf(c.also)}/${c.also.target || 1}`);
      rows.push(`SATISFIED: ${Q.satisfied(q) ? 'YES' : 'NO'}`);
    }
    const nx = nextReady();
    rows.push(`THEN: ${nx ? nx.id : '-'}`);
    g.fillStyle = 'rgba(4,10,20,0.82)'; g.fillRect(150, 140, 168, rows.length * 6 + 4);
    rows.forEach((r, i) => F().draw(g, r.toUpperCase().replace(/_/g, '-'), 153, 142 + i * 6, i ? '#9ff3ff' : '#ffe36b', { shadow: false, max: 162 }));
  };
  return Q;
})();
