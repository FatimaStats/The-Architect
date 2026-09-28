// ---------------------------------------------------------------------------
// Level compiler
// Turns the human-authored level description (ASCII map + legend + objects)
// into a compact, engine-friendly structure. The engine never reads raw level
// data directly, so new levels can be added without touching engine code.
// ---------------------------------------------------------------------------

export const GRID_STRIDE = 64; // max level width

export const idx = (x, y) =>
  x < 0 || y < 0 || x >= GRID_STRIDE || y >= GRID_STRIDE ? -1 : y * GRID_STRIDE + x;
export const ix = (i) => i % GRID_STRIDE;
export const iy = (i) => Math.floor(i / GRID_STRIDE);

/** Default map characters. A level's `legend` may add or override entries. */
export const DEFAULT_LEGEND = {
  ' ': null,
  '.': { type: 'floor' },
  S: { type: 'floor', start: true },
  E: { type: 'exit' },
  f: { type: 'fragile' },
  c: { type: 'crumble' },
  '>': { type: 'oneway', dir: 'E' },
  '<': { type: 'oneway', dir: 'W' },
  '^': { type: 'oneway', dir: 'N' },
  v: { type: 'oneway', dir: 'S' },
  '#': { type: 'wall' },
  k: { type: 'key', id: 'k' },
  L: { type: 'lock', id: 'k' },
  '=': { type: 'rail' },
};

/** Tile types that act as solid obstacles a block may never enter. */
export const OBSTACLE_TYPES = new Set(['wall', 'emitter', 'mirror', 'receiver']);

export function compileLevel(def) {
  const legend = { ...DEFAULT_LEGEND, ...(def.legend || {}) };
  const tiles = new Map(); // idx -> tile
  let width = 0;
  const height = def.map.length;
  let start = null;

  def.map.forEach((row, y) => {
    width = Math.max(width, row.length);
    [...row].forEach((ch, x) => {
      const spec = legend[ch];
      if (spec === undefined) throw new Error(`Level ${def.id}: unknown map char '${ch}' at ${x},${y}`);
      if (spec === null) return;
      const h = def.heights ? Number(def.heights[y]?.[x] ?? 0) || 0 : 0;
      const tile = { ...spec, x, y, i: idx(x, y), h };
      if (spec.start) start = { x, y };
      tiles.set(tile.i, tile);
    });
  });
  if (width > GRID_STRIDE) throw new Error(`Level ${def.id} is wider than ${GRID_STRIDE}`);

  // Blocks: explicit list or the 'S' marker.
  let blocks = def.blocks
    ? def.blocks.map((b, n) => ({ kind: 'bar', o: 'U', prime: n === 0, ...b }))
    : start
      ? [{ x: start.x, y: start.y, o: 'U', kind: 'bar', prime: true }]
      : null;
  if (!blocks) throw new Error(`Level ${def.id}: no start position`);
  blocks = blocks.map((b) => ({ ...b, o: b.kind === 'cube' ? 'C' : b.o }));

  const platforms = (def.platforms || []).map((p, n) => ({
    id: n,
    path: p.path.map(([x, y]) => idx(x, y)),
    h: p.h || 0,
    signal: p.signal || null,
    loop: !!p.loop,
    start: p.start || 0,
  }));

  const rotors = (def.rotors || []).map((r, n) => ({
    id: n,
    center: idx(r.center[0], r.center[1]),
    cx: r.center[0],
    cy: r.center[1],
    arms: r.arms.map(([dx, dy]) => [dx, dy]),
    h: r.h || 0,
    signal: r.signal || null,
    rot: r.rot || 0,
  }));

  const listOf = (type) => [...tiles.values()].filter((t) => t.type === type);

  // Sanity checks that catch authoring errors early.
  for (const t of listOf('teleporter')) {
    if (!t.to) throw new Error(`Level ${def.id}: teleporter at ${t.x},${t.y} has no 'to'`);
    t.target = idx(t.to[0], t.to[1]);
  }

  return {
    id: def.id,
    def,
    width,
    height,
    tiles,
    blocks,
    platforms,
    rotors,
    plates: listOf('plate'),
    switches: listOf('switch'),
    emitters: listOf('emitter'),
    receivers: listOf('receiver'),
    mirrors: listOf('mirror'),
    elevators: listOf('elevator'),
    keysByGroup: listOf('key').reduce((acc, t) => {
      (acc[t.id] ||= []).push(t.i);
      return acc;
    }, {}),
  };
}
