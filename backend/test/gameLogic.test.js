/**
 * Unit tests for backend/src/gameLogic.js — pure game rules.
 *
 * Uses Node's built-in test runner (no external deps).
 * Run: cd backend && npm test
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BOARD_SIZE,
  WIN_LINES,
  createEmptyBoard,
  validateMove,
  checkWinner,
  isBoardFull,
  applyMove,
  resetGame,
} = require('../src/gameLogic');

function gameWithBoard(board, currentTurn = 'X', status = 'playing') {
  return {
    board: [...board],
    currentTurn,
    startingSymbol: 'X',
    status,
    winner: null,
    winningLine: null,
    moveCount: board.filter((c) => c !== null).length,
    round: 1,
    lastMove: null,
  };
}

test('BOARD_SIZE is 9', () => {
  assert.equal(BOARD_SIZE, 9);
});

test('WIN_LINES has 8 lines, each with 3 distinct cells in [0,8]', () => {
  assert.equal(WIN_LINES.length, 8);
  for (const line of WIN_LINES) {
    assert.equal(line.length, 3);
    assert.equal(new Set(line).size, 3);
    for (const i of line) {
      assert.ok(i >= 0 && i <= 8, `index ${i} out of bounds`);
    }
  }
});

test('createEmptyBoard returns 9 nulls', () => {
  const b = createEmptyBoard();
  assert.equal(b.length, 9);
  assert.ok(b.every((c) => c === null));
});

test('createEmptyBoard returns a fresh array each call', () => {
  const a = createEmptyBoard();
  const b = createEmptyBoard();
  a[0] = 'X';
  assert.equal(b[0], null);
});

// ── validateMove ─────────────────────────────────────────────────────────────

test('validateMove: rejects when status != playing', () => {
  const game = gameWithBoard(createEmptyBoard(), 'X', 'waiting');
  const r = validateMove(game, 'X', 0);
  assert.equal(r.valid, false);
  assert.match(r.reason, /not in progress/i);
});

test('validateMove: rejects non-integer index', () => {
  const game = gameWithBoard(createEmptyBoard());
  assert.equal(validateMove(game, 'X', 1.5).valid, false);
  assert.equal(validateMove(game, 'X', '0').valid, false);
  assert.equal(validateMove(game, 'X', NaN).valid, false);
});

test('validateMove: rejects out-of-bounds index', () => {
  const game = gameWithBoard(createEmptyBoard());
  assert.equal(validateMove(game, 'X', -1).valid, false);
  assert.equal(validateMove(game, 'X', 9).valid, false);
});

test('validateMove: rejects bad symbol', () => {
  const game = gameWithBoard(createEmptyBoard());
  assert.equal(validateMove(game, 'Z', 0).valid, false);
});

test('validateMove: rejects move when not your turn', () => {
  const game = gameWithBoard(createEmptyBoard()); // X's turn
  const r = validateMove(game, 'O', 0);
  assert.equal(r.valid, false);
  assert.match(r.reason, /not your turn/i);
});

test('validateMove: rejects move on occupied cell', () => {
  const board = createEmptyBoard();
  board[0] = 'X';
  const game = gameWithBoard(board);
  const r = validateMove(game, 'X', 0);
  assert.equal(r.valid, false);
  assert.match(r.reason, /already taken/i);
});

test('validateMove: accepts a legal move', () => {
  const game = gameWithBoard(createEmptyBoard());
  assert.equal(validateMove(game, 'X', 4).valid, true);
});

// ── checkWinner ──────────────────────────────────────────────────────────────

for (const line of [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]) {
  test(`checkWinner: detects X win on line ${JSON.stringify(line)}`, () => {
    const board = createEmptyBoard();
    line.forEach((i) => (board[i] = 'X'));
    const r = checkWinner(board);
    assert.equal(r.winner, 'X');
    assert.deepEqual(r.line, line);
  });
}

test('checkWinner: returns null winner on empty board', () => {
  const r = checkWinner(createEmptyBoard());
  assert.equal(r.winner, null);
  assert.equal(r.line, null);
});

test('checkWinner: does not match a mixed line', () => {
  const board = ['X', 'O', 'X', null, null, null, null, null, null];
  assert.equal(checkWinner(board).winner, null);
});

test('checkWinner: returns null on a full draw board', () => {
  // X O X / X O O / O X X
  const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.equal(checkWinner(board).winner, null);
});

// ── isBoardFull ──────────────────────────────────────────────────────────────

test('isBoardFull: false on empty', () => {
  assert.equal(isBoardFull(createEmptyBoard()), false);
});

test('isBoardFull: true when no nulls remain', () => {
  const b = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
  assert.equal(isBoardFull(b), true);
});

test('isBoardFull: false with one null', () => {
  const b = ['X', 'O', 'X', null, 'O', 'O', 'O', 'X', 'X'];
  assert.equal(isBoardFull(b), false);
});

// ── applyMove ────────────────────────────────────────────────────────────────

test('applyMove: places symbol, increments moveCount, advances turn', () => {
  const game = gameWithBoard(createEmptyBoard());
  const r = applyMove(game, 'X', 4);
  assert.equal(game.board[4], 'X');
  assert.equal(game.moveCount, 1);
  assert.equal(game.currentTurn, 'O');
  assert.equal(r.status, 'playing');
  assert.equal(r.winner, null);
});

test('applyMove: detects a win and finalizes the game', () => {
  // X already has 0,4 → playing 8 wins
  const board = ['X', null, null, null, 'X', null, null, null, null];
  const game = gameWithBoard(board, 'X');
  game.moveCount = 2;
  const r = applyMove(game, 'X', 8);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'X');
  assert.deepEqual(game.winningLine, [0, 4, 8]);
  assert.equal(game.currentTurn, null);
  assert.equal(r.winner, 'X');
});

test('applyMove: detects a draw (board full, no winner)', () => {
  // Set up X O X / X O O / O X _  with X to move on 8
  const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null];
  const game = gameWithBoard(board, 'X');
  game.moveCount = 8;
  applyMove(game, 'X', 8);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, null); // draw represented as null
  assert.equal(game.winningLine, null);
  assert.equal(game.currentTurn, null);
});

test('applyMove: lastMove is recorded', () => {
  const game = gameWithBoard(createEmptyBoard());
  applyMove(game, 'X', 3);
  assert.equal(game.lastMove.index, 3);
  assert.equal(game.lastMove.symbol, 'X');
  assert.equal(typeof game.lastMove.at, 'number');
});

// ── resetGame ────────────────────────────────────────────────────────────────

test('resetGame: clears board and alternates starting symbol', () => {
  const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
  const game = gameWithBoard(board, null, 'finished');
  game.winner = 'X';
  game.winningLine = [0, 1, 2];
  game.startingSymbol = 'X';
  game.round = 1;

  resetGame(game);

  assert.deepEqual(game.board, createEmptyBoard());
  assert.equal(game.status, 'playing');
  assert.equal(game.winner, null);
  assert.equal(game.winningLine, null);
  assert.equal(game.startingSymbol, 'O', 'expected starting symbol to alternate to O');
  assert.equal(game.currentTurn, 'O');
  assert.equal(game.round, 2);
  assert.equal(game.moveCount, 0);
});

test('resetGame: alternates starting symbol again on second reset', () => {
  const game = gameWithBoard(createEmptyBoard(), null, 'finished');
  game.startingSymbol = 'X';
  resetGame(game); // → O
  resetGame(game); // → X
  assert.equal(game.startingSymbol, 'X');
  assert.equal(game.currentTurn, 'X');
});

// ── full-game integration ────────────────────────────────────────────────────

test('integration: X wins via diagonal in a full game', () => {
  const game = gameWithBoard(createEmptyBoard());
  const moves = [['X', 0], ['O', 1], ['X', 4], ['O', 2], ['X', 8]];
  for (const [sym, idx] of moves) {
    const v = validateMove(game, sym, idx);
    assert.ok(v.valid, `move ${sym}@${idx} should be valid: ${v.reason}`);
    applyMove(game, sym, idx);
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'X');
  assert.deepEqual(game.winningLine, [0, 4, 8]);
});

test('integration: full draw game', () => {
  const game = gameWithBoard(createEmptyBoard());
  const moves = [
    ['X', 0], ['O', 1],
    ['X', 2], ['O', 4],
    ['X', 3], ['O', 5],
    ['X', 7], ['O', 6],
    ['X', 8],
  ];
  for (const [sym, idx] of moves) {
    const v = validateMove(game, sym, idx);
    assert.ok(v.valid, `move ${sym}@${idx} should be valid: ${v.reason}`);
    applyMove(game, sym, idx);
  }
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, null);
  assert.equal(isBoardFull(game.board), true);
});
