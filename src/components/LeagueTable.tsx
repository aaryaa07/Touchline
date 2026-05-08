import type { StandingRow } from '../types';
import { cn } from '../lib/cn';

export function LeagueTable({
  rows,
  highlightTeamId,
  loading,
  accent,
}: {
  rows: StandingRow[] | null;
  highlightTeamId?: string;
  loading: boolean;
  accent: string;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-9 rounded-md bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-zinc-400 italic">Standings unavailable.</div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-zinc-400 bg-white/[0.03]">
            <th className="text-left px-3 py-2 font-medium">#</th>
            <th className="text-left px-3 py-2 font-medium">Team</th>
            <th className="text-right px-2 py-2 font-medium">P</th>
            <th className="text-right px-2 py-2 font-medium">W</th>
            <th className="text-right px-2 py-2 font-medium">D</th>
            <th className="text-right px-2 py-2 font-medium">L</th>
            <th className="text-right px-2 py-2 font-medium">GD</th>
            <th className="text-right px-3 py-2 font-medium">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isMe = r.teamId === highlightTeamId;
            return (
              <tr
                key={r.teamId}
                className={cn(
                  'border-t border-white/5 transition-colors',
                  isMe ? '' : 'hover:bg-white/[0.02]'
                )}
                style={
                  isMe
                    ? {
                        background: `${accent}14`,
                        boxShadow: `inset 3px 0 0 ${accent}`,
                      }
                    : undefined
                }
              >
                <td className="px-3 py-2 text-zinc-400 tabular-nums">
                  {r.rank}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.logo && (
                      <img
                        src={r.logo}
                        alt=""
                        className="w-5 h-5 object-contain flex-shrink-0"
                      />
                    )}
                    <span
                      className={cn(
                        'truncate',
                        isMe ? 'font-semibold text-white' : 'text-zinc-200'
                      )}
                    >
                      {r.shortName || r.team}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-400">
                  {r.played}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-400">
                  {r.wins}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-400">
                  {r.draws}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-400">
                  {r.losses}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-400">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-white">
                  {r.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
