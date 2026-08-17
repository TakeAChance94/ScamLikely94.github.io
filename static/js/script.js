(function () {
  if (typeof THREE === 'undefined') {
    document.getElementById('hint').textContent = 'Failed to load Three.js';
    return;
  }

  const R = 11;
  const PLAYER_HEIGHT = 0.9;
  const ANGULAR_SPEED = 1.25; // rad/s max
  const clock = new THREE.Clock();
  const hint = document.getElementById('hint');
  hint.textContent = 'Loading…';

  // ---------- Shaders ----------
  const skyVert = `varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}`;
  const skyFrag = `uniform vec3 uTop,uMid,uBot;varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y*.5+.5;vec3 c=mix(uBot,uMid,smoothstep(0.,.45,h));c=mix(c,uTop,smoothstep(.4,1.,h));c+=vec3(1.,.93,.78)*pow(max(dot(d,normalize(vec3(.5,.6,.25))),0.),40.)*.4;gl_FragColor=vec4(c,1.);}`;
  const toonVert = `varying vec3 vN,vW;void main(){vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
  const toonFrag = `uniform vec3 uColor,uShadow,uLight;uniform float uSteps,uRim;varying vec3 vN,vW;void main(){vec3 n=normalize(vN);float w=dot(n,normalize(uLight))*.5+.5;float cel=mix(.3,1.,floor(w*uSteps+1e-4)/uSteps);vec3 col=mix(uShadow,uColor,cel);col+=vec3(.9,.88,1.)*pow(1.-max(dot(normalize(cameraPosition-vW),n),0.),2.6)*uRim;gl_FragColor=vec4(col,1.);}`;
  const planetVert = `varying vec3 vN,vW,vL;void main(){vL=position;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
  const planetFrag = `uniform vec3 uG,uGd,uD,uLight;varying vec3 vN,vW,vL;
    float hash(vec3 p){p=fract(p*.3183+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){vec3 n=normalize(vN);float n1=noise(vL*.32),n2=noise(vL*.85+2.7);vec3 col=mix(uD,mix(uGd,uG,n2),smoothstep(.32,.62,n1*.65+n2*.35));col*=mix(.34,1.,floor((dot(n,normalize(uLight))*.5+.5)*5.)/5.);col=mix(col,vec3(.7,.82,1.),pow(1.-max(dot(normalize(cameraPosition-vW),n),0.),2.1)*.4);gl_FragColor=vec4(col,1.);}`;
  const atmoFrag = `uniform vec3 uColor;varying vec3 vN,vW;void main(){float f=pow(1.-abs(dot(normalize(cameraPosition-vW),normalize(vN))),2.4);gl_FragColor=vec4(uColor,f*.5);}`;

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
    o.scale.setScalar(s || 1.05);
    mesh.add(o);
  }

  // ---------- GLB (houses/trees only) ----------
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

  scene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(0xa8cdf0) }, uMid: { value: new THREE.Color(0xcde0f5) }, uBot: { value: new THREE.Color(0xe8d8c8) } },
    vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false
  })));

  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), new THREE.ShaderMaterial({
    uniforms: {
      uG: { value: new THREE.Color(0x78c86a) }, uGd: { value: new THREE.Color(0x4a9a42) },
      uD: { value: new THREE.Color(0xc2a06e) }, uLight: { value: new THREE.Vector3(0.5, 1, 0.35).normalize() }
    },
    vertexShader: planetVert, fragmentShader: planetFrag
  }));
  scene.add(planet);
  outline(planet, 1.008, 0x243528);

  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 40, 40), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x92bce8) } },
    vertexShader: toonVert, fragmentShader: atmoFrag, transparent: true, depthWrite: false, side: THREE.BackSide
  })));

  const path = new THREE.Mesh(new THREE.TorusGeometry(R + 0.015, 0.28, 8, 72), toon(0x959595, 0x555, 3, 0.04));
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

  // ---------- Animated character (separate limbs) ----------
  const player = new THREE.Group();
  const cloth = toon(0x2c2118, 0x15100c, 3, 0.1);
  const skin = toon(0xf2c9b0, 0xc9957a, 2, 0.15);
  const hair = toon(0x1f120a, 0x0a0604, 2, 0.05);
  const pants = toon(0x1a120c, 0x0a0806, 2, 0.05);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.38, 4, 8), cloth);
  torso.position.y = 0.95;
  outline(torso, 1.06, 0x120e14);
  player.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), skin);
  head.position.y = 1.42;
  outline(head, 1.07, 0x120e14);
  player.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), hair);
  hairCap.position.set(0, 1.5, -0.02);
  hairCap.scale.set(1, 0.7, 1);
  player.add(hairCap);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), hair);
  bun.position.set(0, 1.62, -0.05);
  player.add(bun);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.05), hair);
  stache.position.set(0, 1.34, 0.17);
  player.add(stache);

  // Limb pivots for animation
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 1.05, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), cloth);
  leftArmMesh.position.y = -0.18;
  leftArm.add(leftArmMesh);
  player.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 1.05, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), cloth);
  rightArmMesh.position.y = -0.18;
  rightArm.add(rightArmMesh);
  player.add(rightArm);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.11, 0.55, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 3, 6), pants);
  leftLegMesh.position.y = -0.2;
  leftLeg.add(leftLegMesh);
  player.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.11, 0.55, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.32, 3, 6), pants);
  rightLegMesh.position.y = -0.2;
  rightLeg.add(rightLegMesh);
  player.add(rightLeg);

  player.position.copy(onSphere(0.05, 0, R + PLAYER_HEIGHT));
  scene.add(player);

  // ---------- Houses / trees ----------
  const houses = [];
  async function buildWorld() {
    const [houseG, treeG, rockG] = await Promise.all([
      loadGLB('static/models/house.glb'),
      loadGLB('static/models/tree.glb'),
      loadGLB('static/models/rock.glb')
    ]);
    [
      { name: 'skills', c: 0x6aa6d6, s: 0x355978, lat: 0.2, lon: -0.95 },
      { name: 'hobbies', c: 0xe29a68, s: 0x7a4a30, lat: 0.08, lon: 0.3 },
      { name: 'contact', c: 0x74b882, s: 0x386848, lat: 0.22, lon: 1.1 }
    ].forEach(d => {
      const h = houseG.clone(true);
      paint(h, d.c, d.s);
      h.scale.setScalar(0.9);
      orient(h, onSphere(d.lat, d.lon, R));
      h.userData.name = d.name;
      scene.add(h);
      houses.push(h);
    });
    [[0.5, -1.35, 0.9], [0.45, 1.4, 0.75], [0.58, 0.15, 1.0], [-0.25, -0.65, 0.7]].forEach(([a, b, s]) => {
      const t = treeG.clone(true);
      paint(t, 0x3aa852, 0x1c6a32);
      t.scale.setScalar(s);
      orient(t, onSphere(a, b, R));
      scene.add(t);
    });
    [[0.12, -0.4], [0.28, 0.65]].forEach(([a, b]) => {
      const r = rockG.clone(true);
      paint(r, 0x8a8680, 0x4a4844);
      r.scale.setScalar(0.5);
      orient(r, onSphere(a, b, R));
      scene.add(r);
    });

    // init camera
    const n = player.position.clone().normalize();
    camera.position.copy(player.position).add(n.multiplyScalar(4)).add(new THREE.Vector3(0, 2, 10));
    camera.up.copy(player.position.clone().normalize());
    camera.lookAt(player.position);
    hint.textContent = 'WASD move · Drag look · Scroll zoom · E near house';
  }

  // ---------- Controls ----------
  let camYaw = 0, camPitch = 0.38, targetYaw = 0, targetPitch = 0.38, camDist = 9;
  let dragging = false, lx = 0, ly = 0;
  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('.panel')) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!dragging) return;
    targetYaw -= (e.clientX - lx) * 0.005;
    targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - ly) * 0.004, 0.15, 1.05);
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  renderer.domElement.addEventListener('wheel', e => {
    e.preventDefault();
    camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.01, 6, 15);
  }, { passive: false });

  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  // Smoothed move intensity for animation blend
  let moveAmt = 0;
  let walkPhase = 0;
  let angVel = 0;

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
    if (keys['w'] || keys['arrowup']) iz += 1;
    if (keys['s'] || keys['arrowdown']) iz -= 1;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;

    const input = (ix !== 0 || iz !== 0);
    const targetAmt = input ? 1 : 0;
    moveAmt = THREE.MathUtils.damp(moveAmt, targetAmt, 8, dt);
    angVel = THREE.MathUtils.damp(angVel, input ? ANGULAR_SPEED : 0, 7, dt);

    if (input) {
      const move = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix).normalize();
      const axis = new THREE.Vector3().crossVectors(n, move);
      if (axis.lengthSq() > 1e-8) {
        axis.normalize();
        player.position.applyAxisAngle(axis, angVel * dt);
      }
      n = player.position.clone().normalize();
      if (n.y < 0.18) { n.y = 0.18; n.normalize(); }
      player.position.copy(n.clone().multiplyScalar(R + PLAYER_HEIGHT));

      const face = move.projectOnPlane(n).normalize();
      if (face.lengthSq() > 1e-6) {
        const x = new THREE.Vector3().crossVectors(n, face).normalize();
        const z = new THREE.Vector3().crossVectors(x, n).normalize();
        const tq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, z));
        player.quaternion.slerp(tq, 1 - Math.exp(-14 * dt));
      }
    } else {
      n = player.position.clone().normalize();
      player.position.copy(n.multiplyScalar(R + PLAYER_HEIGHT));
    }

    // --- Walk cycle (legs + arms) ---
    if (moveAmt > 0.05) {
      walkPhase += dt * 10 * moveAmt;
      const swing = Math.sin(walkPhase) * 0.85 * moveAmt;
      const swing2 = Math.sin(walkPhase + Math.PI) * 0.85 * moveAmt;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = swing2;
      leftArm.rotation.x = swing2 * 0.65;
      rightArm.rotation.x = swing * 0.65;
      // subtle body bob
      torso.position.y = 0.95 + Math.abs(Math.sin(walkPhase * 2)) * 0.04 * moveAmt;
      head.position.y = 1.42 + Math.abs(Math.sin(walkPhase * 2)) * 0.03 * moveAmt;
    } else {
      // ease limbs back to idle
      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, 0, 10, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, 0, 10, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, 0, 10, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, 0, 10, dt);
      torso.position.y = THREE.MathUtils.damp(torso.position.y, 0.95, 10, dt);
      head.position.y = THREE.MathUtils.damp(head.position.y, 1.42, 10, dt);
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
    camera.position.lerp(desired, 1 - Math.exp(-6 * dt));
    camera.up.copy(n);
    camera.lookAt(player.position.clone().add(n.clone().multiplyScalar(0.5)));
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
      hint.textContent = near ? 'Press E to enter ' + near : 'WASD move · Drag look · Scroll zoom · E near house';
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

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    updatePlayer(dt);
    updateCamera(dt);
    checkNear();
    renderer.render(scene, camera);
  }

  buildWorld().then(loop).catch(e => {
    console.error(e);
    hint.textContent = 'Failed to load models';
    loop();
  });
})();
