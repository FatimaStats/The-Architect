// ---------------------------------------------------------------------------
// Progress tracking. No database: everything lives in the browser's
// localStorage, and every access is guarded so the game still works in
// private windows or sandboxed previews where storage is unavailable.
// ---------------------------------------------------------------------------
const KEY = 'the-architect.progress.v1';

const empty = () => ({ version: 1, levels: {}, lastLevel: null });

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    return data && data.version === 1 ? { ...empty(), ...data } : empty();
  } catch {
    return empty();
  }
}

export function saveProgress(p) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — progress lasts for this session only */
  }
  return p;
}

const entry = (p, id) =>
  p.levels[id] || { completed: false, bestMoves: null, bestTime: null, restarts: 0, attempts: 0, optimalReached: false, completions: 0 };

export function recordRestart(p, id) {
  const e = entry(p, id);
  return saveProgress({ ...p, levels: { ...p.levels, [id]: { ...e, restarts: e.restarts + 1 } } });
}

export function recordStart(p, id) {
  const e = entry(p, id);
  return saveProgress({ ...p, lastLevel: id, levels: { ...p.levels, [id]: { ...e, attempts: e.attempts + 1 } } });
}

/** Store a completion; returns { progress, newBestMoves, newBestTime }. */
export function recordCompletion(p, id, { moves, time, optimal }) {
  const e = entry(p, id);
  const newBestMoves = e.bestMoves === null || moves < e.bestMoves;
  const newBestTime = e.bestTime === null || time < e.bestTime;
  const next = {
    ...e,
    completed: true,
    completions: e.completions + 1,
    bestMoves: newBestMoves ? moves : e.bestMoves,
    bestTime: newBestTime ? time : e.bestTime,
    optimalReached: e.optimalReached || moves <= optimal,
  };
  return { progress: saveProgress({ ...p, levels: { ...p.levels, [id]: next } }), newBestMoves, newBestTime };
}

export const levelStats = (p, id) => entry(p, id);

/** Levels unlock in order; optimal play is never required to advance. */
export function isUnlocked(p, levels, index) {
  if (index === 0) return true;
  if (typeof window !== 'undefined' && /[?&]unlock=all/.test(window.location.search)) return true;
  return !!p.levels[levels[index - 1].id]?.completed || !!p.levels[levels[index].id]?.completed;
}

export function summary(p, levels) {
  const done = levels.filter((l) => p.levels[l.id]?.completed).length;
  const optimal = levels.filter((l) => p.levels[l.id]?.optimalReached).length;
  return { done, optimal, total: levels.length };
}

export function resetProgress() {
  return saveProgress(empty());
}
