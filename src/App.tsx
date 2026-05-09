import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LeaguePicker } from './components/LeaguePicker';
import { TeamPicker } from './components/TeamPicker';
import { Dashboard } from './components/Dashboard';
import { api } from './services/api';
import type { League, LeagueContext, Team } from './types';

type Screen =
  | { kind: 'leagues' }
  | { kind: 'teams'; league: League }
  | { kind: 'dashboard'; league: League; team: Team };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'leagues' });

  // League-scoped context (upcoming + recent fixtures), fetched ONCE per
  // league pick and reused for every team in that league. Keyed by league id.
  const [leagueContexts, setLeagueContexts] = useState<
    Record<string, LeagueContext>
  >({});

  const ensureLeagueContext = useCallback((league: League) => {
    setLeagueContexts((prev) => {
      if (prev[league.id]) return prev; // already loaded
      // Fire-and-forget; result is merged on success.
      api
        .leagueContext(league.id)
        .then((ctx) =>
          setLeagueContexts((p) => ({ ...p, [league.id]: ctx }))
        )
        .catch(() => {
          /* dashboard still works without it */
        });
      return prev;
    });
  }, []);

  const handlePickLeague = (league: League) => {
    ensureLeagueContext(league);
    setScreen({ kind: 'teams', league });
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={
          screen.kind === 'dashboard'
            ? `d-${screen.team.id}`
            : screen.kind === 'teams'
              ? `t-${screen.league.id}`
              : 'l'
        }
        initial={{ opacity: 0, y: 14, scale: 0.985, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -10, scale: 0.99, filter: 'blur(4px)' }}
        // macOS "ease-out-expo"-ish curve — fast initial motion, slow settle.
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {screen.kind === 'leagues' && (
          <LeaguePicker onSelect={handlePickLeague} />
        )}
        {screen.kind === 'teams' && (
          <TeamPicker
            league={screen.league}
            onBack={() => setScreen({ kind: 'leagues' })}
            onSelect={(team) =>
              setScreen({ kind: 'dashboard', league: screen.league, team })
            }
          />
        )}
        {screen.kind === 'dashboard' && (
          <Dashboard
            league={screen.league}
            team={screen.team}
            leagueContext={leagueContexts[screen.league.id] || null}
            onSwitchTeam={(nextLeague, nextTeam) => {
              ensureLeagueContext(nextLeague);
              setScreen({
                kind: 'dashboard',
                league: nextLeague,
                team: nextTeam,
              });
            }}
            onBackToLeagues={() => setScreen({ kind: 'leagues' })}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
