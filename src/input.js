// Keyboard + mouse input. Mouse coordinates are reported in low-res canvas pixels.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Input = (function () {
  const down = new Set();
  const pressed = new Set();   // pressed this frame
  const released = new Set();
  const mouse = { x: 0, y: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], inside: false, wheel: 0 };
  let canvas = null;
  let enabled = true;

  const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

  function attach(c) {
    canvas = c;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!down.has(e.code)) pressed.add(e.code);
      down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      down.delete(e.code);
      released.add(e.code);
    });
    window.addEventListener('blur', () => { down.clear(); mouse.down = [false, false, false]; });
    window.addEventListener('mousemove', (e) => updateMouse(e));
    window.addEventListener('mousedown', (e) => {
      if (e.target !== canvas) return;
      updateMouse(e);
      mouse.down[e.button] = true; mouse.pressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (mouse.down[e.button]) mouse.released[e.button] = true;
      mouse.down[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  function updateMouse(e) {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
    mouse.inside = mouse.x >= 0 && mouse.y >= 0 && mouse.x < canvas.width && mouse.y < canvas.height;
  }

  function endFrame() {
    pressed.clear(); released.clear();
    mouse.pressed = [false, false, false]; mouse.released = [false, false, false];
    mouse.wheel = 0;
  }

  const any = (codes, set) => codes.some((c) => set.has(c));

  return {
    attach, endFrame, mouse,
    setEnabled(v) { enabled = v; },
    isDown: (...codes) => enabled && any(codes, down),
    wasPressed: (...codes) => enabled && any(codes, pressed),
    wasReleased: (...codes) => any(codes, released),
    rawPressed: (...codes) => any(codes, pressed),
    axis() {
      if (!enabled) return { x: 0, y: 0 };
      let x = 0, y = 0;
      if (any(['ArrowLeft', 'KeyA'], down)) x -= 1;
      if (any(['ArrowRight', 'KeyD'], down)) x += 1;
      if (any(['ArrowUp', 'KeyW'], down)) y -= 1;
      if (any(['ArrowDown', 'KeyS'], down)) y += 1;
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    }
  };
})();
