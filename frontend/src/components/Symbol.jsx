/**
 * Renders an X or O glyph as inline SVG so it scales crisply with the cell
 * and we can apply Tailwind text utilities (currentColor) for theming.
 *
 * Each symbol has its own accent color and drop-shadow glow so the dark
 * theme reads at a glance.
 */
export function Symbol({ value, className = '', glow = true }) {
  if (value !== 'X' && value !== 'O') return null;

  const isX = value === 'X';
  const color = isX ? 'text-cyan-300' : 'text-fuchsia-300';
  const filter = glow
    ? isX
      ? 'drop-shadow(0 0 14px rgba(34, 211, 238, 0.55))'
      : 'drop-shadow(0 0 14px rgba(232, 121, 249, 0.55))'
    : 'none';

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={value}
      className={`${color} ${className}`.trim()}
      style={{ filter }}
    >
      {isX ? (
        <g
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        >
          <line x1="22" y1="22" x2="78" y2="78" />
          <line x1="78" y1="22" x2="22" y2="78" />
        </g>
      ) : (
        <circle
          cx="50"
          cy="50"
          r="28"
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
        />
      )}
    </svg>
  );
}
