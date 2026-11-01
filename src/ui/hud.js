// In-game heads-up display: score, lives, combo, timer, current word, hints,
// popups, toasts and the definition card.

import gsap from 'gsap';
import { CONFIG } from '../config.js';

const $ = (sel, root = document) => root.querySelector(sel);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export class Hud {
  constructor(root) {
    this.root = root;
    this.el = $('#hud', root);
    this.el.innerHTML = `
      <div class="hud-left glass">
        <div class="hud-label">SCORE</div>
        <div class="hud-score" id="hud-score">0</div>
        <div class="combo">
          <div class="combo-label">COMBO <span id="hud-combo-x">×0</span></div>
          <div class="combo-bar"><div class="combo-fill" id="hud-combo-fill"></div></div>
        </div>
        <div class="hud-powers" id="hud-powers"></div>
      </div>
      <div class="hud-center">
        <div class="hud-mode" id="hud-mode"></div>
        <div class="hud-word" id="hud-word"><span class="word-placeholder">Eat a letter!</span></div>
        <div class="hud-hint" id="hud-hint"></div>
      </div>
      <div class="hud-right glass">
        <div class="hud-lives" id="hud-lives"></div>
        <div class="hud-timer hidden" id="hud-timer">2:00</div>
        <button class="icon-btn" id="hud-pause" aria-label="Pause">⏸</button>
      </div>
      <div class="hud-banner" id="hud-banner"></div>
    `;
    this.scoreEl = $('#hud-score', this.el);
    this.comboX = $('#hud-combo-x', this.el);
    this.comboFill = $('#hud-combo-fill', this.el);
    this.modeEl = $('#hud-mode', this.el);
    this.wordEl = $('#hud-word', this.el);
    this.hintEl = $('#hud-hint', this.el);
    this.livesEl = $('#hud-lives', this.el);
    this.timerEl = $('#hud-timer', this.el);
    this.bannerEl = $('#hud-banner', this.el);
    this.pauseBtn = $('#hud-pause', this.el);
    this.powersEl = $('#hud-powers', this.el);
    this.powersKey = '';
    this.toasts = $('#toasts', root);
    this.card = $('#def-card', root);
    this.popups = $('#popups', root);
    this.tip = $('#tutorial-tip', root);
    this.displayScore = 0;
    this.colorblind = false;
    this.lastWord = '';
  }

  show() {
    this.el.classList.remove('hidden');
    const panels = this.el.querySelectorAll('.hud-left, .hud-center, .hud-right');
    gsap.fromTo(panels, { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.05 });
  }

  hide() {
    this.el.classList.add('hidden');
    this.hideTip();
  }

  setColorblind(on) {
    this.colorblind = on;
  }

  color(kind) {
    const c = CONFIG.colors;
    if (kind === 'valid') return this.colorblind ? c.validCB : c.valid;
    if (kind === 'invalid') return this.colorblind ? c.invalidCB : c.invalid;
    return this.colorblind ? c.pendingCB : c.pending;
  }

  setMode(name) {
    this.modeEl.textContent = name;
  }

  setScore(score, animate = true) {
    if (!animate) {
      this.displayScore = score;
      this.scoreEl.textContent = score;
      return;
    }
    const obj = { v: this.displayScore };
    gsap.to(obj, {
      v: score,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => (this.scoreEl.textContent = Math.round(obj.v)),
    });
    this.displayScore = score;
    gsap.fromTo(this.scoreEl, { scale: 1.35 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
  }

  setLives(lives, max = 3) {
    if (lives === Infinity) {
      this.livesEl.innerHTML = '<span class="heart inf">∞</span>';
      return;
    }
    let html = '';
    for (let i = 0; i < max; i++) html += `<span class="heart ${i < lives ? '' : 'lost'}">❤</span>`;
    this.livesEl.innerHTML = html;
  }

  loseLifeFx() {
    const hearts = this.livesEl.querySelectorAll('.heart.lost');
    const h = hearts[0];
    if (h) gsap.fromTo(h, { scale: 1.8, rotate: -20 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)' });
  }

  setCombo(combo) {
    this.comboX.textContent = `×${combo}`;
    const pct = Math.min(1, (combo * CONFIG.scoring.comboStep) / CONFIG.scoring.comboCap) * 100;
    gsap.to(this.comboFill, { width: `${pct}%`, duration: 0.4 });
    this.comboFill.classList.toggle('hot', combo >= 3);
    if (combo > 0) gsap.fromTo(this.comboX, { scale: 1.6 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
  }

  setTimer(seconds) {
    if (seconds == null) {
      this.timerEl.classList.add('hidden');
      return;
    }
    this.timerEl.classList.remove('hidden');
    const s = Math.max(0, Math.ceil(seconds));
    this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timerEl.classList.toggle('urgent', s <= 10);
  }

  /**
   * @param {string} word
   * @param {'empty'|'progress'|'bankable'|'invalid'} status
   */
  setWord(word, status = 'progress') {
    if (!word) {
      this.wordEl.innerHTML = `<span class="word-placeholder">${status === 'invalid' ? 'Oops!' : 'Eat a letter!'}</span>`;
      this.lastWord = '';
      return;
    }
    const color = status === 'bankable' ? this.color('valid') : status === 'invalid' ? this.color('invalid') : this.color('pending');
    this.wordEl.innerHTML = [...word.toUpperCase()]
      .map((ch) => `<span class="word-chip" style="--chip:${color}">${escapeHtml(ch)}</span>`)
      .join('');
    if (word.length > this.lastWord.length) {
      const last = this.wordEl.lastElementChild;
      gsap.fromTo(last, { y: -30, scale: 0.4, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(3)' });
    }
    if (status === 'bankable') this.wordEl.classList.add('bankable');
    else this.wordEl.classList.remove('bankable');
    this.lastWord = word;
  }

  breakWord() {
    const chips = [...this.wordEl.querySelectorAll('.word-chip')];
    chips.forEach((c) => (c.style.setProperty('--chip', this.color('invalid'))));
    gsap.to(chips, {
      y: () => 40 + Math.random() * 40,
      x: () => (Math.random() - 0.5) * 120,
      rotate: () => (Math.random() - 0.5) * 180,
      opacity: 0,
      duration: 0.7,
      ease: 'power2.in',
      onComplete: () => this.setWord('', 'empty'),
    });
  }

  /** Active power-ups: { slow: secondsLeft, hint: bool, double: bool } */
  setPowers({ slow = 0, hint = false, double = false }) {
    const key = `${Math.ceil(slow)}|${hint}|${double}`;
    if (key === this.powersKey) return;
    this.powersKey = key;
    const chips = [];
    if (slow > 0) chips.push(`<span class="power-chip" style="--pc:#5ee7ff">⏳ ${Math.ceil(slow)}s</span>`);
    if (hint) chips.push('<span class="power-chip" style="--pc:#ffe066">💡 Hint</span>');
    if (double) chips.push('<span class="power-chip" style="--pc:#ff9ff3">⭐ ×2</span>');
    this.powersEl.innerHTML = chips.join('');
  }

  setHint(text) {
    this.hintEl.textContent = text || '';
  }

  banner(text, { duration = 1.2, big = false } = {}) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.toggle('big', big);
    gsap.killTweensOf(this.bannerEl);
    gsap
      .timeline()
      .fromTo(this.bannerEl, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' })
      .to(this.bannerEl, { opacity: 0, scale: 1.1, duration: 0.3, delay: duration });
  }

  /** A "+N" chip that flies from a screen point into the score counter. */
  flyScore(x, y, text, onArrive) {
    const chip = document.createElement('div');
    chip.className = 'fly-chip';
    chip.textContent = text;
    chip.style.left = `${x}px`;
    chip.style.top = `${y}px`;
    this.popups.appendChild(chip);
    const r = this.scoreEl.getBoundingClientRect();
    gsap
      .timeline({
        onComplete: () => {
          chip.remove();
          if (onArrive) onArrive();
        },
      })
      .fromTo(chip, { scale: 0.4, opacity: 0 }, { scale: 1.2, opacity: 1, duration: 0.25, ease: 'back.out(3)' })
      .to(chip, { left: r.left + r.width / 2, top: r.top + r.height / 2, scale: 0.5, duration: 0.6, ease: 'power2.in', delay: 0.15 });
  }

  toast(emoji, title, desc) {
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.innerHTML = `<div class="toast-emoji">${emoji}</div><div><div class="toast-title">${escapeHtml(title)}</div><div class="toast-desc">${escapeHtml(desc)}</div></div>`;
    this.toasts.appendChild(t);
    gsap
      .timeline({ onComplete: () => t.remove() })
      .fromTo(t, { x: 320, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' })
      .to(t, { x: 320, opacity: 0, duration: 0.4, delay: 3 });
  }

  /** Definition card for a banked word. */
  defCard({ word, emoji, def, points, parts }) {
    const c = this.card;
    c.innerHTML = `
      <div class="card-emoji">${emoji || '📘'}</div>
      <div class="card-body">
        <div class="card-word">${escapeHtml(word.toUpperCase())} <span class="card-points">+${points}</span></div>
        ${def ? `<div class="card-def">${escapeHtml(def)}</div>` : ''}
        <div class="card-parts">${parts.map(escapeHtml).join(' · ')}</div>
      </div>`;
    gsap.killTweensOf(c);
    c.classList.remove('hidden');
    gsap
      .timeline({ onComplete: () => c.classList.add('hidden') })
      .fromTo(c, { y: 140, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.7)' })
      .to(c, { y: 140, opacity: 0, duration: 0.35, delay: CONFIG.bank.cardSeconds });
  }

  hideCard() {
    gsap.killTweensOf(this.card);
    this.card.classList.add('hidden');
  }

  showTip(html, step, total) {
    this.tip.innerHTML = `<div class="tip-step">Step ${step} of ${total}</div><div class="tip-text">${html}</div><button class="btn small ghost" data-action="skip-tutorial">Skip tutorial</button>`;
    this.tip.classList.remove('hidden');
    gsap.fromTo(this.tip, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
  }

  hideTip() {
    this.tip.classList.add('hidden');
  }
}
