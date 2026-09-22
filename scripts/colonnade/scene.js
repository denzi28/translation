/**
 * An Ionic column in the Greek manner, modelled in three.js: an attic base on
 * a square plinth, a shaft of 24 flutes with fillets, bead-and-reel,
 * egg-and-dart, spiral volutes and a thin abacus, with a bronze lantern on a
 * bracket. `?piece=` picks the slice of the column to draw and `?mode=` the
 * light: afternoon sun, or moonlight with the lantern lit.
 *
 * Every piece shares one horizontal frame (XL..XR), so they stack in the page
 * without lining up by hand. The shaft between the pieces is lit the same all
 * the way up, and the weathering streaks depend only on the angle round the
 * column, so any slice of the shaft matches any other.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// ---------------------------------------------------------------- dimensions
// Units: the lower diameter of the shaft is 1.
const R = 0.5;              // shaft radius
const FLUTES = 24;
const BASE_TOP = 0.43;      // where the attic base hands over to the shaft
const SHAFT_TOP = 14.0;     // top of the shaft (astragal starts here)
const LANTERN_Y = 7.0;      // height of the bracket arm
const LAMP_X = 1.0;        // where the lantern hangs
const XL = -1.0, XR = 1.3;  // horizontal frame shared by every piece

// ------------------------------------------------------------------ helpers
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Weathering streaks that depend only on the angle round the column, so any
 *  horizontal slice of the shaft matches any other and the tile repeats. */
const streakTerms = (() => { const r = rand(7); return Array.from({ length: 9 }, (_, i) => ({ f: 3 + Math.floor(r() * 40), p: r() * 6.283, a: (0.5 + r()) / (1 + i * 0.35) })); })();
function streak(theta) { let s = 0, n = 0; for (const t of streakTerms) { s += t.a * Math.sin(t.f * theta + t.p); n += t.a; } return s / n; }

function setColors(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = fn(p.getX(i), p.getY(i), p.getZ(i), i); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
}
function tintFor(x, z, cav) { const s = streak(Math.atan2(z, x)); const k = cav * (1 + 0.035 * s); return [k * (1 - 0.004 * s), k, k * (1 + 0.006 * s)]; }

/** Grid mesh from a function (i, j) -> [x, y, z], rows × cols, optional per-vertex cavity. */
function gridMesh(rows, cols, at, cavity, wrap = false) {
  const pos = new Float32Array(rows * cols * 3), cav = new Float32Array(rows * cols);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const k = i * cols + j, v = at(i, j); pos.set(v, k * 3); cav[k] = cavity ? cavity(i, j) : 1;
  }
  const idx = [];
  const cmax = wrap ? cols : cols - 1;
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cmax; j++) {
    const j2 = (j + 1) % cols, a = i * cols + j, b = i * cols + j2, c = (i + 1) * cols + j, d = (i + 1) * cols + j2;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  setColors(g, (x, y, z, i) => tintFor(x, z, cav[i]));
  return g;
}

// ---------------------------------------------------------------- the shaft
const FLUTE_DEPTH = 0.8 * (R * (2 * Math.PI / FLUTES) * 0.8) / 2;
/** Radius of the fluted shaft at angle θ; `w` narrows the flutes near the ends. */
function shaftRadius(theta, w) {
  const cell = 2 * Math.PI / FLUTES;
  let u = ((theta % cell) + cell) % cell / cell - 0.5; // -0.5..0.5, flute centred
  const s = u / 0.4;                                     // flute occupies 80%
  if (w <= 0 || Math.abs(s) >= w) return [R, 1];
  const d = FLUTE_DEPTH * Math.sqrt(w * w - s * s);
  return [R - d, 1 - 0.42 * (d / FLUTE_DEPTH)];
}
const END = 0.1;   // length over which a flute rounds off
function shaftSegment(y0, y1, roundBottom, roundTop) {
  const rowsY = [];
  const addRange = (a, b, n) => { for (let i = 0; i < n; i++) rowsY.push(a + (b - a) * i / (n - 1)); };
  if (roundBottom) addRange(y0, y0 + END * 1.2, 48);
  const midA = roundBottom ? y0 + END * 1.2 : y0, midB = roundTop ? y1 - END * 1.2 : y1;
  addRange(midA, midB, Math.max(2, Math.ceil((midB - midA) / 0.05)));
  if (roundTop) addRange(y1 - END * 1.2, y1, 48);
  const ys = rowsY.filter((y, i) => i === 0 || y > rowsY[i - 1] + 1e-6);
  const cols = FLUTES * 48;
  const flare = (d) => (d < 0.05 ? 0.028 * Math.pow(1 - d / 0.05, 2) : 0);
  const at = (i, j) => {
    const y = ys[i], th = (j / cols) * Math.PI * 2 + Math.PI / 2;  // a flute faces the camera
    const db = roundBottom ? y - y0 : 9, dt = roundTop ? y1 - y : 9, d = Math.min(db, dt);
    const w = d >= END ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((END - d) / END, 2)));
    const r = shaftRadius(th, d < 0.012 ? 0 : w)[0] + flare(d);
    return [r * Math.cos(th), y, r * Math.sin(th)];
  };
  const cav = (i, j) => { const y = ys[i], th = (j / cols) * Math.PI * 2 + Math.PI / 2;
    const db = roundBottom ? y - y0 : 9, dt = roundTop ? y1 - y : 9, d = Math.min(db, dt);
    const w = d >= END ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((END - d) / END, 2)));
    return shaftRadius(th, d < 0.012 ? 0 : w)[1]; };
  return gridMesh(ys.length, cols, at, cav, true);
}

// ------------------------------------------------------- turned mouldings
/** Lathe from a profile [[r, y], ...] with smooth normals. */
function lathe(profile, seg = 256) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  setColors(g, (x, y, z) => tintFor(x, z, 1));
  return g;
}
function profileFn(fn, y0, y1, n) { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push([fn(t), y0 + (y1 - y0) * t]); } return pts; }

/** Square moulding (plinth, abacus): profile [[halfWidth, y], ...] swept round a square. */
function squareMoulding(profile) {
  const pos = [], nor = [], col = [], idx = [];
  const sides = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // outward normals in xz
  for (const [nx, nz] of sides) {
    const base = pos.length / 3;
    for (let i = 0; i < profile.length; i++) {
      const [h, y] = profile[i];
      const [hp, yp] = profile[Math.max(0, i - 1)], [hn, yn] = profile[Math.min(profile.length - 1, i + 1)];
      const dh = hn - hp, dy = yn - yp, L = Math.hypot(dh, dy) || 1;
      const no = dy / L, ny = -dh / L; // outward, up
      // tangent along the side
      const tx = -nz, tz = nx;
      for (const s of [-1, 1]) {
        pos.push(nx * h + tx * h * s, y, nz * h + tz * h * s);
        nor.push(nx * no, ny, nz * no);
        const c = tintFor(nx * h + tx * h * s * 0.3, nz * h + tz * h * s * 0.3, 1); col.push(...c);
      }
      if (i > 0) { const a = base + (i - 1) * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
    }
  }
  // top cap
  const [ht, yt] = profile[profile.length - 1], b = pos.length / 3;
  pos.push(-ht, yt, -ht, ht, yt, -ht, ht, yt, ht, -ht, yt, ht); for (let i = 0; i < 4; i++) { nor.push(0, 1, 0); col.push(1, 1, 1); }
  idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// ------------------------------------------------------------- the capital
function beadAndReel(yc, Rc, a0, count) {
  const per = 28, cols = count * per, rows = 28;
  const f = (u) => {
    const au = Math.abs(u);
    if (au < 0.27) return 0.42 + 0.58 * Math.sqrt(1 - Math.pow(au / 0.27, 2));
    const q = Math.abs(au - 0.385);
    if (q < 0.055) return 0.4 + 0.38 * Math.sqrt(1 - Math.pow(q / 0.055, 2));
    return 0.4;
  };
  const at = (i, j) => { const th = (j / cols) * Math.PI * 2 + Math.PI / 2, al = (i / (rows - 1)) * Math.PI * 2 - Math.PI;
    const u = ((j % per) / per) - 0.5, a = a0 * f(u), rr = Rc + a * Math.cos(al);
    return [rr * Math.cos(th), yc + a * Math.sin(al), rr * Math.sin(th)]; };
  const cav = (i, j) => { const u = ((j % per) / per) - 0.5; return 0.72 + 0.28 * Math.min(1, (f(u) - 0.4) / 0.5); };
  return gridMesh(rows, cols, at, cav, true);
}

function eggAndDart(y0, y1, r0, a, count) {
  const per = 40, cols = count * per, rows = 64;
  const disp = (u, v) => {
    // egg
    const q = Math.pow(u / 0.29, 2) + Math.pow((v - 0.5) / 0.4, 2);
    if (v > 0.9) return [0.0, 1];
    if (q < 1) return [0.016 * Math.sqrt(1 - q) - 0.002, 1];
    if (q < 1.22) return [-0.011, 0.55];
    if (q < 1.75 && v < 0.86) return [0.004 * Math.sin(Math.PI * (q - 1.22) / 0.53), 0.9];
    // dart between eggs, point downwards
    const ue = 0.5 - Math.abs(u), hw = 0.075 * Math.max(0, (v - 0.12) / 0.78);
    if (v > 0.12 && ue < hw) return [0.007 * (1 - ue / hw) - 0.004, 0.85];
    return [-0.011, 0.6];
  };
  const prof = (v) => r0 + a * Math.sqrt(1 - Math.pow(1 - v, 2));
  const at = (i, j) => { const v = i / (rows - 1), th = (j / cols) * Math.PI * 2 + Math.PI / 2, u = ((j % per) / per) - 0.5;
    const r = prof(v) + disp(u, v)[0]; return [r * Math.cos(th), y0 + (y1 - y0) * v, r * Math.sin(th)]; };
  const cav = (i, j) => disp(((j % per) / per) - 0.5, i / (rows - 1))[1];
  return gridMesh(rows, cols, at, cav, true);
}

/** The volutes and the channel between them, as a relief on the front face. */
function voluteFace(zf, eyeX, eyeY, A, turns, bandTop) {
  const b = Math.log(A / 0.052) / (2 * Math.PI * turns);
  const K = Math.exp(-2 * Math.PI * b);
  const bandBot = eyeY + A * K;
  const L = 0.1, RE = 0.052;
  const g = 0.0021;
  const xs = [], ys = [];
  for (let x = -eyeX - A * 1.02; x <= eyeX + A * 1.02; x += g) xs.push(x);
  for (let y = eyeY - A * 1.02; y <= bandTop + 1e-6; y += g) ys.push(y);
  const inside = [], H = [], C = [];
  function sample(x, y) {
    const side = x >= 0 ? 1 : -1, dx = (x - side * eyeX) * side, dy = y - eyeY;
    const r = Math.hypot(dx, dy);
    let phi = Math.atan2(dx, dy); if (phi < 0) phi += 2 * Math.PI;
    const rO = A * Math.exp(-b * phi);
    let t, w, outer = false;
    if (Math.abs(x) <= eyeX && y >= bandBot && y <= bandTop) { w = bandTop - bandBot; t = (bandTop - y) / w; outer = true; }
    else if (r <= rO) {
      if (r < RE) { const q = r / RE; return [true, 0.012 + 0.018 * Math.sqrt(1 - q * q), 1]; }
      const k = Math.floor(Math.log(rO / r) / (2 * Math.PI * b));
      const rk = rO * Math.pow(K, k), rk1 = rk * K; w = rk - rk1; t = (rk - r) / w; outer = k === 0;
    } else return [false, 0, 1];
    let h, c;
    if (t < L || t > 1 - L) { const e = t < L ? t / L : (1 - t) / L; h = -0.08 * w * Math.pow(1 - e, 2) * (outer && t < L ? 1.6 : 0.4); c = 1; }
    else { const s = (t - L) / (1 - 2 * L); const dep = 0.03 + 0.2 * Math.pow(Math.sin(Math.PI * s), 0.85); h = -dep * w; c = 1 - 0.55 * dep / 0.23; }
    return [true, h, c];
  }
  const pos = new Float32Array(xs.length * ys.length * 3), cav = new Float32Array(xs.length * ys.length);
  for (let i = 0; i < ys.length; i++) for (let j = 0; j < xs.length; j++) {
    const k = i * xs.length + j, [ins, h, c] = sample(xs[j], ys[i]);
    inside[k] = ins; pos.set([xs[j], ys[i], zf + h], k * 3); cav[k] = c;
  }
  const idx = [];
  for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < xs.length - 1; j++) {
    const a = i * xs.length + j, bb = a + 1, c = a + xs.length, d = c + 1;
    if (inside[a] && inside[bb] && inside[c] && inside[d]) idx.push(a, bb, c, bb, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  setColors(geo, (x, y, z, i) => { const s = streak(x * 3.1); const k = cav[i] * (1 + 0.03 * s); return [k, k, k * 1.004]; });
  return { geo, bandBot };
}

/** Back of the volute face: gives the capital body so it casts a solid shadow. */
function capitalBody(zf, eyeX, A, eyeY, bandTop) {
  const shape = new THREE.Shape();
  shape.absarc(-eyeX, eyeY, A * 0.98, 0, Math.PI * 2, false);
  const depth = zf * 2 - 0.2;
  const g1 = new THREE.CylinderGeometry(A * 0.9, A * 0.9, depth, 64, 1, false);
  g1.rotateX(Math.PI / 2);
  const left = g1.clone(); left.translate(-eyeX, eyeY, 0);
  const right = g1.clone(); right.translate(eyeX, eyeY, 0);
  const bandBot = eyeY + A * Math.exp(-Math.log(A / 0.052) / 3);
  const box = new THREE.BoxGeometry(eyeX * 2, bandTop - bandBot, depth); box.translate(0, (bandTop + bandBot) / 2, 0);
  for (const g of [left, right, box]) setColors(g, () => [0.8, 0.8, 0.8]);
  return [left, right, box];
}

// ------------------------------------------------------------- materials
function marbleMaterial(night) {
  return new THREE.MeshStandardMaterial({
    color: night ? 0xc9ccd2 : 0xf3e9d8, roughness: 0.58, metalness: 0, vertexColors: true,
    envMapIntensity: night ? 0.16 : 0.35,
  });
}

// ---------------------------------------------------------------- column
function buildColumn(scene, night) {
  const mat = marbleMaterial(night);
  const add = (geo, m = mat) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; };

  // attic base on a square plinth
  add(squareMoulding([[0.74, 0], [0.74, 0.12], [0.735, 0.13], [0.72, 0.14]]));
  add(lathe([
    [0.0, 0.14], [0.6, 0.14],
    ...profileFn((t) => 0.6 + 0.07 * Math.sin(Math.PI * t), 0.14, 0.255, 24),
    [0.565, 0.258], [0.565, 0.272],
    ...profileFn((t) => 0.565 - 0.042 * Math.sin(Math.PI * t) - 0.008 * t, 0.272, 0.34, 20),
    [0.562, 0.342], [0.562, 0.352],
    ...profileFn((t) => 0.548 + 0.04 * Math.sin(Math.PI * t), 0.352, 0.405, 20),
    [0.535, 0.408], [0.53, 0.43], [0.0, 0.43],
  ]));
  // shaft, in three parts so the ends can be detailed
  add(shaftSegment(BASE_TOP, 2.2, true, false));
  add(shaftSegment(2.2, SHAFT_TOP - 2.2, false, false));
  add(shaftSegment(SHAFT_TOP - 2.2, SHAFT_TOP, false, true));

  const Y = SHAFT_TOP;
  add(lathe([[0, Y], [0.525, Y], [0.525, Y + 0.022], [0.0, Y + 0.022]]));
  add(beadAndReel(Y + 0.052, 0.515, 0.032, 30));
  add(lathe([[0, Y + 0.08], [0.52, Y + 0.08], [0.52, Y + 0.09], [0, Y + 0.09]]));
  add(eggAndDart(Y + 0.09, Y + 0.24, 0.52, 0.145, 22));

  // volutes
  const eyeX = 0.6, eyeY = Y + 0.035, A = 0.33, bandTop = Y + 0.4, zf = 0.66;
  const { geo } = voluteFace(zf, eyeX, eyeY, A, 3, bandTop);
  add(geo);
  const back = voluteFace(-zf, eyeX, eyeY, A, 3, bandTop).geo; back.scale(1, 1, 1); add(back);
  for (const g of capitalBody(zf, eyeX, A, eyeY, bandTop)) add(g, mat);

  // abacus
  const ab = Y + 0.4;
  add(squareMoulding([
    [0.7, ab], ...profileFn((t) => 0.7 + 0.06 * Math.sin(Math.PI / 2 * t), ab, ab + 0.045, 12),
    [0.765, ab + 0.047], [0.765, ab + 0.07], [0.76, ab + 0.075],
  ]));
  return { top: ab + 0.075 };
}

// ---------------------------------------------------------------- lantern
function buildLantern(scene, night) {
  const bronze = new THREE.MeshStandardMaterial({ color: 0x7a5530, metalness: 1, roughness: 0.38, envMapIntensity: night ? 0.35 : 1.0 });
  const darkBronze = new THREE.MeshStandardMaterial({ color: 0x4a3220, metalness: 1, roughness: 0.45, envMapIntensity: night ? 0.3 : 0.9 });
  const glass = night
    ? new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa447, emissiveIntensity: 3.2, roughness: 0.3, transparent: true, opacity: 0.96 })
    : new THREE.MeshStandardMaterial({ color: 0x3c3129, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.72, envMapIntensity: 1.4 });
  const add = (geo, m, cast = true) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  const y = LANTERN_Y;

  // collar round the shaft
  const band = (yc, h, t) => new THREE.LatheGeometry([
    [0.49, yc - h / 2], [0.5 + t * 0.6, yc - h / 2], [0.5 + t, yc - h / 2 + t * 0.5], [0.5 + t, yc + h / 2 - t * 0.5], [0.5 + t * 0.6, yc + h / 2], [0.49, yc + h / 2],
  ].map(([r, yy]) => new THREE.Vector2(r, yy)), 200);
  add(band(y + 0.05, 0.075, 0.026), darkBronze);
  add(band(y - 0.3, 0.036, 0.014), darkBronze);
  // arm
  const arm = new THREE.CylinderGeometry(0.02, 0.022, LAMP_X + 0.1 - 0.5, 24); arm.rotateZ(Math.PI / 2); arm.translate((LAMP_X + 0.1 + 0.5) / 2, y + 0.05, 0); add(arm, bronze);
  const knob = new THREE.SphereGeometry(0.032, 32, 16); knob.translate(LAMP_X + 0.11, y + 0.05, 0); add(knob, bronze);
  const plate = new THREE.CylinderGeometry(0.05, 0.06, 0.03, 32); plate.rotateZ(Math.PI / 2); plate.translate(0.53, y + 0.05, 0); add(plate, darkBronze);
  // scrolled brace
  const brace = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.52, y - 0.3, 0), new THREE.Vector3(0.62, y - 0.2, 0), new THREE.Vector3(0.7, y - 0.08, 0),
    new THREE.Vector3(0.84, y + 0.0, 0), new THREE.Vector3(0.89, y - 0.06, 0), new THREE.Vector3(0.85, y - 0.11, 0), new THREE.Vector3(0.8, y - 0.08, 0),
  ]);
  add(new THREE.TubeGeometry(brace, 120, 0.012, 12, false), bronze);
  // chain and lantern, drawn at unit scale and enlarged about the hook
  const firstBody = scene.children.length;
  let cy = y + 0.03;
  for (let i = 0; i < 4; i++) {
    const link = new THREE.TorusGeometry(0.018, 0.005, 10, 24); link.scale(1, 1.5, 1);
    if (i % 2) link.rotateY(Math.PI / 2);
    link.translate(LAMP_X, cy - 0.022, 0); add(link, darkBronze); cy -= 0.042;
  }
  // body
  const top = cy - 0.02;
  const ring = new THREE.TorusGeometry(0.022, 0.006, 12, 32); ring.translate(LAMP_X, top + 0.012, 0); add(ring, bronze);
  const finial = new THREE.SphereGeometry(0.02, 24, 12); finial.translate(LAMP_X, top - 0.01, 0); add(finial, bronze);
  const roofPts = [[0.0, 0.0], [0.02, -0.005], [0.05, -0.03], [0.1, -0.07], [0.135, -0.1], [0.14, -0.108], [0.0, -0.108]].map(([r, h]) => new THREE.Vector2(r, h)).reverse();
  const roof = new THREE.LatheGeometry(roofPts, 8); roof.translate(LAMP_X, top - 0.02, 0); roof.rotateY(0); add(roof, bronze);
  const bandTop = top - 0.13;
  const b1 = new THREE.CylinderGeometry(0.128, 0.128, 0.022, 8); b1.translate(LAMP_X, bandTop, 0); add(b1, darkBronze);
  const gH = 0.22, gY = bandTop - 0.011 - gH / 2;
  const g = new THREE.CylinderGeometry(0.112, 0.112, gH, 8, 1, false); g.translate(LAMP_X, gY, 0); add(g, glass, !night);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bar = new THREE.CylinderGeometry(0.008, 0.008, gH, 8); bar.translate(LAMP_X + 0.121 * Math.cos(a), gY, 0.121 * Math.sin(a)); add(bar, bronze);
  }
  const b2 = new THREE.CylinderGeometry(0.13, 0.12, 0.024, 8); b2.translate(LAMP_X, gY - gH / 2 - 0.012, 0); add(b2, darkBronze);
  const bottomPts = [[0.12, 0], [0.1, -0.03], [0.05, -0.06], [0.02, -0.075], [0, -0.08]].map(([r, h]) => new THREE.Vector2(r, h));
  const bottom = new THREE.LatheGeometry(bottomPts, 8); bottom.translate(LAMP_X, gY - gH / 2 - 0.024, 0); add(bottom, bronze);
  const drop = new THREE.SphereGeometry(0.018, 24, 12); drop.translate(LAMP_X, gY - gH / 2 - 0.11, 0); add(drop, bronze);

  // flame
  if (night) {
    const flame = new THREE.SphereGeometry(0.03, 24, 16); flame.scale(1, 1.9, 1); flame.translate(LAMP_X, gY - 0.02, 0);
    add(flame, new THREE.MeshBasicMaterial({ color: 0xfff1c9 }), false);
  }
  const S = 1.35, hy = y + 0.03;
  for (const m of scene.children.slice(firstBody)) {
    m.geometry.translate(-LAMP_X, -hy, 0); m.geometry.scale(S, S, S); m.geometry.translate(LAMP_X, hy, 0);
  }
  return { glassY: hy + (gY - hy) * S };
}

// ------------------------------------------------------------------ render
const params = new URLSearchParams(location.search);
const piece = params.get("piece") || "cap";
const night = params.get("mode") === "night";
const pxPerUnit = Number(params.get("ppu") || 480);

const scene = new THREE.Scene();
const top = buildColumn(scene, night).top;
const { glassY } = buildLantern(scene, night);

const windows = {
  cap: [SHAFT_TOP - 0.95, top],
  tile: [10.5, 10.6],
  lantern: [LANTERN_Y - 2.75, LANTERN_Y + 1.75],
  base: [0, BASE_TOP + 0.75],
};
let [y0, y1] = windows[piece];
const W = Math.round((XR - XL) * pxPerUnit);
// An even pixel height keeps every piece on the same exact 2x downsample.
let H = Math.round((y1 - y0) * pxPerUnit); if (H % 2) H += 1;
if (piece === "base") y1 = y0 + H / pxPerUnit; else y0 = y1 - H / pxPerUnit;
const camera = new THREE.OrthographicCamera(XL, XR, y1, y0, 0.1, 50);
camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0);
camera.top = y1; camera.bottom = y0; camera.updateProjectionMatrix();
camera.position.set(0, 0, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = night ? 1.0 : 0.95;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = night ? 0.25 : 0.42;

// key light: sun by day, moon by night; aimed at the window so its shadow map is sharp
const key = new THREE.DirectionalLight(night ? 0x9fb4d8 : 0xfff1dc, night ? 0.55 : 3.1);
const mid = (y0 + y1) / 2;
key.position.set(-5.0, mid + 2.8, 2.6);
key.target.position.set(0, mid, 0);
scene.add(key, key.target);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
const span = Math.max(2.4, (y1 - y0) * 0.8 + 1.4);
Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 0.5, far: 20 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.012; key.shadow.radius = 3;
scene.add(new THREE.HemisphereLight(night ? 0x2a3550 : 0xfff6ea, night ? 0x0c0d12 : 0x8a7658, night ? 0.35 : 0.4));

if (night) {
  const lamp = new THREE.PointLight(0xffb266, 5.0, 2.05, 1.6);
  lamp.position.set(LAMP_X, glassY, 0.0);
  scene.add(lamp);
  // A second, softer warm light in front so the fluting facing us picks up glow too.
  const spill = new THREE.PointLight(0xffa85a, 1.5, 1.9, 1.8);
  spill.position.set(LAMP_X - 0.05, glassY - 0.05, 0.55);
  scene.add(spill);
}

renderer.render(scene, camera);

window.__done = { w: W, h: H, data: renderer.domElement.toDataURL("image/png") };
