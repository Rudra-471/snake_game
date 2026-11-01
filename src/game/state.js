// Tiny finite-state machine for the top-level game flow.

export const STATES = Object.freeze({
  MENU: 'MENU',
  TUTORIAL: 'TUTORIAL',
  PLAYING: 'PLAYING',
  WORD_BANKED: 'WORD_BANKED',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

const TRANSITIONS = {
  MENU: ['TUTORIAL', 'PLAYING'],
  TUTORIAL: ['PLAYING', 'WORD_BANKED', 'PAUSED', 'MENU', 'GAME_OVER'],
  PLAYING: ['WORD_BANKED', 'PAUSED', 'GAME_OVER', 'MENU', 'TUTORIAL'],
  WORD_BANKED: ['PLAYING', 'TUTORIAL', 'PAUSED', 'GAME_OVER', 'MENU'],
  PAUSED: ['PLAYING', 'TUTORIAL', 'WORD_BANKED', 'MENU', 'GAME_OVER'],
  GAME_OVER: ['MENU', 'PLAYING', 'TUTORIAL'],
};

export class StateMachine {
  constructor(initial = STATES.MENU) {
    this.current = initial;
    this.previous = null;
    this.listeners = new Set();
  }

  is(...states) {
    return states.includes(this.current);
  }

  /** Playing-like states where the snake simulation is live. */
  get active() {
    return this.current === STATES.PLAYING || this.current === STATES.TUTORIAL;
  }

  set(next) {
    if (next === this.current) return true;
    if (!TRANSITIONS[this.current].includes(next)) {
      console.warn(`[state] blocked transition ${this.current} → ${next}`);
      return false;
    }
    this.previous = this.current;
    this.current = next;
    for (const fn of this.listeners) fn(next, this.previous);
    return true;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
