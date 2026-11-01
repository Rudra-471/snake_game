// Procedural themed worlds. Every world is built from primitive geometries and
// canvas-generated textures — zero external assets. Rebuilding a world disposes
// everything the previous one created.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';

const N = CONFIG.grid.size;
const CELL = CONFIG.grid.cell;
const HALF = (N * CELL) / 2;

export const WORLD_THEMES = {
  // Bloom thresholds sit above the brightness of lit surfaces so only emissive
  // objects (✓ crystal, chain, neon) glow; pastel floors must never bloom.
  jungle: {
    sky: ['#58b7ff', '#e3fbff'],
    fog: '#d4ecff', fogNear: 32, fogFar: 90,
    light: '#fff1d0', lightIntensity: 2.4, hemiSky: '#cdeeff', hemiGround: '#8a7a5a', hemiIntensity: 0.8,
    exposure: 0.95, bloom: 0.45, bloomThreshold: 1.15,
    // warm stone courtyard in a flowery clearing — the snake pops instead of green-on-green
    floor: ['#efe3c8', '#e2d3b2'], ground: '#6da64f', wall: '#9a6a43', dust: '#c8b88a',
    grade: { saturation: 1.12, contrast: 1.05, tint: '#fff6ea', vignette: 0.38 },
  },
  beach: {
    sky: ['#3fb5ff', '#fff4d6'],
    fog: '#ffe9c9', fogNear: 35, fogFar: 95,
    light: '#fff0c8', lightIntensity: 2.4, hemiSky: '#bfe9ff', hemiGround: '#e8cf9a', hemiIntensity: 0.8,
    exposure: 0.92, bloom: 0.4, bloomThreshold: 1.2,
    floor: ['#ecd197', '#e2c486'], ground: '#e8cb8c', wall: '#d9a066', dust: '#f4e3b5',
    grade: { saturation: 1.1, contrast: 1.04, tint: '#fff4e4', vignette: 0.32 },
  },
  neon: {
    sky: ['#0a0220', '#2a0b4a'],
    fog: '#14072b', fogNear: 25, fogFar: 80,
    light: '#c7b0ff', lightIntensity: 1.6, hemiSky: '#5a3cff', hemiGround: '#0b0518', hemiIntensity: 0.6,
    exposure: 1.0, bloom: 0.55, bloomThreshold: 0.9,
    floor: ['#120a26', '#160c2e'], ground: '#0b0618', wall: '#ff2bd6', dust: '#7f5cff',
    grade: { saturation: 1.15, contrast: 1.08, tint: '#f6efff', vignette: 0.5 },
  },
  ice: {
    sky: ['#9ad4ff', '#f4fbff'],
    fog: '#e3f3ff', fogNear: 28, fogFar: 80,
    light: '#ffffff', lightIntensity: 2.1, hemiSky: '#e8f6ff', hemiGround: '#8fb7d6', hemiIntensity: 0.8,
    exposure: 0.9, bloom: 0.45, bloomThreshold: 1.2,
    floor: ['#b9def8', '#a8d2f2'], ground: '#e4f1fb', wall: '#9fd8ff', dust: '#ffffff',
    grade: { saturation: 1.08, contrast: 1.06, tint: '#f2f8ff', vignette: 0.34 },
  },
  space: {
    sky: ['#020210', '#1b1040'],
    fog: '#0a0820', fogNear: 45, fogFar: 160,
    light: '#e8e4ff', lightIntensity: 2.2, hemiSky: '#6a6aff', hemiGround: '#1a0f2e', hemiIntensity: 0.6,
    exposure: 1.0, bloom: 0.7, bloomThreshold: 1.0,
    floor: ['#3b3f5c', '#34374f'], ground: null, wall: '#6b74ff', dust: '#a7a3ff',
    grade: { saturation: 1.12, contrast: 1.08, tint: '#f4f2ff', vignette: 0.5 },
  },
  candy: {
    sky: ['#ff9fd2', '#ffe6f4'],
    fog: '#ffd6ec', fogNear: 30, fogFar: 85,
    light: '#fff5fb', lightIntensity: 2.1, hemiSky: '#ffe3f4', hemiGround: '#b8f0de', hemiIntensity: 0.75,
    exposure: 0.9, bloom: 0.4, bloomThreshold: 1.25,
    floor: ['#ffbfdd', '#b4ecd9'], ground: '#ffb3d6', wall: '#ff7cc0', dust: '#ffd6ec',
    grade: { saturation: 1.06, contrast: 1.05, tint: '#fff6fb', vignette: 0.3 },
  },
};

function rand(a, b) {
  return a + Math.random() * (b - a);
}

/** Random point in the ring outside the board, kept lower on the camera side. */
function scatterPoint(minPad, maxPad) {
  for (let i = 0; i < 50; i++) {
    const x = rand(-HALF - maxPad, HALF + maxPad);
    const z = rand(-HALF - maxPad, HALF + maxPad * 0.6);
    const dx = Math.max(Math.abs(x) - HALF, 0);
    const dz = Math.max(Math.abs(z) - HALF, 0);
    const d = Math.max(dx, dz);
    if (z > HALF && dz < 6) continue; // camera side: never block the board
    if (d >= minPad && d <= maxPad) return { x, z, nearCamera: z > HALF };
  }
  return { x: HALF + minPad, z: 0, nearCamera: false };
}

export class Arena {
  constructor(scene, renderer, sun, hemi) {
    this.scene = scene;
    this.renderer = renderer;
    this.sun = sun;
    this.hemi = hemi;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.disposables = [];
    this.animators = [];
    this.obstacleGroup = new THREE.Group();
    this.group.add(this.obstacleGroup);
    this.worldId = null;
    this.theme = WORLD_THEMES.jungle;
    this.glowTexture = this.makeGlowTexture();
  }

  // ---------- helpers ----------

  track(...items) {
    this.disposables.push(...items);
    return items[0];
  }

  mat(params, Type = THREE.MeshStandardMaterial) {
    return this.track(new Type(params));
  }

  geo(g) {
    return this.track(g);
  }

  mesh(geometry, material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }

  canvasTexture(size, draw, { srgb = true, repeat = null } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    return this.track(t);
  }

  makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  checkerTexture(a, b, { lines = null, speckle = 0.06 } = {}) {
    const px = 32;
    return this.canvasTexture(N * px, (g) => {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          g.fillStyle = (x + y) % 2 ? a : b;
          g.fillRect(x * px, y * px, px, px);
        }
      }
      if (speckle) {
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${speckle})` : `rgba(0,0,0,${speckle})`;
          g.fillRect(Math.random() * N * px, Math.random() * N * px, 2, 2);
        }
      }
      if (lines) {
        g.strokeStyle = lines;
        g.lineWidth = 2;
        for (let i = 0; i <= N; i++) {
          g.beginPath();
          g.moveTo(i * px, 0);
          g.lineTo(i * px, N * px);
          g.moveTo(0, i * px);
          g.lineTo(N * px, i * px);
          g.stroke();
        }
      }
    });
  }

  cellToWorld(x, y, out = new THREE.Vector3()) {
    return out.set((x + 0.5) * CELL - HALF, 0, (y + 0.5) * CELL - HALF);
  }

  // ---------- lifecycle ----------

  clear() {
    for (const child of [...this.group.children]) {
      if (child !== this.obstacleGroup) this.group.remove(child);
    }
    this.obstacleGroup.clear();
    for (const d of this.disposables) d.dispose && d.dispose();
    this.disposables = [];
    this.animators = [];
  }

  build(worldId, postfx) {
    this.clear();
    this.worldId = WORLD_THEMES[worldId] ? worldId : 'jungle';
    const T = (this.theme = WORLD_THEMES[this.worldId]);

    // Sky gradient dome + fog + lights + grading
    this.buildSky(T.sky[0], T.sky[1]);
    this.scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.sun.color.set(T.light);
    this.sun.intensity = T.lightIntensity;
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = T.hemiIntensity;
    this.renderer.toneMappingExposure = T.exposure;
    if (postfx) {
      postfx.setBloom(T.bloom, T.bloomThreshold);
      postfx.setGrade(T.grade);
    }

    this.buildFloor(T);
    const builders = {
      jungle: () => this.buildJungle(T),
      beach: () => this.buildBeach(T),
      neon: () => this.buildNeon(T),
      ice: () => this.buildIce(T),
      space: () => this.buildSpace(T),
      candy: () => this.buildCandy(T),
    };
    builders[this.worldId]();
  }

  buildSky(top, bottom) {
    const geo = this.geo(new THREE.SphereGeometry(220, 32, 16));
    const mat = this.mat(
      {
        uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vPos; void main(){ vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
          void main(){ float h = clamp(vPos.y * 0.5 + 0.5, 0.0, 1.0); h = smoothstep(0.35, 0.95, h);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      },
      THREE.ShaderMaterial
    );
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    this.group.add(sky);
  }

  buildFloor(T) {
    const neon = this.worldId === 'neon';
    const ice = this.worldId === 'ice';
    const tex = this.checkerTexture(T.floor[0], T.floor[1], {
      lines: neon ? null : 'rgba(0,0,0,0.035)',
      speckle: neon || ice ? 0.02 : 0.05,
    });
    let floorMat;
    if (ice) {
      floorMat = this.mat(
        { map: tex, roughness: 0.06, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.4 },
        THREE.MeshPhysicalMaterial
      );
    } else if (neon) {
      const grid = this.canvasTexture(N * 32, (g, s) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, s, s);
        g.strokeStyle = '#ff2bd6';
        g.lineWidth = 3;
        g.shadowColor = '#ff2bd6';
        g.shadowBlur = 8;
        for (let i = 0; i <= N; i++) {
          g.strokeStyle = i % 5 === 0 ? '#25f4ff' : '#b026ff';
          g.beginPath();
          g.moveTo(i * 32, 0);
          g.lineTo(i * 32, s);
          g.moveTo(0, i * 32);
          g.lineTo(s, i * 32);
          g.stroke();
        }
      });
      floorMat = this.mat({ map: tex, emissiveMap: grid, emissive: '#ffffff', emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.4 });
      this.animators.push((dt, t) => (floorMat.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.15));
    } else {
      floorMat = this.mat({ map: tex, roughness: 0.92, metalness: 0 });
    }
    const floor = this.mesh(this.geo(new THREE.PlaneGeometry(N * CELL, N * CELL)), floorMat, { cast: false });
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // Surrounding ground (except Space, which floats)
    if (T.ground) {
      const groundMat = neon
        ? this.mat({ color: T.ground, roughness: 0.6, metalness: 0.3 })
        : this.mat({ color: T.ground, roughness: 1 });
      const ground = this.mesh(this.geo(new THREE.PlaneGeometry(300, 300)), groundMat, { cast: false });
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      this.group.add(ground);
    }

    this.buildWalls(T);
  }

  buildWalls(T) {
    if (this.worldId === 'candy') return; // candy uses jelly blocks instead
    const neon = this.worldId === 'neon';
    const h = neon ? 0.25 : 0.5;
    const mat = neon
      ? this.mat({ color: '#1a0830', emissive: T.wall, emissiveIntensity: 1.8, roughness: 0.4 })
      : this.worldId === 'ice'
        ? this.mat({ color: T.wall, roughness: 0.1, metalness: 0.1, transmission: 0.3, thickness: 0.5, clearcoat: 1 }, THREE.MeshPhysicalMaterial)
        : this.mat({ color: T.wall, roughness: 0.75 });
    const len = N * CELL + 1;
    const geoX = this.geo(new RoundedBoxGeometry(len, h, 0.5, 2, 0.12));
    const geoZ = this.geo(new RoundedBoxGeometry(0.5, h, len, 2, 0.12));
    for (const [g, x, z] of [
      [geoX, 0, -HALF - 0.25],
      [geoX, 0, HALF + 0.25],
      [geoZ, -HALF - 0.25, 0],
      [geoZ, HALF + 0.25, 0],
    ]) {
      const m = this.mesh(g, mat);
      m.position.set(x, h / 2, z);
      this.group.add(m);
    }
    if (neon) this.animators.push((dt, t) => (mat.emissiveIntensity = 1.7 + Math.sin(t * 3) * 0.4));
  }

  /** Floating additive points (fireflies, snow, stars). */
  points(count, color, size, place, { additive = true } = {}) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) place(i, positions);
    const geo = this.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = this.mat(
      {
        color,
        size,
        map: this.glowTexture,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        sizeAttenuation: true,
      },
      THREE.PointsMaterial
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    return pts;
  }

  // ---------- worlds ----------

  buildJungle(T) {
    const trunkMat = this.mat({ color: '#7a4b2a', roughness: 0.9, flatShading: true });
    // A mix of greens, cherry blossom and autumn canopies keeps the clearing colorful
    const leafMats = ['#2f9e44', '#ff9ec7', '#3fae5a', '#ffb347', '#f783ac', '#69c06e', '#ffd166'].map((c) => this.mat({ color: c, roughness: 0.8, flatShading: true }));
    const rockMat = this.mat({ color: '#8d8f99', roughness: 0.9, flatShading: true });
    const trunkGeo = this.geo(new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6));
    const coneGeo = this.geo(new THREE.ConeGeometry(1.1, 1.8, 7));
    const blobGeo = this.geo(new THREE.IcosahedronGeometry(1, 0));
    const rockGeo = this.geo(new THREE.DodecahedronGeometry(0.6, 0));

    for (let i = 0; i < 46; i++) {
      const p = scatterPoint(1.2, 16);
      const s = rand(0.8, 1.5) * (p.nearCamera ? 0.55 : 1);
      const tree = new THREE.Group();
      const trunk = this.mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.8;
      tree.add(trunk);
      const leafMat = leafMats[i % leafMats.length];
      if (i % 2) {
        for (let k = 0; k < 3; k++) {
          const c = this.mesh(coneGeo, leafMat);
          c.position.y = 1.7 + k * 0.7;
          c.scale.setScalar(1 - k * 0.25);
          tree.add(c);
        }
      } else {
        const b = this.mesh(blobGeo, leafMat);
        b.position.y = 2.2;
        b.scale.set(1.2, 1, 1.2);
        tree.add(b);
        const b2 = this.mesh(blobGeo, leafMat);
        b2.position.set(0.5, 2.7, 0.2);
        b2.scale.setScalar(0.7);
        tree.add(b2);
      }
      tree.position.set(p.x, 0, p.z);
      tree.scale.setScalar(s);
      tree.rotation.y = rand(0, 6.28);
      this.group.add(tree);
      const phase = rand(0, 6.28);
      this.animators.push((dt, t) => (tree.rotation.z = Math.sin(t * 0.8 + phase) * 0.025));
    }
    for (let i = 0; i < 26; i++) {
      const p = scatterPoint(0.8, 14);
      const r = this.mesh(rockGeo, rockMat);
      r.position.set(p.x, 0.15, p.z);
      r.scale.set(rand(0.5, 1.3), rand(0.4, 0.9), rand(0.5, 1.3));
      r.rotation.set(rand(0, 3), rand(0, 3), 0);
      this.group.add(r);
    }
    // Flower meadow: instanced low-poly blossoms in many colors
    const petalGeo = this.geo(new THREE.IcosahedronGeometry(0.13, 0));
    const flowerColors = ['#ff6b9a', '#ffd43b', '#b197fc', '#ffffff', '#ff922b', '#74c0fc'];
    flowerColors.forEach((c, ci) => {
      const count = 70;
      const inst = new THREE.InstancedMesh(petalGeo, this.mat({ color: c, roughness: 0.6, flatShading: true }), count);
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const p = scatterPoint(0.6, 15);
        const s = rand(0.7, 1.4);
        m.compose(new THREE.Vector3(p.x, 0.1 * s, p.z), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s));
        inst.setMatrixAt(i, m);
      }
      inst.receiveShadow = true;
      this.track(inst);
      this.group.add(inst);
    });
    // Mushrooms with spotty caps
    const stemGeo = this.geo(new THREE.CylinderGeometry(0.1, 0.13, 0.35, 8));
    const capGeo = this.geo(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    const dotGeo = this.geo(new THREE.SphereGeometry(0.05, 6, 4));
    const stemMat = this.mat({ color: '#fff4e0', roughness: 0.8 });
    const capMat = this.mat({ color: '#ff4d4d', roughness: 0.5 });
    const dotMat = this.mat({ color: '#ffffff', roughness: 0.6 });
    for (let i = 0; i < 16; i++) {
      const p = scatterPoint(0.6, 9);
      const mush = new THREE.Group();
      const stem = this.mesh(stemGeo, stemMat);
      stem.position.y = 0.17;
      const cap = this.mesh(capGeo, capMat);
      cap.position.y = 0.32;
      mush.add(stem, cap);
      for (let k = 0; k < 4; k++) {
        const d = this.mesh(dotGeo, dotMat, { cast: false });
        const a = (k / 4) * Math.PI * 2;
        d.position.set(Math.cos(a) * 0.18, 0.5, Math.sin(a) * 0.18);
        mush.add(d);
      }
      mush.position.set(p.x, 0, p.z);
      mush.scale.setScalar(rand(0.8, 1.6));
      this.group.add(mush);
    }
    // Butterflies fluttering over the arena
    const wingGeo = this.geo(new THREE.CircleGeometry(0.22, 10));
    const wingColors = ['#ff8cc6', '#ffd43b', '#91a7ff', '#ff922b', '#63e6be'];
    for (let i = 0; i < 9; i++) {
      const mat = this.mat({ color: wingColors[i % wingColors.length], side: THREE.DoubleSide, roughness: 0.6, emissive: wingColors[i % wingColors.length], emissiveIntensity: 0.25 });
      const fly = new THREE.Group();
      const l = new THREE.Mesh(wingGeo, mat);
      const r = new THREE.Mesh(wingGeo, mat);
      l.position.x = -0.2;
      r.position.x = 0.2;
      const lp = new THREE.Group();
      const rp = new THREE.Group();
      lp.add(l);
      rp.add(r);
      fly.add(lp, rp);
      fly.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(fly);
      this.group.add(holder);
      const cx = rand(-HALF, HALF);
      const cz = rand(-HALF, HALF);
      const rad = rand(3, 8);
      const speed = rand(0.15, 0.3) * (i % 2 ? 1 : -1);
      const phase = rand(0, 6.28);
      this.animators.push((dt, t) => {
        const a = t * speed + phase;
        holder.position.set(cx + Math.cos(a) * rad, 2.2 + Math.sin(t * 1.3 + phase) * 0.7, cz + Math.sin(a) * rad);
        holder.rotation.y = -a + (speed > 0 ? 0 : Math.PI);
        const flap = Math.sin(t * 18 + phase) * 1.1;
        lp.rotation.y = flap;
        rp.rotation.y = -flap;
      });
    }

    // Fireflies drifting over the whole arena
    const ff = this.points(70, '#fff36b', 0.35, (i, a) => {
      a[i * 3] = rand(-HALF - 6, HALF + 6);
      a[i * 3 + 1] = rand(0.5, 4);
      a[i * 3 + 2] = rand(-HALF - 6, HALF + 6);
    });
    const base = Float32Array.from(ff.geometry.attributes.position.array);
    this.animators.push((dt, t) => {
      const arr = ff.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(t * 0.6 + i) * 0.8;
        arr[i + 1] = base[i + 1] + Math.sin(t * 1.3 + i * 0.7) * 0.4;
        arr[i + 2] = base[i + 2] + Math.cos(t * 0.5 + i * 1.3) * 0.8;
      }
      ff.geometry.attributes.position.needsUpdate = true;
      ff.material.opacity = 0.7 + Math.sin(t * 4) * 0.3;
    });
  }

  buildBeach(T) {
    // Animated sea on the far side and the left/right flanks
    const seaGeo = this.geo(new THREE.PlaneGeometry(240, 120, 80, 40));
    const seaMat = this.mat({ color: '#2bb3d9', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92, flatShading: true });
    const sea = this.mesh(seaGeo, seaMat, { cast: false });
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.05, -HALF - 66);
    this.group.add(sea);
    const pos = seaGeo.attributes.position;
    const baseZ = Float32Array.from(pos.array);
    this.animators.push((dt, t) => {
      for (let i = 0; i < pos.count; i++) {
        const x = baseZ[i * 3];
        const y = baseZ[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 0.25 + t * 1.6) * 0.25 + Math.cos(y * 0.3 + t * 1.1) * 0.25;
      }
      pos.needsUpdate = true; // flatShading derives normals in the shader
    });
    // Foam line
    const foam = this.mesh(this.geo(new THREE.BoxGeometry(240, 0.06, 0.8)), this.mat({ color: '#ffffff', roughness: 0.6 }), { cast: false });
    foam.position.set(0, 0.1, -HALF - 6);
    this.group.add(foam);
    this.animators.push((dt, t) => (foam.position.z = -HALF - 6.2 + Math.sin(t * 1.6) * 0.4));

    const trunkMat = this.mat({ color: '#a0703f', roughness: 0.9, flatShading: true });
    const leafMat = this.mat({ color: '#3fb950', roughness: 0.7, flatShading: true, side: THREE.DoubleSide });
    const segGeo = this.geo(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 6));
    const leafGeo = this.geo(new THREE.ConeGeometry(0.35, 2.2, 4));
    const coconutGeo = this.geo(new THREE.SphereGeometry(0.16, 8, 6));
    const coconutMat = this.mat({ color: '#5a3b1e', roughness: 0.8 });
    for (let i = 0; i < 22; i++) {
      const p = scatterPoint(1.5, 13);
      const palm = new THREE.Group();
      const lean = rand(-0.35, 0.35);
      let x = 0;
      let y = 0;
      for (let k = 0; k < 6; k++) {
        const seg = this.mesh(segGeo, trunkMat);
        x += lean * 0.12 * k;
        y += 0.62;
        seg.position.set(x, y, 0);
        seg.rotation.z = -lean * 0.3;
        palm.add(seg);
      }
      const crown = new THREE.Group();
      crown.position.set(x, y + 0.3, 0);
      for (let k = 0; k < 7; k++) {
        const leaf = this.mesh(leafGeo, leafMat);
        leaf.scale.set(1, 1, 0.25);
        const pivot = new THREE.Group();
        pivot.rotation.y = (k / 7) * Math.PI * 2;
        leaf.rotation.set(0, 0, -1.9);
        leaf.position.set(0.9, -0.25, 0);
        pivot.add(leaf);
        crown.add(pivot);
      }
      for (let k = 0; k < 3; k++) {
        const c = this.mesh(coconutGeo, coconutMat);
        c.position.set(Math.cos(k * 2.1) * 0.22, -0.2, Math.sin(k * 2.1) * 0.22);
        crown.add(c);
      }
      palm.add(crown);
      palm.position.set(p.x, 0, p.z);
      palm.scale.setScalar(rand(0.9, 1.3) * (p.nearCamera ? 0.55 : 1));
      palm.rotation.y = rand(0, 6.28);
      this.group.add(palm);
      const phase = rand(0, 6.28);
      this.animators.push((dt, t) => (crown.rotation.z = Math.sin(t + phase) * 0.06));
    }
    // Beach balls and shells for color
    const ballMat = ['#ff595e', '#ffca3a', '#1982c4', '#ffffff'].map((c) => this.mat({ color: c, roughness: 0.4 }));
    const ballGeo = this.geo(new THREE.SphereGeometry(0.35, 12, 8));
    for (let i = 0; i < 8; i++) {
      const p = scatterPoint(1, 8);
      const b = this.mesh(ballGeo, ballMat[i % ballMat.length]);
      b.position.set(p.x, 0.35, p.z);
      this.group.add(b);
    }
  }

  buildNeon(T) {
    // Window texture shared by every building
    const windows = this.canvasTexture(128, (g, s) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, s, s);
      const cols = ['#25f4ff', '#ff2bd6', '#ffe14d', '#7c4dff'];
      for (let y = 4; y < s; y += 12) {
        for (let x = 4; x < s; x += 10) {
          if (Math.random() < 0.55) {
            g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
            g.fillRect(x, y, 5, 7);
          }
        }
      }
    });
    windows.wrapS = windows.wrapT = THREE.RepeatWrapping;
    const boxGeo = this.geo(new THREE.BoxGeometry(1, 1, 1));
    const edgeColors = ['#25f4ff', '#ff2bd6', '#7c4dff', '#ffe14d'];
    const mats = edgeColors.map((c) =>
      this.mat({ color: '#0d0820', emissive: c, emissiveMap: windows, emissiveIntensity: 1.8, roughness: 0.5, metalness: 0.6 })
    );
    const capMats = edgeColors.map((c) => this.mat({ color: c, emissive: c, emissiveIntensity: 2.5 }));
    const capGeo = this.geo(new THREE.BoxGeometry(1.04, 0.08, 1.04));
    for (let i = 0; i < 60; i++) {
      const p = scatterPoint(1.5, 22);
      const h = p.nearCamera ? rand(0.6, 2) : rand(2, 11);
      const w = rand(1.2, 3);
      const b = this.mesh(boxGeo, mats[i % mats.length]);
      b.scale.set(w, h, w);
      b.position.set(p.x, h / 2, p.z);
      this.group.add(b);
      const cap = this.mesh(capGeo, capMats[i % capMats.length], { cast: false });
      cap.scale.set(w, 1, w);
      cap.position.set(p.x, h + 0.04, p.z);
      this.group.add(cap);
    }
    // Floating neon rings over the arena
    const ringGeo = this.geo(new THREE.TorusGeometry(2, 0.06, 8, 48));
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(ringGeo, capMats[i], { cast: false });
      ring.position.set(-8 + i * 8, 7 + i, -HALF - 4);
      this.group.add(ring);
      this.animators.push((dt, t) => {
        ring.rotation.x = t * 0.4 + i;
        ring.rotation.y = t * 0.3 + i;
      });
    }
    // Drifting light motes
    this.points(120, '#9b7bff', 0.25, (i, a) => {
      a[i * 3] = rand(-30, 30);
      a[i * 3 + 1] = rand(1, 14);
      a[i * 3 + 2] = rand(-30, 20);
    });
  }

  buildIce(T) {
    const crystalMat = this.mat(
      { color: '#bfe9ff', roughness: 0.05, metalness: 0, transmission: 0.6, thickness: 1, ior: 1.3, clearcoat: 1, emissive: '#3aa0ff', emissiveIntensity: 0.15 },
      THREE.MeshPhysicalMaterial
    );
    const crystalGeo = this.geo(new THREE.OctahedronGeometry(0.6, 0));
    const spikeGeo = this.geo(new THREE.ConeGeometry(0.35, 2.2, 5));
    const snowMat = this.mat({ color: '#ffffff', roughness: 0.95 });
    const hillGeo = this.geo(new THREE.SphereGeometry(2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 30; i++) {
      const p = scatterPoint(1, 14);
      const cluster = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const s = this.mesh(k === 0 ? spikeGeo : crystalGeo, crystalMat);
        s.position.set(rand(-0.5, 0.5), k === 0 ? 1.1 : 0.5, rand(-0.5, 0.5));
        s.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
        s.scale.setScalar(rand(0.6, 1.2));
        cluster.add(s);
      }
      cluster.position.set(p.x, 0, p.z);
      cluster.scale.setScalar(p.nearCamera ? 0.5 : rand(0.8, 1.6));
      this.group.add(cluster);
    }
    for (let i = 0; i < 18; i++) {
      const p = scatterPoint(3, 18);
      const hill = this.mesh(hillGeo, snowMat);
      hill.position.set(p.x, -0.1, p.z);
      hill.scale.set(rand(1, 2.5), rand(0.4, 1), rand(1, 2.5));
      this.group.add(hill);
    }
    // Falling snow, wrapped in a box around the arena
    const snow = this.points(
      700,
      '#ffffff',
      0.22,
      (i, a) => {
        a[i * 3] = rand(-28, 28);
        a[i * 3 + 1] = rand(0, 18);
        a[i * 3 + 2] = rand(-28, 22);
      },
      { additive: false }
    );
    this.animators.push((dt, t) => {
      const arr = snow.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * (1 + (i % 7) * 0.15);
        arr[i] += Math.sin(t + i) * dt * 0.3;
        if (arr[i + 1] < 0) arr[i + 1] = 18;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    });
  }

  buildSpace(T) {
    // Thick floating platform under the board
    const sideMat = this.mat({ color: '#4a4466', roughness: 0.85, flatShading: true });
    const slab = this.mesh(this.geo(new RoundedBoxGeometry(N * CELL + 1.6, 1.2, N * CELL + 1.6, 3, 0.3)), sideMat);
    slab.position.y = -0.62;
    this.group.add(slab);
    const under = this.mesh(this.geo(new THREE.ConeGeometry(HALF * 1.1, 9, 7)), sideMat);
    under.rotation.x = Math.PI;
    under.position.y = -5.7;
    this.group.add(under);
    // Glowing rim lights
    const rimMat = this.mat({ color: '#9aa4ff', emissive: '#9aa4ff', emissiveIntensity: 4 });
    const dotGeo = this.geo(new THREE.SphereGeometry(0.12, 8, 6));
    for (let i = 0; i < 40; i++) {
      const side = i % 4;
      const tt = (Math.floor(i / 4) + 0.5) / 10;
      const d = this.mesh(dotGeo, rimMat, { cast: false });
      const v = -HALF - 0.6 + tt * (N * CELL + 1.2);
      const e = HALF + 0.75;
      if (side === 0) d.position.set(v, 0.05, -e);
      if (side === 1) d.position.set(v, 0.05, e);
      if (side === 2) d.position.set(-e, 0.05, v);
      if (side === 3) d.position.set(e, 0.05, v);
      this.group.add(d);
    }
    this.animators.push((dt, t) => (rimMat.emissiveIntensity = 3.5 + Math.sin(t * 2.5) * 1.2));

    // Starfield
    const stars = this.points(1800, '#ffffff', 0.9, (i, a) => {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = 150 + Math.random() * 40;
      const s = Math.sqrt(1 - u * u);
      a[i * 3] = r * s * Math.cos(th);
      a[i * 3 + 1] = r * u * 0.8 + 20;
      a[i * 3 + 2] = r * s * Math.sin(th);
    });
    stars.material.fog = false;
    this.animators.push((dt, t) => {
      stars.rotation.y = t * 0.004;
      stars.material.opacity = 0.85 + Math.sin(t * 1.7) * 0.15;
    });

    // Distant ringed planet + moon
    const planetTex = this.canvasTexture(256, (g, s) => {
      const bands = ['#ff9e6d', '#f6c177', '#e07a5f', '#f2cc8f', '#d4846a'];
      for (let y = 0; y < s; y += 8) {
        g.fillStyle = bands[Math.floor(y / 8 + Math.sin(y * 0.1) * 2 + 10) % bands.length];
        g.fillRect(0, y, s, 8);
      }
    });
    const planet = this.mesh(this.geo(new THREE.SphereGeometry(14, 48, 32)), this.mat({ map: planetTex, roughness: 0.9, emissive: '#3a1a10', emissiveIntensity: 0.4, fog: false }), { cast: false, receive: false });
    planet.position.set(-55, 30, -110);
    this.group.add(planet);
    const ring = this.mesh(
      this.geo(new THREE.RingGeometry(18, 26, 64)),
      this.mat({ color: '#f6d7a7', side: THREE.DoubleSide, transparent: true, opacity: 0.65, fog: false, roughness: 1 }),
      { cast: false, receive: false }
    );
    ring.position.copy(planet.position);
    ring.rotation.set(1.2, 0.2, 0.3);
    this.group.add(ring);
    const moon = this.mesh(this.geo(new THREE.SphereGeometry(3, 24, 16)), this.mat({ color: '#c9c6e6', roughness: 1, fog: false }), { cast: false, receive: false });
    this.group.add(moon);
    this.animators.push((dt, t) => {
      planet.rotation.y = t * 0.03;
      moon.position.set(planet.position.x + Math.cos(t * 0.1) * 30, planet.position.y + 6, planet.position.z + Math.sin(t * 0.1) * 30);
    });

    // Floating asteroids around the platform
    const astGeo = this.geo(new THREE.DodecahedronGeometry(0.8, 0));
    const astMat = this.mat({ color: '#6d6687', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 24; i++) {
      const p = scatterPoint(3, 20);
      const a = this.mesh(astGeo, astMat);
      const baseY = rand(-4, 3);
      a.position.set(p.x, baseY, p.z);
      a.scale.setScalar(rand(0.4, 1.6) * (p.nearCamera ? 0.5 : 1));
      this.group.add(a);
      const phase = rand(0, 6.28);
      this.animators.push((dt, t) => {
        a.position.y = baseY + Math.sin(t * 0.5 + phase) * 0.5;
        a.rotation.x = t * 0.2 + phase;
        a.rotation.y = t * 0.15;
      });
    }
  }

  buildCandy(T) {
    // Wobbly jelly blocks as the border
    const jellyColors = ['#ff7cc0', '#7ce0c3', '#ffd36e', '#b39cff', '#7cc6ff'];
    const jellyMats = jellyColors.map((c) =>
      this.mat({ color: c, roughness: 0.15, transmission: 0.35, thickness: 0.8, clearcoat: 1, transparent: true, opacity: 0.9 }, THREE.MeshPhysicalMaterial)
    );
    const jellyGeo = this.geo(new RoundedBoxGeometry(0.9, 0.7, 0.9, 3, 0.25));
    let k = 0;
    const addJelly = (x, z) => {
      const j = this.mesh(jellyGeo, jellyMats[k % jellyMats.length]);
      j.position.set(x, 0.35, z);
      this.group.add(j);
      const phase = k * 0.6;
      this.animators.push((dt, t) => {
        const s = Math.sin(t * 4 + phase) * 0.06;
        j.scale.set(1 + s, 1 - s * 1.4, 1 + s);
        j.position.y = 0.35 * (1 - s * 1.4);
      });
      k++;
    };
    for (let i = -1; i <= N; i++) {
      const v = (i + 0.5) * CELL - HALF;
      addJelly(v, -HALF - 0.5);
      addJelly(v, HALF + 0.5);
      if (i >= 0 && i < N) {
        addJelly(-HALF - 0.5, v);
        addJelly(HALF + 0.5, v);
      }
    }
    // Lollipops
    const stickGeo = this.geo(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6));
    const stickMat = this.mat({ color: '#ffffff', roughness: 0.5 });
    const popGeo = this.geo(new THREE.TorusGeometry(0.45, 0.22, 10, 24));
    const popCenterGeo = this.geo(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 20));
    const popMats = ['#ff4fa3', '#4fd1c5', '#ffb347', '#9b72ff'].map((c) => this.mat({ color: c, roughness: 0.25, clearcoat: 1 }, THREE.MeshPhysicalMaterial));
    for (let i = 0; i < 20; i++) {
      const p = scatterPoint(1.5, 14);
      const g = new THREE.Group();
      const stick = this.mesh(stickGeo, stickMat);
      stick.position.y = 1.2;
      g.add(stick);
      const top = this.mesh(popGeo, popMats[i % popMats.length]);
      top.position.y = 2.6;
      g.add(top);
      const center = this.mesh(popCenterGeo, popMats[(i + 1) % popMats.length]);
      center.rotation.x = Math.PI / 2;
      center.position.y = 2.6;
      g.add(center);
      g.position.set(p.x, 0, p.z);
      g.scale.setScalar(rand(0.8, 1.4) * (p.nearCamera ? 0.5 : 1));
      g.rotation.y = rand(0, 6.28);
      this.group.add(g);
      const phase = rand(0, 6.28);
      this.animators.push((dt, t) => (top.rotation.z = center.rotation.y = t * 0.6 + phase));
    }
    // Gumdrops
    const dropGeo = this.geo(new THREE.SphereGeometry(0.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    for (let i = 0; i < 30; i++) {
      const p = scatterPoint(1, 12);
      const d = this.mesh(dropGeo, jellyMats[i % jellyMats.length]);
      d.position.set(p.x, 0, p.z);
      d.scale.set(1, rand(1, 1.6), 1);
      this.group.add(d);
    }
    // Floating sugar sparkles
    this.points(90, '#ffffff', 0.3, (i, a) => {
      a[i * 3] = rand(-25, 25);
      a[i * 3 + 1] = rand(1, 8);
      a[i * 3 + 2] = rand(-25, 18);
    });
  }

  /** Hard-mode obstacles, styled per world. */
  setObstacles(cells) {
    this.obstacleGroup.clear();
    if (!cells.length) return;
    const styles = {
      jungle: { color: '#8d8f99', geo: () => new THREE.DodecahedronGeometry(0.5, 0), flat: true },
      beach: { color: '#c08552', geo: () => new RoundedBoxGeometry(0.85, 0.85, 0.85, 2, 0.1) },
      neon: { color: '#1a0830', emissive: '#25f4ff', geo: () => new RoundedBoxGeometry(0.85, 0.85, 0.85, 2, 0.08) },
      ice: { color: '#bfe9ff', geo: () => new THREE.OctahedronGeometry(0.55, 0), flat: true },
      space: { color: '#6d6687', geo: () => new THREE.DodecahedronGeometry(0.5, 0), flat: true },
      candy: { color: '#ff7cc0', geo: () => new RoundedBoxGeometry(0.85, 0.85, 0.85, 3, 0.25) },
    };
    const st = styles[this.worldId] || styles.jungle;
    const geo = this.geo(st.geo());
    const mat = this.mat({ color: st.color, roughness: 0.6, flatShading: !!st.flat, emissive: st.emissive || '#000000', emissiveIntensity: st.emissive ? 2 : 0 });
    const v = new THREE.Vector3();
    for (const c of cells) {
      const m = this.mesh(geo, mat);
      this.cellToWorld(c.x, c.y, v);
      m.position.set(v.x, 0.45, v.z);
      m.rotation.y = Math.random() * 3;
      this.obstacleGroup.add(m);
    }
  }

  update(dt, t) {
    for (const fn of this.animators) fn(dt, t);
  }
}
