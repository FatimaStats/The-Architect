export function Title({ summary, hasProgress, onStart, onSelect }) {
  return (
    <div className="title-screen">
      <div className="title-inner">
        <div className="eyebrow">A spatial puzzle laboratory</div>
        <h1 className="wordmark">
          THE
          <br />
          ARCHITECT
        </h1>
        <p className="lede">
          Thirty structures. One block. Every rule is revealed before it is tested — nothing here is left to chance.
        </p>
        <div className="title-actions">
          <button className="btn primary lg" onClick={onStart} autoFocus>
            {hasProgress ? 'Continue' : 'Begin'} <kbd>Enter</kbd>
          </button>
          <button className="btn lg" onClick={onSelect}>
            Select structure
          </button>
        </div>
        {hasProgress && (
          <div className="title-progress">
            <div className="meter">
              <div style={{ width: `${(summary.done / summary.total) * 100}%` }} />
            </div>
            <span>
              {summary.done} of {summary.total} solved · {summary.optimal} optimal
            </span>
          </div>
        )}
      </div>
      <div className="title-foot">Arrow keys · WASD · swipe &nbsp;/&nbsp; Z undo · R restart · Space wait · Tab swap</div>
    </div>
  );
}
