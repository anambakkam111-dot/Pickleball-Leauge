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
import type { PlayerRating, PlayerTier, RatingMatch } from '../types';
import RatingMatchEntry from './RatingMatchEntry';

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
  high1: 'bg-green-100 text-green-800',
  mid1: 'bg-blue-100 text-blue-800',
  low1: 'bg-sky-100 text-sky-800',
  upper2: 'bg-amber-100 text-amber-800',
  mid2: 'bg-orange-100 text-orange-800',
  lower2: 'bg-red-100 text-red-700',
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
      <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-lg shadow-amber-900/10 p-6 space-y-4">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="font-black text-amber-900 uppercase tracking-wider text-lg">Admin Access</h2>
          <p className="text-stone-600 text-sm mt-1">Enter the admin password to continue.</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            className="w-full border border-amber-300 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            placeholder="Admin password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          {error && (
            <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              {error}
            </p>
          )}
          <button
            onClick={handleLogin}
            disabled={loading || !password}
            className="w-full bg-amber-800 hover:bg-amber-700 text-amber-50 py-2.5 rounded-xl font-black text-sm uppercase tracking-wide transition-colors disabled:opacity-50 shadow-md"
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
  const [sortBy, setSortBy] = useState<'rating' | 'tier' | 'name'>('rating');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PlayerRating>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{ name: string; rating: string; tier: PlayerTier; notes: string }>({
    name: '', rating: '', tier: 'mid1', notes: '',
  });
  const [addError, setAddError] = useState('');

  const sorted = [...ratings]
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'tier') return TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });

  const handleSaveEdit = () => {
    if (!editingId) return;
    const rating = Number(editForm.rating);
    if (isNaN(rating) || rating < 0 || rating > 100) return;
    onUpdateRatings(ratings.map(r =>
      r.id === editingId
        ? { ...r, ...editForm, rating, updatedAt: new Date().toISOString() }
        : r
    ));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this player rating?')) return;
    onUpdateRatings(ratings.filter(r => r.id !== id));
  };

  const handleAdd = () => {
    const rating = Number(addForm.rating);
    if (!addForm.name.trim()) { setAddError('Name is required'); return; }
    if (isNaN(rating) || rating < 0 || rating > 100) { setAddError('Rating must be 0–100'); return; }
    if (ratings.some(r => r.name.toLowerCase() === addForm.name.trim().toLowerCase())) {
      setAddError('Player already exists');
      return;
    }
    const newPlayer: PlayerRating = {
      id: crypto.randomUUID(),
      name: addForm.name.trim(),
      rating,
      tier: addForm.tier,
      notes: addForm.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    onUpdateRatings([...ratings, newPlayer]);
    setAddForm({ name: '', rating: '', tier: 'mid1', notes: '' });
    setAddError('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-black text-amber-900 uppercase tracking-wider text-sm">Player Ratings</h2>
        <p className="text-stone-600 text-xs mt-0.5">{ratings.length} players · private, not shown publicly</p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="flex-1 min-w-[160px] border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'rating' | 'tier' | 'name')}
          className="border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="rating">Sort: Rating</option>
          <option value="tier">Sort: Tier</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {/* Add player */}
      {showAdd ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <h3 className="font-black text-amber-900 text-sm uppercase tracking-wide">Add New Player</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="col-span-2 border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Player name"
              value={addForm.name}
              onChange={e => { setAddForm(p => ({ ...p, name: e.target.value })); setAddError(''); }}
            />
            <input
              type="number"
              className="border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Rating (0–100)"
              value={addForm.rating}
              onChange={e => { setAddForm(p => ({ ...p, rating: e.target.value })); setAddError(''); }}
            />
            <select
              value={addForm.tier}
              onChange={e => setAddForm(p => ({ ...p, tier: e.target.value as PlayerTier }))}
              className="border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              className="col-span-2 border border-amber-300 rounded-xl px-3 py-2 text-sm bg-white text-stone-800 placeholder-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Notes (optional) — admin only"
              value={addForm.notes}
              onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
            />
          </div>
          {addError && (
            <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 bg-amber-800 hover:bg-amber-700 text-amber-50 py-2 rounded-xl text-sm font-black uppercase tracking-wide transition-colors"
            >
              Add Player
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddError(''); }}
              className="px-4 py-2 border-2 border-amber-300 rounded-xl text-sm text-stone-700 hover:bg-amber-100 transition-colors font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border-2 border-dashed border-amber-300 text-stone-700 py-2.5 rounded-2xl text-sm hover:border-amber-500 hover:bg-amber-50 transition-colors font-bold"
        >
          + Add Player
        </button>
      )}

      {/* Player table */}
      <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-lg shadow-amber-900/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-amber-900 text-amber-100">
                <th className="text-left px-4 py-2.5 font-black text-xs uppercase tracking-widest">Player</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest">Rating</th>
                <th className="text-center px-3 py-2.5 font-black text-xs uppercase tracking-widest hidden sm:table-cell">Tier</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {sorted.map(player => (
                <tr key={player.id} className="hover:bg-amber-100/50 transition-colors">
                  {editingId === player.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          className="w-full border border-amber-300 rounded-lg px-2 py-1 text-sm bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          value={editForm.name ?? player.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        />
                        <input
                          className="mt-1 w-full border border-amber-200 rounded-lg px-2 py-1 text-xs bg-white text-stone-600 placeholder-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300"
                          placeholder="Notes (optional)"
                          value={editForm.notes ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="w-16 border border-amber-300 rounded-lg px-2 py-1 text-sm text-center bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                          value={editForm.rating ?? player.rating}
                          onChange={e => setEditForm(f => ({ ...f, rating: Number(e.target.value) }))}
                        />
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <select
                          value={editForm.tier ?? player.tier}
                          onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as PlayerTier }))}
                          className="border border-amber-300 rounded-lg px-2 py-1 text-xs bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <button onClick={handleSaveEdit} className="text-xs text-green-700 font-black hover:underline">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-stone-500 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <p className="font-bold text-amber-900">{player.name}</p>
                        {player.notes && (
                          <p className="text-xs text-stone-500 mt-0.5 italic">{player.notes}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-black text-amber-900">{player.rating}</td>
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
                              setEditForm({ name: player.name, rating: player.rating, tier: player.tier, notes: player.notes ?? '' });
                            }}
                            className="text-xs text-stone-700 hover:text-stone-900 font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(player.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-stone-600 text-sm">
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
  ratingMatches: RatingMatch[];
  onSaveRatingMatch: (match: RatingMatch, updatedRatings: PlayerRating[]) => void;
}

export default function AdminPage({ ratings, onUpdateRatings, ratingMatches, onSaveRatingMatch }: Props) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subTab, setSubTab] = useState<'ratings' | 'matches'>('ratings');

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
        <div className="flex gap-1.5">
          <button
            onClick={() => setSubTab('ratings')}
            className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-xl transition-colors ${
              subTab === 'ratings' ? 'bg-amber-800 text-amber-50' : 'text-stone-700 border-2 border-amber-300 hover:bg-amber-100'
            }`}
          >
            Player Ratings
          </button>
          <button
            onClick={() => setSubTab('matches')}
            className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-xl transition-colors ${
              subTab === 'matches' ? 'bg-amber-800 text-amber-50' : 'text-stone-700 border-2 border-amber-300 hover:bg-amber-100'
            }`}
          >
            Rating Match Entry
          </button>
        </div>
        <button
          onClick={handleLock}
          className="text-stone-700 hover:text-stone-900 text-xs border-2 border-amber-300 px-3 py-1.5 rounded-xl transition-colors font-bold hover:bg-amber-100"
        >
          Logout
        </button>
      </div>

      {subTab === 'ratings' ? (
        <RatingsManager ratings={ratings} onUpdateRatings={onUpdateRatings} />
      ) : (
        <RatingMatchEntry
          ratings={ratings}
          ratingMatches={ratingMatches}
          onSaveRatingMatch={onSaveRatingMatch}
        />
      )}
    </div>
  );
}
