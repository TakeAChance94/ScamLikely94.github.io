(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  const R = 12;
  const clock = new THREE.Clock();

  // ===================== SHADERS =====================

  // Sky dome — soft gradient like Messenger
  const skyVert = `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const skyFrag = `
    uniform vec3 uTop;
    uniform vec3 uMid;
    uniform vec3 uBot;
    uniform float uTime;
    varying vec3 vWorldPos;
    void main() {
      vec3 dir = normalize(vWorldPos);
      float h = dir.y * 0.5 + 0.5;
      vec3 col = mix(uBot, uMid, smoothstep(0.0, 0.45, h));
      col = mix(col, uTop, smoothstep(0.4, 1.0, h));
      // subtle sun glow
      vec3 sunDir = normalize(vec3(0.45, 0.55, 0.3));
      float sun = pow(max(dot(dir, sunDir), 0.0), 32.0) * 0.35;
      col += vec3(1.0, 0.92, 0.75) * sun;
      // gentle haze band
      float haze = exp(-abs(dir.y) * 3.0) * 0.12;
      col += vec3(0.9, 0.85, 1.0) * haze;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // Cel-shaded surface with rim + dithered steps (Messenger-like)
  const toonVert = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const toonFrag = `
    uniform vec3 uColor;
    uniform vec3 uShadowColor;
    uniform vec3 uLightDir;
    uniform float uSteps;
    uniform float uRim;
    uniform float uSat;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightDir);
      float ndl = dot(n, l);
      // wrap lighting for softer indie look
      float wrap = ndl * 0.5 + 0.5;
      float cel = floor(wrap * uSteps + 1e-4) / uSteps;
      cel = mix(0.28, 1.0, cel);

      vec3 base = mix(uShadowColor, uColor, cel);

      // view rim (light edge highlight)
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float rim = pow(1.0 - max(dot(viewDir, n), 0.0), 2.8) * uRim;
      base += vec3(0.95, 0.9, 1.0) * rim;

      // slight saturation boost
      float luma = dot(base, vec3(0.299, 0.587, 0.114));
      base = mix(vec3(luma), base, uSat);

      gl_FragColor = vec4(base, 1.0);
    }
  `;

  // Planet shader — grass bands + cel + atmosphere edge
  const planetVert = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vLocal;
    void main() {
      vLocal = position;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const planetFrag = `
    uniform vec3 uGrass;
    uniform vec3 uGrassDark;
    uniform vec3 uDirt;
    uniform vec3 uLightDir;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec3 vLocal;

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z);
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 l = normalize(uLightDir);

      // terrain color variation
      float n1 = noise(vLocal * 0.35);
      float n2 = noise(vLocal * 0.9 + 3.1);
      float blend = smoothstep(0.35, 0.65, n1 * 0.7 + n2 * 0.3);
      vec3 grass = mix(uGrassDark, uGrass, n2);
      vec3 col = mix(uDirt, grass, blend);

      // cel lighting
      float wrap = dot(n, l) * 0.5 + 0.5;
      float cel = floor(wrap * 4.0) / 4.0;
      cel = mix(0.32, 1.0, cel);
      col *= cel;

      // fresnel atmosphere rim on planet edge
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
      col = mix(col, vec3(0.65, 0.8, 1.0), fres * 0.45);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // Atmosphere shell
  const atmoVert = `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const atmoFrag = `
    uniform vec3 uColor;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - abs(dot(viewDir, n)), 2.5);
      float alpha = fres * 0.55;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;

  function toonMat(color, shadow, steps, rim) {
    const c = new THREE.Color(color);
    const s = shadow ? new THREE.Color(shadow) : c.clone().multiplyScalar(0.45);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: c },
        uShadowColor: { value: s },
        uLightDir: { value: new THREE.Vector3(0.55, 1.0, 0.35).normalize() },
        uSteps: { value: steps || 3.0 },
        uRim: { value: rim != null ? rim : 0.2 },
        uSat: { value: 1.15 }
      },
      vertexShader: toonVert,
      fragmentShader: toonFrag
    });
  }

  function addOutline(mesh, scale, color) {
    const m = new THREE.MeshBasicMaterial({
      color: color || 0x1c1420,
      side: THREE.BackSide
    });
    const o = new THREE.Mesh(mesh.geometry, m);
    o.scale.setScalar(scale || 1.06);
    mesh.add(o);
    return o;
  }

  // ===================== SCENE =====================
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Sky
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x9ec5f0) },
        uMid: { value: new THREE.Color(0xc5dcf5) },
        uBot: { value: new THREE.Color(0xe8d5c4) },
        uTime: { value: 0 }
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  scene.add(sky);

  // Planet
  const planetMat = new THREE.ShaderMaterial({
    uniforms: {
      uGrass: { value: new THREE.Color(0x7bc96a) },
      uGrassDark: { value: new THREE.Color(0x4f9a45) },
      uDirt: { value: new THREE.Color(0xc4a574) },
      uLightDir: { value: new THREE.Vector3(0.55, 1.0, 0.35).normalize() },
      uTime: { value: 0 }
    },
    vertexShader: planetVert,
    fragmentShader: planetFrag
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), planetMat);
  scene.add(planet);
  addOutline(planet, 1.01, 0x2a3828);

  // Atmosphere
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.08, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x8eb8e8) } },
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide
    })
  );
  scene.add(atmo);

  // Path (torus road around equator-ish band)
  const path = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.02, 0.42, 10, 64),
    toonMat(0x9a9a9a, 0x5a5a5a, 3, 0.05)
  );
  path.rotation.x = Math.PI / 2;
  scene.add(path);

  function onSphere(lat, lon, r) {
    const phi = Math.PI / 2 - lat;
    const theta = lon;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  function orientOnSurface(obj, pos) {
    obj.position.copy(pos);
    const up = pos.clone().normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    obj.quaternion.copy(q);
  }

  // ---------- Houses ----------
  const houses = [];
  const houseDefs = [
    { name: 'skills', body: 0x6ba8d8, roof: 0xb05a3c, door: 0x3a2818, lat: 0.22, lon: -1.0 },
    { name: 'hobbies', body: 0xe8a06c, roof: 0x5c3a2a, door: 0x2e1c10, lat: 0.1, lon: 0.35 },
    { name: 'contact', body: 0x7cbc8a, roof: 0x4a3728, door: 0x2a1c12, lat: 0.26, lon: 1.15 }
  ];

  function makeHouse(d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 2.2), toonMat(d.body, null, 3, 0.12));
    body.position.y = 1.2;
    addOutline(body, 1.055, 0x1a1420);
    g.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.35, 4), toonMat(d.roof, null, 3, 0.1));
    roof.position.y = 3.0;
    roof.rotation.y = Math.PI / 4;
    addOutline(roof, 1.06, 0x1a1420);
    g.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.2, 0.1), toonMat(d.door, null, 2, 0.05));
    door.position.set(0, 0.6, 1.12);
    g.add(door);

    // windows
    const winMat = toonMat(0xc8e8ff, 0x6a90b0, 2, 0.3);
    [-0.55, 0.55].forEach(x => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.08), winMat);
      w.position.set(x, 1.55, 1.12);
      g.add(w);
    });

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.35), toonMat(0x777777, null, 2, 0.05));
    chimney.position.set(0.55, 3.4, -0.3);
    g.add(chimney);

    const pos = onSphere(d.lat, d.lon, R);
    orientOnSurface(g, pos);
    g.userData.name = d.name;
    scene.add(g);
    houses.push(g);
  }
  houseDefs.forEach(makeHouse);

  // ---------- Trees ----------
  function makeTree(lat, lon, scale) {
    const g = new THREE.Group();
    const s = scale || 1;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.8 * s, 6),
      toonMat(0x6b4423, 0x3d2818, 2, 0.05)
    );
    trunk.position.y = 0.4 * s;
    g.add(trunk);
    const leafGeo = new THREE.IcosahedronGeometry(0.65 * s, 0);
    const leaves = new THREE.Mesh(leafGeo, toonMat(0x3daa55, 0x1e6b30, 3, 0.15));
    leaves.position.y = 1.15 * s;
    addOutline(leaves, 1.07, 0x142418);
    g.add(leaves);
    const leaves2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.45 * s, 0),
      toonMat(0x4ec06a, 0x2a7a40, 3, 0.12)
    );
    leaves2.position.set(0.2 * s, 1.45 * s, 0.1 * s);
    g.add(leaves2);
    orientOnSurface(g, onSphere(lat, lon, R));
    scene.add(g);
  }
  [
    [0.55, -1.4, 1.1], [0.5, 1.5, 0.9], [-0.15, 0.9, 1.0],
    [0.65, 0.2, 1.2], [-0.3, -0.7, 0.85], [0.4, -0.4, 1.0],
    [0.7, 0.9, 0.75], [-0.4, 1.3, 1.05]
  ].forEach(([a, b, s]) => makeTree(a, b, s));

  // ---------- Clouds ----------
  function makeCloud(lat, lon, height, scale) {
    const g = new THREE.Group();
    const mat = toonMat(0xffffff, 0xd0d8e8, 2, 0.05);
    mat.transparent = true;
    mat.uniforms.uSat.value = 1.0;
    const spheres = [[0, 0, 0, 1], [0.6, 0.1, 0.1, 0.7], [-0.55, 0.05, -0.1, 0.75], [0.15, 0.25, 0.2, 0.55]];
    spheres.forEach(([x, y, z, s]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s * scale, 8, 8), mat);
      m.position.set(x * scale, y * scale, z * scale);
      g.add(m);
    });
    const pos = onSphere(lat, lon, R + height);
    g.position.copy(pos);
    g.lookAt(0, 0, 0);
    g.userData.spin = 0.02 + Math.random() * 0.03;
    g.userData.lat = lat;
    g.userData.lon = lon;
    g.userData.height = height;
    scene.add(g);
    return g;
  }
  const clouds = [
    makeCloud(0.9, 0.2, 3.5, 1.4),
    makeCloud(0.7, -1.2, 4.0, 1.1),
    makeCloud(1.0, 1.5, 3.2, 1.6),
    makeCloud(-0.6, 0.5, 3.8, 1.2)
  ];

  // ---------- Player (samurai-ish) ----------
  const player = new THREE.Group();
  const cloth = toonMat(0x2c2118, 0x15100c, 3, 0.1);
  const skin = toonMat(0xf2c9b0, 0xc9957a, 2, 0.15);
  const hair = toonMat(0x1f120a, 0x0a0604, 2, 0.05);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), cloth);
  torso.position.y = 1.0;
  addOutline(torso, 1.07, 0x120e14);
  player.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), skin);
  head.position.y = 1.62;
  addOutline(head, 1.08, 0x120e14);
  player.add(head);

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), hair);
  bun.position.set(0, 1.88, -0.06);
  player.add(bun);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), hair);
  hairCap.position.set(0, 1.72, -0.02);
  hairCap.scale.set(1, 0.7, 1);
  player.add(hairCap);

  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.07), hair);
  stache.position.set(0, 1.52, 0.24);
  player.add(stache);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 3, 6), cloth);
  leftArm.position.set(-0.42, 1.05, 0);
  player.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.32, 3, 6), cloth);
  rightArm.position.set(0.42, 1.05, 0);
  player.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), toonMat(0x1a120c, 0x0a0806, 2, 0.05));
  leftLeg.position.set(-0.15, 0.32, 0);
  player.add(leftLeg);
  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 3, 6), toonMat(0x1a120c, 0x0a0806, 2, 0.05));
  rightLeg.position.set(0.15, 0.32, 0);
  player.add(rightLeg);

  player.position.copy(onSphere(0.05, 0, R + 0.75));
  scene.add(player);

  // Initial camera
  (function () {
    const n = player.position.clone().normalize();
    camera.position.copy(player.position).add(n.multiplyScalar(5)).add(new THREE.Vector3(0, 1.5, 11));
    camera.up.copy(player.position.clone().normalize());
    camera.lookAt(player.position);
  })();

  // ---------- Movement (surface stick) ----------
  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  let walkPhase = 0;
  const speed = 0.13;

  function updatePlayer(dt) {
    const n = player.position.clone().normalize();
    const camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);
    camFwd.projectOnPlane(n).normalize();
    const right = new THREE.Vector3().crossVectors(camFwd, n).normalize();

    let mx = 0, mz = 0;
    if (keys['w'] || keys['arrowup']) mz += 1;
    if (keys['s'] || keys['arrowdown']) mz -= 1;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;

    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const dir = camFwd.multiplyScalar(mz).add(right.multiplyScalar(mx));
      if (dir.lengthSq() > 0) {
        dir.normalize();
        player.position.addScaledVector(dir, speed);
        // face move dir while staying tangent
        const newN = player.position.clone().normalize();
        player.position.copy(newN.multiplyScalar(R + 0.75));
        const lookTarget = player.position.clone().add(dir);
        const up = player.position.clone().normalize();
        // build orientation: Y = up, face dir projected
        const forward = dir.clone().projectOnPlane(up).normalize();
        if (forward.lengthSq() > 0.001) {
          const m = new THREE.Matrix4();
          const x = new THREE.Vector3().crossVectors(up, forward).normalize();
          const z = new THREE.Vector3().crossVectors(x, up).normalize();
          m.makeBasis(x, up, z);
          player.quaternion.setFromRotationMatrix(m);
        }
        walkPhase += dt * 10;
        leftLeg.rotation.x = Math.sin(walkPhase) * 0.75;
        rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.75;
        leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.45;
        rightArm.rotation.x = Math.sin(walkPhase) * 0.45;
      }
    } else {
      // stick to surface
      const newN = player.position.clone().normalize();
      player.position.copy(newN.multiplyScalar(R + 0.75));
      leftLeg.rotation.x = rightLeg.rotation.x = leftArm.rotation.x = rightArm.rotation.x = 0;
    }
  }

  function updateCamera() {
    const n = player.position.clone().normalize();
    // behind player based on facing
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
    // player local Z may vary; use camera-relative fallback
    let behind = new THREE.Vector3();
    player.getWorldDirection(behind);
    // getWorldDirection is -Z of object; we want behind the character
    behind.multiplyScalar(8);
    const desired = player.position.clone()
      .add(n.clone().multiplyScalar(3.8))
      .add(behind);
    camera.position.lerp(desired, 0.08);
    camera.up.lerp(n, 0.1).normalize();
    camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.8)));
  }

  // ---------- UI ----------
  let near = null;
  function checkNear() {
    near = null;
    houses.forEach(h => {
      if (player.position.distanceTo(h.position) < 4.8) near = h.userData.name;
    });
    document.getElementById('hint').textContent = near
      ? 'Press E to enter ' + near
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
    if (e.target.closest && e.target.closest('.panel')) return;
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
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (sky.material.uniforms) sky.material.uniforms.uTime.value = t;
    if (planetMat.uniforms) planetMat.uniforms.uTime.value = t;

    // drift clouds
    clouds.forEach(c => {
      c.userData.lon += c.userData.spin * dt * 0.15;
      const p = onSphere(c.userData.lat, c.userData.lon, R + c.userData.height);
      c.position.lerp(p, 0.05);
      c.lookAt(0, 0, 0);
    });

    updatePlayer(dt);
    updateCamera();
    checkNear();
    renderer.render(scene, camera);
  }
  loop();
})();
