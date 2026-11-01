// Floating 3D letter blocks. Tiles are pooled: geometries are shared, and each pooled
// tile owns its materials (created once) so it can fade independently.

import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG, RARE_LETTERS } from '../config.js';
import { glyph, checkGlyph } from './glyphs.js';

const POOL_SIZE = 16;
const BASE_Y = 0.55;
const _v = new THREE.Vector3();

// Power-up looks: hourglass = slow-mo, bulb = hint, star = double score
export const POWER_INFO = {
  slow: { color: '#5ee7ff', name: 'Slow motion' },
  hint: { color: '#ffe066', name: 'Hint' },
  double: { color: '#ff9ff3', name: 'Double points' },
};

function starShape(outer = 0.42, inner = 0.18, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function pastelFor(ch) {
  const p = CONFIG.colors.tilePastels;
  return p[(ch.charCodeAt(0) * 7) % p.length];
}

export class TileManager {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.showHints = false;
    this.colorblind = false;
    this.letterScale = 1;

    this.boxGeo = new RoundedBoxGeometry(0.8, 0.8, 0.8, 3, 0.17);
    this.crystalGeo = new THREE.IcosahedronGeometry(0.42, 0);
    this.ringGeo = new THREE.RingGeometry(0.42, 0.55, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    // Power-up geometries (shared)
    this.starGeo = new THREE.ExtrudeGeometry(starShape(), { depth: 0.16, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    this.starGeo.center();
    this.coneGeo = new THREE.ConeGeometry(0.3, 0.38, 20);
    this.capGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.06, 20);
    this.bulbGeo = new THREE.SphereGeometry(0.3, 20, 14);
    this.baseGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.2, 14);

    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) this.pool.push(this.createTile());
    this.active = [];
  }

  createTile() {
    const root = new THREE.Group();
    const inner = new THREE.Group();
    root.add(inner);

    const boxMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, transparent: true });
    const box = new THREE.Mesh(this.boxGeo, boxMat);
    box.castShadow = true;
    box.receiveShadow = true;
    inner.add(box);

    const letterMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.letterInk, roughness: 0.4, transparent: true });
    const top = new THREE.Mesh(glyph('A').geometry, letterMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.41;
    inner.add(top);
    const front = new THREE.Mesh(glyph('A').geometry, letterMat);
    front.position.z = 0.41;
    inner.add(front);

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: CONFIG.colors.crystal,
      emissive: CONFIG.colors.crystal,
      emissiveIntensity: 2.6,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75,
      clearcoat: 1,
      flatShading: true,
    });
    const crystal = new THREE.Mesh(this.crystalGeo, crystalMat);
    crystal.castShadow = true;
    inner.add(crystal);
    const checkMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 3, transparent: true });
    const check = new THREE.Mesh(checkGlyph(), checkMat);
    check.position.y = 0.0;
    check.scale.setScalar(1.15);
    inner.add(check);

    const ringMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.valid, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(this.ringGeo, ringMat);
    ring.position.y = 0.025;
    root.add(ring);

    // Power-up models
    const powerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.3, transparent: true });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', roughness: 0.3, metalness: 0.9, transparent: true });
    const powers = {};
    const star = new THREE.Mesh(this.starGeo, powerMat);
    star.castShadow = true;
    powers.double = star;
    const hourglass = new THREE.Group();
    const c1 = new THREE.Mesh(this.coneGeo, powerMat);
    c1.position.y = 0.19;
    c1.rotation.x = Math.PI;
    const c2 = new THREE.Mesh(this.coneGeo, powerMat);
    c2.position.y = -0.19;
    const cap1 = new THREE.Mesh(this.capGeo, metalMat);
    cap1.position.y = 0.4;
    const cap2 = new THREE.Mesh(this.capGeo, metalMat);
    cap2.position.y = -0.4;
    hourglass.add(c1, c2, cap1, cap2);
    hourglass.traverse((o) => (o.castShadow = true));
    powers.slow = hourglass;
    const bulb = new THREE.Group();
    const glass = new THREE.Mesh(this.bulbGeo, powerMat);
    glass.position.y = 0.08;
    const base = new THREE.Mesh(this.baseGeo, metalMat);
    base.position.y = -0.3;
    bulb.add(glass, base);
    bulb.traverse((o) => (o.castShadow = true));
    powers.hint = bulb;
    for (const p of Object.values(powers)) {
      p.visible = false;
      inner.add(p);
    }

    root.visible = false;
    this.group.add(root);
    const tile = {
      root, inner, box, top, front, crystal, check, ring, powers,
      mats: { boxMat, letterMat, crystalMat, checkMat, ringMat, powerMat, metalMat },
      char: '', kind: 'valid', cell: { x: 0, y: 0 }, state: 'free', age: 0, phase: 0, opacity: 1,
    };
    root.userData.tile = tile; // lets taps find the tile via raycasting
    return tile;
  }

  acquire() {
    const t = this.pool.pop() || this.createTile();
    this.active.push(t);
    return t;
  }

  release(t) {
    gsap.killTweensOf([t.inner.position, t.inner.scale, t.inner.rotation, t]);
    t.root.visible = false;
    t.state = 'free';
    const i = this.active.indexOf(t);
    if (i >= 0) this.active.splice(i, 1);
    this.pool.push(t);
  }

  setOpacity(t, o) {
    t.opacity = o;
    const { boxMat, letterMat, crystalMat, checkMat, powerMat, metalMat } = t.mats;
    boxMat.opacity = o;
    letterMat.opacity = o;
    crystalMat.opacity = 0.75 * o;
    checkMat.opacity = o;
    powerMat.opacity = o;
    metalMat.opacity = o;
  }

  configure(t, char, kind) {
    t.char = char;
    t.kind = kind;
    const isCheck = kind === 'check';
    const isPower = kind === 'power';
    t.box.visible = t.top.visible = t.front.visible = !isCheck && !isPower;
    t.crystal.visible = t.check.visible = isCheck;
    for (const [type, mesh] of Object.entries(t.powers)) mesh.visible = isPower && type === char;
    if (isPower) {
      const c = POWER_INFO[char].color;
      t.mats.powerMat.color.set(c);
      t.mats.powerMat.emissive.set(c);
    } else if (!isCheck) {
      const g = glyph(char).geometry;
      t.top.geometry = g;
      t.front.geometry = g;
      t.top.scale.setScalar(1.15 * this.letterScale);
      t.front.scale.setScalar(this.letterScale);
      const rare = RARE_LETTERS.has(char);
      const m = t.mats.boxMat;
      if (rare) {
        m.color.set(CONFIG.colors.gold);
        m.metalness = 1;
        m.roughness = 0.28;
        t.mats.letterMat.color.set('#5a3a00');
      } else {
        m.color.set(pastelFor(char));
        m.metalness = 0;
        m.roughness = 0.78;
        t.mats.letterMat.color.set(CONFIG.colors.letterInk);
      }
      // Kids hints: valid letters glow softly
      const glow = this.showHints && kind === 'valid';
      m.emissive.set(glow ? '#fff3b0' : '#000000');
      m.emissiveIntensity = glow ? 0.25 : 0;
    }
    const hintRing = this.showHints && (kind === 'valid' || isCheck);
    t.ring.visible = hintRing || isPower;
    t.mats.ringMat.color.set(isPower ? POWER_INFO[char].color : this.colorblind ? CONFIG.colors.validCB : CONFIG.colors.valid);
    t.age = 0;
    t.phase = Math.random() * Math.PI * 2;
    this.setOpacity(t, 1);
  }

  place(t, cell) {
    t.cell = { x: cell.x, y: cell.y };
    this.arena.cellToWorld(cell.x, cell.y, _v);
    t.root.position.set(_v.x, 0, _v.z);
  }

  /** Drop-in animation with a bounce. */
  dropIn(t, delay = 0) {
    t.state = 'spawn';
    t.root.visible = true;
    t.inner.position.y = 7;
    t.inner.scale.setScalar(0.7);
    t.inner.rotation.set(0, 0, 0);
    gsap.to(t.inner.position, { y: BASE_Y, duration: 0.65, delay, ease: 'bounce.out' });
    gsap.to(t.inner.scale, {
      x: 1, y: 1, z: 1, duration: 0.4, delay, ease: 'back.out(2)',
      onComplete: () => {
        if (t.state === 'spawn') t.state = 'idle';
      },
    });
  }

  /**
   * Spawn a set of tiles.
   * @param {{char:string, kind:string, cell:{x:number,y:number}}[]} list
   */
  spawnSet(list) {
    list.forEach((item, i) => {
      const t = this.acquire();
      this.configure(t, item.char, item.kind);
      this.place(t, item.cell);
      this.dropIn(t, i * 0.06);
    });
  }

  /** Shrink + fade, then return to the pool. */
  despawn(t, onDone) {
    if (t.state === 'despawn' || t.state === 'free') return;
    t.state = 'despawn';
    gsap.killTweensOf([t.inner.position, t.inner.scale]);
    gsap.to(t.inner.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.3, ease: 'back.in(2)' });
    gsap.to(t, {
      opacity: 0,
      duration: 0.3,
      onUpdate: () => this.setOpacity(t, t.opacity),
      onComplete: () => {
        this.release(t);
        if (onDone) onDone();
      },
    });
  }

  /** Re-apply hint glows to tiles already on the board (Hint power-up). */
  refreshHints() {
    for (const t of this.active) {
      if (t.state === 'free' || t.state === 'despawn' || t.kind === 'power') continue;
      const glow = this.showHints && t.kind === 'valid';
      if (t.kind === 'valid') {
        t.mats.boxMat.emissive.set(glow ? '#fff3b0' : '#000000');
        t.mats.boxMat.emissiveIntensity = glow ? 0.25 : 0;
      }
      t.ring.visible = this.showHints && (t.kind === 'valid' || t.kind === 'check');
    }
  }

  /** Little hop when a tile is tapped. */
  poke(t) {
    gsap.killTweensOf(t.inner.scale);
    gsap.fromTo(t.inner.scale, { x: 1.35, y: 0.7, z: 1.35 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.35)' });
  }

  despawnAll() {
    for (const t of [...this.active]) this.despawn(t);
  }

  clear() {
    for (const t of [...this.active]) this.release(t);
  }

  /** Remove instantly (eaten). Returns world position for effects. */
  consume(t) {
    const pos = t.inner.getWorldPosition(new THREE.Vector3());
    this.release(t);
    return pos;
  }

  /** Same letter hops to a new cell (15-second timeout). */
  relocate(t, cell) {
    const { char, kind } = t;
    this.despawn(t, () => {
      const n = this.acquire();
      this.configure(n, char, kind);
      this.place(n, cell);
      this.dropIn(n);
    });
  }

  /** Kids mode: a decoy wobbles, bounces off and lands somewhere else. */
  bounceAway(t, cell) {
    t.state = 'spawn';
    gsap.killTweensOf([t.inner.position, t.inner.scale, t.inner.rotation]);
    const from = t.root.position.clone();
    this.arena.cellToWorld(cell.x, cell.y, _v);
    const to = _v.clone();
    t.cell = { x: cell.x, y: cell.y };
    const p = { k: 0 };
    gsap.fromTo(t.inner.rotation, { z: -0.5 }, { z: 0, duration: 0.8, ease: 'elastic.out(1.2, 0.25)' });
    gsap.to(p, {
      k: 1,
      duration: 0.7,
      ease: 'power1.inOut',
      onUpdate: () => {
        t.root.position.lerpVectors(from, to, p.k);
        t.inner.position.y = BASE_Y + Math.sin(p.k * Math.PI) * 3;
      },
      onComplete: () => {
        t.state = 'idle';
        t.age = 0;
      },
    });
  }

  /** Edible tile occupying this cell (not mid-despawn). */
  tileAt(cell) {
    return this.active.find((t) => (t.state === 'idle' || t.state === 'spawn') && t.cell.x === cell.x && t.cell.y === cell.y) || null;
  }

  liveTiles() {
    return this.active.filter((t) => t.state === 'idle' || t.state === 'spawn');
  }

  /** World position of the closest valid letter or ✓ (for the snake's eyes). */
  nearestUseful(from) {
    let best = null;
    let bestD = Infinity;
    for (const t of this.active) {
      if (t.state === 'despawn' || t.state === 'free') continue;
      if (t.kind === 'decoy' || t.kind === 'power') continue;
      const d = t.root.position.distanceToSquared(from);
      if (d < bestD) {
        bestD = d;
        best = t.root.position;
      }
    }
    return best;
  }

  /**
   * Animate and age tiles. Returns tiles that have outlived their lifetime and
   * should hop elsewhere.
   */
  update(dt, time) {
    const expired = [];
    for (const t of this.active) {
      if (t.state === 'idle') {
        t.inner.position.y = BASE_Y + Math.sin(time * 2.4 + t.phase) * 0.12;
        t.inner.rotation.y = Math.sin(time * 0.7 + t.phase) * 0.35;
        t.age += dt;
        // Flash in the last two seconds before hopping away
        if (t.age > CONFIG.spawn.tileLifetime - 2) {
          this.setOpacity(t, 0.55 + 0.45 * Math.abs(Math.sin(time * 9)));
        }
        if (t.age >= CONFIG.spawn.tileLifetime) expired.push(t);
      }
      if (t.kind === 'check' && t.state !== 'free') {
        t.crystal.rotation.y = time * 1.6;
        t.crystal.rotation.x = Math.sin(time) * 0.4;
        t.check.rotation.y = Math.sin(time * 2) * 0.5;
        t.mats.crystalMat.emissiveIntensity = 2.4 + Math.sin(time * 5) * 0.7;
      }
      if (t.kind === 'power' && t.state !== 'free') {
        const p = t.powers[t.char];
        if (p) {
          p.rotation.y = time * 2.2;
          if (t.char === 'slow') p.rotation.z = Math.sin(time * 1.5) * 0.3;
        }
        t.mats.powerMat.emissiveIntensity = 1.3 + Math.sin(time * 6 + t.phase) * 0.5;
      }
      if (t.ring.visible) {
        const s = 1 + Math.sin(time * 4 + t.phase) * 0.12;
        t.ring.scale.set(s, 1, s);
        t.mats.ringMat.opacity = (0.4 + Math.sin(time * 4 + t.phase) * 0.25) * t.opacity;
      }
    }
    return expired;
  }
}
