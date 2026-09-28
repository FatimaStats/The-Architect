import { useState } from 'react';
import { fmtTime } from './HUD.jsx';

const LOST_TEXT = {
  void: 'The block lost its footing.',
  fragile: 'The fragile tile gave way under a standing block.',
};

export function LostToast({ lost, onUndo, onRestart }) {
  return (
    <div className="toast" role="status">
      <span className="toast-mark" />
      <span>{LOST_TEXT[lost?.reason] || 'The structure failed.'}</span>
      <button className="link" onClick={onUndo}>
        Undo <kbd>Z</kbd>
      </button>
      <button className="link" onClick={onRestart}>
        Restart <kbd>R</kbd>
      </button>
    </div>
  );
}

export function BriefCard({ def, notes, onClose }) {
  const [all, setAll] = useState(false);
  const fresh = notes.filter((n) => n.isNew);
  const known = notes.filter((n) => !n.isNew);
  const shown = all ? notes : fresh;
  return (
    <aside className="brief panel">
      <div className="brief-head">
        <span className="eyebrow">{def.teaches}</span>
        <button className="close" onClick={onClose} aria-label="Close notes">
          ×
        </button>
      </div>
      <p className="brief-text">{def.brief}</p>
      {shown.length > 0 && (
        <ul className="notes">
          {shown.map((n) => (
            <li key={n.key}>
              <span className="swatch" style={{ background: n.color }} />
              <b>
                {n.label} {n.isNew && <em className="new">new</em>}
              </b>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
      {!all && known.length > 0 && (
        <button className="chips" onClick={() => setAll(true)} title="Show all field notes">
          {known.map((n) => (
            <span key={n.key} className="chip">
              <span className="swatch" style={{ background: n.color }} />
              {n.label}
            </span>
          ))}
        </button>
      )}
      <p className="brief-foot">
        Arrows / WASD / swipe to roll · <kbd>H</kbd> notes
      </p>
    </aside>
  );
}

export function WinPanel({ def, win, stats, isLast, onNext, onReplay, onMenu }) {
  const optimal = win.moves <= def.optimal;
  const delta = win.moves - def.optimal;
  return (
    <div className="modal-scrim">
      <section className="panel win" role="dialog" aria-label="Level complete">
        <div className="eyebrow">Structure resolved</div>
        <h2>
          {def.id} · {def.name}
        </h2>
        <div className="win-grid">
          <div>
            <span className="stat-label">Moves</span>
            <span className="big">{win.moves}</span>
            {win.newBestMoves && stats.completions > 1 && <span className="badge">New best</span>}
          </div>
          <div>
            <span className="stat-label">Optimal</span>
            <span className="big">{def.optimal}</span>
          </div>
          <div>
            <span className="stat-label">Time</span>
            <span className="big">{fmtTime(win.time)}</span>
          </div>
          <div>
            <span className="stat-label">Restarts</span>
            <span className="big">{win.restarts}</span>
          </div>
        </div>
        <p className="win-verdict">
          {optimal ? (
            <>
              <span className="diamond">◆</span> Optimal solution. Nothing wasted.
            </>
          ) : (
            <>
              Solved in {delta} move{delta === 1 ? '' : 's'} over optimal. The next structure is open — return any time to refine.
            </>
          )}
        </p>
        <div className="win-actions">
          <button className="btn" onClick={onReplay}>
            Replay <kbd>R</kbd>
          </button>
          <button className="btn" onClick={onMenu}>
            Levels <kbd>Esc</kbd>
          </button>
          <button className="btn primary" onClick={onNext} autoFocus>
            {isLast ? 'All levels' : 'Next structure'} <kbd>Enter</kbd>
          </button>
        </div>
      </section>
    </div>
  );
}
