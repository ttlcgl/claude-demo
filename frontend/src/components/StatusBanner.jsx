import { copyForPhase, PHASE } from '../lib/status.js';
import { Symbol } from './Symbol.jsx';

const TONE_STYLES = {
  muted: 'border-slate-800 bg-slate-900/60 text-slate-300',
  accent: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100',
  win: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100',
  lose: 'border-rose-400/40 bg-rose-400/10 text-rose-100',
  draw: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  warn: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
};

/**
 * One-line, prominent status indicator above the board. The phase token
 * already encodes everything we need to know about what the user is seeing.
 */
export function StatusBanner({ phase, mySymbol }) {
  const { title, subtitle, tone } = copyForPhase(phase);
  const toneClass = TONE_STYLES[tone] ?? TONE_STYLES.muted;

  const showSymbol = phase === PHASE.YOUR_TURN || phase === PHASE.OPPONENT_TURN;
  const symbolToShow = phase === PHASE.YOUR_TURN
    ? mySymbol
    : mySymbol === 'X'
      ? 'O'
      : 'X';

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${toneClass} animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      {showSymbol ? (
        <div className={`grid h-11 w-11 place-items-center rounded-xl bg-slate-950/40 ${
          phase === PHASE.YOUR_TURN ? 'animate-pulse-soft' : ''
        }`}>
          <Symbol value={symbolToShow} className="h-7 w-7" />
        </div>
      ) : (
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950/40 text-lg">
          {iconFor(phase)}
        </div>
      )}

      <div className="min-w-0">
        <div className="truncate text-base font-semibold leading-tight">{title}</div>
        <div className="truncate text-sm opacity-80">{subtitle}</div>
      </div>
    </div>
  );
}

function iconFor(phase) {
  switch (phase) {
    case PHASE.WAITING:
      return '⏳';
    case PHASE.WIN:
      return '🏆';
    case PHASE.LOSE:
      return '💀';
    case PHASE.DRAW:
      return '🤝';
    case PHASE.OPPONENT_LEFT:
    case PHASE.ROOM_CLOSED:
      return '⚠️';
    case PHASE.CONNECTING:
      return '•';
    default:
      return '•';
  }
}
