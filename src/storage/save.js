// localStorage persistence. Every access is wrapped in try/catch so the game still
// runs in private windows or when storage is blocked (it just won't remember).

import { CONFIG } from '../config.js';

const KEY = 'word-serpent-save-v1';

export const DEFAULT_SAVE = () => ({
  highScores: { classic: 0, timeattack: 0, chain: 0, kids: 0 },
  daily: { date: '', best: 0 },
  totalXp: 0,
  totalScore: 0,
  level: 1,
  unlockedWorlds: ['jungle'],
  unlockedSkins: ['jungle'],
  worldsPlayed: [],
  selectedWorld: 'jungle',
  selectedSkin: 'jungle',
  selectedMode: 'classic',
  selectedDifficulty: 'normal',
  discovered: {}, // word -> times banked
  achievements: {},
  tutorialDone: false,
  stats: { games: 0, words: 0, letters: 0, mistakes: 0 },
  settings: {
    music: CONFIG.audio.defaultMusic,
    sfx: CONFIG.audio.defaultSfx,
    speech: true,
    quality: null, // null = auto-detect on first run
    speed: 'normal',
    colorblind: false,
    dyslexia: false,
    intro: true,
  },
});

function merge(defaults, saved) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
  if (!saved || typeof saved !== 'object') return defaults;
  const out = { ...defaults };
  for (const k of Object.keys(saved)) {
    const d = defaults[k];
    out[k] = d && typeof d === 'object' && !Array.isArray(d) ? merge(d, saved[k]) : saved[k];
  }
  return out;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SAVE();
    return merge(DEFAULT_SAVE(), JSON.parse(raw));
  } catch (e) {
    return DEFAULT_SAVE();
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
  return DEFAULT_SAVE();
}

export function xpForLevel(level) {
  return CONFIG.levelXp * level * (level - 1);
}

export function levelFromXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}
