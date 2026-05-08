import { motion } from 'motion/react';
import { ExternalLink } from 'lucide-react';
import type { NewsItem } from '../types';
import { timeAgo } from '../lib/cn';

export function NewsFeed({
  items,
  loading,
  accent,
}: {
  items: NewsItem[] | null;
  loading: boolean;
  accent: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-44 rounded-xl bg-white/5 animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-zinc-400 text-sm">
        No headlines mention your team in the last cycle. Check the league
        feed below or ask the assistant for a recap.
      </div>
    );
  }

  const [hero, ...rest] = items;

  return (
    <div className="space-y-4">
      {hero && (
        <motion.a
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          href={hero.link}
          target="_blank"
          rel="noreferrer"
          className="group block rounded-2xl overflow-hidden border border-white/10 bg-black/30 hover:border-white/30 transition-colors"
        >
          <div className="grid grid-cols-1 md:grid-cols-5">
            {hero.image && (
              <div className="md:col-span-2 aspect-[16/10] md:aspect-auto overflow-hidden bg-zinc-900">
                <img
                  src={hero.image}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="md:col-span-3 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-[10px] uppercase tracking-[0.25em] font-bold"
                    style={{ color: accent }}
                  >
                    Lead Story
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    · {timeAgo(hero.published)}
                  </span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl leading-tight tracking-tight text-white">
                  {hero.headline}
                </h3>
                {hero.description && (
                  <p className="mt-3 text-zinc-300 text-sm leading-relaxed line-clamp-3">
                    {hero.description}
                  </p>
                )}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-zinc-400 group-hover:text-white transition-colors">
                Read on ESPN <ExternalLink className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </motion.a>
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.slice(0, 9).map((n, i) => (
            <motion.a
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              href={n.link}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl overflow-hidden border border-white/10 bg-black/25 hover:border-white/30 transition-colors flex flex-col"
            >
              {n.image && (
                <div className="aspect-[16/9] overflow-hidden bg-zinc-900">
                  <img
                    src={n.image}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: accent }}
                  />
                  {timeAgo(n.published)}
                </div>
                <h4 className="font-semibold text-zinc-100 leading-snug line-clamp-3">
                  {n.headline}
                </h4>
              </div>
            </motion.a>
          ))}
        </div>
      )}
    </div>
  );
}
