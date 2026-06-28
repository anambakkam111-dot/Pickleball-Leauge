import type { League, PlayerRating, AdminSettings } from './types';

const KEYS = {
  league: 'pickleball-league-v1',
  ratings: 'pickleball-ratings-v1',
  admin: 'pickleball-admin-v1',
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

// ─── Admin Settings ───────────────────────────────────────────────────────────

const DEFAULT_ADMIN: AdminSettings = { passwordHash: null, isSetup: false };

export function loadAdminSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(KEYS.admin);
    if (!raw) return DEFAULT_ADMIN;
    return JSON.parse(raw) as AdminSettings;
  } catch {
    return DEFAULT_ADMIN;
  }
}

export function saveAdminSettings(settings: AdminSettings): void {
  localStorage.setItem(KEYS.admin, JSON.stringify(settings));
}
