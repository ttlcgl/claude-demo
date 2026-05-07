/**
 * Pure helpers that derive UI-facing state from the authoritative `room`
 * snapshot the server broadcasts. No React, no socket, no side effects —
 * components stay dumb renderers.
 *
 * Room shape (from backend `roomManager.serialize`):
 *   {
 *     id: string,
 *     players: [{ socketId, name, symbol: 'X'|'O' }],
 *     board: (null|'X'|'O')[9],
 *     currentTurn: 'X' | 'O' | null,
 *     status: 'waiting' | 'playing' | 'finished',
 *     winner: 'X' | 'O' | null,        // null for draw or in-progress
 *     winningLine: number[] | null,
 *     moveCount: number,
 *     round: number,
 *     lastMove: { index, symbol, at } | null
 *   }
 *
 *   you (from server ack / room_created / room_joined):
 *   { socketId, symbol }
 *
 * Note: a *draw* is encoded as `status === 'finished' && winner === null`.
 */

export const PHASE = Object.freeze({
  CONNECTING: 'connecting',
  LOBBY: 'lobby',
  WAITING: 'waiting',
  YOUR_TURN: 'your_turn',
  OPPONENT_TURN: 'opponent_turn',
  WIN: 'win',
  LOSE: 'lose',
  DRAW: 'draw',
  OPPONENT_LEFT: 'opponent_left',
});

export function isPlaying(room) {
  return room?.status === 'playing';
}

export function isFinished(room) {
  return room?.status === 'finished';
}

export function isDraw(room) {
  return isFinished(room) && room.winner == null;
}

export function findOpponent(room, mySymbol) {
  if (!room?.players || !mySymbol) return null;
  return room.players.find((p) => p.symbol && p.symbol !== mySymbol) ?? null;
}

export function findMe(room, you) {
  if (!room?.players || !you?.socketId) return null;
  return room.players.find((p) => p.socketId === you.socketId) ?? null;
}

/**
 * Reduce (room, mySymbol, opponentLeft) to a single phase token the UI
 * switches on. Order matters — checks go from most to least specific.
 */
export function derivePhase({ room, mySymbol, opponentLeft }) {
  if (!room) return PHASE.LOBBY;
  if (opponentLeft && !isFinished(room)) return PHASE.OPPONENT_LEFT;

  if (isFinished(room)) {
    if (isDraw(room)) return PHASE.DRAW;
    return room.winner === mySymbol ? PHASE.WIN : PHASE.LOSE;
  }

  if (room.status === 'waiting' || (room.players?.length ?? 0) < 2) {
    return PHASE.WAITING;
  }

  if (isPlaying(room)) {
    return room.currentTurn === mySymbol ? PHASE.YOUR_TURN : PHASE.OPPONENT_TURN;
  }

  return PHASE.WAITING;
}

const PHASE_COPY = {
  [PHASE.CONNECTING]: {
    title: 'Connecting…',
    subtitle: 'Talking to the server.',
    tone: 'muted',
  },
  [PHASE.LOBBY]: {
    title: 'Ready when you are',
    subtitle: 'Create a room or join one with a code.',
    tone: 'muted',
  },
  [PHASE.WAITING]: {
    title: 'Waiting for opponent',
    subtitle: 'Share the room code below to start the match.',
    tone: 'muted',
  },
  [PHASE.YOUR_TURN]: {
    title: 'Your turn',
    subtitle: 'Make your move.',
    tone: 'accent',
  },
  [PHASE.OPPONENT_TURN]: {
    title: "Opponent's turn",
    subtitle: 'Hang tight — they’re thinking.',
    tone: 'muted',
  },
  [PHASE.WIN]: {
    title: 'You won!',
    subtitle: 'Three in a row. Want to go again?',
    tone: 'win',
  },
  [PHASE.LOSE]: {
    title: 'You lost',
    subtitle: 'Close one. Rematch?',
    tone: 'lose',
  },
  [PHASE.DRAW]: {
    title: 'Draw',
    subtitle: 'A fair fight. Restart for round two.',
    tone: 'draw',
  },
  [PHASE.OPPONENT_LEFT]: {
    title: 'Opponent disconnected',
    subtitle: 'Waiting for them to come back, or leave the room.',
    tone: 'warn',
  },
};

export function copyForPhase(phase) {
  return PHASE_COPY[phase] ?? PHASE_COPY[PHASE.LOBBY];
}

const ERROR_MESSAGES = {
  CREATE_FAILED: 'Could not create room.',
  JOIN_FAILED: 'Could not join room.',
  ROOM_NOT_FOUND: 'No room with that code.',
  ROOM_FULL: 'That room already has two players.',
  NOT_IN_ROOM: 'You’re not in a room anymore.',
  INVALID_MOVE: 'Invalid move.',
  GAME_IN_PROGRESS: 'Finish the current round first.',
  NOT_ENOUGH_PLAYERS: 'Need two players for that.',
};

/**
 * Errors arrive in a few shapes:
 *   - server `error_message` event: { code, message }
 *   - failed ack:                   { ok: false, code, message }
 *   - bare string code:             'ROOM_NOT_FOUND'
 *
 * Prefer the server-provided `message` (it tends to be specific) and fall
 * back to our friendly mapping when only a code is available.
 */
export function formatError(err) {
  if (!err) return 'Something went wrong.';
  if (typeof err === 'string') return ERROR_MESSAGES[err] ?? err;
  if (typeof err === 'object') {
    if (err.message) return err.message;
    if (err.code) return ERROR_MESSAGES[err.code] ?? err.code;
  }
  return 'Something went wrong.';
}
