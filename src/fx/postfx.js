// Bloom composer + graphics quality presets (Low / Medium / High).

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';

// Final color grade in display space: saturation, contrast, tint and a soft vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.05 },
    contrast: { value: 1.04 },
    tint: { value: new THREE.Color(1, 1, 1) },
    vignette: { value: 0.35 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; uniform vec3 tint; uniform float vignette;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col *= tint;
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.35, 0.95, length(d * vec2(1.15, 1.0)) * 1.3);
      col *= 1.0 - v * vignette;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export function detectDefaultQuality() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return coarse || mobileUA ? 'low' : 'high';
}

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = 'high';
    this.bloomStrength = 0.6;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), this.bloomStrength, 0.45, 0.82);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
  }

  /** Per-world color grade. */
  setGrade({ saturation = 1.05, contrast = 1.04, tint = '#ffffff', vignette = 0.35 } = {}) {
    const u = this.grade.uniforms;
    u.saturation.value = saturation;
    u.contrast.value = contrast;
    u.tint.value.setStyle(tint, THREE.LinearSRGBColorSpace); // raw display-space multiplier
    u.vignette.value = vignette;
  }

  get preset() {
    return CONFIG.graphics[this.quality];
  }

  /** Per-world bloom tuning (Neon City wants a lot more glow). */
  setBloom(strength, threshold = 0.82) {
    this.bloomStrength = strength;
    this.bloom.strength = strength;
    this.bloom.threshold = threshold;
  }

  setQuality(quality, light) {
    this.quality = CONFIG.graphics[quality] ? quality : 'medium';
    const p = this.preset;
    const dpr = Math.min(window.devicePixelRatio || 1, p.pixelRatio);
    this.renderer.setPixelRatio(dpr);

    const shadowsChanged = this.renderer.shadowMap.enabled !== p.shadows;
    this.renderer.shadowMap.enabled = p.shadows;
    if (light) {
      light.castShadow = p.shadows;
      if (light.shadow.mapSize.x !== p.shadowMapSize) {
        light.shadow.mapSize.set(p.shadowMapSize, p.shadowMapSize);
        if (light.shadow.map) {
          light.shadow.map.dispose();
          light.shadow.map = null;
        }
      }
    }
    if (shadowsChanged) {
      // Materials compile shadow code into their shaders, so force a recompile.
      this.scene.traverse((o) => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => (m.needsUpdate = true));
        }
      });
    }
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w, h) {
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    // Bloom at half resolution on Medium keeps it cheap
    const scale = this.quality === 'high' ? 1 : 0.5;
    const pr = this.renderer.getPixelRatio();
    this.bloom.setSize(Math.round(w * pr * scale), Math.round(h * pr * scale));
  }

  render() {
    if (this.preset.bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
