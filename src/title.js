// Title screen ("homepage"): the live world drifts by behind the logo and a small menu.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Title = (function () {
  const U = AQ.U, F = () => AQ.Font;
  const T = { sel: 0, t: 0, camX: 820, camY: 190, panel: null, confirmNew: 0, items: [] };
  // stand-in "player" for creatures while the camera drifts: silent and still
  const ghost = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, sneaking: false, noise: () => 0, knock() {} };

  T.open = function (game) {
    game.state = 'title';
    T.sel = 0; T.panel = null; T.confirmNew = 0;
    T.camX = U.clamp(game.player.x - 120, 820, AQ.World.w - 400);
  };

  function hasProgress() {
    const S = AQ.State;
    return Object.keys(S.collection).length > 0 || S.upgrades.net > 1 || S.upgrades.speed > 1;
  }
  function menu() {
    const items = [];
    if (hasProgress()) items.push({ id: 'continue', label: 'CONTINUE' });
    items.push({ id: 'new', label: T.confirmNew > 0 ? 'NEW GAME? CLICK AGAIN' : 'NEW GAME' });
    items.push({ id: 'controls', label: 'CONTROLS' });
    return items.map((it, i) => Object.assign(it, { x: 110, y: 102 + i * 15, w: 100, h: 12 }));
  }

  T.update = function (dt, game) {
    const I = AQ.Input, m = I.mouse, W = AQ.World;
    T.t += dt;
    T.confirmNew = Math.max(0, T.confirmNew - dt);
    // slow drift to the right along the world, hugging the water surface / seabed
    T.camX += dt * 16;
    if (T.camX > W.w - 200) T.camX = 820;
    const floor = W.floorY[Math.round(U.clamp(T.camX, 0, W.w - 1))] || W.sea + 100;
    const want = U.clamp(floor - 60, W.sea + 40, W.sea + 140);
    T.camY += (want - T.camY) * Math.min(1, dt * 0.6);
    const cam = AQ.Camera;
    cam.x = T.camX; cam.y = T.camY; cam.clamp(W);
    ghost.x = cam.x; ghost.y = cam.y + 400;
    AQ.Creatures.update(dt, { player: ghost });
    AQ.Terrain.update(dt, cam);
    AQ.FX.update(dt, W);

    T.items = menu();
    if (T.panel) {
      if (I.rawPressed('Escape', 'Enter', 'Space') || m.pressed[0]) T.panel = null;
      return;
    }
    if (I.rawPressed('ArrowUp', 'KeyW')) T.sel = (T.sel + T.items.length - 1) % T.items.length;
    if (I.rawPressed('ArrowDown', 'KeyS')) T.sel = (T.sel + 1) % T.items.length;
    const hover = T.items.findIndex((r) => m.x >= r.x && m.y >= r.y && m.x < r.x + r.w && m.y < r.y + r.h);
    if (hover >= 0 && (m.pressed[0] || I.mouse.x !== T.lastMX || I.mouse.y !== T.lastMY)) T.sel = hover;
    T.lastMX = m.x; T.lastMY = m.y;
    if (I.rawPressed('Enter', 'Space') || (m.pressed[0] && hover >= 0)) choose(T.items[T.sel], game);
  };

  function choose(it, game) {
    if (!it) return;
    if (it.id === 'continue') start(game);
    else if (it.id === 'new') {
      if (hasProgress() && T.confirmNew <= 0) { T.confirmNew = 3; return; }
      AQ.Save.newGame(game);
      start(game);
    } else if (it.id === 'controls') T.panel = 'controls';
  }
  function start(game) {
    AQ.FX.list.length = 0;
    game.state = 'play';
    AQ.Camera.snap(game.player);
    AQ.HUD.helpT = 10; AQ.HUD.bannerT = 0; AQ.HUD.lastZone = '';
  }

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
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const each = (fn) => [...text].forEach((ch, li) => (LOGO[ch] || []).forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') fn((li * 6 + rx) * px, ry * px, ry); })));
    g.fillStyle = '#0b2a45'; each((x, y) => g.fillRect(x + 2, y + 3, px, px));            // drop shadow
    g.fillStyle = '#0b2a45'; each((x, y) => g.fillRect(x, y + 1, px + 2, px + 2));        // outline
    each((x, y, ry) => { g.fillStyle = RAMP[ry]; g.fillRect(x + 1, y + 1, px, px); });    // gradient fill
    g.fillStyle = 'rgba(255,255,255,0.9)'; each((x, y, ry) => { if (ry === 0) g.fillRect(x + 1, y + 1, px, 1); });
    return c;
  }
  function logo(g, x, y) {
    if (!T.logoCanvas) T.logoCanvas = buildLogo('AQUADISE', 3);
    const c = T.logoCanvas;
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(y));
  }

  T.draw = function (g) {
    // soft darkening at the top and bottom so the text reads over the scene
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(4,14,28,${(0.4 * (1 - i / 16)).toFixed(3)})`;
      g.fillRect(0, i * 3, 320, 3);
      g.fillRect(0, 177 - i * 3, 320, 3);
    }
    logo(g, 160, 24 + Math.round(Math.sin(T.t * 1.4) * 1.5));
    F().draw(g, 'A COZY DIVE INTO AN UNDERWATER WORLD', 160, 64, '#d6f3ff', { align: 'center', shadow: 'rgba(4,12,24,0.8)' });

    if (T.panel === 'controls') {
      g.fillStyle = 'rgba(6,18,34,0.9)'; g.fillRect(40, 80, 240, 86);
      const rows = [
        ['MOVE / SWIM', 'WASD OR ARROWS'], ['JUMP (ON LAND)', 'W / UP'], ['SNEAK', 'HOLD SHIFT'],
        ['NET', 'SPACE OR CLICK'], ['PRY', 'HOLD THE NET'], ['BAIT', 'B OR RIGHT CLICK'],
        ['AQUARIUM / LOG / MAP', 'TAB / L / M'], ['PAUSE', 'ESC']
      ];
      rows.forEach(([a, b], i) => { F().draw(g, a, 50, 86 + i * 9, '#9fd3ee'); F().draw(g, b, 270, 86 + i * 9, '#ffffff', { align: 'right' }); });
      return;
    }
    T.items.forEach((it, i) => {
      const on = i === T.sel;
      if (!on) { g.fillStyle = 'rgba(8,30,52,0.35)'; g.fillRect(it.x + 10, it.y, it.w - 20, it.h); }
      if (on) {
        g.fillStyle = 'rgba(8,30,52,0.75)'; g.fillRect(it.x, it.y, it.w, it.h);
        g.fillStyle = '#6ef0ef'; g.fillRect(it.x, it.y + it.h - 1, it.w, 1);
        F().draw(g, '>', it.x + 4 + Math.round(Math.sin(T.t * 6)), it.y + 4, '#6ef0ef', { shadow: false });
      }
      F().draw(g, it.label, it.x + it.w / 2, it.y + 4, on ? '#ffffff' : '#b7d6e6', { align: 'center', shadow: 'rgba(4,12,24,0.8)' });
    });
    F().draw(g, 'ARROWS + ENTER OR CLICK', 160, 170, '#7fa4ba', { align: 'center', shadow: 'rgba(4,12,24,0.8)' });
  };

  return T;
})();
