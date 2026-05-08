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
};
