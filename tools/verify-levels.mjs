// Verifies every level: compiles, solves with BFS, checks the stored optimal.
// Usage: node tools/verify-levels.mjs [levelId] [--path]
import { LEVELS } from '../src/levels/index.js';
import { compileLevel } from '../src/engine/level.js';
import { createInitialState } from '../src/engine/game.js';
import fs from 'node:fs';
import { solve } from '../src/engine/solver.js';

const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const write = process.argv.includes('--write');
const showPath = process.argv.includes('--path');
let failed = 0;
for (const def of LEVELS) {
  if (only && def.id !== only) continue;
  const t0 = Date.now();
  let res;
  try {
    const level = compileLevel(def);
    res = solve(level, createInitialState(level));
  } catch (e) {
    console.log(`✗ ${def.id} ${def.name}: ${e.message}`);
    failed++;
    continue;
  }
  const ms = Date.now() - t0;
  const ok = res.moves > 0 && res.moves === def.optimal;
  if (!ok) failed++;
  const flag = res.moves < 0 ? '✗ UNSOLVABLE' : ok ? '✓' : `✗ optimal is ${res.moves} (stored ${def.optimal})`;
  console.log(`${flag.padEnd(28)} ${def.id.padEnd(5)} ${def.name.padEnd(24)} moves=${res.moves} states=${res.explored} ${ms}ms`);
  if (write && res.moves > 0 && res.moves !== def.optimal) {
    const file = new URL(`../src/levels/chapter${def.chapter}.js`, import.meta.url);
    const src = fs.readFileSync(file, 'utf8');
    const re = new RegExp(`(id: '${def.id}'[\\s\\S]*?optimal: )\\d+`);
    fs.writeFileSync(file, src.replace(re, `$1${res.moves}`));
    console.log(`   wrote optimal=${res.moves}`);
  }
  if (showPath && res.path) {
    console.log('   ' + res.path.map((a) => (a.wait ? 'wait' : (def.blocks?.length > 1 ? a.b : '') + a.dir)).join(' '));
  }
}
console.log(failed ? `\n${failed} level(s) need attention` : '\nAll levels verified.');
process.exit(failed ? 1 : 0);
