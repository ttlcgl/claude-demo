/**
 * Integration tests for the real Socket.IO server.
 *
 * Spins up the actual server (buildApp + buildIO + http.createServer) on a
 * random port for each test file run, then connects real socket.io-client
 * sockets and exercises the full event surface.
 *
 * Run: cd backend && npm test
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { io: ioClient } = require('socket.io-client');
const { RoomManager } = require('../src/roomManager');
const { registerSocketHandlers } = require('../src/socketHandlers');
const { buildApp, buildIO } = require('../server');

let httpServer;
let io;
let url;
let roomManager;

test.before(async () => {
  roomManager = new RoomManager();
  const app = buildApp(roomManager);
  httpServer = http.createServer(app);
  io = buildIO(httpServer);
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, roomManager);
  });
  await new Promise((r) => httpServer.listen(0, r));
  const port = httpServer.address().port;
  url = `http://localhost:${port}`;
});

test.after(async () => {
  await new Promise((r) => io.close(r));
  await new Promise((r) => httpServer.close(r));
});

function connect() {
  return ioClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

function awaitConnect(s) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('connect timeout')), 2000);
    s.once('connect', () => { clearTimeout(t); resolve(); });
    s.once('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

function emitWithAck(s, event, payload, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), timeoutMs);
    s.emit(event, payload, (resp) => { clearTimeout(t); resolve(resp); });
  });
}

function nextEvent(s, event, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${event}`)), timeoutMs);
    s.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function disconnectAll(...sockets) {
  for (const s of sockets) {
    if (s && s.connected) s.disconnect();
  }
}

// ── create_room / join_room ──────────────────────────────────────────────────

test('create_room: ack returns ok=true with roomId, room snapshot, and you.symbol = X', async () => {
  const host = connect();
  await awaitConnect(host);
  const ack = await emitWithAck(host, 'create_room', {});
  try {
    assert.equal(ack.ok, true);
    assert.equal(typeof ack.room.id, 'string');
    assert.equal(ack.room.players.length, 1);
    assert.equal(ack.room.status, 'waiting');
    assert.equal(ack.you.symbol, 'X');
  } finally {
    disconnectAll(host);
  }
});

test('join_room: ack returns ok=true with you.symbol = O; both players see game_update', async () => {
  const host = connect();
  await awaitConnect(host);
  const created = await emitWithAck(host, 'create_room', {});

  const guest = connect();
  await awaitConnect(guest);

  const hostUpd = nextEvent(host, 'game_update');
  const ack = await emitWithAck(guest, 'join_room', { roomId: created.room.id });

  try {
    assert.equal(ack.ok, true);
    assert.equal(ack.you.symbol, 'O');
    const upd = await hostUpd;
    assert.equal(upd.reason, 'player_joined');
    assert.equal(upd.room.players.length, 2);
    assert.equal(upd.room.status, 'playing');
  } finally {
    disconnectAll(host, guest);
  }
});

test('join_room: unknown room → ack ok=false with code/message', async () => {
  const c = connect();
  await awaitConnect(c);
  const ack = await emitWithAck(c, 'join_room', { roomId: 'BOGUS9' });
  try {
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'JOIN_FAILED');
    assert.match(ack.message, /not found/i);
  } finally {
    disconnectAll(c);
  }
});

test('join_room: full room rejected', async () => {
  const a = connect(); await awaitConnect(a);
  const created = await emitWithAck(a, 'create_room', {});
  const b = connect(); await awaitConnect(b);
  await emitWithAck(b, 'join_room', { roomId: created.room.id });
  const c = connect(); await awaitConnect(c);
  const ack = await emitWithAck(c, 'join_room', { roomId: created.room.id });
  try {
    assert.equal(ack.ok, false);
    assert.match(ack.message, /full/i);
  } finally {
    disconnectAll(a, b, c);
  }
});

// ── make_move ────────────────────────────────────────────────────────────────

async function setupGame() {
  const host = connect(); await awaitConnect(host);
  const created = await emitWithAck(host, 'create_room', {});
  const guest = connect(); await awaitConnect(guest);
  // Drain the game_update that join_room broadcasts to host
  const drain = nextEvent(host, 'game_update');
  await emitWithAck(guest, 'join_room', { roomId: created.room.id });
  await drain;
  return { host, guest, roomId: created.room.id };
}

test('make_move: legal move broadcasts game_update with reason "move" to BOTH clients', async () => {
  const { host, guest, roomId } = await setupGame();
  const hostUpd = nextEvent(host, 'game_update');
  const guestUpd = nextEvent(guest, 'game_update');
  const ack = await emitWithAck(host, 'make_move', { index: 4 });
  try {
    assert.equal(ack.ok, true);
    const [h, g] = await Promise.all([hostUpd, guestUpd]);
    assert.equal(h.reason, 'move');
    assert.equal(h.room.board[4], 'X');
    assert.equal(g.room.board[4], 'X');
    assert.equal(h.room.currentTurn, 'O');
    assert.equal(g.room.currentTurn, 'O');
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: out-of-turn move from O is rejected with INVALID_MOVE', async () => {
  const { host, guest } = await setupGame();
  const ack = await emitWithAck(guest, 'make_move', { index: 0 });
  try {
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'INVALID_MOVE');
    assert.match(ack.message, /not your turn/i);
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: occupied cell is rejected', async () => {
  const { host, guest } = await setupGame();
  const drain = nextEvent(guest, 'game_update');
  await emitWithAck(host, 'make_move', { index: 4 });
  await drain;
  const ack = await emitWithAck(guest, 'make_move', { index: 4 });
  try {
    assert.equal(ack.ok, false);
    assert.match(ack.message, /already taken/i);
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: out-of-bounds index rejected', async () => {
  const { host, guest } = await setupGame();
  const ack = await emitWithAck(host, 'make_move', { index: 99 });
  try {
    assert.equal(ack.ok, false);
    assert.match(ack.message, /invalid/i);
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: forged symbol field in payload is ignored (server uses session symbol)', async () => {
  const { host, guest } = await setupGame();
  // Guest tries to play as X by stuffing symbol into payload; server should
  // still derive symbol from socket.id mapping → guest is 'O' → "not your turn"
  const ack = await emitWithAck(guest, 'make_move', { index: 0, symbol: 'X' });
  try {
    assert.equal(ack.ok, false, 'forged symbol must not let O move first');
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: winning move emits reason "win" with winningLine', async () => {
  const { host, guest } = await setupGame();

  // Drive through to X winning on 0,4,8
  const sequence = [
    [host, 0],
    [guest, 1],
    [host, 4],
    [guest, 2],
    // Final move: 8 — X wins
  ];
  for (const [c, i] of sequence) {
    const drainHost = nextEvent(host, 'game_update');
    const drainGuest = nextEvent(guest, 'game_update');
    await emitWithAck(c, 'make_move', { index: i });
    await Promise.all([drainHost, drainGuest]);
  }

  const finalHost = nextEvent(host, 'game_update');
  const finalGuest = nextEvent(guest, 'game_update');
  await emitWithAck(host, 'make_move', { index: 8 });
  const [h, g] = await Promise.all([finalHost, finalGuest]);
  try {
    assert.equal(h.reason, 'win');
    assert.equal(h.room.status, 'finished');
    assert.equal(h.room.winner, 'X');
    assert.deepEqual(h.room.winningLine, [0, 4, 8]);
    // Both clients see identical state
    assert.deepEqual(g.room.board, h.room.board);
    assert.deepEqual(g.room.winningLine, h.room.winningLine);
  } finally {
    disconnectAll(host, guest);
  }
});

test('make_move: full draw emits reason "draw" with winner=null', async () => {
  const { host, guest } = await setupGame();
  // Draw: X O X / X O O / O X X
  const seq = [
    [host, 0], [guest, 1],
    [host, 2], [guest, 4],
    [host, 3], [guest, 5],
    [host, 7], [guest, 6],
  ];
  for (const [c, i] of seq) {
    const drainH = nextEvent(host, 'game_update');
    const drainG = nextEvent(guest, 'game_update');
    await emitWithAck(c, 'make_move', { index: i });
    await Promise.all([drainH, drainG]);
  }
  const finalH = nextEvent(host, 'game_update');
  const finalG = nextEvent(guest, 'game_update');
  await emitWithAck(host, 'make_move', { index: 8 });
  const [h] = await Promise.all([finalH, finalG]);
  try {
    assert.equal(h.reason, 'draw');
    assert.equal(h.room.status, 'finished');
    assert.equal(h.room.winner, null, 'draw is signaled by winner=null');
    assert.equal(h.room.winningLine, null);
  } finally {
    disconnectAll(host, guest);
  }
});

// ── disconnect / leave_room ──────────────────────────────────────────────────

test('disconnect: surviving player gets player_disconnected then game_update with reason "opponent_left"', async () => {
  const { host, guest } = await setupGame();
  const dcEvent = nextEvent(host, 'player_disconnected', 3000);
  const followUp = nextEvent(host, 'game_update', 3000);
  guest.disconnect();
  const dc = await dcEvent;
  const upd = await followUp;
  try {
    assert.equal(dc.player.symbol, 'O');
    assert.equal(dc.kind, 'disconnected');
    assert.equal(upd.reason, 'opponent_left');
    assert.equal(upd.room.status, 'finished');
    assert.equal(upd.room.players.length, 1);
  } finally {
    disconnectAll(host);
  }
});

test('leave_room: emits player_disconnected with kind="left"', async () => {
  const { host, guest } = await setupGame();
  const dcEvent = nextEvent(host, 'player_disconnected');
  const ack = await emitWithAck(guest, 'leave_room', {});
  const dc = await dcEvent;
  try {
    assert.equal(ack.ok, true);
    assert.equal(dc.kind, 'left');
  } finally {
    disconnectAll(host, guest);
  }
});

// ── restart_game ─────────────────────────────────────────────────────────────

test('restart_game: rejects while game is still playing', async () => {
  const { host, guest } = await setupGame();
  const ack = await emitWithAck(host, 'restart_game', {});
  try {
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'GAME_IN_PROGRESS');
  } finally {
    disconnectAll(host, guest);
  }
});

test('restart_game: works after game finishes; broadcasts reason "restart"; alternates starter', async () => {
  const { host, guest } = await setupGame();
  // Win with X via top row
  const seq = [[host, 0], [guest, 3], [host, 1], [guest, 4], [host, 2]];
  for (const [c, i] of seq) {
    const dh = nextEvent(host, 'game_update');
    const dg = nextEvent(guest, 'game_update');
    await emitWithAck(c, 'make_move', { index: i });
    await Promise.all([dh, dg]);
  }

  const dh = nextEvent(host, 'game_update');
  const dg = nextEvent(guest, 'game_update');
  const ack = await emitWithAck(host, 'restart_game', {});
  const [h] = await Promise.all([dh, dg]);
  try {
    assert.equal(ack.ok, true);
    assert.equal(h.reason, 'restart');
    assert.equal(h.room.status, 'playing');
    assert.deepEqual(h.room.board, Array(9).fill(null));
    // Starter alternates: round 1 was X, round 2 should be O
    assert.equal(h.room.currentTurn, 'O');
    assert.equal(h.room.round, 2);
  } finally {
    disconnectAll(host, guest);
  }
});

// ── frontend contract probe (KNOWN BUG): frontend emits 'reset_game' ─────────

test('frontend contract probe: server does NOT respond to "reset_game" — frontend bug', async () => {
  // The frontend hook (useGameRoom.js) emits 'reset_game' but the backend
  // listens for 'restart_game'. Verify the mismatch so the bug is visible.
  const { host, guest } = await setupGame();
  // Win first so a restart would otherwise be valid
  const seq = [[host, 0], [guest, 3], [host, 1], [guest, 4], [host, 2]];
  for (const [c, i] of seq) {
    const dh = nextEvent(host, 'game_update');
    const dg = nextEvent(guest, 'game_update');
    await emitWithAck(c, 'make_move', { index: i });
    await Promise.all([dh, dg]);
  }

  // Emit the WRONG event the frontend currently uses; server has no listener
  // and we must not get an ack within a reasonable timeout.
  let acked = false;
  await new Promise((resolve) => {
    host.emit('reset_game', { roomId: 'whatever' }, () => { acked = true; resolve(); });
    setTimeout(resolve, 400);
  });
  try {
    assert.equal(acked, false,
      'BUG: server responded to "reset_game" — would mask frontend bug');
  } finally {
    disconnectAll(host, guest);
  }
});

// ── malformed input safety ───────────────────────────────────────────────────

test('safety: make_move outside a room → NOT_IN_ROOM, server stays up', async () => {
  const c = connect();
  await awaitConnect(c);
  const ack = await emitWithAck(c, 'make_move', { index: 0 });
  try {
    assert.equal(ack.ok, false);
    assert.equal(ack.code, 'NOT_IN_ROOM');
  } finally {
    disconnectAll(c);
  }
});

test('safety: completely empty payload to make_move is rejected, not crashed', async () => {
  const { host, guest } = await setupGame();
  const ack = await emitWithAck(host, 'make_move', {});
  try {
    assert.equal(ack.ok, false);
  } finally {
    disconnectAll(host, guest);
  }
});

// ── two-room isolation ───────────────────────────────────────────────────────

test('isolation: a move in room A does not broadcast to room B', async () => {
  const a1 = connect(); await awaitConnect(a1);
  const a1c = await emitWithAck(a1, 'create_room', {});
  const a2 = connect(); await awaitConnect(a2);
  const drain1 = nextEvent(a1, 'game_update');
  await emitWithAck(a2, 'join_room', { roomId: a1c.room.id });
  await drain1;

  const b1 = connect(); await awaitConnect(b1);
  const b1c = await emitWithAck(b1, 'create_room', {});
  const b2 = connect(); await awaitConnect(b2);
  const drainB = nextEvent(b1, 'game_update');
  await emitWithAck(b2, 'join_room', { roomId: b1c.room.id });
  await drainB;

  // A makes a move; B must NOT see a game_update
  let bSawUpdate = false;
  const onB = () => { bSawUpdate = true; };
  b1.on('game_update', onB);
  b2.on('game_update', onB);

  const drainA1 = nextEvent(a1, 'game_update');
  const drainA2 = nextEvent(a2, 'game_update');
  await emitWithAck(a1, 'make_move', { index: 0 });
  await Promise.all([drainA1, drainA2]);

  // Give any rogue broadcast a moment to arrive
  await new Promise((r) => setTimeout(r, 100));
  b1.off('game_update', onB);
  b2.off('game_update', onB);

  try {
    assert.equal(bSawUpdate, false, 'room B leaked an update from room A');
  } finally {
    disconnectAll(a1, a2, b1, b2);
  }
});
