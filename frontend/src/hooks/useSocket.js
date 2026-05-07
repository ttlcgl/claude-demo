import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

/**
 * Owns the Socket.IO client lifecycle for the whole app.
 *
 * Returns a stable `socket` ref-style value plus a `connected` flag the UI uses
 * to gate interactions (no point letting a user click "Create room" while we
 * haven't even handshaken yet).
 *
 * Socket.IO handles reconnection internally; we just surface the live state.
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  if (socketRef.current === null) {
    socketRef.current = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }

  useEffect(() => {
    const socket = socketRef.current;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Disconnect on full unmount (e.g. HMR teardown). We keep the socket alive
  // across renders within the app's lifetime.
  useEffect(() => () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  return { socket: socketRef.current, connected };
}
