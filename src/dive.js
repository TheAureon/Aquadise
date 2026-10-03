// The optional guided first dive: a short checklist, one step at a time, with a gentle glowing marker
// near the thing to do. It never pauses the game or takes your controls: each step completes when you
// actually do it, a small panel waits quietly in the top-left corner meanwhile, and SKIP (this step) or
// OFF (the whole dive) are always there. Offered once on NEW GAME (a fresh save); restart it any time from
// the pause menu (TUTORIAL). Text: data/tutorial.js (dive). Tuning: AQ.TUNING.dive.
// Saved in AQ.State.tutorial: diveAsked (the prompt was answered), dive { active, step, did{} }.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Dive = (function () {
  const U = AQ.U, R = U.R;
  const D = { prompt: false, ui: [], nice: 0, niceText: '', idle: 0, gentle: null };
  const cfg = () => AQ.TUNING.dive;
  const data = () => AQ.data.tutorial.dive;
  const tut = () => (AQ.State.tutorial = AQ.State.tutorial || { seen: {} });
  const st = () => tut().dive || null;
  D.active = () => !!(st() && st().active);
  const step = () => (D.active() ? data().steps[st().step] : null);

  // ---------------------------------------------------------------- start / stop
  // NEW GAME on a fresh save: ask once (the answer is saved)
  D.offer = function () { if (!tut().diveAsked) D.prompt = true; };
  D.start = function (game) {
    tut().diveAsked = true; D.prompt = false;
    tut().dive = { active: true, step: 0, did: {} };
    D.panelRect = null; D.lines = null; D.scene = (game || AQ.Game).scene;
    D.nice = 0; D.idle = 0; D.enterStep(game || AQ.Game);
    AQ.Save && AQ.Save.dirty();
  };
  D.stop = function () {
    if (st()) st().active = false;
    D.prompt = false; D.removeGentle();
    AQ.Save && AQ.Save.dirty();
  };
  D.decline = function () { tut().diveAsked = true; D.prompt = false; AQ.Save && AQ.Save.dirty(); };

  // things you did during the dive, remembered so a step you've already done completes at once
  D.event = function (name) { if (D.active()) st().did[name] = true; };

  // ---------------------------------------------------------------- per-step setup: where the marker goes
  D.enterStep = function (game) {
    const s = step(); if (!s) return;
    const P = game.player, W = AQ.World;
    D.target = null; D.from = { x: P.x, y: P.y }; D.sneakT = 0; D.idle = 0;
    if (s.id === 'move') D.target = { x: P.x + 50, y: groundY(P.x + 50) - 2, arrow: true };
    else if (s.id === 'jump') D.target = rockAhead(P);
    else if (s.id === 'swim') { const x = waterEdge(P.x); D.target = { x: x + 14, y: W.sea + 4 }; }
    else if (s.id === 'sneak' || s.id === 'net' || s.id === 'catch') { placeGentle(game); D.target = 'gentle'; }
    else if (s.id === 'bait') D.target = 'player';
  };
  const groundY = (x) => { const W = AQ.World; for (let y = 0; y < W.h; y++) if (!W.air(x, y)) return y; return W.sea; };
  // the highest bit of shore just ahead of you (the rocks to hop onto)
  function rockAhead(P) {
    let best = null;
    for (let x = Math.round(P.x + 24); x < P.x + 170; x += 2) { const y = groundY(x); if (y < AQ.World.sea && (!best || y < best.y)) best = { x, y }; }
    return best ? { x: best.x, y: best.y - 6, arrow: true } : null;
  }
  // the first spot to the right where the sea is deep enough to swim (past the little rock pools)
  function waterEdge(x0) {
    const W = AQ.World;
    for (let x = Math.round(x0); x < W.w; x += 2) if (W.water(x, W.sea + 18) && W.water(x, W.sea + 4)) return x;
    return x0 + 60;
  }
  // A gentle, very easy Glasswinged Minnow waits in the deep water near you (a real creature: catching
  // it counts like any catch). It never darts off.
  function placeGentle(game) {
    if (D.gentle && AQ.Creatures.list.indexOf(D.gentle) >= 0) return;
    const def = AQ.Creatures.defs.glasswinged_minnow, W = AQ.World, P = game.player;
    if (!def) return;
    const edge = W.water(P.x, P.y) ? P.x : waterEdge(P.x);
    let x = edge + cfg().gentleRange, y = W.sea + 20;
    for (let k = 0; k < 30 && !(W.water(x, y) && W.water(x, y - 6) && W.water(x, y + 6)); k++) { x += 6; }
    const c = AQ.Creatures.spawnAt(def, x, y);
    c.x = c.hx = x; c.y = c.hy = y; c.pool = null; c.alpha = 0;     // (its usual behaviour would have put it in a rock pool)
    c.bhv = AQ.Behaviors.easy; c.p = Object.assign({}, def.params, { speed: 4 }); c.gentle = true; c.hx = x; c.hy = y;
    D.gentle = c;
  }
  D.removeGentle = function () {
    const c = D.gentle; D.gentle = null;
    if (c && AQ.Creatures.list.indexOf(c) >= 0) AQ.Creatures.remove(c);
  };

  // ---------------------------------------------------------------- update (play state, before input is used)
  D.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse;
    D.layout(game);
    // clicks on the panel / prompt are theirs (they never swing the net)
    const hit = D.ui.find((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    D.hover = hit;
    if (D.prompt) {
      if ((m.pressed[0] && hit && hit.id === 'yes') || I.rawPressed('Enter')) { if (I.rawPressed('Enter')) I.consume('Enter'); m.pressed[0] = false; AQ.Audio.play('menu_select'); D.start(game); return; }
      if ((m.pressed[0] && hit && hit.id === 'no') || I.rawPressed('Escape')) { I.consume('Escape'); m.pressed[0] = false; AQ.Audio.play('menu_select'); D.decline(); return; }
      if (m.pressed[0] && D.panelRect && inside(D.panelRect, m)) m.pressed[0] = false;
      return;
    }
    if (!D.active()) return;
    if (m.pressed[0] && hit) {
      m.pressed[0] = false;
      AQ.Audio.play('menu_select');
      if (hit.id === 'skip') { advance(game, false); return; }
      if (hit.id === 'off') { D.stop(); return; }
      if (hit.id === 'ok') { D.stop(); return; }
    }
    if (m.pressed[0] && D.panelRect && inside(D.panelRect, m)) m.pressed[0] = false;
    if (game.scene !== 'world') { D.scene = game.scene; return; }   // steps happen in the sea; the checklist just waits elsewhere
    if (D.scene !== 'world') { D.scene = 'world'; if (D.nice <= 0) D.enterStep(game); }      // back in the sea: re-place the marker
    if (D.nice > 0) { D.nice -= dt; if (D.nice <= 0) D.enterStep(game); return; }
    const s = step(); if (!s) return;
    D.idle += dt;
    if (done(s, game, dt)) advance(game, true);
  };
  const inside = (r, m) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h;
  // has the player done this step?
  function done(s, game, dt) {
    const P = game.player, did = st().did, c = cfg();
    switch (s.id) {
      case 'move': return Math.abs(P.x - D.from.x) > c.moveDistance;
      case 'jump': return P.mode === 'air' && P.vy < -20;
      case 'swim': return P.mode === 'swim';
      case 'sneak': {
        const near = AQ.Creatures.list.some((cr) => !cr.def.is_plant && cr.alpha > 0.3 && Math.hypot(cr.x - P.x, cr.y - P.y) < c.sneakRange);
        D.sneakT = P.sneaking && near ? D.sneakT + dt : 0;
        return D.sneakT > c.sneakSeconds;
      }
      case 'net': return !!did.swing;
      case 'catch': if (!did.catch && D.gentle && AQ.Creatures.list.indexOf(D.gentle) < 0) placeGentle(game); return !!did.catch;
      case 'bait': return !!did.bait;
      case 'log': return !!did.log;
      case 'done': return D.idle > c.doneSeconds;
    }
    return false;
  }
  function advance(game, earned) {
    const s = st(), last = s.step >= data().steps.length - 1;
    if (last) { D.stop(); if (earned) AQ.Audio.play('step_done'); return; }
    s.step++;
    if (earned) {
      AQ.Audio.play('step_done');
      D.niceText = R.pick(data().nice); D.nice = cfg().niceSeconds;
      AQ.FX.sparkle(game.player.x, game.player.y - 10, '#fff1b0', 6);
    } else D.enterStep(game);
    if (step() && step().id !== 'sneak' && step().id !== 'net' && step().id !== 'catch' && !D.gentleKeep()) D.removeGentle();
    AQ.Save && AQ.Save.dirty();
  }
  D.gentleKeep = () => { const s = step(); return !!s && (s.id === 'sneak' || s.id === 'net' || s.id === 'catch'); };

  // ---------------------------------------------------------------- layout + drawing
  const F = () => AQ.Font;
  const PANEL = { x: 4, y: 56, w: 108 };
  function wrapPx(text, px) {
    const out = []; let cur = '';
    for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && F().width(t) > px) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  D.layout = function (game) {
    D.ui = []; D.panelRect = null;
    if (D.prompt) {
      const p = data().prompt, w = 176, h = 44, x = 160 - w / 2, y = 18;
      D.panelRect = { x, y, w, h };
      D.ui.push({ id: 'yes', x: x + 22, y: y + h - 15, w: 56, h: 11, label: p.yes });
      D.ui.push({ id: 'no', x: x + w - 78, y: y + h - 15, w: 56, h: 11, label: p.no });
      return;
    }
    if (!D.active() || game.state !== 'play' || game.scene !== 'world') return;
    const s = step(), lines = D.nice > 0 ? [D.niceText] : wrapPx(AQ.Keys.fill(s.text).toUpperCase(), PANEL.w - 8);
    const h = 9 + lines.length * 7 + 15, r = { x: PANEL.x, y: PANEL.y, w: PANEL.w, h };
    D.panelRect = r; D.lines = lines;
    if (s.id === 'done') D.ui.push({ id: 'ok', x: r.x + r.w - 30, y: r.y + h - 13, w: 26, h: 10, label: 'OK' });
    else {
      D.ui.push({ id: 'skip', x: r.x + 4, y: r.y + h - 13, w: 28, h: 10, label: 'SKIP' });
      D.ui.push({ id: 'off', x: r.x + 35, y: r.y + h - 13, w: 46, h: 10, label: 'STOP ALL' });
    }
  };
  D.draw = function (g, game) {
    if (D.prompt) {
      const p = data().prompt, r = D.panelRect;
      if (!r) return;
      g.fillStyle = 'rgba(6,18,34,0.95)'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#ffe9a8'; g.fillRect(r.x, r.y, r.w, 1);
      F().draw(g, p.title.toUpperCase(), 160, r.y + 4, '#fff6dc', { align: 'center', shadow: false });
      p.lines.forEach((l, i) => F().draw(g, l.toUpperCase(), 160, r.y + 12 + i * 7, '#9fd3ee', { align: 'center', shadow: false }));
      for (const b of D.ui) AQ.Aquarium.button(g, Object.assign({ on: b.id === 'yes' }, b), D.hover === b);
      return;
    }
    if (!D.active() || game.state !== 'play' || game.scene !== 'world' || !D.panelRect || !D.lines) return;   // waits out of sight away from the sea
    const r = D.panelRect, s = st(), n = data().steps.length, quiet = D.idle > cfg().quietAfter && !(D.hover || inside(r, AQ.Input.mouse));
    g.save(); g.globalAlpha = quiet ? 0.55 : 0.95;
    g.fillStyle = 'rgba(6,18,34,0.94)'; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#7ef0c0'; g.fillRect(r.x, r.y, Math.round(r.w * s.step / (n - 1)), 1);           // progress along the top
    g.fillStyle = 'rgba(126,240,192,0.25)'; g.fillRect(r.x + Math.round(r.w * s.step / (n - 1)), r.y, r.w - Math.round(r.w * s.step / (n - 1)), 1);
    F().draw(g, step().id === 'done' ? 'GUIDED DIVE' : `STEP ${s.step + 1} OF ${n}`, r.x + 4, r.y + 3, '#7ef0c0', { shadow: false });
    D.lines.forEach((l, i) => F().draw(g, l, r.x + 4, r.y + 11 + i * 7, D.nice > 0 ? '#fff1b0' : '#e8f4ff', { shadow: false }));
    for (const b of D.ui) AQ.Aquarium.button(g, b, D.hover === b);
    g.restore();
  };
  // the marker, in the world (drawn after lighting so it glows)
  D.drawWorld = function (g, game) {
    if (!D.active() || game.scene !== 'world' || D.nice > 0 || game.state !== 'play') return;
    let t = D.target;
    if (t === 'gentle') t = D.gentle && AQ.Creatures.list.indexOf(D.gentle) >= 0 ? { x: D.gentle.x, y: D.gentle.y } : null;
    else if (t === 'player') t = { x: game.player.x, y: game.player.y - 16, arrow: true, only: true };
    if (!t) return;
    const l = AQ.Camera.left(), tp = AQ.Camera.top(), time = AQ.Render.t;
    if (!t.only) AQ.Assets.draw(g, 'ui.marker', 'idle', t.x - l, t.y - tp, { t: time, alpha: 0.85 });
    AQ.Assets.draw(g, 'ui.arrow', 'idle', t.x - l, t.y - tp - (t.only ? 0 : 14), { t: time, alpha: 0.9 });
  };
  D.blocksTips = () => D.prompt;
  return D;
})();
