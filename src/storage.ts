import type { League, PlayerRating, RatingMatch } from './types';

const KEYS = {
  league: 'pickleball-league-v1',
  ratings: 'pickleball-ratings-v1',
  ratingMatches: 'pickleball-rating-matches-v1',
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

// ─── Rating Matches (admin-only, drives rating/tier updates) ──────────────────

export function loadRatingMatches(): RatingMatch[] {
  try {
    const raw = localStorage.getItem(KEYS.ratingMatches);
    if (!raw) return [];
    return JSON.parse(raw) as RatingMatch[];
  } catch {
    return [];
  }
}

export function saveRatingMatches(matches: RatingMatch[]): void {
  localStorage.setItem(KEYS.ratingMatches, JSON.stringify(matches));
}
