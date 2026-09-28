import { useState } from 'react';
import { isUnlocked, resetProgress } from '../progress/progress.js';
import { fmtTime } from './HUD.jsx';

export function LevelSelect({ chapters, levels, progress, current, summary, onPick, onClose, onProgressReset }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <section className="panel select" role="dialog" aria-label="Level selection" onClick={(e) => e.stopPropagation()}>
        <header className="select-head">
          <div>
            <div className="eyebrow">Index of structures</div>
            <h2>Level selection</h2>
          </div>
          <div className="select-summary">
            <span>
              <b>{summary.done}</b>/{summary.total} solved
            </span>
            <span>
              <b>{summary.optimal}</b> optimal
            </span>
            <button className="close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>
        <div className="meter">
          <div style={{ width: `${(summary.done / summary.total) * 100}%` }} />
        </div>
        <div className="chapters">
          {chapters.map((c) => (
            <div className="chapter" key={c.n}>
              <div className="chapter-head">
                <span className="chapter-n">{String(c.n).padStart(2, '0')}</span>
                <div>
                  <b>{c.title}</b>
                  <span>{c.subtitle}</span>
                </div>
              </div>
              <div className="level-grid">
                {c.levels.map((l) => {
                  const i = levels.findIndex((x) => x.id === l.id);
                  const st = progress.levels[l.id];
                  const open = isUnlocked(progress, levels, i);
                  return (
                    <button
                      key={l.id}
                      className={`level-card ${st?.completed ? 'done' : ''} ${i === current ? 'cur' : ''}`}
                      disabled={!open}
                      onClick={() => onPick(i)}
                    >
                      <span className="lc-id">{l.id}</span>
                      <span className="lc-name">{open ? l.name : 'Locked'}</span>
                      <span className="lc-meta">
                        {st?.completed ? (
                          <>
                            {st.optimalReached ? '◆ ' : ''}
                            {st.bestMoves}/{l.optimal} · {fmtTime(st.bestTime)}
                          </>
                        ) : open ? (
                          <>optimal {l.optimal}</>
                        ) : (
                          '—'
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <footer className="select-foot">
          <span>◆ marks an optimal solution. Optimal play is never required to advance.</span>
          {confirm ? (
            <span>
              Erase all progress?{' '}
              <button
                className="link danger"
                onClick={() => {
                  onProgressReset(resetProgress());
                  setConfirm(false);
                }}
              >
                Erase
              </button>{' '}
              <button className="link" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="link" onClick={() => setConfirm(true)}>
              Reset progress
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
