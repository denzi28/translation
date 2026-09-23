/**
 * The lantern alone, for the light and dark switch: unlit bronze and smoky
 * glass by day, lit by night. Same model as the lanterns on the columns.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { lanternBody } from "./parts.js";

const params = new URLSearchParams(location.search);
const night = params.get("mode") === "night";
const width = Number(params.get("w") || 192);

const scene = new THREE.Scene();
const hook = new THREE.TorusGeometry(0.03, 0.008, 12, 32);
hook.translate(0, 0.03, 0);
scene.add(new THREE.Mesh(hook, new THREE.MeshStandardMaterial({ color: 0x4a3220, metalness: 1, roughness: 0.45 })));
const { glassY } = lanternBody(scene, night, { x: 0, hookY: 0, S: 1, links: 2 });

// frame the lantern from the hook to the drop at the bottom
const x0 = -0.21, x1 = 0.21, y0 = -0.64, y1 = 0.07;
const height = Math.round((width * (y1 - y0)) / (x1 - x0) / 2) * 2;
const camera = new THREE.OrthographicCamera(x0, x1, y1, y0, 0.1, 20);
camera.position.set(0, 0, 6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
renderer.setPixelRatio(1);
renderer.setSize(width, height);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = night ? 1.0 : 1.05;
document.body.appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = night ? 0.35 : 0.9;
const key = new THREE.DirectionalLight(night ? 0x9fb4d8 : 0xfff1dc, night ? 0.5 : 2.2);
key.position.set(-3, 4, 5);
scene.add(key, new THREE.HemisphereLight(0xfff6ea, 0x5a4a36, night ? 0.2 : 0.6));
if (night) {
  const l = new THREE.PointLight(0xffb266, 1.2, 1.2, 1.5);
  l.position.set(0, glassY, 0.25);
  scene.add(l);
}
renderer.render(scene, camera);
const g = new THREE.Vector3(0, glassY, 0).project(camera);
window.__done = {
  w: width, h: height, data: renderer.domElement.toDataURL("image/png"),
  map: { glass: [(g.x + 1) / 2, (1 - g.y) / 2] },
};
