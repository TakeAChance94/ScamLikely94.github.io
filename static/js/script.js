(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  const R = 11;
  const clock = new THREE.Clock();
  const hint = document.getElementById('hint');
  hint.textContent = 'Loading world…';

  // ---------- Shaders ----------
  const skyVert = `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.); }`;
  const skyFrag = `
    uniform vec3 uTop,uMid,uBot; varying vec3 vP;
    void main(){
      vec3 d=normalize(vP); float h=d.y*.5+.5;
      vec3 c=mix(uBot,uMid,smoothstep(0.,.45,h));
      c=mix(c,uTop,smoothstep(.4,1.,h));
      c+=vec3(1.,.93,.78)*pow(max(dot(d,normalize(vec3(.5,.6,.25))),0.),40.)*.4;
      c+=vec3(.85,.9,1.)*exp(-abs(d.y)*2.8)*.1;
      gl_FragColor=vec4(c,1.);
    }`;

  const toonVert = `
    varying vec3 vN,vW;
    void main(){
      vN=normalize(mat3(modelMatrix)*normal);
      vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w;
    }`;
  const toonFrag = `
    uniform vec3 uColor,uShadow,uLight; uniform float uSteps,uRim;
    varying vec3 vN,vW;
    void main(){
      vec3 n=normalize(vN);
      float w=dot(n,normalize(uLight))*.5+.5;
      float cel=mix(.3,1.,floor(w*uSteps+1e-4)/uSteps);
      vec3 col=mix(uShadow,uColor,cel);
      float rim=pow(1.-max(dot(normalize(cameraPosition-vW),n),0.),2.6)*uRim;
      col+=vec3(.9,.88,1.)*rim;
      gl_FragColor=vec4(col,1.);
    }`;

  const planetVert = `
    varying vec3 vN,vW,vL;
    void main(){
      vL=position; vN=normalize(mat3(modelMatrix)*normal);
      vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz;
      gl_Position=projectionMatrix*viewMatrix*w;
    }`;
  const planetFrag = `
    uniform vec3 uG,uGd,uD,uLight;
    varying vec3 vN,vW,vL;
    float hash(vec3 p){p=fract(p*.3183+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){
      vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
      return mix(
        mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
    void main(){
      vec3 n=normalize(vN);
      float n1=noise(vL*.32),n2=noise(vL*.85+2.7);
      vec3 grass=mix(uGd,uG,n2);
      vec3 col=mix(uD,grass,smoothstep(.32,.62,n1*.65+n2*.35));
      float cel=mix(.34,1.,floor((dot(n,normalize(uLight))*.5+.5)*5.)/5.);
      col*=cel;
      float fr=pow(1.-max(dot(normalize(cameraPosition-vW),n),0.),2.1);
      col=mix(col,vec3(.7,.82,1.),fr*.4);
      gl_FragColor=vec4(col,1.);
    }`;

  const atmoFrag = `
    uniform vec3 uColor; varying vec3 vN,vW;
    void main(){
      float f=pow(1.-abs(dot(normalize(cameraPosition-vW),normalize(vN))),2.4);
      gl_FragColor=vec4(uColor,f*.5);
    }`;

  function toon(c, sh, steps, rim) {
    const col = new THREE.Color(c);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: col },
        uShadow: { value: sh ? new THREE.Color(sh) : col.clone().multiplyScalar(0.42) },
        uLight: { value: new THREE.Vector3(0.5, 1, 0.35).normalize() },
        uSteps: { value: steps || 4 },
        uRim: { value: rim != null ? rim : 0.18 }
      },
      vertexShader: toonVert, fragmentShader: toonFrag
    });
  }

  function outline(mesh, s, col) {
    const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: col || 0x1a1420, side: THREE.BackSide }));
    o.scale.setScalar(s || 1.04);
    mesh.add(o);
  }

  // ---------- GLB loader ----------
  async function loadGLB(url) {
    const buf = await fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); });
    const dv = new DataView(buf);
    let off = 12, json, bin;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const data = buf.slice(off + 8, off + 8 + len); off += 8 + len;
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
      if (type === 0x004E4942) bin = data;
    }
    const get = i => {
      const a = json.accessors[i], v = json.bufferViews[a.bufferView];
      const start = (v.byteOffset || 0) + (a.byteOffset || 0);
      const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
      const C = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
      return new C(bin, start, a.count * n);
    };
    const group = new THREE.Group();
    const meshes = json.meshes || [], nodes = json.nodes || [];
    const addMesh = (def, mat4) => {
      def.primitives.forEach(p => {
        if (p.mode !== undefined && p.mode !== 4) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(get(p.attributes.POSITION), 3));
        if (p.attributes.NORMAL != null) geo.setAttribute('normal', new THREE.BufferAttribute(get(p.attributes.NORMAL), 3));
        else geo.computeVertexNormals();
        if (p.indices != null) geo.setIndex(new THREE.BufferAttribute(get(p.indices), 1));
        const mesh = new THREE.Mesh(geo, toon(0xccc, null, 4, 0.12));
        if (mat4) mesh.applyMatrix4(mat4);
        outline(mesh, 1.04, 0x16101c);
        group.add(mesh);
      });
    };
    if (json.scenes && json.scenes[0] && json.scenes[0].nodes) {
      const walk = (i, parent) => {
        const node = nodes[i], m = new THREE.Matrix4();
        if (node.matrix) m.fromArray(node.matrix);
        else {
          const t = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
          if (node.translation) t.fromArray(node.translation);
          if (node.rotation) q.fromArray(node.rotation);
          if (node.scale) s.fromArray(node.scale);
          m.compose(t, q, s);
        }
        if (parent) m.premultiply(parent);
        if (node.mesh != null) addMesh(meshes[node.mesh], m.clone());
        (node.children || []).forEach(c => walk(c, m.clone()));
      };
      json.scenes[0].nodes.forEach(n => walk(n, null));
    } else meshes.forEach(m => addMesh(m, null));
    return group;
  }

  function paint(group, color, shadow) {
    group.traverse(o => {
      if (o.isMesh && o.material && o.material.uniforms) o.material = toon(color, shadow, 4, 0.12);
    });
  }

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 250);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(100, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0xa8cdf0) },
        uMid: { value: new THREE.Color(0xcde0f5) },
        uBot: { value: new THREE.Color(0xe8d8c8) }
      },
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false
    })
  ));

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: {
        uG: { value: new THREE.Color(0x78c86a) },
        uGd: { value: new THREE.Color(0x4a9a42) },
        uD: { value: new THREE.Color(0xc2a06e) },
        uLight: { value: new THREE.Vector3(0.5, 1, 0.35).normalize() }
      },
      vertexShader: planetVert, fragmentShader: planetFrag
    })
  );
  scene.add(planet);
  outline(planet, 1.008, 0x243528);

  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.07, 40, 40),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x92bce8) } },
      vertexShader: toonVert, fragmentShader: atmoFrag,
      transparent: true, depthWrite: false, side: THREE.BackSide
    })
  ));

  const path = new THREE.Mesh(new THREE.TorusGeometry(R + 0.015, 0.32, 8, 72), toon(0x959595, 0x555, 3, 0.04));
  path.rotation.x = Math.PI / 2;
  scene.add(path);

  function onSphere(lat, lon, r) {
    const phi = Math.PI / 2 - lat, th = lon;
    return new THREE.Vector3(r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  }
  function orient(obj, pos) {
    obj.position.copy(pos);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
  }

  const houses = [];
  const player = new THREE.Group();
  scene.add(player);

  // Movement state — smooth accel
  const vel = new THREE.Vector3();
  const MAX_SPEED = 0.11;
  const ACCEL = 1.4;
  const FRICTION = 0.82;
  const PLAYER_HEIGHT = 0.55; // keep feet above surface
  const MAX_LAT = 0.85; // stay near top of planet (navigation)

  // Camera orbit
  let camYaw = 0, camPitch = 0.35;
  let targetYaw = 0, targetPitch = 0.35;
  let dragging = false, lx = 0, ly = 0;

  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('.panel')) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!dragging) return;
    targetYaw -= (e.clientX - lx) * 0.005;
    targetPitch = Math.max(0.12, Math.min(1.1, targetPitch + (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    camDist = Math.max(6, Math.min(16, camDist + e.deltaY * 0.01));
  }, { passive: false });
  let camDist = 9.5;

  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  async function build() {
    const [houseG, treeG, charG, rockG] = await Promise.all([
      loadGLB('static/models/house.glb'),
      loadGLB('static/models/tree.glb'),
      loadGLB('static/models/character.glb'),
      loadGLB('static/models/rock.glb')
    ]);

    [
      { name: 'skills', c: 0x6aa6d6, s: 0x355978, lat: 0.2, lon: -0.95 },
      { name: 'hobbies', c: 0xe29a68, s: 0x7a4a30, lat: 0.08, lon: 0.3 },
      { name: 'contact', c: 0x74b882, s: 0x386848, lat: 0.22, lon: 1.1 }
    ].forEach(d => {
      const h = houseG.clone(true);
      paint(h, d.c, d.s);
      h.scale.setScalar(0.95);
      orient(h, onSphere(d.lat, d.lon, R));
      h.userData.name = d.name;
      scene.add(h);
      houses.push(h);
    });

    [[0.5, -1.35, 0.95], [0.45, 1.4, 0.8], [0.58, 0.15, 1.05], [-0.25, -0.65, 0.75], [0.35, 0.75, 0.9]].forEach(([a, b, s]) => {
      const t = treeG.clone(true);
      paint(t, 0x3aa852, 0x1c6a32);
      t.scale.setScalar(s);
      orient(t, onSphere(a, b, R));
      scene.add(t);
    });

    [[0.12, -0.4], [0.28, 0.65]].forEach(([a, b]) => {
      const r = rockG.clone(true);
      paint(r, 0x8a8680, 0x4a4844);
      r.scale.setScalar(0.55);
      orient(r, onSphere(a, b, R));
      scene.add(r);
    });

    const char = charG.clone(true);
    paint(char, 0x3a2a1e, 0x18120c);
    char.scale.setScalar(0.85);
    player.add(char);
    player.position.copy(onSphere(0.04, 0, R + 0.02));

    hint.textContent = 'WASD move · Drag to look · Scroll zoom · E near house';
    loop();
  }

  function updatePlayer(dt) {
    // Surface normal
    let n = player.position.clone().normalize();

    // Camera-relative axes on the tangent plane
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.projectOnPlane(n);
    if (fwd.lengthSq() < 1e-8) {
      fwd.set(0, 0, -1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      fwd.applyQuaternion(q).projectOnPlane(n);
    }
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, n).normalize();

    // Input
    let ix = 0, iz = 0;
    if (keys['w'] || keys['arrowup']) iz += 1;
    if (keys['s'] || keys['arrowdown']) iz -= 1;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;

    if (ix !== 0 || iz !== 0) {
      const move = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();

      // Direct geodesic step — no velocity stack
      const axis = new THREE.Vector3().crossVectors(n, move);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        const angularSpeed = 1.35; // radians / second
        player.position.applyAxisAngle(axis, angularSpeed * dt);
      }

      // Stick to sphere
      n = player.position.clone().normalize();
      if (n.y < 0.18) { n.y = 0.18; n.normalize(); }
      player.position.copy(n.clone().multiplyScalar(R + PLAYER_HEIGHT));

      // Face move dir
      const face = move.projectOnPlane(n).normalize();
      if (face.lengthSq() > 1e-6) {
        const x = new THREE.Vector3().crossVectors(n, face).normalize();
        const z = new THREE.Vector3().crossVectors(x, n).normalize();
        const tq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, z));
        player.quaternion.slerp(tq, Math.min(1, 12 * dt));
      }
    } else {
      // Idle: stay stuck, keep feet planted
      n = player.position.clone().normalize();
      player.position.copy(n.multiplyScalar(R + PLAYER_HEIGHT));
    }
  }

  function updateCamera(dt) {
    // Soft-follow mouse orbit
    camYaw += (targetYaw - camYaw) * Math.min(1, 10 * dt);
    camPitch += (targetPitch - camPitch) * Math.min(1, 10 * dt);

    const n = player.position.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

    // Offset: behind + above in surface frame
    const local = new THREE.Vector3(
      Math.sin(camYaw) * Math.cos(camPitch),
      Math.sin(camPitch),
      Math.cos(camYaw) * Math.cos(camPitch)
    );
    const offset = local.multiplyScalar(camDist).applyQuaternion(q);
    const desired = player.position.clone().add(offset);

    camera.position.lerp(desired, Math.min(1, 8 * dt));
    camera.up.copy(n);
    camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.45)));
  }

  let near = null;
  function checkNear() {
    near = null;
    let best = 6.5;
    houses.forEach(h => {
      const d = player.position.distanceTo(h.position);
      if (d < best) { best = d; near = h.userData.name; }
    });
    if (!hint.textContent.startsWith('Loading')) {
      hint.textContent = near
        ? 'Press E to enter ' + near
        : 'WASD move · Drag to look · Scroll zoom · E near house';
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

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  window.addEventListener('click', e => {
    if (dragging) return;
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

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    updatePlayer(dt);
    updateCamera(dt);
    checkNear();
    renderer.render(scene, camera);
  }

  build().catch(e => {
    console.error(e);
    hint.textContent = 'Failed to load models';
  });
})();
