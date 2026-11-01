// All tunable numbers for Word Serpent live here.

export const CONFIG = {
  grid: {
    size: 20, // cells per side
    cell: 1, // world units per cell
  },

  snake: {
    baseLength: 3,
    maxSegments: 220, // size of the segment visual pool (banked words stay on the body)
    startDir: { x: 0, y: -1 },
    taperPerSegment: 0.012, // scale lost per segment toward the tail
    minScale: 0.72,
    headScale: 1.18,
    dustEverySteps: 2,
  },

  // Milliseconds per grid step (lower = faster)
  speed: {
    easy: 240,
    normal: 205,
    hard: 170,
    kids: 300,
    tutorial: 300,
    menu: 230,
    speedUpEveryWords: 5,
    speedUpFactor: 0.965,
    minStepMs: 120,
    settingMultiplier: { slow: 1.25, normal: 1, fast: 0.82 },
  },

  spawn: {
    firstSetMin: 4,
    firstSetMax: 5,
    validMin: 2,
    validMax: 3,
    decoys: { kids: [0, 1], easy: [1, 1], normal: [2, 2], hard: [3, 3] },
    minWordLength: 3,
    aheadClearance: 2, // no tiles this many cells directly ahead of the head
    minSpacing: 2, // Chebyshev distance between tiles
    edgeMargin: 0, // cells from the wall that tiles avoid
    tileLifetime: 15, // seconds before an uneaten tile hops elsewhere
    placementAttempts: 400,
  },

  scoring: {
    letterValues: {
      a: 1, e: 1, i: 1, o: 1, u: 1, l: 1, n: 1, s: 1, t: 1, r: 1,
      d: 2, g: 2,
      b: 3, c: 3, m: 3, p: 3,
      f: 4, h: 4, v: 4, w: 4, y: 4,
      k: 5,
      j: 8, x: 8,
      q: 10, z: 10,
    },
    lengthMultiplier: { 3: 1, 4: 1.5, 5: 2, 6: 3, 7: 4 }, // 7+ uses 7
    comboStep: 0.1,
    comboCap: 1.0,
    speedBonusSeconds: 8,
    speedBonus: 0.2,
    chainBonus: 0.5,
    repeatFactor: 0.5,
    kidsDecoyPenalty: 5,
    xpPerWord: 5,
  },

  modes: {
    classicLives: 3,
    timeAttackSeconds: 120,
    respawnDelay: 1.1, // seconds of "get ready" after losing a life
  },

  bank: {
    slowMoSeconds: 0.4,
    slowMoScale: 0.15,
    freezeSeconds: 1.25,
    cardSeconds: 2.5,
  },

  camera: {
    fov: 50,
    tiltDeg: 55,
    baseDistance: 17,
    zoomPerSegment: 0.35,
    maxExtraZoom: 7,
    followLerp: 3.2,
    lookAhead: 1.6,
    shakeDecay: 1.8,
    menuDistance: 24,
  },

  graphics: {
    low: { shadows: false, bloom: false, pixelRatio: 1, shadowMapSize: 512, particles: 0.5 },
    medium: { shadows: true, bloom: true, pixelRatio: 1.5, shadowMapSize: 1024, particles: 0.8 },
    high: { shadows: true, bloom: true, pixelRatio: 2, shadowMapSize: 2048, particles: 1 },
  },

  particles: {
    shardPool: 700,
    dustPool: 160,
    gravity: -14,
  },

  colors: {
    valid: '#5ef08a',
    invalid: '#ff6b6b',
    pending: '#ffd166',
    // Colorblind-safe alternatives (blue / orange)
    validCB: '#4aa8ff',
    invalidCB: '#ff9f1c',
    pendingCB: '#f5f5f5',
    tilePastels: ['#ffb3c7', '#b5e8ff', '#c9f7b5', '#ffe5a3', '#d8c6ff', '#ffcfa8'],
    letterInk: '#2b2240',
    gold: '#ffc23d',
    crystal: '#7ff9ff',
  },

  font: {
    urls: [
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r186/examples/fonts/helvetiker_bold.typeface.json',
      'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json',
      'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
    ],
    letterSize: 0.46,
    letterDepth: 0.09,
  },

  // Skins unlock by lifetime total score
  skins: [
    { id: 'jungle', name: 'Jungle Green', unlock: 0 },
    { id: 'ruby', name: 'Ruby Dragon', unlock: 150 },
    { id: 'robot', name: 'Robot Chrome', unlock: 400 },
    { id: 'candy', name: 'Candy Pop', unlock: 800 },
    { id: 'galaxy', name: 'Galaxy', unlock: 1500 },
  ],

  // Worlds unlock by player level
  worlds: [
    { id: 'jungle', name: 'Jungle', level: 1, emoji: '🌴' },
    { id: 'beach', name: 'Beach', level: 2, emoji: '🏖️' },
    { id: 'neon', name: 'Neon City', level: 3, emoji: '🌃' },
    { id: 'ice', name: 'Ice Land', level: 4, emoji: '❄️' },
    { id: 'space', name: 'Space', level: 5, emoji: '🪐' },
    { id: 'candy', name: 'Candy', level: 6, emoji: '🍭' },
  ],

  // XP needed to reach level L is levelXp * L * (L - 1)
  levelXp: 60,

  obstacles: { hard: 6 },

  powerups: {
    chance: 0.18, // per letter set
    slowSeconds: 8,
    slowFactor: 1.6, // step interval multiplier while slowed
    types: ['slow', 'hint', 'double'],
  },

  audio: {
    gameBpm: 100,
    menuBpm: 78,
    defaultMusic: 0.5,
    defaultSfx: 0.8,
  },
};

export const RARE_LETTERS = new Set(['j', 'q', 'x', 'z', 'k']);
