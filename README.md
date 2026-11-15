# Word Serpent 🐍

A 3D educational word-building snake game for the browser. Steer the serpent, eat letter blocks to spell real words along its back, then eat the glowing ✓ crystal to bank the word into a floating 3D word chain.

Built with Vite, vanilla JavaScript, three.js, GSAP, the Web Audio API and the Web Speech API. There are no image, model or audio files: every mesh is built from three.js primitives and every sound is synthesized in code.

## Setup

```bash
npm install
npm run dev      # open the printed URL (default http://localhost:5173)
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Requires Node 18+. The 3D letter font (`helvetiker_bold`) loads from a CDN, so the first launch needs an internet connection. The loader tries three CDNs in turn; the list is in `CONFIG.font.urls`.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Steer | Arrow keys / WASD | Swipe anywhere, or the on-screen D-pad |
| Pause / resume | P or Esc | ⏸ button |
| Start from the main menu | Enter / Space | Tap **Play** |

One turn is buffered ahead, so quick double-taps like ↑ then → work. 180° reversals are ignored.

## How to play

- Eat a letter to start a word. The letter lands on a new body segment, so the snake spells the word along its back.
- After every letter, all remaining tiles vanish and a new set spawns. At least one tile always continues a real word.
- When your letters form a real word of 3 or more letters, a glowing ✓ crystal appears. Eat it to bank the word: you get slow motion, confetti, a camera orbit, spoken pronunciation and a definition card.
- **Formed words stay on the snake.** Their letters turn gold, a glowing link knot is added after the word, and a beam of light connects every formed word along the body. Your next word starts after the link. Copies of the letters also fly up into the floating sky chain.
- Because formed words stay, the snake keeps growing, like classic snake. A decoy only breaks the unfinished word. A crash scatters the body back to 3 segments, but your words stay in the sky chain and in your score.
- Decoy letters can't continue the word. In Kids mode a decoy just bounces away (−5 points). In Normal the word breaks and you lose a life. In Hard it ends the game.

### Power-ups

About one letter set in five also contains a power-up. Eating one never affects your word.

| Power-up | Look | Effect |
| --- | --- | --- |
| Slow motion | cyan hourglass | The snake moves 1.6× slower for 8 seconds |
| Hint | yellow lightbulb | Letters that continue your word glow with a ground ring until you bank it |
| Double | pink star | Your next banked word scores ×2 |

### Things to tap and click

- Tap a letter tile to hear the letter said aloud.
- Tap a word in the sky chain to hear the word.
- Tap the snake's head to make it giggle and squish.
- In the main menu, the snake's eyes follow your cursor.

Other effects you'll see during play:
- A fire trail of sparks follows the snake while your combo is 3 or more.
- Fireworks go off every 5 words.

### Intro movie

On startup a "click to begin" screen appears. The click is needed because browsers block sound until you interact with the page. Then a short letterboxed cinematic plays:
1. Captions over black.
2. A crane shot across the world.
3. 3D title tiles slamming down in time with timpani hits.
4. A flash and music sting, then a glide into the menu.

Click or press any key to skip it. To turn it off, use Settings → *Play intro movie on start*.

### Choosing a game

After the intro, a **"What do you want to play?"** screen offers **Word Games** (English) or one of the five **Math** games. Word Games opens the word menu (its **← All games** button returns here). Quitting a math game also comes back here.

### Word modes

| Mode | Rules |
| --- | --- |
| Classic | Endless, 3 lives, speeds up every 5 words. Easy / Normal / Hard. |
| Time Attack | 120 seconds, unlimited lives. Easy / Normal / Hard. |
| Word Chain | Each word must start with the last letter of the previous word (+50% bonus). |
| Kids / Learn | Slow, 3–5 letter words, valid letters glow with a ground ring, no game over. |
| Daily Challenge | Classic rules, with letter choices seeded by today's date so everyone gets the same letters. |
| Simple Words | Only the starter list (am, an, at, be… cat, bat, man, bus…). 2-letter words can be banked. 3 lives, 1 decoy, slower speed. |

Difficulty: Easy has 1 decoy, Normal 2 and Hard 3. Hard also adds obstacles, and any crash or decoy ends the run.

### Math modes

All math games use numbers 0–100 on the tiles, 3 lives, and speed up every 5 rounds. A task is shown at the top of the screen with progress chips. Each correct number lands on the snake's body; when a round is finished those numbers turn gold.

| Game | What to do |
| --- | --- |
| Same Number | A count is shown (2–5). The first number you eat becomes the target; keep eating that same number until you reach the count. Then a new count appears and you choose again. |
| Greater / Smaller | The task says **Greatest** or **Smallest**: eat that number from the board. 5 per round, then it switches. |
| Even / Odd | The task says **Even** or **Odd**: keep eating numbers of that kind. 5 per round, then it switches. |
| Before / After | The task says **After** or **Before**. Eat any number, then the number right after (or right before) the one you just ate. 5 per round, then it switches. |
| Skip Counting | The task says **Count by 2 / 3 / 4 / 5 / 10**: eat every multiple of it on the board. |

A wrong number costs a life, and a banner explains why (for example "37 is odd!"). Your progress in the round is kept. A crash also costs a life and restarts the current round. The rules live in [`src/core/math.js`](src/core/math.js) as pure functions.

### Scoring

- Each letter is worth its Scrabble value (A E I O U L N S T R = 1, D G = 2, B C M P = 3, F H V W Y = 4, K = 5, J X = 8, Q Z = 10).
- Length multiplier: 3 letters ×1, 4 ×1.5, 5 ×2, 6 ×3, 7+ ×4.
- Combo: +10% for each consecutive word banked without a mistake, capped at +100%.
- Speed: +20% if banked within 8 s of the word's first letter.
- Chain: +50% in Word Chain mode. Repeating a word in the same session halves its score.

## How the Trie-based spawning works

All the spawning logic lives in [`src/core/trie.js`](src/core/trie.js) and [`src/core/spawner.js`](src/core/spawner.js), and both files are heavily commented.

1. **Build.** At load, each word list is inserted into a Trie (prefix tree). Each node represents a prefix. A post-order pass then stores two values on every node:
   - `wordCount`: how many words end somewhere in the node's subtree.
   - `maxDepth`: the length of the longest word passing through the node. This drives the HUD hint "Longest word possible from here".
2. **Choose letters** (`chooseLetters`):
   - With an empty prefix, it spawns 4–5 first letters, weighted by `wordCount`, so letters that start many words appear more often.
   - With prefix P, the valid letters are P's children whose subtree still reaches a word of 3+ letters. It samples 2–3 of them, weighted by `wordCount`, which favours rich, long-word branches.
   - It then adds decoys: letters that are not children of P, weighted by English letter frequency so they look plausible.
   - If P is itself a word of 3+ letters, a ✓ tile is added.
   - Every node lies on the path to some word, so a valid prefix always has a child or is a word. A way forward always exists, and a fuzz test of 40,000 random walks found no dead ends.
3. **Place tiles** (`placeTiles`):
   - Tiles never land on the snake or obstacles, never in the 2 cells directly ahead of the head, and stay at least 2 cells apart.
   - Tiles only go on cells the head can reach, checked with a flood fill around the body.
   - Valid tiles are placed first, so they still fit if the board is crowded.
4. **Timeout.** A tile not eaten within 15 s flashes, then hops to a new spot with the same letter.

## Adding a word list

Edit [`src/core/wordlists.js`](src/core/wordlists.js):

- **General words:** add space-separated lowercase words to the `GENERAL` template string. Anything outside 3–8 letters (a–z only) is filtered out automatically, and duplicates are removed.
- **A themed list with emoji and definitions:** add a key to `THEME_DATA` with one `word|emoji|definition` entry per line, then give it a label in `THEME_LABELS`:

  ```js
  ocean: `
  coral|🪸|A colorful sea creature that builds reefs.
  reef|🐠|A ridge of coral full of fish.
  `,
  ```

  Themed words are added to the playable list automatically. They show their emoji and definition on the bank card and in the Dictionary, which also gets a filter tab for the new theme.
- Kids mode uses every word of 5 letters or fewer (`KIDS_WORDS`), and the tutorial uses `TUTORIAL_WORDS`.
- Simple Words mode uses the `SIMPLE` list (2–3 letters, `SIMPLE_WORDS`). Its 3-letter words are also added to the main list.

## Adding a world

1. Add an entry to `CONFIG.worlds` in [`src/config.js`](src/config.js) with an `id`, `name`, unlock `level` and `emoji`.
2. In [`src/game/arena.js`](src/game/arena.js), add a theme to `WORLD_THEMES`. It needs sky gradient colors, fog, light and hemisphere colors, exposure (color grading), bloom strength and threshold, floor checker colors, ground, wall and dust colors.
   - Keep `bloomThreshold` above the brightness of lit surfaces (around 1.1–1.25 for daytime worlds), so only emissive objects glow.
3. Write a `buildMyWorld(T)` method and register it in the `builders` map in `build()`.
   - Create resources through `this.geo()`, `this.mat()` and `this.canvasTexture()` so they are disposed when the world changes.
   - Push per-frame animation closures onto `this.animators`.
   - Give the theme a `grade` entry (saturation, contrast, tint, vignette).
4. Optionally add an obstacle style in `setObstacles()` and a card gradient (`.world-<id>`) in `src/ui/styles.css`.

## Project structure

```
index.html
src/
  main.js              boot, renderer, fixed-timestep loop, game rules, input, progression
  config.js            every tunable number (speed, grid, scoring, colors, unlocks)
  core/                trie.js · spawner.js · scoring.js · wordlists.js · math.js (math game rules)
  game/                state.js · snake.js · letterTile.js · arena.js · chain.js · modes.js · glyphs.js · intro.js
  fx/                  particles.js · camera.js · postfx.js · popups.js
  audio/               sfx.js (synth SFX + layered music) · speech.js (TTS)
  ui/                  hud.js · menus.js · styles.css
  storage/save.js      localStorage persistence (every access wrapped in try/catch)
```

`glyphs.js` loads the font once and caches one `TextGeometry` per character. `popups.js` holds the pooled flying letters and the 3D score numbers.

## Technical notes

- **Game loop.** The snake moves in fixed logic steps (an accumulator in `main.js`). Rendering interpolates between steps along a path through the cell centres, and the corners are rounded with quadratic Béziers so the body curves through turns.
- **Music.** The music is a lookahead step sequencer (`src/audio/sfx.js`). It plays synthesized instruments: a detuned-saw pad, marimba, plucked bass, a vibrato lead and a drum kit. Everything runs through a generated-impulse reverb and a filtered feedback delay. There are three themes:
  - **Menu:** a calm theme at 78 BPM.
  - **Game:** an upbeat theme at 100 BPM, with a written melody alternating with bell answers. Its drum layer fades in while your combo is 3 or more.
  - **Intro:** a one-shot cinematic cue.

  Themes switch on bar lines.
- **Color grading.** On Medium and High, a final grade pass adds per-world saturation, contrast, tint and a vignette (`WORLD_THEMES[*].grade`).
- **Allocation.** Letter geometries, particles (two `InstancedMesh` pools), tiles, flying letters and score popups are all pooled. Nothing creates geometries or materials in the frame loop.
- **Graphics presets.**
  - **Low:** no shadows, no bloom, pixel ratio 1.
  - **Medium:** 1024 px shadows, half-resolution bloom, pixel ratio up to 1.5.
  - **High:** 2048 px shadows, full-resolution bloom, pixel ratio up to 2.
  - Phones and tablets default to Low.
- **Shadows on three r183+.** `PCFSoftShadowMap` was removed in three r183. `PCFShadowMap` now filters softly, so the game uses it with `shadow.radius` and avoids the deprecation warning.
- **Tab hidden.** The game pauses and audio is suspended when the tab is hidden.
- **Saved progress.** High scores per mode, daily best, XP and level, unlocked worlds and skins, discovered words, achievements, settings and tutorial completion are all saved.
- **Unlocking for testing.** Settings → *Parent / teacher: unlock all* opens every world and skin. Worlds normally unlock by level and skins by lifetime score.
- **Debugging.** In dev builds the game instance is available as `window.__game` in the browser console.
