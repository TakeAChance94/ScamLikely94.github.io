(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js – check console';
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.Fog(0x87b8d8, 40, 80);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 8, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(20, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);

  // Ground – cul-de-sac shape (large plane + circle)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Circle at end of cul-de-sac
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(8, 32),
    new THREE.MeshStandardMaterial({ color: 0x777777 })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.01, -6);
  circle.receiveShadow = true;
  scene.add(circle);

  // Grass borders
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a9e3a });
  [[-12, 0, 0], [12, 0, 0], [0, 0, -14]].forEach(p => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 12), grassMat);
    g.position.set(...p);
    g.receiveShadow = true;
    scene.add(g);
  });

  // Unique houses
  const houses = [];
  function makeHouse(x, z, color, roofColor, name, scale = 1) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4 * scale, 3 * scale, 4 * scale),
      new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = 1.5 * scale;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.2 * scale, 2 * scale, 4),
      new THREE.MeshStandardMaterial({ color: roofColor })
    );
    roof.position.y = 4 * scale;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1 * scale, 1.8 * scale, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x4a3728 })
    );
    door.position.set(0, 0.9 * scale, 2.05 * scale);
    group.add(door);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0xaaddff });
    [-1.2, 1.2].forEach(wx => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.1), winMat);
      w.position.set(wx * scale, 2 * scale, 2.05 * scale);
      group.add(w);
    });

    group.position.set(x, 0, z);
    group.userData = { name };
    scene.add(group);
    houses.push(group);
    return group;
  }

  makeHouse(-9, -4, 0x6b9bd1, 0x8b4513, 'skills', 1.1);   // blue
  makeHouse(0, -10, 0xe8a87c, 0x5c4033, 'hobbies', 1.0);  // orange
  makeHouse(9, -4, 0x8fbc8f, 0x654321, 'contact', 1.15);  // green

  // Better character with arms & legs
  const player = new THREE.Group();
  const skin = 0xf0c8b0;
  const clothes = 0x3d2b1f;

  // Torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.0, 0.4),
    new THREE.MeshStandardMaterial({ color: clothes })
  );
  torso.position.y = 1.3;
  torso.castShadow = true;
  player.add(torso);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshStandardMaterial({ color: skin })
  );
  head.position.y = 2.1;
  player.add(head);

  // Hair / bun
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1a0e })
  );
  hair.position.set(0, 2.4, -0.05);
  player.add(hair);

  // Mustache
  const mustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x2a1a0e })
  );
  mustache.position.set(0, 1.95, 0.28);
  player.add(mustache);

  // Arms
  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  const armMat = new THREE.MeshStandardMaterial({ color: clothes });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.5, 1.3, 0);
  leftArm.castShadow = true;
  player.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.5, 1.3, 0);
  rightArm.castShadow = true;
  player.add(rightArm);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0e });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  player.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  player.add(rightLeg);

  player.position.set(0, 0, 6);
  scene.add(player);

  // Bounds for cul-de-sac
  const bounds = { minX: -14, maxX: 14, minZ: -14, maxZ: 10 };

  // Input
  const keys = {};
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

  const speed = 0.12;
  let walkPhase = 0;

  function updatePlayer() {
    let dx = 0, dz = 0;
    if (keys['w'] || keys['arrowup']) dz -= speed;
    if (keys['s'] || keys['arrowdown']) dz += speed;
    if (keys['a'] || keys['arrowleft']) dx -= speed;
    if (keys['d'] || keys['arrowright']) dx += speed;

    if (dx !== 0 || dz !== 0) {
      player.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, player.position.x + dx));
      player.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, player.position.z + dz));

      // Face movement
      player.rotation.y = Math.atan2(dx, dz);

      // Simple walk animation
      walkPhase += 0.25;
      leftLeg.rotation.x = Math.sin(walkPhase) * 0.6;
      rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.6;
      leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.4;
      rightArm.rotation.x = Math.sin(walkPhase) * 0.4;
    } else {
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = 0;
      rightArm.rotation.x = 0;
    }
  }

  function updateCamera() {
    const target = new THREE.Vector3(
      player.position.x,
      player.position.y + 5,
      player.position.z + 12
    );
    camera.position.lerp(target, 0.08);
    camera.lookAt(player.position.x, player.position.y + 1.5, player.position.z);
  }

  // Interaction
  let near = null;
  function checkNear() {
    near = null;
    houses.forEach(h => {
      if (player.position.distanceTo(h.position) < 4.5) near = h.userData.name;
    });
    const hint = document.getElementById('hint');
    hint.textContent = near
      ? `Press E to enter ${near}`
      : 'WASD / Arrows to walk the cul-de-sac · Approach a house & press E';
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

  // Click houses
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
      if (o && o.userData.name) openPanel(o.userData.name);
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
