// Touch controls. Everything goes through AQ.Input (src/input.js), so the game reads touch exactly like
// keys and the mouse, and a keyboard / mouse keep working at the same time:
//   - on-screen buttons hold "virtual keys" (the same codes as their keys: JUMP holds Space, BAIT holds B,
//     INTERACT holds E, LISTEN (an ear, hydrophone 1+) holds Q, SNEAK toggles Shift), looked up from the bindings (AQ.Keys), so they follow any change
//   - the floating joystick sets AQ.Input.stick (read by Input.axis()); pushed far up it also holds "up"
//   - a tap on the game is the left mouse button at that point (the net in the sea; menus and buttons
//     everywhere else); keeping the finger down holds it (prying)
// Pointer Events with multi-touch: every finger is tracked by its pointerId; a lost finger
// (pointercancel, the window losing focus, the page hidden, the last finger lifting) lets go of whatever
// it held, so nothing sticks. The controls are drawn on their own full-window canvas (#touch) in screen
// pixels, over the black side bars where there's room, or over the game's edges. Sizes and timings:
// AQ.TUNING.touch. Settings (TOUCH CONTROLS auto / on / off, SWAP SIDES): AQ.State.settings.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Touch = (function () {
  const T = { pointers: new Map(), seen: false, sneakOn: false, lastUse: -99, menuOpen: false, portrait: false, L: null, safe: { t: 0, r: 0, b: 0, l: 0 }, menuUi: [] };
  const cfg = () => AQ.TUNING.touch;
  const set = () => (AQ.State.settings = AQ.State.settings || {});
  const now = () => performance.now() / 1000;
  let canvas = null, ctx = null, dpr = 1, rotateEl = null, gameCanvas = null, lastSig = '';

  // ---------------------------------------------------------------- on / off
  T.mode = () => set().touchControls || 'auto';
  T.forced = () => !!(AQ.TUNING.debug && AQ.TUNING.debug.forceTouch);
  // AUTO: on from the first touch. ON / OFF: always / never. (The testing flag forces them on.)
  T.active = () => T.forced() || T.mode() === 'on' || (T.mode() === 'auto' && T.seen);
  // with the testing flag the mouse's left button is a finger (src/input.js skips those events)
  T.ownsMouse = (e) => T.forced() && (e.type === 'mousemove' || e.button === 0);
  T.refresh = function () {
    if (!T.active()) { setSneak(false); T.menuOpen = false; T.releaseAll(); }
    if (AQ.Game && AQ.Game.fit) AQ.Game.fit();
    checkPortrait();
  };

  // ---------------------------------------------------------------- page setup
  T.attach = function (game) {
    gameCanvas = game;
    canvas = document.getElementById('touch'); ctx = canvas.getContext('2d');
    rotateEl = document.getElementById('rotate');
    const opts = { passive: false };
    window.addEventListener('pointerdown', onDown, opts);
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);
    // no scrolling, rubber-banding, double-tap zoom or long-press callouts, and no "mouse" events copied from touches
    const stop = (e) => { if (formEl(e.target)) return; if (e.cancelable) e.preventDefault(); };
    document.addEventListener('touchstart', (e) => { firstTouch(); stop(e); }, opts);
    document.addEventListener('touchmove', stop, opts);
    // the last finger lifted: anything still held by a touch lets go (a safety net for lost pointerups)
    const lifted = (e) => { if (!e.touches || e.touches.length === 0) releaseKind('touch'); };
    document.addEventListener('touchend', lifted, opts);
    document.addEventListener('touchcancel', lifted, opts);
    document.addEventListener('gesturestart', (e) => e.preventDefault());          // iOS Safari pinch zoom
    document.addEventListener('contextmenu', (e) => { if (T.active()) e.preventDefault(); });
    window.addEventListener('blur', () => T.releaseAll());
    window.addEventListener('pagehide', () => T.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) T.releaseAll(); });
    const resized = () => { readSafe(); sizeCanvas(); checkPortrait(); };
    window.addEventListener('resize', resized);
    window.addEventListener('orientationchange', () => setTimeout(resized, 120));    // iOS reports the new size a moment late
    if (window.visualViewport) window.visualViewport.addEventListener('resize', resized);
    resized();
  };
  function firstTouch() { if (!T.seen) { T.seen = true; T.refresh(); } }
  // the safe area (notches, rounded corners, the home bar), read from CSS env() through a hidden probe
  function readSafe() {
    const p = document.getElementById('safe-probe');
    if (!p) return;
    const cs = getComputedStyle(p), n = (v) => parseFloat(v) || 0;
    T.safe = { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
  }
  function sizeCanvas() {
    if (!canvas) return;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    lastSig = '';                                                  // (resizing wipes the canvas: draw it again)
  }
  // portrait on a touch screen: "Rotate your device" (the game pauses while it shows)
  function checkPortrait() {
    const p = T.active() && window.innerHeight > window.innerWidth;
    if (p && !T.portrait) T.releaseAll();
    T.portrait = p;
    if (rotateEl) rotateEl.style.display = p ? 'flex' : 'none';
  }

  // ---------------------------------------------------------------- layout (screen px)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inR = (r, x, y) => !!r && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
  const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // CONTROL SIZE (small / medium / large): scales every button and the joystick (touch.sizes)
  T.sizeName = () => (cfg().sizes[set().controlSize] ? set().controlSize : 'medium');
  T.sizeMult = () => cfg().sizes[T.sizeName()];
  function gameRect() { const r = (gameCanvas || document.getElementById('game')).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, s: r.width / AQ.TUNING.view.w }; }
  T.toGamePx = (px) => px / gameRect().s;                                          // screen px -> game px (sizes in config are screen px)
  T.toScreen = function (r) { const g = gameRect(); return { x: g.x + r.x * g.s, y: g.y + r.y * g.s, w: r.w * g.s, h: r.h * g.s }; };
  // game things the controls must never cover or steal touches from (a tap there goes to the game)
  function exclusions(game) {
    const out = [];
    if (AQ.Tips && AQ.Tips.rect) out.push(T.toScreen(AQ.Tips.rect));
    if (AQ.Dive && AQ.Dive.panelRect && game.scene === 'world') out.push(T.toScreen(AQ.Dive.panelRect));
    if (AQ.Quests && game.state === 'play') for (const r of AQ.Quests.rects()) out.push(T.toScreen(r));   // the station requests' tracker, menu, question
    return out;
  }
  // which controls show right now
  function shown(game) {
    if (!T.active() || T.portrait || !game) return {};
    if (game.state === 'map') return { menu: true, close: true };                 // (a tap anywhere on the map closes it too)
    if (game.state === 'touchtest') return { stick: true, jump: true, bait: true, sneak: true, interact: true, listen: true };   // TOUCH TEST: all of them, to try
    if (game.state !== 'play') return {};
    return { menu: true, stick: true, jump: true, sneak: true, bait: game.scene === 'world', interact: interactUp(), listen: game.scene === 'world' && !!AQ.Hydro && AQ.Hydro.unlocked(),
      view: game.scene === 'station' };                                             // the building's whole view (the V key)
  }
  function interactUp() { const p = AQ.Scenes && AQ.Scenes.promptAt; return !!p && AQ.Render.t - p.t < cfg().interactLinger && AQ.Render.t >= p.t; }
  function layout(game) {
    const c = cfg(), W = window.innerWidth, H = window.innerHeight, sf = T.safe, m = c.marginPx, gap = c.gapPx;
    const minDim = Math.min(W, H), k = T.sizeMult();
    const size = Math.round(clamp(minDim * c.buttonVmin, c.minButtonPx, c.maxButtonPx) * k);
    const R = Math.round(clamp(minDim * c.stickRadiusVmin, c.minStickRadiusPx, c.maxStickRadiusPx) * k);
    const swap = !!set().swapSides, g = gameRect();
    // the button side: right (or left, swapped); `in` points from that edge into the screen
    const edge = swap ? sf.l + m : W - sf.r - m, inw = swap ? 1 : -1, bottom = H - sf.b - m;
    const cx = edge + inw * size / 2, cy = bottom - size / 2;
    const btn = (id, x, y, s) => ({ id, x: x - s / 2, y: y - s / 2, w: s, h: s, cx: x, cy: y, size: s });
    const L = { size, R, swap, W, H, g, buttons: [] };
    L.buttons.push(btn('jump', cx, cy, size));
    L.buttons.push(btn('bait', cx, cy - size - gap, size));
    L.buttons.push(btn('sneak', cx, cy - 2 * (size + gap), size));
    L.buttons.push(btn('listen', cx + inw * (size + gap), cy - 2 * (size + gap), size));   // hold to LISTEN (hydrophone 1+, the sea)
    L.buttons.push(btn('view', cx + inw * (size + gap), cy - 2 * (size + gap), size));     // (same place, in the building: see all the tanks)
    L.buttons.push(btn('close', cx, cy, size));                                             // the map: close it
    // INTERACT takes BAIT's place when there's no bait (prompts only come up on the hill and in the station);
    // otherwise it sits beside JUMP
    if (shown(game).bait) L.buttons.push(btn('interact', cx + inw * (size + gap), cy, size));
    else L.buttons.push(btn('interact', cx, cy - size - gap, size));
    // MENU: in the top corner of the side bar if it's wide enough, otherwise over the game, just under the HUD
    const ms = Math.round(size * c.menuScale), bar = swap ? g.x - sf.l : W - (g.x + g.w) - sf.r;
    if (bar >= ms + m) L.buttons.push(btn('menu', edge + inw * ms / 2, sf.t + m + ms / 2, ms));
    else {
      const r = c.menuGameRect, mx = swap ? AQ.TUNING.view.w - r[0] - r[2] : r[0], s = T.toScreen({ x: mx, y: r[1], w: r[2], h: r[3] });
      const hs = Math.max(ms, c.minButtonPx);                                       // a fingertip-sized hit area around the small button
      L.buttons.push(Object.assign(btn('menu', s.x + s.w / 2, s.y + s.h / 2, Math.min(s.w, s.h)), { hit: { x: s.x + s.w / 2 - hs / 2, y: s.y + s.h / 2 - hs / 2, w: hs, h: hs } }));
    }
    // the joystick: anywhere in the lower part of the other side
    const zw = W * c.stickZoneW;
    L.zone = { x: swap ? W - zw : 0, y: H * c.stickZoneTop, w: zw, h: H * (1 - c.stickZoneTop) };
    L.rest = { x: swap ? W - sf.r - m - R : sf.l + m + R, y: bottom - R };
    L.ex = exclusions(game);
    return L;
  }

  // ---------------------------------------------------------------- the virtual keys each button holds
  const keyOf = (action) => AQ.Keys.list(action).find((c) => !/^Mouse/.test(c));
  const CODES = { jump: () => keyOf('jump'), bait: () => keyOf('bait'), interact: () => keyOf('interact'), listen: () => keyOf('listen'),
    view: () => AQ.TUNING.station.zoomKey, close: () => keyOf('map') };
  function setSneak(on) {
    const code = keyOf('sneak');
    T.sneakOn = on;
    if (code) { if (on) AQ.Input.vPress(code); else AQ.Input.vRelease(code); }
  }

  const formEl = (t) => !!(t && t.closest && t.closest('input, textarea, button, .aq-form'));   // the save text box (src/savefile.js) works normally
  // ---------------------------------------------------------------- pointers
  const isFinger = (e) => e.pointerType === 'touch' || e.pointerType === 'pen' || (T.forced() && e.pointerType === 'mouse');
  const tapHeld = () => [...T.pointers.values()].some((p) => p.role === 'tap');
  function onDown(e) {
    if (e.pointerType === 'touch') firstTouch();
    if (!isFinger(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (formEl(e.target)) return;
    if (e.cancelable) e.preventDefault();
    const game = AQ.Game, x = e.clientX, y = e.clientY;
    const p = { id: e.pointerId, kind: e.pointerType, role: 'none', x, y, x0: x, y0: y, t0: now() };
    T.pointers.set(e.pointerId, p);
    if (T.portrait) return;
    const sh = shown(game), L = T.L = layout(game);
    T.lastUse = now();
    // 1) an on-screen button
    const b = sh && L.buttons.find((b) => sh[b.id] && inR(b.hit || b, x, y));
    if (b) { p.role = 'btn'; p.btn = b.id; pressButton(b.id, p); return; }
    // 2) the joystick (not on things the game needs tapped: the tip box, the guided-dive box)
    if (sh.stick && inR(L.zone, x, y) && !L.ex.some((r) => inR(r, x, y)) && !(T.menuOpen)) {
      p.role = 'stick'; p.bx = x; p.by = y; stickTo(p); return;
    }
    // 3) the map: a tap anywhere closes it (there's nothing on it to tap)
    if (game && game.state === 'map' && !T.menuOpen) { p.role = 'none'; game.state = 'play'; AQ.Audio.play('menu_move'); return; }
    // 4) a tap on the game: the left mouse button there (a tap just beside a small button counts as on it)
    if (!tapHeld()) { const at = snap(game, x, y); p.role = 'tap'; p.dx = at.x - x; p.dy = at.y - y; AQ.Input.touchMouse(at.x, at.y, 'down'); }
  }
  function onMove(e) {
    const p = T.pointers.get(e.pointerId);
    if (!p) { if (T.forced() && e.pointerType === 'mouse' && !e.buttons) AQ.Input.touchMouse(e.clientX, e.clientY, 'move'); return; }   // the "finger" hovering
    if (e.cancelable) e.preventDefault();
    p.x = e.clientX; p.y = e.clientY;
    if (p.role === 'stick') { stickTo(p); T.lastUse = now(); }
    else if (p.role === 'tap') AQ.Input.touchMouse(p.x + (p.dx || 0), p.y + (p.dy || 0), 'move');   // (a snapped tap keeps its offset)
  }
  function onUp(e) {
    const p = T.pointers.get(e.pointerId);
    if (!p) return;
    if (e.cancelable && e.type === 'pointerup') e.preventDefault();
    release(p, false, e.type === 'pointercancel');
    T.pointers.delete(e.pointerId);
  }
  // ---------------------------------------------------------------- bigger hit areas for small buttons
  // The buttons the current screen has (game px). A tap that lands on none of them but within
  // touch.snapPx screen px of one is moved onto the nearest (only ever one: the nearest wins, so two
  // small buttons never share a tap area). Nothing changes how they look, or anything with a mouse.
  function targets(game) {
    const st = game.state, A = AQ.Aquarium;
    if (T.menuOpen) return T.menuUi;
    if (AQ.Redo && AQ.Redo.dialog) return AQ.Redo.ui;
    if (AQ.SaveFile && AQ.SaveFile.panel) return AQ.SaveFile.ui;
    if (st === 'title') return AQ.Title.panel === 'sound' ? AQ.SoundUI.ui : AQ.Title.panel ? [] : AQ.Title.items;
    if (st === 'pause') return AQ.PauseUI.panel === 'sound' ? AQ.SoundUI.ui : AQ.PauseUI.ui;
    if (st === 'soundtest') return AQ.SoundTest.ui;
    if (st === 'touchtest') return AQ.TouchTest.ui;
    if (st === 'guide') return AQ.Guide.ui;
    if (st === 'log') return AQ.LogUI.ui;
    if (st === 'aquarium') return A.photo.on ? A.photo.ui : A.ui;
    if (st === 'play') return (AQ.Dive ? AQ.Dive.ui : []).concat(AQ.Nudges ? AQ.Nudges.ui : [], AQ.Quests ? AQ.Quests.ui : []);
    return [];
  }
  function snap(game, x, y) {
    if (!game) return { x, y };
    const list = (targets(game) || []).filter((r) => r && !r.text && r.w > 0 && r.h > 0 && r.x != null).map((r) => T.toScreen(r));
    if (!list.length || list.some((r) => inR(r, x, y))) return { x, y };
    if (game.state === 'aquarium' && !AQ.Aquarium.photo.on && inR(T.toScreen(AQ.Aquarium.tankRect()), x, y)) return { x, y };   // the water is for placing and netting
    const dist = (r) => Math.hypot(x - clamp(x, r.x, r.x + r.w), y - clamp(y, r.y, r.y + r.h));
    let best = null, bd = cfg().snapPx;
    for (const r of list) { const d = dist(r); if (d < bd) { bd = d; best = r; } }
    return best ? { x: best.x + best.w / 2, y: best.y + best.h / 2 } : { x, y };
  }
  T.snap = snap;

  function pressButton(id, p) {
    const I = AQ.Input;
    if (id === 'sneak') { setSneak(!T.sneakOn); AQ.Audio.play('menu_move'); return; }
    if (id === 'menu') { T.menuOpen = !T.menuOpen; AQ.Audio.play(T.menuOpen ? 'menu_select' : 'menu_move'); return; }
    const code = CODES[id] && CODES[id]();
    if (code) { I.vPress(code); p.code = code; }
  }
  function release(p, quiet, cancelled) {
    const I = AQ.Input;
    if (p.role === 'btn' && p.code) { if (!quiet) I.vRelease(p.code); }
    else if (p.role === 'stick') {
      I.stick.x = I.stick.y = 0; if (p.up) I.vRelease(p.up);
      // a quick tap in the joystick zone that didn't move is a tap on the game (the net works there too)
      const c = cfg();
      if (!quiet && !cancelled && now() - p.t0 < c.tapSeconds && Math.hypot(p.x - p.x0, p.y - p.y0) < c.tapSlopPx && !tapHeld()) {
        I.touchMouse(p.x0, p.y0, 'down'); I.touchMouse(p.x0, p.y0, 'up');
      }
    } else if (p.role === 'tap' && !quiet) I.touchMouse(cancelled ? null : p.x + (p.dx || 0), cancelled ? null : p.y + (p.dy || 0), cancelled ? 'cancel' : 'up');
    p.role = 'none';
  }
  // the floating joystick: the ring appears where the thumb lands and follows it if it slides past the edge
  function stickTo(p) {
    const c = cfg(), R = (T.L || layout(AQ.Game)).R, I = AQ.Input;
    let dx = p.x - p.bx, dy = p.y - p.by, d = Math.hypot(dx, dy);
    if (d > R) { p.bx = p.x - dx / d * R; p.by = p.y - dy / d * R; dx = p.x - p.bx; dy = p.y - p.by; d = R; }
    const mag = d / R, live = mag < c.deadZone ? 0 : (mag - c.deadZone) / (1 - c.deadZone);
    I.stick.x = d ? dx / d * live : 0; I.stick.y = d ? dy / d * live : 0;
    // pushed far up = "up" held (jumps on land, like W); let go below the line again
    const up = keyOf('up'), want = I.stick.y < -c.upThreshold;
    if (want && !p.up) { I.vPress(up); p.up = up; } else if (!want && p.up) { I.vRelease(p.up); p.up = null; }
  }
  // let go of everything (quiet: AQ.Input already cleared its own state)
  T.releaseAll = function (quiet) {
    for (const p of T.pointers.values()) release(p, !!quiet, true);
    T.pointers.clear();
    if (quiet && T.sneakOn) T.sneakDirty = true;   // the sneak toggle stays lit and is held again next frame
  };
  function releaseKind(kind) { for (const [id, p] of T.pointers) if (p.kind === kind) { release(p, false, true); T.pointers.delete(id); } }

  // ---------------------------------------------------------------- every frame
  // VIBRATION: a light buzz on catches and unlocks (touch.vibrate), only with touch controls on, only where
  // the browser can (navigator.vibrate; iPhones can't, and stay silent). On by default.
  T.canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  T.vibrateOn = () => set().vibration !== false;
  T.buzz = function (kind) {
    if (!T.active() || !T.vibrateOn() || !T.canVibrate()) return;
    const pat = cfg().vibrate[kind];
    try { if (pat) navigator.vibrate(pat); } catch (e) { /* not allowed right now: silent */ }
  };

  T.update = function (dt, game) {
    if (T.active() && !T.tipSent && AQ.Tips) { T.tipSent = true; AQ.Tips.event('touch'); }   // the one-time "playing by touch" tip
    if (T.sneakOn && (T.sneakDirty || !AQ.Input.isDown(keyOf('sneak')))) { T.sneakDirty = false; AQ.Input.vPress(keyOf('sneak')); }
    if (T.menuOpen && (!T.active() || (game.state !== 'play' && game.state !== 'map'))) T.menuOpen = false;
  };

  // ---------------------------------------------------------------- the MENU panel (drawn in the game, game px)
  const MENU = ['log', 'map', 'guide', 'help', 'mute', 'pause', 'settings', 'close'];   // labels: touch.menu.<id>
  function menuLayout() {
    const muted = AQ.Audio.settings().mute;
    return MENU.map((id, i) => ({ id, x: 112 + (i % 2) * 50, y: 46 + Math.floor(i / 2) * 18, w: 46, h: 14, label: AQ.t(id === 'mute' && muted ? 'touch.menu.soundOn' : `touch.menu.${id}`), on: id === 'mute' && muted }));
  }
  // returns true while the panel is open (the game underneath waits)
  T.updateMenu = function (game) {
    if (!T.menuOpen) return false;
    const I = AQ.Input, m = I.mouse;
    T.menuUi = menuLayout();
    T.menuHover = T.menuUi.find((r) => inR(r, m.x, m.y));
    if (I.rawPressed('Escape')) { I.consume('Escape'); T.menuOpen = false; return true; }
    if (!m.pressed[0]) return true;
    m.pressed[0] = false;
    const id = T.menuHover && T.menuHover.id;
    if (!id) { if (!inR({ x: 104, y: 30, w: 112, h: 100 }, m.x, m.y)) T.menuOpen = false; return true; }   // a tap outside closes it
    AQ.Audio.play('menu_select');
    if (id === 'mute') { AQ.Audio.toggleMute(); return true; }
    T.menuOpen = false;
    if (id === 'log' && AQ.LogUI) AQ.LogUI.open(game);
    else if (id === 'map') { if (game.scene === 'world') game.state = game.state === 'map' ? 'play' : 'map'; else AQ.HUD.toast(AQ.t('map.onlySea'), '#cfe8ff'); }
    else if (id === 'guide' && AQ.Guide) AQ.Guide.open(game, 'play');
    else if (id === 'help') { AQ.HUD.askHelp(); if (game.state === 'map') game.state = 'play'; }
    else if (id === 'pause') { game.state = 'pause'; AQ.PauseUI.sel = 0; }
    else if (id === 'settings') { game.state = 'pause'; AQ.PauseUI.panel = 'sound'; AQ.SoundUI.open(); AQ.SoundUI.tab = 'touch'; }
    return true;
  };
  T.drawGame = function (g) {
    if (!T.menuOpen) return;
    g.fillStyle = 'rgba(4,12,24,0.55)'; g.fillRect(0, 0, 320, 180);
    AQ.Kit.panel(g, { x: 104, y: 30, w: 112, h: 16 + Math.ceil(MENU.length / 2) * 18 + 4 }, { edge: '#6ef0ef' });   // (as tall as its rows)
    AQ.Font.draw(g, AQ.t('touch.menu'), 160, 35, '#fff6dc', { align: 'center', shadow: false });
    for (const r of (T.menuUi.length ? T.menuUi : menuLayout())) AQ.Aquarium.button(g, r, T.menuHover === r);
  };

  // ---------------------------------------------------------------- drawing the controls (screen px)
  function sprite(key, frame, cx, cy, sizeCss, alpha) {
    const e = AQ.Assets.entry(key);
    if (!e) return;
    const k = Math.max(1, Math.round(sizeCss * dpr / e.fw));      // whole device pixels per art pixel: crisp
    ctx.setTransform(k, 0, 0, k, Math.round(cx * dpr - e.fw * k / 2), Math.round(cy * dpr - e.fh * k / 2));
    AQ.Assets.draw(ctx, key, 'idle', e.anchor[0], e.anchor[1], { frame, alpha });
  }
  function label(text, cx, y, alpha) {
    const k = Math.max(1, Math.round(2 * dpr)), w = AQ.Font.width(text) + 4;
    ctx.setTransform(k, 0, 0, k, Math.round(cx * dpr - w * k / 2), Math.round(y * dpr));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(6,18,34,0.85)'; ctx.fillRect(0, 0, w, 9);
    AQ.Font.draw(ctx, text, 2, 2, '#ffe9a8', { shadow: false });
    ctx.globalAlpha = 1;
  }
  const FRAME = { jump: 1, bait: 2, sneak: 3, interact: 4, menu: 5, close: 6, view: 8, listen: 12 };
  // (the overlay is a full-window, high-resolution canvas: it's only redrawn when something on it changed,
  // which saves a slow phone a lot of work while the controls sit still)
  T.drawOverlay = function (game) {
    if (!ctx) return;
    const sh = shown(game);
    if (!Object.keys(sh).length) { if (lastSig) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); lastSig = ''; } return; }
    const c = cfg(), L = T.L = layout(game), idle = now() - T.lastUse;
    const base = idle < c.idleFadeAfter ? c.activeAlpha : c.activeAlpha + (c.idleAlpha - c.activeAlpha) * Math.min(1, (idle - c.idleFadeAfter) / c.fadeSeconds);
    const held = new Set([...T.pointers.values()].filter((p) => p.role === 'btn').map((p) => p.btn));
    const sig = [canvas.width, canvas.height, Object.keys(sh).join(), [...held].join(), T.sneakOn, T.menuOpen, base.toFixed(3), L.size, L.R, L.swap, L.g.x, L.g.w,
      [...T.pointers.values()].map((p) => `${p.role}${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.bx || 0)},${Math.round(p.by || 0)}`).join(';'), L.ex.map((r) => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';')].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    for (const b of L.buttons) {
      if (!sh[b.id]) continue;
      const lit = held.has(b.id) || (b.id === 'sneak' && T.sneakOn) || (b.id === 'menu' && T.menuOpen);
      const a = lit ? c.pressedAlpha : b.id === 'interact' ? Math.max(base, c.activeAlpha) : base;
      sprite('ui.touch', 0, b.cx, b.cy, b.size, a);
      if (lit) sprite('ui.touch', 0, b.cx, b.cy, b.size, a * 0.6);               // lit: a brighter base
      sprite('ui.touch', FRAME[b.id], b.cx, b.cy, b.size, a);
      if (b.id === 'sneak' && T.sneakOn) label(AQ.t('touch.on'), b.cx, b.y + b.h + 2, a);
    }
    if (sh.stick) {
      const st = [...T.pointers.values()].find((p) => p.role === 'stick');
      const bx = st ? st.bx : L.rest.x, by = st ? st.by : L.rest.y;
      const restFree = !L.ex.some((r) => over(r, { x: bx - L.R, y: by - L.R, w: L.R * 2, h: L.R * 2 }));
      if (st || restFree) {
        const a = st ? c.pressedAlpha : base;
        sprite('ui.stick', 0, bx, by, L.R * 2, a);
        const live = st ? Math.hypot(st.x - bx, st.y - by) : 0, ang = st ? Math.atan2(st.y - by, st.x - bx) : 0;
        sprite('ui.stick', 1, bx + Math.cos(ang) * live, by + Math.sin(ang) * live, L.R * 2, a);
      }
    }
    if (game.state === 'touchtest') drawFingers();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
  // TOUCH TEST: a numbered ring under every finger (gold: a button, cyan: the joystick, white: a tap)
  function drawFingers() {
    let n = 0;
    for (const p of T.pointers.values()) {
      n++;
      const r = 26, col = p.role === 'btn' ? '#ffd25a' : p.role === 'stick' ? '#6ef0ef' : p.role === 'tap' ? '#ffffff' : '#8aa4b8';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      label(String(n), p.x, p.y - r - 22, 1);
    }
  }
  // TOUCH TEST: what's held right now (names: touchtest.btn.<id>)
  T.heldNames = function () {
    const out = [];
    for (const p of T.pointers.values()) if (p.role === 'btn' && out.indexOf(p.btn) < 0) out.push(p.btn);
    if (T.sneakOn && out.indexOf('sneak') < 0) out.push('sneak');
    return out.map((id) => AQ.t(`touchtest.btn.${id}`));
  };
  T.leaveTest = function () { T.releaseAll(); setSneak(false); };
  return T;
})();
