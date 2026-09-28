// Level registry. Add a chapter file (or a level to an existing one) and it
// appears in the game automatically — no engine changes required.
import chapter1 from './chapter1.js';
import chapter2 from './chapter2.js';
import chapter3 from './chapter3.js';
import chapter4 from './chapter4.js';
import chapter5 from './chapter5.js';
import chapter6 from './chapter6.js';

export const CHAPTERS = [
  { n: 1, title: 'Foundations', subtitle: 'Movement and orientation', levels: chapter1 },
  { n: 2, title: 'Mechanisms', subtitle: 'Pressure plates and doors', levels: chapter2 },
  { n: 3, title: 'Interference', subtitle: 'Multiple interacting mechanisms', levels: chapter3 },
  { n: 4, title: 'Transit', subtitle: 'Moving platforms and teleportation', levels: chapter4 },
  { n: 5, title: 'Elevation', subtitle: 'Advanced spatial reasoning', levels: chapter5 },
  { n: 6, title: 'Synthesis', subtitle: 'Complex multi-mechanic puzzles', levels: chapter6 },
];

export const LEVELS = CHAPTERS.flatMap((c) => c.levels.map((l) => ({ ...l, chapter: c.n })));
