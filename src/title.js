// Title screen ("homepage"): the live world drifts by behind the logo and the menu.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Title = (function () {
  const U = AQ.U, R = U.R, F = () => AQ.Font;
  const T = { sel: 0, t: 0, camX: 820, camY: 190, panel: null, confirmNew: 0, items: [], bubbles: [], diverT: 4, seg: 0, fade: 0, mantaT: 6 };
  const TOUR = [[820, 2300], [3990, 4860], [4950, 5620]];
  // stand-in "player" for creatures while the camera drifts: silent and still
  const ghost = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, sneaking: false, noise: () => 0, knock() {} };
  const SH = 'rgba(4,12,24,0.85)';

  T.open = function (game) {
    game.state = 'title';
    T.sel = 0; T.panel = null; T.confirmNew = 0;
    T.seg = 0; T.camX = TOUR[0][0]; T.fade = 0; T.switched = false;
    AQ.FX.list.length = 0;
  };

  function hasProgress() {
    const S = AQ.State;
    return Object.keys(S.collection).length > 0 || S.upgrades.net > 1 || S.upgrades.speed > 1 || (AQ.Game && AQ.Game.scene && AQ.Game.scene !== 'world');
  }
  function menu() {
    const items = [];
    if (hasProgress()) items.push({ id: 'continue', label: 'CONTINUE', icon: 'play' });
    items.push({ id: 'new', label: T.confirmNew > 0 ? 'START OVER? CLICK AGAIN' : 'NEW GAME', icon: 'plus' });
    items.push({ id: 'aquarium', label: 'AQUARIUM', icon: 'fish' });
    items.push({ id: 'log', label: 'COLLECTION', icon: 'book' });
    items.push({ id: 'controls', label: 'CONTROLS', icon: 'pad' });
    const y0 = items.length === 5 ? 74 : 80;
    return items.map((it, i) => Object.assign(it, { x: 108, y: y0 + i * 14, w: 104, h: 11 }));
  }

  // ---------------------------------------------------------------- update
  T.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, W = AQ.World;
    T.t += dt;
    T.confirmNew = Math.max(0, T.confirmNew - dt);
    // slow drift through the prettiest stretches (coral + ruins, kelp, mangroves), cross-fading between them
    const seg = TOUR[T.seg % TOUR.length];
    T.camX += dt * 16;
    if (T.camX > seg[1] - 1.5 * 16 && T.fade <= 0) T.fade = 1.6;      // start fading out near the end
    if (T.fade > 0) {
      T.fade -= dt;
      if (T.fade < 0.8 && !T.switched) { T.seg++; T.camX = TOUR[T.seg % TOUR.length][0]; T.camY = W.sea + 90; T.switched = true; }
      if (T.fade <= 0) { T.fade = 0; T.switched = false; }
    }
    const floor = W.floorY[Math.round(U.clamp(T.camX, 0, W.w - 1))] || W.sea + 100;
    const want = U.clamp(floor - 60, W.sea + 40, W.sea + 140);
    T.camY += (want - T.camY) * Math.min(1, dt * 0.6);
    const cam = AQ.Camera;
    cam.x = T.camX; cam.y = T.camY; cam.clamp(W);
    ghost.x = cam.x; ghost.y = cam.y + 400;
    AQ.Creatures.update(dt, { player: ghost });
    AQ.Terrain.update(dt, cam);
    AQ.FX.update(dt, W);

    // screen-space bubbles drifting up past the menu
    if (R.chance(dt * 5)) T.bubbles.push({ x: R.range(0, 320), y: 184, v: R.range(10, 22), r: R.chance(0.25) ? 2 : 1, p: R() * 6 });
    for (let i = T.bubbles.length - 1; i >= 0; i--) { const b = T.bubbles[i]; b.y -= b.v * dt; b.x += Math.sin(T.t * 2 + b.p) * 4 * dt; if (b.y < -4) T.bubbles.splice(i, 1); }
    // the robot diver swims past every so often
    T.diverT += dt;
    if (T.diverT > 26) T.diverT = 0;
    if (T.diverT < 16 && R.chance(dt * 3)) T.bubbles.push({ x: diverX() + 6, y: diverY() - 3, v: R.range(8, 14), r: 1, p: R() * 6 });

    T.items = menu();
    if (T.panel) {
      if (I.rawPressed('Escape', 'Enter', 'Space') || m.pressed[0]) T.panel = null;
      return;
    }
    if (T.sel >= T.items.length) T.sel = 0;
    if (I.rawPressed('ArrowUp', 'KeyW')) T.sel = (T.sel + T.items.length - 1) % T.items.length;
    if (I.rawPressed('ArrowDown', 'KeyS')) T.sel = (T.sel + 1) % T.items.length;
    const hover = T.items.findIndex((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (hover >= 0 && (m.pressed[0] || m.x !== T.lastMX || m.y !== T.lastMY)) T.sel = hover;
    T.lastMX = m.x; T.lastMY = m.y;
    if (I.rawPressed('Enter', 'Space') || (m.pressed[0] && hover >= 0)) choose(T.items[T.sel], game);
  };
  const diverX = () => -30 + (T.diverT / 16) * 380;
  const diverY = () => 165 + Math.sin(T.t * 1.3) * 2;

  function choose(it, game) {
    if (!it) return;
    if (it.id === 'continue') start(game);
    else if (it.id === 'new') {
      if (hasProgress() && T.confirmNew <= 0) { T.confirmNew = 3; return; }
      AQ.Save.newGame(game);
      start(game);
    } else if (it.id === 'aquarium') { AQ.Aquarium.open(game, 'title'); }
    else if (it.id === 'log') { AQ.LogUI.open(game, 'title'); }
    else if (it.id === 'controls') T.panel = 'controls';
  }
  function start(game) {
    AQ.FX.list.length = 0;
    game.state = 'play';
    AQ.Camera.snap(game.player, AQ.Scenes.worldOf(game));
    AQ.HUD.helpT = 10; AQ.HUD.bannerT = 0; AQ.HUD.lastZone = '';
  }

  // ---------------------------------------------------------------- logo
  // Hand-made 5x7 logo glyphs (the HUD font is too small to scale up nicely).
  const LOGO = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####']
  };
  const RAMP = ['#f2feff', '#d8faff', '#b6f2fb', '#94e8f4', '#74dcec', '#5bcde2', '#4ab9d4'];
  function buildLogo(text, px) {
    const cols = text.length * 6 - 1, W = cols * px + 4, H = 7 * px + 4;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const c = mk(), mask = mk(), g = c.getContext('2d'), mg = mask.getContext('2d');
    const each = (fn) => [...text].forEach((ch, li) => (LOGO[ch] || []).forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') fn((li * 6 + rx) * px, ry * px, ry); })));
    g.fillStyle = '#0b2a45'; each((x, y) => g.fillRect(x + 2, y + 3, px, px));            // drop shadow
    g.fillStyle = '#0b2a45'; each((x, y) => g.fillRect(x, y + 1, px + 2, px + 2));        // outline
    each((x, y, ry) => { g.fillStyle = RAMP[ry]; g.fillRect(x + 1, y + 1, px, px); });    // gradient fill
    g.fillStyle = 'rgba(255,255,255,0.9)'; each((x, y, ry) => { if (ry === 0) g.fillRect(x + 1, y + 1, px, 1); });
    mg.fillStyle = '#ffffff'; each((x, y) => mg.fillRect(x + 1, y + 1, px, px));          // shimmer mask
    return { c, mask };
  }
  function logo(g, x, y) {
    if (!T.logo) T.logo = buildLogo('AQUADISE', 3);
    const { c, mask } = T.logo, lx = Math.round(x - c.width / 2), ly = Math.round(y);
    g.drawImage(c, lx, ly);
    // a highlight sweeps across the letters every few seconds
    const cyc = T.t % 5;
    if (cyc < 1.4) {
      const bx = Math.round((cyc / 1.4) * (c.width + 24)) - 12;
      g.save();
      g.beginPath();
      for (let r = 0; r < c.height; r++) g.rect(lx + bx - Math.floor(r / 2), ly + r, 4, 1);   // slanted band
      g.clip();
      g.globalAlpha = 0.75;
      g.drawImage(mask, lx, ly);
      g.restore();
    }
  }

  // ---------------------------------------------------------------- icons (7x7)
  const ICONS = {
    play: ['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....'],
    plus: ['...#...', '...#...', '...#...', '#######', '...#...', '...#...', '...#...'],
    fish: ['.......', '..###.#', '.#####.', '##.####', '.#####.', '..###.#', '.......'],
    book: ['.##.##.', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '.##.##.', '...#...'],
    pad:  ['.......', '.#####.', '#.#...#', '###.#.#', '#.#...#', '.#####.', '.......']
  };
  function icon(g, name, x, y, col) {
    g.fillStyle = col;
    (ICONS[name] || []).forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') g.fillRect(x + rx, y + ry, 1, 1); }));
  }
  // pill-shaped button with clipped corners
  function pill(g, r, fill, border) {
    g.fillStyle = fill;
    g.fillRect(r.x + 1, r.y, r.w - 2, r.h); g.fillRect(r.x, r.y + 1, r.w, r.h - 2);
    if (border) {
      g.fillStyle = border;
      g.fillRect(r.x + 1, r.y - 1, r.w - 2, 1); g.fillRect(r.x + 1, r.y + r.h, r.w - 2, 1);
      g.fillRect(r.x - 1, r.y + 1, 1, r.h - 2); g.fillRect(r.x + r.w, r.y + 1, 1, r.h - 2);
      g.fillRect(r.x, r.y, 1, 1); g.fillRect(r.x + r.w - 1, r.y, 1, 1); g.fillRect(r.x, r.y + r.h - 1, 1, 1); g.fillRect(r.x + r.w - 1, r.y + r.h - 1, 1, 1);
    }
  }

  // ---------------------------------------------------------------- background extras
  // Drawn between the water backdrop and the terrain: a sunburst of light, a distant fish school,
  // and now and then a big manta ray gliding through the far water.
  T.drawBack = function (g) {
    const t = T.t;
    g.save();
    for (let i = 0; i < 9; i++) {
      const a = -0.5 + i * 0.12 + Math.sin(t * 0.2 + i) * 0.02, len = 260, w = 0.035 + (i % 3) * 0.015;
      g.globalAlpha = 0.045 + 0.02 * Math.sin(t * 0.6 + i * 1.3);
      g.fillStyle = '#eafcff';
      g.beginPath(); g.moveTo(160, -30);
      g.lineTo(160 + Math.sin(a - w) * len, -30 + Math.cos(a - w) * len); g.lineTo(160 + Math.sin(a + w) * len, -30 + Math.cos(a + w) * len);
      g.fill();
    }
    g.restore();
    // distant school (dark, slow, wavy formation)
    const sx = ((t * 9) % 420) - 60, sy = 70 + Math.sin(t * 0.3) * 8;
    g.fillStyle = 'rgba(14,52,82,0.45)';
    for (let i = 0; i < 22; i++) {
      const fx = Math.round(sx - (i % 7) * 7 - Math.floor(i / 7) * 3), fy = Math.round(sy + Math.floor(i / 7) * 5 + Math.sin(t * 2 + i) * 1.5);
      g.fillRect(fx, fy, 3, 1); g.fillRect(fx - 1, fy - 1, 1, 1); g.fillRect(fx - 1, fy + 1, 1, 1);
    }
    // manta ray silhouette every ~30s
    T.mantaT += 1 / 60;
    const mp = (T.mantaT % 30) / 18;
    if (mp < 1) {
      const mx = 360 - mp * 440, my = 52 + Math.sin(mp * 6) * 6, flap = Math.sin(t * 1.6) * 3;
      g.fillStyle = 'rgba(10,40,66,0.38)';
      for (let i = -14; i <= 14; i++) { const h = Math.max(1, Math.round(3 - Math.abs(i) / 6)); g.fillRect(Math.round(mx + i), Math.round(my + Math.abs(i) * 0.12 * flap / 3 - h / 2), 1, h); }
      g.fillRect(Math.round(mx + 14), Math.round(my), 10, 1);    // tail
    }
  };

  // ---------------------------------------------------------------- draw
  T.draw = function (g) {
    // bokeh: big soft light dots drifting in front
    for (let i = 0; i < 10; i++) {
      const bx = (i * 73 + T.t * (4 + i % 3)) % 340 - 10, by = (i * 41 + Math.sin(T.t * 0.4 + i) * 10) % 170 + 5;
      g.fillStyle = `rgba(220,250,255,${0.06 + (i % 3) * 0.03})`;
      g.fillRect(Math.round(bx) - 1, Math.round(by), 3, 1); g.fillRect(Math.round(bx), Math.round(by) - 1, 1, 3);
    }
    // soft vignette at the top and bottom so text reads over the scene
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(4,14,28,${(0.45 * (1 - i / 16)).toFixed(3)})`;
      g.fillRect(0, i * 3, 320, 3);
      g.fillRect(0, 177 - i * 3, 320, 3);
    }
    // bubbles
    T.bubbles.forEach((b) => {
      g.fillStyle = 'rgba(220,250,255,0.55)';
      if (b.r > 1) { g.fillRect(Math.round(b.x) - 1, Math.round(b.y), 3, 1); g.fillRect(Math.round(b.x), Math.round(b.y) - 1, 1, 3); }
      else g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
    });
    // the robot diver swimming past along the bottom
    if (T.diverT < 16) AQ.Assets.draw(g, 'player', 'swim', diverX(), diverY(), { t: T.t });

    logo(g, 160, 14 + Math.round(Math.sin(T.t * 1.4) * 1.5));
    F().draw(g, 'A COZY DIVE INTO AN UNDERWATER WORLD', 160, 47, '#e2f7ff', { align: 'center', shadow: SH });
    // little wave divider
    for (let x = 128; x < 192; x++) {
      const y = 57 + Math.round(Math.sin(x * 0.5 + T.t * 3) * 1);
      g.fillStyle = `rgba(110,240,239,${(0.9 - Math.abs(x - 160) / 36).toFixed(2)})`;
      g.fillRect(x, y, 1, 1);
    }

    if (T.panel === 'controls') {
      const box = { x: 40, y: 66, w: 240, h: 92 };
      pill(g, box, 'rgba(6,20,38,0.92)', 'rgba(110,240,239,0.6)');
      F().draw(g, 'CONTROLS', 160, 71, '#6ef0ef', { align: 'center', shadow: false });
      const rows = [
        ['MOVE / SWIM', 'WASD OR ARROWS'], ['JUMP', 'SPACE'], ['SNEAK', 'HOLD SHIFT'],
        ['NET', 'LEFT CLICK'], ['PRY', 'HOLD LEFT CLICK'], ['BAIT', 'B OR RIGHT CLICK'],
        ['AQUARIUM / LOG / MAP', 'TAB / L / M'], ['PAUSE', 'ESC']
      ];
      rows.forEach(([a, b], i) => { F().draw(g, a, 50, 82 + i * 9, '#9fd3ee', { shadow: false }); F().draw(g, b, 270, 82 + i * 9, '#ffffff', { align: 'right', shadow: false }); });
      return;
    }
    T.items.forEach((it, i) => {
      const on = i === T.sel;
      pill(g, it, on ? 'rgba(14,52,82,0.88)' : 'rgba(8,28,48,0.55)', on ? '#6ef0ef' : null);
      if (!on) { g.fillStyle = 'rgba(180,230,245,0.18)'; g.fillRect(it.x + 1, it.y, it.w - 2, 1); }
      const nudge = on ? Math.round(Math.sin(T.t * 5)) : 0;
      icon(g, it.icon, it.x + 5 + nudge, it.y + 2, on ? '#6ef0ef' : '#7fb6cc');
      F().draw(g, it.label, it.x + it.w / 2 + 5, it.y + 3, on ? '#ffffff' : '#c3dfec', { align: 'center', shadow: on ? false : SH });
    });
    const c = AQ.Collection.progress();
    F().draw(g, `${c.caught}/${c.total} SPECIES`, 316, 172, '#7fa4ba', { align: 'right', shadow: SH });
    F().draw(g, 'ARROWS + ENTER OR CLICK', 4, 172, '#7fa4ba', { shadow: SH });
    T.drawFade(g);
  };
  // scene cross-fade (dips to a deep-sea blue between tour stops)
  T.drawFade = function (g) {
    if (T.fade <= 0) return;
    const a = T.fade > 0.8 ? (1.6 - T.fade) / 0.8 : T.fade / 0.8;
    g.fillStyle = `rgba(6,22,40,${Math.min(1, a).toFixed(3)})`; g.fillRect(0, 0, 320, 180);
  };

  return T;
})();
