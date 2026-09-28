// ---------------------------------------------------------------------------
// Breadth-first solver. Because the engine is deterministic, BFS over the
// state graph yields a guaranteed-optimal move count. Used offline to verify
// every level is solvable and to record its optimal score, and in-game as an
// optional hint.
// ---------------------------------------------------------------------------
import { step, stateKey } from './game.js';
import { DIR_KEYS } from './physics.js';

export function actionsFor(level, state) {
  const acts = [];
  state.blocks.forEach((_, b) => DIR_KEYS.forEach((dir) => acts.push({ b, dir })));
  if (level.platforms.length || level.rotors.length) acts.push({ wait: true });
  return acts;
}

export function solve(level, start, { maxStates = 3_000_000 } = {}) {
  const seen = new Map([[stateKey(start), null]]);
  let frontier = [start];
  const parents = [];
  let depth = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const a of actionsFor(level, s)) {
        const r = step(level, s, a);
        if (!r || r.state.status === 'lost') continue;
        const k = stateKey(r.state);
        if (seen.has(k)) continue;
        seen.set(k, { prev: stateKey(s), a });
        if (r.state.status === 'won') {
          // reconstruct
          const path = [];
          let cur = k;
          while (seen.get(cur)) {
            const e = seen.get(cur);
            path.unshift(e.a);
            cur = e.prev;
          }
          return { moves: depth + 1, path, explored: seen.size };
        }
        next.push(r.state);
        if (seen.size > maxStates) return { moves: -1, path: null, explored: seen.size, aborted: true };
      }
    }
    frontier = next;
    depth += 1;
    parents.push(next.length);
  }
  return { moves: -1, path: null, explored: seen.size };
}
