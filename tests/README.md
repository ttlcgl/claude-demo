# Tic Tac Toe — QA Test Suite

Authoritative QA artifacts for the multiplayer Tic Tac Toe game.

## Where tests actually live

The team chose to colocate tests next to the code they exercise, so the
runnable tests are NOT in this directory:

```
backend/test/
├── gameLogic.test.js     # Pure game-rule unit tests (Node's built-in test runner)
├── roomManager.test.js   # Room/session lifecycle unit tests
└── integration.test.js   # End-to-end Socket.IO multiplayer integration

frontend/test/
└── status.test.mjs       # Pure phase-derivation logic tests (lib/status.js)
```

This directory (`tests/`) holds the **non-runnable** QA artifacts:

```
tests/
├── README.md             # this file
├── bug-reports.md        # bug findings + coverage matrix
└── scenarios/            # manual / exploratory test scenarios
    ├── edge-cases.md     # 13 edge-case scenarios
    └── multiplayer-sync.md  # 8 state-consistency scenarios
```

## Running

```bash
# Backend (gameLogic, roomManager, Socket.IO integration) — 72 tests
cd backend && npm test

# Frontend (pure status.js logic) — 23 tests
node --test frontend/test/status.test.mjs
```

Combined: **95 automated tests, all passing** as of this report.

The frontend test runs from the repo root because `frontend/package.json`
doesn't have a configured test script — `status.js` is pure ES modules with
no React imports, so Node's built-in test runner exercises it directly.

## What's covered

See `bug-reports.md` for the full coverage matrix. Briefly:

- **Game logic (unit):** all 8 winning lines, draws, immutability, move
  validation, turn enforcement, reset behavior incl. starter-alternation.
- **Room management (unit):** create / join (incl. case-insensitive code),
  capacity, disconnect cleanup, serialization safety, stats.
- **Socket.IO integration:** create_room, join_room (incl. failure modes),
  make_move (incl. forged-symbol attack, occupied cell, out-of-bounds),
  win + draw broadcasts, restart_game (incl. starter alternation, in-progress
  rejection), disconnect & leave_room flows, two-room isolation, malformed
  input safety.
- **Frontend (unit):** isPlaying / isFinished / isDraw helpers, findOpponent
  / findMe, derivePhase across all phases, copyForPhase totality,
  formatError across input shapes (string code, ack object, object with
  message, null/undefined).

## What's NOT automated

UI rendering, socket-reconnect behavior, mobile layout, accessibility, and
exhaustion/rate-limit scenarios — all enumerated as manual scenarios in
`scenarios/`. Run those after each release candidate.

## Authoritative state shape (verified against the implementation)

The contract these tests assert (re-derived from the actual backend after
implementation landed; the earlier draft of this README was a pre-emptive
guess and has been corrected):

```
Room (from roomManager.serialize) — what clients receive
{
  id: string,                                  // 6-char room code (uppercase)
  players: [{ socketId, name, symbol: 'X'|'O' }],
  board: (null|'X'|'O')[9],
  currentTurn: 'X'|'O'|null,                   // null when finished
  status: 'waiting'|'playing'|'finished',
  winner: 'X'|'O'|null,                        // null on draw OR in-progress
  winningLine: number[]|null,
  moveCount: number,
  round: number,
  lastMove: { index, symbol, at }|null
}
```

**Status literal:** the backend uses `'playing'` for an active game (not
`'in_progress'` as an earlier draft of this doc suggested). The frontend
defensively accepts both, but tests assert the actual `'playing'` literal.

**Draw encoding:** `status === 'finished' && winner === null && winningLine
=== null`. The `'draw'` string is NOT used by the backend; tests assert the
real null encoding.
