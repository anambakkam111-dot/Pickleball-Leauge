import type { League, PlayerRating } from './types';

const KEYS = {
  league: 'pickleball-league-v1',
  ratings: 'pickleball-ratings-v1',
} as const;

// ─── League ───────────────────────────────────────────────────────────────────

export function loadLeague(): League {
  try {
    const raw = localStorage.getItem(KEYS.league);
    if (!raw) return { teams: [], matches: [] };
    return JSON.parse(raw) as League;
  } catch {
    return { teams: [], matches: [] };
  }
}

export function saveLeague(league: League): void {
  localStorage.setItem(KEYS.league, JSON.stringify(league));
}

// ─── Player Ratings ───────────────────────────────────────────────────────────

export function loadRatings(): PlayerRating[] {
  try {
    const raw = localStorage.getItem(KEYS.ratings);
    if (!raw) return [];
    return JSON.parse(raw) as PlayerRating[];
  } catch {
    return [];
  }
}

export function saveRatings(ratings: PlayerRating[]): void {
  localStorage.setItem(KEYS.ratings, JSON.stringify(ratings));
}
