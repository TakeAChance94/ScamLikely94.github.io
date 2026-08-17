(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }
  if (!THREE.MathUtils.damp) {
    THREE.MathUtils.damp = (x, y, lambda, dt) =>
      THREE.MathUtils.lerp(x, y, 1 - Math.exp(-lambda * dt));
  }

  const R = 12;
  const PLAYER_HEIGHT = 0.95;
  const ANGULAR_SPEED = 1.15;
  const clock = new THREE.Clock();
  const hint = document.getElementById('hint');
  hint.textContent = 'Loading…';

  // ============== Refined toon (soft bands + hemisphere fill) ==============
  const toonVert = `
    varying vec3 vN; varying vec3 vW;
    void main() {
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const toonFrag = `
    uniform vec3 uColor; uniform vec3 uShadow; uniform vec3 uLight;
    uniform vec3 uAmbient; uniform float uSteps; uniform float uRim;
    varying vec3 vN; varying vec3 vW;
    void main() {
      vec3 n = normalize(vN);
      float ndl = dot(n, normalize(uLight));
      float wrap = ndl * 0.5 + 0.5;
      // smoothstep between cel bands (less "crayon")
      float band = floor(wrap * uSteps) / uSteps;
      float next = (floor(wrap * uSteps) + 1.0) / uSteps;
      float f = fract(wrap * uSteps);
      float cel = mix(band, next, smoothstep(0.35, 0.65, f));
      cel = mix(0.38, 1.0, cel);
      vec3 col = mix(uShadow, uColor, cel);
      col += uAmbient * 0.22;
      float rim = pow(1.0 - max(dot(normalize(cameraPosition - vW), n), 0.0), 3.0) * uRim;
      col += vec3(0.85, 0.9, 1.0) * rim;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const skyVert = `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }`;
  const skyFrag = `
    uniform vec3 uTop, uHorizon, uBot;
    varying vec3 vP;
    void main() {
      vec3 d = normalize(vP);
      float h = d.y * 0.5 + 0.5;
      vec3 col = mix(uBot, uHorizon, smoothstep(0.0, 0.42, h));
      col = mix(col, uTop, smoothstep(0.38, 0.95, h));
      float sun = pow(max(dot(d, normalize(vec3(0.4, 0.55, 0.3))), 0.0), 48.0);
      col += vec3(1.0, 0.95, 0.85) * sun * 0.5;
      float glow = pow(max(dot(d, normalize(vec3(0.4, 0.45, 0.3))), 0.0), 4.0) * 0.12;
      col += vec3(1.0, 0.85, 0.7) * glow;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const planetVert = `
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    void main() {
      vL = position;
      vN = normalize(mat3(modelMatrix) * normal);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;
  const planetFrag = `
    uniform vec3 uGrass, uGrass2, uPath, uLight;
    varying vec3 vN; varying vec3 vW; varying vec3 vL;
    float hash(vec3 p){ p=fract(p*0.3183+vec3(0.1,0.2,0.3)); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise(vec3 p){
      vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x), f.y), f.z);
    }
    void main() {
      vec3 n = normalize(vN);
      float n1 = noise(vL * 0.28);
      float n2 = noise(vL * 0.7 + 4.2);
      float n3 = noise(vL * 1.6);
      vec3 grass = mix(uGrass, uGrass2, smoothstep(0.3, 0.7, n1));
      grass = mix(grass, uGrass * 0.85, n3 * 0.25);
      // subtle path band near equator
      float eq = 1.0 - abs(normalize(vL).y);
      float pathMask = smoothstep(0.08, 0.02, abs(eq - 0.12)) * 0.0;
      vec3 col = grass;
      float wrap = dot(n, normalize(uLight)) * 0.5 + 0.5;
      float cel = mix(0.4, 1.0, floor(wrap * 5.0 + 1e-4) / 5.0);
      float soft = smoothstep(0.0, 1.0, wrap);
      col *= mix(cel, soft, 0.35);
      float fres = pow(1.0 - max(dot(normalize(cameraPosition - vW), n), 0.0), 2.4);
      col = mix(col, vec3(0.72, 0.84, 0.98), fres * 0.35);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const atmoFrag = `
    uniform vec3 uColor; varying vec3 vN; varying vec3 vW;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(cameraPosition - vW), normalize(vN))), 2.6);
      gl_FragColor = vec4(uColor, f * 0.42);
    }`;

  function mat(color, shadow, steps, rim) {
    const c = new THREE.Color(color);
    const s = shadow ? new THREE.Color(shadow) : c.clone().multiplyScalar(0.5);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: c },
        uShadow: { value: s },
        uLight: { value: new THREE.Vector3(0.45, 1.0, 0.3).normalize() },
        uAmbient: { value: new THREE.Color(0xb8c8e0) },
        uSteps: { value: steps || 4 },
        uRim: { value: rim != null ? rim : 0.12 }
      },
      vertexShader: toonVert,
      fragmentShader: toonFrag
    });
  }

  function addOutline(mesh, scale, color) {
    const o = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshBasicMaterial({ color: color || 0x2a2430, side: THREE.BackSide })
    );
    o.scale.setScalar(scale || 1.035);
    mesh.add(o);
    return o;
  }

  // ============== Scene ==============
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc5d8ec, 40, 85);
  const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // Sky
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x8eb6e0) },
        uHorizon: { value: new THREE.Color(0xd4e4f5) },
        uBot: { value: new THREE.Color(0xf0e0d0) }
      },
      vertexShader: skyVert, fragmentShader: skyFrag,
      side: THREE.BackSide, depthWrite: false
    })
  ));

  // Planet
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 128),
    new THREE.ShaderMaterial({
      uniforms: {
        uGrass: { value: new THREE.Color(0x6dbf6a) },
        uGrass2: { value: new THREE.Color(0x8fd47a) },
        uPath: { value: new THREE.Color(0xb8a888) },
        uLight: { value: new THREE.Vector3(0.45, 1.0, 0.3).normalize() }
      },
      vertexShader: planetVert, fragmentShader: planetFrag
    })
  );
  scene.add(planet);
  addOutline(planet, 1.006, 0x3a4a38);

  // Atmosphere
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.06, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xa8c8e8) } },
      vertexShader: toonVert, fragmentShader: atmoFrag,
      transparent: true, depthWrite: false, side: THREE.BackSide
    })
  ));

  // Stone path
  const path = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.01, 0.22, 10, 96),
    mat(0xa89880, 0x6a6050, 3, 0.04)
  );
  path.rotation.x = Math.PI / 2;
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

  // ============== Professional low-poly character ==============
  const player = new THREE.Group();
  // Palette: muted indigo robe, warm skin, dark hair
  const robe = mat(0x3d4a6b, 0x222838, 4, 0.1);
  const robeDark = mat(0x2a3348, 0x161c28, 4, 0.08);
  const skin = mat(0xe8b89a, 0xc48a6e, 3, 0.14);
  const hairM = mat(0x1a1210, 0x0c0908, 2, 0.05);
  const shoe = mat(0x2a2218, 0x15110c, 2, 0.05);

  // Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 5, 10), robe);
  torso.position.y = 0.92;
  addOutline(torso, 1.04, 0x1e1a24);
  player.add(torso);
  // Belt
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 6, 16), robeDark);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.72;
  player.add(belt);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), skin);
  head.position.y = 1.36;
  addOutline(head, 1.05, 0x1e1a24);
  player.add(head);
  // Hair volume
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10), hairM);
  hair.position.set(0, 1.42, -0.02);
  hair.scale.set(1.05, 0.75, 1.0);
  player.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), hairM);
  bun.position.set(0, 1.55, -0.06);
  player.add(bun);
  // Simple face marks
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.04), hairM);
  stache.position.set(0, 1.29, 0.15);
  player.add(stache);

  // Arms (pivots at shoulders)
  function makeArm(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.28, 1.02, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 6), robe);
    upper.position.y = -0.12;
    g.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin);
    hand.position.y = -0.28;
    g.add(hand);
    player.add(g);
    return g;
  }
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Legs
  function makeLeg(side) {
    const g = new THREE.Group();
    g.position.set(side * 0.1, 0.55, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.22, 4, 6), robeDark);
    thigh.position.y = -0.12;
    g.add(thigh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.14), shoe);
    foot.position.set(0, -0.3, 0.02);
    g.add(foot);
    player.add(g);
    return g;
  }
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Contact shadow blob
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  player.add(shadow);

  player.scale.setScalar(1.15);
  player.position.copy(onSphere(0.06, 0, R + PLAYER_HEIGHT));
  scene.add(player);

  // ============== Stylized houses (procedural, cleaner) ==============
  const houses = [];
  function makeHouse(cfg) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.7, 1.6), mat(cfg.body, cfg.bodySh, 4, 0.1));
    body.position.y = 0.85;
    body.castShadow = true;
    addOutline(body, 1.03, 0x1e1a24);
    g.add(body);
    // Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.0, 4), mat(cfg.roof, cfg.roofSh, 3, 0.08));
    roof.position.y = 2.15;
    roof.rotation.y = Math.PI / 4;
    addOutline(roof, 1.04, 0x1e1a24);
    g.add(roof);
    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.85, 0.06), mat(0x4a3428, 0x2a1c14, 2, 0.05));
    door.position.set(0, 0.42, 0.82);
    g.add(door);
    // Windows with glow
    const winMat = mat(0xd8eef8, 0x88aacc, 2, 0.25);
    [-0.4, 0.4].forEach(x => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.05), winMat);
      w.position.set(x, 1.15, 0.82);
      g.add(w);
    });
    // Base step
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.35), mat(0x9a9080, 0x5a5548, 2, 0.04));
    step.position.set(0, 0.06, 0.95);
    g.add(step);

    orient(g, onSphere(cfg.lat, cfg.lon, R));
    g.userData.name = cfg.name;
    scene.add(g);
    houses.push(g);
  }
  makeHouse({ name: 'skills', body: 0x6a9cc4, bodySh: 0x3a6080, roof: 0x8b5a4a, roofSh: 0x4a3028, lat: 0.22, lon: -0.9 });
  makeHouse({ name: 'hobbies', body: 0xd4a06a, bodySh: 0x8a6038, roof: 0x5c4030, roofSh: 0x302018, lat: 0.1, lon: 0.35 });
  makeHouse({ name: 'contact', body: 0x6aaf7a, bodySh: 0x3a7048, roof: 0x4a3830, roofSh: 0x281e18, lat: 0.24, lon: 1.05 });

  // Trees — layered canopies
  function makeTree(lat, lon, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.7 * s, 6), mat(0x6b4a32, 0x3a2818, 2, 0.04));
    trunk.position.y = 0.35 * s;
    g.add(trunk);
    const c1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 * s, 0), mat(0x4aaa5a, 0x2a6a38, 3, 0.1));
    c1.position.y = 0.95 * s;
    addOutline(c1, 1.04, 0x1a2a1c);
    g.add(c1);
    const c2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 * s, 0), mat(0x5ec06a, 0x348a42, 3, 0.1));
    c2.position.set(0.12 * s, 1.25 * s, 0.05 * s);
    g.add(c2);
    orient(g, onSphere(lat, lon, R));
    scene.add(g);
  }
  [[0.48, -1.3, 1.0], [0.42, 1.35, 0.85], [0.55, 0.2, 1.1], [-0.2, -0.7, 0.75], [0.35, 0.7, 0.9], [0.6, -0.5, 0.8]].forEach(([a, b, s]) => makeTree(a, b, s));

  // Soft clouds
  function makeCloud(lat, lon, h, sc) {
    const g = new THREE.Group();
    const m = mat(0xffffff, 0xd0d8e8, 2, 0.02);
    [[0, 0, 0, 1], [0.55, 0.05, 0.1, 0.7], [-0.5, 0.02, -0.08, 0.65]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.4 * r * sc, 10, 8), m);
      s.position.set(x * sc, y * sc, z * sc);
      g.add(s);
    });
    g.position.copy(onSphere(lat, lon, R + h));
    g.lookAt(0, 0, 0);
    g.userData = { lat, lon, h, spin: 0.015 + Math.random() * 0.02 };
    scene.add(g);
    return g;
  }
  const clouds = [
    makeCloud(0.85, 0.3, 3.2, 1.3),
    makeCloud(0.75, -1.1, 3.8, 1.0),
    makeCloud(0.95, 1.4, 3.0, 1.5)
  ];

  // ============== Controls ==============
  let camYaw = 0.15, camPitch = 0.4, targetYaw = 0.15, targetPitch = 0.4, camDist = 10;
  let dragging = false, lx = 0, ly = 0;
  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('.panel')) return;
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

  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  let moveAmt = 0, walkPhase = 0, angVel = 0;

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

    moveAmt = THREE.MathUtils.damp(moveAmt, input ? 1 : 0, 12, dt);
    if (input) moveAmt = Math.max(moveAmt, 0.55);
    angVel = THREE.MathUtils.damp(angVel, input ? ANGULAR_SPEED : 0, 8, dt);

    if (input) {
      const move = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();
      const axis = new THREE.Vector3().crossVectors(n, move);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        player.position.applyAxisAngle(axis, angVel * dt);
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

    // Walk cycle
    if (moveAmt > 0.05) {
      walkPhase += dt * 11 * moveAmt;
      const a = Math.sin(walkPhase) * 0.95 * moveAmt;
      const b = Math.sin(walkPhase + Math.PI) * 0.95 * moveAmt;
      leftLeg.rotation.x = a;
      rightLeg.rotation.x = b;
      leftArm.rotation.x = b * 0.7;
      rightArm.rotation.x = a * 0.7;
      const bob = Math.abs(Math.sin(walkPhase * 2)) * 0.035 * moveAmt;
      torso.position.y = 0.92 + bob;
      head.position.y = 1.36 + bob * 0.8;
    } else {
      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, 0, 12, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, 0, 12, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, 0, 12, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 0, 12, dt);
      torso.position.y = THREE.MathUtils.damp(torso.position.y, 0.92, 12, dt);
      head.position.y = THREE.MathUtils.damp(head.position.y, 1.36, 12, dt);
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
    camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.55)));
  }

  let near = null;
  function checkNear() {
    near = null;
    let best = 6;
    houses.forEach(h => {
      const d = player.position.distanceTo(h.position);
      if (d < best) { best = d; near = h.userData.name; }
    });
    if (!hint.textContent.startsWith('Loading')) {
      hint.textContent = near ? 'Press E — ' + near : 'WASD · Drag to look · Scroll zoom · E near house';
    }
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
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Init camera
  (function () {
    const n = player.position.clone().normalize();
    camera.position.copy(player.position).add(n.multiplyScalar(5)).add(new THREE.Vector3(2, 3, 9));
    camera.up.copy(player.position.clone().normalize());
    camera.lookAt(player.position);
  })();

  hint.textContent = 'WASD · Drag to look · Scroll zoom · E near house';

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    clouds.forEach(c => {
      c.userData.lon += c.userData.spin * dt;
      const p = onSphere(c.userData.lat, c.userData.lon, R + c.userData.h);
      c.position.lerp(p, 0.04);
      c.lookAt(0, 0, 0);
    });
    updatePlayer(dt);
    updateCamera(dt);
    checkNear();
    renderer.render(scene, camera);
  }
  loop();
})();
