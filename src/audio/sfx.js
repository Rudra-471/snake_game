// All sound is synthesized with the Web Audio API — no audio files.
//
// Music engine: a lookahead step sequencer driving a few small synth "instruments"
// (warm detuned pad, marimba, plucked bass, vibrato lead, drum kit) through a shared
// reverb (generated impulse response) and a filtered feedback delay.
// Three themes: 'menu' (calm), 'game' (upbeat, with a combo drum layer) and a
// one-shot cinematic 'intro' cue.

import { CONFIG } from '../config.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
// Major pentatonic, so rising "eat" notes always sound nice together.
const PENTA = [0, 2, 4, 7, 9];

// Chords in F major: bass root + pad voicing (MIDI)
const CH = {
  F: { root: 41, pad: [53, 57, 60, 65] },
  Dm: { root: 38, pad: [50, 57, 62, 65] },
  Bb: { root: 46, pad: [53, 58, 62, 65] },
  C: { root: 36, pad: [52, 55, 60, 64] },
  Am: { root: 45, pad: [52, 57, 60, 64] },
  Gm: { root: 43, pad: [50, 55, 58, 62] },
};

// Game theme: 8 bars, melody as [step, midi, lengthInSteps] per bar
const GAME_SONG = {
  chords: ['F', 'Dm', 'Bb', 'C', 'Bb', 'C', 'Am', 'Dm'],
  melody: [
    [[0, 72, 3], [4, 74, 2], [6, 77, 4], [12, 74, 2], [14, 72, 2]],
    [[0, 69, 4], [6, 72, 2], [8, 74, 6], [14, 72, 2]],
    [[0, 74, 3], [4, 77, 2], [6, 79, 4], [12, 77, 2], [14, 74, 2]],
    [[0, 76, 6], [8, 72, 4], [12, 74, 4]],
    [[0, 77, 2], [2, 79, 2], [4, 81, 4], [10, 79, 2], [12, 77, 4]],
    [[0, 79, 4], [6, 76, 2], [8, 72, 8]],
    [[0, 76, 2], [2, 77, 2], [4, 76, 4], [8, 72, 4], [12, 69, 4]],
    [[0, 74, 8], [10, 72, 2], [12, 69, 4]],
  ],
};

// Menu theme: slow, dreamy, 2 bars per chord
const MENU_SONG = {
  chords: ['F', 'F', 'Am', 'Am', 'Bb', 'Bb', 'C', 'C'],
  bells: [
    [[0, 77, 6], [8, 76, 4], [12, 72, 4]],
    [[0, 74, 8], [8, 72, 8]],
    [[0, 76, 6], [8, 79, 4], [12, 76, 4]],
    [[0, 72, 16]],
    [[0, 74, 6], [8, 77, 4], [12, 81, 4]],
    [[0, 79, 8], [8, 77, 8]],
    [[0, 76, 4], [4, 74, 4], [8, 72, 4], [12, 74, 4]],
    [[0, 72, 16]],
  ],
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.musicVolume = CONFIG.audio.defaultMusic;
    this.sfxVolume = CONFIG.audio.defaultSfx;
    this.musicOn = false;
    this.percOn = false;
    this.mode = 'menu';
    this.pendingMode = null;
    this.step = 0;
    this.loop = 0;
    this.nextTime = 0;
    this.timer = null;
    this.duck = 1;
  }

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.buildGraph();
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    // Music: everything → musicBus → glue compressor → master
    this.musicComp = ctx.createDynamicsCompressor();
    this.musicComp.threshold.value = -18;
    this.musicComp.ratio.value = 3;
    this.musicComp.attack.value = 0.01;
    this.musicComp.release.value = 0.25;
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.musicComp).connect(this.master);

    // Reverb with a generated stereo impulse response
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(this.reverb).connect(this.musicBus);

    // Feedback delay (dotted-eighth feel) with a darkening filter in the loop
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = (60 / CONFIG.audio.gameBpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 2600;
    this.delay.connect(fbFilter).connect(fb).connect(this.delay);
    this.delaySend = ctx.createGain();
    this.delaySend.connect(this.delay);
    this.delay.connect(this.musicBus);

    // Drum buses: base groove + combo layer (faded in while combo ≥ 3)
    this.drumBus = ctx.createGain();
    this.drumBus.connect(this.musicBus);
    this.percBus = ctx.createGain();
    this.percBus.gain.value = 0;
    this.percBus.connect(this.musicBus);

    // SFX also get a touch of reverb
    this.sfxReverb = ctx.createGain();
    this.sfxReverb.gain.value = 0.18;
    this.sfxReverb.connect(this.reverb);

    this.noiseBuffer = this.makeNoise();
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.55 * this.duck, t, 0.15);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Lower music while paused. */
  setDuck(amount) {
    this.duck = amount;
    this.applyVolumes();
  }

  // ---------- primitives ----------

  tone({ freq, type = 'sine', dur = 0.15, vol = 0.3, attack = 0.005, when = 0, slideTo = null, bus = null, detune = 0, verb = false }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + Math.max(0, when);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(bus || this.sfxBus);
    if (verb) gain.connect(this.sfxReverb);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.1, vol = 0.2, freq = 2000, q = 1, type = 'bandpass', when = 0, bus = null, sweepTo = null, attack = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + Math.max(0, when);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    if (attack > 0) {
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    } else {
      gain.gain.setValueAtTime(vol, t0);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(bus || this.sfxBus);
    src.start(t0, Math.random() * 1.0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- instruments (music) ----------

  /** Warm pad: two detuned saws per note through a lowpass, slow swell. */
  pad(notes, when, dur, vol = 0.045, cutoff = 1100) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 0.6, t0);
    filter.frequency.linearRampToValueAtTime(cutoff, t0 + dur * 0.5);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.8, dur * 0.3));
    gain.gain.setValueAtTime(vol, t0 + dur * 0.75);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.6);
    filter.connect(gain);
    gain.connect(this.musicBus);
    const send = ctx.createGain();
    send.gain.value = 0.7;
    gain.connect(send).connect(this.reverbSend);
    for (const n of notes) {
      for (const det of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = NOTE(n);
        o.detune.value = det;
        o.connect(filter);
        o.start(t0);
        o.stop(t0 + dur + 0.7);
      }
    }
  }

  /** Marimba-ish mallet: sine fundamental + short 4th-harmonic click. */
  marimba(n, when, vol = 0.16, { delay = 0.25, verb = 0.35 } = {}) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = NOTE(n);
    o1.connect(gain);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.5, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = NOTE(n) * 4;
    o2.connect(g2).connect(gain);
    gain.connect(this.musicBus);
    if (delay) {
      const ds = ctx.createGain();
      ds.gain.value = delay;
      gain.connect(ds).connect(this.delaySend);
    }
    if (verb) {
      const rs = ctx.createGain();
      rs.gain.value = verb;
      gain.connect(rs).connect(this.reverbSend);
    }
    o1.start(t0);
    o2.start(t0);
    o1.stop(t0 + 0.6);
    o2.stop(t0 + 0.1);
  }

  /** Round plucked bass with a filter envelope. */
  bass(n, when, dur, vol = 0.32) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t0);
    filter.frequency.exponentialRampToValueAtTime(220, t0 + Math.max(0.12, dur));
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.08);
    for (const [type, mult, v] of [['triangle', 1, 1], ['square', 1, 0.25], ['sine', 0.5, 0.6]]) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.value = NOTE(n) * mult;
      og.gain.value = v;
      o.connect(og).connect(filter);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    }
    filter.connect(gain).connect(this.musicBus);
  }

  /** Singing lead with gentle vibrato, sent to delay + reverb. */
  lead(n, when, dur, vol = 0.09) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = NOTE(n);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t0);
    lfoGain.gain.linearRampToValueAtTime(NOTE(n) * 0.008, t0 + Math.min(0.3, dur));
    lfo.connect(lfoGain).connect(o.frequency);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = NOTE(n) * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o2.connect(g2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    gain.gain.setValueAtTime(vol, t0 + Math.max(0.04, dur - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
    o.connect(gain);
    g2.connect(gain);
    gain.connect(this.musicBus);
    const ds = ctx.createGain();
    ds.gain.value = 0.35;
    gain.connect(ds).connect(this.delaySend);
    const rs = ctx.createGain();
    rs.gain.value = 0.4;
    gain.connect(rs).connect(this.reverbSend);
    for (const x of [o, o2, lfo]) {
      x.start(t0);
      x.stop(t0 + dur + 0.3);
    }
  }

  kick(when, vol = 0.7, bus = this.drumBus) {
    this.tone({ freq: 140, type: 'sine', dur: 0.22, vol, slideTo: 42, when, bus });
    this.tone({ freq: 2200, type: 'sine', dur: 0.012, vol: vol * 0.25, when, bus });
  }

  snare(when, vol = 0.3, bus = this.percBus) {
    this.noise({ dur: 0.16, vol, freq: 1900, q: 0.7, when, bus });
    this.tone({ freq: 210, type: 'triangle', dur: 0.08, vol: vol * 0.6, slideTo: 160, when, bus });
  }

  hat(when, vol = 0.08, open = false, bus = this.drumBus) {
    this.noise({ dur: open ? 0.22 : 0.035, vol, freq: 9500, type: 'highpass', when, bus });
  }

  shaker(when, vol = 0.04, bus = this.drumBus) {
    this.noise({ dur: 0.05, vol, freq: 6500, q: 1.5, when, bus, attack: 0.015 });
  }

  // ---------- game sounds ----------

  /** Pitch climbs a pentatonic scale with each letter in the word. */
  eat(index) {
    const octave = Math.floor(index / PENTA.length);
    const n = 72 + PENTA[index % PENTA.length] + octave * 12;
    this.tone({ freq: NOTE(n), type: 'triangle', dur: 0.2, vol: 0.3, verb: true });
    this.tone({ freq: NOTE(n + 12), type: 'sine', dur: 0.14, vol: 0.12, when: 0.02, verb: true });
    this.noise({ dur: 0.05, vol: 0.07, freq: 4000 });
  }

  error() {
    this.tone({ freq: 150, type: 'sawtooth', dur: 0.32, vol: 0.16, slideTo: 90 });
    this.tone({ freq: 157, type: 'square', dur: 0.28, vol: 0.07, slideTo: 95 });
  }

  bounce() {
    this.tone({ freq: 300, type: 'sine', dur: 0.2, vol: 0.25, slideTo: 600 });
    this.tone({ freq: 220, type: 'triangle', dur: 0.15, vol: 0.12, when: 0.1, slideTo: 180 });
  }

  bank() {
    const notes = [72, 76, 79, 84, 88];
    notes.forEach((n, i) => this.tone({ freq: NOTE(n), type: 'triangle', dur: 0.4, vol: 0.26, when: i * 0.075, verb: true }));
    notes.forEach((n, i) => this.tone({ freq: NOTE(n + 12), type: 'sine', dur: 0.35, vol: 0.08, when: i * 0.075 + 0.03, verb: true }));
    this.noise({ dur: 0.7, vol: 0.06, freq: 8000, type: 'highpass', when: 0.1 });
  }

  /** The glowing connector line zips along the body. */
  link() {
    this.tone({ freq: 500, type: 'sine', dur: 0.35, vol: 0.12, slideTo: 1400, verb: true });
    this.noise({ dur: 0.3, vol: 0.05, freq: 1200, sweepTo: 6000, q: 4 });
  }

  combo(level) {
    const base = 79 + Math.min(level, 8);
    this.tone({ freq: NOTE(base), type: 'sine', dur: 0.4, vol: 0.2, verb: true });
    this.tone({ freq: NOTE(base + 7), type: 'sine', dur: 0.5, vol: 0.15, when: 0.08, verb: true });
    this.tone({ freq: NOTE(base + 12), type: 'sine', dur: 0.6, vol: 0.1, when: 0.16, verb: true });
  }

  powerUp() {
    [67, 71, 74, 79, 83].forEach((n, i) => this.tone({ freq: NOTE(n), type: 'square', dur: 0.12, vol: 0.07, when: i * 0.045, verb: true }));
    this.tone({ freq: 400, type: 'sine', dur: 0.5, vol: 0.15, slideTo: 1600, verb: true });
  }

  tapLetter() {
    this.tone({ freq: 1046, type: 'sine', dur: 0.12, vol: 0.12, verb: true });
  }

  giggle() {
    [0, 0.09, 0.18].forEach((w, i) => this.tone({ freq: 700 + i * 120, type: 'sine', dur: 0.08, vol: 0.12, when: w, slideTo: 900 + i * 150 }));
  }

  fireworks() {
    for (let i = 0; i < 4; i++) {
      this.tone({ freq: 300, type: 'sine', dur: 0.4, vol: 0.06, when: i * 0.22, slideTo: 1200 });
      this.noise({ dur: 0.6, vol: 0.12, freq: 3000, type: 'highpass', when: i * 0.22 + 0.4 });
    }
  }

  lifeLost() {
    [67, 63, 58].forEach((n, i) => this.tone({ freq: NOTE(n), type: 'square', dur: 0.22, vol: 0.11, when: i * 0.14 }));
    this.noise({ dur: 0.4, vol: 0.14, freq: 400, type: 'lowpass' });
  }

  gameOver() {
    [67, 66, 65, 64].forEach((n, i) =>
      this.tone({ freq: NOTE(n), type: 'triangle', dur: i === 3 ? 0.9 : 0.3, vol: 0.2, when: i * 0.28, verb: true })
    );
  }

  click() {
    this.tone({ freq: 880, type: 'sine', dur: 0.06, vol: 0.14 });
  }

  hover() {
    this.tone({ freq: 1320, type: 'sine', dur: 0.03, vol: 0.04 });
  }

  whoosh(dur = 0.45) {
    this.noise({ dur, vol: 0.12, freq: 300, sweepTo: 3000, q: 2, attack: dur * 0.3 });
  }

  pop() {
    this.tone({ freq: 500, type: 'sine', dur: 0.08, vol: 0.14, slideTo: 900 });
  }

  tick() {
    this.tone({ freq: 1200, type: 'square', dur: 0.04, vol: 0.06 });
  }

  achievement() {
    [76, 81, 85, 88].forEach((n, i) => this.tone({ freq: NOTE(n), type: 'triangle', dur: 0.4, vol: 0.17, when: i * 0.09, verb: true }));
  }

  turn() {
    this.tone({ freq: 660, type: 'sine', dur: 0.025, vol: 0.03 });
  }

  /** Cinematic timpani-like hit (intro tile landings). */
  thud(pitch = 0) {
    if (!this.ctx) return;
    this.tone({ freq: 95 + pitch * 6, type: 'sine', dur: 0.6, vol: 0.5, slideTo: 55, verb: true });
    this.noise({ dur: 0.18, vol: 0.18, freq: 500, type: 'lowpass' });
    this.tone({ freq: NOTE(72 + PENTA[pitch % 5] + 12 * Math.floor(pitch / 5)), type: 'triangle', dur: 0.3, vol: 0.06, verb: true });
  }

  // ---------- intro cue ----------

  /**
   * One-shot cinematic cue: a swelling drone, rising cymbal and a big sting at
   * `stingAt` seconds (the title reveal).
   */
  playIntro(stingAt = 6.4) {
    if (!this.ctx) return;
    const bus = this.musicBus;
    // Low drone swelling under the opening shots
    this.pad([29, 41, 48], 0.05, stingAt - 0.2, 0.05, 500);
    this.pad([53, 57, 60], 2.2, stingAt - 2.4, 0.03, 900);
    // Soft heartbeat pulses
    for (let t = 0.6; t < stingAt - 1; t += 1.2) this.kick(t, 0.35, bus);
    // Shimmer arpeggio rising into the reveal
    const arp = [65, 69, 72, 77, 81, 84];
    for (let i = 0; i < 12; i++) this.marimba(arp[i % arp.length] + (i >= 6 ? 12 : 0), 2.4 + i * 0.28, 0.08, { delay: 0.4, verb: 0.6 });
    // Reverse-cymbal swell into the sting
    this.noise({ dur: 2.2, vol: 0.18, freq: 4000, type: 'highpass', when: stingAt - 2.2, attack: 2.1 });
    // The sting: big F major chord across octaves + bells + boom
    this.pad([41, 53, 57, 60, 65, 69, 72], stingAt, 3.2, 0.05, 2400);
    this.kick(stingAt, 0.9, bus);
    this.noise({ dur: 2.5, vol: 0.12, freq: 6000, type: 'highpass', when: stingAt });
    [77, 81, 84, 89].forEach((n, i) => this.marimba(n, stingAt + i * 0.06, 0.12, { delay: 0.45, verb: 0.7 }));
    this.lead(84, stingAt + 0.3, 1.6, 0.06);
  }

  // ---------- music sequencer ----------

  /** 'menu' | 'game'. Switches on the next bar so the groove never stumbles. */
  setMusicMode(mode) {
    if (mode === this.mode && !this.pendingMode) return;
    if (!this.musicOn) {
      this.mode = mode;
      return;
    }
    this.pendingMode = mode;
  }

  startMusic(delay = 0.1) {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.loop = 0;
    this.nextTime = this.ctx.currentTime + delay;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  setPercussion(on) {
    if (on === this.percOn || !this.ctx) return;
    this.percOn = on;
    this.percBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.4);
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const bpm = this.mode === 'game' ? CONFIG.audio.gameBpm : CONFIG.audio.menuBpm;
      const sixteenth = 60 / bpm / 4;
      const when = this.nextTime - this.ctx.currentTime;
      if (this.mode === 'game') this.playGameStep(this.step, when, sixteenth);
      else this.playMenuStep(this.step, when, sixteenth);
      this.nextTime += sixteenth;
      this.step++;
      if (this.step % 16 === 0 && this.pendingMode) {
        // switch theme at a bar line, restarting its loop
        this.mode = this.pendingMode;
        this.pendingMode = null;
        this.step = 0;
        this.loop = 0;
      }
      if (this.step >= 16 * 8) {
        this.step = 0;
        this.loop++;
      }
    }
  }

  playGameStep(step, when, six) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CH[GAME_SONG.chords[bar]];

    if (s === 0) this.pad(chord.pad, when, six * 16, 0.028, 1300);

    // Bass groove
    const bassHits = { 0: [0, 3], 3: [12, 1], 6: [0, 2], 8: [0, 3], 11: [12, 1], 14: [7, 2] };
    if (bassHits[s]) this.bass(chord.root + bassHits[s][0], when, six * bassHits[s][1]);

    // Marimba arpeggio on eighths (chord tones, up then down)
    if (s % 2 === 0) {
      const order = [0, 1, 2, 3, 2, 1, 2, 3];
      this.marimba(chord.pad[order[s / 2]] + 12, when, 0.09, { delay: 0.15, verb: 0.25 });
    }

    // Lead melody on even loops, high bell answers on odd loops
    const phrase = GAME_SONG.melody[bar];
    for (const [st, n, len] of phrase) {
      if (st !== s) continue;
      if (this.loop % 2 === 0) this.lead(n, when, six * len);
      else if (len >= 4) this.marimba(n + 12, when, 0.07, { delay: 0.4, verb: 0.5 });
    }

    // Base groove: kick + soft hats + shaker
    if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) this.kick(when, 0.55);
    if (s % 2 === 1) this.shaker(when, 0.03);
    if (s % 4 === 2) this.hat(when, 0.05);

    // Combo layer: backbeat, open hats, extra fills
    if (s === 4 || s === 12) this.snare(when, 0.28);
    if (s === 14) this.hat(when, 0.07, true, this.percBus);
    if (s % 2 === 0) this.hat(when, 0.05, false, this.percBus);
    if (bar === 7 && s >= 12) this.snare(when, 0.12 + (s - 12) * 0.04);
  }

  playMenuStep(step, when, six) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CH[MENU_SONG.chords[bar]];
    const first = bar % 2 === 0;

    if (s === 0 && first) this.pad(chord.pad, when, six * 32, 0.034, 900);
    if (s === 0) this.bass(chord.root, when, six * 12, 0.22);
    if (s === 8 && !first) this.bass(chord.root + 7, when, six * 6, 0.16);

    // Gentle quarter-note mallets
    if (s % 4 === 0) {
      const order = [0, 2, 1, 3];
      this.marimba(chord.pad[order[s / 4]] + 12, when, 0.075, { delay: 0.35, verb: 0.55 });
    }
    // Sparse bell melody
    for (const [st, n, len] of MENU_SONG.bells[bar]) {
      if (st === s && (this.loop > 0 || bar >= 2)) this.marimba(n + 12, when, 0.055 + (len > 8 ? 0.02 : 0), { delay: 0.5, verb: 0.7 });
    }
    if (s % 4 === 2) this.shaker(when, 0.018);
  }
}

export const sfx = new Sfx();
