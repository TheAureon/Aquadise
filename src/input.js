// Keyboard + mouse input. Mouse coordinates are reported in low-res canvas pixels.
// Touch (src/touch.js) comes in through here too: on-screen buttons hold "virtual keys" (vPress /
// vRelease: the same key codes as the keyboard, kept in their own set so a real key and a button never
// cancel each other out), the joystick sets `stick` (read by axis() when no direction key is held), and
// taps on the game act as the left mouse button (touchMouse).
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Input = (function () {
  const down = new Set();
  const pressed = new Set();   // pressed this frame
  const released = new Set();
  const vdown = new Set();     // held by on-screen touch buttons
  const stick = { x: 0, y: 0 };   // the touch joystick (-1..1, dead zone already removed)
  const mouse = { x: 0, y: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], inside: false, wheel: 0, wheelPx: 0 };
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
    window.addEventListener('blur', releaseAll);
    // (with the testing flag debug.forceTouch, src/touch.js turns the mouse's left button into a finger)
    const touchOwns = (e) => AQ.Touch && AQ.Touch.ownsMouse(e);
    window.addEventListener('mousemove', (e) => { if (!touchOwns(e)) updateMouse(e); });
    window.addEventListener('mousedown', (e) => {
      if (e.target !== canvas || touchOwns(e)) return;
      updateMouse(e);
      mouse.down[e.button] = true; mouse.pressed[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (touchOwns(e)) return;
      if (mouse.down[e.button]) mouse.released[e.button] = true;
      mouse.down[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      mouse.wheel += Math.sign(e.deltaY);
      // the actual distance too (lines / pages -> px), for smooth scrolling with trackpads and wheels alike
      mouse.wheelPx += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      e.preventDefault();
    }, { passive: false });
  }

  // let go of everything (window lost focus, a touch was cancelled...): nothing stays stuck down
  function releaseAll() {
    for (const c of down) released.add(c);
    for (const c of vdown) released.add(c);
    down.clear(); vdown.clear();
    for (let b = 0; b < 3; b++) { if (mouse.down[b]) mouse.released[b] = true; mouse.down[b] = false; }
    stick.x = stick.y = 0;
    if (AQ.Touch) AQ.Touch.releaseAll(true);
  }
  // virtual keys (touch buttons)
  function vPress(code) { if (!down.has(code) && !vdown.has(code)) pressed.add(code); vdown.add(code); }
  function vRelease(code) { if (vdown.delete(code) && !down.has(code)) released.add(code); }
  // a finger acting as the left mouse button: phase 'down' | 'move' | 'up' | 'cancel'
  function touchMouse(clientX, clientY, phase) {
    if (clientX != null) updateMouse({ clientX, clientY });
    if (phase === 'down') { mouse.down[0] = true; mouse.pressed[0] = true; }
    else if (phase === 'up' || phase === 'cancel') { if (mouse.down[0]) mouse.released[0] = true; mouse.down[0] = false; }
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
    mouse.wheel = 0; mouse.wheelPx = 0;
  }

  const any = (codes, set) => codes.some((c) => set.has(c));

  return {
    attach, endFrame, mouse, stick, vPress, vRelease, touchMouse, releaseAll,
    setEnabled(v) { enabled = v; },
    isDown: (...codes) => enabled && (any(codes, down) || any(codes, vdown)),
    wasPressed: (...codes) => enabled && any(codes, pressed),
    wasReleased: (...codes) => any(codes, released),
    rawPressed: (...codes) => any(codes, pressed),
    // swallow a press so nothing else acts on it this frame (e.g. Esc that only closed a tip)
    consume: (...codes) => codes.forEach((c) => pressed.delete(c)),
    anyPressed: () => pressed.size > 0,
    axis() {
      if (!enabled) return { x: 0, y: 0 };
      let x = 0, y = 0;
      const k = AQ.TUNING.keys;                                   // bindings: AQ.TUNING.keys (src/keys.js)
      if (any(k.left, down)) x -= 1;
      if (any(k.right, down)) x += 1;
      if (any(k.up, down)) y -= 1;
      if (any(k.down, down)) y += 1;
      if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      if (!x && !y && (stick.x || stick.y)) return { x: stick.x, y: stick.y };   // no direction key held: the touch stick
      return { x, y };
    }
  };
})();
