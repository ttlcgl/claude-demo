/**
 * Pure game logic for Tic Tac Toe.
 *
 * No I/O, no side effects — every function is deterministic and easy to unit test.
 * The board is represented as a flat array of 9 cells:
 *   indices: 0 1 2
 *            3 4 5
 *            6 7 8
 * Each cell is either 'X', 'O', or null.
 */

'use strict';

const BOARD_SIZE = 9;

/** All 8 winning lines (rows, columns, diagonals) as cell index triples. */
const WIN_LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
]);

/** Returns a fresh empty board (9 nulls). */
function createEmptyBoard() {
  return Array(BOARD_SIZE).fill(null);
}

/**
 * Validates whether a move is legal in the current game state.
 *
 * @param {Object} game - The room's game state.
 * @param {string} playerSymbol - 'X' or 'O'.
 * @param {number} index - Cell index (0–8).
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateMove(game, playerSymbol, index) {
  if (game.status !== 'playing') {
    return { valid: false, reason: 'Game is not in progress.' };
  }
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    return { valid: false, reason: 'Invalid cell index.' };
  }
  if (playerSymbol !== 'X' && playerSymbol !== 'O') {
    return { valid: false, reason: 'Invalid player symbol.' };
  }
  if (game.currentTurn !== playerSymbol) {
    return { valid: false, reason: 'Not your turn.' };
  }
  if (game.board[index] !== null) {
    return { valid: false, reason: 'Cell already taken.' };
  }
  return { valid: true };
}

/**
 * Checks the board for a winner.
 *
 * @param {Array<string|null>} board
 * @returns {{ winner: 'X'|'O'|null, line: number[]|null }}
 *   `line` contains the three winning cell indices when there's a winner,
 *   or null otherwise (caller can use it to highlight winning cells).
 */
function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return { winner: v, line: [...line] };
    }
  }
  return { winner: null, line: null };
}

/** Returns true if every cell is filled. */
function isBoardFull(board) {
  return board.every((cell) => cell !== null);
}

/**
 * Applies a validated move and updates the game state in place.
 * Caller must run validateMove first; this function trusts its inputs.
 *
 * Returns a small summary describing the resulting state transition.
 *
 * @param {Object} game
 * @param {string} playerSymbol
 * @param {number} index
 * @returns {{ status: string, winner: string|null, winningLine: number[]|null }}
 */
function applyMove(game, playerSymbol, index) {
  game.board[index] = playerSymbol;
  game.moveCount += 1;
  game.lastMove = { index, symbol: playerSymbol, at: Date.now() };

  const { winner, line } = checkWinner(game.board);
  if (winner) {
    game.status = 'finished';
    game.winner = winner;
    game.winningLine = line;
    game.currentTurn = null;
  } else if (isBoardFull(game.board)) {
    game.status = 'finished';
    game.winner = null; // draw
    game.winningLine = null;
    game.currentTurn = null;
  } else {
    game.currentTurn = playerSymbol === 'X' ? 'O' : 'X';
  }

  return {
    status: game.status,
    winner: game.winner,
    winningLine: game.winningLine,
  };
}

/**
 * Resets the game state for a rematch within an existing room.
 * Keeps players in place but alternates who starts so it stays fair.
 *
 * @param {Object} game
 */
function resetGame(game) {
  game.board = createEmptyBoard();
  game.moveCount = 0;
  game.winner = null;
  game.winningLine = null;
  game.lastMove = null;
  // Alternate starter across rounds so 'X' isn't always favored.
  game.startingSymbol = game.startingSymbol === 'X' ? 'O' : 'X';
  game.currentTurn = game.startingSymbol;
  game.status = 'playing';
  game.round = (game.round || 0) + 1;
}

module.exports = {
  BOARD_SIZE,
  WIN_LINES,
  createEmptyBoard,
  validateMove,
  checkWinner,
  isBoardFull,
  applyMove,
  resetGame,
};
