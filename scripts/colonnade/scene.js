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
import { BASE_TOP, LAMP_X, LANTERN_Y, SHAFT_TOP, XL, XR, buildColumn, buildLantern } from "./parts.js";

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
