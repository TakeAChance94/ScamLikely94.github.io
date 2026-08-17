import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';

const hint = document.getElementById('hint');
const R = 12;
const PLAYER_HEIGHT = 0.05;
const ANGULAR_SPEED = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc5d8ec, 42, 90);
scene.background = new THREE.Color(0xc5d8ec);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lights
const hemi = new THREE.HemisphereLight(0xddeeff, 0x88aa66, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.1);
sun.position.set(20, 35, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
scene.add(sun);

// Soft sky sphere
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color(0x8eb6e0) },
    mid: { value: new THREE.Color(0xd4e4f5) },
    bot: { value: new THREE.Color(0xf0e0d0) }
  },
  vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top,mid,bot; varying vec3 vP; void main(){ float h=normalize(vP).y*.5+.5; vec3 c=mix(bot,mid,smoothstep(0.,.45,h)); c=mix(c,top,smoothstep(.4,1.,h)); gl_FragColor=vec4(c,1.); }`,
  side: THREE.BackSide, depthWrite: false
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), skyMat));

// Planet
const planetGeo = new THREE.SphereGeometry(R, 96, 96);
const planetMat = new THREE.MeshStandardMaterial({ color: 0x6dbf6a, roughness: 0.55, roughness: 0.85, flatShading: false });
const planet = new THREE.Mesh(planetGeo, planetMat);
planet.receiveShadow = true;
scene.add(planet);

// Path
const path = new THREE.Mesh(
  new THREE.TorusGeometry(R + 0.02, 0.25, 10, 80),
  new THREE.MeshStandardMaterial({ color: 0xa89880, roughness: 0.9 })
);
path.rotation.x = Math.PI / 2;
path.receiveShadow = true;
scene.add(path);

function onSphere(lat, lon, r) {
  const phi = Math.PI / 2 - lat, th = lon;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(th),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(th)
  );
}
function orient(obj, pos) {
  obj.position.copy(pos);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
}

// Houses (simple but with standard materials + shadows)
const houses = [];
function makeHouse(cfg) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 1.8, 1.7),
    new THREE.MeshStandardMaterial({ color: cfg.body, roughness: 0.7 })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 1.05, 4),
    new THREE.MeshStandardMaterial({ color: cfg.roof, roughness: 0.8 })
  );
  roof.position.y = 2.25;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.9, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4a3428 })
  );
  door.position.set(0, 0.45, 0.88);
  g.add(door);
  orient(g, onSphere(cfg.lat, cfg.lon, R));
  g.userData.name = cfg.name;
  scene.add(g);
  houses.push(g);
}
makeHouse({ name: 'skills', body: 0x6a9cc4, roof: 0x8b5a4a, lat: 0.22, lon: -0.9 });
makeHouse({ name: 'hobbies', body: 0xd4a06a, roof: 0x5c4030, lat: 0.1, lon: 0.35 });
makeHouse({ name: 'contact', body: 0x6aaf7a, roof: 0x4a3830, lat: 0.24, lon: 1.05 });

// Trees
function makeTree(lat, lon, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * s, 0.11 * s, 0.75 * s, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a32 })
  );
  trunk.position.y = 0.38 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5 * s, 0),
    new THREE.MeshStandardMaterial({ color: 0x4aaa5a, flatShading: true })
  );
  leaves.position.y = 1.0 * s;
  leaves.castShadow = true;
  g.add(leaves);
  orient(g, onSphere(lat, lon, R));
  scene.add(g);
}
[[0.48, -1.3, 1], [0.42, 1.35, 0.85], [0.55, 0.2, 1.1], [0.35, 0.7, 0.9]].forEach(([a, b, s]) => makeTree(a, b, s));

// Player root
const player = new THREE.Group();
player.position.copy(onSphere(0.06, 0, R + PLAYER_HEIGHT));
scene.add(player);

let mixer = null;
let walkAction = null;
let idleAction = null;
let characterReady = false;

const loader = new GLTFLoader();
loader.load(
  'static/models/character.glb',
  (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(1.1);
    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Center model feet near origin
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.y = -box.min.y;
    player.add(model);

    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model);
      const clips = gltf.animations;
      // Prefer walk/run/idle by name
      const walkClip = clips.find(c => /walk|run|jog/i.test(c.name)) || clips[0];
      const idleClip = clips.find(c => /idle|stand|tpose/i.test(c.name)) || clips[0];
      walkAction = mixer.clipAction(walkClip);
      idleAction = mixer.clipAction(idleClip);
      idleAction.play();
      walkAction.play();
      walkAction.setEffectiveWeight(0);
    }
    characterReady = true;
    hint.textContent = 'WASD · Drag look · Scroll zoom · E near house';
  },
  undefined,
  (err) => {
    console.error(err);
    hint.textContent = 'Character failed to load — check static/models/character.glb';
  }
);

// Controls
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

let camYaw = 0.2, camPitch = 0.4, targetYaw = 0.2, targetPitch = 0.4, camDist = 10;
let dragging = false, lx = 0, ly = 0;
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.target.closest?.('.panel')) return;
  dragging = true; lx = e.clientX; ly = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!dragging) return;
  targetYaw -= (e.clientX - lx) * 0.0045;
  targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - ly) * 0.0035, 0.18, 1.0);
  lx = e.clientX; ly = e.clientY;
});
window.addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.008, 6.5, 14);
}, { passive: false });

let moveAmt = 0;
const clock = new THREE.Clock();

function updatePlayer(dt) {
  let n = player.position.clone().normalize();
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.projectOnPlane(n);
  if (fwd.lengthSq() < 1e-8) {
    fwd.set(0, 0, -1);
    fwd.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
    fwd.projectOnPlane(n);
  }
  fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, n).normalize();

  let ix = 0, iz = 0;
  if (keys['w'] || keys['arrowup']) iz++;
  if (keys['s'] || keys['arrowdown']) iz--;
  if (keys['a'] || keys['arrowleft']) ix--;
  if (keys['d'] || keys['arrowright']) ix++;
  const input = ix !== 0 || iz !== 0;
  moveAmt = THREE.MathUtils.damp(moveAmt, input ? 1 : 0, 10, dt);

  if (input) {
    const move = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();
    const axis = new THREE.Vector3().crossVectors(n, move);
    if (axis.lengthSq() > 1e-8) {
      axis.normalize();
      player.position.applyAxisAngle(axis, ANGULAR_SPEED * dt);
    }
    n = player.position.clone().normalize();
    if (n.y < 0.2) { n.y = 0.2; n.normalize(); }
    player.position.copy(n.clone().multiplyScalar(R + PLAYER_HEIGHT));

    const face = move.projectOnPlane(n).normalize();
    if (face.lengthSq() > 1e-6) {
      const x = new THREE.Vector3().crossVectors(n, face).normalize();
      const z = new THREE.Vector3().crossVectors(x, n).normalize();
      const tq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, z));
      player.quaternion.slerp(tq, 1 - Math.exp(-12 * dt));
    }
  } else {
    n = player.position.clone().normalize();
    player.position.copy(n.multiplyScalar(R + PLAYER_HEIGHT));
  }

  // Blend walk / idle animations
  if (walkAction && idleAction) {
    walkAction.setEffectiveWeight(moveAmt);
    idleAction.setEffectiveWeight(1 - moveAmt);
  }
}

function updateCamera(dt) {
  camYaw = THREE.MathUtils.damp(camYaw, targetYaw, 10, dt);
  camPitch = THREE.MathUtils.damp(camPitch, targetPitch, 10, dt);
  const n = player.position.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const local = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  );
  const desired = player.position.clone().add(local.multiplyScalar(camDist).applyQuaternion(q));
  camera.position.lerp(desired, 1 - Math.exp(-7 * dt));
  camera.up.copy(n);
  camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.8)));
}

let near = null;
function checkNear() {
  near = null;
  let best = 6;
  houses.forEach(h => {
    const d = player.position.distanceTo(h.position);
    if (d < best) { best = d; near = h.userData.name; }
  });
  if (characterReady) {
    hint.textContent = near ? 'Press E — ' + near : 'WASD · Drag look · Scroll zoom · E near house';
  }
}
function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
}
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'e' && near) openPanel(near);
  if (e.key === 'Escape') closePanels();
});
document.querySelectorAll('.close').forEach(b => b.addEventListener('click', closePanels));
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Start camera
(function () {
  const n = player.position.clone().normalize();
  camera.position.copy(player.position).add(n.multiplyScalar(5)).add(new THREE.Vector3(2, 3, 9));
  camera.up.copy(player.position.clone().normalize());
  camera.lookAt(player.position);
})();

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);
  updatePlayer(dt);
  updateCamera(dt);
  checkNear();
  renderer.render(scene, camera);
}
loop();
