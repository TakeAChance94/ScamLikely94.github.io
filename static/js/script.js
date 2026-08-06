import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8d8);
scene.fog = new THREE.Fog(0x87b8d8, 50, 120);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 12, 35);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
sun.position.set(40, 50, 30);
sun.castShadow = true;
scene.add(sun);

// Planet
const R = 16;
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(R, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x6dbb4a, roughness: 0.9 })
);
planet.receiveShadow = true;
scene.add(planet);

// Buildings
const buildings = [];
const data = [
  { name: 'skills', color: 0x5b9bd5, lat: 0.25, lon: -1.0 },
  { name: 'hobbies', color: 0xe09a5c, lat: 0.1, lon: 0.3 },
  { name: 'contact', color: 0x7cb87c, lat: 0.3, lon: 1.1 }
];

function toPos(lat, lon, r) {
  const phi = Math.PI / 2 - lat;
  const theta = lon;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

data.forEach(d => {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.0, 2.4),
    new THREE.MeshStandardMaterial({ color: d.color })
  );
  box.position.y = 1.5;
  box.castShadow = true;
  g.add(box);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.9, 1.3, 4),
    new THREE.MeshStandardMaterial({ color: 0x8b4513 })
  );
  roof.position.y = 3.6;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);

  const p = toPos(d.lat, d.lon, R);
  g.position.copy(p);
  g.lookAt(0, 0, 0);
  g.rotateX(Math.PI);
  g.userData.name = d.name;
  scene.add(g);
  buildings.push(g);
});

// Player
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 1.0, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x3d2b1f })
);
body.castShadow = true;
player.add(body);
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.38, 12, 12),
  new THREE.MeshStandardMaterial({ color: 0xf0c8b0 })
);
head.position.y = 1.15;
player.add(head);
const hair = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 8, 8),
  new THREE.MeshStandardMaterial({ color: 0x2a1a0e })
);
hair.position.set(0, 1.5, -0.05);
player.add(hair);

const start = toPos(0.05, 0, R + 0.7);
player.position.copy(start);
scene.add(player);

// Input
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

const speed = 0.15;

function updatePlayer() {
  const n = player.position.clone().normalize();

  // forward relative to camera, projected on tangent
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  camDir.projectOnPlane(n).normalize();
  const right = new THREE.Vector3().crossVectors(camDir, n).normalize();

  let moved = false;
  if (keys['w'] || keys['arrowup']) { player.position.addScaledVector(camDir, speed); moved = true; }
  if (keys['s'] || keys['arrowdown']) { player.position.addScaledVector(camDir, -speed); moved = true; }
  if (keys['a'] || keys['arrowleft']) { player.position.addScaledVector(right, -speed); moved = true; }
  if (keys['d'] || keys['arrowright']) { player.position.addScaledVector(right, speed); moved = true; }

  // stick to surface
  const newN = player.position.clone().normalize();
  player.position.copy(newN.multiplyScalar(R + 0.7));

  // face direction
  if (moved) {
    player.up.copy(newN);
    const look = player.position.clone().add(camDir);
    player.lookAt(look);
  }
}

function updateCamera() {
  const n = player.position.clone().normalize();
  const behind = new THREE.Vector3();
  player.getWorldDirection(behind);
  behind.multiplyScalar(-10);
  const desired = player.position.clone()
    .add(n.clone().multiplyScalar(5))
    .add(behind);
  camera.position.lerp(desired, 0.06);
  camera.up.copy(n);
  camera.lookAt(player.position);
}

// Interaction
let near = null;
function checkNear() {
  near = null;
  buildings.forEach(b => {
    if (player.position.distanceTo(b.position) < 5) near = b.userData.name;
  });
  const h = document.getElementById('hint');
  h.textContent = near
    ? `Press E to enter ${near}`
    : 'WASD / Arrows to move · Approach a house & press E';
}

window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'e' && near) openPanel(near);
});

function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
document.querySelectorAll('.close').forEach(b => {
  b.onclick = () => document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
});

// Click buildings
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(buildings, true);
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.name) o = o.parent;
    if (o?.userData.name) openPanel(o.userData.name);
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function loop() {
  requestAnimationFrame(loop);
  updatePlayer();
  updateCamera();
  checkNear();
  renderer.render(scene, camera);
}
loop();
