import type {
  Team,
  TeamDetails,
  StandingRow,
  FormGame,
  NewsItem,
  ChatMessage,
  ClubProfile,
  LeagueContext,
  LeagueLeaders,
} from '../types';

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${txt.slice(0, 120)}`);
  }
  return res.json();
}

export const api = {
  teams: (league: string) =>
    getJSON<Team[]>(`/api/leagues/${league}/teams`),
  standings: (league: string, season?: number) =>
    getJSON<StandingRow[]>(
      `/api/leagues/${league}/standings${season ? `?season=${season}` : ''}`
    ),
  leagueContext: (league: string) =>
    getJSON<LeagueContext>(`/api/leagues/${league}/context`),
  leaders: (league: string, season: number) =>
    getJSON<LeagueLeaders>(
      `/api/leagues/${league}/leaders?season=${season}`
    ),
  team: (league: string, teamId: string) =>
    getJSON<TeamDetails>(`/api/teams/${league}/${teamId}`),
  form: (league: string, teamId: string) =>
    getJSON<FormGame[]>(`/api/teams/${league}/${teamId}/form`),
  profile: (league: string, teamId: string) =>
    getJSON<ClubProfile | null>(`/api/teams/${league}/${teamId}/profile`),
  leagueNews: (league: string) =>
    getJSON<NewsItem[]>(`/api/leagues/${league}/news`),
  teamNews: (league: string, teamName: string) =>
    getJSON<NewsItem[]>(
      `/api/leagues/${league}/news?team=${encodeURIComponent(teamName)}`
    ),
  chat: async (
    messages: ChatMessage[],
    context: Record<string, unknown>
  ): Promise<{
    reply: string;
    toolsUsed?: { name: string; args: Record<string, unknown> }[];
  }> => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    });
    if (!res.ok) throw new Error(`Chat ${res.status}`);
    return res.json();
  },
};
