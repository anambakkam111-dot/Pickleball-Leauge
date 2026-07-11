import type { PlayerRating, PlayerTier } from '../types';
import { toEloScale } from '../utils/ratingRecalculation';

// `preliminaryRating` is the old 0–100 scale; converted to open-ended Elo via
// the same formula used to migrate existing localStorage data.
function p(name: string, preliminaryRating: number, tier: PlayerTier): PlayerRating {
  const baseElo = toEloScale(preliminaryRating);
  return {
    id: crypto.randomUUID(),
    name,
    baseElo,
    currentElo: baseElo,
    gamesPlayed: 0,
    tier,
    updatedAt: new Date().toISOString(),
    originalPreliminaryRating: preliminaryRating,
  };
}

export const SEED_RATINGS: PlayerRating[] = [
  // High Tier 1
  p('Sai', 95, 'high1'),
  p('Sudhir', 93, 'high1'),
  p('Chandhu', 90, 'high1'),
  p('Sinu', 89, 'high1'),
  p('Appa', 89, 'high1'),
  p('Raunak', 89, 'high1'),
  // Mid Tier 1
  p('Vinay', 84, 'mid1'),
  p('Aarav', 84, 'mid1'),
  p('Neel', 82, 'mid1'),
  p('Srimann', 81, 'mid1'),
  p('Anirudh', 79, 'mid1'),
  p('Aarvind', 79, 'mid1'),
  p('Harry', 79, 'mid1'),
  p('Bharat', 79, 'mid1'),
  // Low Tier 1
  p('Praneeth', 75, 'low1'),
  p('Raj', 73, 'low1'),
  p('Kaka', 73, 'low1'),
  p('Srikanth', 73, 'low1'),
  p('Vishnu', 70, 'low1'),
  // Upper Tier 2
  p('Ram', 67, 'upper2'),
  p('Hari Y', 67, 'upper2'),
  p('Kishore', 64, 'upper2'),
  p('Gouri', 60, 'upper2'),
  p('Pilli', 60, 'upper2'),
  p('Lokesh', 58, 'upper2'),
  // Lower Tier 2
  p('Harry Kodati', 38, 'lower2'),
  p('Prashanti', 14, 'lower2'),
];
