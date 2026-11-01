import { CONFIG } from '../config.js';

const S = CONFIG.scoring;

export function letterValue(ch) {
  return S.letterValues[ch] || 1;
}

export function lengthMultiplier(len) {
  if (len >= 7) return S.lengthMultiplier[7];
  return S.lengthMultiplier[len] || 1;
}

/** Combo bonus as a fraction (0.1 per consecutive clean word, capped). */
export function comboBonus(combo) {
  return Math.min(combo * S.comboStep, S.comboCap);
}

/**
 * Score a banked word.
 * @param {object} p
 * @param {string} p.word
 * @param {number} p.combo        consecutive clean words banked before this one
 * @param {number} p.elapsed      seconds since the word's first letter was eaten
 * @param {boolean} p.chained     Word Chain mode: starts with previous word's last letter
 * @param {boolean} p.repeated    already banked this session
 * @returns {{ total:number, base:number, parts:string[] }}
 */
export function scoreWord({ word, combo = 0, elapsed = Infinity, chained = false, repeated = false }) {
  const base = [...word].reduce((sum, ch) => sum + letterValue(ch), 0);
  const lenMult = lengthMultiplier(word.length);
  const combo$ = comboBonus(combo);
  const speedy = elapsed <= S.speedBonusSeconds;

  let total = base * lenMult * (1 + combo$);
  const parts = [`${base} × ${lenMult}`];
  if (combo$ > 0) parts.push(`combo +${Math.round(combo$ * 100)}%`);
  if (speedy) {
    total *= 1 + S.speedBonus;
    parts.push(`speedy +${Math.round(S.speedBonus * 100)}%`);
  }
  if (chained) {
    total *= 1 + S.chainBonus;
    parts.push(`chain +${Math.round(S.chainBonus * 100)}%`);
  }
  if (repeated) {
    total *= S.repeatFactor;
    parts.push('repeat ×½');
  }
  return { total: Math.max(1, Math.round(total)), base, parts, speedy };
}
