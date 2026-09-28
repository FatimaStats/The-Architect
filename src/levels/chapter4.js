// Chapter 4 — Transit: teleporters and moving platforms.
// Platforms advance one cell every turn. Press Space to wait a turn.
const tp = (x, y) => ({ type: 'teleporter', to: [x, y] });
const sw = (signal, extra) => ({ type: 'switch', signal, ...extra });
const plate = (signal, extra) => ({ type: 'plate', signal, ...extra });
const door = (signal, extra) => ({ type: 'door', signal, ...extra });

export default [
  {
    id: '4-1',
    name: 'Transit',
    brief: 'Stand upright on a portal to be carried to its twin. Lying across a portal does nothing.',
    teaches: 'Teleporters',
    legend: { A: tp(13, 1), B: tp(2, 1) },
    map: [
      '....        .... ',
      '.SA.        .B...',
      '....        .....',
      '             ..  ',
      '             ..  ',
      '            .....',
      '            ..E..',
      '            .....',
    ],
    optimal: 17,
  },
  {
    id: '4-2',
    name: 'Shuttle',
    brief: 'Platforms move one tile each turn. Step aboard standing, then press Space (or ⏸) to wait while it travels.',
    teaches: 'Moving platforms & waiting',
    platforms: [{ path: [[4, 1], [5, 1], [6, 1], [7, 1], [8, 1]] }],
    map: [
      '....     .....',
      '.S..=====.....',
      '....     ...E.',
      '         .....',
    ],
    optimal: 18,
  },
  {
    id: '4-3',
    name: 'Interchange',
    brief: 'Two platforms, two rhythms. A block lying half on a platform pins it in place — use your weight as a brake.',
    teaches: 'Platform timing & pinning',
    platforms: [
      { path: [[4, 1], [5, 1], [6, 1], [7, 1]] },
      { path: [[10, 1], [11, 1], [12, 1], [13, 1]], start: 2 },
    ],
    map: [
      '....    ..          ',
      '.S..====..====....  ',
      '....    ..    ..E.  ',
      '              ....  ',
    ],
    optimal: 16,
  },
  {
    id: '4-4',
    name: 'Relay',
    brief: 'Portals and platforms together. A portal will not send you onto a missing platform.',
    teaches: 'Teleport timing',
    legend: { A: tp(8, 1), B: tp(1, 5) },
    platforms: [{ path: [[8, 1], [9, 1], [10, 1], [11, 1]] }],
    map: [
      '....            ',
      '.SA.    ====....',
      '....        ..E.',
      '            ....',
      '...             ',
      '.B.             ',
      '...             ',
    ],
    optimal: 18,
  },
  {
    id: '4-5',
    name: 'Commute',
    brief: 'This platform only runs while its switch is on. The cube can mind the plate while you travel.',
    teaches: 'Signal-driven platforms',
    legend: { T: sw('p'), P: plate('q'), D: door('q') },
    blocks: [{ x: 1, y: 1 }, { x: 2, y: 4, kind: 'cube' }],
    platforms: [{ path: [[4, 2], [5, 2], [6, 2], [7, 2], [8, 2]], signal: 'p' }],
    map: [
      '....          ',
      '.S..       ...... ',
      '...T=====..D.... ',
      '....       ...E. ',
      '...P       ..... ',
    ],
    optimal: 18,
  },
];
