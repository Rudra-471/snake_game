// HTML overlay screens. Everything is rendered from templates into #screens and
// wired with event delegation (data-action attributes).

import gsap from 'gsap';
import { CONFIG } from '../config.js';
import { MODES, MATH_MODES, DIFFICULTIES } from '../game/modes.js';
import { SKINS } from '../game/snake.js';
import { DICTIONARY_WORDS, WORD_INFO, THEME_LABELS } from '../core/wordlists.js';
import { xpForLevel } from '../storage/save.js';
import { todayKey } from '../core/spawner.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const ACHIEVEMENTS = [
  { id: 'firstWord', emoji: '🌟', name: 'First Word', desc: 'Bank your very first word.' },
  { id: 'five', emoji: '🖐️', name: '5-Letter Word', desc: 'Bank a word with 5 letters.' },
  { id: 'seven', emoji: '🏆', name: '7-Letter Word', desc: 'Bank a word with 7 or more letters.' },
  { id: 'chain10', emoji: '🔗', name: '10-Word Chain', desc: 'Link 10 words in one Word Chain game.' },
  { id: 'combo5', emoji: '🔥', name: 'Combo ×5', desc: 'Bank 5 words in a row with no mistakes.' },
  { id: 'words100', emoji: '📚', name: '100 Words Discovered', desc: 'Discover 100 different words.' },
  { id: 'allWorlds', emoji: '🌍', name: 'Play Every World', desc: 'Play a game in all 6 worlds.' },
];

export class Menus {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.el = root.querySelector('#screens');
    this.current = null;
    this.returnTo = 'main';
    this.dictTheme = 'all';
    this.pendingMode = null;
    this.lastGameOver = null;

    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('change', (e) => this.onInput(e));
    this.el.addEventListener('pointerenter', (e) => {
      if (e.target.classList && e.target.classList.contains('btn')) this.game.sfx.hover();
    }, true);
  }

  get save() {
    return this.game.save;
  }

  show(name, data) {
    const builders = {
      home: () => this.homeHtml(),
      main: () => this.mainHtml(),
      modes: () => this.modesHtml(),
      worlds: () => this.worldsHtml(),
      skins: () => this.skinsHtml(),
      dictionary: () => this.dictionaryHtml(),
      settings: () => this.settingsHtml(),
      pause: () => this.pauseHtml(),
      gameover: () => this.gameOverHtml(data || this.lastGameOver),
      achievements: () => this.achievementsHtml(),
    };
    if (name === 'gameover' && data) this.lastGameOver = data;
    this.current = name;
    this.el.innerHTML = `<div class="screen screen-${name}">${builders[name]()}</div>`;
    this.el.classList.remove('hidden');
    const screen = this.el.firstElementChild;
    gsap.fromTo(screen, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    const items = screen.querySelectorAll('.anim-in');
    if (items.length) gsap.fromTo(items, { opacity: 0, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.04, ease: 'back.out(1.6)', delay: 0.05 });
    if (name === 'gameover') this.animateGameOver(data || this.lastGameOver);
  }

  hide() {
    this.current = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  // ---------- templates ----------

  backBtn() {
    return `<button class="btn ghost back" data-action="back">← Back</button>`;
  }

  levelChip() {
    const s = this.save;
    const cur = xpForLevel(s.level);
    const next = xpForLevel(s.level + 1);
    const pct = Math.min(100, ((s.totalXp - cur) / (next - cur)) * 100);
    return `<div class="level-chip glass"><span class="lv">Lv ${s.level}</span><div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div><span class="xp-text">${s.totalXp - cur}/${next - cur} XP</span></div>`;
  }

  /** First screen: pick English (word games) or one of the 5 math games. */
  homeHtml() {
    const s = this.save;
    const logo = [...'WORD'].map((c, i) => `<span class="logo-tile t${i}">${c}</span>`).join('');
    const math = Object.values(MATH_MODES)
      .map(
        (m) => `
        <button class="mode-card glass anim-in home-math" data-action="math" data-value="${m.id}">
          <div class="mode-emoji">${m.emoji}</div>
          <div class="mode-name">${esc(m.name)}</div>
          <div class="mode-desc">${esc(m.desc)}</div>
          <div class="mode-best">Best: ${s.highScores[m.id] || 0}</div>
        </button>`
      )
      .join('');
    return `
      <div class="menu-top">${this.levelChip()}
        <button class="btn glass chip-btn" data-action="nav" data-to="settings">⚙️</button>
      </div>
      <div class="logo anim-in small">${logo}<div class="logo-sub">SERPENT</div></div>
      <h2 class="screen-title anim-in">What do you want to play?</h2>
      <div class="home-section anim-in">🔤 English</div>
      <div class="mode-grid home-grid single">
        <button class="mode-card glass anim-in home-words" data-action="nav" data-to="main">
          <div class="mode-emoji">📖</div>
          <div class="mode-name">Word Games</div>
          <div class="mode-desc">Spell real words: Classic, Time Attack, Word Chain, Kids and Simple Words.</div>
        </button>
      </div>
      <div class="home-section anim-in">🔢 Math</div>
      <div class="mode-grid home-grid">${math}</div>
      <div class="menu-footer">Numbers 0–100 · 3 lives · Arrows / WASD or swipe to steer</div>`;
  }

  mainHtml() {
    const s = this.save;
    const mode = MODES[s.selectedMode] || MODES.classic;
    const diff = mode.hasDifficulty ? ` · ${DIFFICULTIES[s.selectedDifficulty].name}` : '';
    const daily = s.daily.date === todayKey() ? s.daily.best : 0;
    const logo = [...'WORD'].map((c, i) => `<span class="logo-tile t${i}">${c}</span>`).join('');
    return `
      <button class="btn ghost back" data-action="nav" data-to="home">← All games</button>
      <div class="menu-top">${this.levelChip()}
        <button class="btn glass chip-btn" data-action="achievements">🏅 ${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}</button>
      </div>
      <div class="menu-center">
        <div class="logo anim-in">${logo}<div class="logo-sub">SERPENT</div></div>
        <div class="tagline anim-in">Slither · Spell · Shine</div>
        <button class="btn primary big anim-in" data-action="play">▶ Play<small>${esc(mode.name)}${diff}</small></button>
        <button class="btn daily anim-in" data-action="daily">🌞 Daily Challenge <small>${daily ? `Best today: ${daily}` : 'Same letters for everyone today'}</small></button>
        <div class="menu-grid">
          <button class="btn glass anim-in" data-action="nav" data-to="modes">🎮<span>Modes</span></button>
          <button class="btn glass anim-in" data-action="nav" data-to="worlds">🌍<span>Worlds</span></button>
          <button class="btn glass anim-in" data-action="nav" data-to="skins">🎨<span>Skins</span></button>
          <button class="btn glass anim-in" data-action="nav" data-to="dictionary">📖<span>Dictionary</span></button>
          <button class="btn glass anim-in" data-action="nav" data-to="settings">⚙️<span>Settings</span></button>
        </div>
      </div>
      <div class="menu-footer">Arrows / WASD to steer · Swipe or D-pad on mobile · P / Esc to pause</div>`;
  }

  modesHtml() {
    const s = this.save;
    const cards = Object.values(MODES)
      .map(
        (m) => `
        <button class="mode-card glass anim-in ${s.selectedMode === m.id ? 'selected' : ''}" data-action="pick-mode" data-value="${m.id}">
          <div class="mode-emoji">${m.emoji}</div>
          <div class="mode-name">${esc(m.name)}</div>
          <div class="mode-desc">${esc(m.desc)}</div>
          <div class="mode-best">Best: ${s.highScores[m.id] || 0}</div>
        </button>`
      )
      .join('');
    const diffs = Object.values(DIFFICULTIES)
      .map((d) => `<button class="seg ${s.selectedDifficulty === d.id ? 'on' : ''}" data-action="pick-diff" data-value="${d.id}">${d.name}</button>`)
      .join('');
    const mode = MODES[s.selectedMode];
    return `
      ${this.backBtn()}
      <h2 class="screen-title">Choose a Mode</h2>
      <div class="mode-grid">${cards}</div>
      <div class="diff-row ${mode.hasDifficulty ? '' : 'disabled'}">
        <span>Difficulty</span><div class="segmented">${diffs}</div>
      </div>
      <div class="diff-note">${mode.hasDifficulty ? 'Easy: 1 decoy · Normal: 2 decoys · Hard: 3 decoys, obstacles, one mistake ends it' : `${esc(mode.name)} uses its own gentle rules.`}</div>
      <button class="btn primary big anim-in" data-action="play">▶ Start ${esc(mode.name)}</button>`;
  }

  worldsHtml() {
    const s = this.save;
    const cards = CONFIG.worlds
      .map((w) => {
        const unlocked = s.unlockedWorlds.includes(w.id);
        const sel = s.selectedWorld === w.id;
        return `
        <button class="world-card glass anim-in world-${w.id} ${sel ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-action="${unlocked ? 'pick-world' : 'locked'}" data-value="${w.id}">
          <div class="world-emoji">${unlocked ? w.emoji : '🔒'}</div>
          <div class="world-name">${esc(w.name)}</div>
          <div class="world-state">${unlocked ? (sel ? 'Selected' : s.worldsPlayed.includes(w.id) ? 'Played ✓' : 'Tap to visit') : `Reach level ${w.level}`}</div>
        </button>`;
      })
      .join('');
    return `${this.backBtn()}<h2 class="screen-title">Worlds</h2><div class="world-grid">${cards}</div>`;
  }

  skinsHtml() {
    const s = this.save;
    const cards = CONFIG.skins
      .map((k) => {
        const unlocked = s.unlockedSkins.includes(k.id);
        const sel = s.selectedSkin === k.id;
        const c = SKINS[k.id];
        return `
        <button class="skin-card glass anim-in ${sel ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-action="${unlocked ? 'pick-skin' : 'locked'}" data-value="${k.id}">
          <div class="skin-swatch skin-${k.id}" style="--a:${c.a};--b:${c.b};--h:${c.head}">
            <span></span><span></span><span></span><span class="skin-head">••</span>
          </div>
          <div class="skin-name">${esc(k.name)}</div>
          <div class="skin-state">${unlocked ? (sel ? 'Wearing' : 'Tap to wear') : `🔒 ${k.unlock} total points`}</div>
        </button>`;
      })
      .join('');
    return `${this.backBtn()}<h2 class="screen-title">Skins</h2><div class="skin-note">Lifetime points: ${s.totalScore}</div><div class="skin-grid">${cards}</div>`;
  }

  dictionaryHtml() {
    const s = this.save;
    const found = Object.keys(s.discovered).sort();
    const themes = ['all', ...Object.keys(THEME_LABELS)];
    const tabs = themes
      .map((t) => `<button class="seg ${this.dictTheme === t ? 'on' : ''}" data-action="dict-theme" data-value="${t}">${t === 'all' ? 'All' : THEME_LABELS[t]}</button>`)
      .join('');
    const list = found.filter((w) => this.dictTheme === 'all' || (WORD_INFO.get(w) && WORD_INFO.get(w).theme === this.dictTheme));
    const cards = list.length
      ? list
          .map((w) => {
            const info = WORD_INFO.get(w);
            return `<button class="dict-card glass" data-action="speak" data-value="${esc(w)}">
              <div class="dict-emoji">${info ? info.emoji : `<span class="dict-letter">${esc(w[0].toUpperCase())}</span>`}</div>
              <div class="dict-word">${esc(w)} <span class="dict-count">×${s.discovered[w]}</span></div>
              ${info && info.def ? `<div class="dict-def">${esc(info.def)}</div>` : ''}
              <div class="dict-speak">🔊</div>
            </button>`;
          })
          .join('')
      : `<div class="dict-empty">No words here yet — go spell some! 🐍</div>`;
    return `${this.backBtn()}
      <h2 class="screen-title">Dictionary</h2>
      <div class="dict-progress">${found.length} / ${DICTIONARY_WORDS.length} words discovered</div>
      <div class="segmented tabs">${tabs}</div>
      <div class="dict-grid">${cards}</div>`;
  }

  settingsHtml() {
    const st = this.save.settings;
    const seg = (key, options) =>
      `<div class="segmented">${options.map(([v, label]) => `<button class="seg ${st[key] === v ? 'on' : ''}" data-action="setting" data-key="${key}" data-value="${v}">${label}</button>`).join('')}</div>`;
    const toggle = (key) => `<label class="toggle"><input type="checkbox" data-setting="${key}" ${st[key] ? 'checked' : ''}><span></span></label>`;
    return `${this.backBtn()}
      <h2 class="screen-title">Settings</h2>
      <div class="settings glass">
        <div class="set-row"><span>🎵 Music</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-setting="music"></div>
        <div class="set-row"><span>🔔 Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-setting="sfx"></div>
        <div class="set-row"><span>🗣️ Speak words aloud</span>${toggle('speech')}</div>
        <div class="set-row"><span>✨ Graphics</span>${seg('quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])}</div>
        <div class="set-row"><span>🐍 Snake speed</span>${seg('speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']])}</div>
        <div class="set-row"><span>🎨 Colorblind-safe colors</span>${toggle('colorblind')}</div>
        <div class="set-row"><span>🔤 Dyslexia-friendly text</span>${toggle('dyslexia')}</div>
        <div class="set-row"><span>🎬 Play intro movie on start</span>${toggle('intro')}</div>
      </div>
      <div class="settings-actions">
        <button class="btn glass" data-action="replay-tutorial">🎓 Replay tutorial</button>
        <button class="btn glass" data-action="unlock-all">🔓 Parent / teacher: unlock all</button>
        <button class="btn danger" data-action="reset">🗑️ Reset progress</button>
      </div>`;
  }

  pauseHtml() {
    return `
      <div class="pause-box glass">
        <h2 class="screen-title">Paused</h2>
        <button class="btn primary big anim-in" data-action="resume">▶ Resume</button>
        <button class="btn glass anim-in" data-action="restart">↻ Restart</button>
        <button class="btn glass anim-in" data-action="pause-settings">⚙️ Settings</button>
        <button class="btn ghost anim-in" data-action="quit">⌂ Quit to menu</button>
      </div>`;
  }

  achievementsHtml() {
    const got = this.save.achievements;
    const cards = ACHIEVEMENTS.map(
      (a) => `<div class="ach-card glass anim-in ${got[a.id] ? 'got' : ''}">
        <div class="ach-emoji">${got[a.id] ? a.emoji : '🔒'}</div>
        <div><div class="ach-name">${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div></div>
      </div>`
    ).join('');
    return `${this.backBtn()}<h2 class="screen-title">Achievements</h2><div class="ach-grid">${cards}</div>`;
  }

  gameOverHtml(d) {
    if (!d) return '';
    const unlocks = d.unlocks.length
      ? `<div class="go-unlocks">${d.unlocks.map((u) => `<div class="unlock-pill anim-in">🔓 ${esc(u)}</div>`).join('')}</div>`
      : '';
    return `
      <div class="go-box glass">
        <h2 class="go-title ${d.newHigh ? 'rainbow' : ''}">${esc(d.title)}</h2>
        ${d.newHigh ? '<div class="go-newhigh anim-in">🎉 New High Score! 🎉</div>' : ''}
        <div class="go-score" id="go-score">0</div>
        <div class="go-stats">
          <div class="stat anim-in"><div class="stat-v">${d.words}</div><div class="stat-l">${d.math ? 'Rounds done' : 'Words made'}</div></div>
          ${d.math
            ? `<div class="stat anim-in"><div class="stat-v">${d.correct}</div><div class="stat-l">Correct numbers</div></div>`
            : `<div class="stat anim-in"><div class="stat-v">${esc(d.longest ? d.longest.toUpperCase() : '—')}</div><div class="stat-l">Longest word</div></div>`}
          <div class="stat anim-in"><div class="stat-v">${d.accuracy}%</div><div class="stat-l">Accuracy</div></div>
          <div class="stat anim-in"><div class="stat-v">+${d.xp}</div><div class="stat-l">XP gained</div></div>
        </div>
        <div class="go-level anim-in">
          <span>Lv ${d.level}</span>
          <div class="xp-bar wide"><div class="xp-fill" id="go-xp" style="width:${d.xpFrom}%"></div></div>
          ${d.levelUp ? '<span class="level-up">LEVEL UP!</span>' : ''}
        </div>
        ${unlocks}
        <div class="go-best">Best: ${d.best}</div>
        <div class="go-actions">
          <button class="btn primary big anim-in" data-action="restart">↻ Play again</button>
          <button class="btn glass anim-in" data-action="quit">⌂ Menu</button>
        </div>
      </div>`;
  }

  animateGameOver(d) {
    if (!d) return;
    const scoreEl = this.el.querySelector('#go-score');
    const obj = { v: 0 };
    gsap.to(obj, { v: d.score, duration: 1.4, ease: 'power2.out', delay: 0.3, onUpdate: () => (scoreEl.textContent = Math.round(obj.v)) });
    const xp = this.el.querySelector('#go-xp');
    if (xp) gsap.to(xp, { width: `${d.xpTo}%`, duration: 1.2, delay: 0.8, ease: 'power2.out' });
    if (d.newHigh) {
      const box = this.el.querySelector('.go-box');
      for (let i = 0; i < 40; i++) {
        const c = document.createElement('div');
        c.className = 'dom-confetti';
        c.style.left = `${Math.random() * 100}%`;
        c.style.background = ['#ff5d8f', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'][i % 5];
        box.appendChild(c);
        gsap.fromTo(c, { y: -20, rotate: 0, opacity: 1 }, { y: 420 + Math.random() * 200, rotate: Math.random() * 720, opacity: 0, duration: 2 + Math.random() * 1.5, delay: Math.random() * 0.6, ease: 'power1.in', onComplete: () => c.remove() });
      }
    }
  }

  // ---------- events ----------

  onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, value, to, key } = btn.dataset;
    const g = this.game;
    g.sfx.unlock();
    g.sfx.click();
    switch (action) {
      case 'nav':
        this.returnTo = this.current === 'home' ? 'home' : 'main';
        this.show(to);
        break;
      case 'back':
        this.show(this.current === 'settings' && (this.returnTo === 'pause' || this.returnTo === 'home') ? this.returnTo : 'main');
        break;
      case 'play':
        g.startRun({ mode: this.save.selectedMode, difficulty: this.save.selectedDifficulty });
        break;
      case 'math':
        g.startRun({ mode: value });
        break;
      case 'daily':
        g.startRun({ mode: 'classic', difficulty: 'normal', daily: true });
        break;
      case 'pick-mode':
        this.save.selectedMode = value;
        g.persist();
        this.show('modes');
        break;
      case 'pick-diff':
        if (!MODES[this.save.selectedMode].hasDifficulty) break;
        this.save.selectedDifficulty = value;
        g.persist();
        this.show('modes');
        break;
      case 'pick-world':
        g.selectWorld(value);
        this.show('worlds');
        break;
      case 'pick-skin':
        g.selectSkin(value);
        this.show('skins');
        break;
      case 'locked':
        g.sfx.error();
        gsap.fromTo(btn, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
        break;
      case 'dict-theme':
        this.dictTheme = value;
        this.show('dictionary');
        break;
      case 'speak':
        g.speakWord(value);
        gsap.fromTo(btn, { scale: 0.92 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
        break;
      case 'setting':
        g.updateSetting(key, value);
        this.show('settings');
        break;
      case 'replay-tutorial':
        g.startRun({ mode: 'classic', difficulty: 'normal', tutorial: true });
        break;
      case 'unlock-all':
        g.unlockAll();
        btn.textContent = '✅ Everything unlocked';
        break;
      case 'reset':
        if (btn.dataset.confirm) {
          g.resetProgress();
          this.show('settings');
        } else {
          btn.dataset.confirm = '1';
          btn.textContent = '⚠️ Tap again to erase everything';
        }
        break;
      case 'achievements':
        this.returnTo = 'main';
        this.show('achievements');
        break;
      case 'resume':
        g.resume();
        break;
      case 'restart':
        g.restart();
        break;
      case 'pause-settings':
        this.returnTo = 'pause';
        this.show('settings');
        break;
      case 'quit':
        g.quitToMenu();
        break;
      default:
        break;
    }
  }

  onInput(e) {
    const key = e.target.dataset && e.target.dataset.setting;
    if (!key) return;
    const value = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
    this.game.updateSetting(key, value);
  }
}
