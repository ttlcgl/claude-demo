/**
 * Socket.IO event wiring for the Tic Tac Toe server.
 *
 * Contract (events the frontend depends on):
 *
 *   Client → Server
 *   ───────────────
 *   create_room  ({ playerName? }, ack?)
 *   join_room    ({ roomId, playerName? }, ack?)
 *   make_move    ({ index }, ack?)
 *   restart_game (ack?)
 *   leave_room   (ack?)
 *
 *   Server → Client
 *   ───────────────
 *   room_created          { room, you }
 *   room_joined           { room, you }            (to the joiner)
 *   game_update           { room, reason }         (broadcast to the room)
 *   player_disconnected   { room, player }         (broadcast to the room)
 *   error_message         { code, message }        (private to the offender)
 *
 * Acks: when a client supplies a callback, we always reply with an
 * `{ ok: boolean, ...payload }` object so the frontend can `await` results.
 */

'use strict';

const { validateMove, applyMove, resetGame } = require('./gameLogic');

/**
 * Wires up all event handlers on a fresh Socket.IO connection.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {import('./roomManager').RoomManager} roomManager
 */
function registerSocketHandlers(io, socket, roomManager) {
  /**
   * Helper: parse Socket.IO handler args into `{ payload, ack }`.
   *
   * Why this exists: Socket.IO appends the optional ack callback as the LAST
   * argument. When a client emits `socket.emit('event', cb)` with no payload,
   * the server handler receives `(cb)` — so a naive `(payload, ack) =>` binds
   * the callback to `payload` and `ack` becomes undefined, leaving the client
   * waiting forever for a response.
   *
   * This parser pulls the trailing function out as `ack` regardless of arity,
   * so handlers work whether the client calls:
   *   socket.emit('event', cb)
   *   socket.emit('event', payload)
   *   socket.emit('event', payload, cb)
   *   socket.emit('event')
   */
  const parseArgs = (args) => {
    let ack;
    let payload = {};
    if (args.length > 0) {
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        ack = last;
        // Remaining leading args (if any) form the payload.
        if (args.length >= 2) {
          payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
        }
      } else {
        payload = args[0] && typeof args[0] === 'object' ? args[0] : {};
      }
    }
    return { payload, ack };
  };

  /** Helper: safely invoke a client-supplied ack callback. */
  const safeAck = (ack, payload) => {
    if (typeof ack === 'function') {
      try {
        ack(payload);
      } catch (err) {
        // The client supplied a broken callback — log and move on.
        console.error(`[socket ${socket.id}] ack threw:`, err);
      }
    }
  };

  /** Helper: send a private error to this socket and (optionally) ack. */
  const sendError = (code, message, ack) => {
    socket.emit('error_message', { code, message });
    safeAck(ack, { ok: false, code, message });
  };

  /** Helper: snapshot of the room for clients (deep copy of the public shape). */
  const view = (room) => roomManager.serialize(room);

  // ─── create_room ────────────────────────────────────────────────────────────
  socket.on('create_room', (...args) => {
    const { payload, ack } = parseArgs(args);
    try {
      const { playerName } = payload;
      const { roomId, room } = roomManager.createRoom(socket.id, playerName);

      socket.join(roomId);

      const you = { socketId: socket.id, symbol: 'X' };
      socket.emit('room_created', { room: view(room), you });
      safeAck(ack, { ok: true, room: view(room), you });
    } catch (err) {
      sendError('CREATE_FAILED', err.message || 'Could not create room.', ack);
    }
  });

  // ─── join_room ──────────────────────────────────────────────────────────────
  socket.on('join_room', (...args) => {
    const { payload, ack } = parseArgs(args);
    try {
      const { roomId, playerName } = payload;
      const room = roomManager.joinRoom(roomId, socket.id, playerName);

      socket.join(room.id);

      const you = { socketId: socket.id, symbol: 'O' };
      socket.emit('room_joined', { room: view(room), you });

      // Tell both players the game is on.
      io.to(room.id).emit('game_update', {
        room: view(room),
        reason: 'player_joined',
      });

      safeAck(ack, { ok: true, room: view(room), you });
    } catch (err) {
      sendError('JOIN_FAILED', err.message || 'Could not join room.', ack);
    }
  });

  // ─── make_move ──────────────────────────────────────────────────────────────
  socket.on('make_move', (...args) => {
    const { payload, ack } = parseArgs(args);
    const ctx = roomManager.getPlayerContext(socket.id);
    if (!ctx) {
      return sendError('NOT_IN_ROOM', 'You are not in a room.', ack);
    }
    const { room, player } = ctx;

    // Coerce payload defensively — clients are untrusted.
    const indexRaw = payload.index;
    const index = Number.isInteger(indexRaw) ? indexRaw : Number.parseInt(indexRaw, 10);

    const check = validateMove(room, player.symbol, index);
    if (!check.valid) {
      return sendError('INVALID_MOVE', check.reason, ack);
    }

    applyMove(room, player.symbol, index);

    io.to(room.id).emit('game_update', {
      room: view(room),
      reason: room.status === 'finished'
        ? (room.winner ? 'win' : 'draw')
        : 'move',
    });

    safeAck(ack, { ok: true, room: view(room) });
  });

  // ─── restart_game ───────────────────────────────────────────────────────────
  socket.on('restart_game', (...args) => {
    const { ack } = parseArgs(args);
    const ctx = roomManager.getPlayerContext(socket.id);
    if (!ctx) {
      return sendError('NOT_IN_ROOM', 'You are not in a room.', ack);
    }
    const { room } = ctx;

    if (room.players.length < 2) {
      return sendError('NOT_ENOUGH_PLAYERS', 'Need two players to restart.', ack);
    }
    if (room.status === 'playing') {
      // Allow restart only after a finished game to avoid griefing mid-match.
      return sendError('GAME_IN_PROGRESS', 'Finish the current round first.', ack);
    }

    resetGame(room);

    io.to(room.id).emit('game_update', {
      room: view(room),
      reason: 'restart',
    });

    safeAck(ack, { ok: true, room: view(room) });
  });

  // ─── leave_room ─────────────────────────────────────────────────────────────
  socket.on('leave_room', (...args) => {
    const { ack } = parseArgs(args);
    handleDeparture(socket, io, roomManager, 'left');
    safeAck(ack, { ok: true });
  });

  // ─── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    handleDeparture(socket, io, roomManager, 'disconnected', reason);
  });
}

/**
 * Centralizes the cleanup path for both deliberate `leave_room` events and
 * underlying socket disconnects. Notifies the remaining player so they aren't
 * left waiting forever for a move that will never come.
 */
function handleDeparture(socket, io, roomManager, kind, reason) {
  const result = roomManager.removeSocket(socket.id);
  if (!result) return;

  const { room, removedPlayer, roomDeleted } = result;
  socket.leave(room.id);

  if (roomDeleted) return;

  io.to(room.id).emit('player_disconnected', {
    room: roomManager.serialize(room),
    player: {
      socketId: removedPlayer.socketId,
      name: removedPlayer.name,
      symbol: removedPlayer.symbol,
    },
    kind, // 'left' | 'disconnected'
    reason: reason || null,
  });

  // Also push a final game_update so generic state listeners on the client
  // refresh without needing a separate code path.
  io.to(room.id).emit('game_update', {
    room: roomManager.serialize(room),
    reason: 'opponent_left',
  });
}

module.exports = { registerSocketHandlers };
