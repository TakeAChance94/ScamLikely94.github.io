import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 90);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const amb = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xfff5e0, 1.1);
dir.position.set(30, 40, 20);
dir.castShadow = true;
scene.add(dir);

// Planet (small sphere)
const PLANET_R = 18;
const planetGeo = new THREE.SphereGeometry(PLANET_R, 64, 64);
const planetMat = new THREE.MeshStandardMaterial({ 
  color: 0x7ec850, 
  roughness: 0.85,
  flatShading: false
});
const planet = new THREE.Mesh(planetGeo, planetMat);
planet.receiveShadow = true;
scene.add(planet);

// Simple ground detail (noise-like via vertex colors or just color)
const groundGeo = new THREE.SphereGeometry(PLANET_R + 0.05, 32, 32);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3a, roughness: true });
const ground = new THREE.Mesh(groundGeo, groundMat);
scene.add(ground);

// Buildings as simple colored boxes on the surface
const buildings = [];
const buildingData = [
  { name: 'skills', color: 0x6b9bd1, lat: 0.3, lon: -0.8 },
  { name: 'hobbies', color: 0xe8a87c, lat: 0.15, lon: 0.2 },
  { name: 'contact', color: 0x8fbc8f, lat: 0.35, lon: 1.0 }
];

function latLonToVec(lat, lon, r) {
  const phi = Math.PI/2 - lat;
  const theta = lon;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

buildingData.forEach(d => {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.8, 2.2),
    new THREE.MeshStandardMaterial({ color: d.color })
  );
  box.castShadow = true;
  box.position.y = 1.4;
  group.add(box);
  // roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  );
  roof.position.y = 3.4;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const pos = latLonToVec(d.lat, d.lon, PLANET_R);
  group.position.copy(pos);
  group.lookAt(0, 0, 0);
  group.rotateX(Math.PI); // orient upright
  group.userData = { name: d.name };
  scene.add(group);
  buildings.push(group);
});

// Player (simple capsule-like)
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x4a3728 })
);
body.castShadow = true;
player.add(body);
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xf5d0c5 })
);
head.position.y = 1.0;
player.add(head);
// hair bun
const hair = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0x3d2314 })
);
hair.position.set(0, 1.35, -0.05);
player.add(hair);

const startPos = latLonToVec(0.1, 0, PLANET_R + 0.6);
player.position.copy(startPos);
player.lookAt(0, 0, 0);
player.rotateX(Math.PI);
scene.add(player);

// Camera follow
const camOffset = new THREE.Vector3(0, 4, 8);
let camTarget = new THREE.Vector3();

// Controls
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

const moveSpeed = 0.12;
const up = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const tmp = new THREE.Vector3();

function getSurfaceNormal(pos) {
  return pos.clone().normalize();
}

function stickToSurface() {
  const n = getSurfaceNormal(player.position);
  player.position.copy(n.multiplyScalar(PLANET_R + 0.6));
  // orient player upright relative to planet
  const look = player.position.clone().add(n);
  // keep current facing roughly
}

// Simple movement along surface
function updatePlayer() {
  const n = getSurfaceNormal(player.position);
  
  // camera-relative directions projected onto tangent plane
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.projectOnPlane(n).normalize();
  
  const rightDir = new THREE.Vector3().crossVectors(camDir, n).normalize();

  let moved = false;
  if (keys['w'] || keys['arrowup']) {
    player.position.addScaledVector(camDir, moveSpeed);
    moved = true;
  }
  if (keys['s'] || keys['arrowdown']) {
    player.position.addScaledVector(camDir, -moveSpeed);
    moved = true;
  }
  if (keys['a'] || keys['arrowleft']) {
    player.position.addScaledVector(rightDir, -moveSpeed);
    moved = true;
  }
  if (keys['d'] || keys['arrowright']) {
    player.position.addScaledVector(rightDir, moveSpeed);
    moved = true;
  }

  // re-stick and orient
  const newN = getSurfaceNormal(player.position);
  player.position.copy(newN.multiplyScalar(PLANET_R + 0.6));

  // face movement direction
  if (moved) {
    const tangent = camDir.clone();
    const lookAt = player.position.clone().add(tangent);
    // simple orientation
    player.up.copy(newN);
    player.lookAt(lookAt);
  }
}

// Camera
function updateCamera() {
  const n = getSurfaceNormal(player.position);
  const offset = n.clone().multiplyScalar(5).add(
    new THREE.Vector3().subVectors(camera.position, player.position).projectOnPlane(n).setLength(7)
  );
  // better fixed offset behind
  const behind = new THREE.Vector3();
  player.getWorldDirection(behind);
  behind.multiplyScalar(-8);
  const desired = player.position.clone().add(n.clone().multiplyScalar(4)).add(behind);
  
  camera.position.lerp(desired, 0.08);
  camera.up.copy(n);
  camera.lookAt(player.position);
}

// Interaction
let nearBuilding = null;
function checkBuildings() {
  nearBuilding = null;
  const p = player.position;
  buildings.forEach(b => {
    if (p.distanceTo(b.position) < 4.5) {
      nearBuilding = b.userData.name;
    }
  });
  const hint = document.getElementById('hint');
  hint.textContent = nearBuilding 
    ? `Press E to enter ${nearBuilding}` 
    : 'WASD / Arrows to move · Approach a house & press E';
}

window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'e' && nearBuilding) {
    openPanel(nearBuilding);
  }
});

function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
document.querySelectorAll('.close').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  });
});

// Raycast click buildings
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', e => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(buildings, true);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !obj.userData.name) obj = obj.parent;
    if (obj && obj.userData.name) openPanel(obj.userData.name);
  }
});

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Loop
function animate() {
  requestAnimationFrame(animate);
  updatePlayer();
  updateCamera();
  checkBuildings();
  renderer.render(scene, camera);
}
animate();
