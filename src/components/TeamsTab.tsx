import { useState } from 'react';
import type { Team, PlayerRating } from '../types';
import { generateBalancedPairs, pairsToTeams } from '../utils/teamGen';
import type { GeneratedPair } from '../utils/teamGen';

// ─── Team Builder sub-section ─────────────────────────────────────────────────

// Pairs all ratings; drops the lowest-rated player if the count is odd.
// Ratings are used internally only — never shown in the output cards.
function buildPairs(players: PlayerRating[], off: number): GeneratedPair[] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const pool = sorted.length % 2 !== 0 ? sorted.slice(0, sorted.length - 1) : sorted;
  if (pool.length < 2) return [];
  return generateBalancedPairs(pool, off);
}

interface BuilderProps {
  ratings: PlayerRating[];
  onSave: (teams: Team[]) => void;
  onCancel: () => void;
}

function TeamBuilder({ ratings, onSave, onCancel }: BuilderProps) {
  const [offset, setOffset] = useState(0);
  const [pairs, setPairs] = useState<GeneratedPair[]>(() => buildPairs(ratings, 0));
  const [swapSrc, setSwapSrc] = useState<{ pairIdx: number; slot: 'p1' | 'p2' } | null>(null);

  const handleRegenerate = () => {
    const half = Math.max(1, Math.floor(ratings.length / 2));
    const next = (offset + 1) % half;
    setOffset(next);
    setPairs(buildPairs(ratings, next));
    setSwapSrc(null);
  };

  // Click a player slot to enter swap mode; click another to swap
  const handlePlayerClick = (pairIdx: number, slot: 'p1' | 'p2') => {
    if (!swapSrc) { setSwapSrc({ pairIdx, slot }); return; }
    if (swapSrc.pairIdx === pairIdx && swapSrc.slot === slot) { setSwapSrc(null); return; }
    const newPairs = pairs.map(p => ({ ...p }));
    const srcPlayer = newPairs[swapSrc.pairIdx][swapSrc.slot];
    const dstPlayer = newPairs[pairIdx][slot];
    newPairs[swapSrc.pairIdx][swapSrc.slot] = dstPlayer;
    newPairs[pairIdx][slot] = srcPlayer;
    newPairs.forEach(pair => { pair.combinedRating = pair.p1.rating + pair.p2.rating; });
    setPairs(newPairs);
    setSwapSrc(null);
  };

  const isSwapSrc = (pairIdx: number, slot: 'p1' | 'p2') =>
    swapSrc?.pairIdx === pairIdx && swapSrc?.slot === slot;

  if (pairs.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-stone-700">Not enough players in the ratings pool to generate teams.</p>
        <button onClick={onCancel} className="text-sm text-stone-600 hover:text-stone-900 underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-amber-900 uppercase tracking-wide text-sm">Generated Teams</h3>
          <p className="text-stone-600 text-xs mt-0.5">{pairs.length} teams · {ratings.length} players</p>
        </div>
        <button onClick={onCancel} className="text-stone-600 hover:text-stone-900 text-sm font-medium">Cancel</button>
      </div>

      {swapSrc !== null && (
        <p className="text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 text-sm">
          Tap another player to swap — or tap the same player to deselect.
        </p>
      )}

      <div className="space-y-2.5">
        {pairs.map((pair, pairIdx) => (
          <div key={pairIdx} className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm shadow-amber-900/8 overflow-hidden">
            <div className="bg-amber-200/60 px-4 py-1.5 border-b border-amber-200">
              <span className="text-amber-800 text-xs font-bold uppercase tracking-widest">Team {pairIdx + 1}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-amber-200">
              {(['p1', 'p2'] as const).map(slot => {
                const player = pair[slot];
                const isSrc = isSwapSrc(pairIdx, slot);
                return (
                  <button
                    key={slot}
                    onClick={() => handlePlayerClick(pairIdx, slot)}
                    className={`px-4 py-3.5 text-left transition-colors ${isSrc ? 'bg-yellow-100' : 'hover:bg-amber-100'}`}
                  >
                    <p className={`font-bold text-sm ${isSrc ? 'text-yellow-800' : 'text-amber-900'}`}>
                      {player.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-600 text-center">Tap any player to swap them with another player.</p>

      <div className="flex gap-3">
        <button
          onClick={handleRegenerate}
          className="flex-1 border-2 border-amber-300 text-amber-800 py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-100 transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={() => onSave(pairsToTeams(pairs))}
          className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-50 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors shadow-md shadow-amber-900/20"
        >
          Save Teams
        </button>
      </div>
    </div>
  );
}

// ─── Main TeamsTab ─────────────────────────────────────────────────────────────

interface Props {
  teams: Team[];
  ratings: PlayerRating[];
  hasMatches: boolean;
  onAddTeam: (team: Team) => void;
  onRemoveTeam: (id: string) => void;
  onSaveGeneratedTeams: (teams: Team[]) => boolean;
  onGenerateSchedule: (gamesPerTeam: number) => void;
  onReset: () => void;
}

export default function TeamsTab({
  teams, ratings, hasMatches, onAddTeam, onRemoveTeam,
  onSaveGeneratedTeams, onGenerateSchedule, onReset,
}: Props) {
  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState('');
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [formError, setFormError] = useState('');
  const [gamesPerTeam, setGamesPerTeam] = useState(() => Math.max(1, teams.length - 1));

  const maxGames = Math.max(1, teams.length - 1);
  const effectiveGames = Math.max(1, Math.min(gamesPerTeam, maxGames));
  const scheduledMatches = Math.floor((teams.length * effectiveGames) / 2);

  const handleAdd = () => {
    if (!name.trim() || !player1.trim() || !player2.trim()) {
      setFormError('All three fields are required');
      return;
    }
    if (teams.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      setFormError('A team with that name already exists');
      return;
    }
    onAddTeam({ id: crypto.randomUUID(), name: name.trim(), player1: player1.trim(), player2: player2.trim() });
    setName(''); setPlayer1(''); setPlayer2(''); setFormError('');
  };

  const handleSaveGenerated = (newTeams: Team[]) => {
    const saved = onSaveGeneratedTeams(newTeams);
    if (saved) setShowBuilder(false);
  };

  if (showBuilder) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-md shadow-amber-900/10 p-5">
        <TeamBuilder
          ratings={ratings}
          onSave={handleSaveGenerated}
          onCancel={() => setShowBuilder(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Auto-balance entry — dark wood panel */}
      {!hasMatches && ratings.length >= 2 && (
        <div className="bg-amber-950 rounded-2xl p-5 shadow-xl border border-amber-900 card-texture">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.2em] font-bold mb-1">Auto-Balance</p>
          <p className="text-amber-100 font-black text-lg mb-1 uppercase tracking-wide">Generate Fair Teams</p>
          <p className="text-amber-500 text-sm mb-4">
            Automatically create balanced doubles teams from the player pool.
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            className="bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-amber-950 font-black px-5 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors shadow-md"
          >
            Generate Teams
          </button>
        </div>
      )}

      {/* Manual add form — cream card */}
      {!hasMatches && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-md shadow-amber-900/10 p-5">
          <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm mb-4">Add Team Manually</h2>
          <div className="space-y-3">
            <input
              className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Team name (e.g. Court Kings)"
              value={name}
              onChange={e => { setName(e.target.value); setFormError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border border-amber-300 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Player 1"
                value={player1}
                onChange={e => { setPlayer1(e.target.value); setFormError(''); }}
              />
              <input
                className="border border-amber-300 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="Player 2"
                value={player2}
                onChange={e => { setPlayer2(e.target.value); setFormError(''); }}
              />
            </div>
            {formError && <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{formError}</p>}
            <button
              onClick={handleAdd}
              className="w-full bg-amber-800 hover:bg-amber-700 text-amber-50 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors shadow-sm"
            >
              Add Team
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      {teams.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm">
              {teams.length} Team{teams.length !== 1 ? 's' : ''}
            </h2>
            {hasMatches && (
              <span className="text-xs text-yellow-800 bg-yellow-100 border border-yellow-300 px-2.5 py-1 rounded-full font-semibold">
                Schedule locked
              </span>
            )}
          </div>
          <div className="space-y-2">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm shadow-amber-900/8 px-4 py-3.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-amber-900 text-sm">{team.name}</p>
                  <p className="text-stone-600 text-xs mt-0.5">{team.player1} &amp; {team.player2}</p>
                </div>
                {!hasMatches && (
                  <button
                    onClick={() => onRemoveTeam(team.id)}
                    className="text-amber-300 hover:text-red-500 transition-colors p-1 rounded-lg"
                    aria-label={`Remove ${team.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-14">
          <p className="text-4xl mb-3">🏓</p>
          <p className="font-bold text-stone-900">No teams yet</p>
          <p className="text-stone-700 text-sm mt-1">Use Generate Teams above, or add teams manually.</p>
        </div>
      )}

      {!hasMatches && teams.length >= 2 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-md shadow-amber-900/10 p-5 space-y-4">
          <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm">Schedule Options</h2>

          {/* Games-per-team stepper */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-stone-700 text-sm font-semibold">Games per team</span>
            <div className="flex items-center border-2 border-amber-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setGamesPerTeam(g => Math.max(1, Math.min(g, maxGames) - 1))}
                disabled={effectiveGames <= 1}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 font-black text-base leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="px-4 py-1.5 font-black text-amber-900 text-lg min-w-[2.5rem] text-center tabular-nums bg-white">
                {effectiveGames}
              </span>
              <button
                onClick={() => setGamesPerTeam(g => Math.min(maxGames, Math.max(1, Math.min(g, maxGames)) + 1))}
                disabled={effectiveGames >= maxGames}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-900 font-black text-base leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            <span className="text-stone-500 text-sm">{maxGames} max</span>
          </div>

          <p className="text-stone-500 text-xs">
            {scheduledMatches} total match{scheduledMatches !== 1 ? 'es' : ''}
            {effectiveGames === maxGames
              ? ' · full round-robin (every team plays every other team once)'
              : ` · each team plays ${effectiveGames} game${effectiveGames !== 1 ? 's' : ''}`}
          </p>

          <button
            onClick={() => onGenerateSchedule(effectiveGames)}
            className="w-full bg-green-800 hover:bg-green-700 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-colors shadow-lg shadow-green-900/20"
          >
            Generate Schedule
          </button>
        </div>
      )}

      {(teams.length > 0 || hasMatches) && (
        <button
          onClick={onReset}
          className="w-full border-2 border-red-200 text-red-600 py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors font-semibold"
        >
          Reset League
        </button>
      )}
    </div>
  );
}
