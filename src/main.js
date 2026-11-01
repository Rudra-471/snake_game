// Word Serpent — boot, renderer, fixed-timestep game loop and game rules.

import './ui/styles.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { CONFIG } from './config.js';
import { Trie } from './core/trie.js';
import { chooseLetters, placeTiles, mulberry32, seedFromString, todayKey } from './core/spawner.js';
import { scoreWord } from './core/scoring.js';
import { WORDS, KIDS_WORDS, TUTORIAL_WORDS, getWordInfo } from './core/wordlists.js';
import { StateMachine, STATES } from './game/state.js';
import { buildRules } from './game/modes.js';
import { initGlyphs } from './game/glyphs.js';
import { Arena } from './game/arena.js';
import { Snake } from './game/snake.js';
import { TileManager, POWER_INFO } from './game/letterTile.js';
import { Intro } from './game/intro.js';
import { WordChain } from './game/chain.js';
import { Particles } from './fx/particles.js';
import { CameraRig } from './fx/camera.js';
import { PostFX, detectDefaultQuality } from './fx/postfx.js';
import { LetterFlyer, ScorePopups } from './fx/popups.js';
import { sfx } from './audio/sfx.js';
import { speech } from './audio/speech.js';
import { Hud } from './ui/hud.js';
import { Menus, ACHIEVEMENTS } from './ui/menus.js';
import { loadSave, writeSave, resetSave, levelFromXp, xpForLevel } from './storage/save.js';

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const START_CELL = { x: Math.floor(CONFIG.grid.size / 2), y: Math.floor(CONFIG.grid.size / 2) + 2 };
// Hard-mode obstacle layout (kept off the starting column)
const OBSTACLE_LAYOUT = [
  { x: 4, y: 4 }, { x: 15, y: 4 }, { x: 4, y: 15 }, { x: 15, y: 15 }, { x: 6, y: 9 }, { x: 13, y: 9 },
];
const TUTORIAL_STEPS = 3;

class Game {
  constructor() {
    this.save = loadSave();
    if (!this.save.settings.quality) this.save.settings.quality = detectDefaultQuality();
    this.sfx = sfx;
    this.state = new StateMachine(STATES.MENU);
    this.run = null;
    this.timers = [];
    this.timeScale = 1;
    this.time = 0;
    this.acc = 0;
    this.last = performance.now();
    this.menuStepMs = CONFIG.speed.menu;
    this.pausedFrom = null;
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._v = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.menuLook = null;
    this.introPlaying = false;
  }

  // =====================================================================
  // Boot
  // =====================================================================

  async init() {
    const canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // three r183+ folded PCFSoftShadowMap into PCFShadowMap, which now filters softly.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();

    this.sun = new THREE.DirectionalLight('#ffffff', 2.5);
    this.sun.position.set(9, 20, 12);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -15;
    sc.right = sc.top = 15;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#445533', 1);
    this.scene.add(this.hemi);

    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.postfx = new PostFX(this.renderer, this.scene, this.rig.camera);

    await initGlyphs();

    this.tries = {
      full: new Trie(WORDS),
      kids: new Trie(KIDS_WORDS),
      tutorial: new Trie(TUTORIAL_WORDS),
    };

    this.arena = new Arena(this.scene, this.renderer, this.sun, this.hemi);
    this.particles = new Particles(this.scene);
    this.snake = new Snake(this.scene);
    this.tiles = new TileManager(this.scene, this.arena);
    this.chain = new WordChain(this.scene);
    this.flyer = new LetterFlyer(this.scene);
    this.popups = new ScorePopups(this.scene);

    const ui = document.getElementById('ui');
    this.hud = new Hud(ui);
    this.menus = new Menus(ui, this);

    this.applyAllSettings();
    this.arena.build(this.save.selectedWorld, this.postfx);
    this.snake.setSkin(this.save.selectedSkin);
    this.snake.reset(START_CELL);
    this.bindInput();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => this.onVisibility());

    // Compile shaders up front so the first frames don't hitch
    this.renderer.compile(this.scene, this.rig.camera);

    const loading = document.getElementById('loading');
    gsap.to(loading, { opacity: 0, duration: 0.5, onComplete: () => loading.remove() });
    requestAnimationFrame((t) => this.frame(t));

    if (this.save.settings.intro) {
      // Movie-style opening (its gate click also unlocks audio)
      this.introPlaying = true;
      this.intro = new Intro(this);
      await this.intro.play();
      this.introPlaying = false;
      sfx.setMusicMode('menu');
      sfx.startMusic(0.4);
    }
    this.menus.show('main');
  }

  // =====================================================================
  // Settings & persistence
  // =====================================================================

  persist() {
    writeSave(this.save);
  }

  applyAllSettings() {
    const st = this.save.settings;
    sfx.setVolumes(st.music, st.sfx);
    speech.enabled = st.speech;
    this.postfx.setQuality(st.quality, this.sun);
    this.particles.setQuality(CONFIG.graphics[this.postfx.quality].particles);
    this.hud.setColorblind(st.colorblind);
    this.tiles.colorblind = st.colorblind;
    this.tiles.letterScale = st.dyslexia ? 1.2 : 1;
    document.body.classList.toggle('dyslexia', !!st.dyslexia);
    document.body.classList.toggle('colorblind', !!st.colorblind);
  }

  updateSetting(key, value) {
    const st = this.save.settings;
    st[key] = value;
    if (key === 'music' || key === 'sfx') sfx.setVolumes(st.music, st.sfx);
    if (key === 'speech') {
      speech.enabled = value;
      if (value) speech.say('Hello!', { force: true });
    }
    if (key === 'quality') {
      this.postfx.setQuality(value, this.sun);
      this.particles.setQuality(CONFIG.graphics[this.postfx.quality].particles);
    }
    if (key === 'speed' && this.run) this.recomputeStep();
    if (key === 'colorblind' || key === 'dyslexia') this.applyAllSettings();
    this.persist();
  }

  selectWorld(id) {
    if (!this.save.unlockedWorlds.includes(id)) return;
    this.save.selectedWorld = id;
    this.arena.build(id, this.postfx);
    this.persist();
  }

  selectSkin(id) {
    if (!this.save.unlockedSkins.includes(id)) return;
    this.save.selectedSkin = id;
    this.snake.setSkin(id);
    this.snake.squash();
    this.persist();
  }

  unlockAll() {
    this.save.unlockedWorlds = CONFIG.worlds.map((w) => w.id);
    this.save.unlockedSkins = CONFIG.skins.map((s) => s.id);
    this.persist();
    this.hud.toast('🔓', 'Everything unlocked', 'All worlds and skins are now available.');
  }

  resetProgress() {
    const settings = this.save.settings;
    this.save = resetSave();
    this.save.settings = settings;
    this.persist();
    this.arena.build(this.save.selectedWorld, this.postfx);
    this.snake.setSkin(this.save.selectedSkin);
  }

  speakWord(word) {
    speech.say(word, { force: true });
  }

  // =====================================================================
  // Input
  // =====================================================================

  bindInput() {
    window.addEventListener('keydown', (e) => {
      sfx.unlock();
      const dir = KEYMAP[e.code];
      if (dir) {
        e.preventDefault();
        this.turn(dir);
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        this.togglePause();
      }
      if ((e.code === 'Enter' || e.code === 'Space') && this.state.is(STATES.MENU) && this.menus.current === 'main') {
        e.preventDefault();
        this.startRun({ mode: this.save.selectedMode, difficulty: this.save.selectedDifficulty });
      }
    });

    // Swipe on the canvas: every 28px of travel in a gesture issues a turn
    const canvas = this.renderer.domElement;
    let sx = 0;
    let sy = 0;
    let tracking = false;
    canvas.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
      this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      sx = e.clientX;
      sy = e.clientY;
    });
    let downX = 0;
    let downY = 0;
    let downT = 0;
    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
      tracking = false;
      // A short, still press is a tap (not a swipe)
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < 12 && performance.now() - downT < 400) this.onTap(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointercancel', () => (tracking = false));
    canvas.addEventListener('pointermove', (e) => this.onHover(e.clientX, e.clientY));

    const dpad = document.getElementById('dpad');
    dpad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-dir]');
      if (!b) return;
      e.preventDefault();
      sfx.unlock();
      b.classList.add('pressed');
      setTimeout(() => b.classList.remove('pressed'), 120);
      this.turn(b.dataset.dir);
    });

    this.hud.pauseBtn.addEventListener('click', () => this.togglePause());
    document.getElementById('tutorial-tip').addEventListener('click', (e) => {
      if (e.target.closest('[data-action="skip-tutorial"]')) this.finishTutorial(true);
    });
    // Unlock audio on the very first interaction anywhere
    const unlock = () => {
      sfx.unlock();
      if (sfx.ctx && !this.introPlaying) sfx.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  turn(name) {
    if (!this.state.active || !this.run) return;
    if (this.snake.queueTurn(DIRS[name])) sfx.turn();
  }

  // =====================================================================
  // Run lifecycle
  // =====================================================================

  after(seconds, fn) {
    const t = gsap.delayedCall(seconds, fn);
    this.timers.push(t);
    return t;
  }

  clearTimers() {
    this.timers.forEach((t) => t.kill());
    this.timers = [];
  }

  activeState() {
    return this.run && this.run.rules.tutorial ? STATES.TUTORIAL : STATES.PLAYING;
  }

  startRun(cfg) {
    sfx.unlock();
    sfx.startMusic();
    // First launch: the interactive tutorial runs before the chosen mode
    if (!this.save.tutorialDone && !cfg.tutorial && !cfg.daily) {
      this.afterTutorial = cfg;
      cfg = { mode: 'classic', difficulty: 'normal', tutorial: true };
    } else if (!cfg.tutorial) {
      this.afterTutorial = null;
    }

    this.cleanupRun();
    const rules = buildRules(cfg.mode, cfg.difficulty, { daily: cfg.daily, tutorial: cfg.tutorial });
    const trie = rules.tutorial ? this.tries.tutorial : rules.kidsList ? this.tries.kids : this.tries.full;
    const seed = cfg.daily ? seedFromString(`word-serpent-${todayKey()}`) : (Math.random() * 2 ** 32) >>> 0;

    this.run = {
      cfg,
      rules,
      trie,
      letterRng: mulberry32(seed),
      score: 0,
      lives: rules.lives,
      combo: 0,
      maxCombo: 0,
      words: [],
      sessionWords: new Set(),
      word: '',
      wordStart: 0,
      lastLetter: null,
      chainLen: 0,
      correct: 0,
      mistakes: 0,
      speedLevel: 0,
      stepMs: rules.stepMs,
      timeLeft: rules.timeLimit,
      elapsed: 0,
      obstacles: rules.obstacles ? OBSTACLE_LAYOUT.slice(0, rules.obstacles) : [],
      respawnTimer: 0.9,
      banking: false,
      steps: 0,
      tutorialStep: 1,
      lastTick: 0,
      bankedLength: CONFIG.snake.baseLength, // body length up to the last link knot
      slowTimer: 0,
      hint: false,
      double: false,
    };
    this.recomputeStep();

    if (!this.save.worldsPlayed.includes(this.arena.worldId)) {
      this.save.worldsPlayed.push(this.arena.worldId);
      this.persist();
    }

    this.arena.setObstacles(this.run.obstacles);
    this.tiles.showHints = rules.showHints;
    this.snake.reset(START_CELL);
    this.acc = 0;
    this.timeScale = 1;

    this.menus.hide();
    this.hud.show();
    this.hud.setMode(rules.modeName + (rules.mode !== 'kids' && !rules.tutorial && rules.difficulty !== 'normal' ? ` · ${rules.difficulty}` : ''));
    this.hud.setScore(0, false);
    this.hud.setLives(rules.lives);
    this.hud.setCombo(0);
    this.hud.setTimer(rules.timeLimit ? rules.timeLimit : null);
    this.hud.setWord('', 'empty');
    document.getElementById('dpad').classList.toggle('hidden', !this.isTouch);

    this.rig.setMode('follow');
    sfx.setDuck(1);
    sfx.setPercussion(false);
    sfx.setMusicMode('game');
    this.hud.setPowers({});
    this.state.set(this.activeState());
    this.spawnSet();
    this.hud.banner(rules.tutorial ? 'Welcome!' : 'Ready… Go!', { duration: 0.6 });
    if (rules.tutorial) this.showTutorialStep(1);
  }

  cleanupRun() {
    this.clearTimers();
    this.tiles.clear();
    this.chain.clear();
    this.particles.clear();
    this.flyer.clear();
    this.popups.clear();
    this.hud.hideCard();
    this.hud.hideTip();
    gsap.killTweensOf(this);
    this.timeScale = 1;
    speech.cancel();
  }

  recomputeStep() {
    const run = this.run;
    const mult = CONFIG.speed.settingMultiplier[this.save.settings.speed] || 1;
    run.stepMs = Math.max(CONFIG.speed.minStepMs, run.rules.stepMs * mult * Math.pow(CONFIG.speed.speedUpFactor, run.speedLevel));
  }

  restart() {
    if (!this.run) return;
    const cfg = this.run.cfg;
    this.state.current = STATES.MENU; // allow a clean re-entry from any state
    this.startRun(cfg);
  }

  quitToMenu() {
    if (this.run && !this.state.is(STATES.GAME_OVER) && !this.run.rules.tutorial) this.commitProgress(false);
    this.cleanupRun();
    this.run = null;
    this.state.current = STATES.MENU;
    this.arena.setObstacles([]);
    this.snake.reset(START_CELL);
    this.rig.setMode('menu');
    this.hud.hide();
    document.getElementById('dpad').classList.add('hidden');
    sfx.setDuck(1);
    sfx.setPercussion(false);
    sfx.setMusicMode('menu');
    this.menus.show('main');
  }

  togglePause() {
    if (this.state.is(STATES.PAUSED)) {
      this.resume();
      return;
    }
    if (!this.run || !(this.state.active || this.state.is(STATES.WORD_BANKED))) return;
    this.pausedFrom = this.state.current;
    this.state.set(STATES.PAUSED);
    sfx.setDuck(0.35);
    speech.cancel();
    this.menus.show('pause');
  }

  resume() {
    if (!this.state.is(STATES.PAUSED)) return;
    this.menus.hide();
    this.state.set(this.pausedFrom || this.activeState());
    sfx.setDuck(1);
  }

  // =====================================================================
  // Spawning
  // =====================================================================

  spawnSet() {
    const run = this.run;
    const requiredFirst = run.rules.chainRule && run.word === '' && run.lastLetter ? run.lastLetter : null;
    const { tiles, longest, chainBroken } = chooseLetters({
      trie: run.trie,
      prefix: run.word,
      decoyRange: run.rules.decoyRange,
      requiredFirst,
      rng: run.letterRng,
    });
    if (chainBroken) {
      run.lastLetter = null;
      run.chainLen = 0;
      this.hud.banner(`No words start with ${requiredFirst.toUpperCase()} — new chain!`, { duration: 1.4 });
    }
    // Occasionally add a power-up (always placed last, so it never displaces a needed tile)
    if (!run.rules.tutorial && Math.random() < CONFIG.powerups.chance) {
      const types = CONFIG.powerups.types;
      tiles.push({ char: types[Math.floor(Math.random() * types.length)], kind: 'power' });
    }
    this.tiles.showHints = run.rules.showHints || run.hint;
    const cells = placeTiles({ count: tiles.length, snake: this.snake.cells, dir: this.snake.nextDir, obstacles: run.obstacles });
    this.tiles.spawnSet(tiles.slice(0, cells.length).map((t, i) => ({ ...t, cell: cells[i] })));
    run.longest = longest;
    this.updateWordHud();
  }

  updateWordHud() {
    const run = this.run;
    const node = run.trie.find(run.word);
    const bankable = node && node.isWord && run.word.length >= CONFIG.spawn.minWordLength;
    this.hud.setWord(run.word, run.word ? (bankable ? 'bankable' : 'progress') : 'empty');
    let hint = `Longest word possible from here: ${run.longest} letters`;
    if (run.rules.chainRule && !run.word && run.lastLetter) hint = `Start with “${run.lastLetter.toUpperCase()}” · ${hint}`;
    if (bankable) hint = `“${run.word.toUpperCase()}” is a word! Eat the ✓ to bank it · ${hint}`;
    this.hud.setHint(hint);
  }

  // =====================================================================
  // Game loop
  // =====================================================================

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const realDt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const paused = this.state.is(STATES.PAUSED);
    const dt = paused ? 0 : realDt * this.timeScale;
    this.time += dt;

    let alpha = this.snake.alpha;
    if (this.state.active && this.run) {
      alpha = this.updateRun(dt, realDt);
    } else if (this.state.is(STATES.MENU)) {
      this.acc += dt * 1000;
      while (this.acc >= this.menuStepMs) {
        this.acc -= this.menuStepMs;
        this.snake.autoSteer();
        const next = this.snake.peekNextCell();
        if (this.snake.wouldCollide(next, false)) this.snake.reset(START_CELL);
        else this.snake.step();
      }
      alpha = this.acc / this.menuStepMs;
      this.snake.lookTarget = this.menuLook;
    }

    this.snake.render(alpha, dt, this.time);
    const expired = this.tiles.update(dt, this.time);
    if (this.state.active && this.run && !this.run.banking) this.relocateExpired(expired);
    this.particles.update(dt);
    this.chain.update(dt, this.time);
    this.arena.update(paused ? 0 : realDt, this.time);

    const follow = this.run ? { head: this.snake.headWorld, dir: this.snake.dir, length: this.snake.length } : null;
    this.rig.update(realDt, follow);
    this.postfx.render();
  }

  /** Fixed-timestep simulation for an active run. Returns the render alpha. */
  updateRun(dt, realDt) {
    const run = this.run;
    run.elapsed += dt;

    if (run.rules.timeLimit) {
      const before = Math.ceil(run.timeLeft);
      run.timeLeft -= dt;
      if (Math.ceil(run.timeLeft) !== before) {
        this.hud.setTimer(run.timeLeft);
        if (run.timeLeft <= 10 && run.timeLeft > 0) sfx.tick();
      }
      if (run.timeLeft <= 0) {
        this.endRun("Time's Up!");
        return this.snake.alpha;
      }
    }

    // "Get ready" pause after (re)spawning: blink, don't move
    if (run.respawnTimer > 0) {
      run.respawnTimer -= realDt;
      this.snake.visible = Math.floor(run.respawnTimer * 10) % 2 === 0 || run.respawnTimer <= 0;
      return 1;
    }
    this.snake.visible = true;

    if (run.slowTimer > 0) run.slowTimer = Math.max(0, run.slowTimer - dt);
    this.hud.setPowers({ slow: run.slowTimer, hint: run.hint, double: run.double });
    const stepMs = this.effectiveStep();
    this.acc += dt * 1000;
    if (run.banking) {
      // Slow-motion glide into the cell, no new steps until the bank sequence ends
      this.acc = Math.min(this.acc, stepMs);
    } else {
      while (this.acc >= stepMs) {
        this.acc -= stepMs;
        this.tick();
        if (!this.state.active || !this.run || this.run.banking || this.run.respawnTimer > 0) break;
      }
    }
    if (!this.run) return 1;
    this.snake.lookTarget = this.tiles.nearestUseful(this.snake.headWorld);
    return Math.min(1, this.acc / stepMs);
  }

  /** Step interval including the Slow-motion power-up. */
  effectiveStep() {
    const run = this.run;
    return run.stepMs * (run.slowTimer > 0 ? CONFIG.powerups.slowFactor : 1);
  }

  relocateExpired(expired) {
    for (const t of expired) {
      const others = this.tiles.liveTiles().filter((o) => o !== t).map((o) => o.cell);
      const [cell] = placeTiles({ count: 1, snake: this.snake.cells, dir: this.snake.nextDir, obstacles: this.run.obstacles, existing: others });
      if (cell) this.tiles.relocate(t, cell);
      else t.age = 0;
    }
  }

  /** One discrete grid step of the snake. */
  tick() {
    const run = this.run;
    run.steps++;
    const next = this.snake.peekNextCell();
    const tile = this.tiles.tileAt(next);
    // Letters grow the body, and so does ✓ (it adds the link knot after the word)
    const growing = !!tile && (tile.kind === 'valid' || tile.kind === 'check');
    const crash = this.snake.wouldCollide(next, growing, run.obstacles);
    if (crash) {
      this.onCrash(crash);
      return;
    }

    if (!tile) {
      this.snake.step();
    } else if (tile.kind === 'valid') {
      this.snake.step(tile.char);
      this.onLetter(tile);
    } else if (tile.kind === 'check') {
      this.snake.step({ kind: 'link', time: this.time + 0.15 + run.word.length * 0.07 });
      this.onBank(tile);
    } else if (tile.kind === 'power') {
      this.snake.step();
      this.onPower(tile);
    } else {
      this.snake.step();
      if (run.rules.onDecoy === 'bounce') this.onDecoyBounce(tile);
      else this.onDecoyMistake(tile);
    }
    if (run.steps % CONFIG.snake.dustEverySteps === 0) {
      this.particles.puff(this.snake.tailWorld(this._v), this.arena.theme.dust);
    }
    // Combo fire trail
    if (run.combo >= 3) {
      this._v.copy(this.snake.headWorld).setY(0.7);
      this.particles.sparkle(this._v, run.combo >= 5 ? '#ff5d8f' : '#ff9f1c', 3);
    }
  }

  // =====================================================================
  // Events
  // =====================================================================

  onLetter(tile) {
    const run = this.run;
    const ch = tile.char;
    const color = tile.mats.boxMat.color.getStyle();
    const pos = this.tiles.consume(tile);
    this.particles.burst(pos, color, 26);
    this.particles.sparkle(pos, '#ffffff', 8);

    run.word += ch;
    run.correct++;
    if (run.word.length === 1) run.wordStart = run.elapsed;

    sfx.eat(run.word.length - 1);
    this.snake.setExpression('happy', 0.45);
    this.snake.squash();

    // A copy of the letter arcs onto the new tail segment
    const idx = this.snake.length - 1;
    this.flyer.fly(ch, pos, (out) => this.snake.segmentLetterWorld(idx, out), {
      duration: 0.38,
      height: 1.6,
      onDone: () => this.snake.setLetterVisible(idx, true),
    });

    this.tiles.despawnAll();
    this.spawnSet();

    if (run.rules.tutorial) {
      const node = run.trie.find(run.word);
      if (node && node.isWord) this.showTutorialStep(3);
      else if (run.tutorialStep < 2) this.showTutorialStep(2);
    }
  }

  onBank(tile) {
    const run = this.run;
    const word = run.word;
    const pos = this.tiles.consume(tile);
    this.tiles.despawnAll();
    this.particles.burst(pos, CONFIG.colors.crystal, 30, 6);

    const repeated = run.sessionWords.has(word);
    const chained = run.rules.chainRule && !!run.lastLetter && word[0] === run.lastLetter;
    const result = scoreWord({ word, combo: run.combo, elapsed: run.elapsed - run.wordStart, chained, repeated });
    if (run.double) {
      result.total *= 2;
      result.parts.push('⭐ ×2');
      run.double = false;
    }

    // The word stays on the body: its letters turn gold, a link knot follows, and
    // the light beam zips along to join it to the words before it.
    const from = run.bankedLength;
    const linkIdx = this.snake.length - 1;
    this.snake.markBanked(from, linkIdx, this.time + 0.1);
    run.bankedLength = this.snake.length;
    this.after(0.25, () => sfx.link());
    if (run.hint && !run.rules.showHints) {
      run.hint = false;
      this.tiles.showHints = false;
    }

    run.score += result.total;
    run.words.push(word);
    run.sessionWords.add(word);
    run.correct++;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.lastLetter = word[word.length - 1];
    run.chainLen = run.rules.chainRule ? run.chainLen + 1 : 0;
    run.word = '';
    run.banking = true;
    this.hud.setHint('');

    if (!run.rules.tutorial) {
      this.save.discovered[word] = (this.save.discovered[word] || 0) + 1;
      this.save.stats.words++;
      this.persist();
    }

    sfx.bank();
    if (run.combo >= 2) this.after(0.35, () => sfx.combo(run.combo));
    sfx.setPercussion(run.combo >= 3);
    this.hud.setCombo(run.combo);
    this.particles.confetti(this.snake.headWorld);
    this.snake.setExpression('happy', 1.4);
    this.snake.squash();

    // 3D score popup that flies into the HUD counter
    this.popups.show(`+${result.total}`, this.snake.headWorld, this.rig.camera, (x, y) => {
      this.hud.flyScore(x, y, `+${result.total}`, () => this.run && this.hud.setScore(this.run.score));
    });

    // Slow motion → freeze + orbit + letters fly to the chain
    gsap.killTweensOf(this, 'timeScale');
    this.timeScale = CONFIG.bank.slowMoScale;
    this.after(CONFIG.bank.slowMoSeconds, () => this.bankSequence(word, result, from, linkIdx));
    this.checkAchievements({ word });
  }

  bankSequence(word, result, from, linkIdx) {
    const run = this.run;
    if (!run) return;
    this.timeScale = 1;
    if (this.state.is(STATES.PAUSED)) this.pausedFrom = STATES.WORD_BANKED;
    else this.state.set(STATES.WORD_BANKED);
    this.rig.orbit(CONFIG.bank.freezeSeconds + 0.3);

    // Copies of the letters fly up to the sky chain (the originals stay on the body)
    const { targetOf, reveal } = this.chain.addWord(word);
    const sources = [];
    for (let i = from; i < linkIdx; i++) {
      if (this.snake.letters[i]) sources.push({ letter: this.snake.letters[i], position: this.snake.segmentLetterWorld(i, new THREE.Vector3()) });
    }
    sources.forEach((r, i) => {
      this.particles.sparkle(r.position, '#fff6c2', 6);
      this.flyer.fly(r.letter, r.position, (out) => targetOf(i, out), {
        duration: 0.85,
        height: 4,
        delay: i * 0.07,
        scale: [1, 1.45],
        onDone: () => {
          reveal(i);
          sfx.pop();
        },
      });
    });
    sfx.whoosh();
    speech.say(word);
    const info = getWordInfo(word);
    this.hud.defCard({ word, emoji: info && info.emoji, def: info && info.def, points: result.total, parts: result.parts });
    this.hud.setWord('', 'empty');

    // Speed up every N words (Classic / Word Chain)
    if (run.words.length % CONFIG.speed.speedUpEveryWords === 0) {
      // Milestone fireworks every 5 words
      this.fireworks();
      if (run.rules.speedUp) {
        run.speedLevel++;
        this.recomputeStep();
        this.after(CONFIG.bank.freezeSeconds, () => this.hud.banner(`${run.words.length} words! Speed up 💨`, { duration: 0.9 }));
      } else {
        this.after(CONFIG.bank.freezeSeconds, () => this.hud.banner(`${run.words.length} words! 🎆`, { duration: 0.9 }));
      }
    }

    this.after(CONFIG.bank.freezeSeconds, () => {
      if (!this.run) return;
      this.run.banking = false;
      this.acc = 0;
      if (this.state.is(STATES.PAUSED)) this.pausedFrom = this.activeState();
      else this.state.set(this.activeState());
      if (this.run.rules.tutorial) {
        this.finishTutorial(false);
        return;
      }
      this.spawnSet();
    });
  }

  onDecoyMistake(tile) {
    const run = this.run;
    const pos = this.tiles.consume(tile);
    this.particles.burst(pos, '#ff4d4d', 30, 6);
    sfx.error();
    this.rig.shake(0.7);
    this.snake.setExpression('dizzy', 1.3);
    run.mistakes++;
    this.save.stats.mistakes++;
    this.resetCombo();

    if (run.rules.onDecoy === 'gameover') {
      this.hud.setWord(run.word + tile.char, 'invalid');
      this.endRun('Wrong Letter!');
      return;
    }
    // Normal: the word breaks apart, lose a life, shrink to base length
    this.breakWord();
    this.hud.banner(`“${tile.char.toUpperCase()}” doesn't fit!`, { duration: 0.8 });
    if (!this.loseLife()) return;
    this.tiles.despawnAll();
    this.spawnSet();
  }

  onDecoyBounce(tile) {
    const run = this.run;
    sfx.bounce();
    this.snake.setExpression('dizzy', 0.9);
    run.mistakes++;
    this.resetCombo();
    const penalty = run.rules.tutorial ? 0 : CONFIG.scoring.kidsDecoyPenalty;
    if (penalty) {
      run.score = Math.max(0, run.score - penalty);
      this.hud.setScore(run.score);
      this.popups.show(`-${penalty}`, this.snake.headWorld, this.rig.camera);
    }
    this.hud.banner('Not that one! Try another 🙂', { duration: 0.8 });
    const others = this.tiles.liveTiles().filter((o) => o !== tile).map((o) => o.cell);
    const [cell] = placeTiles({ count: 1, snake: this.snake.cells, dir: this.snake.nextDir, obstacles: run.obstacles, existing: others });
    if (cell) this.tiles.bounceAway(tile, cell);
    else this.tiles.despawn(tile);
  }

  onCrash(type) {
    const run = this.run;
    this.particles.burst(this.snake.headWorld.clone().setY(0.5), '#ffffff', 20, 5);
    this.rig.shake(1);
    this.snake.setExpression('dizzy', 1.5);
    run.mistakes++;
    this.resetCombo();

    if (run.rules.onCrash === 'gameover') {
      sfx.error();
      this.endRun(type === 'self' ? 'Tangled Up!' : 'Bonk!');
      return;
    }
    this.breakWord();
    if (run.rules.onCrash === 'life') {
      if (!this.loseLife()) return;
    } else {
      sfx.lifeLost();
    }
    this.respawn();
  }

  respawn() {
    const run = this.run;
    this.snake.reset(START_CELL);
    run.bankedLength = CONFIG.snake.baseLength; // a crash scatters the body (words remain in the sky chain)
    run.respawnTimer = CONFIG.modes.respawnDelay;
    this.acc = 0;
    this.tiles.despawnAll();
    this.spawnSet();
    this.hud.banner('Get ready!', { duration: 0.6 });
  }

  /** The current (unbanked) word explodes off the snake; formed words stay. */
  breakWord() {
    const run = this.run;
    const removed = this.snake.truncate(run.bankedLength);
    removed.forEach((r, i) => this.after(i * 0.05, () => this.particles.explode(r.position, r.color)));
    if (run.word) this.hud.breakWord();
    run.word = '';
  }

  resetCombo() {
    if (this.run.combo > 0) this.hud.setCombo(0);
    this.run.combo = 0;
    sfx.setPercussion(false);
  }

  /** @returns {boolean} true if the run continues */
  loseLife() {
    const run = this.run;
    if (run.lives === Infinity) return true;
    run.lives--;
    sfx.lifeLost();
    this.hud.setLives(run.lives, run.rules.lives);
    this.hud.loseLifeFx();
    if (run.lives <= 0) {
      this.endRun('Game Over');
      return false;
    }
    return true;
  }

  onPower(tile) {
    const run = this.run;
    const type = tile.char;
    const color = POWER_INFO[type].color;
    const pos = this.tiles.consume(tile);
    this.particles.burst(pos, color, 34, 6);
    this.particles.sparkle(pos, '#ffffff', 14);
    sfx.powerUp();
    this.snake.setExpression('happy', 0.8);
    this.snake.squash();
    if (type === 'slow') {
      run.slowTimer = CONFIG.powerups.slowSeconds;
      this.hud.banner('⏳ Slow motion!', { duration: 0.8 });
    } else if (type === 'hint') {
      run.hint = true;
      this.tiles.showHints = true;
      this.tiles.refreshHints();
      this.hud.banner('💡 Hint: good letters glow!', { duration: 0.9 });
    } else {
      run.double = true;
      this.hud.banner('⭐ Next word scores ×2!', { duration: 0.9 });
    }
    speech.say(POWER_INFO[type].name);
  }

  fireworks() {
    sfx.fireworks();
    for (let i = 0; i < 4; i++) {
      this.after(0.2 + i * 0.22, () => {
        const p = new THREE.Vector3((Math.random() - 0.5) * 14, 4 + Math.random() * 3, -4 - Math.random() * 6);
        this.particles.burst(p, ['#ff5d8f', '#ffd166', '#4cc9f0', '#b388ff'][i % 4], 50, 7);
        this.particles.sparkle(p, '#ffffff', 16);
      });
    }
  }

  // =====================================================================
  // Pointer interaction: tap tiles / sky words / the snake
  // =====================================================================

  /** Raycast hits whose whole parent chain is visible (pooled objects stay hidden). */
  pick(x, y, objects) {
    this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const shown = (o) => {
      for (; o; o = o.parent) if (!o.visible) return false;
      return true;
    };
    return this.raycaster.intersectObjects(objects, true).filter((h) => shown(h.object));
  }

  onTap(x, y) {
    if (this.introPlaying || this.state.is(STATES.PAUSED)) return;
    const hits = this.pick(x, y, [this.tiles.group, this.chain.group, this.snake.head]);
    for (const h of hits) {
      // Letter tile → say the letter
      for (let o = h.object; o; o = o.parent) {
        const t = o.userData && o.userData.tile;
        if (t && t.state !== 'free' && t.state !== 'despawn') {
          this.tiles.poke(t);
          sfx.tapLetter();
          this.particles.sparkle(t.root.position.clone().setY(1), '#ffffff', 8);
          if (t.kind === 'power') speech.say(POWER_INFO[t.char].name, { force: true });
          else if (t.kind === 'check') speech.say(this.run ? this.run.word : 'bank it', { force: true });
          else speech.say(t.char.toUpperCase(), { force: true, rate: 0.8 });
          return;
        }
        if (o === this.snake.head) {
          this.snake.squash();
          this.snake.setExpression('happy', 0.9);
          sfx.giggle();
          this.particles.sparkle(this.snake.headWorld.clone().setY(1.2), '#ff8fab', 12);
          return;
        }
      }
      // Sky chain word → say the word
      const word = this.chain.wordFromObject(h.object);
      if (word) {
        this.chain.wave(word);
        sfx.tapLetter();
        speech.say(word.text, { force: true });
        return;
      }
    }
  }

  onHover(x, y) {
    if (this.introPlaying) return;
    // Menu: the idle snake's eyes follow the cursor
    if (this.state.is(STATES.MENU)) {
      this.pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.rig.camera);
      this.menuLook = this.menuLook || new THREE.Vector3();
      if (!this.raycaster.ray.intersectPlane(this.groundPlane, this.menuLook)) this.menuLook = null;
    }
    if (this.isTouch) return;
    const hits = this.pick(x, y, [this.tiles.group, this.chain.group, this.snake.head]);
    const over = hits.length > 0;
    this.renderer.domElement.style.cursor = over ? 'pointer' : '';
  }

  // =====================================================================
  // Tutorial
  // =====================================================================

  showTutorialStep(step) {
    const run = this.run;
    if (!run || step < run.tutorialStep) return;
    run.tutorialStep = step;
    const controls = this.isTouch ? 'Swipe or use the arrows' : 'Use the arrow keys or WASD';
    const texts = {
      1: `${controls} to steer. <b>Eat a letter</b> to start a word!`,
      2: 'Nice! <b>New letters appeared.</b> Only letters that can build a real word show up. Keep spelling!',
      3: `<b>${run.word.toUpperCase()}</b> is a word! Eat the glowing <b>✓ crystal</b> to bank it.`,
    };
    this.hud.showTip(texts[step], step, TUTORIAL_STEPS);
  }

  finishTutorial(skipped) {
    if (!this.run || !this.run.rules.tutorial) return;
    this.save.tutorialDone = true;
    this.persist();
    this.hud.hideTip();
    const next = this.afterTutorial || { mode: this.save.selectedMode, difficulty: this.save.selectedDifficulty };
    this.afterTutorial = null;
    if (skipped) {
      this.restartWith(next);
      return;
    }
    this.hud.banner("You're ready! 🎉", { duration: 1.2, big: true });
    this.particles.confetti(this.snake.headWorld, 160);
    this.run.banking = true; // hold still during the celebration
    this.after(1.8, () => this.restartWith(next));
  }

  restartWith(cfg) {
    this.state.current = STATES.MENU;
    this.startRun(cfg);
  }

  // =====================================================================
  // Game over & progression
  // =====================================================================

  endRun(title) {
    const run = this.run;
    if (!run || this.state.is(STATES.GAME_OVER)) return;
    this.clearTimers();
    this.timeScale = 1;
    run.banking = false;
    if (this.state.is(STATES.PAUSED)) this.menus.hide();
    this.state.set(STATES.GAME_OVER);
    sfx.gameOver();
    sfx.setPercussion(false);
    sfx.setMusicMode('menu');
    this.tiles.despawnAll();
    this.hud.hideTip();
    document.getElementById('dpad').classList.add('hidden');

    if (run.rules.tutorial) {
      this.quitToMenu();
      return;
    }
    const data = this.commitProgress(true, title);

    const showResults = () => {
      this.hud.hide();
      this.menus.show('gameover', data);
    };
    const points = this.chain.flyPoints();
    this.hud.banner(title, { duration: 1, big: true });
    if (points.length) {
      // Cinematic: fly along the whole word chain before the results
      this.after(1.1, () => this.rig.flyAlong(points, Math.min(6, 1.6 + points.length * 0.45), showResults));
    } else {
      this.after(1.6, showResults);
    }
  }

  /** Bank XP, scores and unlocks. Returns the results summary for the game-over screen. */
  commitProgress(final, title = 'Game Over') {
    const run = this.run;
    const s = this.save;
    const modeKey = run.rules.mode;
    const prevLevel = s.level;
    const prevXp = s.totalXp;
    const xp = run.score + run.words.length * CONFIG.scoring.xpPerWord;

    let best;
    let newHigh = false;
    if (run.rules.daily) {
      if (s.daily.date !== todayKey()) s.daily = { date: todayKey(), best: 0 };
      newHigh = run.score > s.daily.best && run.score > 0;
      s.daily.best = Math.max(s.daily.best, run.score);
      best = s.daily.best;
    } else {
      newHigh = run.score > (s.highScores[modeKey] || 0) && run.score > 0;
      s.highScores[modeKey] = Math.max(s.highScores[modeKey] || 0, run.score);
      best = s.highScores[modeKey];
    }

    s.totalXp += xp;
    s.totalScore += run.score;
    s.level = levelFromXp(s.totalXp);
    s.stats.games++;
    s.stats.letters += run.correct;

    const unlocks = [];
    for (const w of CONFIG.worlds) {
      if (s.level >= w.level && !s.unlockedWorlds.includes(w.id)) {
        s.unlockedWorlds.push(w.id);
        unlocks.push(`World: ${w.name}`);
      }
    }
    for (const k of CONFIG.skins) {
      if (s.totalScore >= k.unlock && !s.unlockedSkins.includes(k.id)) {
        s.unlockedSkins.push(k.id);
        unlocks.push(`Skin: ${k.name}`);
      }
    }
    this.persist();
    if (!final) unlocks.forEach((u) => this.hud.toast('🔓', 'Unlocked!', u));

    const pct = (xpTotal, level) => {
      const lo = xpForLevel(level);
      const hi = xpForLevel(level + 1);
      return Math.max(0, Math.min(100, ((xpTotal - lo) / (hi - lo)) * 100));
    };
    const total = run.correct + run.mistakes;
    const longest = run.words.reduce((a, w) => (w.length > a.length ? w : a), '');
    return {
      title: run.rules.daily ? `Daily: ${title}` : title,
      score: run.score,
      words: run.words.length,
      longest,
      accuracy: total ? Math.round((run.correct / total) * 100) : 0,
      newHigh,
      best,
      xp,
      level: s.level,
      levelUp: s.level > prevLevel,
      xpFrom: s.level > prevLevel ? 0 : pct(prevXp, prevLevel),
      xpTo: pct(s.totalXp, s.level),
      unlocks,
    };
  }

  checkAchievements({ word }) {
    const run = this.run;
    if (run.rules.tutorial) return;
    const s = this.save;
    const give = (id) => {
      if (s.achievements[id]) return;
      s.achievements[id] = Date.now();
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      this.after(0.9, () => {
        sfx.achievement();
        this.hud.toast(a.emoji, a.name, a.desc);
      });
    };
    give('firstWord');
    if (word.length >= 5) give('five');
    if (word.length >= 7) give('seven');
    if (run.rules.chainRule && run.chainLen >= 10) give('chain10');
    if (run.combo >= 5) give('combo5');
    if (Object.keys(s.discovered).length >= 100) give('words100');
    if (CONFIG.worlds.every((w) => s.worldsPlayed.includes(w.id))) give('allWorlds');
    this.persist();
  }

  // =====================================================================
  // Window events
  // =====================================================================

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.rig.resize(w / h);
    this.postfx.resize(w, h);
  }

  onVisibility() {
    if (document.hidden) {
      if (this.run && (this.state.active || this.state.is(STATES.WORD_BANKED))) this.togglePause();
      sfx.suspend();
    } else {
      sfx.resume();
      this.last = performance.now();
    }
  }
}

const game = new Game();
if (import.meta.env.DEV) window.__game = game; // handy for debugging in the console
game.init().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading-error');
  if (el) {
    el.textContent = 'Could not load the game font (an internet connection is needed the first time). Please check your connection and reload.';
    el.classList.remove('hidden');
  }
});
