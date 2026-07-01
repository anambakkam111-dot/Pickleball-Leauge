// Admin-only "Rating Match Entry" — records a doubles result purely to refine
// player skill ratings. This is intentionally separate from the public
// League Match/Standings flow: saving a rating match here never touches
// `teams`/`matches` in localStorage, so public pages are unaffected unless
// the same result is *also* entered as a normal league match elsewhere.

import { useMemo, useState } from 'react';
import type { PlayerRating, RatingMatch } from '../types';
import { validateScore } from '../utils/validation';
import {
  applyRatingChangesToRoster,
  computeRatingChanges,
} from '../utils/ratingAlgorithm';
import { TIERS, TIER_BADGE } from './AdminPage';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function tierLabel(tier: string): string {
  return TIERS.find(t => t.value === tier)?.label ?? tier;
}

interface SlotSelectProps {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: PlayerRating[];
}

function PlayerSlotSelect({ label, value, onChange, options }: SlotSelectProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-600 uppercase tracking-wide mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value="">Select player…</option>
        {options.map(p => (
          <option key={p.id} value={p.id}>{p.name} ({p.rating})</option>
        ))}
      </select>
    </div>
  );
}

interface Props {
  ratings: PlayerRating[];
  ratingMatches: RatingMatch[];
  onSaveRatingMatch: (match: RatingMatch, updatedRatings: PlayerRating[]) => void;
}

export default function RatingMatchEntry({ ratings, ratingMatches, onSaveRatingMatch }: Props) {
  const [teamA1, setTeamA1] = useState('');
  const [teamA2, setTeamA2] = useState('');
  const [teamB1, setTeamB1] = useState('');
  const [teamB2, setTeamB2] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [saved, setSaved] = useState(false);

  const byId = useMemo(() => new Map(ratings.map(r => [r.id, r])), [ratings]);

  const selectedIds = [teamA1, teamA2, teamB1, teamB2];
  const optionsFor = (slot: string) =>
    ratings.filter(r => r.id === slot || !selectedIds.includes(r.id));

  const allSelected = teamA1 && teamA2 && teamB1 && teamB2;
  const allDistinct = new Set(selectedIds.filter(Boolean)).size === selectedIds.filter(Boolean).length;

  const sA = Number(scoreA);
  const sB = Number(scoreB);
  const scoreEntered = scoreA !== '' && scoreB !== '';
  const scoreError = scoreEntered ? validateScore(sA, sB) : null;

  const preview = useMemo(() => {
    if (!allSelected || !allDistinct || !scoreEntered || scoreError) return null;
    const pA1 = byId.get(teamA1), pA2 = byId.get(teamA2);
    const pB1 = byId.get(teamB1), pB2 = byId.get(teamB2);
    if (!pA1 || !pA2 || !pB1 || !pB2) return null;

    const changes = computeRatingChanges(
      [{ id: pA1.id, rating: pA1.rating }, { id: pA2.id, rating: pA2.rating }],
      [{ id: pB1.id, rating: pB1.rating }, { id: pB2.id, rating: pB2.rating }],
      sA,
      sB
    );

    // Recalculate tiers across the whole roster as if this match were saved,
    // so the preview shows accurate tier movement (not just rating movement).
    const rosterAfter = applyRatingChangesToRoster(ratings, changes);
    const tierAfterById = new Map(rosterAfter.map(r => [r.id, r.tier]));

    const winnerTeam: 'A' | 'B' = sA > sB ? 'A' : 'B';

    return {
      changes,
      winnerTeam,
      rows: changes.map(c => {
        const player = byId.get(c.id)!;
        return {
          ...c,
          name: player.name,
          oldTier: player.tier,
          newTier: tierAfterById.get(c.id) ?? player.tier,
        };
      }),
    };
  }, [allSelected, allDistinct, scoreEntered, scoreError, byId, teamA1, teamA2, teamB1, teamB2, sA, sB, ratings]);

  const handleSave = () => {
    if (!preview) return;
    const updatedRatings = applyRatingChangesToRoster(ratings, preview.changes);

    const preMatchRatings: Record<string, number> = {};
    const ratingChanges: Record<string, number> = {};
    const postMatchRatings: Record<string, number> = {};
    for (const c of preview.changes) {
      preMatchRatings[c.id] = c.oldRating;
      ratingChanges[c.id] = c.change;
      postMatchRatings[c.id] = c.newRating;
    }

    const match: RatingMatch = {
      id: crypto.randomUUID(),
      date,
      teamAPlayerIds: [teamA1, teamA2],
      teamBPlayerIds: [teamB1, teamB2],
      teamAScore: sA,
      teamBScore: sB,
      winnerTeam: preview.winnerTeam,
      preMatchRatings,
      ratingChanges,
      postMatchRatings,
      createdAt: new Date().toISOString(),
    };

    onSaveRatingMatch(match, updatedRatings);

    setTeamA1(''); setTeamA2(''); setTeamB1(''); setTeamB2('');
    setScoreA(''); setScoreB('');
    setDate(todayISODate());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (ratings.length < 4) {
    return (
      <div className="text-center py-8 text-stone-600 text-sm">
        Need at least 4 rated players to record a rating match.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm">Rating Match Entry</h2>
        <p className="text-stone-600 text-xs mt-1 leading-relaxed">
          Records a doubles result and adjusts the two teams' player ratings. This is
          separate from the public schedule/standings — it never touches league data.
          Ratings move based on how surprising the result was (via team-average win
          probability), split unevenly between teammates, with the stronger player on a
          losing team partially protected if their partner was much weaker.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Team A</p>
            <PlayerSlotSelect label="Player A1" value={teamA1} onChange={setTeamA1} options={optionsFor(teamA1)} />
            <PlayerSlotSelect label="Player A2" value={teamA2} onChange={setTeamA2} options={optionsFor(teamA2)} />
            <input
              type="number"
              placeholder="Team A score"
              value={scoreA}
              onChange={e => setScoreA(e.target.value)}
              className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest">Team B</p>
            <PlayerSlotSelect label="Player B1" value={teamB1} onChange={setTeamB1} options={optionsFor(teamB1)} />
            <PlayerSlotSelect label="Player B2" value={teamB2} onChange={setTeamB2} options={optionsFor(teamB2)} />
            <input
              type="number"
              placeholder="Team B score"
              value={scoreB}
              onChange={e => setScoreB(e.target.value)}
              className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-600 uppercase tracking-wide mb-1">Date played</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {!allDistinct && selectedIds.filter(Boolean).length > 0 && (
          <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
            Each player can only be selected once.
          </p>
        )}
        {scoreError && (
          <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{scoreError}</p>
        )}

        {preview && (
          <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
            <p className="text-xs font-black text-stone-600 uppercase tracking-widest">
              Preview — Team {preview.winnerTeam} wins
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-500 uppercase tracking-wide">
                    <th className="py-1 pr-2">Player</th>
                    <th className="py-1 px-2 text-center">Old</th>
                    <th className="py-1 px-2 text-center">Change</th>
                    <th className="py-1 px-2 text-center">New</th>
                    <th className="py-1 pl-2">Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {preview.rows.map(row => (
                    <tr key={row.id}>
                      <td className="py-1.5 pr-2 font-bold text-amber-900">{row.name}</td>
                      <td className="py-1.5 px-2 text-center text-stone-700">{row.oldRating}</td>
                      <td className={`py-1.5 px-2 text-center font-black ${row.change >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {row.change >= 0 ? '+' : ''}{row.change}
                      </td>
                      <td className="py-1.5 px-2 text-center font-bold text-amber-900">{row.newRating}</td>
                      <td className="py-1.5 pl-2">
                        {row.newTier !== row.oldTier ? (
                          <span className="text-xs">
                            <span className={`px-1.5 py-0.5 rounded-full ${TIER_BADGE[row.oldTier]} line-through opacity-60`}>
                              {tierLabel(row.oldTier)}
                            </span>
                            {' → '}
                            <span className={`px-1.5 py-0.5 rounded-full ${TIER_BADGE[row.newTier]}`}>
                              {tierLabel(row.newTier)}
                            </span>
                          </span>
                        ) : (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${TIER_BADGE[row.newTier]}`}>
                            {tierLabel(row.newTier)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!preview}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-amber-950 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-colors disabled:opacity-50 shadow-md"
        >
          Save Rating Match
        </button>
        {saved && (
          <p className="text-green-700 text-sm text-center font-bold">Rating match saved — ratings and tiers updated.</p>
        )}
      </div>

      <RatingMatchHistoryList ratingMatches={ratingMatches} byId={byId} />
    </div>
  );
}

// ─── History ────────────────────────────────────────────────────────────────

function RatingMatchHistoryList({
  ratingMatches,
  byId,
}: {
  ratingMatches: RatingMatch[];
  byId: Map<string, PlayerRating>;
}) {
  const nameOf = (id: string) => byId.get(id)?.name ?? 'Deleted player';
  const sorted = [...ratingMatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6 text-stone-500 text-sm">
        No rating matches recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-black text-amber-900 uppercase tracking-wider text-sm">Rating Match History</h3>
      <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-lg shadow-amber-900/10 divide-y divide-amber-100 overflow-hidden">
        {sorted.map(m => (
          <div key={m.id} className="px-4 py-3 text-sm">
            <div className="flex justify-between items-baseline">
              <p className="font-bold text-amber-900">
                {nameOf(m.teamAPlayerIds[0])} / {nameOf(m.teamAPlayerIds[1])}
                <span className="text-stone-400 mx-1.5">vs</span>
                {nameOf(m.teamBPlayerIds[0])} / {nameOf(m.teamBPlayerIds[1])}
              </p>
              <p className="text-xs text-stone-500">{m.date}</p>
            </div>
            <p className="text-stone-600 text-xs mt-0.5">
              {m.teamAScore}–{m.teamBScore} · Team {m.winnerTeam} won
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs">
              {[...m.teamAPlayerIds, ...m.teamBPlayerIds].map(id => {
                const change = m.ratingChanges[id];
                return (
                  <span key={id} className="text-stone-600">
                    {nameOf(id)}{' '}
                    <span className={change >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                      {change >= 0 ? '+' : ''}{change}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
