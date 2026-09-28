// ---------------------------------------------------------------------------
// Session: glue between the pure engine, the renderer and the UI.
// Owns the undo history for the level in play and the per-attempt metrics.
// ---------------------------------------------------------------------------
import { compileLevel } from '../engine/level.js';
import { createInitialState, step } from '../engine/game.js';

export class Session {
  constructor(renderer, onChange) {
    this.renderer = renderer;
    this.onChange = onChange;
    this.level = null;
    this.history = [];
    this.active = 0;
    this.restarts = 0;
  }

  load(def) {
    this.def = def;
    this.level = compileLevel(def);
    const s0 = createInitialState(this.level);
    this.history = [s0];
    this.active = 0;
    this.restarts = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.renderer.loadLevel(this.level, s0);
    this.renderer.setActiveBlock(0);
    this.emit();
  }

  get state() {
    return this.history[this.history.length - 1];
  }

  get hasTime() {
    return this.level.platforms.length > 0 || this.level.rotors.length > 0;
  }

  get blockCount() {
    return this.state.blocks.length;
  }

  elapsed() {
    if (!this.startedAt) return 0;
    return ((this.endedAt ?? performance.now()) - this.startedAt) / 1000;
  }

  emit() {
    this.onChange?.(this.snapshot());
  }

  snapshot() {
    const s = this.state;
    return {
      moves: s.moves,
      status: s.status,
      lost: s.lost,
      active: this.active,
      blocks: s.blocks.length,
      restarts: this.restarts,
      canUndo: this.history.length > 1,
      hasTime: this.hasTime,
      time: this.elapsed(),
    };
  }

  apply(action) {
    const prev = this.state;
    if (prev.status !== 'playing') return false;
    const r = step(this.level, prev, action);
    if (!r) {
      if (!action.wait) this.renderer.bump?.(this.active, action.dir);
      return false;
    }
    if (!this.startedAt) this.startedAt = performance.now();
    this.history.push(r.state);
    if (r.state.status === 'won') this.endedAt = performance.now();
    this.renderer.playTurn(prev, r.state, r.events);
    this.emit();
    return true;
  }

  move(dir) {
    return this.apply({ b: this.active, dir });
  }

  wait() {
    return this.apply({ wait: true });
  }

  swap() {
    if (this.blockCount < 2) return;
    this.active = (this.active + 1) % this.blockCount;
    this.renderer.setActiveBlock(this.active);
    this.emit();
  }

  undo() {
    if (this.history.length < 2) return;
    this.history.pop();
    this.endedAt = null;
    this.renderer.showState(this.state);
    this.emit();
  }

  restart() {
    if (this.history.length < 2 && this.state.status === 'playing') return false;
    this.history = [this.history[0]];
    this.restarts += 1;
    this.startedAt = null;
    this.endedAt = null;
    this.active = 0;
    this.renderer.setActiveBlock(0);
    this.renderer.showState(this.state);
    this.emit();
    return true;
  }
}
