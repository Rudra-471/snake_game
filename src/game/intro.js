// Movie-style opening: a "click to begin" gate (browsers need a gesture before
// audio can play), then a letterboxed cinematic: captions over black, a sweeping
// crane shot across the world, 3D title tiles slamming down in time with timpani
// hits, a flash + music sting, and a glide into the main menu. Skippable.

import * as THREE from 'three';
import gsap from 'gsap';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { glyph } from './glyphs.js';
import { sfx } from '../audio/sfx.js';

const TITLE = ['WORD', 'SERPENT'];
const COLORS = ['#ffb3c7', '#b5e8ff', '#c9f7b5', '#ffe5a3', '#d8c6ff', '#ffcfa8'];
const STING_AT = 6.6;
const DROP_AT = 4.5;
const END_AT = 10.2;

export class Intro {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('intro');
    this.gate = document.getElementById('gate');
    this.done = false;
    this.camBase = new THREE.Vector3();
    this.lookBase = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shakeAmt = 0;
    this.tiles = [];
    this.disposables = [];
  }

  /** Show the gate and resolve on the first click / tap / key. */
  waitForGate() {
    return new Promise((resolve) => {
      this.gate.classList.remove('hidden');
      gsap.fromTo(this.gate.querySelectorAll('.gate-anim'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power2.out' });
      const go = (e) => {
        if (e && e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return;
        window.removeEventListener('keydown', go);
        this.gate.removeEventListener('pointerdown', go);
        sfx.unlock();
        gsap.to(this.gate, { opacity: 0, duration: 0.5, onComplete: () => this.gate.classList.add('hidden') });
        resolve();
      };
      window.addEventListener('keydown', go);
      this.gate.addEventListener('pointerdown', go);
    });
  }

  /** Full sequence; resolves when the menu should appear. */
  async play() {
    await this.waitForGate();
    await new Promise((resolve) => {
      this.resolve = resolve;
      this.start();
    });
  }

  buildTitle() {
    const g = this.game;
    this.group = new THREE.Group();
    g.scene.add(this.group);
    const box = new RoundedBoxGeometry(1.15, 1.15, 1.15, 4, 0.22);
    this.disposables.push(box);
    const ink = new THREE.MeshStandardMaterial({ color: '#2b2240', roughness: 0.35, emissive: '#2b2240', emissiveIntensity: 0.2 });
    this.disposables.push(ink);
    let k = 0;
    TITLE.forEach((word, row) => {
      const spacing = 1.32;
      const width = (word.length - 1) * spacing;
      [...word].forEach((ch, i) => {
        const mat = new THREE.MeshStandardMaterial({ color: COLORS[k % COLORS.length], roughness: 0.55, emissive: COLORS[k % COLORS.length], emissiveIntensity: 0 });
        this.disposables.push(mat);
        const tile = new THREE.Group();
        const body = new THREE.Mesh(box, mat);
        body.castShadow = true;
        tile.add(body);
        const front = new THREE.Mesh(glyph(ch).geometry, ink);
        front.position.z = 0.58;
        front.scale.setScalar(1.5);
        tile.add(front);
        const top = new THREE.Mesh(glyph(ch).geometry, ink);
        top.rotation.x = -Math.PI / 2;
        top.position.y = 0.58;
        top.scale.setScalar(1.3);
        tile.add(top);
        const target = new THREE.Vector3(i * spacing - width / 2, row === 0 ? 3.4 : 1.8, row === 0 ? -0.4 : 0.4);
        tile.position.set(target.x, target.y + 16, target.z);
        tile.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
        this.group.add(tile);
        this.tiles.push({ tile, target, mat, landed: false, phase: k * 0.7 });
        k++;
      });
    });
  }

  start() {
    const g = this.game;
    const rig = g.rig;
    const cam = rig.camera;
    this.buildTitle();
    sfx.playIntro(STING_AT);
    // Push fog back for the wide crane shot (restored in finish)
    if (g.scene.fog) {
      this.fog = { near: g.scene.fog.near, far: g.scene.fog.far };
      g.scene.fog.near *= 2;
      g.scene.fog.far *= 2.2;
    }
    rig.setMode('cinematic');

    // Overlay
    const $ = (s) => this.el.querySelector(s);
    const black = $('.intro-black');
    const flash = $('.intro-flash');
    const caption = $('.intro-caption');
    const tagline = $('.intro-tagline');
    const bars = this.el.querySelectorAll('.lb');
    this.el.classList.remove('hidden');
    gsap.set(black, { opacity: 1 });
    gsap.set([caption, tagline, flash], { opacity: 0 });
    gsap.set(bars, { height: 0 });

    // Skip on any input (after a short grace period so the gate click doesn't count)
    this.skipHandler = () => this.skip();
    setTimeout(() => {
      if (this.done) return;
      window.addEventListener('keydown', this.skipHandler);
      this.el.addEventListener('pointerdown', this.skipHandler);
    }, 400);

    // Camera: crane shot on a curve, ending in front of the title
    const aspect = window.innerWidth / window.innerHeight;
    const titleDist = 12.5 * Math.max(1, 1.3 / aspect);
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-34, 22, 46),
      new THREE.Vector3(-22, 10, 28),
      new THREE.Vector3(9, 5, titleDist + 6),
      new THREE.Vector3(0, 3.1, titleDist),
    ]);
    const lookFrom = new THREE.Vector3(0, 0, -4);
    const lookTo = new THREE.Vector3(0, 2.4, 0);
    this.camBase.copy(path.getPointAt(0));
    this.lookBase.copy(lookFrom);
    this.look.copy(lookFrom);

    // Per-frame driver: base pose + shake, title bobbing
    this.ticker = () => {
      const t = performance.now() / 1000;
      cam.position.copy(this.camBase);
      if (this.shakeAmt > 0.001) {
        cam.position.x += (Math.random() - 0.5) * this.shakeAmt;
        cam.position.y += (Math.random() - 0.5) * this.shakeAmt;
      }
      this.look.lerp(this.lookBase, 0.12);
      cam.lookAt(this.look);
      for (const T of this.tiles) {
        if (T.landed) T.tile.position.y = T.target.y + Math.sin(t * 2 + T.phase) * 0.08;
      }
    };
    gsap.ticker.add(this.ticker);

    const tl = (this.tl = gsap.timeline({ onComplete: () => this.finish() }));

    // 0 – 2s: captions over black, letterbox slides in
    tl.to(bars, { height: '11vh', duration: 1.2, ease: 'power2.inOut' }, 0);
    tl.call(() => (caption.textContent = 'In a world made of letters…'), null, 0.2);
    tl.to(caption, { opacity: 1, duration: 0.7 }, 0.3);
    tl.to(caption, { opacity: 0, duration: 0.5 }, 1.6);
    tl.to(black, { opacity: 0, duration: 1.4, ease: 'power1.in' }, 1.8);

    // 1.8 – 6.2s: crane shot
    const cs = { t: 0 };
    tl.to(cs, {
      t: 1,
      duration: 4.4,
      ease: 'sine.inOut',
      onUpdate: () => {
        this.camBase.copy(path.getPointAt(cs.t));
        this.lookBase.lerpVectors(lookFrom, lookTo, cs.t);
      },
    }, 1.8);
    tl.call(() => {
      caption.textContent = '…one little serpent dreams of words.';
      caption.classList.add('lower');
    }, null, 2.5);
    tl.to(caption, { opacity: 1, duration: 0.6 }, 2.6);
    tl.to(caption, { opacity: 0, duration: 0.5 }, 4.2);
    tl.call(() => sfx.whoosh(1.2), null, 3.2);

    // 4.5s: title tiles slam down one by one
    this.tiles.forEach((T, i) => {
      const at = DROP_AT + i * 0.14;
      tl.to(T.tile.position, { y: T.target.y, duration: 0.55, ease: 'bounce.out' }, at);
      tl.to(T.tile.rotation, { x: 0, y: 0, z: 0, duration: 0.45, ease: 'back.out(1.6)' }, at);
      tl.call(() => {
        T.landed = true;
        sfx.thud(i);
        this.shakeAmt = 0.12;
        gsap.to(this, { shakeAmt: 0, duration: 0.25 });
        const p = T.tile.position.clone();
        p.y -= 0.6;
        g.particles.sparkle(p, COLORS[i % COLORS.length], 8);
      }, null, at + 0.3);
    });

    // Sting: flash, bloom swell, confetti, tagline
    const bloom = g.postfx.bloom;
    const baseBloom = g.postfx.bloomStrength;
    this.baseBloom = baseBloom;
    tl.to(flash, { opacity: 0.85, duration: 0.08 }, STING_AT);
    tl.to(flash, { opacity: 0, duration: 0.7 }, STING_AT + 0.08);
    tl.to(bloom, { strength: baseBloom + 1.2, duration: 0.15 }, STING_AT);
    tl.to(bloom, { strength: baseBloom, duration: 1.4 }, STING_AT + 0.2);
    tl.call(() => {
      g.particles.confetti(new THREE.Vector3(0, 1.5, 0), 180);
      this.shakeAmt = 0.3;
      gsap.to(this, { shakeAmt: 0, duration: 0.6 });
      for (const T of this.tiles) gsap.fromTo(T.mat, { emissiveIntensity: 0.9 }, { emissiveIntensity: 0, duration: 1.2 });
    }, null, STING_AT);
    tl.to(this.camBase, { z: `-=${2.2}`, y: '+=0.3', duration: 1.8, ease: 'power2.out' }, STING_AT);
    tl.to(tagline, { opacity: 1, letterSpacing: '0.45em', duration: 1 }, STING_AT + 0.3);
    tl.to(tagline, { opacity: 0, duration: 0.5 }, 8.6);

    // 8.4s: tiles burst into sparkles, camera glides into the menu shot
    this.tiles.forEach((T, i) => {
      const at = 8.4 + i * 0.04;
      tl.to(T.tile.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.35, ease: 'back.in(2)' }, at);
      tl.call(() => g.particles.burst(T.tile.position, COLORS[i % COLORS.length], 14, 4), null, at + 0.3);
    });
    const menuPos = rig.menuPose(new THREE.Vector3());
    tl.to(this.camBase, { x: menuPos.x, y: menuPos.y, z: menuPos.z, duration: 1.7, ease: 'power2.inOut' }, 8.5);
    tl.to(this.lookBase, { x: 0, y: 0, z: 0, duration: 1.7, ease: 'power2.inOut' }, 8.5);
    tl.to(bars, { height: 0, duration: 0.8, ease: 'power2.inOut' }, 9.3);
    tl.set({}, {}, END_AT);
  }

  skip() {
    if (this.done) return;
    if (this.tl) this.tl.kill();
    gsap.killTweensOf(this.game.postfx.bloom);
    if (this.baseBloom != null) this.game.postfx.bloom.strength = this.baseBloom;
    this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    window.removeEventListener('keydown', this.skipHandler);
    this.el.removeEventListener('pointerdown', this.skipHandler);
    gsap.ticker.remove(this.ticker);
    gsap.killTweensOf(this);
    for (const T of this.tiles) gsap.killTweensOf([T.tile.position, T.tile.rotation, T.tile.scale, T.mat]);
    if (this.group) {
      this.game.scene.remove(this.group);
      this.disposables.forEach((d) => d.dispose());
    }
    gsap.to(this.el, {
      opacity: 0,
      duration: 0.4,
      onComplete: () => {
        this.el.classList.add('hidden');
        this.el.style.opacity = '';
      },
    });
    if (this.fog && this.game.scene.fog) {
      gsap.to(this.game.scene.fog, { near: this.fog.near, far: this.fog.far, duration: 1.2 });
    }
    this.game.rig.enterMenu();
    if (this.resolve) this.resolve();
  }
}
