import type { PlayerRating, PlayerTier, Team } from '../types';

export interface GeneratedPair {
  p1: PlayerRating;
  p2: PlayerRating;
  combinedRating: number;
}

// Tier ranking: high1 is strongest, lower2 is weakest
const TIER_ORDER: Record<PlayerTier, number> = {
  high1: 1, mid1: 2, low1: 3, upper2: 4, mid2: 5, lower2: 6,
};

/**
 * Snake-draft balanced pairing.
 *
 * Players are sorted by tier (high1 → lower2), then shuffled randomly
 * within each tier so that same-tier players are treated as interchangeable.
 * This produces genuinely different pairings on every call while preserving
 * tier-level balance.
 *
 * `offset` rotates the bottom half to add further variation on Regenerate.
 *
 * Example result (8 players, 2 per tier, offset=0):
 *   high1-A + lower2-B,  high1-B + lower2-A,  mid1-A + mid2-B,  mid1-B + mid2-A
 *   (within-tier A/B assignment is random each call)
 */
export function generateBalancedPairs(players: PlayerRating[], offset = 0): GeneratedPair[] {
  if (players.length % 2 !== 0) {
    throw new Error('Need an even number of players');
  }

  // Sort by tier order
  const tierSorted = [...players].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
  );

  // Shuffle within each tier (Fisher-Yates on contiguous same-tier groups)
  let i = 0;
  while (i < tierSorted.length) {
    const tier = tierSorted[i].tier;
    let j = i + 1;
    while (j < tierSorted.length && tierSorted[j].tier === tier) j++;
    // shuffle slice [i, j)
    for (let k = j - 1; k > i; k--) {
      const m = i + Math.floor(Math.random() * (k - i + 1));
      [tierSorted[k], tierSorted[m]] = [tierSorted[m], tierSorted[k]];
    }
    i = j;
  }

  const half = tierSorted.length / 2;
  const top = tierSorted.slice(0, half);
  // Reverse bottom so weakest tier pairs with strongest tier
  const bottom = tierSorted.slice(half).reverse();
  // Rotate to create additional variation on each Regenerate press
  const rotated = [
    ...bottom.slice(offset % half),
    ...bottom.slice(0, offset % half),
  ];

  return top
    .map((p1, idx) => ({ p1, p2: rotated[idx], combinedRating: p1.rating + rotated[idx].rating }))
    .sort((a, b) => b.combinedRating - a.combinedRating);
}

/** Convert GeneratedPair[] into Team[] for saving to league. Strips ratings. */
export function pairsToTeams(pairs: GeneratedPair[]): Team[] {
  return pairs.map(({ p1, p2 }) => ({
    id: crypto.randomUUID(),
    name: `${p1.name} / ${p2.name}`,
    player1: p1.name,
    player2: p2.name,
  }));
}
