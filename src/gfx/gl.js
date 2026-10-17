// Small WebGL1 helpers for the shader layer (src/gfx/). WebGL1 only, so it works on older phones and
// Safari. Every step reports what went wrong (AQ.GL.lastError) instead of throwing, so the caller can
// fall back to CLASSIC quietly.
var AQ = (typeof AQ !== 'undefined') ? AQ : {};

AQ.GL = (function () {
  const L = { lastError: '' };
  const fail = (msg) => { L.lastError = msg; return null; };

  // a WebGL1 context (no antialiasing: we want exact pixels; premultiplied alpha for clean edges)
  L.context = function (canvas) {
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'default' };
    let gl = null;
    try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch (e) { return fail('getContext threw: ' + e.message); }
    return gl || fail('WebGL is not available');
  };

  function shader(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s) || '(no log)';
      gl.deleteShader(s);
      return fail(`${name} (${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'}) did not compile: ${log}`);
    }
    return s;
  }
  // a program with its uniform locations looked up once: p.u.name
  L.program = function (gl, vsSrc, fsSrc, name) {
    const vs = shader(gl, gl.VERTEX_SHADER, vsSrc, name); if (!vs) return null;
    const fs = shader(gl, gl.FRAGMENT_SHADER, fsSrc, name); if (!fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) return fail(`${name} did not link: ${gl.getProgramInfoLog(p)}`);
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    return { p, u, name };
  };
  // a texture (linear filtering: the sharp-bilinear shader decides where pixels blend)
  L.texture = function (gl, w, h, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w && h) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  // a framebuffer drawing into a new texture of w x h
  L.target = function (gl, w, h) {
    const tex = L.texture(gl, w, h), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { fb, tex, w, h } : fail('framebuffer incomplete');
  };
  L.free = function (gl, t) { if (!t || !gl) return; if (t.fb) gl.deleteFramebuffer(t.fb); if (t.tex) gl.deleteTexture(t.tex); };
  // one big triangle covering the screen (attribute 0)
  L.quad = function (gl) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return b;
  };
  return L;
})();
