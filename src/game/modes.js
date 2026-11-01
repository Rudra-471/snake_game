// Game mode + difficulty rules. The rest of the game asks the active ruleset what to do
// instead of hard-coding mode checks everywhere.

import { CONFIG } from '../config.js';

export const MODES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    emoji: '🐍',
    desc: 'Endless. 3 lives. Speeds up every 5 words.',
    hasDifficulty: true,
    lives: CONFIG.modes.classicLives,
    timeLimit: 0,
    chainRule: false,
    speedUp: true,
    kidsList: false,
  },
  timeattack: {
    id: 'timeattack',
    name: 'Time Attack',
    emoji: '⏱️',
    desc: '120 seconds, unlimited lives. Score big!',
    hasDifficulty: true,
    lives: Infinity,
    timeLimit: CONFIG.modes.timeAttackSeconds,
    chainRule: false,
    speedUp: false,
    kidsList: false,
  },
  chain: {
    id: 'chain',
    name: 'Word Chain',
    emoji: '🔗',
    desc: 'Each word starts with the last letter of the one before.',
    hasDifficulty: false,
    lives: CONFIG.modes.classicLives,
    timeLimit: 0,
    chainRule: true,
    speedUp: true,
    kidsList: false,
  },
  kids: {
    id: 'kids',
    name: 'Kids / Learn',
    emoji: '🧸',
    desc: 'Slow and gentle. Short words. Glowing hints. No game over.',
    hasDifficulty: false,
    lives: Infinity,
    timeLimit: 0,
    chainRule: false,
    speedUp: false,
    kidsList: true,
  },
};

export const DIFFICULTIES = {
  easy: { id: 'easy', name: 'Easy' },
  normal: { id: 'normal', name: 'Normal' },
  hard: { id: 'hard', name: 'Hard' },
};

/**
 * Build the concrete ruleset for a run.
 * @param {string} modeId
 * @param {string} difficulty easy | normal | hard
 * @param {object} extra { daily?: boolean, tutorial?: boolean }
 */
export function buildRules(modeId, difficulty = 'normal', extra = {}) {
  const mode = MODES[modeId] || MODES.classic;
  let diff = mode.hasDifficulty ? difficulty : 'normal';
  if (mode.id === 'kids') diff = 'kids';
  if (extra.daily) diff = 'normal';

  const rules = {
    mode: mode.id,
    modeName: extra.daily ? 'Daily Challenge' : extra.tutorial ? 'Tutorial' : mode.name,
    difficulty: diff,
    daily: !!extra.daily,
    tutorial: !!extra.tutorial,
    lives: mode.lives,
    timeLimit: mode.timeLimit,
    chainRule: mode.chainRule,
    speedUp: mode.speedUp,
    kidsList: mode.kidsList,
    decoyRange: CONFIG.spawn.decoys[diff] || CONFIG.spawn.decoys.normal,
    stepMs: CONFIG.speed[diff] || CONFIG.speed.normal,
    obstacles: diff === 'hard' ? CONFIG.obstacles.hard : 0,
    showHints: diff === 'kids',
    // What happens when you eat a decoy: 'bounce' | 'break' | 'gameover'
    onDecoy: diff === 'kids' ? 'bounce' : diff === 'hard' ? 'gameover' : 'break',
    // What happens when you hit a wall or yourself: 'respawn' | 'life' | 'gameover'
    onCrash: diff === 'hard' ? 'gameover' : mode.lives === Infinity ? 'respawn' : 'life',
  };

  if (extra.tutorial) {
    Object.assign(rules, {
      lives: Infinity,
      timeLimit: 0,
      chainRule: false,
      speedUp: false,
      decoyRange: [0, 0],
      stepMs: CONFIG.speed.tutorial,
      obstacles: 0,
      showHints: true,
      onDecoy: 'bounce',
      onCrash: 'respawn',
    });
  }
  return rules;
}
