// ---------------------------------------------------------------------------
// Physics: pure, deterministic grid geometry for rolling blocks.
//
// A block's pose is { x, y, o, z }:
//   o = 'U'  bar standing upright, occupies (x,y)
//   o = 'X'  bar lying along the x-axis, occupies (x,y) and (x+1,y)
//   o = 'Y'  bar lying along the y-axis, occupies (x,y) and (x,y+1)
//   o = 'C'  unit cube, occupies (x,y)
//   z        height of the floor the block rests on
// ---------------------------------------------------------------------------
import { idx } from './level.js';

export const DIRS = {
  N: { dx: 0, dy: -1 },
  S: { dx: 0, dy: 1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
};
export const DIR_KEYS = ['N', 'E', 'S', 'W'];

/** Cells covered by a pose, as [x, y] pairs. */
export function footprint(b) {
  switch (b.o) {
    case 'X':
      return [[b.x, b.y], [b.x + 1, b.y]];
    case 'Y':
      return [[b.x, b.y], [b.x, b.y + 1]];
    default:
      return [[b.x, b.y]];
  }
}

export const footprintIdx = (b) => footprint(b).map(([x, y]) => idx(x, y));

/** Is the block standing on a single cell with its full weight? */
export const isUpright = (b) => b.o === 'U';
export const isSingleCell = (b) => b.o === 'U' || b.o === 'C';

/** Result pose after rolling one step in direction `d` (N/E/S/W). */
export function roll(b, d) {
  const { dx, dy } = DIRS[d];
  const n = { ...b };
  switch (b.o) {
    case 'C':
      n.x += dx;
      n.y += dy;
      break;
    case 'U':
      if (dx === 1) Object.assign(n, { x: b.x + 1, o: 'X' });
      else if (dx === -1) Object.assign(n, { x: b.x - 2, o: 'X' });
      else if (dy === 1) Object.assign(n, { y: b.y + 1, o: 'Y' });
      else Object.assign(n, { y: b.y - 2, o: 'Y' });
      break;
    case 'X':
      if (dx === 1) Object.assign(n, { x: b.x + 2, o: 'U' });
      else if (dx === -1) Object.assign(n, { x: b.x - 1, o: 'U' });
      else n.y += dy;
      break;
    case 'Y':
      if (dy === 1) Object.assign(n, { y: b.y + 2, o: 'U' });
      else if (dy === -1) Object.assign(n, { y: b.y - 1, o: 'U' });
      else n.x += dx;
      break;
  }
  return n;
}

/** Normalise an arbitrary two-cell footprint back into a pose. */
export function poseFromCells(cells, kind, z) {
  if (cells.length === 1) {
    const [[x, y]] = cells;
    return { x, y, o: kind === 'cube' ? 'C' : 'U', z };
  }
  const [[x1, y1], [x2, y2]] = cells;
  if (y1 === y2) return { x: Math.min(x1, x2), y: y1, o: 'X', z };
  return { x: x1, y: Math.min(y1, y2), o: 'Y', z };
}

/**
 * Landing rule. Given the floor heights under each footprint cell (null =
 * void) and the block's current height, decide the outcome of arriving:
 *   { ok: true, z }       fully supported at height z (may be a drop)
 *   { ok: false }         partially / not supported -> the block falls
 * Entry into cells higher than z is rejected before this is called.
 */
export function land(heights) {
  if (heights.some((h) => h === null)) return { ok: false };
  const z = heights[0];
  if (heights.some((h) => h !== z)) return { ok: false };
  return { ok: true, z };
}
