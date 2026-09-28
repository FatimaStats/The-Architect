// ---------------------------------------------------------------------------
// Puzzle mechanics: every tile/object behaviour lives here.
// All functions are pure queries or mutate only the working copy of state
// passed to them by the game loop (game.js), so results are deterministic.
// ---------------------------------------------------------------------------
import { idx, ix, iy, OBSTACLE_TYPES } from './level.js';
import { DIRS, footprint, footprintIdx, poseFromCells, isSingleCell, isUpright } from './physics.js';

// ----- helpers --------------------------------------------------------------

export const tileAt = (level, i) => level.tiles.get(i) || null;
export const sig = (s, name) => !!(name && s.signals[name]);

export function occupant(s, i, exclude = -1) {
  for (let n = 0; n < s.blocks.length; n++) {
    if (n === exclude) continue;
    if (footprintIdx(s.blocks[n]).includes(i)) return n;
  }
  return -1;
}

const pushSorted = (arr, v) => {
  if (!arr.includes(v)) {
    arr.push(v);
    arr.sort((a, b) => a - b);
  }
};

// ----- rotating platforms ---------------------------------------------------

const rotCW = ([dx, dy]) => [-dy, dx];

export function rotorCells(r, rot) {
  const cells = [[0, 0], ...r.arms].map((a) => {
    let v = a;
    for (let k = 0; k < rot % 4; k++) v = rotCW(v);
    return idx(r.cx + v[0], r.cy + v[1]);
  });
  return cells;
}

function rotorAt(level, s, i) {
  for (const r of level.rotors) {
    if (rotorCells(r, s.rotors[r.id].rot).includes(i)) return r;
  }
  return null;
}

// ----- moving platforms -----------------------------------------------------

export const platformCell = (p, st) => p.path[st.i];

function platformAt(level, s, i) {
  for (const p of level.platforms) if (platformCell(p, s.plats[p.id]) === i) return p;
  return null;
}

// ----- dynamic tile state ---------------------------------------------------

export const doorOpen = (s, t) => (sig(s, t.signal) !== !!t.invert) || occupant(s, t.i) !== -1;
export const bridgeSolid = (s, t) => (sig(s, t.signal) !== !!t.invert) || occupant(s, t.i) !== -1;
export const lockOpen = (level, s, t) => (level.keysByGroup[t.id] || []).every((k) => s.keys.includes(k));
export const elevatorHeight = (s, t) => s.elev[t.i] ?? t.low ?? 0;
export const mirrorOrient = (s, t) => (sig(s, t.signal) ? (t.orient === '/' ? '\\' : '/') : t.orient);

/** Height of the walkable surface at cell i, or null for void. */
export function floorAt(level, s, i) {
  if (i < 0) return null;
  const r = rotorAt(level, s, i);
  if (r) return r.h;
  const p = platformAt(level, s, i);
  if (p) return p.h;
  const t = tileAt(level, i);
  if (!t) return null;
  // rail cells of platforms/rotors are void when the platform isn't there
  if (t.type === 'rail') return null;
  if (s.gone.includes(i)) return null;
  if (t.type === 'bridge' && !bridgeSolid(s, t)) return null;
  if (t.type === 'elevator') return elevatorHeight(s, t);
  return t.h;
}

/** True when cell i is a solid obstacle that blocks entry. */
export function isBlocked(level, s, i) {
  const t = tileAt(level, i);
  if (!t) return false;
  if (OBSTACLE_TYPES.has(t.type)) return true;
  if (t.type === 'door') return !doorOpen(s, t);
  if (t.type === 'lock') return !lockOpen(level, s, t);
  return false;
}

// ----- movement validity ---------------------------------------------------

/**
 * Can block `bi` move into pose `n` travelling in `dir`?
 * Entering void is allowed (the block will fall); walls, obstacles, other
 * blocks, laser beams, higher floors and wrong-way one-way tiles are not.
 */
export function canEnter(level, s, bi, n, dir) {
  const b = s.blocks[bi];
  for (const i of footprintIdx(n)) {
    if (i < 0) continue;
    if (occupant(s, i, bi) !== -1) return false;
    if (isBlocked(level, s, i)) return false;
    if (s.beam.cells.includes(i)) return false;
    const t = tileAt(level, i);
    if (t && t.type === 'oneway' && t.dir !== dir) return false;
    const f = floorAt(level, s, i);
    if (f !== null && f > b.z) return false;
  }
  return true;
}

// ----- pressure plates, switches -------------------------------------------

export function isPressed(s, t) {
  for (const b of s.blocks) {
    if (!footprintIdx(b).includes(t.i)) continue;
    if (!t.heavy) return true;
    if (isUpright(b)) return true; // heavy: needs a standing bar's full weight
  }
  return false;
}

// ----- lasers & mirrors ------------------------------------------------------

const REFLECT = {
  '/': ({ dx, dy }) => ({ dx: -dy, dy: -dx }),
  '\\': ({ dx, dy }) => ({ dx: dy, dy: dx }),
};

export function computeBeams(level, s) {
  const cells = [];
  const paths = [];
  const lit = [];
  for (const em of level.emitters) {
    let d = { ...DIRS[em.dir] };
    let x = em.x;
    let y = em.y;
    const pts = [[x, y]];
    const beamH = em.h;
    let end = null;
    for (let steps = 0; steps < 256; steps++) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < -2 || ny < -2 || nx > level.width + 1 || ny > level.height + 1) {
        end = [nx, ny];
        break;
      }
      const i = idx(nx, ny);
      const t = i >= 0 ? tileAt(level, i) : null;
      if (i >= 0 && occupant(s, i) !== -1) {
        end = [nx - d.dx * 0.5, ny - d.dy * 0.5];
        break;
      }
      if (t) {
        if (t.type === 'mirror') {
          pts.push([nx, ny]);
          d = REFLECT[mirrorOrient(s, t)](d);
          x = nx;
          y = ny;
          continue;
        }
        if (t.type === 'receiver') {
          if (!lit.includes(t.i)) lit.push(t.i);
          end = [nx - d.dx * 0.3, ny - d.dy * 0.3];
          break;
        }
        const blocked =
          isBlocked(level, s, i) || (floorAt(level, s, i) ?? -1) > beamH;
        if (blocked) {
          end = [nx - d.dx * 0.5, ny - d.dy * 0.5];
          break;
        }
      }
      if (i >= 0 && !cells.includes(i)) cells.push(i);
      x = nx;
      y = ny;
    }
    pts.push(end);
    paths.push({ h: beamH, pts });
  }
  return { cells, paths, lit };
}

// ----- signals ---------------------------------------------------------------

/**
 * Recompute every signal channel. Switch edges flip toggles; plates and lit
 * receivers drive their channel while active; toggles invert a channel.
 * Lasers and doors can depend on each other, so iterate to a fixed point.
 */
export function updateSignals(level, s, events) {
  const pressedNow = [];
  for (const sw of level.switches) {
    if (!isPressed(s, sw)) continue;
    pressedNow.push(sw.i);
    if (!s.swPressed.includes(sw.i)) {
      s.toggles[sw.signal] = !s.toggles[sw.signal];
      events?.push({ type: 'switch', i: sw.i, signal: sw.signal, on: s.toggles[sw.signal] });
    }
  }
  s.swPressed = pressedNow.sort((a, b) => a - b);

  let lit = [];
  let beam = null;
  for (let iter = 0; iter < 8; iter++) {
    const next = {};
    for (const p of level.plates) if (isPressed(s, p)) next[p.signal] = true;
    for (const r of level.receivers) if (lit.includes(r.i)) next[r.signal] = true;
    for (const [name, on] of Object.entries(s.toggles)) if (on) next[name] = !next[name];
    s.signals = next;
    beam = computeBeams(level, s);
    const same = beam.lit.length === lit.length && beam.lit.every((i) => lit.includes(i));
    lit = beam.lit;
    if (same) break;
  }
  s.beam = beam;
}

// ----- arrival effects (teleporters, gravity, elevators, fragile) ------------

export function teleportTarget(level, s, bi) {
  const b = s.blocks[bi];
  if (!isSingleCell(b)) return null;
  const t = tileAt(level, footprintIdx(b)[0]);
  if (!t || t.type !== 'teleporter') return null;
  const target = t.target;
  if (occupant(s, target, bi) !== -1 || isBlocked(level, s, target)) return null;
  const h = floorAt(level, s, target);
  if (h === null) return null;
  return { x: ix(target), y: iy(target), z: h };
}

export function gravityDir(level, s, bi) {
  for (const i of footprintIdx(s.blocks[bi])) {
    const t = tileAt(level, i);
    if (t && t.type === 'gravity') return t.dir;
  }
  return null;
}

export function triggerElevator(level, s, bi, events) {
  const b = s.blocks[bi];
  if (!isSingleCell(b)) return;
  const i = footprintIdx(b)[0];
  const t = tileAt(level, i);
  if (!t || t.type !== 'elevator') return;
  const cur = elevatorHeight(s, t);
  const nh = cur === t.high ? t.low : t.high;
  s.elev[i] = nh;
  b.z = nh;
  events.push({ type: 'elevator', i, b: bi, from: cur, to: nh });
}

export function breaksFragile(level, s, bi) {
  const b = s.blocks[bi];
  if (!isUpright(b)) return -1;
  const i = footprintIdx(b)[0];
  const t = tileAt(level, i);
  return t && t.type === 'fragile' ? i : -1;
}

// ----- vacated tiles, keys ---------------------------------------------------

export function crumble(level, s, vacated, events) {
  for (const i of vacated) {
    const t = tileAt(level, i);
    if (t && t.type === 'crumble' && !s.gone.includes(i) && occupant(s, i) === -1) {
      pushSorted(s.gone, i);
      events.push({ type: 'crumble', i });
    }
  }
}

export function collectKeys(level, s, events) {
  for (const b of s.blocks) {
    for (const i of footprintIdx(b)) {
      const t = tileAt(level, i);
      if (t && t.type === 'key' && !s.keys.includes(i)) {
        pushSorted(s.keys, i);
        events.push({ type: 'key', i });
      }
    }
  }
}

// ----- world tick: moving and rotating platforms -----------------------------

export function tickPlatforms(level, s, events) {
  for (const p of level.platforms) {
    if (p.path.length < 2) continue;
    if (p.signal && !sig(s, p.signal)) continue;
    const st = s.plats[p.id];
    let d = st.d;
    let ni = st.i + d;
    if (ni < 0 || ni >= p.path.length) {
      if (p.loop) ni = (ni + p.path.length) % p.path.length;
      else {
        d = -d;
        ni = st.i + d;
      }
    }
    const cur = p.path[st.i];
    const next = p.path[ni];
    const riders = [];
    let pinned = false;
    s.blocks.forEach((b, n) => {
      const fp = footprintIdx(b);
      if (!fp.includes(cur)) return;
      if (isSingleCell(b) && b.z === p.h) riders.push(n);
      else pinned = true; // a lying block straddling the edge holds it in place
    });
    if (pinned) continue;
    if (occupant(s, next) !== -1 && !riders.includes(occupant(s, next))) continue;
    if (level.platforms.some((q) => q !== p && platformCell(q, s.plats[q.id]) === next)) continue;
    st.i = ni;
    st.d = d;
    for (const n of riders) {
      const b = s.blocks[n];
      b.x = ix(next);
      b.y = iy(next);
    }
    events.push({ type: 'platform', id: p.id, from: cur, to: next, riders });
  }
}

export function tickRotors(level, s, events) {
  for (const r of level.rotors) {
    const st = s.rotors[r.id];
    if (!r.signal) st.pending = 1; // turntables without a signal turn every turn
    const on = sig(s, r.signal);
    if (r.signal && on !== st.last) {
      st.pending = (st.pending + 1) % 4;
      st.last = on;
    }
    if (st.pending <= 0) continue;
    const cur = rotorCells(r, st.rot);
    const nxt = rotorCells(r, st.rot + 1);
    const riders = [];
    let jam = false;
    s.blocks.forEach((b, n) => {
      const fp = footprintIdx(b);
      const onCount = fp.filter((i) => cur.includes(i)).length;
      if (onCount === 0) return;
      if (onCount !== fp.length || b.z !== r.h) jam = true;
      else riders.push(n);
    });
    for (const i of nxt) {
      const o = occupant(s, i);
      if (o !== -1 && !riders.includes(o)) jam = true;
    }
    if (jam) continue;
    for (const n of riders) {
      const b = s.blocks[n];
      const cells = footprint(b).map(([x, y]) => {
        const [dx, dy] = rotCW([x - r.cx, y - r.cy]);
        return [r.cx + dx, r.cy + dy];
      });
      Object.assign(b, poseFromCells(cells, b.kind, b.z));
    }
    st.rot = (st.rot + 1) % 4;
    st.pending -= 1;
    events.push({ type: 'rotor', id: r.id, rot: st.rot, riders });
  }
}
