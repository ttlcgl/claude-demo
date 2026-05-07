import { Board } from './Board.jsx';
import { RoomCode } from './RoomCode.jsx';
import { StatusBanner } from './StatusBanner.jsx';
import { Symbol } from './Symbol.jsx';
import {
  PHASE,
  derivePhase,
  findMe,
  findOpponent,
  isFinished,
} from '../lib/status.js';

/**
 * The in-room screen — wraps StatusBanner, Board, the player chips, and the
 * room/leave/restart controls. Stateless; reads everything from props.
 */
export function Game({
  room,
  you,
  opponentLeft,
  toast,
  onMove,
  onRestart,
  onLeave,
}) {
  const mySymbol = you?.symbol ?? null;
  const phase = derivePhase({ room, mySymbol, opponentLeft });
  const me = findMe(room, you);
  const opponent = findOpponent(room, mySymbol);
  const finished = isFinished(room);

  const boardDisabled = phase !== PHASE.YOUR_TURN || finished || opponentLeft;
  const showWaiting = phase === PHASE.WAITING;
  const showRestart = finished || opponentLeft;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="flex items-center justify-between gap-3 animate-fade-in">
        <button type="button" onClick={onLeave} className="btn-ghost px-3 py-2 text-sm">
          ← Leave
        </button>
        <span className="chip">Room {room?.id}</span>
      </header>

      <StatusBanner phase={phase} mySymbol={mySymbol} />

      <PlayerStrip me={me} mySymbol={mySymbol} opponent={opponent} room={room} />

      <section className="surface p-4 sm:p-6 animate-fade-in">
        <Board
          board={room?.board}
          winningLine={room?.winningLine}
          disabled={boardDisabled}
          onCellClick={onMove}
        />
      </section>

      {showWaiting ? (
        <section className="surface flex flex-col items-center gap-4 p-6 animate-fade-in">
          <RoomCode code={room?.id ?? '------'} />
          <p className="text-center text-sm text-slate-400">
            Waiting for an opponent to join. Share the code above.
          </p>
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <span className="chip">
          You are
          <Symbol value={mySymbol} className="h-4 w-4" glow={false} />
          {me?.name ? <span className="text-slate-400">· {me.name}</span> : null}
        </span>

        {showRestart ? (
          <button
            type="button"
            onClick={onRestart}
            disabled={opponentLeft}
            className="btn-primary"
          >
            {opponentLeft ? 'Waiting for opponent…' : 'Play again'}
          </button>
        ) : room?.round && room.round > 1 ? (
          <span className="chip">Round {room.round}</span>
        ) : null}
      </footer>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}

function PlayerStrip({ me, mySymbol, opponent, room }) {
  const oppSymbol = mySymbol === 'X' ? 'O' : 'X';
  const yourTurn = room?.currentTurn === mySymbol;
  const oppTurn = room?.currentTurn === oppSymbol;
  const playing = room?.status === 'playing';

  return (
    <div className="grid grid-cols-2 gap-3 animate-fade-in">
      <PlayerChip
        label={me?.name || 'You'}
        symbol={mySymbol}
        active={yourTurn && playing}
        present
      />
      <PlayerChip
        label={opponent?.name || (opponent ? 'Opponent' : 'Waiting…')}
        symbol={oppSymbol}
        active={oppTurn && playing}
        present={!!opponent}
      />
    </div>
  );
}

function PlayerChip({ label, symbol, active, present }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        active
          ? 'border-cyan-400/40 bg-cyan-400/5'
          : present
            ? 'border-slate-800 bg-slate-900/60'
            : 'border-dashed border-slate-800 bg-slate-900/30'
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-950/40 ${
          active ? 'animate-pulse-soft' : ''
        } ${present ? '' : 'opacity-40'}`}
      >
        <Symbol value={symbol} className="h-6 w-6" glow={present} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100">{label}</div>
        <div className="truncate text-xs text-slate-500">
          {active ? 'On the clock' : present ? 'Ready' : 'Not connected'}
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 animate-fade-in"
    >
      <div className="surface pointer-events-auto rounded-full px-5 py-2.5 text-sm text-slate-200">
        {message}
      </div>
    </div>
  );
}
