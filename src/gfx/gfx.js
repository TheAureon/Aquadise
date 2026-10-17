// The one place a finished frame is "presented" (docs/GRAPHICS_PLAN.md).
//   AQ.Gfx.beginFrame(game)   a new frame starts (before anything is drawn)
//   AQ.Gfx.markWorld()        the world part of the frame is finished: everything drawn after this is
//                             interface (HUD, tips, menus, buttons) and is never touched by effects
//   AQ.Gfx.present(game)      the frame is done: show it
// The game draws everything into the one 320 x 180 canvas (#game) with the 2D canvas API, as always.
//
// GRAPHICS (SETTINGS > OPTIONS, saved in AQ.State.settings.graphics = { level, manual }):
//   CLASSIC  exactly the old look, no WebGL at all: #game itself is what you see (CSS, pixelated)
//   LOW / MEDIUM / HIGH  the shader layer: at markWorld #game is uploaded as the WORLD texture and
//            cleared; at present what was drawn since (the interface) is uploaded too, and one pass draws
//            both to #view (a WebGL canvas over #game): the world with colour grading, depth fog, bloom,
//            vignette and grain, the interface crisp on top. Both are upscaled "sharp bilinear".
// The first run picks a level (phones / tablets / weak machines start lower); a governor steps down one
// level if the frame rate stays low (never up; never over the player's own choice). No WebGL, a shader
// that won't compile, a lost GPU or a canvas WebGL may not read: CLASSIC, quietly. A restored GPU
// context comes back to the chosen level. Tuning: AQ.TUNING.graphics. Testing: AQ.TUNING.debug.gfx.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.Gfx = (function () {
  const X = { mode: 'classic', frame: 0, worldMarked: false, canvas: null, view: null, gl: null, supported: null, failed: '', lost: false,
    off: {}, overlay: false, fxSel: 0, fps: 60, ms: 0 };
  const LEVELS = ['high', 'medium', 'low', 'classic'];
  X.LEVELS = LEVELS;
  X.EFFECTS = ['grade', 'fog', 'bloom', 'vignette', 'grain', 'light', 'water', 'sky'];   // (each can be switched off for testing)
  const cfg = () => AQ.TUNING.graphics;
  const set = () => (AQ.State && AQ.State.settings) || {};
  const calm = () => !!(AQ.U && AQ.U.calm());
  let gl = null, R = null;                                         // R: the GL resources

  // ---------------------------------------------------------------- the chosen level
  X.saved = () => { const g = set().graphics; return g && LEVELS.indexOf(g.level) >= 0 ? g : null; };
  X.level = () => (X.saved() ? X.saved().level : 'classic');      // what the player has (or was given)
  X.active = () => X.mode !== 'classic';                           // the shader layer is drawing
  X.choose = function (level, manual) {
    if (LEVELS.indexOf(level) < 0) return;
    const s = AQ.State.settings = AQ.State.settings || {};
    s.graphics = { level, manual: !!manual };                      // (the governor's own steps are never "manual")
    if (AQ.Save) AQ.Save.dirty();
    X.apply();
  };
  // first run (no saved choice): a sensible default for this device, picked once and saved
  X.detect = function () {
    const c = cfg();
    if (!X.ensure()) return 'classic';
    const ua = navigator.userAgent || '', touchy = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    let level = 'high';
    if (touchy) level = 'medium';
    if (cores <= c.detect.weakCores || mem <= c.detect.weakMemoryGB) level = 'low';
    if (X.software) level = 'classic';                              // a software renderer (no real GPU): the effects would cost more than they give
    return level;
  };
  // after a game loads (settings known): the saved level, or a first-run pick
  X.setup = function () {
    if (!cfg().enabled) { X.toClassic(); return; }
    if (!X.saved()) { const lv = X.detect(); AQ.State.settings = AQ.State.settings || {}; AQ.State.settings.graphics = { level: lv, manual: false }; if (AQ.Save) AQ.Save.dirty(); }
    X.apply();
  };
  // switch to the saved level now (no reload, no flicker: the next frame simply draws the new way)
  X.apply = function () {
    const lv = X.level();
    if (lv === 'classic' || !cfg().enabled || X.lost) { X.toClassic(); return; }
    if (!X.ensure()) { X.toClassic(); return; }
    X.mode = lv;
    X.sync(true);
    if (X.view) X.view.style.display = 'block';
    if (X.canvas) X.canvas.style.opacity = '0';                    // (stays in the page: input and touch read its box)
  };
  X.toClassic = function () {
    X.mode = 'classic';
    if (X.view) X.view.style.display = 'none';
    if (X.canvas) X.canvas.style.opacity = '';
  };

  // ---------------------------------------------------------------- WebGL setup (once; again after a lost context)
  X.init = function (canvas) {
    X.canvas = canvas;
  };
  X.ensure = function () {
    if (R) return true;
    if (X.supported === false) return false;
    try {
      if (!X.view) {
        const v = document.createElement('canvas');
        v.id = 'view';
        v.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:1;display:none;';
        (X.canvas.parentNode || document.body).insertBefore(v, X.canvas.nextSibling);
        v.addEventListener('webglcontextlost', (e) => { e.preventDefault(); X.lost = true; R = null; gl = null; X.toClassic(); });
        v.addEventListener('webglcontextrestored', () => { X.lost = false; R = null; gl = null; X.apply(); });
        X.view = v;
      }
      gl = AQ.GL.context(X.view);
      if (!gl) return fail(AQ.GL.lastError);
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      X.renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      X.software = /swiftshader|llvmpipe|software|softpipe|basic render/i.test(X.renderer);
      const r = { progs: {} };
      for (const lv of ['high', 'medium', 'low']) {
        const pass = cfg().levels[lv].fxScale ? 'scene' : 'all';
        r.progs[lv] = AQ.GL.program(gl, AQ.Shaders.vertex, AQ.Shaders.composite(lv, pass), 'composite-' + lv); if (!r.progs[lv]) return fail(AQ.GL.lastError);
      }
      r.final = AQ.GL.program(gl, AQ.Shaders.vertex, AQ.Shaders.final, 'final'); if (!r.final) return fail(AQ.GL.lastError);
      r.fx = null;
      r.bright = AQ.GL.program(gl, AQ.Shaders.vertex, AQ.Shaders.bright, 'bright'); if (!r.bright) return fail(AQ.GL.lastError);
      r.blur = AQ.GL.program(gl, AQ.Shaders.vertex, AQ.Shaders.blur, 'blur'); if (!r.blur) return fail(AQ.GL.lastError);
      r.quad = AQ.GL.quad(gl);
      const W = AQ.TUNING.view.w, H = AQ.TUNING.view.h;
      r.world = AQ.GL.texture(gl, W, H); r.ui = AQ.GL.texture(gl, W, H); r.photo = AQ.GL.texture(gl, 1, 1);
      r.blank = AQ.GL.texture(gl, 1, 1);
      r.bloomA = {}; r.bloomB = {};
      for (const lv of ['high', 'medium']) {
        const d = cfg().levels[lv].bloomDiv, w = Math.max(8, Math.round(W / d)), h = Math.max(8, Math.round(H / d));
        r.bloomA[lv] = AQ.GL.target(gl, w, h); r.bloomB[lv] = AQ.GL.target(gl, w, h);
        if (!r.bloomA[lv] || !r.bloomB[lv]) return fail(AQ.GL.lastError);
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      R = r; X.supported = true; X.failed = '';
      return true;
    } catch (e) { return fail(e && e.message || String(e)); }
  };
  function fail(msg) { X.failed = msg || 'unknown'; X.supported = false; R = null; gl = null; if (cfg().logFailures) console.info('[Aquadise] graphics: CLASSIC (' + X.failed + ')'); return false; }

  // the visible canvas sits exactly over #game (same box), in device pixels (capped per level)
  let lastBox = '';
  X.sync = function (force) {
    if (!X.view || !X.canvas) return;
    const r = X.canvas.getBoundingClientRect(), lv = cfg().levels[X.mode] || cfg().levels.low;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, lv.maxDpr));
    const key = `${r.left}|${r.top}|${r.width}|${r.height}|${dpr}`;
    if (!force && key === lastBox) return;
    lastBox = key;
    const v = X.view;
    v.style.left = r.left + 'px'; v.style.top = r.top + 'px'; v.style.width = r.width + 'px'; v.style.height = r.height + 'px';
    v.width = Math.max(1, Math.round(r.width * dpr)); v.height = Math.max(1, Math.round(r.height * dpr));
  };

  // ---------------------------------------------------------------- each frame
  let lastT = 0;
  X.beginFrame = function (game) {
    X.frame++; X.worldMarked = false;
    timing();
    if (X.dt) X.t += X.dt / 1000 * (calm() ? cfg().calmSpeed : 1);  // the effects' own clock (slower with REDUCE FLASHING)
    if (X.active()) { const c = AQ.Render.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, X.canvas.width, X.canvas.height); }   // (the world texture starts clean)
  };
  function upload(tex) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, X.canvas);
  }
  X.markWorld = function () {
    if (X.worldMarked) return;                                       // (once a frame: the first boundary wins)
    X.worldMarked = true;
    if (!X.active() || !gl) return;
    try { upload(R.world); }
    catch (e) { X.tainted = true; fail('the game canvas could not be read by WebGL (' + (e && e.name) + ')'); X.toClassic(); return; }   // (file:// with images WebGL may not read)
    const c = AQ.Render.ctx; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, X.canvas.width, X.canvas.height); c.restore();
  };
  X.present = function (game) {
    if (!X.worldMarked) X.markWorld();
    if (!X.active() || !gl) return;
    try { upload(R.ui); } catch (e) { fail('upload: ' + (e && e.name)); X.toClassic(); return; }
    X.sync(false);
    try { draw(game, R.world, AQ.TUNING.view.w, AQ.TUNING.view.h, R.ui, null, X.view.width, X.view.height, X.mode); }
    catch (e) { fail('draw: ' + (e && e.message)); X.toClassic(); return; }
    governor(game);
  };

  // ---------------------------------------------------------------- the passes
  const U = new Float32Array(4);                                    // (reused: nothing allocated per frame)
  const LIGHTS = new Float32Array(24 * 4), LCOL = new Float32Array(24 * 4);
  function bind(prog) { gl.useProgram(prog.p); gl.bindBuffer(gl.ARRAY_BUFFER, R.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); }
  function tex(unit, t, loc) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (loc) gl.uniform1i(loc, unit); }
  function target(t, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, w, h); }
  // world texture (+ interface) -> the screen (fb null) or a framebuffer
  function draw(game, worldTex, tw, th, uiTex, fb, ow, oh, level) {
    const c = cfg(), lv = c.levels[level], P = params(game, level);
    // bloom: bright parts, downsampled, blurred twice (MEDIUM / HIGH)
    let bloomTex = R.blank;
    if (lv.bloom && !X.off.bloom) {
      const A = R.bloomA[level], B = R.bloomB[level];
      bind(R.bright); target(A, A.w, A.h);
      tex(0, worldTex, R.bright.u.uSrc); gl.uniform2f(R.bright.u.uSrcSize, tw, th); gl.uniform2f(R.bright.u.uBright, c.bloom.threshold, c.bloom.knee);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      bind(R.blur);
      for (let i = 0; i < lv.bloomPasses; i++) {
        target(B, B.w, B.h); tex(0, A.tex, R.blur.u.uSrc); gl.uniform2f(R.blur.u.uDir, 1 / A.w, 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
        target(A, A.w, A.h); tex(0, B.tex, R.blur.u.uSrc); gl.uniform2f(R.blur.u.uDir, 0, 1 / A.h); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      bloomTex = A.tex;
    }
    // MEDIUM / HIGH: the effects run at a whole number of times the world's size (not the screen's), then
    // a cheap second pass upscales sharply; the cost no longer grows with the window
    let fx = null;
    if (lv.fxScale) {
      const k = Math.max(1, Math.min(lv.fxScale, Math.ceil(Math.max(ow / tw, oh / th) - 0.01)));
      const fw = tw * k, fh = th * k;
      if (!R.fx || R.fx.w !== fw || R.fx.h !== fh) { AQ.GL.free(gl, R.fx); R.fx = AQ.GL.target(gl, fw, fh); if (!R.fx) throw new Error(AQ.GL.lastError); }
      fx = R.fx;
    }
    const prog = R.progs[level], u = prog.u;
    bind(prog);
    if (fx) target(fx, fx.w, fx.h); else { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, ow, oh); }
    tex(0, worldTex, u.uWorld); tex(1, uiTex || R.blank, u.uUI); tex(2, bloomTex, u.uBloom);
    gl.uniform2f(u.uTex, tw, th); if (u.uUITex) gl.uniform2f(u.uUITex, AQ.TUNING.view.w, AQ.TUNING.view.h); gl.uniform2f(u.uOut, fx ? fx.w : ow, fx ? fx.h : oh);
    gl.uniform3f(u.uBg, c.background[0], c.background[1], c.background[2]);
    gl.uniform4fv(u.uGradeA, P.gradeA); gl.uniform4fv(u.uGradeB, P.gradeB); gl.uniform3fv(u.uShadow, P.shadow);
    gl.uniform4fv(u.uFog, P.fog); gl.uniform4fv(u.uFogB, P.fogB); gl.uniform4fv(u.uFx, P.fx);
    if (u.uCam) {                                                    // (Stage 2 inputs: MEDIUM / HIGH only)
      gl.uniform4fv(u.uCam, P.cam); gl.uniform4fv(u.uScene, P.scene); gl.uniform4fv(u.uDark, P.dark);
      const n = packLights(level);
      gl.uniform4fv(u.uL, LIGHTS.subarray(0, AQ.Shaders.maxLights[level] * 4)); gl.uniform4fv(u.uLC, LCOL.subarray(0, AQ.Shaders.maxLights[level] * 4)); gl.uniform1f(u.uLN, n);
      gl.uniform4fv(u.uLampCol, P.lamp); if (u.uGlow) gl.uniform2f(u.uGlow, cfg().lights.glow, cfg().lights.glowDark); gl.uniform4fv(u.uWater, P.water); gl.uniform3fv(u.uRayCol, P.rayCol);
      gl.uniform4fv(u.uSurf, P.surf); gl.uniform3fv(u.uSurfCol, P.surfCol);
      gl.uniform4fv(u.uSky, P.sky); gl.uniform3fv(u.uSkyTop, P.skyTop); gl.uniform3fv(u.uSkyBot, P.skyBot);
      gl.uniform4fv(u.uSun, P.sun); gl.uniform3fv(u.uSunCol, P.sunCol); gl.uniform4fv(u.uBeam, P.beam);
    }
    if (u.uUIOn) gl.uniform1f(u.uUIOn, uiTex ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!fx) return;
    const f = R.final, fu = f.u;
    bind(f);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, ow, oh);
    tex(0, fx.tex, fu.uSrc); tex(1, uiTex || R.blank, fu.uUI);
    gl.uniform2f(fu.uSrcSize, fx.w, fx.h); gl.uniform2f(fu.uUITex, AQ.TUNING.view.w, AQ.TUNING.view.h); gl.uniform2f(fu.uOut, ow, oh);
    gl.uniform4fv(fu.uFx, P.fx); gl.uniform1f(fu.uUIOn, uiTex ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------------------------------------------------------------- what the shader is told (no allocation)
  const P = { gradeA: new Float32Array(4), gradeB: new Float32Array(4), shadow: new Float32Array(3), fog: new Float32Array(4), fogB: new Float32Array(4), fx: new Float32Array(4),
    cam: new Float32Array(4), scene: new Float32Array(4), dark: new Float32Array(4), lamp: new Float32Array(4), water: new Float32Array(4), rayCol: new Float32Array(3),
    surf: new Float32Array(4), surfCol: new Float32Array(3), sky: new Float32Array(4), skyTop: new Float32Array(3), skyBot: new Float32Array(3),
    sun: new Float32Array(4), sunCol: new Float32Array(3), beam: new Float32Array(4) };
  const BEAM = new Float32Array(3);
  X._P = P;                                                        // (for the tests: what the shader was told)
  const mixInto = (out, a, k) => { for (let i = 0; i < out.length; i++) out[i] += a[i] * k; };
  const tmpG = new Float32Array(10);
  // grading presets ([gain r, g, b, saturation, contrast, brightness, split, shadow r, g, b]) for a scene
  function grade(game, sceneKey) {
    const G = cfg().grade, g = G[sceneKey] || G.sea;
    tmpG.fill(0);
    if (g.fixed) { mixInto(tmpG, g.fixed, 1); return tmpG; }
    const C = AQ.Clock, title = game && game.state === 'title';
    const day = title || !C ? 1 : C.daylight(), tw = title || !C ? 0 : C.twilight(), morning = C && C.hour() < 12;
    const wTw = tw, wNight = (1 - day) * (1 - tw), wNoon = Math.max(0, 1 - wTw - wNight), sum = wTw + wNight + wNoon || 1;
    mixInto(tmpG, g.noon, wNoon / sum); mixInto(tmpG, morning ? g.dawn : g.dusk, wTw / sum); mixInto(tmpG, g.night, wNight / sum);
    return tmpG;
  }
  function sceneKey(game) {
    if (!game) return 'sea';
    const st = game.state, from = (m) => !!m && m.from;
    if (st === 'title' || (st === 'log' && from(AQ.LogUI) === 'title') || (st === 'guide' && from(AQ.Guide) === 'title')) return 'title';
    if (st === 'aquarium' || (st === 'log' && from(AQ.LogUI) === 'aquarium')) return 'tank';
    return game.scene === 'hill' ? 'hill' : game.scene === 'station' ? 'station' : 'sea';
  }
  X.sceneKey = sceneKey;
  function params(game, level) {
    const c = cfg(), key = X.photoScene || sceneKey(game), g = grade(game, key);
    if (X.off.grade) { P.gradeA.set([1, 1, 1, 1]); P.gradeB.set([1, 0, 0, 0]); P.shadow.fill(0); }
    else {
      const k = c.gradeStrength;
      P.gradeA[0] = 1 + (g[0] - 1) * k; P.gradeA[1] = 1 + (g[1] - 1) * k; P.gradeA[2] = 1 + (g[2] - 1) * k; P.gradeA[3] = 1 + (g[3] - 1) * k;
      P.gradeB[0] = 1 + (g[4] - 1) * k; P.gradeB[1] = g[5] * k; P.gradeB[2] = g[6] * k; P.gradeB[3] = 0;
      P.shadow[0] = g[7]; P.shadow[1] = g[8]; P.shadow[2] = g[9];
    }
    // depth fog: only in the sea, from how deep the camera is
    const F = c.fog;
    let amt = 0, surf = -1;
    if (key === 'sea' && !X.off.fog && !X.photoScene) {
      const W = AQ.World, cam = AQ.Camera;
      amt = Math.max(0, Math.min(1, (cam.y - W.sea - F.startDepth) / F.fullDepth)) * F.max;
      surf = (W.sea - cam.top()) / AQ.TUNING.view.h;
      if (surf <= 0) surf = -1;
    }
    P.fog[0] = F.color[0]; P.fog[1] = F.color[1]; P.fog[2] = F.color[2]; P.fog[3] = amt;
    P.fogB[0] = surf; P.fogB[1] = F.desaturate; P.fogB[2] = F.contrastLoss; P.fogB[3] = level === 'low' ? 0 : F.soften;
    const lv = c.levels[level];
    P.fx[0] = X.off.vignette ? 0 : c.vignette;
    P.fx[1] = X.off.grain || !lv.grain || calm() ? 0 : c.grain.amount;
    const dayK = (key === 'sea' || key === 'hill') && AQ.Clock ? AQ.Clock.daylight() : 0;   // (by day, bright things glow less: the glow is for the dark)
    P.fx[2] = X.off.bloom ? 0 : c.bloom.strength * (1 - dayK * (1 - c.bloom.dayScale));
    P.fx[3] = Math.floor(performance.now() / 1000 * c.grain.fps) % 1000;   // (the grain's pattern changes c.grain.fps times a second)
    stage2(game, key, level);
    return P;
  }

  // ---------------------------------------------------------------- Stage 2: light, water, sky
  const lv = () => (X.active() ? cfg().levels[X.mode] : null);
  const onSea = () => { const k = sceneKey(AQ.Game); return k === 'sea' || k === 'title'; };
  // does the shader do the sea's water effects now? (then the 2D light shafts and marine snow step aside)
  X.water = () => { const L = lv(); return !!(L && L.water && !X.off.water && onSea()); };
  // the sea's darkness and lights: on MEDIUM / HIGH the shader draws them (R.lighting hands them over and
  // draws nothing); LOW / CLASSIC: the old stepped 2D overlay, as before
  const LT = { list: null, cam: null, dark: 0, night: 0, frame: -1 };
  X._LT = LT;
  X.takeLighting = function (cam, lights, darkness) {
    const L = lv();
    if (!L || !L.light || X.off.light || X.photoScene) return false;
    LT.list = lights; LT.cam = cam; LT.dark = darkness; LT.frame = X.frame;
    LT.night = AQ.Clock && !(AQ.Game && AQ.Game.state === 'title') ? 1 - AQ.Clock.daylight() : 0;
    return true;
  };
  const colCache = new Map();
  function rgb(css) {
    if (!css) return null;
    let v = colCache.get(css);
    if (!v) {                                                        // '#rrggbb' or 'rgb(r,g,b)' (cached: parsed once)
      const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css), h = m ? [+m[1], +m[2], +m[3]] : AQ.U.hex(css);
      v = [h[0] / 255, h[1] / 255, h[2] / 255]; colCache.set(css, v);
    }
    return v;
  }
  // the lights on screen, packed (the player's lamp first; then the nearest), as texture px
  function packLights(level) {
    if (LT.frame !== X.frame || !LT.list) return 0;
    const max = AQ.Shaders.maxLights[level], cam = LT.cam, l = cam.left(), tp = cam.top(), c = cfg().lights, calmNow = calm(), t = X.t;
    let n = 0;
    for (const L of LT.list) {
      if (n >= max) break;
      const x = L.x - l, y = L.y - tp, r = L.r;
      if (x < -r || y < -r || x > AQ.TUNING.view.w + r || y > AQ.TUNING.view.h + r) continue;
      const fl = L.flicker && !calmNow ? 1 + Math.sin(t * 3 + L.x) * c.flicker : 1;
      const i = n * 4;
      LIGHTS[i] = x; LIGHTS[i + 1] = y; LIGHTS[i + 2] = r * fl; LIGHTS[i + 3] = L.power == null ? 1 : L.power;
      const col = rgb(L.color);
      LCOL[i] = col ? col[0] : 0; LCOL[i + 1] = col ? col[1] : 0; LCOL[i + 2] = col ? col[2] : 0;
      LCOL[i + 3] = L.cone ? L.cone : 0;
      n++;
    }
    return n;
  }
  X.t = 0;
  // the clock's sun / moon across the sky (the same path the hill draws them on), texture px
  function skyBody(out) {
    const C = AQ.Clock, k = AQ.TUNING.clock, h = C.hour();
    const sunUp = (h - k.dawnHour) / (k.duskHour + k.duskHours - k.dawnHour);
    const moonUp = (((h - (k.duskHour + k.duskHours)) % 24) + 24) % 24 / (24 - (k.duskHour + k.duskHours - k.dawnHour));
    const u = sunUp >= 0 && sunUp <= 1 ? sunUp : moonUp, sun = sunUp >= 0 && sunUp <= 1;
    out.x = 20 + u * 280; out.y = 140 - Math.sin(u * Math.PI) * 110; out.sun = sun;
    return out;
  }
  const BODY = { x: 0, y: 0, sun: true };
  function stage2(game, key, level) {
    const c = cfg(), L = c.levels[level], C = AQ.Clock;
    P.cam.fill(0); P.scene.fill(0); P.dark.fill(0); P.water.fill(0); P.surf.fill(0); P.sky.fill(0); P.sun.fill(0); P.beam.fill(0);
    P.surf[0] = -1;
    if (!L.light && !L.water && !L.sky) return;
    const cam = AQ.Camera, day = C && key !== 'title' ? C.daylight() : 1, tw = C && key !== 'title' ? C.twilight() : 0, isSea = key === 'sea' || key === 'title';
    P.cam[0] = cam.left(); P.cam[1] = cam.top(); P.cam[2] = X.t; P.cam[3] = calm() ? 1 : 0;
    P.scene[0] = isSea && !X.photoScene ? 1 : key === 'hill' && !X.photoScene ? 2 : 0; P.scene[1] = day; P.scene[2] = tw; P.scene[3] = AQ.World ? AQ.World.sea : 0;
    // the dark + lights (the sea)
    if (isSea && LT.frame === X.frame) {
      const nb = LT.night;
      P.dark[0] = (3 + nb * 3) / 255; P.dark[1] = (6 + nb * 8) / 255; P.dark[2] = (18 + nb * 22) / 255; P.dark[3] = LT.dark < 0.02 ? 0 : LT.dark;
    }
    P.lamp[0] = c.lights.lampColor[0]; P.lamp[1] = c.lights.lampColor[1]; P.lamp[2] = c.lights.lampColor[2]; P.lamp[3] = c.lights.lampTint;
    if (C) skyBody(BODY);
    // the water (the sea)
    if (isSea && L.water && !X.off.water && !X.photoScene) {
      const W = c.water, sunK = BODY.sun ? day : 0;
      P.water[0] = W.rays * day + W.raysNight * (1 - day); P.water[1] = W.caustics * day; P.water[2] = W.refraction; P.water[3] = W.plankton;
      const rc = day > 0.5 ? W.sunRay : W.moonRay; P.rayCol[0] = rc[0]; P.rayCol[1] = rc[1]; P.rayCol[2] = rc[2];
      const surf = (AQ.World.sea - cam.top()) / AQ.TUNING.view.h;
      P.surf[0] = surf > 0 && surf < 1 ? surf : -1; P.surf[1] = W.glint * (BODY.sun ? 1 : 0.5); P.surf[2] = BODY.x; P.surf[3] = W.reflection;
      const g = BODY.sun ? c.sky.sunGlow.color : c.sky.moonGlow.color; P.surfCol[0] = g[0]; P.surfCol[1] = g[1]; P.surfCol[2] = g[2];
      void sunK;
    }
    // the sky: the sea's (above the surface) or the hill's
    if (L.sky && !X.off.sky && !X.photoScene && (isSea || key === 'hill')) {
      const sky = AQ.Render.skyCols(), S = c.sky;
      P.skyTop[0] = sky[0][0] / 255; P.skyTop[1] = sky[0][1] / 255; P.skyTop[2] = sky[0][2] / 255;
      P.skyBot[0] = sky[1][0] / 255; P.skyBot[1] = sky[1][1] / 255; P.skyBot[2] = sky[1][2] / 255;
      if (isSea) { const W = AQ.World; P.sky[0] = cam.top() / W.sea; P.sky[1] = 1 / W.sea; P.sky[3] = Math.max(0, W.sea - cam.top()); }
      else { P.sky[0] = 0; P.sky[1] = 1 / 150; P.sky[3] = 152; }
      P.sky[2] = (S.clouds * day + S.cloudsNight * (1 - day)) * (1 - tw * 0.6);
      if (key === 'hill') {
        const glow = BODY.sun ? S.sunGlow : S.moonGlow, fade = Math.max(0, 1 - tw / 0.7);
        P.sun[0] = BODY.x; P.sun[1] = BODY.y; P.sun[2] = glow.radius; P.sun[3] = glow.strength * fade;
        P.sunCol[0] = glow.color[0]; P.sunCol[1] = glow.color[1]; P.sunCol[2] = glow.color[2];
        if (tw > 0.05) { P.sun[0] = BODY.sun || tw > 0.3 ? S.sunsetSun[0] : P.sun[0]; P.sun[1] = S.sunsetSun[1]; P.sun[2] = S.sunGlow.radius * 1.4; P.sun[3] = Math.max(P.sun[3], S.sunGlow.strength * tw); const sc = S.sunGlow.color; P.sunCol[0] = sc[0]; P.sunCol[1] = sc[1] * 0.9; P.sunCol[2] = sc[2] * 0.8; }
        if (AQ.Hill && AQ.Hill.beamOnScreen(BEAM)) { P.beam[0] = BEAM[0]; P.beam[1] = BEAM[1]; P.beam[2] = BEAM[2]; P.beam[3] = S.beam * (S.beamDay + (1 - S.beamDay) * (1 - day)); }   // (gentle by day, full at night)
        // the hill's own little sea at the bottom: the same glint path
        if (L.water && !X.off.water) { P.surf[0] = 152 / AQ.TUNING.view.h; P.surf[1] = c.water.glint * (BODY.sun ? 0.8 : 0.4); P.surf[2] = BODY.x; P.surf[3] = 0; const g = BODY.sun ? S.sunGlow.color : S.moonGlow.color; P.surfCol[0] = g[0]; P.surfCol[1] = g[1]; P.surfCol[2] = g[2]; }
      }
    }
  }

  // ---------------------------------------------------------------- photos / exports with the full look
  // src: a canvas (e.g. the tank photo) -> a new canvas of outW x outH with the current level's effects,
  // or null (CLASSIC, or anything failed: the caller keeps its plain version).
  X.processImage = function (src, outW, outH, scene) {
    if (!X.active() || !gl || !R) return null;
    let t = null;
    try {
      t = AQ.GL.target(gl, outW, outH); if (!t) return null;
      gl.bindTexture(gl.TEXTURE_2D, R.photo);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      X.photoScene = scene || 'tank';
      draw(AQ.Game, R.photo, src.width, src.height, null, t.fb, outW, outH, X.mode);
      const px = new Uint8Array(outW * outH * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.readPixels(0, 0, outW, outH, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const out = document.createElement('canvas'); out.width = outW; out.height = outH;
      const og = out.getContext('2d'), img = og.createImageData(outW, outH), row = outW * 4;
      for (let y = 0; y < outH; y++) img.data.set(px.subarray((outH - 1 - y) * row, (outH - y) * row), y * row);   // (GL rows are bottom-up)
      og.putImageData(img, 0, 0);
      return out;
    } catch (e) { return null; }
    finally { X.photoScene = null; if (t) AQ.GL.free(gl, t); }
  };

  // ---------------------------------------------------------------- frame time + the safety governor
  // Steps down one level when the frame rate stays under graphics.governor.minFps for .seconds (never up,
  // never over the player's own choice; a short pause after each step lets the new level settle).
  const G = { slow: 0, settle: 0 };
  function timing() {
    const now = performance.now(), dt = now - lastT; lastT = now;
    if (dt <= 0 || dt > 250 || document.hidden) return;              // (a hidden tab or a hiccup isn't the game being slow)
    X.ms += (dt - X.ms) * 0.05; X.fps = 1000 / Math.max(1, X.ms);
    X.dt = dt;
  }
  function governor(game) {
    const g = cfg().governor, s = X.saved();
    if (!g.enabled || !s || s.manual || !X.dt || !game || game.state === 'loading') return;
    const dt = X.dt / 1000;
    if (G.settle > 0) { G.settle -= dt; G.slow = 0; return; }
    G.slow = X.fps < g.minFps ? G.slow + dt : Math.max(0, G.slow - dt * 2);
    if (G.slow < g.seconds) return;
    G.slow = 0; G.settle = g.settleSeconds;
    const i = LEVELS.indexOf(s.level);
    if (i < 0 || i >= LEVELS.length - 1) return;
    X.choose(LEVELS[i + 1], false);
    if (AQ.HUD) AQ.HUD.toast(AQ.t('gfx.switched'), '#cfe8ff', 6);
  }

  // ---------------------------------------------------------------- testing (AQ.TUNING.debug.gfx)
  X.update = (game) => debugKeys(game);                           // (from the game's update, while key presses are fresh)
  function debugKeys(game) {
    const d = AQ.TUNING.debug, I = AQ.Input;
    if (!d.gfx || !I) return;
    const say = (k, v) => AQ.HUD && AQ.HUD.toast(AQ.t(k, v), '#cfe8ff', 2.5);
    if (I.wasPressed(d.gfxQualityKey)) { const i = LEVELS.indexOf(X.level()); X.choose(LEVELS[(i + 1) % LEVELS.length], true); say('debug.gfxLevel', { level: AQ.t(`settings.gfx.${X.level()}`) }); }
    if (I.wasPressed(d.gfxEffectKey)) { X.fxSel = (X.fxSel + 1) % X.EFFECTS.length; const e = X.EFFECTS[X.fxSel]; say('debug.gfxEffect', { effect: e.toUpperCase(), state: AQ.t(X.off[e] ? 'settings.off' : 'settings.on') }); }
    if (I.wasPressed(d.gfxToggleKey)) { const e = X.EFFECTS[X.fxSel]; X.off[e] = !X.off[e]; say('debug.gfxEffect', { effect: e.toUpperCase(), state: AQ.t(X.off[e] ? 'settings.off' : 'settings.on') }); }
    if (I.wasPressed(d.gfxOverlayKey)) X.overlay = !X.overlay;
  }
  // the frame-time overlay (interface: drawn after the effects)
  X.drawOverlay = function (g) {
    if (!X.overlay || !AQ.TUNING.debug.gfx) return;
    const F = AQ.Font, rows = [
      `${X.fps.toFixed(0)} FPS  ${X.ms.toFixed(1)} MS`,
      `LEVEL ${X.level().toUpperCase()}  DRAWING ${X.mode.toUpperCase()}${X.saved() && X.saved().manual ? ' (CHOSEN)' : ' (AUTO)'}`,
      'OFF: ' + (X.EFFECTS.filter((e) => X.off[e]).join(' ').toUpperCase() || '-') + '  NEXT: ' + X.EFFECTS[X.fxSel].toUpperCase(),
      (X.view ? `${X.view.width}X${X.view.height}  ` : '') + (X.failed ? 'FAILED: ' + X.failed : (X.renderer || '').slice(0, 40)).toUpperCase()
    ];
    g.fillStyle = 'rgba(4,10,20,0.82)'; g.fillRect(2, 150, 236, rows.length * 6 + 4);
    rows.forEach((r, i) => F.draw(g, r.replace(/[^ -~]/g, '?'), 5, 152 + i * 6, i ? '#9ff3ff' : '#ffe36b', { shadow: false, max: 230 }));
  };
  return X;
})();
