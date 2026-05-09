import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

const CURRENT_SEASON = 2025; // 2025/26 is the active season

const seasonLabel = (y: number) =>
  `${String(y).slice(-2)}/${String(y + 1).slice(-2)}`;

export function SeasonPicker({
  value,
  onChange,
  accent,
  minYear = 2000,
  maxYear = CURRENT_SEASON,
}: {
  value: number;
  onChange: (s: number) => void;
  accent: string;
  minYear?: number;
  maxYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const years = useMemo(
    () =>
      Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => maxYear - i
      ),
    [minYear, maxYear]
  );

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const isHistorical = value !== CURRENT_SEASON;

  return (
    <div ref={ref} className="relative inline-block">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border transition-colors duration-300',
          isHistorical && 'bg-white/5'
        )}
        style={{ borderColor: `${accent}55`, color: accent }}
      >
        {seasonLabel(value)}
        <ChevronDown
          className="w-3 h-3 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 z-30 max-h-72 w-32 overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur-md shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 px-3 py-2 border-b border-white/5">
              Season
            </div>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs tabular-nums transition-colors',
                  y === value
                    ? 'text-white bg-white/10'
                    : 'text-zinc-300 hover:bg-white/5'
                )}
              >
                {seasonLabel(y)}
                {y === CURRENT_SEASON && (
                  <span
                    className="ml-2 text-[9px] uppercase tracking-widest"
                    style={{ color: accent }}
                  >
                    live
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { CURRENT_SEASON, seasonLabel };
