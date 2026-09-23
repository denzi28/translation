/**
 * The temple front for phones and the sign-in page: four Ionic columns under
 * an entablature (three-banded architrave, a plain frieze for the site's name,
 * a dentilled cornice) and a pediment with a round medallion at its centre for
 * the logo. Behind them stands the temple wall with a framed doorway, in
 * shadow by day and glowing by night, and two lanterns hang between the outer
 * columns.
 *
 * The view is cut off part way down the columns; the page fades them out.
 * The render also reports where the frieze, the medallion and the lanterns
 * land in the image, so the page can lay its lettering and glow over them.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildColumn, lanternBody, lanternMaterials } from "./parts.js";

const params = new URLSearchParams(location.search);
const night = params.get("mode") === "night";
const width = Number(params.get("w") || 1280);

// --------------------------------------------------------------- dimensions
const AXES = [-4.8, -1.6, 1.6, 4.8];   // column axes, tetrastyle
const SHAFT_TOP = 6.0;
const ENT = SHAFT_TOP + 0.475;          // top of the abacus: the entablature starts here
const HALF = 5.55;                      // half-width of the entablature
const WALL_Z = -3.0;                    // the temple wall behind the porch

const stone = new THREE.MeshStandardMaterial({
  color: night ? 0xc9ccd2 : 0xf3e9d8, roughness: 0.6, envMapIntensity: night ? 0.16 : 0.35,
});
const shadeStone = new THREE.MeshStandardMaterial({
  color: night ? 0xaeb2ba : 0xe6dac5, roughness: 0.7, envMapIntensity: night ? 0.12 : 0.3,
});

const scene = new THREE.Scene();
const add = (geo, mat = stone, cast = true) => {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
};

/** A moulding: a profile [[z, y], ...] (front z, height y) run along x from x0 to x1. */
function run(profile, x0, x1, mat = stone) {
  const shape = new THREE.Shape();
  const pts = [[profile[0][0] - 1.2, profile[0][1]], ...profile, [profile[profile.length - 1][0] - 1.2, profile[profile.length - 1][1]]];
  shape.moveTo(pts[0][0], pts[0][1]);
  for (const [z, y] of pts.slice(1)) shape.lineTo(z, y);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 12 });
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  g.computeVertexNormals();
  return add(g, mat);
}
const curve = (fn, z0, y0, z1, y1, n = 10) =>
  Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [z0 + (z1 - z0) * fn(t), y0 + (y1 - y0) * t]; });
const ovolo = (t) => Math.sqrt(1 - (1 - t) * (1 - t));
const cyma = (t) => (1 - Math.cos(Math.PI * t)) / 2;

/** A box with softly bevelled edges, so its corners catch the light. */
function block(x0, x1, y0, y1, z0, z1, mat = stone, bevel = 0.012) {
  const shape = new THREE.Shape();
  shape.moveTo(x0 + bevel, y0 + bevel); shape.lineTo(x1 - bevel, y0 + bevel);
  shape.lineTo(x1 - bevel, y1 - bevel); shape.lineTo(x0 + bevel, y1 - bevel); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: z1 - z0 - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2,
  });
  g.translate(0, 0, z0 + bevel);
  return add(g, mat);
}

// ------------------------------------------------------------------ columns
const column = new THREE.Group();
buildColumn(column, night, { shaftTop: SHAFT_TOP, base: false, shaftBottom: -2 });
for (const x of AXES) { const c = column.clone(); c.position.x = x; scene.add(c); }

// -------------------------------------------------------------- entablature
let y = ENT;
// architrave: three bands, each standing a little proud of the one below
const bands = [[0.24, 0.52], [0.26, 0.58], [0.28, 0.64]];
for (const [h, z] of bands) { block(-HALF, HALF, y, y + h, -0.7, z); y += h; }
run([[0.64, y], ...curve(ovolo, 0.64, y, 0.74, y + 0.09)], -HALF - 0.1, HALF + 0.1); y += 0.09;
const ARCH_TOP = y;
// frieze: plain, for the lettering
const FRIEZE = [y, y + 0.78];
block(-HALF, HALF, y, y + 0.78, -0.7, 0.6, shadeStone); y += 0.78;
run([[0.62, y], ...curve(cyma, 0.62, y, 0.72, y + 0.08)], -HALF - 0.1, HALF + 0.1); y += 0.08;
// cornice: dentils, then the overhanging corona, then the sima
const DENT_H = 0.16;
block(-HALF - 0.12, HALF + 0.12, y, y + DENT_H, -0.7, 0.66, shadeStone, 0.004);
for (let x = -HALF - 0.05; x < HALF + 0.05; x += 0.17) block(x, x + 0.11, y, y + DENT_H, 0.5, 0.8, stone, 0.008);
y += DENT_H;
run([[0.8, y], ...curve(ovolo, 0.8, y, 0.9, y + 0.06)], -HALF - 0.25, HALF + 0.25); y += 0.06;
block(-HALF - 0.35, HALF + 0.35, y, y + 0.26, -0.7, 1.2); y += 0.26;
run([[1.2, y], ...curve(cyma, 1.2, y, 1.3, y + 0.16, 14)], -HALF - 0.4, HALF + 0.4); y += 0.16;
const CORNICE_TOP = y;

// ------------------------------------------------------------------ pediment
const PITCH = (14 * Math.PI) / 180;
const SPAN = HALF + 0.4;
const RISE = SPAN * Math.tan(PITCH);
const tympanum = new THREE.Shape();
tympanum.moveTo(-HALF, CORNICE_TOP - 0.02); tympanum.lineTo(HALF, CORNICE_TOP - 0.02);
tympanum.lineTo(0, CORNICE_TOP + HALF * Math.tan(PITCH)); tympanum.closePath();
const tg = new THREE.ExtrudeGeometry(tympanum, { depth: 1.0, bevelEnabled: false });
tg.translate(0, 0, -0.6); add(tg, shadeStone);
// raking cornices: the same corona and sima, tilted up to the apex
for (const side of [-1, 1]) {
  const g = new THREE.Group();
  const len = SPAN / Math.cos(PITCH) + 0.25;
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); };
  const corona = new THREE.BoxGeometry(len, 0.3, 1.9); corona.translate(len / 2, 0.15, 0.25); mk(corona, stone);
  const sima = new THREE.BoxGeometry(len, 0.14, 1.95); sima.translate(len / 2, 0.37, 0.33); mk(sima, stone);
  const bed = new THREE.BoxGeometry(len, 0.08, 1.7); bed.translate(len / 2, -0.04, 0.15); mk(bed, shadeStone);
  g.rotation.z = side < 0 ? PITCH : Math.PI - PITCH;
  if (side > 0) g.scale.y = -1;
  g.position.set(side * (SPAN + 0.12), CORNICE_TOP - 0.08, 0);
  scene.add(g);
}
const APEX = CORNICE_TOP + RISE;
// the medallion at the centre of the tympanum
const MEDAL = { x: 0, y: CORNICE_TOP + RISE * 0.42, r: 0.5 };
const disc = new THREE.CylinderGeometry(MEDAL.r, MEDAL.r, 0.12, 96); disc.rotateX(Math.PI / 2); disc.translate(MEDAL.x, MEDAL.y, 0.46); add(disc, stone);
const rim = new THREE.TorusGeometry(MEDAL.r, 0.045, 16, 96); rim.translate(MEDAL.x, MEDAL.y, 0.52); add(rim, stone);
// acroteria: a palmette on the apex, smaller ones on the corners
function palmette(x, yb, s) {
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = ((i - (lobes - 1) / 2) / ((lobes - 1) / 2)) * 1.05;
    const leaf = new THREE.Shape(); leaf.absellipse(0, 0.26 * s, 0.07 * s, 0.26 * s, 0, Math.PI * 2);
    const g = new THREE.ExtrudeGeometry(leaf, { depth: 0.06 * s, bevelEnabled: true, bevelSize: 0.015 * s, bevelThickness: 0.015 * s, bevelSegments: 2 });
    g.rotateZ(-a); g.translate(x, yb + 0.1 * s, 0.3); add(g, stone);
  }
  for (const d of [-1, 1]) {
    const scroll = new THREE.TorusGeometry(0.09 * s, 0.03 * s, 12, 32); scroll.translate(x + d * 0.1 * s, yb + 0.06 * s, 0.33); add(scroll, stone);
  }
  block(x - 0.2 * s, x + 0.2 * s, yb - 0.12 * s, yb, 0.1, 0.55);
}
palmette(0, APEX + 0.3, 1.5);
palmette(-SPAN - 0.1, CORNICE_TOP + 0.35, 0.9);
palmette(SPAN + 0.1, CORNICE_TOP + 0.35, 0.9);

// ---------------------------------------------------- porch, wall and door
block(-HALF, HALF, ARCH_TOP - 0.1, ARCH_TOP, WALL_Z, -0.6, shadeStone, 0.004);        // porch ceiling
const DOOR = { x0: -0.95, x1: 0.95, top: 4.3 };
// the wall, built round the doorway
block(-HALF + 0.2, DOOR.x0, -3, ARCH_TOP, WALL_Z - 0.4, WALL_Z, shadeStone, 0.004);
block(DOOR.x1, HALF - 0.2, -3, ARCH_TOP, WALL_Z - 0.4, WALL_Z, shadeStone, 0.004);
block(DOOR.x0, DOOR.x1, DOOR.top, ARCH_TOP, WALL_Z - 0.4, WALL_Z, shadeStone, 0.004);
const doorFrame = [[DOOR.x0 - 0.22, DOOR.x0, -3, DOOR.top], [DOOR.x1, DOOR.x1 + 0.22, -3, DOOR.top], [DOOR.x0 - 0.22, DOOR.x1 + 0.22, DOOR.top, DOOR.top + 0.24]];
for (const [x0, x1, y0, y1] of doorFrame) block(x0, x1, y0, y1, WALL_Z, WALL_Z + 0.14, stone);
block(DOOR.x0 - 0.4, DOOR.x1 + 0.4, DOOR.top + 0.3, DOOR.top + 0.5, WALL_Z, WALL_Z + 0.26, stone); // the lintel's cornice
// the opening: dark by day; by night the room beyond is lit by a fire, so the
// glow is strongest low down and falls away towards the lintel
const roomGeo = new THREE.PlaneGeometry(DOOR.x1 - DOOR.x0 + 0.6, DOOR.top + 3.4, 1, 24);
roomGeo.translate(0, (DOOR.top - 3) / 2, WALL_Z - 1.6);
{
  const pos = roomGeo.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - 1.8) / (DOOR.top - 1.8)));
    const c = night
      ? new THREE.Color(0xe08a3a).lerp(new THREE.Color(0x3a1c0a), Math.pow(t, 0.8))
      : new THREE.Color(0x1d1812).lerp(new THREE.Color(0x0c0a07), t);
    col.push(c.r, c.g, c.b);
  }
  roomGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
}
add(roomGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }), false);
for (const x of [DOOR.x0, DOOR.x1]) block(x - 0.02, x + 0.02, -3, DOOR.top, WALL_Z - 1.6, WALL_Z, new THREE.MeshStandardMaterial({ color: night ? 0x3a2412 : 0x201a14, roughness: 1 }), 0.002);
block(DOOR.x0, DOOR.x1, DOOR.top - 0.02, DOOR.top, WALL_Z - 1.6, WALL_Z, new THREE.MeshStandardMaterial({ color: night ? 0x3a2412 : 0x201a14, roughness: 1 }), 0.002);

// --------------------------------------------------------------- lanterns
const LAMPS = [-3.2, 3.2];
const mats = lanternMaterials(night);
const glass = [];
for (const x of LAMPS) {
  const hook = new THREE.CylinderGeometry(0.06, 0.08, 0.06, 24); hook.translate(x, ENT - 0.03, 0); add(hook, mats.darkBronze);
  const { glassY } = lanternBody(scene, night, { x, hookY: ENT - 0.06, z: 0, S: 2.1, links: 12, mats });
  glass.push([x, glassY]);
}

// ------------------------------------------------------------------ camera
const view = { x0: -6.35, x1: 6.35, y0: 1.9 };
const top = APEX + 1.35;
const aspect = (view.x1 - view.x0) / (top - view.y0);
const height = Math.round(width / aspect / 2) * 2;
const camera = new THREE.PerspectiveCamera(22, aspect, 1, 200);
const dist = ((top - view.y0) / 2) / Math.tan((22 * Math.PI) / 360);
camera.position.set(0, (top + view.y0) / 2 - 0.9, dist + 1.3);
camera.lookAt(0, (top + view.y0) / 2 - 0.2, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.setPixelRatio(1);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = night ? 1.0 : 0.95;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = night ? 0.2 : 0.42;

const key = new THREE.DirectionalLight(night ? 0x9fb4d8 : 0xfff1dc, night ? 0.45 : 3.0);
key.position.set(-13, 15, 11);
key.target.position.set(0, 6, 0);
scene.add(key, key.target);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 60 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
scene.add(new THREE.HemisphereLight(night ? 0x2a3550 : 0xfff6ea, night ? 0x0c0d12 : 0x8a7658, night ? 0.3 : 0.45));

if (night) {
  for (const [x, gy] of glass) {
    const l = new THREE.PointLight(0xffb266, 9, 6, 1.5); l.position.set(x, gy, 0); scene.add(l);
  }
  const hearth = new THREE.PointLight(0xff9a45, 7, 6, 1.6); hearth.position.set(0, 2.2, WALL_Z - 1.1); scene.add(hearth);
}

renderer.render(scene, camera);

// where things land in the image, as fractions of its width and height
const at = (x, yy, z) => { const v = new THREE.Vector3(x, yy, z).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
const [fl, ft] = at(-HALF, FRIEZE[1], 0.62), [fr, fb] = at(HALF, FRIEZE[0], 0.62);
const [mx, my] = at(MEDAL.x, MEDAL.y, 0.52), [mx2] = at(MEDAL.x + MEDAL.r, MEDAL.y, 0.52);
window.__done = {
  w: width, h: height,
  data: renderer.domElement.toDataURL("image/png"),
  map: {
    frieze: { left: fl, right: fr, top: ft, bottom: fb },
    medallion: { x: mx, y: my, r: mx2 - mx },
    lamps: glass.map(([x, gy]) => at(x, gy, 0)),
    door: at(0, DOOR.top / 2, WALL_Z),
  },
};
