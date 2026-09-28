// Chapter 3 — Interference: keys and locks, one-way and disappearing tiles,
// laser barriers, mirrors and receivers, and their interactions.
const sw = (signal, extra) => ({ type: 'switch', signal, ...extra });
const door = (signal, extra) => ({ type: 'door', signal, ...extra });
const bridge = (signal, extra) => ({ type: 'bridge', signal, ...extra });

export default [
  {
    id: '3-1',
    name: 'Keystone',
    brief: 'Locked gates open once every key of their kind has been collected. Touch the key with any part of the block.',
    teaches: 'Keys & locked areas',
    map: [
      '    ...         ',
      '    .k.         ',
      '    ...         ',
      '     .          ',
      '.......LL....   ',
      '.S.....  ....   ',
      '.......  ..E.   ',
      '         ....   ',
    ],
    optimal: 16,
  },
  {
    id: '3-2',
    name: 'Irreversible',
    brief: 'Arrow tiles can only be entered in their direction. Hollow tiles vanish after you leave them.',
    teaches: 'One-way & disappearing tiles',
    map: [
      '...    ....    ',
      '.S.>>>...c.    ',
      '...    ....    ',
      '        cc     ',
      '       ....    ',
      '       ..E.    ',
      '       ....    ',
    ],
    optimal: 13,
  },
  {
    id: '3-3',
    name: 'Shutter',
    brief: 'Laser beams cannot be crossed. A closed door stops a beam — close the shutter.',
    teaches: 'Laser barriers',
    legend: {
      M: { type: 'emitter', dir: 'S' },
      G: door('g', { invert: true }),
      T: sw('g'),
    },
    map: [
      '      M        ',
      '      G        ',
      '....  .   ...  ',
      '.S..........E. ',
      '..T.  .   ...  ',
    ],
    optimal: 16,
  },
  {
    id: '3-4',
    name: 'Reflection',
    brief: 'Mirrors redirect beams. A lit receiver powers its mechanism.',
    teaches: 'Mirrors & receivers',
    legend: {
      M: { type: 'emitter', dir: 'E' },
      '/': { type: 'mirror', orient: '/', signal: 'm' },
      R: { type: 'receiver', signal: 'r' },
      T: sw('m'),
      D: door('r'),
    },
    map: [
      '....            ',
      '.S.......D....  ',
      '....   .   ..E. ',
      '..T.M  /   .... ',
      '               ',
      '       R        ',
    ],
    optimal: 13,
  },
  {
    id: '3-5',
    name: 'Vault',
    brief: 'The key sits behind the beam and the floor beneath it will not hold twice. Think backwards from the exit.',
    teaches: 'Synthesis',
    legend: {
      M: { type: 'emitter', dir: 'W' },
      G: door('v', { invert: true }),
      T: sw('v'),
    },
    map: [
      '         ...     ',
      '      ...ck.GM   ',
      '....  ......     ',
      '.S.....<<<..     ',
      '..T.      LL     ',
      '          ....   ',
      '          ..E.   ',
      '          ....   ',
    ],
    optimal: 25,
  },
];
