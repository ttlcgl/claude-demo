import { Symbol } from './Symbol.jsx';

/**
 * A single 3x3 cell. Clickable when empty, on your turn, and not finished.
 * Winning cells get an emerald ring + soft glow so the result reads instantly.
 */
export function Cell({ value, index, onClick, disabled, isWinning }) {
  const empty = value == null;
  const interactive = !disabled && empty;

  const base =
    'group relative aspect-square w-full select-none rounded-2xl border transition duration-150 flex items-center justify-center';
  const surface = isWinning
    ? 'border-emerald-400/70 bg-emerald-400/10 animate-glow-pulse'
    : 'border-slate-800 bg-slate-900/60';
  const interaction = interactive
    ? 'cursor-pointer hover:border-slate-700 hover:bg-slate-900/90 active:scale-[0.98]'
    : 'cursor-not-allowed';

  return (
    <button
      type="button"
      onClick={interactive ? () => onClick(index) : undefined}
      disabled={!interactive}
      aria-label={`Cell ${index + 1}${value ? `, ${value}` : ', empty'}`}
      className={`${base} ${surface} ${interaction}`}
    >
      {value ? (
        <Symbol value={value} className="h-3/5 w-3/5 animate-pop-in" />
      ) : interactive ? (
        // Faint hover preview hint so users learn the affordance.
        <span className="pointer-events-none h-2 w-2 rounded-full bg-slate-700 opacity-0 transition group-hover:opacity-100" />
      ) : null}
    </button>
  );
}
