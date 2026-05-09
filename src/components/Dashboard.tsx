import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Home,
  MapPin,
  Repeat2,
  Trophy,
  UserCircle2,
  UserSquare2,
} from 'lucide-react';
import type {
  ClubProfile,
  FormGame,
  League,
  LeagueContext,
  LeagueLeaders,
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
import { Leaders } from './Leaders';
import { SeasonPicker, CURRENT_SEASON, seasonLabel } from './SeasonPicker';
import { TeamSwitchDrawer } from './TeamSwitchDrawer';

export function Dashboard({
  league,
  team,
  leagueContext,
  onSwitchTeam,
  onBackToLeagues,
}: {
  league: League;
  team: Team;
  leagueContext: LeagueContext | null;
  onSwitchTeam: (league: League, team: Team) => void;
  onBackToLeagues: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [season, setSeason] = useState<number>(CURRENT_SEASON);
  const isHistorical = season !== CURRENT_SEASON;

  const [details, setDetails] = useState<TeamDetails | null>(null);
  const [form, setForm] = useState<FormGame[] | null>(null);
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [profile, setProfile] = useState<ClubProfile | null>(null);
  const [leaders, setLeaders] = useState<LeagueLeaders | null>(null);

  const [loadingForm, setLoadingForm] = useState(true);
  const [loadingStandings, setLoadingStandings] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingLeaders, setLoadingLeaders] = useState(true);

  useEffect(() => {
    let stop = false;
    setLoadingStandings(true);
    setLoadingLeaders(true);

    // Standings refetch on every season change
    api
      .standings(league.id, season)
      .then((s) => !stop && setStandings(s))
      .catch(() => !stop && setStandings([]))
      .finally(() => !stop && setLoadingStandings(false));

    // Leaders (top scorers + clean sheets) — Wikipedia for the picked season
    api
      .leaders(league.id, season)
      .then((l) => !stop && setLeaders(l))
      .catch(() => !stop && setLeaders(null))
      .finally(() => !stop && setLoadingLeaders(false));

    // Things that only make sense for the LIVE season — skip on historical
    if (!isHistorical) {
      setLoadingForm(true);
      setLoadingNews(true);

      api
        .team(league.id, team.id)
        .then((d) => !stop && setDetails(d))
        .catch(() => {});

      api
        .profile(league.id, team.id)
        .then((p) => !stop && setProfile(p))
        .catch(() => !stop && setProfile(null));

      api
        .form(league.id, team.id)
        .then((f) => !stop && setForm(f))
        .catch(() => !stop && setForm([]))
        .finally(() => !stop && setLoadingForm(false));

      // News stays live regardless of season selection (per design)
      api
        .teamNews(league.id, team.name)
        .then((n) => {
          if (stop) return;
          if (n.length >= 3) {
            setNews(n);
          } else {
            api
              .leagueNews(league.id)
              .then((all) => !stop && setNews([...n, ...all].slice(0, 12)))
              .catch(() => !stop && setNews(n));
          }
        })
        .catch(() => !stop && setNews([]))
        .finally(() => !stop && setLoadingNews(false));
    } else {
      // Historical view — clear team-specific live data, keep news live
      setForm(null);
      setProfile(null);
      setLoadingForm(false);
      setLoadingNews(true);
      api
        .teamNews(league.id, team.name)
        .then((n) => {
          if (stop) return;
          if (n.length >= 3) setNews(n);
          else
            api
              .leagueNews(league.id)
              .then((all) => !stop && setNews([...n, ...all].slice(0, 12)))
              .catch(() => !stop && setNews(n));
        })
        .catch(() => !stop && setNews([]))
        .finally(() => !stop && setLoadingNews(false));
    }

    return () => {
      stop = true;
    };
  }, [league.id, team.id, team.name, season, isHistorical]);

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
              onClick={() => setDrawerOpen(true)}
              className="hover:text-white transition-colors"
            >
              {league.name}
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-white">{team.shortName || team.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <SeasonPicker
              value={season}
              onChange={setSeason}
              accent={league.accent}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border transition-colors duration-300 hover:bg-white/5"
              style={{
                borderColor: `${league.accent}55`,
                color: league.accent,
              }}
            >
              <Repeat2 className="w-3 h-3" />
              Change team
            </motion.button>
          </div>
        </div>

        {isHistorical && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs text-zinc-300 flex items-center gap-2"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: league.accent }}
            />
            Viewing the <strong className="text-white">
              &nbsp;{seasonLabel(season)}
            </strong>&nbsp;season — table & top scorers reflect that year. Form,
            ownership and the news feed stay current.
          </motion.div>
        )}

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
                {!isHistorical && details?.record && (
                  <span className="inline-flex items-center gap-2 tabular-nums">
                    <span className="text-zinc-500">Record</span>
                    <strong className="text-white">{details.record}</strong>
                  </span>
                )}
              </div>
              {!isHistorical && details?.standingSummary && (
                <p className="mt-3 italic text-zinc-400 text-sm">
                  {details.standingSummary}
                </p>
              )}
            </div>
          </div>

          {/* --- Club identity row (only renders fields we have) --- */}
          {!isHistorical && profile && hasAnyIdentity(profile) && (
            <div className="relative border-t border-white/10 px-8 sm:px-10 py-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3 text-sm">
                {(profile.city || profile.country) && (
                  <Identity
                    icon={MapPin}
                    label="Location"
                    value={[profile.city, profile.country]
                      .filter(Boolean)
                      .join(', ')}
                    accent={league.accent}
                  />
                )}
                {profile.stadium && (
                  <Identity
                    icon={Home}
                    label="Stadium"
                    value={profile.stadium}
                    sub={
                      profile.capacity
                        ? `cap. ${profile.capacity.toLocaleString()}`
                        : undefined
                    }
                    accent={league.accent}
                  />
                )}
                {profile.founded && (
                  <Identity
                    icon={CalendarDays}
                    label="Founded"
                    value={String(profile.founded)}
                    sub={
                      new Date().getFullYear() - profile.founded > 0
                        ? `${new Date().getFullYear() - profile.founded} years`
                        : undefined
                    }
                    accent={league.accent}
                  />
                )}
                {profile.manager && (
                  <Identity
                    icon={UserCircle2}
                    label="Manager"
                    value={profile.manager}
                    accent={league.accent}
                  />
                )}
                {profile.owner && (
                  <Identity
                    icon={Building2}
                    label="Owner"
                    value={profile.owner.split('(')[0].trim()}
                    accent={league.accent}
                  />
                )}
                {profile.chairman && (
                  <Identity
                    icon={UserSquare2}
                    label="Chairman"
                    value={profile.chairman}
                    accent={league.accent}
                  />
                )}
              </div>
            </div>
          )}

          {/* --- Trophy distribution rail --- */}
          {!isHistorical && profile?.trophies && profile.trophies.length > 0 && (
            <TrophyRail
              trophies={profile.trophies}
              accent={league.accent}
              wikiUrl={profile.wikiUrl}
            />
          )}
        </motion.section>

        {/* Form strip + standings + news + chat */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-8 min-w-0">
            {!isHistorical && (
              <section>
                <SectionHeader
                  eyebrow="The last five"
                  title="FORM"
                  accent={league.accent}
                />
                <FormStrip games={form} loading={loadingForm} />
              </section>
            )}

            <section>
              <SectionHeader
                eyebrow={
                  isHistorical
                    ? `${seasonLabel(season)} season`
                    : 'Where we stand'
                }
                title="LEAGUE TABLE"
                accent={league.accent}
              />
              <LeagueTable
                rows={standings}
                highlightTeamId={isHistorical ? undefined : team.id}
                loading={loadingStandings}
                accent={league.accent}
              />
            </section>

            <section>
              <SectionHeader
                eyebrow={
                  isHistorical
                    ? `${seasonLabel(season)} top performers`
                    : 'Leaders this season'
                }
                title="GOALS & CLEAN SHEETS"
                accent={league.accent}
              />
              <Leaders
                data={leaders}
                loading={loadingLeaders}
                accent={league.accent}
                highlightClub={team.name}
              />
            </section>

            <section>
              <SectionHeader
                eyebrow={
                  isHistorical ? 'The wire — always live' : 'The wire'
                }
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
                teamId: team.id,
                league: league.name,
                leagueCode: league.id,
                season,
                standingSummary: details?.standingSummary,
                form: form || [],
                standings: standings || [],
                news: news || [],
                upcomingFixtures: leagueContext?.upcoming || [],
                recentResults: leagueContext?.recent || [],
                topScorers: leaders?.topScorers || [],
                cleanSheets: leaders?.cleanSheets || [],
              }}
              accent={league.accent}
              primary={league.primary}
            />
          </aside>
        </div>
      </div>

      <TeamSwitchDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentLeague={league}
        currentTeam={team}
        onSwitch={(nextLeague, nextTeam) => {
          setDrawerOpen(false);
          onSwitchTeam(nextLeague, nextTeam);
        }}
      />
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

function hasAnyIdentity(p: ClubProfile) {
  return !!(
    p.city ||
    p.country ||
    p.stadium ||
    p.founded ||
    p.manager ||
    p.owner ||
    p.chairman
  );
}

function Identity({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-1"
      >
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        {label}
      </div>
      <div className="text-zinc-100 font-medium leading-tight truncate" title={value}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-zinc-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function TrophyRail({
  trophies,
  accent,
  wikiUrl,
}: {
  trophies: NonNullable<ClubProfile['trophies']>;
  accent: string;
  wikiUrl?: string;
}) {
  // Group by category, sort by count desc within group
  const grouped = new Map<string, typeof trophies>();
  for (const t of trophies) {
    const key = t.category || 'Other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }
  for (const arr of grouped.values()) arr.sort((a, b) => b.count - a.count);
  const totalTrophies = trophies.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="relative border-t border-white/10 px-8 sm:px-10 py-5">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
            Honours
          </span>
          <span
            className="text-xs tabular-nums ml-2"
            style={{ color: accent }}
          >
            {totalTrophies} total titles
          </span>
        </div>
        {wikiUrl && (
          <a
            href={wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            Wikipedia <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">
              {category}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((t) => (
                <span
                  key={t.competition}
                  className="inline-flex items-baseline gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs"
                  title={`${t.competition}: ${t.count}`}
                >
                  <span
                    className="font-display tabular-nums leading-none text-base"
                    style={{ color: accent }}
                  >
                    {t.count}
                  </span>
                  <span className="text-zinc-200">{t.competition}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
