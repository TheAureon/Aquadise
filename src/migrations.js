// Rare migrations: now and then a whale, a school of mantas or a line of sea turtles crosses the open
// ocean, far off behind the scenery. They call as they go, so with the hydrophone you hear them (a ripple, an
// edge arrow, LISTEN's pulses) before you see them. Never catchable (the net passes through): just watched.
// The first time you see each one, a field note is added to the log (NOTES > SIGHTINGS) and a badge is
// earned. Each is more likely in its own season (data/migrations.js). Every graphics level; REDUCE
// FLASHING changes nothing (nothing here flashes).
//
// When: every AQ.TUNING.migrations.everyMinutes of play in the sea (random in the range), one crosses if
// you're in or near the open ocean (else it waits for you to be). Saved: AQ.State.migrations = { seen: { id:
// times } } (numbers only). Testing: debug.migrationKey (5 = one starts crossing now).
// Names: migration.<id>.name; the line on a first sighting: migration.seen; field notes: lore.sight_<id>.*
// LANG_PREFIX: 'migration.'  LANG_PREFIX: 'lore.sight_'
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Migrations = (function () {
  const U = AQ.U;
  const M = { cur: null, wait: null };
  const cfg = () => AQ.TUNING.migrations;
  const D = () => AQ.data.migrations;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const st = () => { const s = AQ.State.migrations = AQ.State.migrations && typeof AQ.State.migrations === 'object' ? AQ.State.migrations : {}; s.seen = s.seen || {}; return s; };
  M.seen = (id) => st().seen[id] || 0;
  M.name = (id) => AQ.t(`migration.${id}.name`);

  // field notes for the sightings (the log's NOTES tab lists them under SIGHTINGS once seen)
  function lore() {
    const L = AQ.data.lore = AQ.data.lore || {};
    if (L['sighting:' + D().order[0]]) return;
    D().order.forEach((id) => {
      const key = `lore.sight_${id}`, o = {};
      Object.defineProperty(o, 'title', { get: () => AQ.t(`${key}.title`), enumerable: true });
      Object.defineProperty(o, 'sci', { get: () => AQ.t(`${key}.sci`), enumerable: true });
      Object.defineProperty(o, 'lines', { get: () => [1, 2, 3, 4].map((n) => AQ.t(`${key}.${n}`)), enumerable: true });
      L['sighting:' + id] = o;
    });
  }
  M.notes = () => (lore(), 0) || D().order.filter((id) => M.seen(id)).map((id) => ({ id: 'sighting:' + id, name: M.name(id), sighting: true }));

  // ---------------------------------------------------------------- when one crosses
  function pick() {
    const season = AQ.Seasons && AQ.Seasons.on() ? AQ.Seasons.id() : null, list = D().order;
    const w = (id) => (D().kinds[id].season === season ? cfg().seasonFavour : 1) * (M.seen(id) ? 1 : cfg().unseenFavour);
    let r = Math.random() * list.reduce((a, id) => a + w(id), 0);
    for (const id of list) { r -= w(id); if (r <= 0) return id; }
    return list[0];
  }
  M.start = function (id = pick()) {
    const k = D().kinds[id], A = D().area, dir = Math.random() < 0.5 ? 1 : -1, y = rnd(k.y[0], k.y[1]);
    const x0 = dir > 0 ? A[0] - 260 : A[1] + 260;
    const members = [];
    for (let i = 0; i < k.count; i++) members.push({ x: x0 - dir * i * k.gap, y: y + (i ? rnd(-10, 10) : 0), s: rnd(0, 6) });
    M.cur = { id, k, dir, members, t: 0, callT: rnd(1, 3), seenT: 0, counted: false, src: { x: x0, y, sound: k.sound, req: 1, color: '#bfe8ff', key: 'migration' } };
  };
  const near = (P) => { const A = D().area; return P.x > A[0] - cfg().nearBy && P.x < A[1] + cfg().nearBy; };
  M.update = function (dt, game) {
    if (!cfg().enabled || !game || game.scene !== 'world') return;
    if (M.wait == null) M.wait = rnd(cfg().everyMinutes[0], cfg().everyMinutes[1]) * 60;
    const d = AQ.TUNING.debug;
    if (d.migrationKeys && AQ.Input.rawPressed(d.migrationKey)) { M.start(); if (AQ.HUD) AQ.HUD.toast(AQ.t('debug.migration'), '#cfe8ff'); M.wait = rnd(cfg().everyMinutes[0], cfg().everyMinutes[1]) * 60; }
    if (game.state !== 'play') return;
    if (!M.cur) {
      M.wait -= dt;
      if (M.wait <= 0 && near(game.player)) { M.start(); M.wait = rnd(cfg().everyMinutes[0], cfg().everyMinutes[1]) * 60; }
      return;
    }
    const c = M.cur, A = D().area;
    c.t += dt;
    c.members.forEach((m) => { m.x += c.dir * c.k.speed * dt; m.y += Math.sin(c.t * 0.3 + m.s) * 2 * dt; });
    const lead = c.members[0];
    c.src.x = lead.x; c.src.y = lead.y;
    // it calls as it goes (the hydrophone hears it before you can see it)
    c.callT -= dt;
    if (c.callT <= 0) { c.callT = rnd(c.k.callEvery[0], c.k.callEvery[1]); if (AQ.Hydro) AQ.Hydro.call(c.src); }
    // seen: one of them on screen for a moment
    const cam = AQ.Camera, on = c.members.some((m) => m.x > cam.left() + 10 && m.x < cam.left() + cam.w - 10 && m.y > cam.top() + 10 && m.y < cam.top() + cam.h - 10);
    c.seenT = on ? c.seenT + dt : 0;
    if (!c.counted && c.seenT > cfg().seeSeconds) {
      c.counted = true;
      const first = !M.seen(c.id);
      st().seen[c.id] = M.seen(c.id) + 1;
      if (AQ.HUD) AQ.HUD.toast(AQ.t(first ? 'migration.seenFirst' : 'migration.seen', { name: M.name(c.id) }), '#bfe8ff', first ? 6 : 4);
      if (AQ.Badges) AQ.Badges.event('migration', { kind: c.id });
      if (AQ.Save) AQ.Save.dirty();
    }
    // gone past the far side: over
    const last = c.members[c.members.length - 1];
    if ((c.dir > 0 && last.x > A[1] + 300) || (c.dir < 0 && last.x < A[0] - 300)) M.cur = null;
  };
  // LISTEN pulses for it too (src/hydrophone.js)
  M.sources = () => (M.cur ? [M.cur.src] : []);

  // ---------------------------------------------------------------- drawing (far off: behind the scenery)
  M.draw = function (ctx, cam) {
    const c = M.cur;
    if (!c) return;
    const l = cam.left(), t = cam.top(), time = AQ.Render.t * (U.calm() ? 0.6 : 1);
    ctx.save();
    ctx.globalAlpha = cfg().farAlpha;
    for (const m of c.members) {
      const x = Math.round(m.x - l), y = Math.round(m.y - t);
      if (x < -80 || x > cam.w + 80 || y < -40 || y > cam.h + 40) continue;
      (c.id === 'whale' ? whale : c.id === 'mantas' ? manta : turtle)(ctx, x, y, c.dir, time + m.s);
    }
    ctx.restore();
  };
  const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // a whale, side view, about 140 px long: a long dark back, a pale grooved throat, a slow tail beat
  function whale(ctx, x, y, dir, t) {
    const f = (dx) => x + dir * dx, tail = Math.sin(t * 0.8) * 7, L = 70;
    for (let i = -L; i <= 58; i++) {
      const u = (i + L) / (L + 58), hb = 28 * Math.sin(Math.PI * Math.min(1, u * 1.12));
      const h = Math.round(hb * (u < 0.3 ? 0.35 + 0.65 * (u / 0.3) : 1));
      if (h <= 0) continue;
      const yy = y - Math.round(h * 0.55) + Math.round(tail * Math.max(0, -i - 35) / 35);
      box(ctx, f(i), yy, 1, h, '#33445c');
      box(ctx, f(i), yy, 1, 1, '#4a5c76');                                                                       // light along the back
      const th = Math.max(1, Math.round(h * 0.3));
      box(ctx, f(i), yy + h - th, 1, th, '#8a9cb4');                                                             // the pale throat
      if (i > 10 && i % 3 === 0) box(ctx, f(i), yy + h - Math.round(th * 0.7), 1, 1, '#5a6c84');               // its grooves
      if (i === 48) box(ctx, f(i), yy + Math.round(h * 0.4), 2, 2, '#0e1624');                                   // the eye
    }
    const tx = f(-L - 1), ty = y - 4 + tail;                                                                   // the flukes
    for (let k = 0; k < 14; k++) { box(ctx, tx - dir * k * 0.5, ty - k - 1, 2, 2, '#33445c'); box(ctx, tx - dir * k * 0.5, ty + k * 0.9, 2, 2, '#33445c'); }
    for (let k = 0; k < 20; k++) box(ctx, f(18 - k), y + 6 + Math.round(k * 0.55), 2, 2, '#3c4e68');          // a long flipper
  }
  // a manta, seen at an angle: a broad diamond of wings beating slowly up and down, a thin tail
  function manta(ctx, x, y, dir, t) {
    const f = (dx) => x + dir * dx, beat = Math.cos(t * 1.6), up = 0.55 + 0.45 * beat, down = 0.55 - 0.45 * beat;
    for (let i = -13; i <= 13; i++) {
      const w = (13 - Math.abs(i)) / 13, a = Math.round(9 * w * up), b = Math.round(6 * w * Math.max(0.15, down));
      box(ctx, f(i), y - a, 1, a + b + 2, '#28344a');
      if (a > 1) box(ctx, f(i), y - a, 1, 1, '#3e4e6a');                                                         // the wing's light edge
      if (Math.abs(i) < 6) box(ctx, f(i), y + 1, 1, 1, '#c8d4e4');                                              // the pale belly
    }
    box(ctx, f(13), y - 2, 3, 1, '#28344a'); box(ctx, f(13), y + 1, 3, 1, '#28344a');                         // the head fins
    for (let k = 0; k < 14; k++) box(ctx, f(-14 - k), y + Math.round(Math.sin(t * 2 + k * 0.4) * 1), 1, 1, '#28344a');   // the thin tail
  }
  // a sea turtle: a domed shell, paddling flippers, a small head
  function turtle(ctx, x, y, dir, t) {
    const f = (dx) => x + dir * dx, pad = Math.sin(t * 2.2) * 3;
    for (let i = -9; i <= 9; i++) { const h = Math.round(7 * Math.sqrt(1 - (i / 10) * (i / 10))); box(ctx, f(i), y - h + 2, 1, h, '#5a7048'); if (i % 4 === 0) box(ctx, f(i), y - h + 3, 1, h - 2, '#6f8a58'); }
    box(ctx, f(-9), y + 2, 19, 1, '#c8b88a');                                                                   // its plastron
    box(ctx, f(10), y - 1, 4, 3, '#7a8a5a'); box(ctx, f(13), y - 1, 1, 1, '#1a2018');                          // head, eye
    for (let k = 0; k < 6; k++) box(ctx, f(4 + k * 0.6), y + 2 + k * (0.4 + pad * 0.08), 1, 1, '#6a7a52');      // front flipper
    for (let k = 0; k < 4; k++) box(ctx, f(-7 - k * 0.6), y + 2 + k * 0.5, 1, 1, '#6a7a52');                    // back flipper
  }
  return M;
})();
