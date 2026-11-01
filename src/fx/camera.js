// Camera rig: smooth follow with look-ahead, auto zoom, trauma-based shake,
// a short orbit cinematic for banked words, and a fly-through along a path.

import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config.js';

const C = CONFIG.camera;
const _target = new THREE.Vector3();
const _offset = new THREE.Vector3();

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(C.fov, aspect, 0.1, 400);
    this.focus = new THREE.Vector3(0, 0, 0);
    this.lookTarget = new THREE.Vector3();
    this.distance = C.menuDistance;
    this.tilt = THREE.MathUtils.degToRad(C.tiltDeg);
    this.yaw = 0;
    this.orbitYaw = 0;
    this.orbitZoom = 0;
    this.chainLook = 0;
    this.trauma = 0;
    this.mode = 'menu';
    this.menuAngle = 0;
    this.pathTween = null;
    this.aspect = aspect;
    this.shakeEnabled = true;
    this.update(0, null);
  }

  resize(aspect) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Portrait screens need to pull back so the board still fits. */
  get aspectFactor() {
    return this.aspect < 1 ? 1 + (1 - this.aspect) * 1.05 : 1;
  }

  shake(amount = 0.5) {
    if (!this.shakeEnabled) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  setMode(mode) {
    this.mode = mode;
    if (this.pathTween && mode !== 'path') {
      this.pathTween.kill();
      this.pathTween = null;
    }
  }

  /** Snap straight to the follow position (used when a run starts). */
  snapTo(pos) {
    this.focus.copy(pos);
    this.distance = C.baseDistance * this.aspectFactor;
  }

  /** Where the camera sits in menu mode right now (for gliding into it). */
  menuPose(outPos, outLook) {
    const yaw = Math.sin(this.menuAngle) * 0.5;
    const dist = C.menuDistance * this.aspectFactor;
    outPos.set(Math.sin(yaw) * Math.cos(this.tilt), Math.sin(this.tilt), Math.cos(yaw) * Math.cos(this.tilt)).multiplyScalar(dist);
    if (outLook) outLook.set(0, 0, 0);
    return outPos;
  }

  /** Hand control back to menu mode starting from the current framing. */
  enterMenu() {
    this.focus.set(0, 0, 0);
    this.distance = C.menuDistance * this.aspectFactor;
    this.yaw = Math.sin(this.menuAngle) * 0.5;
    this.setMode('menu');
  }

  /** Short cinematic orbit around the head (word banked). */
  orbit(duration = 1.2) {
    gsap.killTweensOf(this, 'orbitYaw,orbitZoom,chainLook');
    gsap
      .timeline()
      .to(this, { orbitYaw: 0.75, orbitZoom: -3, chainLook: 1, duration: duration * 0.5, ease: 'sine.inOut' })
      .to(this, { orbitYaw: 0, orbitZoom: 0, chainLook: 0, duration: duration * 0.5, ease: 'sine.inOut' });
  }

  /**
   * Fly the camera along a list of world points (e.g. the word chain), looking at them.
   * @param {THREE.Vector3[]} points
   */
  flyAlong(points, duration, onDone) {
    this.setMode('path');
    const pts = points.length > 1 ? points : [points[0].clone().add(new THREE.Vector3(-3, 0, 0)), points[0]];
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => p.clone()));
    const camOffset = new THREE.Vector3(0, 1.2, 7.5);
    const state = { t: 0 };
    const start = this.camera.position.clone();
    this.pathTween = gsap.to(state, {
      t: 1,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        const p = curve.getPointAt(state.t);
        const desired = _target.copy(p).add(camOffset);
        const blend = Math.min(1, state.t * 6); // ease in from wherever the camera was
        this.camera.position.lerpVectors(start, desired, blend);
        this.lookTarget.lerp(p, Math.min(1, 0.08 + blend * 0.5));
        this.camera.lookAt(this.lookTarget);
      },
      onComplete: () => {
        this.pathTween = null;
        if (onDone) onDone();
      },
    });
  }

  /**
   * @param {number} dt
   * @param {{ head: THREE.Vector3, dir: {x:number,y:number}, length:number } | null} follow
   */
  update(dt, follow) {
    // 'path' and 'cinematic' modes are driven externally (fly-through, intro)
    if (this.mode === 'path' || this.mode === 'cinematic') {
      this.trauma = Math.max(0, this.trauma - C.shakeDecay * dt);
      return;
    }
    const k = 1 - Math.exp(-C.followLerp * dt);

    if (this.mode === 'follow' && follow) {
      _target.set(follow.head.x + follow.dir.x * C.lookAhead, 0, follow.head.z + follow.dir.y * C.lookAhead);
      // Keep the camera from wandering too far past the arena edges
      const half = (CONFIG.grid.size * CONFIG.grid.cell) / 2;
      _target.x = THREE.MathUtils.clamp(_target.x * 0.75, -half * 0.6, half * 0.6);
      _target.z = THREE.MathUtils.clamp(_target.z * 0.75, -half * 0.55, half * 0.7);
      // While a word is banked, drift toward the far side so the chain is in view
      _target.z += (-half * 0.6 - _target.z) * this.chainLook;
      this.focus.lerp(_target, Math.max(k, this.chainLook * 0.2));
      const extra = Math.min(C.maxExtraZoom, Math.max(0, follow.length - CONFIG.snake.baseLength) * C.zoomPerSegment);
      const wanted = (C.baseDistance + extra) * this.aspectFactor;
      this.distance += (wanted - this.distance) * k;
      this.yaw += (0 - this.yaw) * k;
    } else if (this.mode === 'menu') {
      this.menuAngle += dt * 0.06;
      _target.set(0, 0, 0);
      this.focus.lerp(_target, k);
      const wanted = C.menuDistance * this.aspectFactor;
      this.distance += (wanted - this.distance) * k;
      this.yaw = Math.sin(this.menuAngle) * 0.5;
    }

    const yaw = this.yaw + this.orbitYaw;
    const dist = Math.max(6, this.distance + this.orbitZoom);
    _offset.set(Math.sin(yaw) * Math.cos(this.tilt), Math.sin(this.tilt), Math.cos(yaw) * Math.cos(this.tilt)).multiplyScalar(dist);
    this.camera.position.copy(this.focus).add(_offset);
    this.lookTarget.copy(this.focus);

    // Trauma-based shake: offset grows with trauma², decays over time
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.lookTarget.x += (Math.random() - 0.5) * s * 0.5;
      this.trauma = Math.max(0, this.trauma - C.shakeDecay * dt);
    }
    this.camera.lookAt(this.lookTarget);
  }
}
