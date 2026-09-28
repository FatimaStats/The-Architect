# The Architect

A minimalist block-rolling puzzle game built with React and Three.js. No database: progress is kept in the browser's `localStorage`.

## Run it

```bash
npm install
npm run dev            # development server (http://localhost:5173)
npm run build          # production build → dist/
npm run build:single   # one self-contained page → dist-artifact/the-architect.html
npm run verify         # solve every level with BFS and check stored optimal scores
```

Add `?unlock=all` to the URL to open every level while testing.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Roll | Arrow keys / WASD | Swipe or on-screen pad |
| Undo | Z, Backspace, Ctrl/⌘+Z | Undo button |
| Restart | R | Restart button |
| Wait one turn (levels with moving parts) | Space | Wait |
| Switch block (levels with a helper cube) | Tab / Q | Swap |
| Field notes | H | Notes button |
| Level selection | Esc | Levels button |

Directions are screen-relative: "up" always rolls the block away from you on screen.

## Architecture

```
src/
  engine/        pure, deterministic game logic (no DOM, no Three.js)
    level.js       level compiler: ASCII map + legend → engine data
    physics.js     block poses, rolling, landing rule
    mechanics.js   every tile/object behaviour: signals, lasers, platforms…
    game.js        turn orchestration: step(level, state, action) → next state
    solver.js      breadth-first solver (optimal move counts, verification)
  levels/        level data only, one file per chapter
  input/         keyboard + swipe → screen-space intents
  render/        Three.js renderer, palette, synthesised audio
  progress/      localStorage persistence, unlocking, completion records
  game/          Session: undo history, timing, glue between engine and view
  ui/            React HUD, level select, panels, touch pad
tools/verify-levels.mjs   CI-style check of all levels
```

`step()` never mutates its input, so undo is a stack of states and the solver can explore the state graph directly. The renderer only receives `(previousState, nextState, events)` and animates the difference; it never changes the game.

### Turn order

1. Roll the active block (or wait).
2. Arrival effects: gravity tumbling → teleport → elevator. Fragile tiles break under a standing bar.
3. Vacated hollow tiles disappear; keys touched are collected.
4. Signals update (switch edges, plates, lasers ↔ receivers to a fixed point).
5. World tick: moving platforms advance, turntables rotate.
6. Signals again, support check (a block without full support falls), win check.

## Adding a level

Add an object to a chapter file in `src/levels/`, then run `npm run verify -- --write` to fill in its optimal move count. No engine changes are needed.

```js
{
  id: '7-1',
  name: 'Example',
  teaches: 'What this level introduces',
  brief: 'One or two sentences shown when the level opens.',
  legend: {                                   // level-specific map characters
    P: { type: 'plate', signal: 'a' },        // held plate drives signal 'a'
    D: { type: 'door', signal: 'a' },
  },
  map: [
    '....      ',
    '.S..PD....',
    '....  ..E.',
  ],
  heights: ['', '', '0000001111'],            // optional per-cell heights
  blocks: [{ x: 1, y: 1 }, { x: 0, y: 2, kind: 'cube' }], // optional; 'S' otherwise
  platforms: [{ path: [[4, 3], [5, 3]], signal: 'p' }],   // optional
  rotors: [{ center: [6, 2], arms: [[-1, 0], [1, 0]], signal: 't', rot: 0 }], // optional
  optimal: 0,
}
```

Default map characters: `.` floor, `S` start, `E` exit, `f` fragile, `c` hollow (disappearing), `> < ^ v` one-way, `#` column, `k` key, `L` lock, `=` platform rail, space = void.

Legend types: `floor`, `exit`, `fragile`, `crumble`, `oneway {dir}`, `plate {signal, heavy}`, `switch {signal, heavy}`, `door {signal, invert}`, `bridge {signal, invert}`, `key {id}`, `lock {id}`, `teleporter {to:[x,y]}`, `gravity {dir}`, `elevator {low, high}`, `wall`, `emitter {dir}`, `mirror {orient:'/'|'\\', signal}`, `receiver {signal}`.

## Levels

30 levels in six chapters, each verified solvable by the BFS solver, with its optimal move count stored in the level data:

1. **Foundations**: rolling, corners, parity, fragile tiles
2. **Mechanisms**: pressure plates, doors, switches, bridges, a helper cube
3. **Interference**: keys and locks, one-way and hollow tiles, lasers, mirrors, receivers
4. **Transit**: teleporters, moving platforms, pinning, signal-driven platforms
5. **Elevation**: terraces, lifts, turntables, gravity fields
6. **Synthesis**: multi-mechanic puzzles, ending with *The Architect*
