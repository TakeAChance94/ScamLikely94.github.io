(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  // ---------- Custom toon + rim shader ----------
  const toonVertex = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorldPos = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;

  const toonFragment = `
    uniform vec3 uColor;
    uniform vec3 uLightDir;
    uniform float uSteps;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightDir);
      float ndl = max(dot(n, l), 0.0);
      // cel steps
      float cel = floor(ndl * uSteps) / uSteps;
      cel = mix(0.35, 1.0, cel);
      // soft rim
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = 1.0 - max(dot(viewDir, n), 0.0);
      rim = pow(rim, 2.5) * 0.18;
      vec3 col = uColor * cel + vec3(rim);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function makeToonMaterial(colorHex, steps) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(colorHex) },
        uLightDir: { value: new THREE.Vector3(0.6, 1.0, 0.35).normalize() },
        uSteps: { value: steps || 3.0 }
      },
      vertexShader: toonVertex,
      fragmentShader: toonFragment
    });
  }

  // Inverted-hull outline
  function addOutline(mesh, thickness, colorHex) {
    const outlineMat = new THREE.MeshBasicMaterial({
      color: colorHex || 0x1a1520,
      side: THREE.BackSide
    });
    const outline = new THREE.Mesh(mesh.geometry, outlineMat);
    outline.scale.multiplyScalar(thickness || 1.045);
    mesh.add(outline);
    return outline;
  }

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb8d4e8);
  scene.fog = new THREE.Fog(0xb8d4e8, 45, 95);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Soft ambient fill via hemisphere feel
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sun = new THREE.DirectionalLight(0xfff2dd, 0.9);
  sun.position.set(20, 30, 15);
  scene.add(sun);

  // ---------- Planet ----------
  const R = 14;
  const planetGeo = new THREE.SphereGeometry(R, 64, 64);
  const planet = new THREE.Mesh(planetGeo, makeToonMaterial(0x6dbf5a, 4));
  scene.add(planet);
  addOutline(planet, 1.012, 0x2a3a28);

  // Path ring on surface
  const ringGeo = new THREE.RingGeometry(R + 0.02, R + 0.04, 64);
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshBasicMaterial({ color: 0x8a8a8a, side: THREE.DoubleSide })
  );
  // place ring as equatorial path - actually use a torus sitting on surface
  const path = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.05, 0.55, 8, 48),
    makeToonMaterial(0x8b8b8b, 3)
  );
  path.rotation.x = Math.PI / 2;
  scene.add(path);

  // Grass patches as small spheres on surface
  function placeOnSphere(lat, lon, r) {
    const phi = Math.PI / 2 - lat;
    const theta = lon;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ---------- Houses ----------
  const houses = [];
  const houseData = [
    { name: 'skills', color: 0x6ba3d4, roof: 0x8b5a3c, lat: 0.28, lon: -0.95 },
    { name: 'hobbies', color: 0xe8a06c, roof: 0x5c3a2a, lat: 0.12, lon: 0.25 },
    { name: 'contact', color: 0x7cbc7c, roof: 0x4a3728, lat: 0.32, lon: 1.05 }
  ];

  function makeHouse(d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.6, 2.4),
      makeToonMaterial(d.color, 3)
    );
    body.position.y = 1.3;
    addOutline(body, 1.05, 0x1a1520);
    g.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 1.4, 4),
      makeToonMaterial(d.roof, 3)
    );
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    addOutline(roof, 1.05, 0x1a1520);
    g.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.3, 0.12),
      makeToonMaterial(0x3e2a1a, 2)
    );
    door.position.set(0, 0.65, 1.22);
    g.add(door);

    const pos = placeOnSphere(d.lat, d.lon, R);
    g.position.copy(pos);
    const up = pos.clone().normalize();
    g.up.copy(up);
    g.lookAt(0, 0, 0);
    g.rotateX(Math.PI);
    g.userData.name = d.name;
    scene.add(g);
    houses.push(g);
    return g;
  }
  houseData.forEach(makeHouse);

  // Trees
  function makeTree(lat, lon) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.9, 6),
      makeToonMaterial(0x6b4423, 2)
    );
    trunk.position.y = 0.45;
    g.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 0),
      makeToonMaterial(0x3d9b4a, 3)
    );
    leaves.position.y = 1.2;
    addOutline(leaves, 1.06, 0x1a2a18);
    g.add(leaves);
    const pos = placeOnSphere(lat, lon, R);
    g.position.copy(pos);
    g.lookAt(0, 0, 0);
    g.rotateX(Math.PI);
    scene.add(g);
  }
  [[0.5, -1.5], [0.45, 1.6], [-0.2, 0.8], [0.6, 0.1], [-0.35, -0.6]].forEach(([la, lo]) => makeTree(la, lo));

  // ---------- Player ----------
  const player = new THREE.Group();
  const bodyMat = makeToonMaterial(0x3d2b1f, 3);
  const skinMat = makeToonMaterial(0xf0c8b0, 2);
  const hairMat = makeToonMaterial(0x2a1a0e, 2);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.55, 4, 8), bodyMat);
  torso.position.y = 1.05;
  addOutline(torso, 1.08, 0x1a1520);
  player.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), skinMat);
  head.position.y = 1.75;
  addOutline(head, 1.08, 0x1a1520);
  player.add(head);

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), hairMat);
  bun.position.set(0, 2.05, -0.08);
  player.add(bun);

  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), hairMat);
  stache.position.set(0, 1.62, 0.28);
  player.add(stache);

  const armGeo = new THREE.CapsuleGeometry(0.1, 0.35, 3, 6);
  const leftArm = new THREE.Mesh(armGeo, bodyMat);
  leftArm.position.set(-0.48, 1.1, 0);
  player.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, bodyMat);
  rightArm.position.set(0.48, 1.1, 0);
  player.add(rightArm);

  const legGeo = new THREE.CapsuleGeometry(0.12, 0.4, 3, 6);
  const leftLeg = new THREE.Mesh(legGeo, makeToonMaterial(0x1a120c, 2));
  leftLeg.position.set(-0.18, 0.35, 0);
  player.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, makeToonMaterial(0x1a120c, 2));
  rightLeg.position.set(0.18, 0.35, 0);
  player.add(rightLeg);

  const start = placeOnSphere(0.08, 0, R + 0.85);
  player.position.copy(start);
  scene.add(player);

  // Initial camera outside the planet (not at origin)
  (function initCam() {
    const n = player.position.clone().normalize();
    camera.position.copy(player.position).add(n.multiplyScalar(6)).add(new THREE.Vector3(0, 2, 12));
    camera.up.copy(player.position.clone().normalize());
    camera.lookAt(player.position);
  })();

  // ---------- Controls ----------
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  let walkPhase = 0;
  const speed = 0.11;

  function stickAndOrient(obj, extraY) {
    const n = obj.position.clone().normalize();
    obj.position.copy(n.multiplyScalar(R + (extraY || 0.85)));
    return n;
  }

  function updatePlayer() {
    const n = player.position.clone().normalize();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.projectOnPlane(n).normalize();
    const right = new THREE.Vector3().crossVectors(camDir, n).normalize();

    let moved = false;
    if (keys['w'] || keys['arrowup']) { player.position.addScaledVector(camDir, speed); moved = true; }
    if (keys['s'] || keys['arrowdown']) { player.position.addScaledVector(camDir, -speed); moved = true; }
    if (keys['a'] || keys['arrowleft']) { player.position.addScaledVector(right, -speed); moved = true; }
    if (keys['d'] || keys['arrowright']) { player.position.addScaledVector(right, speed); moved = true; }

    const newN = stickAndOrient(player, 0.85);

    if (moved) {
      walkPhase += 0.28;
      leftLeg.rotation.x = Math.sin(walkPhase) * 0.7;
      rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.7;
      leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.4;
      rightArm.rotation.x = Math.sin(walkPhase) * 0.4;
      player.up.copy(newN);
      const look = player.position.clone().add(camDir);
      player.lookAt(look);
    } else {
      leftLeg.rotation.x = rightLeg.rotation.x = leftArm.rotation.x = rightArm.rotation.x = 0;
    }
  }

  function updateCamera() {
    const n = player.position.clone().normalize();
    const behind = new THREE.Vector3();
    player.getWorldDirection(behind);
    behind.multiplyScalar(-9);
    const desired = player.position.clone()
      .add(n.clone().multiplyScalar(4.5))
      .add(behind);
    camera.position.lerp(desired, 0.07);
    camera.up.copy(n);
    camera.lookAt(player.position);
  }

  // ---------- Interaction ----------
  let near = null;
  function checkNear() {
    near = null;
    houses.forEach(h => {
      if (player.position.distanceTo(h.position) < 5.2) near = h.userData.name;
    });
    const hint = document.getElementById('hint');
    hint.textContent = near
      ? `Press E to enter ${near}`
      : 'WASD / arrows to move · Approach a house & press E';
  }

  function openPanel(id) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }
  function closePanels() {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  }

  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'e' && near) openPanel(near);
    if (e.key === 'Escape') closePanels();
  });
  document.querySelectorAll('.close').forEach(b => b.addEventListener('click', closePanels));

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', e => {
    if (e.target.closest('.panel')) return;
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(houses, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.name) o = o.parent;
      if (o && o.userData.name) openPanel(o.userData.name);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- Loop ----------
  function loop() {
    requestAnimationFrame(loop);
    updatePlayer();
    updateCamera();
    checkNear();
    // subtle planet spin feel via light direction is enough
    renderer.render(scene, camera);
  }
  loop();
})();
