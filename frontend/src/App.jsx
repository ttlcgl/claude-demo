import { Game } from './components/Game.jsx';
import { Lobby } from './components/Lobby.jsx';
import { useGameRoom } from './hooks/useGameRoom.js';
import { useSocket } from './hooks/useSocket.js';

/**
 * Top-level shell — owns the socket and the game-room state, then routes
 * between Lobby and Game based on whether we're currently in a room.
 */
export default function App() {
  const { socket, connected } = useSocket();
  const game = useGameRoom(socket);

  const inRoom = !!game.room;

  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-10 sm:py-16">
      {inRoom ? (
        <Game
          room={game.room}
          you={game.you}
          opponentLeft={game.opponentLeft}
          toast={game.toast}
          onMove={game.makeMove}
          onRestart={game.restartGame}
          onLeave={game.leaveRoom}
        />
      ) : (
        <Lobby
          connected={connected}
          pending={game.pending}
          error={game.error}
          onCreate={game.createRoom}
          onJoin={game.joinRoom}
        />
      )}
    </div>
  );
}
