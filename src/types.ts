// ─── Core League Types ────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  player1: string;
  player2: string;
}

export interface Match {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
  playedAt: string | null;
}

export interface League {
  teams: Team[];
  matches: Match[];
}

export interface StandingRow {
  team: Team;
  rank: number;
  wins: number;
  losses: number;
  played: number;
  pf: number;
  pa: number;
  pd: number;
}

// ─── Player Rating Types (private, never shown on public pages) ───────────────

export type PlayerTier = 'high1' | 'mid1' | 'low1' | 'upper2' | 'mid2' | 'lower2';

export interface PlayerRating {
  id: string;
  name: string;
  rating: number; // 0–100
  tier: PlayerTier;
  notes?: string; // admin-only, never shown on public pages
  updatedAt: string; // ISO 8601
}

// ─── Rating Match Types (admin-only, drives rating/tier updates) ──────────────
// A "rating match" is separate from a normal league Match — it never touches
// public standings/history unless the same result is also recorded as a
// league Match. It exists purely to feed the rating algorithm.

export interface RatingMatch {
  id: string;
  date: string; // date the match was played, "YYYY-MM-DD"
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  teamAScore: number;
  teamBScore: number;
  winnerTeam: 'A' | 'B';
  preMatchRatings: Record<string, number>; // playerId -> rating before this match
  ratingChanges: Record<string, number>; // playerId -> signed rating delta
  postMatchRatings: Record<string, number>; // playerId -> rating after this match
  createdAt: string; // ISO 8601, when the record was saved
}
