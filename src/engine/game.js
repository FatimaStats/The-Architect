// ---------------------------------------------------------------------------
// Game rules orchestration. `step(level, state, action)` is a pure function:
// it never mutates its input and always yields the same result for the same
// input, which is what makes undo, replays and the solver trivial.
//
// Order of resolution for one turn:
//   1. roll the active block (or wait)         -> physics
//   2. arrival effects: gravity drift, teleport, elevator, fragile
//   3. crumble vacated tiles, collect keys
//   4. signals (switches, plates, lasers)      -> mechanics
//   5. world tick: moving + rotating platforms
//   6. signals again, support check, win check
// ---------------------------------------------------------------------------
import { roll, footprintIdx, land, isUpright } from './physics.js';
import {
  tileAt, floorAt, canEnter, updateSignals, teleportTarget, gravityDir,
  triggerElevator, breaksFragile, crumble, collectKeys, tickPlatforms, tickRotors,
} from './mechanics.js';

const MAX_CHAIN = 16;

export function cloneState(s) {
  return {
    ...s,
    blocks: s.blocks.map((b) => ({ ...b })),
    gone: [...s.gone],
    keys: [...s.keys],
    toggles: { ...s.toggles },
    swPressed: [...s.swPressed],
    elev: { ...s.elev },
    plats: s.plats.map((p) => ({ ...p })),
    rotors: s.rotors.map((r) => ({ ...r })),
    signals: { ...s.signals },
  };
}

export function createInitialState(level) {
  const s = {
    blocks: level.blocks.map((b) => ({ x: b.x, y: b.y, o: b.o, kind: b.kind, prime: !!b.prime, z: 0 })),
    gone: [],
    keys: [],
    toggles: { ...(level.def.toggles || {}) },
    swPressed: [],
    elev: {},
    plats: level.platforms.map((p) => ({ i: p.start, d: 1 })),
    rotors: level.rotors.map((r) => ({ rot: r.rot, pending: 0, last: false })),
    signals: {},
    beam: { cells: [], paths: [], lit: [] },
    status: 'playing',
    lost: null,
    moves: 0,
  };
  for (const e of level.elevators) s.elev[e.i] = e.low ?? 0;
  s.blocks.forEach((b) => {
    b.z = floorAt(level, s, footprintIdx(b)[0]) ?? 0;
  });
  // Blocks that start on switches must not toggle them.
  s.swPressed = level.switches.filter((t) => s.blocks.some((b) => footprintIdx(b).includes(t.i))).map((t) => t.i);
  updateSignals(level, s, null);
  level.rotors.forEach((r) => (s.rotors[r.id].last = !!s.signals[r.signal]));
  collectKeys(level, s, []);
  return s;
}

function fall(s, bi, reason, events) {
  s.status = 'lost';
  s.lost = { b: bi, reason };
  events.push({ type: 'fall', b: bi, reason });
}

/** Roll block bi one step. Returns false if the move is not allowed. */
function rollBlock(level, s, bi, dir, events, vacated, cause) {
  const b = s.blocks[bi];
  const n = roll(b, dir);
  if (!canEnter(level, s, bi, n, dir)) return false;
  vacated.push(...footprintIdx(b));
  const heights = footprintIdx(n).map((i) => floorAt(level, s, i));
  const l = land(heights);
  const from = { ...b };
  n.z = l.ok ? l.z : b.z;
  Object.assign(b, n);
  events.push({ type: 'roll', b: bi, from, to: { ...b }, dir, cause });
  if (!l.ok) {
    fall(s, bi, 'void', events);
    return true;
  }
  const f = breaksFragile(level, s, bi);
  if (f !== -1) {
    s.gone.push(f);
    s.gone.sort((a, c) => a - c);
    events.push({ type: 'break', i: f });
    fall(s, bi, 'fragile', events);
  }
  return true;
}

/** Effects that happen when a block arrives somewhere by its own motion. */
function arrive(level, s, bi, events, vacated) {
  for (let n = 0; n < MAX_CHAIN && s.status === 'playing'; n++) {
    const g = gravityDir(level, s, bi);
    if (!g) break;
    if (!rollBlock(level, s, bi, g, events, vacated, 'gravity')) break;
  }
  if (s.status !== 'playing') return;
  const tp = teleportTarget(level, s, bi);
  if (tp) {
    const b = s.blocks[bi];
    const from = { ...b };
    vacated.push(...footprintIdx(b));
    Object.assign(b, tp);
    events.push({ type: 'teleport', b: bi, from, to: { ...b } });
    return;
  }
  triggerElevator(level, s, bi, events);
}

/**
 * Advance the simulation by one turn.
 * action = { b: blockIndex, dir: 'N'|'E'|'S'|'W' }  or  { wait: true }
 * Returns { state, events } or null if the action is not possible.
 */
export function step(level, prev, action) {
  if (prev.status !== 'playing') return null;
  const s = cloneState(prev);
  const events = [];
  const vacated = [];

  if (!action.wait) {
    if (!rollBlock(level, s, action.b, action.dir, events, vacated, 'player')) return null;
    if (s.status === 'playing') arrive(level, s, action.b, events, vacated);
  }
  s.moves += 1;
  if (s.status !== 'playing') {
    updateSignals(level, s, events);
    return { state: s, events };
  }

  crumble(level, s, vacated, events);
  collectKeys(level, s, events);
  updateSignals(level, s, events);
  tickPlatforms(level, s, events);
  tickRotors(level, s, events);
  collectKeys(level, s, events);
  updateSignals(level, s, events);

  // Support check: platforms, rotors or bridges may have moved out from under a block.
  s.blocks.forEach((b, bi) => {
    if (s.status !== 'playing') return;
    const l = land(footprintIdx(b).map((i) => floorAt(level, s, i)));
    if (!l.ok || l.z !== b.z) fall(s, bi, 'void', events);
  });

  if (s.status === 'playing' && isWon(level, s)) {
    s.status = 'won';
    events.push({ type: 'won' });
  }
  return { state: s, events };
}

export function isWon(level, s) {
  return s.blocks.some((b) => {
    if (!b.prime || !isUpright(b)) return false;
    const t = tileAt(level, footprintIdx(b)[0]);
    return t && t.type === 'exit' && b.z === t.h;
  });
}

/** Canonical key of everything that affects future play (used by the solver). */
export function stateKey(s) {
  return [
    s.blocks.map((b) => `${b.x},${b.y},${b.o},${b.z}`).join(';'),
    s.gone.join(','),
    s.keys.join(','),
    Object.keys(s.toggles).filter((k) => s.toggles[k]).sort().join(','),
    s.swPressed.join(','),
    Object.entries(s.elev).map(([k, v]) => `${k}:${v}`).join(','),
    s.plats.map((p) => `${p.i}${p.d}`).join(','),
    s.rotors.map((r) => `${r.rot}${r.pending}${r.last ? 1 : 0}`).join(','),
  ].join('|');
}
