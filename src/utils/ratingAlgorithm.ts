import type { PlayerRating, PlayerTier } from '../types';

// ─── Doubles Elo-style rating algorithm ────────────────────────────────────────
//
// Overview:
//   1. Average each team's two player ratings into a single TeamRating.
//   2. Convert the TeamRating gap into a win probability (logistic curve).
//   3. Compare the actual result to that probability to get a TeamChange —
//      positive for the winning team, negative for the losing team.
//   4. Split TeamChange between teammates unevenly: within a team, the
//      weaker player moves more on a win and less on a loss, since they
//      "explain" the result less than the stronger player.
//   5. Apply gap protection so a strong player carried by a much weaker
//      partner doesn't lose full points on a loss.

const BASE_K = 4;
const ELO_SCALE = 15; // divisor in the logistic exponent — smaller = more sensitive to rating gaps
const WEIGHT_SLOPE = 0.15; // how strongly player weight reacts to rating vs team average
const WEIGHT_MIN = 0.85;
const WEIGHT_MAX = 1.15;
const GAP_FREE_THRESHOLD = 15; // teammate rating gap below this gets no protection adjustment
const GAP_PROTECTION_SLOPE = 0.01;
const GAP_PROTECTION_MIN = 0.65;

/**
 * Win probability for a team given its own rating and the opponent's rating.
 * Standard logistic (Elo) curve: a 15-point rating edge is a decisive favorite,
 * a 0-point gap is a toss-up.
 */
export function expectedScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / ELO_SCALE));
}

/** Blowouts move ratings more than nail-biters, capped at 1.5x the base rate. */
export function marginMultiplier(margin: number): number {
  return Math.min(1.5, 1 + 0.08 * margin);
}

/**
 * On a win, the player rated below their team average gets a slight boost
 * (they "needed" the help less than expected relative to their own rating),
 * and the player rated above the average gets a slight discount.
 * Clamped to +/-15% so no single player dominates the swing.
 */
export function winnerWeight(teamRating: number, playerRating: number): number {
  const weight = 1 + WEIGHT_SLOPE * ((teamRating - playerRating) / ELO_SCALE);
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight));
}

/**
 * On a loss, the player rated above their team average is considered more
 * "responsible" for the result and loses slightly more; the weaker player
 * loses slightly less. Same +/-15% clamp as winnerWeight.
 */
export function loserWeight(playerRating: number, teamRating: number): number {
  const weight = 1 + WEIGHT_SLOPE * ((playerRating - teamRating) / ELO_SCALE);
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, weight));
}

/**
 * Protects a strong player from losing full points when their teammate is
 * much weaker (large TeammateGap) — losing while carrying a weak partner
 * shouldn't cost as much as losing as an equal pairing.
 * No effect below a 15-point gap; floors out at 0.65x for very lopsided pairs.
 */
export function gapProtectionMultiplier(teammateGap: number): number {
  if (teammateGap <= GAP_FREE_THRESHOLD) return 1;
  return Math.max(GAP_PROTECTION_MIN, 1 - (teammateGap - GAP_FREE_THRESHOLD) * GAP_PROTECTION_SLOPE);
}

export interface PlayerMatchInput {
  id: string;
  rating: number;
}

export interface PlayerRatingChange {
  id: string;
  oldRating: number;
  change: number;
  newRating: number;
}

/**
 * Computes rating changes for all four players in a doubles rating match.
 * `teamAScore > teamBScore` determines the winner — validate the score
 * (game-to-11, win-by-2) with `validateScore` before calling this.
 */
export function computeRatingChanges(
  teamA: [PlayerMatchInput, PlayerMatchInput],
  teamB: [PlayerMatchInput, PlayerMatchInput],
  teamAScore: number,
  teamBScore: number
): PlayerRatingChange[] {
  const teamRatingA = (teamA[0].rating + teamA[1].rating) / 2;
  const teamRatingB = (teamB[0].rating + teamB[1].rating) / 2;

  const expectedA = expectedScore(teamRatingA, teamRatingB);
  const expectedB = 1 - expectedA;

  const aWon = teamAScore > teamBScore;
  const actualA = aWon ? 1 : 0;
  const actualB = aWon ? 0 : 1;

  const margin = Math.abs(teamAScore - teamBScore);
  const multiplier = marginMultiplier(margin);

  const teamChangeA = BASE_K * multiplier * (actualA - expectedA);
  const teamChangeB = BASE_K * multiplier * (actualB - expectedB);

  return [
    ...applyTeamChange(teamA, teamRatingA, teamChangeA, aWon),
    ...applyTeamChange(teamB, teamRatingB, teamChangeB, !aWon),
  ];
}

/** Splits a team's rating change between its two players. */
function applyTeamChange(
  team: [PlayerMatchInput, PlayerMatchInput],
  teamRating: number,
  teamChange: number,
  won: boolean
): PlayerRatingChange[] {
  return team.map((player, idx) => {
    const partner = team[idx === 0 ? 1 : 0];
    let finalChange: number;

    if (won) {
      finalChange = teamChange * winnerWeight(teamRating, player.rating);
    } else {
      const weight = loserWeight(player.rating, teamRating);
      const isHigherRatedTeammate = player.rating > partner.rating;
      // Gap protection only shields the stronger teammate on a loss.
      const gapMultiplier = isHigherRatedTeammate
        ? gapProtectionMultiplier(Math.abs(player.rating - partner.rating))
        : 1;
      finalChange = teamChange * weight * gapMultiplier;
    }

    const boundedRating = Math.max(0, Math.min(100, player.rating + finalChange));
    const newRating = Math.round(boundedRating * 10) / 10;
    return {
      id: player.id,
      oldRating: player.rating,
      change: Math.round((newRating - player.rating) * 10) / 10,
      newRating,
    };
  });
}

// ─── Dynamic tiers ──────────────────────────────────────────────────────────
//
// Tiers are recalculated from scratch after every rating match, based purely
// on percentile rank within the current player pool (not fixed rating cutoffs).
// Percentile is measured from the bottom of the pack (0% = lowest rated) so
// tier quality is monotonic: lower2 < mid2 < upper2 < low1 < mid1 < high1.

const TIER_PERCENTILE_BANDS: { maxPercentile: number; tier: PlayerTier }[] = [
  { maxPercentile: 0.10, tier: 'lower2' }, // bottom 10%
  { maxPercentile: 0.25, tier: 'mid2' },   // 10%–25%
  { maxPercentile: 0.40, tier: 'upper2' }, // 25%–40%
  { maxPercentile: 0.60, tier: 'low1' },   // 40%–60%
  { maxPercentile: 0.80, tier: 'mid1' },   // 60%–80%
  { maxPercentile: 1.00, tier: 'high1' },  // top 20%
];

/** Returns a new array with every player's tier recalculated by rating percentile. */
export function recalculateTiers<T extends { id: string; rating: number }>(
  players: T[]
): (T & { tier: PlayerTier })[] {
  const n = players.length;
  if (n === 0) return [];

  // Ascending by rating: index 0 is the lowest-rated player.
  const ascending = [...players].sort((a, b) => a.rating - b.rating);
  const tierById = new Map<string, PlayerTier>();
  ascending.forEach((player, idx) => {
    const percentile = (idx + 1) / n;
    const band = TIER_PERCENTILE_BANDS.find(b => percentile <= b.maxPercentile);
    tierById.set(player.id, band ? band.tier : 'high1');
  });

  return players.map(p => ({ ...p, tier: tierById.get(p.id)! }));
}

/** Applies a set of rating changes to a full ratings list and recalculates tiers. */
export function applyRatingChangesToRoster(
  ratings: PlayerRating[],
  changes: PlayerRatingChange[]
): PlayerRating[] {
  const changeById = new Map(changes.map(c => [c.id, c]));
  const updated = ratings.map(r => {
    const change = changeById.get(r.id);
    if (!change) return r;
    return { ...r, rating: change.newRating, updatedAt: new Date().toISOString() };
  });
  return recalculateTiers(updated);
}
