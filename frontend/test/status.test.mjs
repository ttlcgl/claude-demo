/**
 * Unit tests for frontend/src/lib/status.js — pure phase-derivation logic.
 *
 * Run from the repo root:
 *   node --test frontend/test/status.test.mjs
 *
 * status.js has no React/socket imports, so node:test exercises it directly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PHASE,
  isPlaying,
  isFinished,
  isDraw,
  findOpponent,
  findMe,
  derivePhase,
  copyForPhase,
  formatError,
} from '../src/lib/status.js';

const PLAYERS = [
  { socketId: 's1', name: 'A', symbol: 'X' },
  { socketId: 's2', name: 'B', symbol: 'O' },
];

function makeRoom(overrides = {}) {
  return {
    id: 'ABC123',
    players: PLAYERS,
    board: Array(9).fill(null),
    currentTurn: 'X',
    status: 'playing',
    winner: null,
    winningLine: null,
    moveCount: 0,
    round: 1,
    lastMove: null,
    ...overrides,
  };
}

// ── isPlaying / isFinished / isDraw ─────────────────────────────────────────

test('isPlaying: true only for status=playing', () => {
  assert.equal(isPlaying(makeRoom({ status: 'playing' })), true);
  assert.equal(isPlaying(makeRoom({ status: 'waiting' })), false);
  assert.equal(isPlaying(makeRoom({ status: 'finished' })), false);
  assert.equal(isPlaying(null), false);
  assert.equal(isPlaying(undefined), false);
});

test('isFinished: true only for status=finished', () => {
  assert.equal(isFinished(makeRoom({ status: 'finished' })), true);
  assert.equal(isFinished(makeRoom({ status: 'playing' })), false);
  assert.equal(isFinished(null), false);
});

test('isDraw: true only when finished AND winner is null', () => {
  assert.equal(isDraw(makeRoom({ status: 'finished', winner: null })), true);
  assert.equal(isDraw(makeRoom({ status: 'finished', winner: 'X' })), false);
  assert.equal(isDraw(makeRoom({ status: 'playing', winner: null })), false);
});

// ── findOpponent / findMe ───────────────────────────────────────────────────

test('findOpponent: returns the other-symbol player', () => {
  assert.equal(findOpponent(makeRoom(), 'X').symbol, 'O');
  assert.equal(findOpponent(makeRoom(), 'O').symbol, 'X');
});

test('findOpponent: returns null when only one player is present', () => {
  const single = makeRoom({ players: [PLAYERS[0]] });
  assert.equal(findOpponent(single, 'X'), null);
});

test('findOpponent: returns null when mySymbol is missing', () => {
  assert.equal(findOpponent(makeRoom(), null), null);
});

test('findMe: returns the player matching you.socketId', () => {
  const me = findMe(makeRoom(), { socketId: 's1' });
  assert.equal(me.symbol, 'X');
});

test('findMe: returns null on missing input', () => {
  assert.equal(findMe(null, { socketId: 's1' }), null);
  assert.equal(findMe(makeRoom(), null), null);
});

// ── derivePhase ─────────────────────────────────────────────────────────────

test('derivePhase: LOBBY when no room', () => {
  assert.equal(derivePhase({ room: null, mySymbol: null }), PHASE.LOBBY);
});

test('derivePhase: WAITING when only one player', () => {
  const r = makeRoom({ status: 'waiting', players: [PLAYERS[0]] });
  assert.equal(derivePhase({ room: r, mySymbol: 'X' }), PHASE.WAITING);
});

test('derivePhase: YOUR_TURN when playing and currentTurn matches mySymbol', () => {
  assert.equal(
    derivePhase({ room: makeRoom({ currentTurn: 'X' }), mySymbol: 'X' }),
    PHASE.YOUR_TURN,
  );
});

test('derivePhase: OPPONENT_TURN when playing and currentTurn != mySymbol', () => {
  assert.equal(
    derivePhase({ room: makeRoom({ currentTurn: 'O' }), mySymbol: 'X' }),
    PHASE.OPPONENT_TURN,
  );
});

test('derivePhase: WIN when finished and winner == mySymbol', () => {
  const r = makeRoom({ status: 'finished', winner: 'X', currentTurn: null });
  assert.equal(derivePhase({ room: r, mySymbol: 'X' }), PHASE.WIN);
});

test('derivePhase: LOSE when finished and winner != mySymbol (and not draw)', () => {
  const r = makeRoom({ status: 'finished', winner: 'O', currentTurn: null });
  assert.equal(derivePhase({ room: r, mySymbol: 'X' }), PHASE.LOSE);
});

test('derivePhase: DRAW when finished and winner is null', () => {
  const r = makeRoom({ status: 'finished', winner: null, currentTurn: null });
  assert.equal(derivePhase({ room: r, mySymbol: 'X' }), PHASE.DRAW);
});

test('derivePhase: OPPONENT_LEFT when flag set and game still active', () => {
  assert.equal(
    derivePhase({ room: makeRoom(), mySymbol: 'X', opponentLeft: true }),
    PHASE.OPPONENT_LEFT,
  );
});

test('derivePhase: opponentLeft is ignored when game already finished (terminal phases win)', () => {
  const r = makeRoom({ status: 'finished', winner: 'X', currentTurn: null });
  assert.equal(
    derivePhase({ room: r, mySymbol: 'X', opponentLeft: true }),
    PHASE.WIN,
  );
});

// ── copyForPhase ────────────────────────────────────────────────────────────

test('copyForPhase: every PHASE has title/subtitle/tone copy', () => {
  for (const phase of Object.values(PHASE)) {
    const c = copyForPhase(phase);
    assert.ok(c.title, `missing title for ${phase}`);
    assert.ok(c.subtitle, `missing subtitle for ${phase}`);
    assert.ok(c.tone, `missing tone for ${phase}`);
  }
});

test('copyForPhase: falls back to LOBBY copy on unknown phase', () => {
  assert.deepEqual(copyForPhase('not-a-phase'), copyForPhase(PHASE.LOBBY));
});

// ── formatError ─────────────────────────────────────────────────────────────

test('formatError: maps known error codes (string input)', () => {
  assert.match(formatError('ROOM_NOT_FOUND'), /no room/i);
  assert.match(formatError('ROOM_FULL'), /two players/i);
  assert.match(formatError('NOT_IN_ROOM'), /not in a room/i);
  assert.match(formatError('INVALID_MOVE'), /invalid/i);
});

test('formatError: prefers server-supplied message over code mapping', () => {
  // Backend sends `{ ok: false, code, message }` — frontend should show message
  const ack = { ok: false, code: 'ROOM_FULL', message: 'Room is full.' };
  assert.equal(formatError(ack), 'Room is full.');
});

test('formatError: falls back to code mapping when only code is present', () => {
  assert.match(formatError({ code: 'ROOM_FULL' }), /two players/i);
});

test('formatError: returns generic fallback for null/undefined/unknown', () => {
  assert.match(formatError(null), /something went wrong/i);
  assert.match(formatError(undefined), /something went wrong/i);
  assert.match(formatError(42), /something went wrong/i);
});
