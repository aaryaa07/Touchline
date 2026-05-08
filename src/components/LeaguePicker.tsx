import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { LEAGUES } from '../data/leagues';
import type { League } from '../types';

export function LeaguePicker({ onSelect }: { onSelect: (l: League) => void }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(at 20% 0%, rgba(120,40,200,0.18), transparent 50%), radial-gradient(at 80% 100%, rgba(220,42,79,0.16), transparent 50%)',
        }}
      />
      <div className="absolute inset-0 grain pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 pt-14 pb-20">
        <header className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Live · Always on
            </span>
          </div>
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl leading-[0.85] tracking-tight">
            <span className="block text-zinc-100">TOUCH</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-cyan-300 to-violet-400">
              LINE
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-zinc-300 text-lg leading-relaxed">
            Your team. The latest. Zero noise. Pick a league to get going —
            we'll line up the news, the table, the last five, and a writer
            you can chat with.
          </p>
        </header>

        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-2xl tracking-wider text-zinc-200">
            CHOOSE YOUR LEAGUE
          </h2>
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            Top 5 · Europe
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEAGUES.map((league, i) => (
            <motion.button
              key={league.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.5, ease: 'easeOut' }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(league)}
              className="group relative text-left rounded-2xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors"
              style={{
                background: league.surface,
                minHeight: 280,
              }}
            >
              <div
                className="absolute inset-0"
                style={{ background: league.pattern }}
              />
              <div className="absolute inset-0 grain opacity-40" />

              <div
                className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-80"
                style={{ background: league.primary }}
              />

              <div className="relative h-full p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-300/80">
                      {league.country}
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border"
                      style={{
                        borderColor: `${league.accent}55`,
                        color: league.accent,
                      }}
                    >
                      25/26
                    </span>
                  </div>
                  <h3 className="font-display text-4xl sm:text-5xl leading-[0.9] tracking-tight text-white drop-shadow-[0_2px_30px_rgba(0,0,0,0.5)]">
                    {league.name.split(' ').map((w, idx) => (
                      <span key={idx} className="block">
                        {w.toUpperCase()}
                      </span>
                    ))}
                  </h3>
                </div>

                <div>
                  <p className="italic text-zinc-200/70 text-sm mb-5">
                    “{league.tagline}”
                  </p>
                  <div
                    className="inline-flex items-center gap-2 text-sm font-medium transition-transform group-hover:translate-x-1"
                    style={{ color: league.accent }}
                  >
                    Pick this league <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <footer className="mt-16 text-xs text-zinc-500 flex items-center gap-2">
          <span>Powered by ESPN public data + Groq llama-3.3-70b.</span>
          <span className="text-zinc-700">·</span>
          <span>Headlines update every 5 minutes.</span>
        </footer>
      </div>
    </div>
  );
}
