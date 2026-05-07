import { Cell } from './Cell.jsx';

const BOARD_INDICES = Array.from({ length: 9 }, (_, i) => i);

/**
 * Renders the 3x3 grid. The board is dimmed when interactivity is off
 * (waiting, opponent's turn, finished) so the inactive state is unmistakable.
 */
export function Board({ board, winningLine, disabled, onCellClick }) {
  const winning = new Set(winningLine ?? []);
  const cells = board ?? Array(9).fill(null);

  return (
    <div
      className={`grid grid-cols-3 gap-2 sm:gap-3 transition ${
        disabled && (winningLine?.length ?? 0) === 0 ? 'opacity-70' : 'opacity-100'
      }`}
      role="grid"
      aria-label="Tic Tac Toe board"
    >
      {BOARD_INDICES.map((i) => (
        <Cell
          key={i}
          index={i}
          value={cells[i]}
          disabled={disabled}
          isWinning={winning.has(i)}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
}
