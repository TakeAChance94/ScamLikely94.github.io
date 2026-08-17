(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  const R = 12;
  const clock = new THREE.Clock();
  document.getElementById('hint').textContent = 'Loading world…';

  // ===================== SHADERS =====================
  const skyVert = `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const skyFrag = `
    uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
    varying vec3 vWorldPos;
    void main() {
      vec3 dir = normalize(vWorldPos);
      float h = dir.y * 0.5 + 0.5;
      vec3 col = mix(uBot, uMid, smoothstep(0.0, 0.45, h));
      col = mix(col, uTop, smoothstep(0.4, 1.0, h));
      vec3 sunDir = normalize(vec3(0.45, 0.55, 0.3));
      col += vec3(1.0, 0.92, 0.75) * pow(max(dot(dir, sunDir), 0.0), 32.0) * 0.35;
      col += vec3(0.9, 0.85, 1.0) * exp(-abs(dir.y) * 3.0) * 0.12;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const toonVert = `
    varying vec3 vNormal; varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const toonFrag = `
    uniform vec3 uColor; uniform vec3 uShadowColor; uniform vec3 uLightDir;
    uniform float uSteps; uniform float uRim; uniform float uSat;
    varying vec3 vNormal; varying vec3 vWorldPos;
    void main() {
      vec3 n = normalize(vNormal);
      float wrap = dot(n, normalize(uLightDir)) * 0.5 + 0.5;
      float cel = mix(0.28, 1.0, floor(wrap * uSteps + 1e-4) / uSteps);
      vec3 base = mix(uShadowColor, uColor, cel);
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      base += vec3(0.95, 0.9, 1.0) * pow(1.0 - max(dot(viewDir, n), 0.0), 2.8) * uRim;
      float luma = dot(base, vec3(0.299, 0.587, 0.114));
      base = mix(vec3(luma), base, uSat);
      gl_FragColor = vec4(base, 1.0);
    }`;

  const planetVert = `
    varying vec3 vNormal; varying vec3 vWorldPos; varying vec3 vLocal;
    void main() {
      vLocal = position;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const planetFrag = `
    uniform vec3 uGrass; uniform vec3 uGrassDark; uniform vec3 uDirt; uniform vec3 uLightDir;
    varying vec3 vNormal; varying vec3 vWorldPos; varying vec3 vLocal;
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 p) {
      vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(
        mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
    }
    void main() {
      vec3 n = normalize(vNormal);
      float n1 = noise(vLocal * 0.35); float n2 = noise(vLocal * 0.9 + 3.1);
      float blend = smoothstep(0.35, 0.65, n1 * 0.7 + n2 * 0.3);
      vec3 col = mix(uDirt, mix(uGrassDark, uGrass, n2), blend);
      float cel = mix(0.32, 1.0, floor((dot(n, normalize(uLightDir))*0.5+0.5)*4.0)/4.0);
      col *= cel;
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      col = mix(col, vec3(0.65, 0.8, 1.0), pow(1.0 - max(dot(viewDir, n), 0.0), 2.2) * 0.45);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const atmoVert = `
    varying vec3 vNormal; varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const atmoFrag = `
    uniform vec3 uColor; varying vec3 vNormal; varying vec3 vWorldPos;
    void main() {
      float fres = pow(1.0 - abs(dot(normalize(cameraPosition - vWorldPos), normalize(vNormal))), 2.5);
      gl_FragColor = vec4(uColor, fres * 0.55);
    }`;

  function toonMat(color, shadow, steps, rim) {
    const c = new THREE.Color(color);
    const s = shadow ? new THREE.Color(shadow) : c.clone().multiplyScalar(0.45);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: c }, uShadowColor: { value: s },
        uLightDir: { value: new THREE.Vector3(0.55, 1.0, 0.35).normalize() },
        uSteps: { value: steps || 3 }, uRim: { value: rim != null ? rim : 0.2 }, uSat: { value: 1.15 }
      },
      vertexShader: toonVert, fragmentShader: toonFrag
    });
  }

  function addOutline(mesh, scale, color) {
    const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: color || 0x1c1420, side: THREE.BackSide }));
    o.scale.setScalar(scale || 1.06);
    mesh.add(o);
    return o;
  }

  function recolorGroup(group, color, shadow) {
    group.traverse(obj => {
      if (obj.isMesh && obj.material && obj.material.uniforms && obj.material.uniforms.uColor) {
        obj.material = toonMat(color, shadow, 3, 0.12);
      }
    });
  }

  // ===================== Minimal GLB loader =====================
  async function loadGLB(url) {
    const buf = await fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); });
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not GLB');
    let offset = 12, json = null, bin = null;
    while (offset < buf.byteLength) {
      const len = dv.getUint32(offset, true);
      const type = dv.getUint32(offset + 4, true);
      const data = buf.slice(offset + 8, offset + 8 + len);
      offset += 8 + len;
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
      if (type === 0x004E4942) bin = data;
    }
    const getAcc = (i) => {
      const acc = json.accessors[i], view = json.bufferViews[acc.bufferView];
      const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
      const C = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[acc.componentType];
      return new C(bin, start, acc.count * n);
    };
    const group = new THREE.Group();
    const meshes = json.meshes || [];
    const nodes = json.nodes || [];
    const processMesh = (meshDef, matrix) => {
      meshDef.primitives.forEach(prim => {
        if (prim.mode !== undefined && prim.mode !== 4) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(getAcc(prim.attributes.POSITION), 3));
        if (prim.attributes.NORMAL !== undefined)
          geo.setAttribute('normal', new THREE.BufferAttribute(getAcc(prim.attributes.NORMAL), 3));
        else geo.computeVertexNormals();
        if (prim.indices !== undefined)
          geo.setIndex(new THREE.BufferAttribute(getAcc(prim.indices), 1));
        const mesh = new THREE.Mesh(geo, toonMat(0xbbbbbb, null, 3, 0.12));
        if (matrix) mesh.applyMatrix4(matrix);
        addOutline(mesh, 1.05, 0x1a1420);
        group.add(mesh);
      });
    };
    if (json.scenes && json.scenes[0] && json.scenes[0].nodes) {
      const walk = (idx, parent) => {
        const node = nodes[idx];
        const m = new THREE.Matrix4();
        if (node.matrix) m.fromArray(node.matrix);
        else {
          const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1,1,1);
          if (node.translation) t.fromArray(node.translation);
          if (node.rotation) q.fromArray(node.rotation);
          if (node.scale) s.fromArray(node.scale);
          m.compose(t, q, s);
        }
        if (parent) m.premultiply(parent);
        if (node.mesh !== undefined) processMesh(meshes[node.mesh], m.clone());
        (node.children || []).forEach(c => walk(c, m.clone()));
      };
      json.scenes[0].nodes.forEach(n => walk(n, null));
    } else meshes.forEach(m => processMesh(m, null));
    return group;
  }

  // ===================== SCENE =====================
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 300);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x9ec5f0) },
        uMid: { value: new THREE.Color(0xc5dcf5) },
        uBot: { value: new THREE.Color(0xe8d5c4) }
      },
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false
    })
  );
  scene.add(sky);

  const planetMat = new THREE.ShaderMaterial({
    uniforms: {
      uGrass: { value: new THREE.Color(0x7bc96a) },
      uGrassDark: { value: new THREE.Color(0x4f9a45) },
      uDirt: { value: new THREE.Color(0xc4a574) },
      uLightDir: { value: new THREE.Vector3(0.55, 1.0, 0.35).normalize() }
    },
    vertexShader: planetVert, fragmentShader: planetFrag
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), planetMat);
  scene.add(planet);
  addOutline(planet, 1.01, 0x2a3828);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.08, 48, 48),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x8eb8e8) } },
      vertexShader: atmoVert, fragmentShader: atmoFrag,
      transparent: true, depthWrite: false, side: THREE.BackSide
    })
  ));

  const path = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.02, 0.42, 10, 64),
    toonMat(0x9a9a9a, 0x5a5a5a, 3, 0.05)
  );
  path.rotation.x = Math.PI / 2;
  scene.add(path);

  function onSphere(lat, lon, r) {
    const phi = Math.PI / 2 - lat, theta = lon;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  function orientOnSurface(obj, pos) {
    obj.position.copy(pos);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
    obj.quaternion.copy(q);
  }

  const houses = [];
  let player = new THREE.Group();
  scene.add(player);

  async function buildWorld() {
    const [houseGLB, treeGLB, charGLB, rockGLB] = await Promise.all([
      loadGLB('static/models/house.glb'),
      loadGLB('static/models/tree.glb'),
      loadGLB('static/models/character.glb'),
      loadGLB('static/models/rock.glb')
    ]);

    const houseDefs = [
      { name: 'skills', color: 0x6ba8d8, shadow: 0x3a6080, lat: 0.22, lon: -1.0 },
      { name: 'hobbies', color: 0xe8a06c, shadow: 0x8a5030, lat: 0.1, lon: 0.35 },
      { name: 'contact', color: 0x7cbc8a, shadow: 0x3a7048, lat: 0.26, lon: 1.15 }
    ];
    houseDefs.forEach(d => {
      const h = houseGLB.clone(true);
      recolorGroup(h, d.color, d.shadow);
      h.scale.setScalar(1.05);
      orientOnSurface(h, onSphere(d.lat, d.lon, R));
      h.userData.name = d.name;
      scene.add(h);
      houses.push(h);
    });

    [
      [0.55, -1.4, 1.1], [0.5, 1.5, 0.9], [-0.15, 0.9, 1.0],
      [0.65, 0.2, 1.2], [-0.3, -0.7, 0.85], [0.4, -0.4, 1.0]
    ].forEach(([la, lo, s]) => {
      const t = treeGLB.clone(true);
      recolorGroup(t, 0x3daa55, 0x1e6b30);
      t.scale.setScalar(s);
      orientOnSurface(t, onSphere(la, lo, R));
      scene.add(t);
    });

    [[0.15, -0.5], [0.3, 0.7], [-0.1, 1.2]].forEach(([la, lo]) => {
      const r = rockGLB.clone(true);
      recolorGroup(r, 0x8a8580, 0x4a4845);
      r.scale.setScalar(0.6 + Math.random() * 0.4);
      orientOnSurface(r, onSphere(la, lo, R));
      scene.add(r);
    });

    // Character as player visual
    const char = charGLB.clone(true);
    recolorGroup(char, 0x3d2b1f, 0x1a120c);
    // apply skin-ish to top-most meshes roughly
    char.scale.setScalar(1.0);
    while (player.children.length) player.remove(player.children[0]);
    player.add(char);

    player.position.copy(onSphere(0.05, 0, R + 0.15));
    const n = player.position.clone().normalize();
    camera.position.copy(player.position).add(n.multiplyScalar(5)).add(new THREE.Vector3(0, 2, 11));
    camera.up.copy(player.position.clone().normalize());
    camera.lookAt(player.position);

    document.getElementById('hint').textContent = 'WASD / arrows to move · Approach a house & press E';
    startLoop();
  }

  // ---------- Controls ----------
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

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
    if (mx || mz) {
      const dir = camFwd.multiplyScalar(mz).add(right.multiplyScalar(mx));
      if (dir.lengthSq() > 0) {
        dir.normalize();
        player.position.addScaledVector(dir, speed);
        const newN = player.position.clone().normalize();
        player.position.copy(newN.multiplyScalar(R + 0.15));
        const up = player.position.clone().normalize();
        const forward = dir.clone().projectOnPlane(up).normalize();
        if (forward.lengthSq() > 0.001) {
          const xAxis = new THREE.Vector3().crossVectors(up, forward).normalize();
          const zAxis = new THREE.Vector3().crossVectors(xAxis, up).normalize();
          const m = new THREE.Matrix4().makeBasis(xAxis, up, zAxis);
          player.quaternion.setFromRotationMatrix(m);
        }
      }
    } else {
      const newN = player.position.clone().normalize();
      player.position.copy(newN.multiplyScalar(R + 0.15));
    }
  }

  function updateCamera() {
    const n = player.position.clone().normalize();
    let behind = new THREE.Vector3();
    player.getWorldDirection(behind);
    behind.multiplyScalar(8);
    const desired = player.position.clone().add(n.clone().multiplyScalar(3.8)).add(behind);
    camera.position.lerp(desired, 0.08);
    camera.up.lerp(n, 0.1).normalize();
    camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.8)));
  }

  let near = null;
  function checkNear() {
    near = null;
    houses.forEach(h => {
      if (player.position.distanceTo(h.position) < 4.8) near = h.userData.name;
    });
    const hint = document.getElementById('hint');
    if (hint.textContent.startsWith('Loading')) return;
    hint.textContent = near ? 'Press E to enter ' + near : 'WASD / arrows to move · Approach a house & press E';
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

  let running = false;
  function startLoop() {
    if (running) return;
    running = true;
    (function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      updatePlayer(dt);
      updateCamera();
      checkNear();
      renderer.render(scene, camera);
    })();
  }

  buildWorld().catch(err => {
    console.error(err);
    document.getElementById('hint').textContent = 'Failed to load models — check static/models/';
  });
})();
