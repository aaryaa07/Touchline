import type { League } from '../types';

export const LEAGUES: League[] = [
  {
    id: 'eng.1',
    slug: 'premier-league',
    name: 'Premier League',
    country: 'England',
    countryCode: 'GB',
    tagline: 'The Greatest Show on Earth',
    primary: '#3D195B',
    accent: '#00FF87',
    bg: '#0B0418',
    surface: '#180A2C',
    pattern: 'radial-gradient(at 20% 0%, rgba(61,25,91,0.55), transparent 55%), radial-gradient(at 80% 100%, rgba(0,255,135,0.18), transparent 60%)',
    logo: '/league-logos/eng-1.png',
  },
  {
    id: 'esp.1',
    slug: 'la-liga',
    name: 'La Liga',
    country: 'Spain',
    countryCode: 'ES',
    tagline: 'Más que un campeonato',
    primary: '#EE2E50',
    accent: '#FFB800',
    bg: '#180404',
    surface: '#2A0810',
    pattern: 'radial-gradient(at 0% 0%, rgba(238,46,80,0.45), transparent 60%), radial-gradient(at 100% 100%, rgba(255,184,0,0.18), transparent 60%)',
    logo: '/league-logos/esp-1.png',
  },
  {
    id: 'ger.1',
    slug: 'bundesliga',
    name: 'Bundesliga',
    country: 'Germany',
    countryCode: 'DE',
    tagline: 'Football. As it should be.',
    primary: '#D20515',
    accent: '#F4F4F4',
    bg: '#0A0A0A',
    surface: '#1A1A1A',
    pattern: 'radial-gradient(at 50% 0%, rgba(210,5,21,0.45), transparent 55%), linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
    logo: '/league-logos/ger-1.png',
  },
  {
    id: 'ita.1',
    slug: 'serie-a',
    name: 'Serie A',
    country: 'Italy',
    countryCode: 'IT',
    tagline: 'Il calcio italiano',
    primary: '#0066FF',
    accent: '#00C853',
    bg: '#02071A',
    surface: '#0A1428',
    pattern: 'radial-gradient(at 30% 0%, rgba(0,102,255,0.45), transparent 55%), radial-gradient(at 70% 100%, rgba(0,200,83,0.16), transparent 55%)',
    logo: '/league-logos/ita-1.png',
  },
  {
    id: 'fra.1',
    slug: 'ligue-1',
    name: 'Ligue 1',
    country: 'France',
    countryCode: 'FR',
    tagline: 'L\'esprit du football',
    primary: '#0F1F3D',
    accent: '#DC2A4F',
    bg: '#02050E',
    surface: '#0A1428',
    pattern: 'radial-gradient(at 0% 100%, rgba(220,42,79,0.35), transparent 55%), radial-gradient(at 100% 0%, rgba(15,31,61,0.85), transparent 55%)',
    logo: '/league-logos/fra-1.png',
    // Source PNG is black-on-transparent — flatten to white so it reads on
    // the dark navy card.
    logoFilter: 'brightness(0) invert(1)',
  },
];

export function leagueBySlug(slug: string) {
  return LEAGUES.find((l) => l.slug === slug);
}

export function leagueById(id: string) {
  return LEAGUES.find((l) => l.id === id);
}
