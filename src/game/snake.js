// Snake: discrete grid logic + smooth interpolated 3D rendering.
//
// Logic: `cells` holds grid coordinates head-first. Each step the head moves one
// cell; growing keeps the tail where it is. Letters belong to segment indices
// (segment i always renders letters[i]), and new letter segments are appended at
// the tail, so words read from the neck toward the tail.
//
// Segment kinds: 'base' (plain body), 'letter' (current word), 'banked' (a formed
// word — gold letters) and 'link' (a glowing knot between words). A beam of light
// connects every banked letter and link, so formed words stay on the body as one
// connected chain and each new word starts after the last link.
//
// Rendering: every segment is placed along a path through the cell centers,
// parameterised so that at step progress `alpha` segment i sits (1 - alpha) of the
// way back toward where it was. Corners are rounded with quadratic Béziers, so
// the body curves through turns instead of snapping at right angles.

import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';
import { glyph, fitScale } from './glyphs.js';

const N = CONFIG.grid.size;
const HALF = (N * CONFIG.grid.cell) / 2;
const SN = CONFIG.snake;

export const SKINS = {
  jungle: { a: '#13b5a0', b: '#0b8f86', head: '#1cc4ad', belly: '#ffd36e', letter: '#fffbe6', metalness: 0, roughness: 0.32, clearcoat: 1, emissive: '#000000', emissiveIntensity: 0, dust: null },
  ruby: { a: '#e5383b', b: '#b5171c', head: '#f04a4d', belly: '#ffd27a', letter: '#ffe9a8', metalness: 0.15, roughness: 0.25, clearcoat: 1, emissive: '#3a0000', emissiveIntensity: 0.3 },
  robot: { a: '#d5dae2', b: '#9aa4b1', head: '#e6eaf0', belly: '#4cc9f0', letter: '#13315c', metalness: 1, roughness: 0.18, clearcoat: 0.6, emissive: '#000000', emissiveIntensity: 0 },
  candy: { a: '#ff8fc7', b: '#8fe3ff', head: '#ffa6d4', belly: '#fff3a0', letter: '#7a1f5c', metalness: 0, roughness: 0.2, clearcoat: 1, emissive: '#000000', emissiveIntensity: 0 },
  galaxy: { a: '#2a1a5e', b: '#3b1f80', head: '#3f2390', belly: '#ff6bd6', letter: '#ffe66d', metalness: 0.2, roughness: 0.3, clearcoat: 1, emissive: '#8a6bff', emissiveIntensity: 1.2, stars: true },
};

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function cellX(x) {
  return x + 0.5 - HALF;
}

export class Snake {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.cells = [];
    this.letters = [];
    this.letterVisible = [];
    this.kinds = [];
    this.revealAt = [];
    this.dir = { ...SN.startDir };
    this.queue = [];
    this.prevTail = { x: 0, y: 0 };
    this.path = [];
    this.alpha = 1;
    this.headYaw = 0;
    this.lookTarget = null;
    this.expression = 'normal';
    this.expressionTimer = 0;
    this.blinkTimer = 2 + Math.random() * 2;
    this.blinkT = 0;
    this.tongueTimer = 3;
    this.visible = true;
    this.blinking = false;
    this.headWorld = new THREE.Vector3();

    this.buildMaterials();
    this.buildHead();
    this.buildSegments();
  }

  // ---------- construction ----------

  buildMaterials() {
    const phys = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    this.matA = phys('#43c463');
    this.matB = phys('#2fa84f');
    this.matHead = phys('#4fd06e');
    this.matBelly = new THREE.MeshStandardMaterial({ color: '#e9ffb8', roughness: 0.5 });
    this.matLetter = new THREE.MeshStandardMaterial({ color: '#fffbe6', roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.12 });
    // Formed words: glowing gold letters, light-beam connectors and link knots
    this.matBanked = new THREE.MeshStandardMaterial({ color: '#ffe27a', roughness: 0.25, metalness: 0.3, emissive: '#ffb703', emissiveIntensity: 0.35 });
    this.matBeam = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#8ff7ff', emissiveIntensity: 1.9, roughness: 0.2 });
    this.matLink = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#7df9ff', emissiveIntensity: 1.5, roughness: 0.15, metalness: 0.2 });
    this.starTexture = this.makeStarTexture();
  }

  makeStarTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i++) {
      const r = Math.random() < 0.15 ? 2 : 1;
      g.fillStyle = Math.random() < 0.3 ? '#ffd6ff' : '#ffffff';
      g.globalAlpha = 0.4 + Math.random() * 0.6;
      g.beginPath();
      g.arc(Math.random() * 128, Math.random() * 128, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.25;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#ff6bd6');
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  buildHead() {
    this.head = new THREE.Group();
    this.headBody = new THREE.Group(); // squash/stretch target
    this.head.add(this.headBody);

    const geo = new RoundedBoxGeometry(0.92, 0.7, 1.0, 4, 0.3);
    const body = new THREE.Mesh(geo, this.matHead);
    body.castShadow = true;
    body.receiveShadow = true;
    body.position.y = 0.35;
    this.headBody.add(body);

    // Belly stripe under the chin
    const chin = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.12, 0.8, 2, 0.05), this.matBelly);
    chin.position.set(0, 0.08, 0.06);
    this.headBody.add(chin);

    // Eyes: white spheres with pupils that track the nearest valid letter
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#111122', roughness: 0.1 });
    const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const eyeGeo = new THREE.SphereGeometry(0.17, 20, 14);
    const pupilGeo = new THREE.SphereGeometry(0.085, 14, 10);
    const shineGeo = new THREE.SphereGeometry(0.025, 8, 6);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * 0.23, 0.68, 0.28);
      const white = new THREE.Mesh(eyeGeo, whiteMat);
      white.castShadow = true;
      eye.add(white);
      const pupil = new THREE.Group();
      const p = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.add(p);
      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(0.03, 0.035, 0.07);
      pupil.add(shine);
      pupil.position.set(0, 0.02, 0.11);
      eye.add(pupil);
      this.headBody.add(eye);
      this.eyes.push({ eye, pupil, side });
    }

    // Nostrils + tongue
    const nostrilGeo = new THREE.SphereGeometry(0.03, 6, 4);
    for (const side of [-1, 1]) {
      const n = new THREE.Mesh(nostrilGeo, pupilMat);
      n.position.set(side * 0.12, 0.45, 0.5);
      this.headBody.add(n);
    }
    this.tongue = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.35), new THREE.MeshStandardMaterial({ color: '#ff4d6d', roughness: 0.4 }));
    this.tongue.geometry.translate(0, 0, 0.175);
    this.tongue.position.set(0, 0.2, 0.45);
    this.tongue.scale.z = 0.001;
    this.headBody.add(this.tongue);

    this.head.scale.setScalar(SN.headScale);
    this.group.add(this.head);
  }

  buildSegments() {
    const geo = new RoundedBoxGeometry(0.84, 0.6, 0.84, 3, 0.22);
    const linkGeo = new THREE.IcosahedronGeometry(0.3, 1);
    const ringGeo = new THREE.TorusGeometry(0.34, 0.05, 8, 24);
    const beamGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 10, 1, true);
    beamGeo.translate(0, 0.5, 0); // pivot at one end so scale.y = length
    this.beamUp = new THREE.Vector3(0, 1, 0);
    this.segments = [];
    for (let i = 0; i < SN.maxSegments; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(geo, i % 2 ? this.matB : this.matA);
      body.position.y = 0.3;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      // Letters stay world-aligned so they read upright from the camera
      const letter = new THREE.Mesh(glyph('A').geometry, this.matLetter);
      letter.rotation.x = -Math.PI / 2;
      letter.position.y = 0.62;
      letter.castShadow = true;
      letter.visible = false;
      g.add(letter);
      const link = new THREE.Group();
      const orb = new THREE.Mesh(linkGeo, this.matLink);
      orb.castShadow = true;
      link.add(orb);
      const ring = new THREE.Mesh(ringGeo, this.matBeam);
      ring.rotation.x = Math.PI / 2;
      link.add(ring);
      link.position.y = 0.42;
      link.visible = false;
      g.add(link);
      g.visible = false;
      this.group.add(g);
      // Connector beam from this segment to the next one (world space)
      const beam = new THREE.Mesh(beamGeo, this.matBeam);
      beam.visible = false;
      this.group.add(beam);
      this.segments.push({ group: g, body, letter, link, ring, beam });
    }
  }

  setSkin(id) {
    const s = SKINS[id] || SKINS.jungle;
    for (const [m, color] of [
      [this.matA, s.a],
      [this.matB, s.b],
      [this.matHead, s.head],
    ]) {
      m.color.set(color);
      m.metalness = s.metalness;
      m.roughness = s.roughness;
      m.clearcoat = s.clearcoat;
      m.emissive.set(s.emissive);
      m.emissiveIntensity = s.emissiveIntensity;
      m.emissiveMap = s.stars ? this.starTexture : null;
      m.needsUpdate = true;
    }
    this.matBelly.color.set(s.belly);
    this.matLetter.color.set(s.letter);
    this.matLetter.emissive.set(s.letter);
    this.matLetter.emissiveIntensity = s.stars ? 0.6 : 0.12;
    this.skin = s;
  }

  /** The color a segment explodes into. */
  segmentColor(i) {
    if (this.kinds[i] === 'link') return '#7df9ff';
    if (this.kinds[i] === 'banked') return '#ffd166';
    return (i % 2 ? this.matB : this.matA).color.getStyle();
  }

  // ---------- grid logic ----------

  reset(start = { x: Math.floor(N / 2), y: Math.floor(N / 2) + 2 }, dir = SN.startDir, length = SN.baseLength) {
    this.dir = { ...dir };
    this.queue = [];
    this.cells = [];
    this.letters = [];
    this.letterVisible = [];
    this.kinds = [];
    this.revealAt = [];
    for (let i = 0; i < length; i++) {
      this.cells.push({ x: start.x - dir.x * i, y: start.y - dir.y * i });
      this.letters.push(null);
      this.letterVisible.push(false);
      this.kinds.push('base');
      this.revealAt.push(0);
    }
    const tail = this.cells[this.cells.length - 1];
    this.prevTail = { x: tail.x - dir.x, y: tail.y - dir.y };
    this.alpha = 1;
    this.headYaw = Math.atan2(dir.x, dir.y);
    this.setExpression('normal');
    this.render(1, 0, 0);
  }

  get length() {
    return this.cells.length;
  }

  get headCell() {
    return this.cells[0];
  }

  get nextDir() {
    return this.queue[0] || this.dir;
  }

  /** Queue a turn. Keeps at most one buffered turn beyond the next step; no 180° reversals. */
  queueTurn(d) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if ((d.x === -last.x && d.y === -last.y) || (d.x === last.x && d.y === last.y)) return false;
    if (this.queue.length >= 2) return false;
    this.queue.push({ ...d });
    return true;
  }

  peekNextCell() {
    const d = this.nextDir;
    return { x: this.cells[0].x + d.x, y: this.cells[0].y + d.y };
  }

  /** Would moving into `cell` crash? (tail cell is free unless we are growing) */
  wouldCollide(cell, growing, obstacles) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= N || cell.y >= N) return 'wall';
    const end = growing ? this.cells.length : this.cells.length - 1;
    for (let i = 0; i < end; i++) {
      if (this.cells[i].x === cell.x && this.cells[i].y === cell.y) return 'self';
    }
    if (obstacles && obstacles.some((o) => o.x === cell.x && o.y === cell.y)) return 'wall';
    return null;
  }

  /**
   * Advance one cell. Passing a letter (string) grows the snake by one lettered
   * segment; passing { kind: 'link', time } grows it by a link knot.
   */
  step(seg = null) {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = { x: this.cells[0].x + this.dir.x, y: this.cells[0].y + this.dir.y };
    this.cells.unshift(head);
    if (seg) {
      const isLink = typeof seg === 'object' && seg.kind === 'link';
      this.prevTail = { ...this.cells[this.cells.length - 1] };
      this.letters.push(isLink ? null : seg);
      this.letterVisible.push(false);
      this.kinds.push(isLink ? 'link' : 'letter');
      this.revealAt.push(isLink ? seg.time || 0 : 0);
    } else {
      this.prevTail = this.cells.pop();
    }
    this.alpha = 0;
  }

  /**
   * Shrink back to `len` segments. Returns world positions + letters of removed
   * segments so the caller can fly them away or explode them.
   */
  truncate(len) {
    const removed = [];
    for (let i = len; i < this.cells.length; i++) {
      const seg = this.segments[i];
      if (!seg) continue;
      seg.group.updateMatrixWorld();
      removed.push({
        index: i,
        letter: this.letters[i],
        position: seg.group.getWorldPosition(new THREE.Vector3()).setY(0.62),
        color: this.segmentColor(i),
      });
    }
    if (this.cells.length > len) {
      this.prevTail = { ...this.cells[len] };
      this.cells.length = len;
      this.letters.length = len;
      this.letterVisible.length = len;
      this.kinds.length = len;
      this.revealAt.length = len;
    }
    return removed;
  }

  /** Turn the current word's segments [from, to) into a formed (banked) word. */
  markBanked(from, to, time) {
    for (let i = from; i < to && i < this.kinds.length; i++) {
      if (this.kinds[i] !== 'letter') continue;
      this.kinds[i] = 'banked';
      this.letterVisible[i] = true;
      this.revealAt[i] = time + (i - from) * 0.07;
    }
  }

  setLetterVisible(i, v = true) {
    if (i < this.letterVisible.length) this.letterVisible[i] = v;
  }

  /** Simple autopilot for the menu background: wander without crashing. */
  autoSteer() {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ].filter((d) => !(d.x === -this.dir.x && d.y === -this.dir.y));
    const head = this.cells[0];
    const safe = dirs.filter((d) => {
      const c = { x: head.x + d.x, y: head.y + d.y };
      if (this.wouldCollide(c, false)) return false;
      const c2 = { x: c.x + d.x, y: c.y + d.y };
      return c2.x >= 1 && c2.y >= 1 && c2.x < N - 1 && c2.y < N - 1;
    });
    const straightOk = safe.some((d) => d.x === this.dir.x && d.y === this.dir.y);
    if (straightOk && Math.random() < 0.88) return;
    const options = safe.length ? safe : dirs.filter((d) => !this.wouldCollide({ x: head.x + d.x, y: head.y + d.y }, false));
    if (options.length) {
      const d = options[Math.floor(Math.random() * options.length)];
      this.queue = [];
      if (d.x !== this.dir.x || d.y !== this.dir.y) this.queueTurn(d);
    }
  }

  // ---------- expressions ----------

  setExpression(type, duration = 0) {
    this.expression = type;
    this.expressionTimer = duration;
  }

  squash() {
    const b = this.headBody.scale;
    gsap.killTweensOf(b);
    gsap.fromTo(b, { x: 1.25, y: 0.75, z: 1.15 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'elastic.out(1, 0.4)' });
  }

  // ---------- rendering ----------

  /** Point along the rounded path at parameter s (see file header). */
  pathAt(s, out) {
    const P = this.path;
    const last = P.length - 1;
    if (s >= last) return out.set(cellX(P[last].x), 0, cellX(P[last].y));
    if (s < 0) s = 0;
    const i0 = Math.floor(s);
    const f = s - i0;
    let A;
    let V;
    let B;
    let u;
    if (f >= 0.5) {
      A = P[i0];
      V = P[i0 + 1];
      B = P[i0 + 2];
      u = f - 0.5;
    } else {
      A = P[i0 - 1];
      V = P[i0];
      B = P[i0 + 1];
      u = f + 0.5;
    }
    if (!A || !B) {
      // No neighbour to round with: straight line
      const p = P[i0];
      const q = P[i0 + 1];
      return out.set(cellX(p.x + (q.x - p.x) * f), 0, cellX(p.y + (q.y - p.y) * f));
    }
    // Quadratic Bézier from mid(A,V) through control V to mid(V,B)
    const m1x = (A.x + V.x) / 2;
    const m1y = (A.y + V.y) / 2;
    const m2x = (V.x + B.x) / 2;
    const m2y = (V.y + B.y) / 2;
    const iu = 1 - u;
    const x = iu * iu * m1x + 2 * iu * u * V.x + u * u * m2x;
    const y = iu * iu * m1y + 2 * iu * u * V.y + u * u * m2y;
    return out.set(cellX(x), 0, cellX(y));
  }

  /**
   * @param {number} alpha step progress 0..1
   * @param {number} dt
   * @param {number} time
   */
  render(alpha, dt, time) {
    this.alpha = alpha;
    const n = this.cells.length;
    if (!n) return;
    const next = this.peekNextCell();
    this.path = [next, ...this.cells, this.prevTail];

    // Head
    const sHead = 1 + (1 - alpha);
    this.pathAt(sHead, _a);
    this.pathAt(sHead - 0.08, _b);
    this.pathAt(sHead + 0.08, _v);
    const dx = _b.x - _v.x;
    const dz = _b.z - _v.z;
    if (dx * dx + dz * dz > 1e-6) {
      const target = Math.atan2(dx, dz);
      let diff = target - this.headYaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.headYaw += diff * Math.min(1, dt * 18 || 1);
    }
    this.head.position.set(_a.x, Math.sin(time * 8) * 0.025, _a.z);
    this.head.rotation.y = this.headYaw;
    this.headWorld.copy(this.head.position);

    // Body segments (segment 0 is the head itself)
    for (let i = 0; i < SN.maxSegments; i++) {
      const seg = this.segments[i];
      if (i === 0 || i >= n) {
        seg.group.visible = false;
        seg.beam.visible = false;
        continue;
      }
      seg.group.visible = this.visible;
      const s = i + 1 + (1 - alpha);
      this.pathAt(s, _a);
      this.pathAt(s - 0.1, _b);
      this.pathAt(s + 0.1, _v);
      const scale = Math.max(SN.minScale, 1 - i * SN.taperPerSegment);
      const wave = Math.sin(time * 8 - i * 0.7) * 0.03;
      seg.group.position.set(_a.x, wave, _a.z);
      seg.group.scale.setScalar(scale);
      seg.body.rotation.y = Math.atan2(_b.x - _v.x, _b.z - _v.z);
      const kind = this.kinds[i];
      const isLink = kind === 'link';
      seg.body.visible = !isLink;
      seg.link.visible = isLink;
      if (isLink) {
        const k = THREE.MathUtils.clamp((time - this.revealAt[i]) / 0.25, 0, 1);
        seg.link.scale.setScalar((0.2 + 0.8 * k) * (1 + Math.sin(time * 5 + i) * 0.08) / scale);
        seg.ring.rotation.z = time * 2;
        seg.link.position.y = 0.42 + Math.sin(time * 3 + i) * 0.05;
      }
      const ch = this.letters[i];
      if (ch && this.letterVisible[i]) {
        const g = glyph(ch).geometry;
        if (seg.letter.geometry !== g) seg.letter.geometry = g;
        const banked = kind === 'banked';
        seg.letter.material = banked ? this.matBanked : this.matLetter;
        seg.letter.visible = true;
        // banked letters pop as the glow wave reaches them
        const pop = banked ? 1 + 0.6 * Math.max(0, 1 - Math.abs(time - this.revealAt[i] - 0.1) / 0.15) : 1;
        seg.letter.scale.setScalar((pop / scale) * fitScale(ch, 0.7)); // readable on the thin tail; numbers fit the segment
      } else {
        seg.letter.visible = false;
      }
    }
    this.head.visible = this.visible;
    this.renderBeams(n, time);

    this.animateFace(dt, time);
  }

  /** Light beams joining consecutive formed-word segments (banked letters + links). */
  renderBeams(n, time) {
    const joined = (k) => k === 'banked' || k === 'link';
    const last = Math.min(n, SN.maxSegments - 1); // only pooled segments have beams
    for (let i = 1; i < last; i++) {
      const seg = this.segments[i];
      const next = this.segments[i + 1];
      const show = this.visible && i + 1 < n && joined(this.kinds[i]) && joined(this.kinds[i + 1]);
      if (!show) {
        seg.beam.visible = false;
        continue;
      }
      // the beam "zips" along as each segment's reveal time passes
      const k = THREE.MathUtils.clamp((time - Math.max(this.revealAt[i], this.revealAt[i + 1])) / 0.12, 0, 1);
      if (k <= 0) {
        seg.beam.visible = false;
        continue;
      }
      _a.copy(seg.group.position);
      _a.y += 0.47 * seg.group.scale.y;
      _b.copy(next.group.position);
      _b.y += 0.47 * next.group.scale.y;
      _v.subVectors(_b, _a);
      const len = _v.length();
      if (len < 1e-4) {
        seg.beam.visible = false;
        continue;
      }
      seg.beam.visible = true;
      seg.beam.position.copy(_a);
      seg.beam.quaternion.setFromUnitVectors(this.beamUp, _v.multiplyScalar(1 / len));
      const pulse = 1 + Math.sin(time * 8 - i * 0.6) * 0.2;
      seg.beam.scale.set(pulse, len * k, pulse);
    }
  }

  animateFace(dt, time) {
    // Blink every few seconds
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkT = 0.14;
      this.blinkTimer = 2.5 + Math.random() * 3;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);

    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.expression = 'normal';
    }

    // Pupils look toward the nearest valid letter (in head-local space)
    let lx = 0;
    let ly = 0;
    if (this.lookTarget) {
      _w.copy(this.lookTarget);
      this.head.worldToLocal(_w);
      const len = Math.hypot(_w.x, _w.z) || 1;
      lx = THREE.MathUtils.clamp(_w.x / len, -1, 1);
      ly = THREE.MathUtils.clamp(_w.z / len, -1, 1);
    }

    for (const { eye, pupil, side } of this.eyes) {
      let sy = 1;
      if (this.blinkT > 0) sy = 0.1;
      if (this.expression === 'happy') sy = 0.32;
      if (this.expression === 'dizzy') sy = 1.1;
      eye.scale.y += (sy - eye.scale.y) * Math.min(1, dt * 25);
      eye.scale.x = eye.scale.z = this.expression === 'dizzy' ? 1.1 : 1;

      if (this.expression === 'dizzy') {
        // Spiral eyes: pupils whirl in opposite directions
        const a = time * 14 * side;
        const r = 0.05 + Math.sin(time * 6) * 0.015;
        pupil.position.set(Math.cos(a) * r, 0.02 + Math.sin(a) * r, 0.12);
        pupil.scale.setScalar(0.8);
      } else {
        pupil.position.set(lx * 0.06, 0.02 + (ly < 0 ? 0.02 : 0), 0.11 + Math.max(0, ly) * 0.02);
        pupil.scale.setScalar(this.expression === 'happy' ? 0.01 : 1);
      }
    }

    // Occasional tongue flick
    this.tongueTimer -= dt;
    if (this.tongueTimer <= 0) {
      this.tongueTimer = 3 + Math.random() * 4;
      gsap.killTweensOf(this.tongue.scale);
      gsap.timeline().to(this.tongue.scale, { z: 1, duration: 0.08 }).to(this.tongue.scale, { z: 0.001, duration: 0.12, delay: 0.1 });
    }
  }

  /** World position of a segment's letter slot. */
  segmentLetterWorld(i, out = new THREE.Vector3()) {
    const seg = this.segments[Math.min(i, this.segments.length - 1)];
    seg.group.updateMatrixWorld();
    return seg.group.localToWorld(out.set(0, 0.62, 0));
  }

  tailWorld(out = new THREE.Vector3()) {
    const i = this.cells.length - 1;
    if (i <= 0) return out.copy(this.headWorld);
    return this.segments[i].group.getWorldPosition(out);
  }
}
