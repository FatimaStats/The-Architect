// Short explanations for each mechanic, shown in the in-game "Field notes".
export const NOTES = {
  exit: { label: 'Exit', color: '#9ff3e0', text: 'Arrive standing upright to descend.' },
  fragile: { label: 'Fragile tile', color: '#c98a4b', text: 'Holds a lying block. Cracks under a standing one.' },
  crumble: { label: 'Hollow tile', color: '#8a93a3', text: 'Disappears once you leave it.' },
  oneway: { label: 'One-way tile', color: '#7fe0c9', text: 'May only be entered in the direction of its arrows.' },
  plate: { label: 'Pressure plate', color: '#d8d2c4', text: 'Active only while weighted by any block.' },
  switch: { label: 'Switch', color: '#ffcf7a', text: 'Each fresh press flips it. Crossed switches need a standing bar.' },
  door: { label: 'Door', color: '#8fb4e0', text: 'Solid while closed. Never closes on a block.' },
  bridge: { label: 'Bridge', color: '#8fd3ff', text: 'Extends and retracts on its signal.' },
  key: { label: 'Key', color: '#f0c86a', text: 'Touch it with any part of a block.' },
  lock: { label: 'Locked gate', color: '#f0c86a', text: 'Opens when every key has been collected.' },
  teleporter: { label: 'Portal', color: '#b59cff', text: 'Stand on it to be carried to its twin.' },
  gravity: { label: 'Gravity field', color: '#6f7bff', text: 'Tumbles blocks in its direction until they leave it or hit a wall.' },
  elevator: { label: 'Lift', color: '#8fd3ff', text: 'Stand on it to ride between levels.' },
  wall: { label: 'Column', color: '#5a616e', text: 'Solid. Stops blocks and tumbling.' },
  emitter: { label: 'Laser', color: '#ff3b4f', text: 'Beams cannot be crossed. Doors, blocks and columns stop them.' },
  mirror: { label: 'Mirror', color: '#dfe6f0', text: 'Reflects beams. Some flip on a signal.' },
  receiver: { label: 'Receiver', color: '#ff7a88', text: 'Powers its mechanism while lit.' },
  platform: { label: 'Moving platform', color: '#e0b36a', text: 'Moves one tile per turn and carries a standing block. Lying half on it pins it.' },
  rotor: { label: 'Turntable', color: '#e0b36a', text: 'Turns clockwise and carries what rests fully on it.' },
  cube: { label: 'Helper cube', color: '#a9bdd2', text: 'A second body. Presses plates and switches, rolls one tile at a time.' },
  height: { label: 'Terraces', color: '#8b919c', text: 'You cannot climb, but may drop if the whole block lands on one level.' },
};

export function notesFor(level) {
  const types = new Set([...level.tiles.values()].map((t) => t.type));
  const out = [];
  const order = Object.keys(NOTES);
  for (const k of order) {
    if (types.has(k)) out.push(k);
  }
  if (level.platforms.length) out.push('platform');
  if (level.rotors.length) out.push('rotor');
  if (level.blocks.some((b) => b.kind === 'cube')) out.push('cube');
  if ([...level.tiles.values()].some((t) => t.h > 0)) out.push('height');
  return [...new Set(out)].map((k) => ({ key: k, ...NOTES[k] }));
}
