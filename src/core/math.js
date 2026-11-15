// Math modes: round state + board generation. Pure functions (no DOM / three.js),
// like spawner.js, so they can be tested on their own.
//
// A "round" is one task shown at the top of the HUD. The board is a set of number
// tiles: `valid` ones answer the task, `decoy` ones are mistakes (they cost a life).
//
//   same      – a target count is shown. The first number you eat becomes the
//               target; keep eating that same number until you reach the count.
//   compare   – "GREATEST" or "SMALLEST": eat that number from the board.
//   parity    – "EVEN" or "ODD": keep eating numbers of that kind.
//   sequence  – "AFTER" or "BEFORE": eat any number, then the one right after
//               (or right before) the number you ate last.
//   multiples – a table (2s, 3s, 4s, 5s, 10s): eat every multiple on the board.

export const MATH_MIN = 0;
export const MATH_MAX = 100;
export const TABLES = [2, 3, 4, 5, 10];
export const ROUND_LENGTH = 5; // correct answers per round (compare / parity / sequence)
export const BOARD_SIZE = 5;

export const MATH_TYPES = ['same', 'compare', 'parity', 'sequence', 'multiples'];

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Distinct random numbers in [min, max] that pass `ok` and are not in `exclude`. */
function sampleNumbers(rng, count, ok = () => true, exclude = [], min = MATH_MIN, max = MATH_MAX) {
  const seen = new Set(exclude);
  const out = [];
  for (let tries = 0; out.length < count && tries < 2000; tries++) {
    const n = randInt(rng, min, max);
    if (seen.has(n) || !ok(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

const inRange = (n) => n >= MATH_MIN && n <= MATH_MAX;
const parityOf = (n) => (n % 2 === 0 ? 'even' : 'odd');

/** Alternate two-way goals so players practise both (greatest/smallest, even/odd…). */
function nextGoal(options, prev, rng) {
  if (prev && prev.goal) return options.find((o) => o !== prev.goal);
  return pick(rng, options);
}

/**
 * Start a new round.
 * @param {string} type one of MATH_TYPES
 * @param {() => number} rng
 * @param {object|null} prev the round before (used to alternate goals / tables)
 */
export function newRound(type, rng, prev = null) {
  const base = { type, got: 0, eaten: [] };
  switch (type) {
    case 'same':
      return { ...base, count: randInt(rng, 2, 5), target: null };
    case 'compare':
      return { ...base, goal: nextGoal(['greatest', 'smallest'], prev, rng), need: ROUND_LENGTH };
    case 'parity':
      return { ...base, goal: nextGoal(['even', 'odd'], prev, rng), need: ROUND_LENGTH };
    case 'sequence':
      return { ...base, goal: nextGoal(['after', 'before'], prev, rng), need: ROUND_LENGTH, last: null };
    case 'multiples': {
      const options = prev ? TABLES.filter((t) => t !== prev.table) : TABLES;
      // `need` is set once the board is placed (how many multiples actually landed)
      return { ...base, table: pick(rng, options), need: 0 };
    }
    default:
      throw new Error(`Unknown math mode: ${type}`);
  }
}

/** The number that answers a sequence round right now (null before the first pick). */
export function sequenceAnswer(round) {
  if (round.last == null) return null;
  return round.goal === 'after' ? round.last + 1 : round.last - 1;
}

/** Wrong answers that look close to `n` (±1, ±10, reversed digits) to make players think. */
function lookAlikes(n, avoid) {
  const rev = Number(String(n).split('').reverse().join(''));
  return [n + 1, n - 1, n + 10, n - 10, rev, n + 2, n - 2].filter((x, i, a) => inRange(x) && !avoid.includes(x) && a.indexOf(x) === i);
}

function withDecoys(valid, decoys) {
  return [...valid.map((n) => ({ n, kind: 'valid' })), ...decoys.map((n) => ({ n, kind: 'decoy' }))];
}

/**
 * Numbers to put on the board for the current round. Valid tiles come first so
 * they are placed first if the board is crowded.
 * @returns {{ n:number, kind:'valid'|'decoy' }[]}
 */
export function boardFor(round, rng) {
  switch (round.type) {
    case 'same': {
      if (round.target == null) return withDecoys(sampleNumbers(rng, BOARD_SIZE), []); // free choice
      const t = round.target;
      const near = lookAlikes(t, [t]).sort(() => rng() - 0.5).slice(0, 2);
      const decoys = [...near, ...sampleNumbers(rng, BOARD_SIZE - 1 - near.length, () => true, [t, ...near])];
      return withDecoys([t], decoys);
    }
    case 'compare': {
      const nums = sampleNumbers(rng, BOARD_SIZE);
      const answer = round.goal === 'greatest' ? Math.max(...nums) : Math.min(...nums);
      return withDecoys([answer], nums.filter((n) => n !== answer));
    }
    case 'parity': {
      const want = round.goal;
      const valid = sampleNumbers(rng, randInt(rng, 1, 2), (n) => parityOf(n) === want);
      const decoys = sampleNumbers(rng, BOARD_SIZE - valid.length, (n) => parityOf(n) !== want, valid);
      return withDecoys(valid, decoys);
    }
    case 'sequence': {
      if (round.last == null) {
        // Free first pick: any number that has a next (or previous) number
        const ok = round.goal === 'after' ? (n) => n < MATH_MAX : (n) => n > MATH_MIN;
        return withDecoys(sampleNumbers(rng, BOARD_SIZE - 1, ok), []);
      }
      const answer = sequenceAnswer(round);
      const opposite = round.goal === 'after' ? round.last - 1 : round.last + 1;
      const near = [round.last, opposite, ...lookAlikes(answer, [answer, round.last, opposite])]
        .filter((x, i, a) => inRange(x) && x !== answer && a.indexOf(x) === i)
        .slice(0, 3);
      const decoys = [...near, ...sampleNumbers(rng, BOARD_SIZE - 1 - near.length, () => true, [answer, ...near])];
      return withDecoys([answer], decoys);
    }
    case 'multiples': {
      const tb = round.table;
      const valid = sampleNumbers(rng, randInt(rng, 2, 3), (n) => n % tb === 0, [], 1);
      const decoys = sampleNumbers(rng, BOARD_SIZE + 1 - valid.length, (n) => n % tb !== 0, valid, 1);
      return withDecoys(valid, decoys);
    }
    default:
      return [];
  }
}

/** Record a correct answer. @returns {boolean} true if the round is complete. */
export function applyCorrect(round, n) {
  round.got++;
  round.eaten.push(n);
  switch (round.type) {
    case 'same':
      if (round.target == null) round.target = n;
      return round.got >= round.count;
    case 'sequence':
      round.last = n;
      // Stop early at the edge of the number range (nothing after 100 / before 0)
      return round.got >= round.need || (round.goal === 'after' && n >= MATH_MAX) || (round.goal === 'before' && n <= MATH_MIN);
    default:
      return round.got >= round.need;
  }
}

/** True if the board should be refilled after every correct answer (not in Multiples). */
export function refillsEachAnswer(round) {
  return round.type !== 'multiples';
}

/** Short feedback for a wrong number. `answers` are the valid numbers on the board. */
export function explainMistake(round, n, answers = []) {
  switch (round.type) {
    case 'same':
      return `${n} is not ${round.target}!`;
    case 'compare':
      return answers.length ? `${answers[0]} is the ${round.goal}!` : `Find the ${round.goal}!`;
    case 'parity':
      return `${n} is ${parityOf(n)}!`;
    case 'sequence':
      return `${sequenceAnswer(round)} comes ${round.goal} ${round.last}!`;
    case 'multiples':
      return `${n} is not in the ${round.table}s!`;
    default:
      return 'Not that one!';
  }
}

/**
 * What the HUD shows for a round.
 * @returns {{ label:string, chips:{text:string, state:'done'|'todo'}[], hint:string, say:string }}
 */
export function describeRound(round) {
  const done = round.eaten.map((n) => ({ text: String(n), state: 'done' }));
  const todo = (k, text = '?') => Array.from({ length: Math.max(0, k) }, () => ({ text, state: 'todo' }));
  switch (round.type) {
    case 'same':
      if (round.target == null) {
        return {
          label: `Eat ${round.count} the same`,
          chips: todo(round.count),
          hint: `Eat any number, then eat that same number until you have ${round.count}`,
          say: `Pick a number, and eat it ${round.count} times`,
        };
      }
      return {
        label: `Find ${round.target}`,
        chips: [...done, ...todo(round.count - round.got, String(round.target))],
        hint: `${round.got} of ${round.count} · keep eating ${round.target}`,
        say: '',
      };
    case 'compare':
      return {
        label: round.goal === 'greatest' ? 'Greatest' : 'Smallest',
        chips: [...done, ...todo(round.need - round.got)],
        hint: `Eat the ${round.goal} number on the board (${round.got}/${round.need})`,
        say: `Eat the ${round.goal} number`,
      };
    case 'parity':
      return {
        label: round.goal === 'even' ? 'Even' : 'Odd',
        chips: [...done, ...todo(round.need - round.got)],
        hint: `Eat the ${round.goal} numbers (${round.got}/${round.need})`,
        say: `Eat the ${round.goal} numbers`,
      };
    case 'sequence':
      return {
        label: round.goal === 'after' ? 'After' : 'Before',
        chips: [...done, ...todo(round.last == null ? 1 : Math.min(1, round.need - round.got))],
        hint: round.last == null ? `Eat any number to start counting ${round.goal === 'after' ? 'up' : 'down'}` : `What comes just ${round.goal} ${round.last}?`,
        say: round.goal === 'after' ? 'Eat a number, then the number that comes after it' : 'Eat a number, then the number that comes just before it',
      };
    case 'multiples':
      return {
        label: `Count by ${round.table}`,
        chips: [...done, ...todo(round.need - round.got)],
        hint: `Eat every multiple of ${round.table} on the board (${round.got}/${round.need})`,
        say: `Eat all the multiples of ${round.table}`,
      };
    default:
      return { label: '', chips: [], hint: '', say: '' };
  }
}

/** Title + explanation for the round-complete card. */
export function roundSummary(round) {
  const list = round.eaten.join(', ');
  switch (round.type) {
    case 'same':
      return { emoji: '🎯', title: `${round.count} × ${round.target}`, def: `You found ${round.count} of the same number: ${round.target}!` };
    case 'compare':
      return { emoji: '⚖️', title: round.goal, def: `You picked the ${round.goal} number: ${list}.` };
    case 'parity':
      return { emoji: '🔢', title: `${round.goal} numbers`, def: `${list} are all ${round.goal}!` };
    case 'sequence':
      return { emoji: '🪜', title: round.goal === 'after' ? 'Counting up' : 'Counting down', def: round.eaten.join(' → ') };
    case 'multiples':
      return { emoji: '✖️', title: `${round.table}s`, def: `${[...round.eaten].sort((a, b) => a - b).join(', ')} are multiples of ${round.table}.` };
    default:
      return { emoji: '⭐', title: 'Round complete', def: '' };
  }
}

/** Points for finishing a round (before combo / double bonuses). */
export function roundBasePoints(round) {
  return 10 + 5 * round.got;
}

/** Points for each correct number. */
export const POINTS_PER_CORRECT = 5;
