// Smart letter spawner.
//
// The spawner answers two questions every time the current word changes:
//   1. WHICH letters to put on the board (chooseLetters)
//   2. WHERE to put them (placeTiles)
//
// Letter choice is driven entirely by the Trie:
//   • Empty prefix  → 4–5 different first letters, weighted by how many words start
//                     with each (root child wordCount), so "s", "c", "b"… are common.
//   • Prefix P      → 2–3 "valid" letters = children of P's node whose subtree still
//                     reaches a word of ≥ 3 letters, weighted by wordCount so rich,
//                     long-word branches are favoured. Then N "decoys" = letters that
//                     are NOT children of P (eating one is a mistake).
//   • If P itself is a word of ≥ 3 letters a ✓ crystal is added; eating it banks P.
//   • Because every node in the Trie lies on the path to at least one word, a valid
//     prefix always has either a child or isWord, so the set always contains at least
//     one way forward (a valid letter or the ✓).
//
// Placement keeps tiles fair: never on the snake or obstacles, never in the two cells
// right in front of the head, at least 2 cells apart, and only on cells the head can
// actually reach (flood fill around the body).

import { CONFIG } from '../config.js';

const SP = CONFIG.spawn;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

// Rough English letter frequency, used so decoys look plausible rather than random Q/Z soup.
const LETTER_FREQ = {
  e: 12, t: 9, a: 8, o: 7.5, i: 7, n: 6.7, s: 6.3, h: 6, r: 6, d: 4.2, l: 4, c: 2.8, u: 2.8, m: 2.4,
  w: 2.4, f: 2.2, g: 2, y: 2, p: 1.9, b: 1.5, v: 1, k: 0.8, j: 0.3, x: 0.3, q: 0.2, z: 0.2,
};

/** Small, fast seeded PRNG (used by the Daily Challenge so everyone gets the same letters). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Weighted sampling without replacement. items: [{ weight, ... }] */
function weightedSample(items, count, rng) {
  const pool = items.slice();
  const out = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((s, it) => s + it.weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function pickDecoys(exclude, count, rng) {
  if (count <= 0) return [];
  const candidates = [...ALPHABET]
    .filter((c) => !exclude.has(c))
    .map((char) => ({ char, weight: LETTER_FREQ[char] || 0.5 }));
  return weightedSample(candidates, count, rng).map((c) => c.char);
}

/**
 * Decide which tiles to spawn for the current prefix.
 * @param {object} o
 * @param {import('./trie.js').Trie} o.trie
 * @param {string} o.prefix
 * @param {[number,number]} o.decoyRange   min/max decoys for this difficulty
 * @param {string|null} o.requiredFirst    Word Chain: the first letter must be this
 * @param {() => number} o.rng
 * @param {number} o.minLen               shortest bankable word (2 in Simple Words, else 3)
 * @returns {{ tiles: {char:string, kind:'valid'|'decoy'|'check'}[], longest:number, chainBroken:boolean }}
 */
export function chooseLetters({ trie, prefix, decoyRange = [2, 2], requiredFirst = null, rng = Math.random, minLen = SP.minWordLength }) {
  const tiles = [];
  let chainBroken = false;

  if (prefix.length === 0) {
    const starts = trie.continuations('', minLen);
    const chainNode = requiredFirst && starts.find((s) => s.char === requiredFirst);

    if (chainNode) {
      // Word Chain: exactly one correct first letter plus decoys (at least 2 so it is a real choice).
      tiles.push({ char: requiredFirst, kind: 'valid' });
      const decoyCount = Math.max(2, randInt(rng, decoyRange[0], decoyRange[1]));
      for (const c of pickDecoys(new Set([requiredFirst]), decoyCount, rng)) tiles.push({ char: c, kind: 'decoy' });
    } else {
      if (requiredFirst) chainBroken = true; // no word starts with that letter: chain resets
      const count = randInt(rng, SP.firstSetMin, SP.firstSetMax);
      for (const s of weightedSample(starts, count, rng)) tiles.push({ char: s.char, kind: 'valid' });
    }
    return { tiles, longest: trie.root.maxDepth, chainBroken };
  }

  const node = trie.find(prefix);
  if (!node) return { tiles: [], longest: 0, chainBroken };

  const continuations = trie.continuations(prefix, minLen);
  const validCount = Math.min(continuations.length, randInt(rng, SP.validMin, SP.validMax));
  const valid = weightedSample(continuations, validCount, rng);
  for (const v of valid) tiles.push({ char: v.char, kind: 'valid' });

  const canBank = node.isWord && prefix.length >= minLen;
  if (canBank) tiles.push({ char: '✓', kind: 'check' });

  // Decoys must not be ANY child of the node (even ones we didn't spawn).
  const exclude = new Set(node.children.keys());
  const decoyCount = randInt(rng, decoyRange[0], decoyRange[1]);
  for (const c of pickDecoys(exclude, decoyCount, rng)) tiles.push({ char: c, kind: 'decoy' });

  return { tiles, longest: node.maxDepth, chainBroken };
}

const key = (x, y) => y * 1000 + x;

/** Cells reachable from the head without crossing the body, obstacles or walls. */
function reachableCells(size, head, blocked) {
  const seen = new Set();
  const queue = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const nx = head.x + dx;
    const ny = head.y + dy;
    if (nx >= 0 && ny >= 0 && nx < size && ny < size && !blocked.has(key(nx, ny))) {
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * Pick grid cells for `count` tiles.
 * @param {object} o
 * @param {number} o.count
 * @param {{x:number,y:number}[]} o.snake      snake cells, head first
 * @param {{x:number,y:number}} o.dir          current heading
 * @param {{x:number,y:number}[]} o.obstacles
 * @param {{x:number,y:number}[]} o.existing   other tiles already on the board
 * @param {() => number} o.rng
 * @returns {{x:number,y:number}[]}  may be shorter than count if the board is crowded
 */
export function placeTiles({ count, snake, dir, obstacles = [], existing = [], rng = Math.random }) {
  const size = CONFIG.grid.size;
  const head = snake[0];
  const blocked = new Set();
  for (const c of snake) blocked.add(key(c.x, c.y));
  for (const c of obstacles) blocked.add(key(c.x, c.y));

  const forbidden = new Set(blocked);
  for (let i = 1; i <= SP.aheadClearance; i++) forbidden.add(key(head.x + dir.x * i, head.y + dir.y * i));

  const reachable = reachableCells(size, head, blocked);
  const placed = [];
  const taken = existing.slice();
  const m = SP.edgeMargin;

  const farEnough = (x, y, spacing) =>
    taken.every((t) => Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) >= spacing);

  // Try with full spacing first, then relax if the board is crowded.
  for (const spacing of [SP.minSpacing, 1]) {
    let attempts = 0;
    while (placed.length < count && attempts < SP.placementAttempts) {
      attempts++;
      const x = randInt(rng, m, size - 1 - m);
      const y = randInt(rng, m, size - 1 - m);
      const k = key(x, y);
      if (forbidden.has(k) || !reachable.has(k)) continue;
      if (!farEnough(x, y, spacing)) continue;
      const cell = { x, y };
      placed.push(cell);
      taken.push(cell);
    }
    if (placed.length >= count) break;
  }
  return placed;
}
