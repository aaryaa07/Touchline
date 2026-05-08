import { motion } from 'motion/react';
import type { FormGame } from '../types';
import { cn } from '../lib/cn';

const RESULT_STYLE: Record<FormGame['result'], string> = {
  W: 'bg-emerald-500 text-emerald-950 border-emerald-300/40',
  D: 'bg-zinc-400 text-zinc-950 border-zinc-200/40',
  L: 'bg-rose-600 text-white border-rose-300/30',
};

export function FormStrip({
  games,
  loading,
}: {
  games: FormGame[] | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 min-h-[88px] rounded-xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="text-sm text-zinc-400 italic">
        No recent results available.
      </div>
    );
  }

  // Reverse: oldest first, newest right
  const ordered = [...games].reverse();

  return (
    <div className="grid grid-cols-5 gap-2">
      {ordered.map((g, i) => (
        <motion.div
          key={g.id || i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 flex flex-col items-center gap-2"
          title={`${g.home ? 'vs' : '@'} ${g.opponent} · ${new Date(g.date).toLocaleDateString()}`}
        >
          <span
            className={cn(
              'w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-black border',
              RESULT_STYLE[g.result]
            )}
          >
            {g.result}
          </span>
          <div className="text-xs text-zinc-400 leading-tight text-center">
            {g.home ? 'vs' : '@'}{' '}
            <span className="text-zinc-200 font-medium">
              {g.opponentShort || g.opponent}
            </span>
          </div>
          <div className="font-display text-lg leading-none tracking-wider">
            {g.ourScore}–{g.theirScore}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
