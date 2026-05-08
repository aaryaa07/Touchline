import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, MapPin, Trophy } from 'lucide-react';
import type {
  FormGame,
  League,
  NewsItem,
  StandingRow,
  Team,
  TeamDetails,
} from '../types';
import { api } from '../services/api';
import { FormStrip } from './FormStrip';
import { LeagueTable } from './LeagueTable';
import { NewsFeed } from './NewsFeed';
import { Chatbot } from './Chatbot';

export function Dashboard({
  league,
  team,
  onBackToTeams,
  onBackToLeagues,
}: {
  league: League;
  team: Team;
  onBackToTeams: () => void;
  onBackToLeagues: () => void;
}) {
  const [details, setDetails] = useState<TeamDetails | null>(null);
  const [form, setForm] = useState<FormGame[] | null>(null);
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);

  const [loadingForm, setLoadingForm] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  useEffect(() => {
    let stop = false;
    setLoadingForm(true);
    setLoadingStandings(true);
    setLoadingNews(true);

    api
      .team(league.id, team.id)
      .then((d) => !stop && setDetails(d))
      .catch(() => {});

    api
      .form(league.id, team.id)
      .then((f) => !stop && setForm(f))
      .catch(() => !stop && setForm([]))
      .finally(() => !stop && setLoadingForm(false));

    api
      .standings(league.id)
      .then((s) => !stop && setStandings(s))
      .catch(() => !stop && setStandings([]))
      .finally(() => !stop && setLoadingStandings(false));

    api
      .teamNews(league.id, team.name)
      .then((n) => {
        if (stop) return;
        if (n.length >= 3) {
          setNews(n);
        } else {
          // Fall back to league-wide news if very few team-specific hits
          api
            .leagueNews(league.id)
            .then((all) => !stop && setNews([...n, ...all].slice(0, 12)))
            .catch(() => !stop && setNews(n));
        }
      })
      .catch(() => !stop && setNews([]))
      .finally(() => !stop && setLoadingNews(false));

    return () => {
      stop = true;
    };
  }, [league.id, team.id, team.name]);

  const myStanding = standings?.find((s) => s.teamId === team.id);
  const teamColor = team.color || details?.color || league.accent;

  return (
    <div
      className="min-h-screen text-zinc-100 relative"
      style={{ background: league.bg }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: league.pattern }}
      />
      <div className="absolute inset-0 grain opacity-30 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 pt-8 pb-16">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8 text-sm">
          <div className="flex items-center gap-3 text-zinc-400">
            <button
              onClick={onBackToLeagues}
              className="hover:text-white transition-colors"
            >
              Leagues
            </button>
            <span className="text-zinc-700">/</span>
            <button
              onClick={onBackToTeams}
              className="hover:text-white transition-colors"
            >
              {league.name}
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-white">{team.shortName || team.name}</span>
          </div>
          <button
            onClick={onBackToTeams}
            className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Change team
          </button>
        </div>

        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden border border-white/10 mb-8"
          style={{
            background: `linear-gradient(135deg, ${teamColor}33 0%, transparent 60%), ${league.surface}`,
          }}
        >
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-30"
            style={{ background: teamColor }}
          />
          <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-center p-8 sm:p-10">
            <div className="flex items-center justify-center">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-4"
                style={{
                  boxShadow: `0 0 80px -20px ${teamColor}`,
                }}
              >
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-full h-full object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
                />
              </div>
            </div>
            <div>
              <div
                className="text-[11px] uppercase tracking-[0.3em] mb-2"
                style={{ color: league.accent }}
              >
                {league.country} · {league.name}
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl leading-[0.9] tracking-tight">
                {team.name.toUpperCase()}
              </h1>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-300">
                {myStanding && (
                  <span className="inline-flex items-center gap-2">
                    <Trophy className="w-4 h-4" style={{ color: league.accent }} />
                    <strong className="text-white">#{myStanding.rank}</strong>
                    in table · {myStanding.points} pts
                  </span>
                )}
                {details?.record && (
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    <span className="text-zinc-500">Record</span>
                    <strong className="text-white">{details.record}</strong>
                  </span>
                )}
                {details?.venue && (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    {details.venue}
                  </span>
                )}
              </div>
              {details?.standingSummary && (
                <p className="mt-3 italic text-zinc-400 text-sm">
                  {details.standingSummary}
                </p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Form strip + standings + news + chat */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-8 min-w-0">
            <section>
              <SectionHeader
                eyebrow="The last five"
                title="FORM"
                accent={league.accent}
              />
              <FormStrip games={form} loading={loadingForm} />
            </section>

            <section>
              <SectionHeader
                eyebrow="Where we stand"
                title="LEAGUE TABLE"
                accent={league.accent}
              />
              <LeagueTable
                rows={standings}
                highlightTeamId={team.id}
                loading={loadingStandings}
                accent={league.accent}
              />
            </section>

            <section>
              <SectionHeader
                eyebrow="The wire"
                title="HEADLINES"
                accent={league.accent}
              />
              <NewsFeed
                items={news}
                loading={loadingNews}
                accent={league.accent}
              />
            </section>
          </div>

          <aside className="lg:block">
            <Chatbot
              context={{
                team: team.name,
                league: league.name,
                standingSummary: details?.standingSummary,
                form: form || [],
                standings: standings || [],
                news: news || [],
              }}
              accent={league.accent}
              primary={league.primary}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  accent,
}: {
  eyebrow: string;
  title: string;
  accent: string;
}) {
  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-[0.3em] mb-1"
        style={{ color: accent }}
      >
        {eyebrow}
      </div>
      <h2 className="font-display text-2xl tracking-wider text-white">
        {title}
      </h2>
    </div>
  );
}
