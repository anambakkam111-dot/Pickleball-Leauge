import type { Team, Match, StandingRow } from '../types';

function getH2H(
  aId: string,
  bId: string,
  completed: Match[]
): { aWins: number; bWins: number; aPD: number } {
  let aWins = 0, bWins = 0, aPD = 0;
  for (const m of completed) {
    if (m.team1Id === aId && m.team2Id === bId) {
      const pd = m.team1Score! - m.team2Score!;
      aPD += pd;
      if (pd > 0) aWins++; else bWins++;
    } else if (m.team2Id === aId && m.team1Id === bId) {
      const pd = m.team2Score! - m.team1Score!;
      aPD += pd;
      if (pd > 0) aWins++; else bWins++;
    }
  }
  return { aWins, bWins, aPD };
}

function winPct(row: StandingRow): number {
  return row.played > 0 ? row.wins / row.played : 0;
}

/**
 * For a group of teams tied on win%, apply secondary tiebreakers.
 * H2H only applies when every team in the group has played every other.
 * Otherwise falls through to point differential.
 *
 * Tiebreaker order:
 * 1. Win percentage (handled before calling this)
 * 2. Head-to-head wins within group (only if complete round-robin among tied)
 * 3. Head-to-head point differential within group (same condition)
 * 4. Overall point differential
 * 5. Total points for
 * 6. Fewest points allowed
 */
function resolveGroup(group: StandingRow[], completed: Match[]): StandingRow[] {
  // Check if every pair in the group has played each other
  const allPlayedEachOther = group.every(a =>
    group.every(b => {
      if (a.team.id === b.team.id) return true;
      const { aWins, bWins } = getH2H(a.team.id, b.team.id, completed);
      return aWins + bWins > 0;
    })
  );

  const h2hWins = new Map<string, number>();
  const h2hPD = new Map<string, number>();

  if (allPlayedEachOther) {
    for (const r of group) {
      let wins = 0, pd = 0;
      for (const other of group) {
        if (other.team.id === r.team.id) continue;
        const { aWins, aPD } = getH2H(r.team.id, other.team.id, completed);
        wins += aWins;
        pd += aPD;
      }
      h2hWins.set(r.team.id, wins);
      h2hPD.set(r.team.id, pd);
    }
  }

  return [...group].sort((a, b) => {
    if (allPlayedEachOther) {
      const ha = h2hWins.get(a.team.id) ?? 0;
      const hb = h2hWins.get(b.team.id) ?? 0;
      if (ha !== hb) return hb - ha;
      const hpda = h2hPD.get(a.team.id) ?? 0;
      const hpdb = h2hPD.get(b.team.id) ?? 0;
      if (hpda !== hpdb) return hpdb - hpda;
    }
    if (a.pd !== b.pd) return b.pd - a.pd;
    if (a.pf !== b.pf) return b.pf - a.pf;
    return a.pa - b.pa; // fewer points allowed = better
  });
}

export function calculateStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const team of teams) {
    map.set(team.id, { team, rank: 0, wins: 0, losses: 0, played: 0, pf: 0, pa: 0, pd: 0 });
  }

  const completed = matches.filter(m => m.team1Score !== null && m.team2Score !== null);

  for (const m of completed) {
    const t1 = map.get(m.team1Id)!;
    const t2 = map.get(m.team2Id)!;
    const s1 = m.team1Score!, s2 = m.team2Score!;
    t1.pf += s1; t1.pa += s2; t1.played++;
    t2.pf += s2; t2.pa += s1; t2.played++;
    if (s1 > s2) { t1.wins++; t2.losses++; } else { t2.wins++; t1.losses++; }
  }

  const rows = Array.from(map.values()).map(r => ({ ...r, pd: r.pf - r.pa }));

  // Sort by win percentage, then resolve tied groups
  rows.sort((a, b) => winPct(b) - winPct(a));

  // Group by win% and apply secondary tiebreakers within each group
  const result: StandingRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && Math.abs(winPct(rows[j]) - winPct(rows[i])) < 1e-9) j++;
    const group = rows.slice(i, j);
    result.push(...(group.length === 1 ? group : resolveGroup(group, completed)));
    i = j;
  }

  result.forEach((r, idx) => { r.rank = idx + 1; });
  return result;
}
