// Pooled particle bursts drawn with a single InstancedMesh per particle type.
// Nothing is allocated after construction: particles are recycled from a ring buffer.

import * as THREE from 'three';
import { CONFIG } from '../config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

class ParticlePool {
  constructor(scene, count, geometry, material) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, _c.set(1, 1, 1));
    }
    scene.add(this.mesh);

    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.rot = new Float32Array(count * 3);
    this.spin = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.size = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.flat = new Uint8Array(count);
    this.cursor = 0;
    this.active = 0;
  }

  emit(x, y, z, vx, vy, vz, { life = 1, size = 0.15, color = '#ffffff', gravity = CONFIG.particles.gravity, drag = 0.5, spin = 6, flat = false }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.rot[i3] = Math.random() * 6.28;
    this.rot[i3 + 1] = Math.random() * 6.28;
    this.rot[i3 + 2] = Math.random() * 6.28;
    this.spin[i3] = (Math.random() - 0.5) * spin;
    this.spin[i3 + 1] = (Math.random() - 0.5) * spin;
    this.spin[i3 + 2] = (Math.random() - 0.5) * spin;
    if (this.life[i] <= 0) this.active++;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.flat[i] = flat ? 1 : 0;
    this.mesh.setColorAt(i, _c.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    if (this.active <= 0) return;
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.mesh.setMatrixAt(i, ZERO);
        continue;
      }
      alive++;
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 2] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.gravity[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.03) {
        // land and slide on the floor
        this.pos[i3 + 1] = 0.03;
        this.vel[i3 + 1] *= -0.3;
        this.vel[i3] *= 0.7;
        this.vel[i3 + 2] *= 0.7;
      }
      this.rot[i3] += this.spin[i3] * dt;
      this.rot[i3 + 1] += this.spin[i3 + 1] * dt;
      this.rot[i3 + 2] += this.spin[i3 + 2] * dt;

      const t = this.life[i] / this.maxLife[i];
      const scale = this.size[i] * Math.min(1, t * 3);
      _p.set(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]);
      _q.setFromEuler(_e.set(this.rot[i3], this.rot[i3 + 1], this.rot[i3 + 2]));
      if (this.flat[i]) _s.set(scale, scale * 0.15, scale * 0.6);
      else _s.set(scale, scale, scale);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.active = alive;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.count; i++) {
      this.life[i] = 0;
      this.mesh.setMatrixAt(i, ZERO);
    }
    this.active = 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const CONFETTI = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c'];

export class Particles {
  constructor(scene) {
    this.scale = 1;
    const shardGeo = new THREE.BoxGeometry(1, 1, 1);
    const shardMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.shards = new ParticlePool(scene, CONFIG.particles.shardPool, shardGeo, shardMat);

    const dustGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const dustMat = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    this.dust = new ParticlePool(scene, CONFIG.particles.dustPool, dustGeo, dustMat);
  }

  setQuality(scale) {
    this.scale = scale;
  }

  n(count) {
    return Math.max(1, Math.round(count * this.scale));
  }

  /** Tile shatter / generic burst. */
  burst(pos, color, count = 24, speed = 5) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.shards.emit(pos.x, pos.y, pos.z, Math.cos(a) * s, 2 + Math.random() * speed, Math.sin(a) * s, {
        life: 0.6 + Math.random() * 0.5,
        size: 0.08 + Math.random() * 0.1,
        color,
      });
    }
  }

  /** Big celebratory confetti fountain. */
  confetti(pos, count = 120) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      this.shards.emit(pos.x, pos.y + 0.5, pos.z, Math.cos(a) * s, 6 + Math.random() * 8, Math.sin(a) * s, {
        life: 1.6 + Math.random() * 1.2,
        size: 0.18 + Math.random() * 0.12,
        color: CONFETTI[i % CONFETTI.length],
        gravity: -7,
        drag: 1.4,
        spin: 14,
        flat: true,
      });
    }
  }

  /** Segment explosion when a word breaks. */
  explode(pos, color) {
    this.burst(pos, color, 18, 6);
    this.burst(pos, '#ffffff', 6, 4);
  }

  /** Soft dust puff behind the tail. */
  puff(pos, color = '#d8cbb0') {
    for (let i = 0; i < this.n(2); i++) {
      this.dust.emit(pos.x + (Math.random() - 0.5) * 0.3, 0.08, pos.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, {
        life: 0.7 + Math.random() * 0.3,
        size: 0.18 + Math.random() * 0.12,
        color,
        gravity: -0.4,
        drag: 2,
        spin: 1,
      });
    }
  }

  sparkle(pos, color = '#ffffff', count = 10) {
    for (let i = 0; i < this.n(count); i++) {
      this.shards.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, {
        life: 0.5 + Math.random() * 0.4,
        size: 0.06,
        color,
        gravity: -1,
        drag: 2,
      });
    }
  }

  update(dt) {
    this.shards.update(dt);
    this.dust.update(dt);
  }

  clear() {
    this.shards.clear();
    this.dust.clear();
  }
}
