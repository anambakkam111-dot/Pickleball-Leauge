import type { League, Match, PlayerRating, PracticeMatch } from './types';
import { migratePlayerRatings } from './utils/ratingRecalculation';

const KEYS = {
  league: 'pickleball-league-v1',
  ratings: 'pickleball-ratings-v1',
  practiceMatches: 'pickleball-practice-matches-v1',
  // Legacy key from the old admin-only "Rating Match Entry" feature.
  // Migrated into KEYS.practiceMatches on first load, then left untouched.
  legacyRatingMatches: 'pickleball-rating-matches-v1',
} as const;

// ─── League ───────────────────────────────────────────────────────────────────
// Existing saved matches predate the `matchType` field — backfill it so old
// localStorage data keeps working without a manual reset.

export function loadLeague(): League {
  try {
    const raw = localStorage.getItem(KEYS.league);
    if (!raw) return { teams: [], matches: [] };
    const parsed = JSON.parse(raw) as League;
    const matches: Match[] = (parsed.matches ?? []).map(m => ({ ...m, matchType: 'tournament' }));
    return { teams: parsed.teams ?? [], matches };
  } catch {
    return { teams: [], matches: [] };
  }
}

export function saveLeague(league: League): void {
  localStorage.setItem(KEYS.league, JSON.stringify(league));
}

// ─── Player Ratings (central player database) ─────────────────────────────────

// Old 0-100 `rating` players are migrated to open-ended Elo (`baseElo`/
// `currentElo`) on load — see migratePlayerRatings in utils/ratingRecalculation.ts.
// This preserves names, tiers, and notes; App's recalculation effect then
// replays match history on top of the migrated baseElo.
export function loadRatings(): PlayerRating[] {
  try {
    const raw = localStorage.getItem(KEYS.ratings);
    if (!raw) return [];
    return migratePlayerRatings(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRatings(ratings: PlayerRating[]): void {
  localStorage.setItem(KEYS.ratings, JSON.stringify(ratings));
}

// ─── Practice Matches ───────────────────────────────────────────────────────────

// Shape of the old admin-only "Rating Match Entry" records, kept locally only
// for one-time migration into PracticeMatch[].
interface LegacyRatingMatch {
  id: string;
  date: string;
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  teamAScore: number;
  teamBScore: number;
  winnerTeam: 'A' | 'B';
  createdAt: string;
}

function migrateLegacyRatingMatches(): PracticeMatch[] {
  try {
    const raw = localStorage.getItem(KEYS.legacyRatingMatches);
    if (!raw) return [];
    const legacy = JSON.parse(raw) as LegacyRatingMatch[];
    return legacy.map(m => ({
      id: m.id,
      matchType: 'practice',
      date: m.date,
      teamAPlayerIds: m.teamAPlayerIds,
      teamBPlayerIds: m.teamBPlayerIds,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      winnerTeam: m.winnerTeam,
      createdAt: m.createdAt,
      updatedAt: m.createdAt,
    }));
  } catch {
    return [];
  }
}

export function loadPracticeMatches(): PracticeMatch[] {
  try {
    const raw = localStorage.getItem(KEYS.practiceMatches);
    if (raw) return JSON.parse(raw) as PracticeMatch[];
  } catch {
    return [];
  }
  // No practice matches saved yet under the new key — migrate legacy data once.
  const migrated = migrateLegacyRatingMatches();
  if (migrated.length > 0) savePracticeMatches(migrated);
  return migrated;
}

export function savePracticeMatches(matches: PracticeMatch[]): void {
  localStorage.setItem(KEYS.practiceMatches, JSON.stringify(matches));
}
