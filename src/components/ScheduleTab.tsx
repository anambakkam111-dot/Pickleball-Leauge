import { useState } from 'react';
import type { Team, Match } from '../types';
import { validateScore } from '../utils/validation';

interface Props {
  teams: Team[];
  matches: Match[];
  onSubmitScore: (matchId: string, s1: number, s2: number) => void;
  onClearScore: (matchId: string) => void;
}

// Groups a flat match list into simultaneous rounds.
// Each round contains matches whose teams don't overlap, so all games
// in one round can be played at the same time.
function groupIntoRounds(matches: Match[]): Match[][] {
  const rounds: Match[][] = [];
  for (const match of matches) {
    let placed = false;
    for (const round of rounds) {
      const busy = new Set(round.flatMap(m => [m.team1Id, m.team2Id]));
      if (!busy.has(match.team1Id) && !busy.has(match.team2Id)) {
        round.push(match);
        placed = true;
        break;
      }
    }
    if (!placed) rounds.push([match]);
  }
  return rounds;
}

export default function ScheduleTab({ teams, matches, onSubmitScore, onClearScore }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState({ s1: '', s2: '' });
  const [scoreError, setScoreError] = useState('');

  if (matches.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-bold text-stone-900">No schedule yet</p>
        <p className="text-stone-700 text-sm mt-1">Add teams and generate a schedule on the Teams tab.</p>
      </div>
    );
  }

  const teamMap = new Map(teams.map(t => [t.id, t]));
  const completedCount = matches.filter(m => m.team1Score !== null).length;
  const progress = Math.round((completedCount / matches.length) * 100);
  const allDone = completedCount === matches.length;
  const rounds = groupIntoRounds(matches);

  const handleExpand = (match: Match) => {
    if (expandedId === match.id) { setExpandedId(null); return; }
    setExpandedId(match.id);
    setInputs({
      s1: match.team1Score !== null ? String(match.team1Score) : '',
      s2: match.team2Score !== null ? String(match.team2Score) : '',
    });
    setScoreError('');
  };

  const handleSave = (match: Match) => {
    const s1 = parseInt(inputs.s1, 10);
    const s2 = parseInt(inputs.s2, 10);
    const err = validateScore(s1, s2);
    if (err) { setScoreError(err); return; }
    onSubmitScore(match.id, s1, s2);
    setExpandedId(null);
  };

  const renderMatch = (match: Match) => {
    const t1 = teamMap.get(match.team1Id);
    const t2 = teamMap.get(match.team2Id);
    if (!t1 || !t2) return null;
    const isExpanded = expandedId === match.id;
    const played = match.team1Score !== null;
    const t1Won = played && match.team1Score! > match.team2Score!;

    return (
      <div
        key={match.id}
        className={`rounded-2xl border shadow-sm overflow-hidden ${
          played
            ? 'bg-white border-green-300 shadow-green-900/6'
            : 'bg-amber-50 border-amber-200 shadow-amber-900/8'
        }`}
      >
        <button
          className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-amber-100/60 transition-colors"
          onClick={() => handleExpand(match)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-sm font-black ${t1Won ? 'text-green-700' : 'text-amber-900'}`}>
                {t1.name}
              </span>
              <span className="text-stone-400 text-xs font-bold uppercase tracking-wider">vs</span>
              <span className={`text-sm font-black ${played && !t1Won ? 'text-green-700' : 'text-amber-900'}`}>
                {t2.name}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {t1.player1} &amp; {t1.player2} · {t2.player1} &amp; {t2.player2}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            {played ? (
              <span className="font-mono text-lg font-black text-amber-900 tabular-nums">
                {match.team1Score}–{match.team2Score}
              </span>
            ) : (
              <span className="text-xs text-stone-700 bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg font-semibold">
                Enter score
              </span>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-amber-200 px-4 py-5 bg-amber-100/50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: t1.name, key: 's1' as const },
                { label: t2.name, key: 's2' as const },
              ]).map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-black text-amber-800 mb-2 uppercase tracking-widest">
                    {label}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="30"
                    className="w-full border-2 border-amber-300 rounded-xl px-3 py-3 text-center text-3xl font-mono font-black focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white text-amber-900"
                    value={inputs[key]}
                    onChange={e => { setInputs(p => ({ ...p, [key]: e.target.value })); setScoreError(''); }}
                    placeholder="0"
                    autoFocus={key === 's1'}
                  />
                </div>
              ))}
            </div>

            {scoreError && (
              <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {scoreError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleSave(match)}
                className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-50 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-colors shadow-md"
              >
                Save Score
              </button>
              {played && (
                <button
                  onClick={() => { onClearScore(match.id); setExpandedId(null); }}
                  className="px-4 py-2.5 border-2 border-amber-300 rounded-xl text-sm text-stone-700 hover:bg-amber-100 transition-colors font-semibold"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setExpandedId(null)}
                className="px-4 py-2.5 border-2 border-amber-300 rounded-xl text-sm text-stone-700 hover:bg-amber-100 transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-stone-600 text-center">Games to 11, win by 2 (e.g. 11–9, 12–10, 13–11...)</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Progress card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-md shadow-amber-900/10 p-4">
        <div className="flex justify-between text-sm mb-2.5">
          <span className="font-black text-amber-900 uppercase tracking-widest text-xs">Tournament Progress</span>
          <span className="text-stone-600 text-xs font-semibold">
            {completedCount} / {matches.length} played · {rounds.length} round{rounds.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="h-3.5 bg-amber-200 rounded-full overflow-hidden border border-amber-300">
          <div
            className="h-full bg-green-700 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {allDone && (
          <p className="text-green-700 text-xs font-black mt-2.5 text-center uppercase tracking-widest">
            🏆 All Matches Complete!
          </p>
        )}
      </div>

      {/* Rounds */}
      {rounds.map((roundMatches, roundIdx) => {
        const roundDone = roundMatches.every(m => m.team1Score !== null);
        return (
          <div key={roundIdx} className="space-y-2.5">
            {/* Round header */}
            <div className="flex items-center gap-3 px-0.5 pt-1">
              <span className={`text-xs font-black uppercase tracking-[0.15em] ${roundDone ? 'text-green-700' : 'text-stone-900'}`}>
                Round {roundIdx + 1}
              </span>
              <div className="flex-1 h-px bg-amber-300" />
              <span className="text-xs text-stone-500 font-semibold">
                {roundMatches.filter(m => m.team1Score !== null).length}/{roundMatches.length} played
              </span>
              {roundDone && <span className="text-xs text-green-700 font-bold">✓</span>}
            </div>

            {/* Matches in this round */}
            {roundMatches.map(renderMatch)}
          </div>
        );
      })}
    </div>
  );
}
