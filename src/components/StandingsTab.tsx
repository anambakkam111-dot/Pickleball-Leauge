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
        <p className="font-bold text-stone-900">No teams yet</p>
        <p className="text-stone-700 text-sm mt-1">Add teams to see standings</p>
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
        <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm">League Standings</h2>
        <button
          onClick={handleExport}
          className="text-xs text-amber-800 border-2 border-amber-300 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-colors font-bold uppercase tracking-wide"
        >
          Export CSV
        </button>
      </div>

      {/* Tournament scoreboard */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-lg shadow-amber-900/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-900 text-amber-100">
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
            <tbody className="divide-y divide-amber-100">
              {standings.map((row, i) => (
                <tr
                  key={row.team.id}
                  className={`transition-colors ${
                    i === 0 && anyPlayed
                      ? 'bg-yellow-50'
                      : i % 2 === 0
                      ? 'bg-white'
                      : 'bg-amber-50/60'
                  } hover:bg-amber-100/50`}
                >
                  <td className="px-4 py-3 font-black text-stone-500 text-sm w-10">
                    {anyPlayed && i < 3 ? MEDALS[i] : row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-black text-amber-900">{row.team.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{row.team.player1} &amp; {row.team.player2}</p>
                  </td>
                  <td className="px-3 py-3 text-center font-black text-green-700 text-base">{row.wins}</td>
                  <td className="px-3 py-3 text-center text-stone-600 font-semibold">{row.losses}</td>
                  <td className="px-3 py-3 text-center text-stone-600 hidden sm:table-cell">{row.played}</td>
                  <td className="px-3 py-3 text-center text-stone-600 hidden sm:table-cell">{row.pf}</td>
                  <td className="px-3 py-3 text-center text-stone-600 hidden sm:table-cell">{row.pa}</td>
                  <td className={`px-3 py-3 text-center font-black tabular-nums ${
                    row.pd > 0 ? 'text-green-700' : row.pd < 0 ? 'text-red-600' : 'text-stone-400'
                  }`}>
                    {row.pd > 0 ? '+' : ''}{row.pd}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-700 px-1 leading-relaxed">
        Tiebreakers: win% → H2H record (if all tied teams have played each other) → H2H point diff → overall point diff → points for → fewest points allowed
      </p>
    </div>
  );
}
