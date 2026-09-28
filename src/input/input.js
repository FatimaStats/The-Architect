// ---------------------------------------------------------------------------
// Input: keyboard and touch/swipe are normalised into a small set of intents.
// Directions are expressed in *screen* space ('up', 'down', 'left', 'right');
// the renderer maps them onto grid directions for the current camera, so the
// controls always match what the player sees.
// ---------------------------------------------------------------------------

const KEYMAP = {
  ArrowUp: ['move', 'up'],
  ArrowDown: ['move', 'down'],
  ArrowLeft: ['move', 'left'],
  ArrowRight: ['move', 'right'],
  KeyW: ['move', 'up'],
  KeyS: ['move', 'down'],
  KeyA: ['move', 'left'],
  KeyD: ['move', 'right'],
  KeyZ: ['undo'],
  KeyU: ['undo'],
  Backspace: ['undo'],
  KeyR: ['restart'],
  Space: ['wait'],
  Tab: ['swap'],
  KeyQ: ['swap'],
  Enter: ['confirm'],
  Escape: ['menu'],
  KeyH: ['notes'],
};

/**
 * @param {HTMLElement} swipeTarget element that receives swipe gestures
 * @param {(intent: {type: string, dir?: string, vector?: [number, number]}) => void} onIntent
 */
export function attachInput(swipeTarget, onIntent) {
  const onKey = (e) => {
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      onIntent({ type: 'undo' });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const m = KEYMAP[e.code];
    if (!m) return;
    e.preventDefault();
    onIntent({ type: m[0], dir: m[1], repeat: e.repeat });
  };

  // Swipe: a short drag in any direction. The raw vector is passed through so
  // the renderer can pick the grid axis closest to it on screen.
  let start = null;
  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const onUp = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - start.t;
    start = null;
    if (dist < 24 || dt > 1200) return;
    onIntent({ type: 'move', vector: [dx / dist, -dy / dist] });
  };
  const onCancel = () => (start = null);

  window.addEventListener('keydown', onKey);
  swipeTarget.addEventListener('pointerdown', onDown);
  swipeTarget.addEventListener('pointerup', onUp);
  swipeTarget.addEventListener('pointercancel', onCancel);
  return () => {
    window.removeEventListener('keydown', onKey);
    swipeTarget.removeEventListener('pointerdown', onDown);
    swipeTarget.removeEventListener('pointerup', onUp);
    swipeTarget.removeEventListener('pointercancel', onCancel);
  };
}

export const SCREEN_VECTORS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
