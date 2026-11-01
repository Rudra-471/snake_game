// The word chain: banked words float above the far side of the arena as glowing 3D
// text, linked by an energy beam (a tube along a curve with a scrolling texture).

import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { glyph } from './glyphs.js';

const HALF = (CONFIG.grid.size * CONFIG.grid.cell) / 2;
const LETTER_SCALE = 1.45;
const LETTER_GAP = 0.1;
const WORD_GAP = 1.6;
const COLORS = ['#7ff9ff', '#ff7ce5', '#ffe066', '#8dff9a', '#b69bff'];

export class WordChain {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.position.set(0, 3.4, -HALF - 2.6);
    scene.add(this.group);
    this.inner = new THREE.Group();
    this.group.add(this.inner);

    this.letterMats = COLORS.map(
      (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.6, roughness: 0.3, metalness: 0.2 })
    );
    this.nodeGeo = new THREE.SphereGeometry(0.18, 16, 12);
    this.nodeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });

    this.beamTexture = this.makeBeamTexture();
    this.beamMat = new THREE.MeshBasicMaterial({
      map: this.beamTexture,
      color: '#9ff3ff',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.beam = null;
    this.words = [];
    this.cursor = 0;
  }

  makeBeamTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 8; i++) {
      grad.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,1)' : 'rgba(80,200,255,0.15)');
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 32);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  /**
   * Add a word. Letters start hidden; returns `targetOf(i, out)` (live world
   * position of letter i) and `reveal(i)` so flying letters can land one by one.
   */
  addWord(text) {
    const upper = text.toUpperCase();
    const wordGroup = new THREE.Group();
    const mat = this.letterMats[this.words.length % this.letterMats.length];
    let x = 0;
    const letters = [];
    for (const ch of upper) {
      const { geometry, width } = glyph(ch);
      const w = width * LETTER_SCALE;
      const m = new THREE.Mesh(geometry, mat);
      m.position.x = x + w / 2;
      m.scale.setScalar(0.001);
      wordGroup.add(m);
      letters.push(m);
      x += w + LETTER_GAP;
    }
    const width = x - LETTER_GAP;
    letters.forEach((m) => (m.position.x -= width / 2));

    const center = this.cursor + width / 2;
    wordGroup.position.x = center;
    wordGroup.userData.chainWord = text; // tap a sky word to hear it
    this.inner.add(wordGroup);

    const word = {
      text,
      group: wordGroup,
      letters,
      width,
      start: new THREE.Vector3(this.cursor - 0.35, 0, 0),
      end: new THREE.Vector3(this.cursor + width + 0.35, 0, 0),
    };
    // Glowing joints at both ends
    for (const p of [word.start, word.end]) {
      const node = new THREE.Mesh(this.nodeGeo, this.nodeMat);
      node.position.copy(p).sub(wordGroup.position);
      wordGroup.add(node);
    }
    this.words.push(word);
    this.cursor += width + WORD_GAP;

    // Scroll so the newest word sits just right of center
    gsap.to(this.inner.position, { x: -center + 1.5, duration: 1.2, ease: 'power2.inOut' });

    this.rebuildBeam();

    // Live world position of letter i (the chain scrolls while letters are in flight)
    const targetOf = (i, out) => {
      const m = letters[Math.min(i, letters.length - 1)];
      m.updateWorldMatrix(true, false);
      return out.setFromMatrixPosition(m.matrixWorld);
    };
    const reveal = (i) => {
      const m = letters[i];
      if (!m) return;
      gsap.fromTo(m.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: LETTER_SCALE * 1.3, y: LETTER_SCALE * 1.3, z: LETTER_SCALE * 1.3, duration: 0.18, ease: 'power2.out' });
      gsap.to(m.scale, { x: LETTER_SCALE, y: LETTER_SCALE, z: LETTER_SCALE, duration: 0.3, delay: 0.18, ease: 'back.out(3)' });
    };
    return { targetOf, reveal };
  }

  rebuildBeam() {
    if (this.beam) {
      this.inner.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam = null;
    }
    if (this.words.length < 2) return;
    // A single curve runs under every word and arcs up between them: one draw call.
    const allPts = [];
    this.words.forEach((w, i) => {
      allPts.push(w.start.clone().setY(-0.55), w.end.clone().setY(-0.55));
      if (i < this.words.length - 1) {
        const mid = w.end.clone().lerp(this.words[i + 1].start, 0.5);
        mid.y = 0.6;
        allPts.push(mid);
      }
    });
    const curve = new THREE.CatmullRomCurve3(allPts, false, 'centripetal');
    const segs = Math.min(600, allPts.length * 16);
    const geo = new THREE.TubeGeometry(curve, segs, 0.07, 8, false);
    this.beamTexture.repeat.set(Math.max(1, curve.getLength() / 3), 1);
    this.beam = new THREE.Mesh(geo, this.beamMat);
    this.inner.add(this.beam);
  }

  /** Find the chain word under a raycast hit (or null). */
  wordFromObject(obj) {
    for (let o = obj; o; o = o.parent) {
      if (o.userData && o.userData.chainWord) return this.words.find((w) => w.group === o) || null;
    }
    return null;
  }

  /** Letters hop in a wave (when tapped). */
  wave(word) {
    word.letters.forEach((m, i) => {
      gsap.fromTo(m.scale, { x: LETTER_SCALE, y: LETTER_SCALE, z: LETTER_SCALE }, {
        keyframes: [
          { x: LETTER_SCALE * 1.35, y: LETTER_SCALE * 1.35, z: LETTER_SCALE * 1.35, duration: 0.15 },
          { x: LETTER_SCALE, y: LETTER_SCALE, z: LETTER_SCALE, duration: 0.35, ease: 'back.out(3)' },
        ],
        delay: i * 0.06,
      });
    });
  }

  /** World-space points for the game-over fly-through. */
  flyPoints() {
    this.group.updateMatrixWorld(true);
    return this.words.map((w) => w.group.getWorldPosition(new THREE.Vector3()));
  }

  clear() {
    gsap.killTweensOf(this.inner.position);
    for (const w of this.words) {
      gsap.killTweensOf(w.letters.map((m) => m.scale));
      this.inner.remove(w.group);
    }
    if (this.beam) {
      this.inner.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam = null;
    }
    this.words = [];
    this.cursor = 0;
    this.inner.position.x = 0;
  }

  update(dt, time) {
    this.beamTexture.offset.x -= dt * 0.8;
    this.group.position.y = 3.4 + Math.sin(time * 1.2) * 0.12;
    this.words.forEach((w, i) => {
      w.letters.forEach((m, k) => (m.position.y = Math.sin(time * 2.2 + k * 0.6 + i) * 0.07));
    });
  }
}
