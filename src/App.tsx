import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LeaguePicker } from './components/LeaguePicker';
import { TeamPicker } from './components/TeamPicker';
import { Dashboard } from './components/Dashboard';
import type { League, Team } from './types';

type Screen =
  | { kind: 'leagues' }
  | { kind: 'teams'; league: League }
  | { kind: 'dashboard'; league: League; team: Team };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'leagues' });

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {screen.kind === 'leagues' && (
          <LeaguePicker
            onSelect={(league) => setScreen({ kind: 'teams', league })}
          />
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
            onBackToTeams={() =>
              setScreen({ kind: 'teams', league: screen.league })
            }
            onBackToLeagues={() => setScreen({ kind: 'leagues' })}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
