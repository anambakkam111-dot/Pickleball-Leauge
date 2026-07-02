import type { Team, Match } from '../types';
import { matchesToCSV, downloadCSV } from '../utils/csv';

interface Props {
  teams: Team[];
  matches: Match[];
  onNavigateToSchedule: () => void;
  onDeleteMatch: (matchId: string) => void;
}

export default function HistoryTab({ teams, matches, onNavigateToSchedule, onDeleteMatch }: Props) {
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const completed = matches
    .filter(m => m.team1Score !== null && m.team2Score !== null)
    .slice()
    .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''));

  if (completed.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="text-4xl mb-3">📜</p>
        <p className="font-bold text-stone-100">No completed matches</p>
        <p className="text-stone-400 text-sm mt-1">Enter scores on the Schedule tab</p>
      </div>
    );
  }

  const handleExport = () => {
    downloadCSV(matchesToCSV(teams, matches), 'pickleball-match-history.csv');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">
          {completed.length} Match{completed.length !== 1 ? 'es' : ''} Played
        </h2>
        <button
          onClick={handleExport}
          className="text-xs text-stone-300 border-2 border-stone-600 px-3 py-1.5 rounded-xl hover:bg-stone-800 transition-colors font-bold uppercase tracking-wide"
        >
          Export CSV
        </button>
      </div>

      <div className="space-y-2.5">
        {completed.map(match => {
          const t1 = teamMap.get(match.team1Id);
          const t2 = teamMap.get(match.team2Id);
          if (!t1 || !t2) return null;
          const t1Won = match.team1Score! > match.team2Score!;

          return (
            <div key={match.id} className="bg-stone-800 rounded-2xl border border-stone-700 shadow-sm shadow-black/20 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-black ${t1Won ? 'text-yellow-400' : 'text-stone-500'}`}>
                      {t1.name}
                    </span>
                    <span className="font-mono text-lg font-black text-stone-100 tabular-nums flex-shrink-0">
                      {match.team1Score}–{match.team2Score}
                    </span>
                    <span className={`text-sm font-black ${!t1Won ? 'text-yellow-400' : 'text-stone-500'}`}>
                      {t2.name}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {t1.player1} &amp; {t1.player2} vs {t2.player1} &amp; {t2.player2}
                  </p>
                </div>
                {match.playedAt && (
                  <time className="text-xs text-stone-500 flex-shrink-0 font-semibold">
                    {new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </time>
                )}
              </div>
              <div className="flex gap-3 mt-2 pt-2 border-t border-stone-700">
                <button onClick={onNavigateToSchedule} className="text-xs text-stone-300 hover:text-stone-100 font-semibold">
                  Edit
                </button>
                <button
                  onClick={() => { if (window.confirm('Delete this match? This cannot be undone.')) onDeleteMatch(match.id); }}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
