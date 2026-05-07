import { useCallback, useEffect, useReducer } from 'react';
import { formatError } from '../lib/status.js';

/**
 * Holds everything the UI needs to render the game once we're in (or trying
 * to enter) a room: the authoritative server room snapshot, our identity
 * (`you = {socketId, symbol}`), transient errors/toasts, and the
 * `opponentLeft` flag we set on `player_disconnected`.
 *
 * Mirrors the backend contract in `backend/src/socketHandlers.js`:
 *
 *   Client → Server (ack `{ ok, room?, you?, code?, message? }`):
 *     create_room  ({ playerName? })
 *     join_room    ({ roomId, playerName? })
 *     make_move    ({ index })
 *     restart_game ()
 *     leave_room   ()
 *
 *   Server → Client:
 *     room_created        { room, you }
 *     room_joined         { room, you }
 *     game_update         { room, reason }
 *     player_disconnected { room, player, kind, reason }
 *     error_message       { code, message }
 */

const initialState = {
  room: null,
  you: null,
  pending: false,
  opponentLeft: false,
  error: null,
  toast: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'PENDING':
      return { ...state, pending: true, error: null };
    case 'JOINED':
      return {
        ...state,
        pending: false,
        error: null,
        opponentLeft: false,
        room: action.room,
        you: action.you,
      };
    case 'ROOM_UPDATE':
      // Drop late updates after we've left so old state can't sneak back in.
      if (!state.you) return state;
      return { ...state, room: action.room, opponentLeft: false };
    case 'OPPONENT_LEFT':
      // The server still sends a fresh room snapshot here; keep it so the UI
      // can render the post-departure state instead of stale board data.
      return {
        ...state,
        opponentLeft: true,
        room: action.room ?? state.room,
      };
    case 'TOAST':
      return { ...state, toast: action.message };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'ERROR':
      return { ...state, pending: false, error: action.message };
    case 'LEAVE':
      return { ...initialState };
    default:
      return state;
  }
}

export function useGameRoom(socket) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!socket) return undefined;

    const onGameUpdate = (payload) => {
      const room = payload?.room ?? payload;
      if (room) dispatch({ type: 'ROOM_UPDATE', room });
    };
    // The server emits room_created/room_joined to the originator; acks
    // already give us the same data, but listening here is cheap insurance
    // if a future server tweak ever drops one or the other.
    const onJoined = (payload) => {
      if (payload?.room && payload?.you) {
        dispatch({ type: 'JOINED', room: payload.room, you: payload.you });
      }
    };
    const onPlayerDisconnected = (payload) => {
      dispatch({ type: 'OPPONENT_LEFT', room: payload?.room });
      const name = payload?.player?.name || 'Opponent';
      const verb = payload?.kind === 'left' ? 'left the room' : 'disconnected';
      dispatch({ type: 'TOAST', message: `${name} ${verb}.` });
    };
    const onErrorMessage = (payload) => {
      dispatch({ type: 'TOAST', message: formatError(payload) });
    };

    socket.on('game_update', onGameUpdate);
    socket.on('room_created', onJoined);
    socket.on('room_joined', onJoined);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('error_message', onErrorMessage);

    return () => {
      socket.off('game_update', onGameUpdate);
      socket.off('room_created', onJoined);
      socket.off('room_joined', onJoined);
      socket.off('player_disconnected', onPlayerDisconnected);
      socket.off('error_message', onErrorMessage);
    };
  }, [socket]);

  // Auto-dismiss toasts after a moment.
  useEffect(() => {
    if (!state.toast) return undefined;
    const id = setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 2400);
    return () => clearTimeout(id);
  }, [state.toast]);

  // The backend uses `{ ok, room?, you?, code?, message? }` for every ack,
  // so one helper handles them all.
  const handleAck = useCallback((resp, { onSuccess, fallback }) => {
    if (resp && resp.ok) {
      onSuccess?.(resp);
      return;
    }
    dispatch({ type: 'ERROR', message: formatError(resp ?? fallback) });
  }, []);

  const createRoom = useCallback(
    (playerName) => {
      if (!socket) return;
      dispatch({ type: 'PENDING' });
      socket.emit(
        'create_room',
        { playerName: playerName?.trim() || undefined },
        (resp) => handleAck(resp, {
          fallback: 'Could not create room.',
          onSuccess: ({ room, you }) => dispatch({ type: 'JOINED', room, you }),
        }),
      );
    },
    [socket, handleAck],
  );

  const joinRoom = useCallback(
    (roomId, playerName) => {
      if (!socket) return;
      const trimmed = String(roomId ?? '').trim().toUpperCase();
      if (!trimmed) {
        dispatch({ type: 'ERROR', message: 'Enter a room code first.' });
        return;
      }
      dispatch({ type: 'PENDING' });
      socket.emit(
        'join_room',
        { roomId: trimmed, playerName: playerName?.trim() || undefined },
        (resp) => handleAck(resp, {
          fallback: 'Could not join room.',
          onSuccess: ({ room, you }) => dispatch({ type: 'JOINED', room, you }),
        }),
      );
    },
    [socket, handleAck],
  );

  const makeMove = useCallback(
    (index) => {
      if (!socket || !state.room) return;
      socket.emit('make_move', { index }, (resp) => {
        if (resp && !resp.ok) {
          dispatch({ type: 'TOAST', message: formatError(resp) });
        }
      });
    },
    [socket, state.room],
  );

  const restartGame = useCallback(() => {
    if (!socket || !state.room) return;
    socket.emit('restart_game', (resp) => {
      if (resp && !resp.ok) {
        dispatch({ type: 'TOAST', message: formatError(resp) });
      }
    });
  }, [socket, state.room]);

  const leaveRoom = useCallback(() => {
    if (socket && state.room) {
      socket.emit('leave_room');
    }
    dispatch({ type: 'LEAVE' });
  }, [socket, state.room]);

  return {
    ...state,
    mySymbol: state.you?.symbol ?? null,
    createRoom,
    joinRoom,
    makeMove,
    restartGame,
    leaveRoom,
  };
}
