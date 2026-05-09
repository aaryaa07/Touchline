import { motion } from 'motion/react';
import type { League } from '../types';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: string; logo: string; halo: string }> = {
  sm: { box: 'w-14 h-14', logo: 'max-h-10 max-w-10', halo: 'w-20 h-20' },
  md: { box: 'w-24 h-24', logo: 'max-h-16 max-w-16', halo: 'w-32 h-32' },
  lg: { box: 'w-32 h-32', logo: 'max-h-24 max-w-24', halo: 'w-44 h-44' },
};

/**
 * League-themed loader: pulses the league logo's opacity in a slow, smooth
 * loop with a soft colored halo behind it. Use anywhere a "loading…" state
 * would otherwise show a generic skeleton.
 */
export function LeagueLoader({
  league,
  size = 'md',
  label,
}: {
  league: League;
  size?: Size;
  label?: string;
}) {
  const s = SIZES[size];
  return (
    <div className="flex flex-col items-center justify-center gap-3 select-none">
      <div className="relative flex items-center justify-center">
        {/* Pulsing halo behind the logo */}
        <motion.div
          className={`absolute rounded-full blur-2xl ${s.halo}`}
          style={{ background: league.accent }}
          animate={{ opacity: [0.15, 0.45, 0.15], scale: [0.85, 1.05, 0.85] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
        {/* Logo, breathing opacity */}
        <motion.img
          src={league.logo}
          alt=""
          aria-hidden
          className={`relative ${s.logo} object-contain drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]`}
          style={{ filter: league.logoFilter }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: [0.45, 0, 0.55, 1],
          }}
        />
      </div>
      {label && (
        <motion.span
          className="text-[10px] uppercase tracking-[0.3em] text-zinc-400"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: [0.45, 0, 0.55, 1],
          }}
        >
          {label}
        </motion.span>
      )}
    </div>
  );
}
