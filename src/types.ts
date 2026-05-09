export type League = {
  id: string;
  slug: string;
  name: string;
  country: string;
  countryCode: string;
  tagline: string;
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  pattern: string;
  logo: string;
  /** Optional CSS filter applied to the league logo (e.g. to flip a
   *  black-on-transparent mark to white when the card background is dark). */
  logoFilter?: string;
};

export type Team = {
  id: string;
  name: string;
  shortName?: string;
  nickname?: string;
  abbreviation?: string;
  slug?: string;
  logo: string;
  color?: string | null;
  alternateColor?: string | null;
};

export type TeamDetails = Team & {
  record?: string;
  standingSummary?: string;
  venue?: string;
};

export type FormGame = {
  id: string;
  date: string;
  opponent: string;
  opponentShort?: string;
  opponentLogo?: string;
  home: boolean;
  ourScore: number;
  theirScore: number;
  result: 'W' | 'D' | 'L';
  competition: string;
};

export type StandingRow = {
  rank: number;
  teamId: string;
  team: string;
  shortName?: string;
  logo?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gd: number;
  points: number;
};

export type NewsItem = {
  id: string;
  headline: string;
  description?: string;
  published?: string;
  type?: string;
  image?: string | null;
  link?: string;
  categories?: string[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: { name: string; args: Record<string, unknown> }[];
};

export type TrophyEntry = {
  category: string;
  competition: string;
  count: number;
};

export type LeagueMatch = {
  id: string;
  date: string;
  home: string;
  homeShort?: string;
  homeScore: number | null;
  away: string;
  awayShort?: string;
  awayScore: number | null;
  state: 'pre' | 'in' | 'post' | 'unknown';
  status: string;
  competition?: string;
};

export type LeagueContext = {
  upcoming: LeagueMatch[];
  recent: LeagueMatch[];
};

export type Leader = {
  rank: number;
  player: string;
  club: string;
  value: number;
};

export type LeagueLeaders = {
  topScorers: Leader[];
  cleanSheets: Leader[];
  season: number;
  source?: string;
};

export type ClubProfile = {
  title: string;
  wikiUrl: string;
  description?: string;
  extract?: string;
  founded?: number | null;
  foundedRaw?: string | null;
  stadium?: string | null;
  capacity?: number | null;
  city?: string | null;
  country?: string | null;
  owner?: string | null;
  chairman?: string | null;
  manager?: string | null;
  trophies?: TrophyEntry[];
};
