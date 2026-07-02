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
        <p className="text-stone-300">Not enough players in the ratings pool to generate teams.</p>
        <button onClick={onCancel} className="text-sm text-stone-400 hover:text-stone-100 underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-stone-100 uppercase tracking-wide text-sm">Generated Teams</h3>
          <p className="text-stone-400 text-xs mt-0.5">{pairs.length} teams · {ratings.length} players</p>
        </div>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-100 text-sm font-medium">Cancel</button>
      </div>

      {swapSrc !== null && (
        <p className="text-yellow-500 bg-yellow-950/30 border border-yellow-800/40 rounded-lg px-3 py-2 text-sm">
          Tap another player to swap — or tap the same player to deselect.
        </p>
      )}

      <div className="space-y-2.5">
        {pairs.map((pair, pairIdx) => (
          <div key={pairIdx} className="bg-stone-800 border border-stone-700 rounded-xl shadow-sm shadow-black/20 overflow-hidden">
            <div className="bg-stone-900 px-4 py-1.5 border-b border-stone-700">
              <span className="text-stone-400 text-xs font-bold uppercase tracking-widest">Team {pairIdx + 1}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-stone-700">
              {(['p1', 'p2'] as const).map(slot => {
                const player = pair[slot];
                const isSrc = isSwapSrc(pairIdx, slot);
                return (
                  <button
                    key={slot}
                    onClick={() => handlePlayerClick(pairIdx, slot)}
                    className={`px-4 py-3.5 text-left transition-colors ${isSrc ? 'bg-yellow-900/30' : 'hover:bg-stone-700/40'}`}
                  >
                    <p className={`font-bold text-sm ${isSrc ? 'text-yellow-400' : 'text-stone-100'}`}>
                      {player.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 text-center">Tap any player to swap them with another player.</p>

      <div className="flex gap-3">
        <button
          onClick={handleRegenerate}
          className="flex-1 border-2 border-stone-600 text-stone-300 py-2.5 rounded-xl font-semibold text-sm hover:bg-stone-700/50 transition-colors"
        >
          Regenerate
        </button>
        <button
          onClick={() => onSave(pairsToTeams(pairs))}
          className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors shadow-md shadow-black/30"
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
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [formError, setFormError] = useState('');
  const [gamesPerTeam, setGamesPerTeam] = useState(() => Math.max(1, teams.length - 1));

  const maxGames = Math.max(1, teams.length - 1);
  const effectiveGames = Math.max(1, Math.min(gamesPerTeam, maxGames));
  const scheduledMatches = Math.floor((teams.length * effectiveGames) / 2);

  const handleAdd = () => {
    if (!name.trim() || !player1Id || !player2Id) {
      setFormError('All three fields are required');
      return;
    }
    if (player1Id === player2Id) {
      setFormError('Player 1 and Player 2 must be different');
      return;
    }
    if (teams.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      setFormError('A team with that name already exists');
      return;
    }
    const p1 = ratings.find(r => r.id === player1Id);
    const p2 = ratings.find(r => r.id === player2Id);
    if (!p1 || !p2) { setFormError('Select valid players'); return; }
    onAddTeam({ id: crypto.randomUUID(), name: name.trim(), player1: p1.name, player2: p2.name });
    setName(''); setPlayer1Id(''); setPlayer2Id(''); setFormError('');
  };

  const handleSaveGenerated = (newTeams: Team[]) => {
    const saved = onSaveGeneratedTeams(newTeams);
    if (saved) setShowBuilder(false);
  };

  if (showBuilder) {
    return (
      <div className="bg-stone-800 border border-stone-700 rounded-2xl shadow-md shadow-black/20 p-5">
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
      {/* Auto-balance entry — espresso-black panel */}
      {!hasMatches && ratings.length >= 2 && (
        <div className="bg-stone-950 rounded-2xl p-5 shadow-xl shadow-black/40 border border-stone-800 card-texture">
          <p className="text-yellow-600 text-xs uppercase tracking-[0.2em] font-bold mb-1">Auto-Balance</p>
          <p className="text-stone-100 font-black text-lg mb-1 uppercase tracking-wide">Generate Fair Teams</p>
          <p className="text-stone-500 text-sm mb-4">
            Automatically create balanced doubles teams from the player pool.
          </p>
          <button
            onClick={() => setShowBuilder(true)}
            className="bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-stone-950 font-black px-5 py-2.5 rounded-xl text-sm uppercase tracking-wide transition-colors shadow-md"
          >
            Generate Teams
          </button>
        </div>
      )}

      {/* Manual add form */}
      {!hasMatches && (
        <div className="bg-stone-800 rounded-2xl border border-stone-700 shadow-md shadow-black/20 p-5">
          <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm mb-4">Add Team Manually</h2>
          <div className="space-y-3">
            <input
              className="w-full border border-stone-600 rounded-xl px-3 py-2.5 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
              placeholder="Team name (e.g. Court Kings)"
              value={name}
              onChange={e => { setName(e.target.value); setFormError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            {ratings.length < 2 ? (
              <p className="text-stone-400 text-sm bg-stone-900 border border-stone-700 rounded-lg px-3 py-2">
                Add players in Admin → Player Ratings before creating teams.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="border border-stone-600 rounded-xl px-3 py-2.5 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
                  value={player1Id}
                  onChange={e => { setPlayer1Id(e.target.value); setFormError(''); }}
                >
                  <option value="">Player 1…</option>
                  {ratings.filter(r => r.id !== player2Id).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select
                  className="border border-stone-600 rounded-xl px-3 py-2.5 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
                  value={player2Id}
                  onChange={e => { setPlayer2Id(e.target.value); setFormError(''); }}
                >
                  <option value="">Player 2…</option>
                  {ratings.filter(r => r.id !== player1Id).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
            {formError && <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">{formError}</p>}
            <button
              onClick={handleAdd}
              disabled={ratings.length < 2}
              className="w-full bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-2.5 rounded-xl font-bold text-sm uppercase tracking-wide transition-colors shadow-sm disabled:opacity-50"
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
            <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">
              {teams.length} Team{teams.length !== 1 ? 's' : ''}
            </h2>
            {hasMatches && (
              <span className="text-xs text-yellow-500 bg-yellow-950/30 border border-yellow-800/40 px-2.5 py-1 rounded-full font-semibold">
                Schedule locked
              </span>
            )}
          </div>
          <div className="space-y-2">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-stone-800 rounded-xl border border-stone-700 shadow-sm shadow-black/20 px-4 py-3.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-stone-100 text-sm">{team.name}</p>
                  <p className="text-stone-400 text-xs mt-0.5">{team.player1} &amp; {team.player2}</p>
                </div>
                {!hasMatches && (
                  <button
                    onClick={() => onRemoveTeam(team.id)}
                    className="text-stone-500 hover:text-red-400 transition-colors p-1 rounded-lg"
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
          <p className="font-bold text-stone-100">No teams yet</p>
          <p className="text-stone-400 text-sm mt-1">Use Generate Teams above, or add teams manually.</p>
        </div>
      )}

      {!hasMatches && teams.length >= 2 && (
        <div className="bg-stone-800 rounded-2xl border border-stone-700 shadow-md shadow-black/20 p-5 space-y-4">
          <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">Schedule Options</h2>

          {/* Games-per-team stepper */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-stone-300 text-sm font-semibold">Games per team</span>
            <div className="flex items-center border-2 border-stone-600 rounded-xl overflow-hidden">
              <button
                onClick={() => setGamesPerTeam(g => Math.max(1, Math.min(g, maxGames) - 1))}
                disabled={effectiveGames <= 1}
                className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-stone-100 font-black text-base leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="px-4 py-1.5 font-black text-stone-100 text-lg min-w-[2.5rem] text-center tabular-nums bg-stone-950">
                {effectiveGames}
              </span>
              <button
                onClick={() => setGamesPerTeam(g => Math.min(maxGames, Math.max(1, Math.min(g, maxGames)) + 1))}
                disabled={effectiveGames >= maxGames}
                className="px-3 py-1.5 bg-stone-700 hover:bg-stone-600 active:bg-stone-800 text-stone-100 font-black text-base leading-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
            className="w-full bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-colors shadow-lg shadow-black/30"
          >
            Generate Schedule
          </button>
        </div>
      )}

      {(teams.length > 0 || hasMatches) && (
        <button
          onClick={onReset}
          className="w-full border-2 border-red-900/50 text-red-400 py-2.5 rounded-xl text-sm hover:bg-red-950/30 transition-colors font-semibold"
        >
          Reset League
        </button>
      )}
    </div>
  );
}
