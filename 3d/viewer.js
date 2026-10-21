/*
  Простой просмотрщик STL на чистом WebGL, без внешних библиотек.
  Загружает phone-stand.stl, показывает модель с освещением, сеткой стола
  и (по кнопке) телефоном. Вращение мышью/пальцем, масштаб колесом/щипком.
*/
(function () {
  'use strict';

  var box = document.getElementById('viewer');
  var canvas = document.createElement('canvas');
  var gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) { box.classList.add('failed'); return; }
  box.prepend(canvas);

  // ---------- матрицы 4x4 (по столбцам, как в WebGL) ----------
  function perspective(fov, aspect, near, far) {
    var f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(eye, target, up) {
    var z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }

  // ---------- шейдеры ----------
  var vs = 'attribute vec3 aPos; attribute vec3 aNrm; uniform mat4 uMvp; varying vec3 vN;' +
           'void main(){ vN = aNrm; gl_Position = uMvp * vec4(aPos, 1.0); }';
  var fs = 'precision mediump float; varying vec3 vN; uniform vec3 uColor; uniform float uLit; uniform float uAlpha;' +
           'void main(){ vec3 n = normalize(vN);' +
           ' float key = max(dot(n, normalize(vec3(0.45, 0.8, 0.55))), 0.0);' +
           ' float rim = max(dot(n, normalize(vec3(-0.6, 0.3, -0.5))), 0.0);' +
           ' float sky = 0.5 + 0.5 * n.y;' +
           ' vec3 lit = uColor * (0.32 + 0.22 * sky + 0.62 * key + 0.18 * rim);' +
           ' gl_FragColor = vec4(mix(uColor, lit, uLit), uAlpha); }';
  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  var loc = {
    pos: gl.getAttribLocation(prog, 'aPos'), nrm: gl.getAttribLocation(prog, 'aNrm'),
    mvp: gl.getUniformLocation(prog, 'uMvp'), color: gl.getUniformLocation(prog, 'uColor'),
    lit: gl.getUniformLocation(prog, 'uLit'), alpha: gl.getUniformLocation(prog, 'uAlpha')
  };

  function makeMesh(positions, normals, mode) {
    var pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    var nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    return { pb: pb, nb: nb, count: positions.length / 3, mode: mode };
  }
  function draw(m, color, lit, alpha) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nb); gl.enableVertexAttribArray(loc.nrm); gl.vertexAttribPointer(loc.nrm, 3, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(loc.color, color); gl.uniform1f(loc.lit, lit); gl.uniform1f(loc.alpha, alpha);
    gl.drawArrays(m.mode, 0, m.count);
  }

  // модель STL: x - ширина, y - глубина, z - высота -> экран: x, y вверх, z к зрителю
  var W = 70, D = 93.5;
  function toWorld(x, y, z) { return [x - W / 2, z, -(y - D / 2)]; }

  // ---------- сетка стола ----------
  var gp = [], gn = [];
  for (var i = -130; i <= 130; i += 10) {
    gp.push(i, 0, -130, i, 0, 130, -130, 0, i, 130, 0, i);
    for (var k = 0; k < 4; k++) gn.push(0, 1, 0);
  }
  var grid = makeMesh(gp, gn, gl.LINES);

  // ---------- телефон 75 x 160 x 9 мм, лежит на спинке под 65° ----------
  var phone = (function () {
    var a = 65 * Math.PI / 180;
    var dv = [0, Math.cos(a), Math.sin(a)], nv = [0, -Math.sin(a), Math.cos(a)], xv = [1, 0, 0];
    var c = [35, 20 + 2 * nv[1], 2 + 2 * nv[2]];
    c = [c[0], c[1] + dv[1] * 81.5 + nv[1] * 4.5, c[2] + dv[2] * 81.5 + nv[2] * 4.5];
    var hs = [37.5, 80, 4.5], axes = [xv, dv, nv];
    var pos = [], nrm = [];
    function corner(s) {
      var p = [c[0], c[1], c[2]];
      for (var j = 0; j < 3; j++) for (var q = 0; q < 3; q++) p[q] += axes[j][q] * hs[j] * s[j];
      return toWorld(p[0], p[1], p[2]);
    }
    function nworld(v) { return [v[0], v[2], -v[1]]; }
    for (var ax = 0; ax < 3; ax++) for (var sgn = -1; sgn <= 1; sgn += 2) {
      var u = (ax + 1) % 3, v = (ax + 2) % 3, quad = [];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (uv) {
        var s = [0, 0, 0]; s[ax] = sgn; s[u] = uv[0]; s[v] = uv[1]; quad.push(corner(s));
      });
      var order = sgn > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      var nn = nworld(axes[ax].map(function (t) { return t * sgn; }));
      order.forEach(function (o) { pos.push.apply(pos, quad[o]); nrm.push.apply(nrm, nn); });
    }
    return makeMesh(pos, nrm, gl.TRIANGLES);
  })();

  // ---------- загрузка STL (двоичный формат) ----------
  var part = null;
  fetch('phone-stand.stl').then(function (r) {
    if (!r.ok) throw new Error('STL ' + r.status);
    return r.arrayBuffer();
  }).then(function (buf) {
    var dv = new DataView(buf), n = dv.getUint32(80, true), pos = [], nrm = [], off = 84;
    for (var t = 0; t < n; t++, off += 50) {
      // нормаль поворачиваем так же, как точки, но без сдвига
      var nx = dv.getFloat32(off, true), ny = dv.getFloat32(off + 4, true), nz = dv.getFloat32(off + 8, true);
      for (var v = 0; v < 3; v++) {
        var b = off + 12 + v * 12;
        pos.push.apply(pos, toWorld(dv.getFloat32(b, true), dv.getFloat32(b + 4, true), dv.getFloat32(b + 8, true)));
        nrm.push(nx, nz, -ny);
      }
    }
    part = makeMesh(pos, nrm, gl.TRIANGLES);
    box.classList.add('ready');
  }).catch(function () { box.classList.add('failed'); });

  // ---------- камера ----------
  var target = [0, 38, 0], view;
  function resetView() { view = { theta: 0.78, phi: 1.05, r: 300 }; }
  resetView();

  function hexToRgb(h) {
    h = (h || '').trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var v = parseInt(h, 16);
    return isNaN(v) ? [0.18, 0.29, 1] : [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
  }
  var styles = getComputedStyle(document.documentElement);
  var accent = hexToRgb(styles.getPropertyValue('--accent'));
  var muted = hexToRgb(styles.getPropertyValue('--muted'));
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // ---------- управление ----------
  var pointers = {}, pinch = 0, idle = 0, showPhone = false;
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId); pointers[e.pointerId] = [e.clientX, e.clientY]; idle = -1;
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) return;
    var ids = Object.keys(pointers);
    if (ids.length === 1) {
      var p = pointers[e.pointerId];
      view.theta -= (e.clientX - p[0]) * 0.008;
      view.phi = Math.min(1.52, Math.max(0.15, view.phi - (e.clientY - p[1]) * 0.008));
    }
    pointers[e.pointerId] = [e.clientX, e.clientY];
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) view.r = Math.min(600, Math.max(130, view.r * pinch / d));
      pinch = d;
    }
  });
  function up(e) { delete pointers[e.pointerId]; pinch = 0; if (!Object.keys(pointers).length) idle = 0; }
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); idle = 0;
    view.r = Math.min(600, Math.max(130, view.r * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });

  var btn = document.getElementById('togglePhone');
  btn.addEventListener('click', function () {
    showPhone = !showPhone;
    btn.setAttribute('aria-pressed', String(showPhone));
    btn.textContent = showPhone ? 'Скрыть телефон' : 'Показать телефон';
  });
  document.getElementById('resetView').addEventListener('click', function () { idle = 0; resetView(); });

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- отрисовка ----------
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function frame() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(box.clientWidth * dpr), h = Math.round(box.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!reduce && idle >= 0 && ++idle > 90) view.theta += 0.0035;   // медленно крутится, пока не трогают

    // в режиме с телефоном камера отъезжает и смотрит выше; на узком экране - дальше
    var aspect = w / Math.max(h, 1);
    var tgt = showPhone ? [0, 62, 0] : target;
    var r = view.r * (showPhone ? 1.35 : 1) * Math.max(1, 1.15 / aspect);
    var eye = [
      tgt[0] + r * Math.sin(view.phi) * Math.sin(view.theta),
      tgt[1] + r * Math.cos(view.phi),
      tgt[2] + r * Math.sin(view.phi) * Math.cos(view.theta)
    ];
    var mvp = mul(perspective(35 * Math.PI / 180, aspect, 5, 3000), lookAt(eye, tgt, [0, 1, 0]));
    gl.uniformMatrix4fv(loc.mvp, false, new Float32Array(mvp));

    gl.depthMask(false);
    draw(grid, muted, 0, dark ? 0.16 : 0.35);
    gl.depthMask(true);
    if (part) draw(part, accent, 1, 1);
    if (showPhone) draw(phone, dark ? [0.32, 0.35, 0.46] : [0.11, 0.12, 0.18], 1, 1);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
