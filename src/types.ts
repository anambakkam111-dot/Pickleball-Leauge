// ─── Core League Types ────────────────────────────────────────────────────────

export type MatchType = 'practice' | 'tournament';

export interface Team {
  id: string;
  name: string;
  player1: string;
  player2: string;
}

export interface Match {
  id: string;
  matchType: 'tournament';
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

// One entry per rating-affecting match a player participated in, produced by
// the baseline-replay engine in utils/ratingRecalculation.ts. Exists mainly
// for debugging/explaining a rating change — see `explainRatingChange`.
export interface RatingHistoryEntry {
  matchId: string;
  matchType: MatchType;
  date: string;
  oldElo: number;
  newElo: number;
  deltaBeforeHrtp: number;
  finalDelta: number;
  teamAvgElo: number;
  opponentAvgElo: number;
  expectedWinProbability: number;
  expectedSignedMargin: number;
  actualSignedMargin: number;
  actualPerformance: number;
  expectedPerformance: number;
  performanceDiff: number;
  playerK: number;
  teammateGap: number;
  hrtpApplied: boolean;
  hrtpFactor?: number;
}

export interface PlayerRating {
  id: string;
  name: string;
  baseElo: number; // open-ended Elo scale, admin-editable; replay starts here
  currentElo: number; // recomputed by recalculatePlayerRatings from baseElo + match history
  gamesPlayed: number; // rating-affecting games played, recomputed on every replay
  tier: PlayerTier; // dynamic percentile-based tier, recomputed on every replay
  notes?: string; // admin-only, never shown on public pages
  updatedAt: string; // ISO 8601
  ratingHistory?: RatingHistoryEntry[]; // per-match breakdown, for debugging
  originalPreliminaryRating?: number; // the old 0–100 rating this player migrated from, if any
}

// ─── Practice Match Types ──────────────────────────────────────────────────────
// A "practice match" is a player-vs-player doubles result recorded from the
// Practice Games tab. It is separate from the public Team-based league
// `Match` (which represents tournament play) but both feed the same
// centralized match history / rating-recalculation pipeline — see
// `utils/ratingRecalculation.ts`.

export interface PracticeMatch {
  id: string;
  matchType: 'practice';
  date: string; // date the match was played, "YYYY-MM-DD"
  teamAPlayerIds: [string, string];
  teamBPlayerIds: [string, string];
  teamAScore: number;
  teamBScore: number;
  winnerTeam: 'A' | 'B';
  notes?: string;
  createdAt: string; // ISO 8601, when the record was first saved
  updatedAt: string; // ISO 8601, last edited
}

// Union of every match shape that feeds the centralized rating pipeline.
export type AnyMatch = Match | PracticeMatch;
