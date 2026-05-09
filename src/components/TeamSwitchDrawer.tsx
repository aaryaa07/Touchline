import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X } from 'lucide-react';
import { LEAGUES } from '../data/leagues';
import { api } from '../services/api';
import type { League, Team } from '../types';
import { cn } from '../lib/cn';

export function TeamSwitchDrawer({
  open,
  onClose,
  currentLeague,
  currentTeam,
  onSwitch,
}: {
  open: boolean;
  onClose: () => void;
  currentLeague: League;
  currentTeam: Team;
  onSwitch: (league: League, team: Team) => void;
}) {
  const [browseLeague, setBrowseLeague] = useState<League>(currentLeague);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [q, setQ] = useState('');

  // Reset to the user's current league when the drawer reopens
  useEffect(() => {
    if (open) {
      setBrowseLeague(currentLeague);
      setQ('');
    }
  }, [open, currentLeague]);

  // Fetch teams whenever the browse league changes
  useEffect(() => {
    if (!open) return;
    let stop = false;
    setTeams(null);
    api
      .teams(browseLeague.id)
      .then((t) => !stop && setTeams(t))
      .catch(() => !stop && setTeams([]));
    return () => {
      stop = true;
    };
  }, [open, browseLeague.id]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-label="Switch team"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] flex flex-col text-zinc-100 border-l border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
            style={{ background: browseLeague.bg }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: browseLeague.pattern }}
            />
            <div className="relative flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <div
                    className="text-[10px] uppercase tracking-[0.3em] mb-1"
                    style={{ color: browseLeague.accent }}
                  >
                    Switch
                  </div>
                  <h2 className="font-display text-2xl tracking-wider text-white">
                    LEAGUE & TEAM
                  </h2>
                </div>
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onClose}
                  className="p-2 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* League selector — small logo pills */}
              <div className="px-5 pt-4 pb-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 mb-2">
                  League
                </div>
                <div className="flex flex-wrap gap-2">
                  {LEAGUES.map((l) => {
                    const active = l.id === browseLeague.id;
                    return (
                      <motion.button
                        key={l.id}
                        whileHover={{ y: -2, scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setBrowseLeague(l)}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs font-medium transition-colors duration-200',
                          active
                            ? 'border-white/30 bg-white/[0.08] text-white'
                            : 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/25'
                        )}
                      >
                        <img
                          src={l.logo}
                          alt=""
                          className="h-4 w-5 object-contain"
                          style={{ filter: l.logoFilter }}
                        />
                        {l.name}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Search */}
              <div className="px-5 pb-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={`Search ${browseLeague.name}…`}
                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-white/40 transition"
                  />
                </div>
              </div>

              {/* Team grid */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
                {!filtered && (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div
                        key={i}
                        className="aspect-[5/4] rounded-lg bg-white/5 animate-pulse"
                      />
                    ))}
                  </div>
                )}
                {filtered && filtered.length === 0 && (
                  <div className="text-zinc-400 text-sm">No matches.</div>
                )}
                {filtered && filtered.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {filtered.map((t) => {
                      const active =
                        t.id === currentTeam.id &&
                        browseLeague.id === currentLeague.id;
                      return (
                        <motion.button
                          key={t.id}
                          whileHover={{ y: -3, scale: 1.04 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={() => onSwitch(browseLeague, t)}
                          className={cn(
                            'relative rounded-lg border bg-black/25 hover:bg-black/40 transition-colors duration-200 p-3 flex flex-col items-center gap-1.5 text-center backdrop-blur-sm',
                            active
                              ? 'border-white/40 ring-1 ring-white/20'
                              : 'border-white/10 hover:border-white/30'
                          )}
                        >
                          <img
                            src={t.logo}
                            alt={t.name}
                            loading="lazy"
                            className="w-9 h-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity =
                                '0.3';
                            }}
                          />
                          <div className="text-[11px] font-medium leading-tight text-zinc-100 line-clamp-2">
                            {t.shortName || t.name}
                          </div>
                          {active && (
                            <span
                              className="absolute -top-1 -right-1 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                              style={{
                                background: browseLeague.accent,
                                color: '#0a0a0a',
                              }}
                            >
                              now
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
