// Admin authentication is handled by Vercel serverless API routes under /api/admin/.
// The admin password lives in a server-side environment variable (ADMIN_PASSWORD or
// ADMIN_PASSWORD_HASH) and is never sent to the browser. Login sets an HttpOnly
// session cookie that the JavaScript runtime cannot read.
//
// This is substantially more secure than the previous localStorage approach where
// the SHA-256 hash was visible to anyone who opened DevTools.
//
// REMAINING LIMITATION: Ratings and notes are still stored in localStorage on
// each visitor's browser. Anyone with DevTools can read their own browser's storage.
// For true data privacy, player ratings should be moved to a backend database in a
// future iteration (e.g. Vercel Postgres, PlanetScale, Supabase).

import { useState, useEffect } from 'react';
import type { PlayerRating, PlayerTier } from '../types';
import { createNewPlayer } from '../utils/ratingRecalculation';

// ─── Tier config ──────────────────────────────────────────────────────────────

export const TIERS: { value: PlayerTier; label: string }[] = [
  { value: 'high1', label: 'High Tier 1' },
  { value: 'mid1', label: 'Mid Tier 1' },
  { value: 'low1', label: 'Low Tier 1' },
  { value: 'upper2', label: 'Upper Tier 2' },
  { value: 'mid2', label: 'Middle Tier 2' },
  { value: 'lower2', label: 'Lower Tier 2' },
];

const TIER_ORDER: Record<PlayerTier, number> = {
  high1: 1, mid1: 2, low1: 3, upper2: 4, mid2: 5, lower2: 6,
};

export const TIER_BADGE: Record<PlayerTier, string> = {
  high1: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40',
  mid1: 'bg-blue-900/40 text-blue-300 border border-blue-800/40',
  low1: 'bg-sky-900/40 text-sky-300 border border-sky-800/40',
  upper2: 'bg-amber-900/40 text-amber-300 border border-amber-800/40',
  mid2: 'bg-orange-900/40 text-orange-300 border border-orange-800/40',
  lower2: 'bg-red-900/40 text-red-300 border border-red-800/40',
};

// ─── Login Gate ───────────────────────────────────────────────────────────────

interface LoginGateProps {
  onAuthenticated: () => void;
}

function LoginGate({ onAuthenticated }: LoginGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onAuthenticated();
      } else if (res.status === 404) {
        setError('API unavailable. Run `vercel dev` (not `npm run dev`) for local admin access.');
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Login failed');
      }
    } catch {
      setError('Cannot reach login API. Run `vercel dev` for local admin access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto pt-8">
      <div className="bg-stone-800 border border-stone-700 rounded-2xl shadow-lg shadow-black/30 p-6 space-y-4">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="font-black text-stone-100 uppercase tracking-wider text-lg">Admin Access</h2>
          <p className="text-stone-400 text-sm mt-1">Enter the admin password to continue.</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            className="w-full border border-stone-600 rounded-xl px-3 py-2.5 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
            placeholder="Admin password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-colors disabled:opacity-50 shadow-md"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ratings Manager ──────────────────────────────────────────────────────────

interface ManagerProps {
  ratings: PlayerRating[];
  onUpdateRatings: (r: PlayerRating[]) => void;
}

function RatingsManager({ ratings, onUpdateRatings }: ManagerProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'elo' | 'tier' | 'name'>('elo');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; baseElo: string; notes: string }>({ name: '', baseElo: '', notes: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{ name: string; rating: string; notes: string }>({
    name: '', rating: '', notes: '',
  });
  const [addError, setAddError] = useState('');

  // Rank is always relative to the full roster sorted by current Elo, not the
  // filtered/re-sorted view below — otherwise rank numbers would shuffle
  // whenever the admin searches or changes the sort dropdown.
  const rankById = new Map(
    [...ratings]
      .sort((a, b) => b.currentElo - a.currentElo)
      .map((r, idx) => [r.id, idx + 1] as const)
  );

  const sorted = [...ratings]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'elo') return b.currentElo - a.currentElo;
      if (sortBy === 'tier') return TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.currentElo - a.currentElo;
      return a.name.localeCompare(b.name);
    });

  // Editing baseElo (or adding/deleting a player) changes the recalculation
  // baseline — App's centralized effect detects the baseElo change and
  // immediately replays match history on top of it.
  const handleSaveEdit = () => {
    if (!editingId) return;
    const baseElo = Number(editForm.baseElo);
    if (!editForm.name.trim() || isNaN(baseElo)) return;
    onUpdateRatings(ratings.map(r =>
      r.id === editingId
        ? { ...r, name: editForm.name.trim(), baseElo, notes: editForm.notes.trim() || undefined, updatedAt: new Date().toISOString() }
        : r
    ));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this player rating? Any past matches involving them will be skipped in rating recalculation.')) return;
    onUpdateRatings(ratings.filter(r => r.id !== id));
  };

  const handleAdd = () => {
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    if (ratings.some(r => r.name.toLowerCase() === addForm.name.trim().toLowerCase())) {
      setAddError('Player already exists');
      return;
    }
    const ratingInput = addForm.rating.trim() === '' ? undefined : Number(addForm.rating);
    if (ratingInput !== undefined && isNaN(ratingInput)) { setAddError('Rating must be a number'); return; }
    const newPlayer = createNewPlayer({
      name: addForm.name.trim(),
      ratingInput,
      notes: addForm.notes.trim() || undefined,
    });
    onUpdateRatings([...ratings, newPlayer]);
    setAddForm({ name: '', rating: '', notes: '' });
    setAddError('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">Player Ratings</h2>
        <p className="text-stone-400 text-xs mt-0.5">{ratings.length} players · private, not shown publicly</p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="flex-1 min-w-[160px] border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'elo' | 'tier' | 'name')}
          className="border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-2 focus:ring-yellow-600"
        >
          <option value="elo">Sort: Current Elo</option>
          <option value="tier">Sort: Tier</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Add player */}
      {showAdd ? (
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 space-y-3 shadow-sm shadow-black/20">
          <h3 className="font-black text-stone-100 text-sm uppercase tracking-wide">Add New Player</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="col-span-2 border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
              placeholder="Player name"
              value={addForm.name}
              onChange={e => { setAddForm(p => ({ ...p, name: e.target.value })); setAddError(''); }}
            />
            <input
              type="number"
              className="col-span-2 border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
              placeholder="Rating — 0–100 preliminary or Elo above 100 (defaults to 1500)"
              value={addForm.rating}
              onChange={e => { setAddForm(p => ({ ...p, rating: e.target.value })); setAddError(''); }}
            />
            <input
              className="col-span-2 border border-stone-600 rounded-xl px-3 py-2 text-sm bg-stone-950 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-yellow-600"
              placeholder="Notes (optional) — admin only"
              value={addForm.notes}
              onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
          {addError && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-1.5">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-50 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-colors"
            >
              Add Player
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(''); }}
              className="px-4 py-2 border-2 border-stone-600 rounded-xl text-sm text-stone-300 hover:bg-stone-700/50 transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border-2 border-dashed border-stone-600 text-stone-300 py-2.5 rounded-2xl text-sm hover:border-yellow-600 hover:bg-stone-800 transition-colors font-bold"
        >
          + Add Player
        </button>
      )}

      {/* Player table */}
      <div className="bg-stone-800 rounded-2xl border border-stone-700 shadow-lg shadow-black/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-900 text-stone-300">
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest">#</th>
                <th className="text-left px-4 py-2.5 font-black text-xs uppercase tracking-widest">Player</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest hidden sm:table-cell">Base Elo</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest">Current Elo</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest hidden md:table-cell">Games</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest hidden sm:table-cell">Tier</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-700">
              {sorted.map(player => {
                const lastChange = player.ratingHistory?.[player.ratingHistory.length - 1];
                return (
                <tr key={player.id} className="hover:bg-stone-700/40 transition-colors">
                  {editingId === player.id ? (
                    <>
                      <td className="px-3 py-2 text-center text-stone-500 text-xs font-bold">{rankById.get(player.id)}</td>
                      <td className="px-3 py-2">
                        <input
                          className="w-full border border-stone-600 rounded-lg px-2 py-1 text-sm bg-stone-950 text-stone-100 focus:outline-none focus:ring-1 focus:ring-yellow-600"
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <input
                          className="mt-1 w-full border border-stone-700 rounded-lg px-2 py-1 text-xs bg-stone-950 text-stone-300 placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-yellow-600"
                          placeholder="Notes (optional)"
                          value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <input
                          type="number"
                          className="w-20 border border-stone-600 rounded-lg px-2 py-1 text-sm text-center bg-stone-950 text-stone-100 focus:outline-none focus:ring-1 focus:ring-yellow-600"
                          value={editForm.baseElo}
                          onChange={e => setEditForm(f => ({ ...f, baseElo: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2 text-center text-stone-500 text-xs">
                        recalculates on save
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell" />
                      <td className="px-3 py-2 hidden sm:table-cell" />
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <button onClick={handleSaveEdit} className="text-xs text-emerald-400 font-black hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-stone-500 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 text-center text-stone-500 text-xs font-bold">{rankById.get(player.id)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-stone-100">{player.name}</p>
                        {player.notes && (
                          <p className="text-xs text-stone-500 mt-0.5 italic">{player.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-stone-400 hidden sm:table-cell">{Math.round(player.baseElo)}</td>
                      <td className="px-3 py-3 text-center font-black text-stone-100">
                        {Math.round(player.currentElo)}
                        {lastChange && (
                          <span className={`ml-1.5 text-xs font-semibold ${lastChange.finalDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                            {lastChange.finalDelta >= 0 ? '+' : ''}{Math.round(lastChange.finalDelta)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-stone-400 hidden md:table-cell">{player.gamesPlayed}</td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TIER_BADGE[player.tier]}`}>
                          {TIERS.find(t => t.value === player.tier)?.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => {
                              setEditingId(player.id);
                              setEditForm({ name: player.name, baseElo: String(Math.round(player.baseElo)), notes: player.notes ?? '' });
                            }}
                            className="text-xs text-stone-300 hover:text-stone-100 font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(player.id)}
                            className="text-xs text-red-400 hover:text-red-300 font-semibold"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-stone-400 text-sm">
                    No players match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main AdminPage ───────────────────────────────────────────────────────────

interface Props {
  ratings: PlayerRating[];
  onUpdateRatings: (r: PlayerRating[]) => void;
}

export default function AdminPage({ ratings, onUpdateRatings }: Props) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  // On mount, check if an existing session cookie is still valid.
  // This lets the admin stay logged in for up to 24 hours without re-entering
  // their password on every page visit.
  useEffect(() => {
    fetch('/api/admin/session', { credentials: 'same-origin' })
      .then(r => r.json())
      .then((data: { authenticated?: boolean }) => {
        if (data.authenticated) setIsAuthed(true);
      })
      .catch(() => { /* API not running locally — show login form */ })
      .finally(() => setChecking(false));

    // Clear local auth state on unmount (tab navigation).
    // The server-side cookie persists for 24 h; re-visiting this tab
    // re-checks the cookie above and restores access without re-login.
    return () => setIsAuthed(false);
  }, []);

  const handleLock = async () => {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    setIsAuthed(false);
  };

  if (checking) {
    return (
      <div className="text-center py-14">
        <p className="text-stone-500 text-sm">Checking session…</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <LoginGate onAuthenticated={() => setIsAuthed(true)} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-black text-stone-100 uppercase tracking-wider text-sm">Admin</h2>
        <button
          onClick={handleLock}
          className="text-stone-300 hover:text-stone-100 text-xs border-2 border-stone-600 px-3 py-1.5 rounded-xl transition-colors font-bold hover:bg-stone-800"
        >
          Logout
        </button>
      </div>

      <RatingsManager ratings={ratings} onUpdateRatings={onUpdateRatings} />
    </div>
  );
}
