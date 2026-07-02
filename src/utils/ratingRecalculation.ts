import type { AnyMatch, PlayerRating } from '../types';

// ─── Centralized rating recalculation pipeline ─────────────────────────────────
//
// This is the single place that turns match history into player ratings.
// Every caller — Practice Games (create/edit/delete) and tournament score
// entry (create/edit/delete) — must route through `recalculatePlayerRatings`
// instead of computing rating changes locally. That keeps rating logic in
// exactly one function no matter how many places matches get edited.
//
// Current behavior: this is intentionally a NO-OP placeholder. It returns
// `players` untouched so ratings/tiers stay exactly what was last set by hand
// in Admin. The previous Elo-style formula has been removed.
//
// TODO(custom rating formula): replace the function body below. `matches`
// already contains the full, current match history (practice + tournament,
// in whatever order the caller passed them) any time a match is added,
// edited, or deleted — so a real implementation can simply recompute ratings
// from scratch off of `matches` + the current `players` roster.
export function recalculatePlayerRatings(
  matches: AnyMatch[],
  players: PlayerRating[]
): PlayerRating[] {
  void matches; // unused until a real formula is implemented
  return players;
}
