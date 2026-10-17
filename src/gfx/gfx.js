// The one place a finished frame is "presented" (docs/GRAPHICS_PLAN.md).
//   AQ.Gfx.beginFrame(game)   a new frame starts (before anything is drawn)
//   AQ.Gfx.markWorld()        the world part of the frame is finished: everything drawn after this is
//                             interface (HUD, tips, menus, buttons) and is never touched by effects
//   AQ.Gfx.present(game)      the frame is done: show it
// The game still draws everything into the one 320 x 180 canvas (#game) with the 2D canvas API.
// CLASSIC (the only path in this stage) is exactly the old behaviour: #game itself is what you see,
// scaled up by CSS (image-rendering: pixelated), and all three calls do nothing.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Gfx = (function () {
  const X = { mode: 'classic', frame: 0, worldMarked: false, canvas: null };
  X.init = function (canvas) { X.canvas = canvas; };
  X.beginFrame = function () { X.frame++; X.worldMarked = false; };
  X.markWorld = function () {
    if (X.worldMarked) return;                                       // (once a frame: the first boundary wins)
    X.worldMarked = true;
  };
  X.present = function () { if (!X.worldMarked) X.markWorld(); };
  return X;
})();
