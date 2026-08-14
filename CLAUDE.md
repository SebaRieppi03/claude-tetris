# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page Tetris implementation in vanilla JavaScript (ES6+), HTML5 Canvas, and CSS. No dependencies, no build step, no package.json, no test suite.

## Running the game

Open `index.html` directly in a browser, or serve it statically:

```bash
python3 -m http.server 8000
# or
npx serve .
```

There is no build, lint, or test command — the three files are used as-is.

## Architecture

Everything lives in three files that load directly via `<script>`/`<link>` tags — no modules, no bundler:

- `index.html` — DOM structure: the main `<canvas id="board">` (300×600, i.e. `COLS×BLOCK` by `ROWS×BLOCK`), a side panel (score/lines/level/next-piece preview), and the pause/game-over overlay.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, structured around a few core pieces:
  - **Board model**: a `ROWS × COLS` matrix (`board`); each cell is `0` (empty) or a color index `1–7` identifying a locked piece.
  - **Piece definitions**: `PIECES` array of square matrices (index 0 unused, 1–7 are I/O/T/S/Z/J/L). Rotation is done via `rotateCW` (transpose + row reverse), not by storing pre-rotated states.
  - **Collision** (`collide`): checks board bounds and overlap with locked cells.
  - **Wall kicks** (`tryRotate`): after rotating, tries offsets `[0, -1, 1, -2, 2]` columns until a non-colliding position is found.
  - **Game loop** (`loop`): driven by `requestAnimationFrame`; accumulates elapsed time in `dropAccum` and advances the piece one row once `dropInterval` is exceeded.
  - **Line clearing** (`clearLines`): scans bottom-to-top, splices full rows out and unshifts empty rows at the top.
  - **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; hard drop adds 2 pts/row dropped, soft drop adds 1 pt/row.
  - **Leveling/speed**: level increments every 10 lines; `dropInterval = max(100, 1000 - (level-1)*90)` ms.
  - **Ghost piece** (`ghostY`): projects the current piece straight down to its landing row, drawn at `globalAlpha = 0.2`.

  Module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) is reset in `init()` and mutated throughout — there is no encapsulation/class structure, so changes to one function's assumptions about this state can easily break others.

  Game flow: `init()` builds the board, seeds `next`, calls `spawn()`, and starts the RAF loop. Each `loop()` tick may drop the piece or call `lockPiece()` (merge → clear lines → spawn next). Keyboard input (`keydown` listener at the bottom of the file) handles movement, rotation, soft/hard drop, and pause; a fresh piece colliding immediately on `spawn()` triggers `endGame()`.

## Tunable constants (in `game.js`)

`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, initial `dropInterval`. If `COLS`/`ROWS`/`BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).
