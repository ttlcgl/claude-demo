import { useState } from 'react';
import { Symbol } from './Symbol.jsx';

/**
 * Entry screen. The user can either spin up a new room (we'll get a code
 * back to share) or paste a code to join an existing one. Optional display
 * name is sent with both flows so the other player sees something other
 * than "Opponent" in the player chip.
 */
export function Lobby({ onCreate, onJoin, connected, pending, error }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onJoin(code, name);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="flex flex-col items-center gap-3 text-center animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-800 bg-slate-900/60">
            <Symbol value="X" className="h-7 w-7" />
          </span>
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-800 bg-slate-900/60">
            <Symbol value="O" className="h-7 w-7" />
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Tic Tac Toe</h1>
        <p className="text-sm text-slate-400">
          Real-time multiplayer. Create a room and share the code, or join one with a friend’s code.
        </p>
      </header>

      <section className="surface flex flex-col gap-5 p-6 animate-fade-in">
        <label className="flex flex-col gap-2 text-sm text-slate-400">
          Display name <span className="text-xs text-slate-600">(optional)</span>
          <input
            type="text"
            autoComplete="nickname"
            spellCheck={false}
            maxLength={24}
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </label>

        <button
          type="button"
          onClick={() => onCreate(name)}
          disabled={!connected || pending}
          className="btn-primary w-full py-3 text-base"
        >
          {pending ? 'Working…' : 'Create new room'}
        </button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          <span>or</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-slate-400">
            Room code
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              placeholder="e.g. AB12CD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
              className="field font-mono text-lg tracking-[0.3em]"
            />
          </label>
          <button
            type="submit"
            disabled={!connected || pending || code.trim().length === 0}
            className="btn-secondary w-full py-3 text-base"
          >
            {pending ? 'Joining…' : 'Join room'}
          </button>
        </form>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-fade-in"
          >
            {error}
          </div>
        ) : null}

        {!connected ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 animate-pulse-soft rounded-full bg-amber-400" />
            Connecting to server…
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Connected
          </div>
        )}
      </section>

      <footer className="text-center text-xs text-slate-600">
        Pass the room code to your friend — they’ll join instantly.
      </footer>
    </div>
  );
}
