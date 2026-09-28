// Chapter 2 — Mechanisms: pressure plates, doors, switches, bridges, a second body.
const plate = (signal, extra) => ({ type: 'plate', signal, ...extra });
const door = (signal, extra) => ({ type: 'door', signal, ...extra });
const sw = (signal, extra) => ({ type: 'switch', signal, ...extra });
const bridge = (signal, extra) => ({ type: 'bridge', signal, ...extra });

export default [
  {
    id: '2-1',
    name: 'Threshold',
    brief: 'A pressure plate opens its door only while something rests on it. Keep your weight on it as you roll through.',
    teaches: 'Pressure plates & doors',
    legend: { P: plate('a'), D: door('a') },
    map: [
      '....          ',
      '.S..PD......  ',
      '....   .....  ',
      '       ..E..  ',
      '       .....  ',
    ],
    optimal: 11,
  },
  {
    id: '2-2',
    name: 'Latch',
    brief: 'Switches remember. Press one once and its bridge stays extended.',
    teaches: 'Toggle switches & bridges',
    legend: { T: sw('b'), B: bridge('b') },
    map: [
      '      ....     ',
      '      ..T.     ',
      '      ....     ',
      '.... ...       ',
      '.S......BB.... ',
      '....       .E..',
      '           ....',
    ],
    optimal: 22,
  },
  {
    id: '2-3',
    name: 'Full Weight',
    brief: 'Heavy switches (marked with a cross) respond only to a block standing upright.',
    teaches: 'Heavy switches',
    legend: { H: sw('c', { heavy: true }), B: bridge('c') },
    map: [
      '...    ...     ',
      '.S.....H..     ',
      '...    ...     ',
      '        .      ',
      '        .      ',
      '       ...     ',
      '       ...BBB.... ',
      '       ...   ..E..',
      '             .... ',
    ],
    optimal: 22,
  },
  {
    id: '2-4',
    name: 'Alternation',
    brief: 'One switch, two bridges: when one extends, the other retracts. Order matters.',
    teaches: 'Inverted links',
    legend: { T: sw('d'), A: bridge('d'), Z: bridge('d', { invert: true }) },
    map: [
      '...           ',
      '.S.ZZ...      ',
      '...  .T.      ',
      '     ...AA....',
      '          ..E.',
      '          ....',
    ],
    optimal: 15,
  },
  {
    id: '2-5',
    name: 'Counterweight',
    brief: 'A second body. Press Tab (or the swap button) to take control of the cube and leave it on the plate.',
    teaches: 'Multiple blocks',
    legend: { P: plate('e'), D: door('e') },
    blocks: [
      { x: 1, y: 1 },
      { x: 1, y: 5, kind: 'cube' },
    ],
    map: [
      '...           ',
      '......D.....  ',
      '...   ......  ',
      ' .    ....E.  ',
      ' .    ......  ',
      '...           ',
      '..P           ',
    ],
    optimal: 10,
  },
];
