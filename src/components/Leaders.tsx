import { motion } from 'motion/react';
import { ExternalLink, Goal, Shield } from 'lucide-react';
import type { Leader, LeagueLeaders } from '../types';

export function Leaders({
  data,
  loading,
  accent,
  highlightClub,
}: {
  data: LeagueLeaders | null;
  loading: boolean;
  accent: string;
  /** Optional: bold the row whose `club` matches the user's team */
  highlightClub?: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data || (data.topScorers.length === 0 && data.cleanSheets.length === 0)) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-5 text-zinc-400 text-sm">
        Couldn't pull leader stats for this season.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LeaderCard
        title="Top Scorers"
        unit="goals"
        icon={Goal}
        rows={data.topScorers}
        accent={accent}
        highlightClub={highlightClub}
      />
      <LeaderCard
        title="Clean Sheets"
        unit="CS"
        icon={Shield}
        rows={data.cleanSheets}
        accent={accent}
        highlightClub={highlightClub}
      />
      {data.source && (
        <a
          href={data.source}
          target="_blank"
          rel="noreferrer"
          className="md:col-span-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Source: Wikipedia <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function LeaderCard({
  title,
  unit,
  icon: Icon,
  rows,
  accent,
  highlightClub,
}: {
  title: string;
  unit: string;
  icon: any;
  rows: Leader[];
  accent: string;
  highlightClub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-white/10 bg-black/25 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-300">
            {title}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          {unit}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="p-5 text-sm text-zinc-500 italic">
          Not available for this season.
        </div>
      ) : (
        <ul>
          {rows.slice(0, 8).map((r, i) => {
            const isMe =
              highlightClub &&
              r.club.toLowerCase().includes(highlightClub.toLowerCase());
            return (
              <li
                key={`${r.player}-${i}`}
                className="px-4 py-2.5 flex items-center gap-3 border-b border-white/5 last:border-b-0 transition-colors"
                style={
                  isMe
                    ? {
                        background: `${accent}14`,
                        boxShadow: `inset 3px 0 0 ${accent}`,
                      }
                    : undefined
                }
              >
                <span className="text-zinc-500 text-xs w-5 tabular-nums">
                  {r.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`truncate text-sm ${isMe ? 'font-semibold text-white' : 'text-zinc-100'}`}
                  >
                    {r.player}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {r.club}
                  </div>
                </div>
                <div
                  className="font-display text-xl leading-none tabular-nums"
                  style={{ color: accent }}
                >
                  {r.value}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}
