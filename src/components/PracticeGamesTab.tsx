import { useMemo, useState } from 'react';
import type { PlayerRating, PracticeMatch } from '../types';
import { validateScore } from '../utils/validation';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FormState {
  teamA1: string;
  teamA2: string;
  teamB1: string;
  teamB2: string;
  scoreA: string;
  scoreB: string;
  date: string;
  notes: string;
}

function blankForm(): FormState {
  return { teamA1: '', teamA2: '', teamB1: '', teamB2: '', scoreA: '', scoreB: '', date: todayISODate(), notes: '' };
}

function formFromMatch(m: PracticeMatch): FormState {
  return {
    teamA1: m.teamAPlayerIds[0],
    teamA2: m.teamAPlayerIds[1],
    teamB1: m.teamBPlayerIds[0],
    teamB2: m.teamBPlayerIds[1],
    scoreA: String(m.teamAScore),
    scoreB: String(m.teamBScore),
    date: m.date,
    notes: m.notes ?? '',
  };
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
      <label className="block text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
      >
        <option value="">Select player…</option>
        {options.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

interface MatchFormProps {
  players: PlayerRating[];
  initial: FormState;
  submitLabel: string;
  onSubmit: (match: {
    teamAPlayerIds: [string, string];
    teamBPlayerIds: [string, string];
    teamAScore: number;
    teamBScore: number;
    winnerTeam: 'A' | 'B';
    date: string;
    notes?: string;
  }) => void;
  onCancel?: () => void;
}

function MatchForm({ players, initial, submitLabel, onSubmit, onCancel }: MatchFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const selectedIds = [form.teamA1, form.teamA2, form.teamB1, form.teamB2];
  const optionsFor = (slot: string) => players.filter(p => p.id === slot || !selectedIds.includes(p.id));

  const allSelected = form.teamA1 && form.teamA2 && form.teamB1 && form.teamB2;
  const allDistinct = new Set(selectedIds.filter(Boolean)).size === selectedIds.filter(Boolean).length;

  const sA = Number(form.scoreA);
  const sB = Number(form.scoreB);
  const scoreEntered = form.scoreA !== '' && form.scoreB !== '';
  const scoreError = scoreEntered ? validateScore(sA, sB) : null;

  const canSubmit = allSelected && allDistinct && scoreEntered && !scoreError && form.date;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      teamAPlayerIds: [form.teamA1, form.teamA2],
      teamBPlayerIds: [form.teamB1, form.teamB2],
      teamAScore: sA,
      teamBScore: sB,
      winnerTeam: sA > sB ? 'A' : 'B',
      date: form.date,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 space-y-4 shadow-sm shadow-black/20">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-3">
          <p className="text-xs font-black text-yellow-600 uppercase tracking-widest">Team A</p>
          <PlayerSlotSelect label="Player A1" value={form.teamA1} onChange={v => set('teamA1', v)} options={optionsFor(form.teamA1)} />
          <PlayerSlotSelect label="Player A2" value={form.teamA2} onChange={v => set('teamA2', v)} options={optionsFor(form.teamA2)} />
          <input
            type="number"
            placeholder="Team A score"
            value={form.scoreA}
            onChange={e => set('scoreA', e.target.value)}
            className="w-full border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
          />
        </div>
        <div className="space-y-3">
          <p className="text-xs font-black text-yellow-600 uppercase tracking-widest">Team B</p>
          <PlayerSlotSelect label="Player B1" value={form.teamB1} onChange={v => set('teamB1', v)} options={optionsFor(form.teamB1)} />
          <PlayerSlotSelect label="Player B2" value={form.teamB2} onChange={v => set('teamB2', v)} options={optionsFor(form.teamB2)} />
          <input
            type="number"
            placeholder="Team B score"
            value={form.scoreB}
            onChange={e => set('scoreB', e.target.value)}
            className="w-full border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Date played</label>
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">Notes (optional)</label>
        <input
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="e.g. windy conditions, makeup game..."
          className="w-full border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
        />
      </div>

      {!allDistinct && selectedIds.filter(Boolean).length > 0 && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">
          Each player can only be selected once.
        </p>
      )}
      {scoreError && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">{scoreError}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-stone-950 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-colors disabled:opacity-50 shadow-md"
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border-2 border-stone-600 rounded-xl text-sm text-stone-300 hover:bg-stone-700/50 transition-colors font-semibold"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="text-xs text-stone-500 text-center">Games to 11, win by 2 (e.g. 11–9, 12–10, 13–11...)</p>
    </div>
  );
}

// ─── History list with inline edit/delete ──────────────────────────────────────

interface HistoryProps {
  matches: PracticeMatch[];
  players: PlayerRating[];
  onUpdate: (id: string, patch: Omit<PracticeMatch, 'id' | 'matchType' | 'createdAt' | 'updatedAt'>) => void;
  onDelete: (id: string) => void;
}

function PracticeMatchHistory({ matches, players, onUpdate, onDelete }: HistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const nameOf = (id: string) => byId.get(id)?.name ?? 'Deleted player';

  const sorted = [...matches].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-stone-400 text-sm">
        No practice matches recorded yet. Enter one above to get started.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sorted.map(m => {
        if (editingId === m.id) {
          return (
            <MatchForm
              key={m.id}
              players={players}
              initial={formFromMatch(m)}
              submitLabel="Save Changes"
              onCancel={() => setEditingId(null)}
              onSubmit={patch => {
                onUpdate(m.id, patch);
                setEditingId(null);
              }}
            />
          );
        }

        return (
          <div key={m.id} className="bg-stone-800 rounded-2xl border border-stone-700 shadow-sm shadow-black/20 px-4 py-3.5">
            <div className="flex justify-between items-baseline gap-2 flex-wrap">
              <p className="font-bold text-stone-100 text-sm">
                {nameOf(m.teamAPlayerIds[0])} / {nameOf(m.teamAPlayerIds[1])}
                <span className="text-stone-500 mx-1.5">vs</span>
                {nameOf(m.teamBPlayerIds[0])} / {nameOf(m.teamBPlayerIds[1])}
              </p>
              <p className="text-xs text-stone-500">{m.date}</p>
            </div>
            <p className="text-stone-300 text-sm mt-1 font-mono font-black">
              {m.teamAScore}–{m.teamBScore}{' '}
              <span className="text-yellow-400 font-sans font-bold text-xs uppercase tracking-wide">
                Team {m.winnerTeam} won
              </span>
            </p>
            {m.notes && <p className="text-stone-500 text-xs mt-1 italic">{m.notes}</p>}
            <div className="flex gap-3 mt-2">
              <button onClick={() => setEditingId(m.id)} className="text-xs text-stone-300 hover:text-stone-100 font-semibold">
                Edit
              </button>
              <button
                onClick={() => { if (window.confirm('Delete this practice match?')) onDelete(m.id); }}
                className="text-xs text-red-400 hover:text-red-300 font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────────────

interface Props {
  players: PlayerRating[];
  practiceMatches: PracticeMatch[];
  onAddMatch: (match: Omit<PracticeMatch, 'id' | 'matchType' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateMatch: (id: string, patch: Omit<PracticeMatch, 'id' | 'matchType' | 'createdAt' | 'updatedAt'>) => void;
  onDeleteMatch: (id: string) => void;
}

export default function PracticeGamesTab({ players, practiceMatches, onAddMatch, onUpdateMatch, onDeleteMatch }: Props) {
  const [view, setView] = useState<'enter' | 'history'>('enter');
  const [savedFlash, setSavedFlash] = useState(false);

  if (players.length < 4) {
    return (
      <div className="text-center py-14">
        <p className="text-4xl mb-3">🏓</p>
        <p className="font-bold text-stone-100">Need at least 4 players</p>
        <p className="text-stone-400 text-sm mt-1">Add players in Admin → Player Ratings first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">Practice Games</h2>
          <p className="text-stone-400 text-xs mt-0.5">{practiceMatches.length} practice match{practiceMatches.length !== 1 ? 'es' : ''} recorded</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setView('enter')}
            className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-xl transition-colors ${
              view === 'enter' ? 'bg-emerald-800 text-emerald-50' : 'text-stone-300 border-2 border-stone-600 hover:bg-stone-800'
            }`}
          >
            Enter Match
          </button>
          <button
            onClick={() => setView('history')}
            className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-xl transition-colors ${
              view === 'history' ? 'bg-emerald-800 text-emerald-50' : 'text-stone-300 border-2 border-stone-600 hover:bg-stone-800'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {view === 'enter' ? (
        <div className="space-y-3">
          <MatchForm
            key={practiceMatches.length /* reset form after a successful save */}
            players={players}
            initial={blankForm()}
            submitLabel="Save Practice Match"
            onSubmit={match => {
              onAddMatch(match);
              setSavedFlash(true);
              setTimeout(() => setSavedFlash(false), 3000);
            }}
          />
          {savedFlash && (
            <p className="text-emerald-400 text-sm text-center font-bold">Practice match saved.</p>
          )}
        </div>
      ) : (
        <PracticeMatchHistory matches={practiceMatches} players={players} onUpdate={onUpdateMatch} onDelete={onDeleteMatch} />
      )}
    </div>
  );
}
