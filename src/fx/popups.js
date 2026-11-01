// Pooled in-world text effects:
//   LetterFlyer – a glyph that arcs from A to a (possibly moving) target B
//   ScorePopups – 3D "+N" numbers that pop up, then hand off to the HUD

import * as THREE from 'three';
import gsap from 'gsap';
import { glyph } from '../game/glyphs.js';

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();

export class LetterFlyer {
  constructor(scene, size = 24) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ color: '#fff6c2', emissive: '#ffd166', emissiveIntensity: 2, roughness: 0.3 });
    this.pool = [];
    this.live = new Set();
    for (let i = 0; i < size; i++) {
      const m = new THREE.Mesh(glyph('A').geometry, this.mat);
      m.visible = false;
      this.group.add(m);
      this.pool.push(m);
    }
  }

  /**
   * @param {string} ch
   * @param {THREE.Vector3} from
   * @param {(out: THREE.Vector3) => THREE.Vector3} target  live target position
   * @param {{duration?:number, height?:number, delay?:number, scale?:[number,number], onDone?:Function}} o
   */
  fly(ch, from, target, { duration = 0.45, height = 2, delay = 0, scale = [1.2, 1], onDone } = {}) {
    const m = this.pool.pop();
    if (!m) {
      if (onDone) onDone();
      return;
    }
    this.live.add(m);
    m.geometry = glyph(ch).geometry;
    const start = from.clone();
    const state = { k: 0 };
    m.position.copy(start);
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.scale.setScalar(scale[0]);
    m.visible = delay <= 0;
    m.userData.tween = gsap.to(state, {
      k: 1,
      duration,
      delay,
      ease: 'power1.inOut',
      onStart: () => (m.visible = true),
      onUpdate: () => {
        target(_t);
        const k = state.k;
        // Quadratic Bézier with a raised control point gives a nice arc
        _p.copy(start).lerp(_t, 0.5);
        _p.y = Math.max(start.y, _t.y) + height;
        const ik = 1 - k;
        m.position.set(
          ik * ik * start.x + 2 * ik * k * _p.x + k * k * _t.x,
          ik * ik * start.y + 2 * ik * k * _p.y + k * k * _t.y,
          ik * ik * start.z + 2 * ik * k * _p.z + k * k * _t.z
        );
        m.rotation.z = k * Math.PI * 2;
        m.scale.setScalar(scale[0] + (scale[1] - scale[0]) * k);
      },
      onComplete: () => {
        this.release(m);
        if (onDone) onDone();
      },
    });
  }

  release(m) {
    m.visible = false;
    if (this.live.delete(m)) this.pool.push(m);
  }

  clear() {
    for (const m of [...this.live]) {
      if (m.userData.tween) m.userData.tween.kill();
      this.release(m);
    }
  }
}

export class ScorePopups {
  constructor(scene, size = 6, digits = 6) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    for (let i = 0; i < size; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ff9f1c', emissiveIntensity: 2, roughness: 0.3, metalness: 0.3, transparent: true });
      const g = new THREE.Group();
      const meshes = [];
      for (let d = 0; d < digits; d++) {
        const m = new THREE.Mesh(glyph('0').geometry, mat);
        m.visible = false;
        g.add(m);
        meshes.push(m);
      }
      g.visible = false;
      this.group.add(g);
      this.pool.push({ g, meshes, mat });
    }
  }

  /**
   * Pop "+N" above a world position. When finished, calls onDone(screenX, screenY)
   * so the HUD can fly a chip into the score counter.
   */
  show(text, worldPos, camera, onDone) {
    const p = this.pool.shift();
    if (!p) {
      if (onDone) onDone(window.innerWidth / 2, window.innerHeight / 2);
      return;
    }
    this.pool.push(p); // round-robin reuse
    gsap.killTweensOf([p.g.position, p.g.scale, p.mat]);
    const chars = text.slice(0, p.meshes.length);
    let x = 0;
    const widths = [...chars].map((c) => glyph(c).width + 0.06);
    const total = widths.reduce((a, b) => a + b, 0);
    p.meshes.forEach((m, i) => {
      if (i < chars.length) {
        m.geometry = glyph(chars[i]).geometry;
        m.position.x = x + widths[i] / 2 - total / 2;
        x += widths[i];
        m.visible = true;
      } else {
        m.visible = false;
      }
    });
    p.g.visible = true;
    p.g.position.copy(worldPos).add(new THREE.Vector3(0, 1.2, 0));
    p.mat.opacity = 1;
    const look = camera.position;
    p.g.lookAt(look.x, p.g.position.y, look.z);
    gsap.fromTo(p.g.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 2.2, y: 2.2, z: 2.2, duration: 0.35, ease: 'back.out(3)' });
    gsap.to(p.g.position, {
      y: p.g.position.y + 1.6,
      duration: 0.8,
      ease: 'power2.out',
      onComplete: () => {
        const v = p.g.getWorldPosition(new THREE.Vector3()).project(camera);
        const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
        const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
        gsap.to(p.mat, { opacity: 0, duration: 0.15, onComplete: () => (p.g.visible = false) });
        if (onDone) onDone(sx, sy);
      },
    });
  }

  clear() {
    for (const p of this.pool) {
      gsap.killTweensOf([p.g.position, p.g.scale, p.mat]);
      p.g.visible = false;
    }
  }
}
