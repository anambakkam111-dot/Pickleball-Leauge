import type { Team, Match } from '../types';

export function generateRoundRobin(teams: Team[]): Match[] {
  const matches: Match[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        id: crypto.randomUUID(),
        matchType: 'tournament',
        team1Id: teams[i].id,
        team2Id: teams[j].id,
        team1Score: null,
        team2Score: null,
        playedAt: null,
      });
    }
  }
  return matches;
}

// Generates a schedule where every team plays exactly `gamesPerTeam` games
// (or as close as possible). Uses randomised greedy selection across multiple
// attempts so the same input can produce different valid schedules.
export function generateCustomSchedule(teams: Team[], gamesPerTeam: number): Match[] {
  const n = Math.max(1, Math.min(gamesPerTeam, teams.length - 1));

  if (n === teams.length - 1) return generateRoundRobin(teams);

  // All unique pair IDs
  const allPairs: [string, string][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairs.push([teams[i].id, teams[j].id]);
    }
  }

  let bestPairs: [string, string][] = [];

  // Try 20 random orderings; keep whichever gives the most matches
  // (for practical league sizes this almost always finds a perfect solution)
  for (let attempt = 0; attempt < 20; attempt++) {
    // Fisher-Yates shuffle
    const pairs = [...allPairs];
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    const count = new Map(teams.map(t => [t.id, 0]));
    const selected: [string, string][] = [];

    for (const [a, b] of pairs) {
      if ((count.get(a) ?? 0) < n && (count.get(b) ?? 0) < n) {
        selected.push([a, b]);
        count.set(a, (count.get(a) ?? 0) + 1);
        count.set(b, (count.get(b) ?? 0) + 1);
      }
    }

    if (selected.length > bestPairs.length) bestPairs = selected;

    // Perfect: every team has exactly n games — stop early
    if ([...count.values()].every(c => c === n)) break;
  }

  return bestPairs.map(([id1, id2]) => ({
    id: crypto.randomUUID(),
    matchType: 'tournament' as const,
    team1Id: id1,
    team2Id: id2,
    team1Score: null,
    team2Score: null,
    playedAt: null,
  }));
}
