/**
 * Unit tests for backend/src/roomManager.js — room/session lifecycle.
 *
 * Run: cd backend && npm test
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { RoomManager } = require('../src/roomManager');

// ── createRoom ───────────────────────────────────────────────────────────────

test('createRoom: returns roomId and a room with one player as X', () => {
  const rm = new RoomManager();
  const { roomId, room } = rm.createRoom('s1', 'Alice');
  assert.equal(typeof roomId, 'string');
  assert.ok(roomId.length === 6, 'expected a 6-char room code');
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].symbol, 'X');
  assert.equal(room.players[0].socketId, 's1');
  assert.equal(room.players[0].name, 'Alice');
  assert.equal(room.status, 'waiting');
  assert.equal(room.currentTurn, 'X');
  assert.deepEqual(room.board, Array(9).fill(null));
});

test('createRoom: produces distinct roomIds across calls', () => {
  const rm = new RoomManager();
  const a = rm.createRoom('s1').roomId;
  const b = rm.createRoom('s2').roomId;
  assert.notEqual(a, b);
});

test('createRoom: throws when the same socket already has a room', () => {
  const rm = new RoomManager();
  rm.createRoom('s1');
  assert.throws(() => rm.createRoom('s1'), /already in a room/);
});

test('createRoom: defaults the player name when missing/blank', () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('s1');
  assert.equal(room.players[0].name, 'Player 1');
});

test('createRoom: sanitizes control chars from player name', () => {
  const rm = new RoomManager();
  const { room } = rm.createRoom('s1', 'Bob\x00\x07\nEvil');
  assert.equal(/[\x00-\x1F]/.test(room.players[0].name), false);
});

// ── joinRoom ─────────────────────────────────────────────────────────────────

test('joinRoom: second player joins as O and game becomes playing', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  const room = rm.joinRoom(roomId, 's2', 'Bob');
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].symbol, 'O');
  assert.equal(room.players[1].socketId, 's2');
  assert.equal(room.status, 'playing');
});

test('joinRoom: lookup is case-insensitive (lowercase code works)', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  // Should not throw if user types lowercase
  assert.doesNotThrow(() => rm.joinRoom(roomId.toLowerCase(), 's2'));
});

test('joinRoom: throws ROOM_NOT_FOUND on unknown room', () => {
  const rm = new RoomManager();
  assert.throws(() => rm.joinRoom('NOPE99', 's2'), /not found/i);
});

test('joinRoom: throws ROOM_FULL on third player', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  assert.throws(() => rm.joinRoom(roomId, 's3'), /full/i);
});

test('joinRoom: throws when socket is already in another room', () => {
  const rm = new RoomManager();
  rm.createRoom('s1');
  const { roomId } = rm.createRoom('s2');
  assert.throws(() => rm.joinRoom(roomId, 's1'), /already in a room/i);
});

test('joinRoom: throws when roomId is missing/null', () => {
  const rm = new RoomManager();
  assert.throws(() => rm.joinRoom('', 's1'), /required/i);
  assert.throws(() => rm.joinRoom(null, 's1'), /required/i);
});

// ── getRoom / getPlayerContext ──────────────────────────────────────────────

test('getRoom: returns undefined for unknown roomId', () => {
  const rm = new RoomManager();
  assert.equal(rm.getRoom('NOPE99'), undefined);
});

test('getPlayerContext: returns room+player pair for an active socket', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  const ctx = rm.getPlayerContext('s2');
  assert.ok(ctx);
  assert.equal(ctx.player.symbol, 'O');
  assert.equal(ctx.room.id, roomId);
});

test('getPlayerContext: returns null for a stranger socket', () => {
  const rm = new RoomManager();
  assert.equal(rm.getPlayerContext('ghost'), null);
});

// ── removeSocket (disconnect) ────────────────────────────────────────────────

test('removeSocket: marks room finished when one of two players leaves', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  const r = rm.removeSocket('s2');
  assert.ok(r);
  assert.equal(r.roomDeleted, false);
  assert.equal(r.removedPlayer.socketId, 's2');
  assert.equal(r.room.status, 'finished');
  assert.equal(r.room.players.length, 1);
});

test('removeSocket: deletes the room when host leaves before guest', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  const r = rm.removeSocket('s1');
  assert.equal(r.roomDeleted, true);
  assert.equal(rm.getRoom(roomId), undefined);
});

test('removeSocket: deletes the room when both players leave', () => {
  const rm = new RoomManager();
  const { roomId } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  rm.removeSocket('s2');
  const r = rm.removeSocket('s1');
  assert.equal(r.roomDeleted, true);
  assert.equal(rm.getRoom(roomId), undefined);
});

test('removeSocket: returns null for unknown socket', () => {
  const rm = new RoomManager();
  assert.equal(rm.removeSocket('ghost'), null);
});

// ── serialize ────────────────────────────────────────────────────────────────

test('serialize: emits a deep-cloned, stable shape', () => {
  const rm = new RoomManager();
  const { roomId, room } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  const view = rm.serialize(room);
  assert.equal(view.id, roomId);
  assert.equal(view.players.length, 2);
  assert.equal(view.board.length, 9);
  assert.equal(view.status, 'playing');
  // Mutate the view; original must remain intact
  view.board[0] = 'X';
  view.players.push({ socketId: 'fake', name: 'fake', symbol: 'X' });
  assert.equal(room.board[0], null);
  assert.equal(room.players.length, 2);
});

// ── stats ────────────────────────────────────────────────────────────────────

test('stats: counts active rooms and sockets', () => {
  const rm = new RoomManager();
  assert.deepEqual(rm.stats(), { totalRooms: 0, activeSockets: 0 });
  const { roomId } = rm.createRoom('s1');
  rm.joinRoom(roomId, 's2');
  assert.deepEqual(rm.stats(), { totalRooms: 1, activeSockets: 2 });
  rm.removeSocket('s1');
  assert.equal(rm.stats().activeSockets, 1);
  rm.removeSocket('s2');
  assert.equal(rm.stats().totalRooms, 0);
});
