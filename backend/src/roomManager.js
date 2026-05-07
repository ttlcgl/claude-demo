/**
 * In-memory room/state manager for Tic Tac Toe.
 *
 * Why in-memory: gameplay is short-lived and authoritative state lives on the
 * server only for the duration of a match. If we ever needed persistence
 * (reconnection across server restarts, leaderboards), this is the seam where
 * Redis or another store would be swapped in.
 *
 * Concurrency: Node.js runs JS handlers single-threaded, so plain Maps are safe
 * here — there are no overlapping mutations to a single room.
 */

'use strict';

const { createEmptyBoard } = require('./gameLogic');

/** 6-character room codes — short enough to share verbally, large enough to be unique. */
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omits ambiguous 0/O/1/I
const MAX_GENERATION_ATTEMPTS = 10;

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} roomId → Room */
    this.rooms = new Map();
    /** @type {Map<string, string>} socketId → roomId (for fast disconnect lookup) */
    this.socketIndex = new Map();
  }

  /**
   * Creates a new room with the first player assigned 'X'.
   * @param {string} socketId
   * @param {string} [playerName]
   * @returns {{ roomId: string, room: Room }}
   */
  createRoom(socketId, playerName) {
    if (this.socketIndex.has(socketId)) {
      throw new Error('You are already in a room.');
    }
    const roomId = this._generateUniqueRoomId();
    const room = {
      id: roomId,
      players: [
        {
          socketId,
          name: this._sanitizeName(playerName) || 'Player 1',
          symbol: 'X',
        },
      ],
      board: createEmptyBoard(),
      currentTurn: 'X',
      startingSymbol: 'X',
      status: 'waiting', // waiting | playing | finished
      winner: null,
      winningLine: null,
      moveCount: 0,
      round: 1,
      lastMove: null,
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    this.socketIndex.set(socketId, roomId);
    return { roomId, room };
  }

  /**
   * Adds a second player to an existing room.
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} [playerName]
   * @returns {Room}
   * @throws {Error} when the room is missing, full, already started, or socket is busy.
   */
  joinRoom(roomId, socketId, playerName) {
    if (!roomId || typeof roomId !== 'string') {
      throw new Error('Room ID is required.');
    }
    if (this.socketIndex.has(socketId)) {
      throw new Error('You are already in a room.');
    }
    const room = this.rooms.get(roomId.toUpperCase());
    if (!room) {
      throw new Error('Room not found.');
    }
    if (room.players.length >= 2) {
      throw new Error('Room is full.');
    }
    room.players.push({
      socketId,
      name: this._sanitizeName(playerName) || 'Player 2',
      symbol: 'O',
    });
    room.status = 'playing';
    this.socketIndex.set(socketId, room.id);
    return room;
  }

  /** @returns {Room|undefined} */
  getRoom(roomId) {
    if (!roomId) return undefined;
    return this.rooms.get(roomId.toUpperCase());
  }

  /** @returns {string|undefined} */
  getRoomIdForSocket(socketId) {
    return this.socketIndex.get(socketId);
  }

  /**
   * Looks up which player a socket belongs to inside its room.
   * @param {string} socketId
   * @returns {{ room: Room, player: Player }|null}
   */
  getPlayerContext(socketId) {
    const roomId = this.socketIndex.get(socketId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return null;
    return { room, player };
  }

  /**
   * Removes a socket from whichever room it occupies. If that empties the
   * room, the room is deleted; otherwise the room is marked finished so the
   * remaining player gets a clear end state.
   *
   * @param {string} socketId
   * @returns {{ room: Room, removedPlayer: Player, roomDeleted: boolean }|null}
   */
  removeSocket(socketId) {
    const roomId = this.socketIndex.get(socketId);
    if (!roomId) return null;
    this.socketIndex.delete(socketId);

    const room = this.rooms.get(roomId);
    if (!room) return null;

    const idx = room.players.findIndex((p) => p.socketId === socketId);
    if (idx === -1) return null;
    const [removedPlayer] = room.players.splice(idx, 1);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return { room, removedPlayer, roomDeleted: true };
    }

    // Opponent stays connected — end the current game so they aren't left
    // staring at a half-finished board with no way to act.
    room.status = 'finished';
    room.currentTurn = null;
    room.winner = null;
    room.winningLine = null;
    return { room, removedPlayer, roomDeleted: false };
  }

  /**
   * Public, serializable view of a room — what we send to clients.
   * Excludes nothing sensitive today, but provides a stable shape that the
   * frontend can rely on.
   * @param {Room} room
   */
  serialize(room) {
    return {
      id: room.id,
      players: room.players.map((p) => ({
        socketId: p.socketId,
        name: p.name,
        symbol: p.symbol,
      })),
      board: [...room.board],
      currentTurn: room.currentTurn,
      status: room.status,
      winner: room.winner,
      winningLine: room.winningLine ? [...room.winningLine] : null,
      moveCount: room.moveCount,
      round: room.round,
      lastMove: room.lastMove ? { ...room.lastMove } : null,
    };
  }

  /** Diagnostic helper, useful for tests/health endpoints. */
  stats() {
    return {
      totalRooms: this.rooms.size,
      activeSockets: this.socketIndex.size,
    };
  }

  // ---------- internals ----------

  _generateUniqueRoomId() {
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS; i += 1) {
      const id = this._randomCode(ROOM_CODE_LENGTH);
      if (!this.rooms.has(id)) return id;
    }
    // Astronomically unlikely with a 32^6 keyspace, but we still surface it.
    throw new Error('Could not allocate a unique room ID. Try again.');
  }

  _randomCode(length) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
      const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      out += ROOM_CODE_ALPHABET[idx];
    }
    return out;
  }

  _sanitizeName(name) {
    if (typeof name !== 'string') return '';
    const trimmed = name.trim().slice(0, 24);
    // Keep printable characters only — no control chars or zero-width tricks.
    return trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  }
}

/**
 * @typedef {Object} Player
 * @property {string} socketId
 * @property {string} name
 * @property {'X'|'O'} symbol
 *
 * @typedef {Object} Room
 * @property {string} id
 * @property {Player[]} players
 * @property {Array<'X'|'O'|null>} board
 * @property {'X'|'O'|null} currentTurn
 * @property {'X'|'O'} startingSymbol
 * @property {'waiting'|'playing'|'finished'} status
 * @property {'X'|'O'|null} winner
 * @property {number[]|null} winningLine
 * @property {number} moveCount
 * @property {number} round
 * @property {{index:number,symbol:string,at:number}|null} lastMove
 * @property {number} createdAt
 */

module.exports = { RoomManager };
