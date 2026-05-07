import { useState } from 'react';

/**
 * Big, copyable room code. The user is going to be sharing this with a friend
 * via DM, so making it one-click-copy is the single highest-value affordance
 * on the waiting screen.
 */
export function RoomCode({ code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Browsers without clipboard API access (insecure context, etc.) —
      // we silently no-op; the code is still on screen for the user to read.
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-slate-500">Room code</span>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy room code"
        className="group relative flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-3 font-mono text-2xl tracking-[0.4em] text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
      >
        <span>{code}</span>
        <span
          aria-hidden="true"
          className="text-xs font-sans uppercase tracking-widest text-slate-500 transition group-hover:text-slate-300"
        >
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
    </div>
  );
}
