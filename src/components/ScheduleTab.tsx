import { useState } from 'react';
import type { Team, Match } from '../types';
import { validateScore } from '../utils/validation';

interface Props {
  teams: Team[];
  matches: Match[];
  onClearScore: (matchId: string) => void;
  onUpdateMatch: (
    matchId: string,
    patch: { team1Id: string; team2Id: string; team1Score: number | null; team2Score: number | null; playedAt: string | null }
  ) => void;
  onDeleteMatch: (matchId: string) => void;
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

function toDateInputValue(iso: string | null): string {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10);
}

interface EditState {
  s1: string;
  s2: string;
  team1Id: string;
  team2Id: string;
  date: string;
}

export default function ScheduleTab({ teams, matches, onClearScore, onUpdateMatch, onDeleteMatch }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputs, setInputs] = useState<EditState>({ s1: '', s2: '', team1Id: '', team2Id: '', date: '' });
  const [scoreError, setScoreError] = useState('');

  if (matches.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="text-4xl mb-3">📋</p>
        <p className="font-bold text-stone-100">No schedule yet</p>
        <p className="text-stone-400 text-sm mt-1">Add teams and generate a schedule on the Teams tab.</p>
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
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      date: toDateInputValue(match.playedAt),
    });
    setScoreError('');
  };

  const handleSave = (match: Match) => {
    if (inputs.team1Id === inputs.team2Id) { setScoreError('Team 1 and Team 2 must be different'); return; }

    const scoreEntered = inputs.s1 !== '' || inputs.s2 !== '';
    let team1Score: number | null = match.team1Score;
    let team2Score: number | null = match.team2Score;
    let playedAt = match.playedAt;

    if (scoreEntered) {
      const s1 = parseInt(inputs.s1, 10);
      const s2 = parseInt(inputs.s2, 10);
      const err = validateScore(s1, s2);
      if (err) { setScoreError(err); return; }
      team1Score = s1;
      team2Score = s2;
      // Append a midday local time so the ISO string round-trips to the same
      // calendar date in toLocaleDateString(), regardless of timezone offset.
      playedAt = new Date(`${inputs.date}T12:00:00`).toISOString();
    }

    onUpdateMatch(match.id, { team1Id: inputs.team1Id, team2Id: inputs.team2Id, team1Score, team2Score, playedAt });
    setExpandedId(null);
  };

  const handleDelete = (match: Match) => {
    if (!window.confirm('Delete this match from the schedule? This cannot be undone.')) return;
    onDeleteMatch(match.id);
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
            ? 'bg-stone-800 border-emerald-800/50 shadow-black/20'
            : 'bg-stone-800 border-stone-700 shadow-black/20'
        }`}
      >
        <button
          className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-stone-700/40 transition-colors"
          onClick={() => handleExpand(match)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`text-sm font-black ${t1Won ? 'text-yellow-400' : 'text-stone-100'}`}>
                {t1.name}
              </span>
              <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">vs</span>
              <span className={`text-sm font-black ${played && !t1Won ? 'text-yellow-400' : 'text-stone-100'}`}>
                {t2.name}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {t1.player1} &amp; {t1.player2} · {t2.player1} &amp; {t2.player2}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            {played ? (
              <span className="font-mono text-lg font-black text-stone-100 tabular-nums">
                {match.team1Score}–{match.team2Score}
              </span>
            ) : (
              <span className="text-xs text-stone-300 bg-stone-700 border border-stone-600 px-2.5 py-1 rounded-lg font-semibold">
                Enter score
              </span>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-stone-700 px-4 py-5 bg-stone-900/60 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {(['team1Id', 'team2Id'] as const).map(key => (
                <div key={key}>
                  <label className="block text-xs font-black text-yellow-600 mb-2 uppercase tracking-widest">
                    {key === 'team1Id' ? 'Team 1' : 'Team 2'}
                  </label>
                  <select
                    value={inputs[key]}
                    onChange={e => { setInputs(p => ({ ...p, [key]: e.target.value })); setScoreError(''); }}
                    className="w-full border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {([
                { label: teamMap.get(inputs.team1Id)?.name ?? 'Team 1', key: 's1' as const },
                { label: teamMap.get(inputs.team2Id)?.name ?? 'Team 2', key: 's2' as const },
              ]).map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-black text-yellow-600 mb-2 uppercase tracking-widest">
                    {label}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="30"
                    className="w-full border-2 border-stone-600 rounded-xl px-3 py-3 text-center text-3xl font-mono font-black focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:border-transparent bg-stone-950 text-stone-100"
                    value={inputs[key]}
                    onChange={e => { setInputs(p => ({ ...p, [key]: e.target.value })); setScoreError(''); }}
                    placeholder="0"
                    autoFocus={key === 's1'}
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-black text-yellow-600 mb-2 uppercase tracking-widest">Date played</label>
              <input
                type="date"
                value={inputs.date}
                onChange={e => setInputs(p => ({ ...p, date: e.target.value }))}
                className="border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
              />
            </div>

            {scoreError && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2">
                {scoreError}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleSave(match)}
                className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-2.5 rounded-xl text-sm font-black uppercase tracking-wide transition-colors shadow-md"
              >
                Save
              </button>
              {played && (
                <button
                  onClick={() => { onClearScore(match.id); setExpandedId(null); }}
                  className="px-4 py-2.5 border-2 border-stone-600 rounded-xl text-sm text-stone-300 hover:bg-stone-700/50 transition-colors font-semibold"
                >
                  Clear Score
                </button>
              )}
              <button
                onClick={() => setExpandedId(null)}
                className="px-4 py-2.5 border-2 border-stone-600 rounded-xl text-sm text-stone-300 hover:bg-stone-700/50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(match)}
                className="px-4 py-2.5 border-2 border-red-900/50 rounded-xl text-sm text-red-400 hover:bg-red-950/40 transition-colors font-semibold"
              >
                Delete Match
              </button>
            </div>
            <p className="text-xs text-stone-500 text-center">Games to 11, win by 2 (e.g. 11–9, 12–10, 13–11...)</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Progress card */}
      <div className="bg-stone-800 border border-stone-700 rounded-2xl shadow-md shadow-black/20 p-4">
        <div className="flex justify-between text-sm mb-2.5">
          <span className="font-black text-stone-100 uppercase tracking-widest text-xs">Tournament Progress</span>
          <span className="text-stone-400 text-xs font-semibold">
            {completedCount} / {matches.length} played · {rounds.length} round{rounds.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="h-3.5 bg-stone-900 rounded-full overflow-hidden border border-stone-700">
          <div
            className="h-full bg-emerald-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {allDone && (
          <p className="text-yellow-400 text-xs font-black mt-2.5 text-center uppercase tracking-widest">
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
              <span className={`text-xs font-black uppercase tracking-[0.15em] ${roundDone ? 'text-yellow-400' : 'text-stone-200'}`}>
                Round {roundIdx + 1}
              </span>
              <div className="flex-1 h-px bg-stone-700" />
              <span className="text-xs text-stone-500 font-semibold">
                {roundMatches.filter(m => m.team1Score !== null).length}/{roundMatches.length} played
              </span>
              {roundDone && <span className="text-xs text-yellow-400 font-bold">✓</span>}
            </div>

            {/* Matches in this round */}
            {roundMatches.map(renderMatch)}
          </div>
        );
      })}
    </div>
  );
}
