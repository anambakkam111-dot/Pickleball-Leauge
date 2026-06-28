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

// ─── Admin / Auth Types ────────────────────────────────────────────────────────
// NOTE: This is casual local-only protection. The hash lives in localStorage
// and is visible to anyone with browser dev tools. Not real server security.

export interface AdminSettings {
  passwordHash: string | null;
  isSetup: boolean;
}
