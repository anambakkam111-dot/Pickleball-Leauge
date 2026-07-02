import type { Team, Match } from '../types';
import { calculateStandings } from '../utils/standings';
import { standingsToCSV, downloadCSV } from '../utils/csv';

interface Props {
  teams: Team[];
  matches: Match[];
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function StandingsTab({ teams, matches }: Props) {
  if (teams.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-bold text-stone-100">No teams yet</p>
        <p className="text-stone-400 text-sm mt-1">Add teams to see standings</p>
      </div>
    );
  }

  const standings = calculateStandings(teams, matches);
  const anyPlayed = standings.some(r => r.played > 0);

  const handleExport = () => {
    downloadCSV(standingsToCSV(standings), 'pickleball-standings.csv');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">League Standings</h2>
        <button
          onClick={handleExport}
          className="text-xs text-stone-300 border-2 border-stone-600 px-3 py-1.5 rounded-xl hover:bg-stone-800 transition-colors font-bold uppercase tracking-wide"
        >
          Export CSV
        </button>
      </div>

      {/* Tournament scoreboard */}
      <div className="bg-stone-800 rounded-2xl border border-stone-700 shadow-lg shadow-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-900 text-stone-300">
                <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest">#</th>
                <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-widest">Team</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest">W</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest">L</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest hidden sm:table-cell">GP</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest hidden sm:table-cell">PF</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest hidden sm:table-cell">PA</th>
                <th className="text-center px-3 py-3 font-black text-xs uppercase tracking-widest">+/–</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-700">
              {standings.map((row, i) => (
                <tr
                  key={row.team.id}
                  className={`transition-colors ${
                    i === 0 && anyPlayed
                      ? 'bg-yellow-950/20'
                      : i % 2 === 0
                      ? 'bg-stone-800'
                      : 'bg-stone-900/40'
                  } hover:bg-stone-700/40`}
                >
                  <td className="px-4 py-3 font-black text-stone-500 text-sm w-10">
                    {anyPlayed && i < 3 ? MEDALS[i] : row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-black text-stone-100">{row.team.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{row.team.player1} &amp; {row.team.player2}</p>
                  </td>
                  <td className="px-3 py-3 text-center font-black text-yellow-400 text-base">{row.wins}</td>
                  <td className="px-3 py-3 text-center text-stone-400 font-semibold">{row.losses}</td>
                  <td className="px-3 py-3 text-center text-stone-400 hidden sm:table-cell">{row.played}</td>
                  <td className="px-3 py-3 text-center text-stone-400 hidden sm:table-cell">{row.pf}</td>
                  <td className="px-3 py-3 text-center text-stone-400 hidden sm:table-cell">{row.pa}</td>
                  <td className={`px-3 py-3 text-center font-black tabular-nums ${
                    row.pd > 0 ? 'text-emerald-400' : row.pd < 0 ? 'text-stone-500' : 'text-stone-500'
                  }`}>
                    {row.pd > 0 ? '+' : ''}{row.pd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-500 px-1 leading-relaxed">
        Tiebreakers: win% → H2H record (if all tied teams have played each other) → H2H point diff → overall point diff → points for → fewest points allowed
      </p>
    </div>
  );
}
