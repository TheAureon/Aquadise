// Reusable fade-to-black scene transition (classic "screen goes dark, you're somewhere else").
//   AQ.Transition.go(midFn, { out, hold, in, done })
// Fades out, calls midFn while the screen is fully black (swap scenes / move the player there),
// holds a moment, then fades back in. Gameplay input is frozen while it runs.
// Timings default to AQ.TUNING.transition.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Transition = (function () {
  const T = { active: false, phase: 'idle', t: 0, alpha: 0 };

  T.go = function (mid, opts = {}) {
    if (T.active) return false;
    const c = AQ.TUNING.transition;
    T.active = true; T.phase = 'out'; T.t = 0; T.mid = mid; T.done = opts.done;
    if (AQ.Audio) AQ.Audio.play('transition');
    T.dOut = opts.out != null ? opts.out : c.fadeOut;
    T.dHold = opts.hold != null ? opts.hold : c.hold;
    T.dIn = opts.in != null ? opts.in : c.fadeIn;
    return true;
  };

  T.update = function (dt) {
    if (!T.active) { T.alpha = 0; return; }
    T.t += dt;
    if (T.phase === 'out') {
      T.alpha = T.dOut > 0 ? Math.min(1, T.t / T.dOut) : 1;
      if (T.t >= T.dOut) { T.phase = 'hold'; T.t = 0; T.alpha = 1; const m = T.mid; T.mid = null; if (m) m(); }
    } else if (T.phase === 'hold') {
      T.alpha = 1;
      if (T.t >= T.dHold) { T.phase = 'in'; T.t = 0; }
    } else if (T.phase === 'in') {
      T.alpha = T.dIn > 0 ? Math.max(0, 1 - T.t / T.dIn) : 0;
      if (T.t >= T.dIn) { T.active = false; T.phase = 'idle'; T.alpha = 0; const d = T.done; T.done = null; if (d) d(); }
    }
  };

  // Is the player's control frozen right now?
  T.blocking = () => T.active;

  // Drawn last, over everything. Alpha is stepped (8 levels) for a retro palette-fade feel.
  T.draw = function (ctx) {
    if (T.alpha <= 0) return;
    const a = Math.ceil(T.alpha * 8) / 8;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, AQ.TUNING.view.w, AQ.TUNING.view.h);
  };

  return T;
})();
