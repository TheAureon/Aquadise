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
// THE CELEBRATION (Stage 2): a count going up pops on the tracker (a spark flies to it, a soft tick);
// a request done gets a short celebration (the tracker pops and ticks, confetti, the "REQUEST COMPLETE!"
// banner with its thank-you and the running "REQUESTS 12/40" bar, a rising chime, a light buzz, a soft
// glow at the screen edges); a streak (requests close together) makes it a little bigger, up to x5; a
// chapter done gets a bigger one. On the tank screen it's a compact note; anywhere busy (a scene change,
// a menu, photo mode, a tip or a badge toast up) it waits, at most 2, extras merge ("3 requests done!").
// REDUCE FLASHING: a gentle version (no burst, no glow, no blinking; a few slow dim sparkles, a soft
// fade, quieter sounds). Requests OFF: none of it, anywhere.
//
// Saved in AQ.State.quests: { v, asked, on, done: { id: date }, cur, skips: { id: n }, seq, collapsed }.
// Testing: AQ.TUNING.debug.quests (keys in config.js): complete / skip the current request, reset all,
// and an overlay with the current request's condition and counters.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Quests = (function () {
  const Q = { ui: [], asking: false, wait: 0, calmT: 0, checkT: 0, intro: 0, blink: 0, menu: false, confirm: false, overlay: false, rect: null,
    celebs: [], cel: null, freeT: 0, parts: [], sparks: [], bump: null, lastN: {}, streak: 0, lastDoneAt: 0, sparkleTanks: new Set() };
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
    else quiet();                                                     // (nothing about them shows while off)
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
    if (quiet || !Q.on()) return;                                    // (requests off: done, quietly; nothing shows)
    // the celebration (plays as soon as there's room; at most 2 wait, extras merge into the last one)
    const now = Date.now(), c = cfg();
    Q.streak = now - Q.lastDoneAt <= c.streakMinutes * 60000 ? Math.min(c.streakMax, Q.streak + 1) : 1;   // (an old streak just resets)
    Q.lastDoneAt = now;
    const chapterDone = list().filter((x) => x.chapter === q.chapter && available(x)).every((x) => Q.done(x.id));
    const n = Q.count(), cel = { id: q.id, chapter: chapterDone ? q.chapter : null, streak: Q.streak, done: n.done, total: n.total, t: 0 };
    if (Q.celebs.length >= 2) { const last = Q.celebs[Q.celebs.length - 1]; last.merged = (last.merged || 1) + 1; last.done = n.done; last.streak = Q.streak; last.chapter = last.chapter || cel.chapter; }
    else Q.celebs.push(cel);
    // a request about a tank: its window in the station sparkles the next time it's on screen
    if (q.tank) { const id = q.tank === true ? AQ.Aquarium && AQ.Aquarium.biome : q.tank; if (id) Q.sparkleTanks.add(id); }
  }
  // everything request-related that's on screen or waiting goes quiet (requests turned off, a game loaded)
  function quiet() {
    Q.intro = 0; Q.blink = 0; Q.celebs.length = 0; Q.cel = null; Q.parts.length = 0; Q.sparks.length = 0; Q.bump = null; Q.sparkleTanks.clear();
  }
  Q.celebrating = () => !!Q.cel && Q.on();
  // the station asks: does this tank's window have a sparkle waiting? (once: it's used up)
  Q.takeSparkle = function (id) {
    if (!Q.on() || !Q.sparkleTanks.has(id)) return false;
    Q.sparkleTanks.delete(id); return true;
  };
  Q.complete = complete;
  // a new request arrives (when it can be seen)
  function arrive() {
    const q = nextReady();
    if (!q) return false;
    st().cur = q.id;
    Q.intro = cfg().introSeconds; Q.blink = cfg().blinkSeconds;
    st().collapsed = false;
    sound('quest_arrive');
    if (AQ.Station && AQ.Station.blink) AQ.Station.blink();          // (in the station the console blinks for a moment)
    Q.lastN[q.id] = (Q.progress(q) || { n: 0 }).n;
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
    sound('quest_skip');
    dirty();
  };
  // every request sound goes through here: REDUCE FLASHING plays them quieter and a little softer
  function sound(id, opts) {
    const o = Object.assign({}, opts || {});
    if (AQ.U.calm()) { o.vol = (o.vol || 1) * cfg().calmVolume; o.lp = 2400; }
    AQ.Audio.play(id, o);
  }

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
    progressTick(game, vis);
    celebrate(dt, game);
    moveParts(dt);
    if (vis) { Q.intro = Math.max(0, Q.intro - dt); Q.blink = Math.max(0, Q.blink - dt); }
    // the next request: after a pause, when it can be seen (and after any celebration)
    if (!s.cur) {
      Q.wait -= dt;
      if (Q.wait <= 0 && vis && !Q.cel && !Q.celebs.length) { catchUp(); if (!arrive()) Q.wait = cfg().recheckSeconds; }
    }
  };

  // ---------------------------------------------------------------- the juice
  // a count going up (1/3 -> 2/3): the count hops, a soft tick (higher each step), and a spark flies from
  // the diver to it. (The last step is the completion itself.)
  function progressTick(game, vis) {
    const q = Q.current(), p = q && Q.progress(q);
    if (!p) return;
    const was = Q.lastN[q.id];
    Q.lastN[q.id] = p.n;
    if (was == null || p.n <= was || p.n >= p.target || !vis) return;
    Q.bump = { t: 0 };
    sound('quest_tick', { step: p.n });
    if (!AQ.U.calm() && game.player && Q.countAt && game.scene !== undefined) {
      const cam = AQ.Camera;
      Q.sparks.push({ x: game.player.x - cam.left(), y: game.player.y - cam.top(), t: 0 });
    }
  }
  // where a celebration can play right now: 'full' (the sea, the hill, the station), 'note' (the tank
  // screen: its note area), or null (wait: a scene change, a menu, photo mode, a tip or a badge toast up)
  function roomFor(game) {
    if (!Q.on() || !game || (AQ.Transition && AQ.Transition.active) || Q.asking || Q.confirm) return null;
    if ((AQ.Tips && AQ.Tips.showing()) || (AQ.Badges && AQ.Badges.cur)) return null;
    if (game.state === 'play') return visible(game) && !(AQ.Touch && AQ.Touch.menuOpen) ? 'full' : null;
    const A = AQ.Aquarium;
    if (game.state === 'aquarium' && A && A.view !== 'overview' && !A.photo.on && !A.dialog) return 'note';
    return null;
  }
  function celebrate(dt, game) {
    if (Q.cel) {
      Q.cel.t += dt;
      const c = Q.cel;
      // the running count ticks up once the bar starts to fill (one tick per request)
      if (c.room === 'full' && !c.calm && c.shown < c.done && c.t >= 0.62 + (c.shown - c.from) * 0.12) { c.shown++; sound('quest_tick', { step: 6 + (c.shown - c.from) }); }
      if (c.t >= c.life) { Q.cel = null; Q.freeT = 0; }
      return;
    }
    if (!Q.celebs.length) return;
    const room = roomFor(game);
    Q.freeT = room ? Q.freeT + dt : 0;                               // (and a short gap after a toast or a tip)
    if (!room || Q.freeT < cfg().gapSeconds) return;
    start(Q.celebs.shift(), room, game);
  }
  function start(cel, room, game) {
    const c = cfg(), calm = AQ.U.calm(), q = Q.byId(cel.id);
    Object.assign(cel, { room, calm, t: 0, life: calm ? c.calmSeconds : cel.chapter ? c.chapterSeconds : c.celebrateSeconds });
    cel.from = Math.max(0, cel.done - (cel.merged || 1)); cel.shown = calm ? cel.done : cel.from;
    Q.cel = cel;
    if (cel.chapter) sound('quest_chapter'); else sound('quest_done', { streak: cel.streak });
    if (AQ.Touch) AQ.Touch.buzz('quest');                            // (touch controls on, VIBRATION on)
    if (room === 'note') {                                           // the tank screen: a compact version in its note area
      const A = AQ.Aquarium, head = cel.chapter ? AQ.t('quest.chapterDone', { chapter: AQ.t(`quest.chapter.${cel.chapter}`) })
        : cel.merged ? AQ.t('quest.manyDone', { n: cel.merged }) : AQ.t('quest.noteDone', { thanks: say(`quest.${q.id}.thanks`, q) });
      A.note(head, '#7ef0c0', 4);
      A.note(AQ.t('quest.count', { n: cel.done, total: cel.total }), '#ffe9a8', 4);
      cel.life = Math.min(cel.life, 1);
      return;
    }
    if (game.scene === 'station' && AQ.Station && AQ.Station.joy) AQ.Station.joy();   // the console does a little dance
    burst(cel, Q.rect ? Q.rect.x + 10 : 60, Q.rect ? Q.rect.y + 8 : cfg().trackerY + 8, 1);
  }
  // confetti and sparkles in the game's colours (capped); REDUCE FLASHING: a few slow, dim sparkles
  const COLS = ['#7ef0c0', '#ffe36b', '#ff9fc0', '#9fd8ff', '#c9a8ff', '#fff6dc'];
  const R = AQ.U.R;
  function part(o) { const c = cfg(); if (Q.parts.length >= c.maxParticles) return; Q.parts.push(Object.assign({ t: 0 }, o)); }
  function burst(cel, x, y, k) {
    const c = cfg();
    if (cel.calm) { for (let i = 0; i < 5; i++) part({ x: x + R.range(-12, 30), y: y + R.range(-4, 10), vx: R.range(-3, 3), vy: R.range(-6, -2), g: 0, life: R.range(1, 1.4), kind: 's', col: '#fff6dc', dim: true }); return; }
    const big = cel.chapter ? 2 : 1, n = Math.round((c.confetti + (cel.streak - 1) * 5) * big * k), sp = Math.round((c.sparkles + cel.streak * 2) * big * k);
    for (let i = 0; i < n; i++) { const a = R.range(-Math.PI * 0.95, -Math.PI * 0.05), v = R.range(40, 95) * (cel.chapter ? 1.15 : 1); part({ x, y, vx: Math.cos(a) * v + 25, vy: Math.sin(a) * v, g: 120, life: R.range(0.9, 1.5), kind: 'c', col: R.pick(COLS), w: R.chance(0.5) ? 2 : 1 }); }
    for (let i = 0; i < sp; i++) { const a = R.range(0, Math.PI * 2), v = R.range(15, 55); part({ x, y, vx: Math.cos(a) * v + 15, vy: Math.sin(a) * v, g: 0, life: R.range(0.5, 1.0), kind: 's', col: R.pick(COLS), size: cel.streak >= 3 ? 2 : 1 }); }
  }
  function moveParts(dt) {
    for (let i = Q.parts.length - 1; i >= 0; i--) {
      const p = Q.parts[i];
      p.t += dt; p.vy += p.g * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t >= p.life) Q.parts.splice(i, 1);
    }
    for (let i = Q.sparks.length - 1; i >= 0; i--) {
      const s = Q.sparks[i];
      s.t += dt;
      if (s.t >= cfg().tickSpark) { Q.sparks.splice(i, 1); if (Q.countAt) for (let k = 0; k < 3; k++) part({ x: Q.countAt.x, y: Q.countAt.y, vx: R.range(-20, 20), vy: R.range(-20, 10), g: 0, life: 0.4, kind: 's', col: '#ffe9a8' }); }
    }
    if (Q.bump) { Q.bump.t += dt; if (Q.bump.t > 0.35) Q.bump = null; }
    if (Q.cel && Q.cel.chapter && !Q.cel.calm && !Q.cel.second && Q.cel.room === 'full' && Q.cel.t > 0.5) {   // a chapter: a second burst from the banner
      Q.cel.second = true; const c = cfg();
      burst(Q.cel, 160 - c.bannerW / 2 + 8, c.bannerY + 4, 0.6); burst(Q.cel, 160 + c.bannerW / 2 - 8, c.bannerY + 4, 0.6);
    }
  }

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
    if (Q.cel && Q.cel.room === 'full') return 'done';
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
    else if (md === 'done') {
      const cel = Q.cel, q = Q.byId(cel.id);
      w = c.trackerW; lines = wrapPx(cel.merged ? AQ.t('quest.manyDone', { n: cel.merged }).toUpperCase() : say(`quest.${q.id}`, q), w - 24).slice(0, 2);
    } else if (md === 'intro') { const q = Q.current(); w = c.messageW; lines = wrapPx(say(`quest.${q.id}.intro`, q), w - 24).slice(0, 5); }
    else { const q = Q.current(); w = c.trackerW; lines = wrapPx(say(`quest.${q.id}`, q), w - 44).slice(0, 2); }
    const prog = md === 'track' ? Q.progress(Q.current()) : null;
    const h = md === 'icon' ? 14 : Math.max(16, (md === 'track' || md === 'done' ? 4 : 11) + lines.length * 7 + (prog ? 7 : 0) + 3);
    let y = c.trackerY;
    const r = { x: X, y, w, h };
    // never under the tip box, a nudge or the guided dive's panel: below them instead
    for (const o of [AQ.Tips && AQ.Tips.rect, AQ.Nudges && AQ.Nudges.rect, AQ.Dive && AQ.Dive.panelRect]) if (o && overlaps(r, o)) r.y = Math.max(r.y, o.y + o.h + 3);
    Q.rect = r; Q.lines = lines; Q.prog = prog;
    Q.countAt = md === 'icon' ? { x: r.x + 7, y: r.y + 7 } : prog ? { x: r.x + 24, y: r.y + 7 + lines.length * 7 } : null;   // (where a progress spark flies to)
    Q.ui.push({ id: md === 'icon' ? 'expand' : md === 'track' ? 'collapse' : md === 'intro' ? 'introok' : 'doneok', x: r.x, y: r.y, w: r.w - (md === 'track' || md === 'intro' ? 13 : 0), h: r.h, body: true });
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
    else if (hit.id === 'collapse') { s.collapsed = true; Q.menu = false; sound('quest_collapse'); dirty(); }
    else if (hit.id === 'expand') { s.collapsed = false; sound('quest_expand'); dirty(); }
    else if (hit.id === 'introok') { Q.intro = 0; AQ.Audio.play('menu_move'); }
    else if (hit.id === 'doneok' && Q.cel) Q.cel.t = Math.max(Q.cel.t, Q.cel.life - 0.3);   // (a tap hurries it along)
  };
  const inside = (r, m) => !!r && m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;

  // ---------------------------------------------------------------- drawing
  function panel(g, r, edge) {
    AQ.Kit.panel(g, { x: r.x, y: r.y, w: r.w, h: r.h }, { edge: edge });
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
    const cel = Q.cel && Q.cel.room === 'full' ? Q.cel : null, calm = AQ.U.calm();
    if (cel && !cel.calm && cfg().edgeGlow > 0) edgeGlow(g, cel);
    if (r && (q || md === 'done')) drawTracker(g, r, md, q, cel, calm);
    if (cel) banner(g, cel);
    drawParts(g);
  };
  // the tracker (the done one pops and ticks, the count hops, a request one step from done shimmers)
  function drawTracker(g, r, md, q, cel, calm) {
    if (md === 'icon') {
      panel(g, r, '#6ef0ef');
      radio(g, r.x + 7, r.y + 7);
      if (Q.hover && Q.hover.id === 'expand') { g.fillStyle = 'rgba(110,240,239,0.15)'; g.fillRect(r.x, r.y, r.w, r.h); }
      if (Q.bump && !calm) { g.fillStyle = `rgba(255,233,168,${(0.4 * (1 - Q.bump.t / 0.35)).toFixed(2)})`; g.fillRect(r.x, r.y, r.w, r.h); }
      return;
    }
    if (md === 'done') {
      const t = cel.t, e = cel.calm ? 0 : t < 0.4 ? Math.round(Math.sin(t / 0.4 * Math.PI) * 3) : t < 0.55 ? -1 : 0;   // a bouncy pop (overshoot), or none
      const rr = { x: r.x - e, y: r.y - e, w: r.w + e * 2, h: r.h + e * 2 };
      g.save(); if (cel.calm) g.globalAlpha = Math.min(1, t / 0.25);  // (REDUCE FLASHING: a soft fade-in instead)
      panel(g, rr, '#7ef0c0');
      // the checkmark draws itself in
      const TICK = [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]], k = cel.calm ? TICK.length : Math.floor(Math.min(1, Math.max(0, t - 0.1) / 0.3) * TICK.length);
      g.fillStyle = '#7ef0c0';
      for (let i = 0; i < k; i++) g.fillRect(r.x + 3 + TICK[i][0], r.y + 4 + TICK[i][1], 2, 2);
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 14, r.y + 4 + i * 7, '#e8fbff', { shadow: false, max: r.w - 18 }));
      g.restore();
      return;
    }
    panel(g, r, '#6ef0ef');
    // one step from done: a gentle shimmer across the bar (REDUCE FLASHING: a still, faint highlight)
    if (md === 'track' && Q.prog && Q.prog.n === Q.prog.target - 1) {
      if (calm) { g.fillStyle = 'rgba(255,233,168,0.10)'; g.fillRect(r.x, r.y + 1, r.w, 1); }
      else { const sx = r.x + ((AQ.Render.t * 45) % (r.w + 30)) - 15; g.fillStyle = 'rgba(255,240,200,0.10)'; for (let k = 0; k < 6; k++) g.fillRect(Math.round(sx + k - (k > 2 ? 0 : 0)), r.y + 1, 1, r.h - 2); }
    }
    radio(g, r.x + 8, r.y + 8);
    if (md === 'intro') {
      F().draw(g, AQ.t('quest.from', { station: AQ.t('quest.station') }), r.x + 18, r.y + 3, '#ffe9a8', { shadow: false, max: r.w - 34 });
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 18, r.y + 11 + i * 7, '#e8fbff', { shadow: false }));
    } else {
      if (AQ.Badges && q) AQ.Badges.drawIcon(g, { id: q.id, icon: q.icon, group: 'first' }, r.x + r.w - 20, r.y + 8, true);
      Q.lines.forEach((l, i) => F().draw(g, l, r.x + 18, r.y + 4 + i * 7, '#e8fbff', { shadow: false, max: r.w - 44 }));
      if (Q.prog) {
        const b = Q.bump ? Q.bump.t / 0.35 : 1, hop = Q.bump && !calm ? Math.round(Math.sin(Math.min(1, b * 1.4) * Math.PI) * 2) : 0;   // the count hops (REDUCE FLASHING: it just brightens)
        F().draw(g, AQ.t(AQ.Lang.has(`quest.${q.id}.progress`, 'en') ? `quest.${q.id}.progress` : 'quest.progress', { n: Q.prog.n, target: Q.prog.target }), r.x + 18, r.y + 4 + Q.lines.length * 7 - hop, Q.bump ? '#fff6dc' : '#ffe9a8', { shadow: false, max: r.w - 44 });
      }
    }
    // the "..." button and its little menu
    const mb = Q.ui.find((u) => u.id === 'menu');
    if (mb) { g.fillStyle = Q.menu || Q.hover === mb ? 'rgba(110,240,239,0.3)' : 'rgba(110,240,239,0.1)'; g.fillRect(mb.x, mb.y + 1, mb.w, mb.h - 1); F().draw(g, '...', mb.x + mb.w / 2, mb.y + 2, '#cfe8ff', { align: 'center', shadow: false }); }
    for (const b of Q.ui) if (b.id === 'skip' || b.id === 'off') AQ.Aquarium.button(g, b, Q.hover === b);
  }
  // "REQUEST COMPLETE!" (or a chapter's): slides in with a little overshoot (REDUCE FLASHING: fades in),
  // the thank-you line, and the running count "REQUESTS 12/40" with a bar that fills; a streak shows x2...
  // and makes the frame fancier
  const FRAME = ['#7ef0c0', '#7ef0c0', '#9ff3ff', '#ffe36b', '#ff9fc0', '#ffd25a'];
  function banner(g, cel) {
    const c = cfg(), q = Q.byId(cel.id), w = c.bannerW, h = 31, t = cel.t, out = Math.max(0, cel.life - t);
    let x = 160 - w / 2, a = Math.min(1, out / 0.3);
    if (cel.calm) a *= Math.min(1, t / 0.25);
    else { const u = Math.min(1, t / 0.35), back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2); x = Math.round(x - (1 - back) * 200); }   // (ease out with a small overshoot)
    const y = c.bannerY, edge = cel.chapter ? '#ffd25a' : FRAME[Math.min(5, cel.streak)];
    g.save(); g.globalAlpha = a;
    AQ.Kit.panel(g, { x: x, y: y, w: w, h: h }, { edge: edge }); g.fillRect(x, y + h - 1, w, 1);
    if (cel.streak >= 3 || cel.chapter) { g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h); }   // (fancier from x3, and for a chapter)
    if (cel.streak >= 4 || cel.chapter) { g.fillStyle = '#fff6dc'; for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) { g.fillRect(cx - 1, cy, 3, 1); g.fillRect(cx, cy - 1, 1, 3); } }
    const title = cel.chapter ? AQ.t('quest.chapterDone', { chapter: AQ.t(`quest.chapter.${cel.chapter}`) }) : cel.merged ? AQ.t('quest.manyDone', { n: cel.merged }).toUpperCase() : AQ.t('quest.complete');
    const sw = cel.streak >= 2 ? F().width(AQ.t('quest.streak', { n: cel.streak })) + 6 : 0;
    F().draw(g, title, 160 + (x - (160 - w / 2)) - sw / 2, y + 3, edge, { align: 'center', shadow: false, max: w - 12 - sw });
    if (sw) { const sx = x + w - sw - 3; g.fillStyle = edge; g.fillRect(sx, y + 2, sw, 7); F().draw(g, AQ.t('quest.streak', { n: cel.streak }), sx + sw / 2, y + 3, '#061222', { align: 'center', shadow: false }); }
    const line = cel.merged || !q ? '' : say(`quest.${q.id}.thanks`, q);
    if (line) F().draw(g, line, x + w / 2, y + 12, '#e8fbff', { align: 'center', shadow: false, max: w - 10 });
    // the running count and its bar (fills from where it was to where it is now)
    const shown = cel.shown, fill = cel.calm ? 1 : Math.min(1, Math.max(0, (t - 0.45) / 0.5));
    const frac = (cel.from + (cel.done - cel.from) * fill) / Math.max(1, cel.total), bx = x + 6, by = y + 23, bw = w - 70;
    F().draw(g, AQ.t('quest.count', { n: shown, total: cel.total }), x + w - 6, y + 21, '#ffe9a8', { align: 'right', shadow: false, max: 58 });
    g.fillStyle = 'rgba(110,240,239,0.18)'; g.fillRect(bx, by, bw, 3);
    g.fillStyle = edge; g.fillRect(bx, by, Math.round(bw * frac), 3);
    if (!cel.calm && fill > 0 && fill < 1) { g.fillStyle = '#ffffff'; g.fillRect(bx + Math.round(bw * frac) - 1, by, 1, 3); }   // (a bright head while it fills)
    g.restore();
  }
  // a thin soft glow round the screen edges, for a fraction of a second (never with REDUCE FLASHING)
  function edgeGlow(g, cel) {
    const k = cel.t < 0.5 ? Math.sin(cel.t / 0.5 * Math.PI) * cfg().edgeGlow * (cel.chapter ? 1.4 : 1) : 0;
    if (k <= 0.01) return;
    const W = 320, H = 180, d = 12;
    for (let i = 0; i < d; i++) {
      g.fillStyle = `rgba(159,243,255,${(k * (1 - i / d) * (1 - i / d)).toFixed(3)})`;
      g.fillRect(i, i, W - i * 2, 1); g.fillRect(i, H - 1 - i, W - i * 2, 1); g.fillRect(i, i + 1, 1, H - i * 2 - 2); g.fillRect(W - 1 - i, i + 1, 1, H - i * 2 - 2);
    }
  }
  function drawParts(g) {
    for (const p of Q.parts) {
      const a = Math.min(1, (p.life - p.t) / 0.3) * (p.dim ? 0.45 : 1);
      g.globalAlpha = a; g.fillStyle = p.col;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === 'c') { const flip = Math.floor(p.t * 12 + p.x) % 2; g.fillRect(x, y, flip ? p.w : 1, flip ? 1 : p.w); }   // a confetti bit, tumbling
      else { g.fillRect(x, y, 1, 1); if (!p.dim && (p.size === 2 || p.t < p.life * 0.5)) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }   // a sparkle
    }
    g.globalAlpha = 1;
    // progress sparks flying to the tracker's count (a bright head, a short trail)
    const T = cfg().tickSpark;
    for (const s of Q.sparks) {
      if (!Q.countAt) continue;
      const u = Math.min(1, s.t / T), e = u * u * (3 - 2 * u), arc = Math.sin(u * Math.PI) * 18;
      const px = s.x + (Q.countAt.x - s.x) * e, py = s.y + (Q.countAt.y - s.y) * e - arc;
      g.fillStyle = 'rgba(255,233,168,0.5)'; g.fillRect(Math.round(px - (Q.countAt.x - s.x) * 0.04), Math.round(py + 1), 1, 1);
      g.fillStyle = '#fff6dc'; g.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
  }

  // ---------------------------------------------------------------- loading
  // a game loads (Save.apply): an older save (no requests yet) gets the one-time question later and
  // marks done, quietly, whatever it has already done once requests are on
  Q.loaded = function () {
    const s = st();
    Q.asking = false; Q.menu = false; Q.confirm = false; Q.caught = false; Q.calmT = 0; quiet(); Q.lastN = {}; Q.streak = 0; Q.lastDoneAt = 0;
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
