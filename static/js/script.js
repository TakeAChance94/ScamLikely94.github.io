(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ec8e8);
  scene.fog = new THREE.Fog(0x9ec8e8, 35, 70);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 7, 16);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
  sun.position.set(15, 25, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  // Soft fill
  const fill = new THREE.DirectionalLight(0xb0d0ff, 0.35);
  fill.position.set(-10, 8, -5);
  scene.add(fill);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 40),
    new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cul-de-sac circle
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x6e6e6e })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.02, -7);
  circle.receiveShadow = true;
  scene.add(circle);

  // Road center line
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
  for (let z = 8; z > -2; z -= 2.2) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.2), lineMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.03, z);
    scene.add(dash);
  }

  // Grass strips
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5aae45, roughness: 0.9 });
  [[-11, 0, -2], [11, 0, -2], [0, 0, -15]].forEach(([x, y, z]) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 14), grassMat);
    g.position.set(x, y, z);
    g.receiveShadow = true;
    scene.add(g);
  });

  // Simple trees
  function addTree(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
    );
    trunk.position.set(x, 0.8, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x3d8b37 })
    );
    leaves.position.set(x, 2.4, z);
    leaves.castShadow = true;
    scene.add(leaves);
  }
  [[-13, 2], [-12, -12], [12, 3], [13, -11], [-8, -16], [8, -16]].forEach(([x, z]) => addTree(x, z));

  // Unique houses
  const houses = [];
  function makeHouse(x, z, bodyColor, roofColor, name, w = 4.2, d = 4.2) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, 3.2, d),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 })
    );
    body.position.y = 1.6;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.2, 4),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85 })
    );
    roof.position.y = 4.3;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.0, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x3e2a1a })
    );
    door.position.set(0, 1.0, d / 2 + 0.05);
    group.add(door);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x224466, emissiveIntensity: 0.15 });
    [-1.3, 1.3].forEach(wx => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.08), winMat);
      win.position.set(wx, 2.2, d / 2 + 0.05);
      group.add(win);
    });

    // Chimney
    const chim = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    chim.position.set(w * 0.3, 4.8, -d * 0.2);
    group.add(chim);

    group.position.set(x, 0, z);
    group.userData = { name };
    scene.add(group);
    houses.push(group);
  }

  makeHouse(-9.5, -5, 0x6b9ed4, 0x8b4513, 'skills', 4.5, 4.0);
  makeHouse(0, -11.5, 0xe8a06c, 0x5c3a2a, 'hobbies', 4.0, 4.5);
  makeHouse(9.5, -5, 0x7cbc7c, 0x4a3728, 'contact', 4.3, 4.2);

  // Character with arms & legs
  const player = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2c9b0 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x2c2118 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f120a });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.42), clothMat);
  torso.position.y = 1.35;
  torso.castShadow = true;
  player.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 14), skinMat);
  head.position.y = 2.2;
  head.castShadow = true;
  player.add(head);

  // Hair bun
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), hairMat);
  bun.position.set(0, 2.52, -0.08);
  player.add(bun);

  // Mustache
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), hairMat);
  stache.position.set(0, 2.02, 0.3);
  player.add(stache);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.22, 0.75, 0.22);
  const leftArm = new THREE.Mesh(armGeo, clothMat);
  leftArm.position.set(-0.52, 1.35, 0);
  leftArm.castShadow = true;
  player.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, clothMat);
  rightArm.position.set(0.52, 1.35, 0);
  rightArm.castShadow = true;
  player.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);
  const leftLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x1a120c }));
  leftLeg.position.set(-0.22, 0.42, 0);
  leftLeg.castShadow = true;
  player.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, new THREE.MeshStandardMaterial({ color: 0x1a120c }));
  rightLeg.position.set(0.22, 0.42, 0);
  rightLeg.castShadow = true;
  player.add(rightLeg);

  player.position.set(0, 0, 7);
  scene.add(player);

  // Bounds
  const bounds = { minX: -13, maxX: 13, minZ: -15, maxZ: 11 };

  // Input + animation
  const keys = {};
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  const speed = 0.13;
  let phase = 0;

  function updatePlayer() {
    let dx = 0, dz = 0;
    if (keys['w'] || keys['arrowup']) dz -= speed;
    if (keys['s'] || keys['arrowdown']) dz += speed;
    if (keys['a'] || keys['arrowleft']) dx -= speed;
    if (keys['d'] || keys['arrowright']) dx += speed;

    if (dx || dz) {
      player.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, player.position.x + dx));
      player.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, player.position.z + dz));
      player.rotation.y = Math.atan2(dx, dz);

      phase += 0.28;
      leftLeg.rotation.x = Math.sin(phase) * 0.7;
      rightLeg.rotation.x = Math.sin(phase + Math.PI) * 0.7;
      leftArm.rotation.x = Math.sin(phase + Math.PI) * 0.45;
      rightArm.rotation.x = Math.sin(phase) * 0.45;
    } else {
      leftLeg.rotation.x = rightLeg.rotation.x = leftArm.rotation.x = rightArm.rotation.x = 0;
    }
  }

  function updateCamera() {
    const target = new THREE.Vector3(player.position.x, 6.5, player.position.z + 13);
    camera.position.lerp(target, 0.07);
    camera.lookAt(player.position.x, 1.6, player.position.z);
  }

  // Interaction
  let near = null;
  function checkNear() {
    near = null;
    houses.forEach(h => {
      if (player.position.distanceTo(h.position) < 4.8) near = h.userData.name;
    });
    document.getElementById('hint').textContent = near
      ? `Press E to enter ${near}`
      : 'WASD / Arrows · Walk the cul-de-sac · Approach a house & press E';
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

  // Click
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', e => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hits = ray.intersectObjects(houses, true);
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
})();
