// Font loading + a cache of 3D glyph geometries. Every letter mesh in the game
// (snake segments, tiles, chain, score popups) shares these geometries, so no
// TextGeometry is ever created inside the game loop.

import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';

const cache = new Map();
let checkGeometry = null;

async function loadFont() {
  const loader = new FontLoader();
  let lastError;
  for (const url of CONFIG.font.urls) {
    try {
      return await loader.loadAsync(url);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('Font failed to load');
}

/** Load the font and pre-build every glyph we will ever need. */
export async function initGlyphs() {
  const font = await loadFont();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-';
  for (const ch of chars) {
    const geo = new TextGeometry(ch, {
      font,
      size: CONFIG.font.letterSize,
      depth: CONFIG.font.letterDepth,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const width = bb.max.x - bb.min.x;
    // Center horizontally and vertically so glyphs rotate/scale around their middle
    geo.translate(-(bb.min.x + width / 2), -(bb.min.y + (bb.max.y - bb.min.y) / 2), -CONFIG.font.letterDepth / 2);
    geo.computeVertexNormals();
    cache.set(ch, { geometry: geo, width: Math.max(width, CONFIG.font.letterSize * 0.4) });
  }
  // Math modes: one merged geometry per number 10–100 (single digits are cached above)
  for (let n = 10; n <= 100; n++) cache.set(String(n), buildNumberGlyph(String(n)));
  checkGeometry = buildCheckGeometry();
  return font;
}

/** Lay digit glyphs side by side and merge them into one centered geometry. */
function buildNumberGlyph(text) {
  const gap = CONFIG.font.letterSize * 0.08;
  const parts = [];
  let x = 0;
  for (const ch of text) {
    const { geometry, width } = cache.get(ch);
    parts.push(geometry.clone().translate(x + width / 2, 0, 0));
    x += width + gap;
  }
  const width = x - gap;
  const geo = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  geo.translate(-width / 2, 0, 0);
  return { geometry: geo, width };
}

/** Extruded ✓ shape (helvetiker has no check-mark glyph). */
function buildCheckGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.32, 0.02);
  s.lineTo(-0.2, 0.14);
  s.lineTo(-0.07, 0.0);
  s.lineTo(0.24, 0.32);
  s.lineTo(0.36, 0.2);
  s.lineTo(-0.07, -0.24);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  geo.center();
  return geo;
}

/** @returns {{ geometry: THREE.BufferGeometry, width: number }} */
export function glyph(ch) {
  return cache.get(String(ch).toUpperCase()) || cache.get('A');
}

/** Scale that makes a glyph fit a slot `maxWidth` wide (1 for single letters). */
export function fitScale(ch, maxWidth = 0.62) {
  return Math.min(1, maxWidth / glyph(ch).width);
}

export function checkGlyph() {
  return checkGeometry;
}

/** Total width of a string laid out with the cached glyphs. */
export function measure(text, spacing = 0.08) {
  let w = 0;
  for (const ch of text) w += glyph(ch).width + spacing;
  return Math.max(0, w - spacing);
}
