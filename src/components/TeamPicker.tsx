import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Search } from 'lucide-react';
import type { League, Team } from '../types';
import { api } from '../services/api';
import { LeagueLoader } from './LeagueLoader';

export function TeamPicker({
  league,
  onBack,
  onSelect,
}: {
  league: League;
  onBack: () => void;
  onSelect: (t: Team) => void;
}) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .teams(league.id)
      .then((t) => !cancelled && setTeams(t))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [league.id]);

  const filtered = useMemo(() => {
    if (!teams) return null;
    if (!q.trim()) return teams;
    const needle = q.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.shortName?.toLowerCase().includes(needle) ||
        t.abbreviation?.toLowerCase().includes(needle)
    );
  }, [teams, q]);

  return (
    <div
      className="min-h-screen text-zinc-100 relative overflow-hidden"
      style={{ background: league.bg }}
    >
      <div className="absolute inset-0" style={{ background: league.pattern }} />
      <div className="absolute inset-0 grain opacity-40 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-10 pt-10 pb-20">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> All leagues
        </button>

        <div className="mb-10">
          <span
            className="text-[11px] uppercase tracking-[0.3em]"
            style={{ color: league.accent }}
          >
            {league.country} · {league.tagline}
          </span>
          <h1 className="font-display text-5xl sm:text-6xl tracking-tight leading-[0.9] mt-2">
            {league.name.toUpperCase()}
          </h1>
          <p className="mt-3 text-zinc-300 max-w-lg">
            Pick the team you live and die for. We'll spin up the dashboard.
          </p>
        </div>

        <div className="relative max-w-md mb-8">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search team…"
            className="w-full bg-black/30 border border-zinc-700 rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 transition"
          />
        </div>

        {error && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            Couldn't load teams: {error}
          </div>
        )}

        {!filtered && !error && (
          <div className="flex flex-col items-center justify-center py-20">
            <LeagueLoader
              league={league}
              size="lg"
              label={`Loading ${league.name}…`}
            />
          </div>
        )}

        {filtered && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((team, i) => (
              <motion.button
                key={team.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: Math.min(i * 0.02, 0.4),
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ y: -4, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(team)}
                className="group relative rounded-xl border border-white/10 hover:border-white/30 bg-black/25 hover:bg-black/40 transition-colors duration-300 p-4 flex flex-col items-center gap-3 text-center backdrop-blur-sm"
                style={{
                  ['--ring' as any]: team.color || league.accent,
                }}
              >
                <div
                  className="absolute inset-x-0 -top-px h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: team.color || league.accent }}
                />
                <img
                  src={team.logo}
                  alt={team.name}
                  loading="lazy"
                  className="w-14 h-14 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
                <div className="text-sm font-semibold leading-tight text-zinc-100">
                  {team.shortName || team.name}
                </div>
              </motion.button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-zinc-400 text-sm">
                No matches.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
