import { isUnlocked } from '../progress/progress.js';

export const fmtTime = (t) => {
  if (t == null) return '—';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);
export const ICONS = {
  undo: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
  restart: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  wait: ['M9 5v14', 'M15 5v14'],
  swap: ['M7 7h13l-3-3', 'M17 17H4l3 3'],
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  info: ['M12 8h.01', 'M11 12h1v5h1', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
  sound: ['M11 5 6 9H3v6h3l5 4z', 'M16 9a4 4 0 0 1 0 6', 'M19 6a8 8 0 0 1 0 12'],
  mute: ['M11 5 6 9H3v6h3l5 4z', 'm17 9 5 6', 'm22 9-5 6'],
  pad: ['M9 3h6v6H9z', 'M3 9h6v6H3z', 'M15 9h6v6h-6z', 'M9 15h6v6H9z'],
};

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Btn({ icon, label, kbd, onClick, disabled, primary }) {
  return (
    <button className={`btn ${primary ? 'primary' : ''}`} onClick={onClick} disabled={disabled} title={kbd ? `${label} (${kbd})` : label}>
      <Icon d={ICONS[icon]} />
      <span className="btn-label">{label}</span>
      {kbd && <kbd>{kbd}</kbd>}
    </button>
  );
}

export function HUD({
  def, chapter, levelIndex, levels, progress, snap, time, stats, muted,
  onUndo, onRestart, onWait, onSwap, onMenu, onNotes, onMute, onTogglePad, padOn, onJump,
}) {
  return (
    <>
      <header className="hud-top">
        <div className="hud-title">
          <div className="eyebrow">
            Chapter {String(chapter.n).padStart(2, '0')} · {chapter.title}
          </div>
          <h1>
            <span className="lvl-num">{def.id}</span> {def.name}
          </h1>
        </div>

        <div className="hud-stats">
          <Stat label="Moves" value={snap.moves} accent />
          <Stat label="Optimal" value={def.optimal} />
          <Stat label={stats.optimalReached ? 'Best ◆' : 'Best'} value={stats.bestMoves ?? '—'} />
          <Stat label="Time" value={fmtTime(time)} />
          <Stat label="Restarts" value={snap.restarts} />
        </div>
      </header>

      <nav className="progress-strip" aria-label="Level progress">
        {levels.map((l, i) => {
          const done = progress.levels[l.id]?.completed;
          const opt = progress.levels[l.id]?.optimalReached;
          const open = isUnlocked(progress, levels, i);
          const gap = i > 0 && levels[i - 1].chapter !== l.chapter;
          return (
            <button
              key={l.id}
              className={`seg ${done ? 'done' : ''} ${opt ? 'opt' : ''} ${i === levelIndex ? 'cur' : ''} ${gap ? 'gap' : ''}`}
              disabled={!open}
              onClick={() => onJump(i)}
              title={`${l.id} ${l.name}${done ? ' — solved' : ''}`}
            />
          );
        })}
      </nav>

      <footer className="hud-bottom">
        <div className="btn-row">
          <Btn icon="undo" label="Undo" kbd="Z" onClick={onUndo} disabled={!snap.canUndo} />
          <Btn icon="restart" label="Restart" kbd="R" onClick={onRestart} />
          {snap.hasTime && <Btn icon="wait" label="Wait" kbd="Space" onClick={onWait} />}
          {snap.blocks > 1 && <Btn icon="swap" label={snap.active === 0 ? 'Control cube' : 'Control bar'} kbd="Tab" onClick={onSwap} />}
        </div>
        <div className="btn-row right">
          <Btn icon="info" label="Notes" kbd="H" onClick={onNotes} />
          <Btn icon="grid" label="Levels" kbd="Esc" onClick={onMenu} />
          <button className="btn icon-only" onClick={onTogglePad} title="Touch controls" aria-pressed={padOn}>
            <Icon d={ICONS.pad} />
          </button>
          <button className="btn icon-only" onClick={onMute} title={muted ? 'Unmute' : 'Mute'}>
            <Icon d={muted ? ICONS.mute : ICONS.sound} />
          </button>
        </div>
      </footer>
    </>
  );
}
