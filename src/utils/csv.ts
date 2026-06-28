import type { Team, Match, StandingRow } from '../types';

function row(...cells: (string | number)[]): string {
  return cells.map(c => `"${c}"`).join(',');
}

export function matchesToCSV(teams: Team[], matches: Match[]): string {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const completed = matches
    .filter(m => m.team1Score !== null && m.team2Score !== null)
    .sort((a, b) => (a.playedAt ?? '').localeCompare(b.playedAt ?? ''));

  const header = row('Date', 'Team 1', 'Players 1', 'Score 1', 'Score 2', 'Players 2', 'Team 2', 'Winner');
  const rows = completed.map(m => {
    const t1 = teamMap.get(m.team1Id)!;
    const t2 = teamMap.get(m.team2Id)!;
    const winner = m.team1Score! > m.team2Score! ? t1.name : t2.name;
    return row(
      m.playedAt ? new Date(m.playedAt).toLocaleDateString() : '',
      t1.name,
      `${t1.player1} & ${t1.player2}`,
      m.team1Score!,
      m.team2Score!,
      `${t2.player1} & ${t2.player2}`,
      t2.name,
      winner
    );
  });

  return [header, ...rows].join('\n');
}

export function standingsToCSV(standings: StandingRow[]): string {
  const header = row('Rank', 'Team', 'Player 1', 'Player 2', 'W', 'L', 'Played', 'PF', 'PA', 'PD');
  const rows = standings.map(s =>
    row(s.rank, s.team.name, s.team.player1, s.team.player2, s.wins, s.losses, s.played, s.pf, s.pa, s.pd)
  );
  return [header, ...rows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
