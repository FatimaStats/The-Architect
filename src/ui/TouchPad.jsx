// On-screen directional pad. Directions are screen-relative, like the arrow keys.
const Arrow = ({ rot }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
    <path d="M12 5 5 13h4v6h6v-6h4z" fill="currentColor" />
  </svg>
);

export function TouchPad({ onMove, onWait, onSwap }) {
  const press = (d) => (e) => {
    e.preventDefault();
    onMove(d);
  };
  return (
    <div className="touchpad" onPointerDown={(e) => e.stopPropagation()}>
      <div className="dpad">
        <button className="up" onPointerDown={press('up')} aria-label="Up">
          <Arrow rot={0} />
        </button>
        <button className="left" onPointerDown={press('left')} aria-label="Left">
          <Arrow rot={-90} />
        </button>
        <button className="right" onPointerDown={press('right')} aria-label="Right">
          <Arrow rot={90} />
        </button>
        <button className="down" onPointerDown={press('down')} aria-label="Down">
          <Arrow rot={180} />
        </button>
      </div>
      <div className="pad-extra">
        {onWait && (
          <button onPointerDown={(e) => (e.preventDefault(), onWait())} aria-label="Wait">
            Wait
          </button>
        )}
        {onSwap && (
          <button onPointerDown={(e) => (e.preventDefault(), onSwap())} aria-label="Swap block">
            Swap
          </button>
        )}
      </div>
    </div>
  );
}
