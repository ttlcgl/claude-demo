/**
 * Tic Tac Toe — multiplayer server entry point.
 *
 * Express handles a tiny HTTP surface (health + room lookup); Socket.IO does
 * the heavy lifting for real-time gameplay. State is in-memory and managed
 * by RoomManager.
 *
 * Configuration (env vars):
 *   PORT          — port to listen on (default 3001)
 *   CORS_ORIGIN   — comma-separated list of allowed origins, or "*"
 *                   (default "*"). Tighten this in production.
 *   NODE_ENV      — standard; "production" trims log noise.
 */

'use strict';

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const { RoomManager } = require('./src/roomManager');
const { registerSocketHandlers } = require('./src/socketHandlers');

const PORT = Number.parseInt(process.env.PORT, 10) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const corsOrigins = CORS_ORIGIN === '*'
  ? '*'
  : CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);

function buildApp(roomManager) {
  const app = express();
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: '16kb' }));

  // Lightweight health probe — useful for `curl` and orchestrators.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), ...roomManager.stats() });
  });

  // Optional: peek at a room (no sensitive data, useful for debugging UIs).
  app.get('/api/rooms/:roomId', (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    res.json(roomManager.serialize(room));
  });

  // Catch-all 404 for unknown routes (keeps responses JSON, not HTML).
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
  });

  // Express error handler — last line of defense for unexpected throws.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[express] unhandled error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}

function buildIO(httpServer) {
  return new SocketIOServer(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
    // Reasonable timeouts: detect dead clients quickly without
    // killing healthy ones on flaky networks.
    pingTimeout: 20000,
    pingInterval: 25000,
  });
}

function start() {
  const roomManager = new RoomManager();
  const app = buildApp(roomManager);
  const httpServer = http.createServer(app);
  const io = buildIO(httpServer);

  io.on('connection', (socket) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[socket] connected: ${socket.id}`);
    }
    registerSocketHandlers(io, socket, roomManager);
    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[socket] disconnected: ${socket.id} (${reason})`);
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Tic Tac Toe server listening on http://localhost:${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
  });

  // Graceful shutdown so dev restarts don't leak sockets / ports.
  const shutdown = (signal) => {
    console.log(`\n[server] received ${signal}, shutting down…`);
    io.close(() => {
      httpServer.close(() => process.exit(0));
    });
    // Hard cap so we don't hang forever on stuck connections.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { app, io, httpServer, roomManager };
}

if (require.main === module) {
  start();
}

module.exports = { start, buildApp, buildIO };
