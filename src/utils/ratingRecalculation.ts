import type { AnyMatch, PlayerRating, PlayerTier, RatingHistoryEntry, Team } from '../types';
import { validateScore } from './validation';

// ─── Centralized rating recalculation pipeline ─────────────────────────────────
//
// This is the single place that turns match history into player ratings.
// Every caller — Practice Games (create/edit/delete) and tournament score
// entry (create/edit/delete) — routes through `recalculatePlayerRatings`
// instead of computing rating changes locally.
//
// Architecture: baseline replay. Every call resets every player's
// `currentElo` to their `baseElo` and `gamesPlayed` to 0, then replays every
// valid rating-affecting match in chronological order, applying Elo deltas
// as it goes. This makes editing or deleting an old match safe — the whole
// history is recomputed from scratch rather than trying to reverse a single
// stale delta.

// ─── Tunable constants ──────────────────────────────────────────────────────────

const EXPECTED_SCALE = 125;
const MAX_MARGIN = 11;
const MARGIN_PERFORMANCE_SCALE = 4;
const K_BASE = 40;
const STABILITY_GAMES = 12;
const K_MIN = 8;
const MAX_MATCH_DELTA = 40;
const HRTP_THRESHOLD_ELO = 450;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

// ─── Rating scale migration ─────────────────────────────────────────────────────
// Old ratings were 0–100. Anything <= 100 is treated as a preliminary rating
// and converted; anything already above 100 is assumed to already be Elo.

export function toEloScale(preliminaryOrElo: number): number {
  return preliminaryOrElo <= 100 ? 1000 + preliminaryOrElo * 10 : preliminaryOrElo;
}

// Converts whatever shape is in localStorage (old {rating: 0-100} players or
// already-migrated Elo players) into the current PlayerRating shape. Safe to
// call on already-migrated data — it's a no-op past filling in defaults.
export function migratePlayerRatings(raw: unknown): PlayerRating[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): PlayerRating => {
    const pl = (entry ?? {}) as Record<string, unknown>;
    const now = new Date().toISOString();

    if (typeof pl.baseElo === 'number') {
      return {
        id: String(pl.id ?? crypto.randomUUID()),
        name: String(pl.name ?? 'Unknown'),
        baseElo: pl.baseElo,
        currentElo: typeof pl.currentElo === 'number' ? pl.currentElo : pl.baseElo,
        gamesPlayed: typeof pl.gamesPlayed === 'number' ? pl.gamesPlayed : 0,
        tier: (pl.tier as PlayerTier) ?? 'mid2',
        notes: typeof pl.notes === 'string' ? pl.notes : undefined,
        updatedAt: typeof pl.updatedAt === 'string' ? pl.updatedAt : now,
        ratingHistory: Array.isArray(pl.ratingHistory) ? (pl.ratingHistory as RatingHistoryEntry[]) : undefined,
        originalPreliminaryRating: typeof pl.originalPreliminaryRating === 'number' ? pl.originalPreliminaryRating : undefined,
      };
    }

    // Legacy shape: { rating: 0-100 }. Preserve name/tier/notes, convert rating.
    const legacyRating = typeof pl.rating === 'number' ? pl.rating : 50;
    const baseElo = toEloScale(legacyRating);
    return {
      id: String(pl.id ?? crypto.randomUUID()),
      name: String(pl.name ?? 'Unknown'),
      baseElo,
      currentElo: baseElo,
      gamesPlayed: 0,
      tier: (pl.tier as PlayerTier) ?? 'mid2',
      notes: typeof pl.notes === 'string' ? pl.notes : undefined,
      updatedAt: typeof pl.updatedAt === 'string' ? pl.updatedAt : now,
      originalPreliminaryRating: legacyRating <= 100 ? legacyRating : undefined,
    };
  });
}

// Builds a brand-new player for the Admin "Add Player" flow. A 0-100 input is
// treated as preliminary and converted; anything above 100 is kept as Elo;
// omitted input defaults to 1500 (an average starting Elo).
export function createNewPlayer(input: {
  name: string;
  ratingInput?: number;
  tier?: PlayerTier;
  notes?: string;
}): PlayerRating {
  const raw = input.ratingInput;
  const hasInput = raw !== undefined && !Number.isNaN(raw);
  const baseElo = hasInput ? toEloScale(raw as number) : 1500;
  return {
    id: crypto.randomUUID(),
    name: input.name,
    baseElo,
    currentElo: baseElo,
    gamesPlayed: 0,
    tier: input.tier ?? 'mid2',
    notes: input.notes,
    updatedAt: new Date().toISOString(),
    originalPreliminaryRating: hasInput && (raw as number) <= 100 ? raw : undefined,
  };
}

// ─── Match normalization ─────────────────────────────────────────────────────────
// Practice matches already reference PlayerRating ids directly. Tournament
// matches reference Team ids, and Teams only store player *names* (teams are
// often generated from ratings via pairsToTeams, which strips ids) — so
// tournament matches are resolved to player ids by name match here.

interface NormalizedMatch {
  id: string;
  matchType: 'practice' | 'tournament';
  sortKey: string;
  tieBreak: string;
  teamAIds: [string, string];
  teamBIds: [string, string];
  teamAScore: number;
  teamBScore: number;
}

function buildNameIndex(players: PlayerRating[]): Map<string, PlayerRating> {
  const index = new Map<string, PlayerRating>();
  for (const p of players) {
    const key = p.name.trim().toLowerCase();
    if (!index.has(key)) index.set(key, p); // first match wins for duplicate names
  }
  return index;
}

function normalizeMatches(matches: AnyMatch[], teams: Team[], players: PlayerRating[]): NormalizedMatch[] {
  const nameIndex = buildNameIndex(players);
  const teamIndex = new Map(teams.map(t => [t.id, t]));
  const normalized: NormalizedMatch[] = [];

  for (const m of matches) {
    if (m.matchType === 'practice') {
      if (validateScore(m.teamAScore, m.teamBScore)) {
        console.warn(`recalculatePlayerRatings: skipping practice match ${m.id} — invalid score`);
        continue;
      }
      const ids = [...m.teamAPlayerIds, ...m.teamBPlayerIds];
      if (new Set(ids).size !== 4) {
        console.warn(`recalculatePlayerRatings: skipping practice match ${m.id} — duplicate player in lineup`);
        continue;
      }
      normalized.push({
        id: m.id,
        matchType: 'practice',
        sortKey: m.date || m.createdAt.slice(0, 10),
        tieBreak: m.createdAt,
        teamAIds: m.teamAPlayerIds,
        teamBIds: m.teamBPlayerIds,
        teamAScore: m.teamAScore,
        teamBScore: m.teamBScore,
      });
    } else {
      if (m.team1Score === null || m.team2Score === null) continue; // not yet played
      if (validateScore(m.team1Score, m.team2Score)) {
        console.warn(`recalculatePlayerRatings: skipping tournament match ${m.id} — invalid score`);
        continue;
      }
      const team1 = teamIndex.get(m.team1Id);
      const team2 = teamIndex.get(m.team2Id);
      if (!team1 || !team2) {
        console.warn(`recalculatePlayerRatings: skipping tournament match ${m.id} — team no longer exists`);
        continue;
      }
      const a1 = nameIndex.get(team1.player1.trim().toLowerCase());
      const a2 = nameIndex.get(team1.player2.trim().toLowerCase());
      const b1 = nameIndex.get(team2.player1.trim().toLowerCase());
      const b2 = nameIndex.get(team2.player2.trim().toLowerCase());
      if (!a1 || !a2 || !b1 || !b2) {
        console.warn(`recalculatePlayerRatings: skipping tournament match ${m.id} — a player could not be matched to a rating (deleted or renamed)`);
        continue;
      }
      const ids = [a1.id, a2.id, b1.id, b2.id];
      if (new Set(ids).size !== 4) {
        console.warn(`recalculatePlayerRatings: skipping tournament match ${m.id} — duplicate player in lineup`);
        continue;
      }
      normalized.push({
        id: m.id,
        matchType: 'tournament',
        sortKey: m.playedAt ?? '',
        tieBreak: m.id,
        teamAIds: [a1.id, a2.id],
        teamBIds: [b1.id, b2.id],
        teamAScore: m.team1Score,
        teamBScore: m.team2Score,
      });
    }
  }

  normalized.sort((x, y) => x.sortKey.localeCompare(y.sortKey) || x.tieBreak.localeCompare(y.tieBreak));
  return normalized;
}

// ─── Dynamic percentile-based tiers ──────────────────────────────────────────────

const TIER_PERCENTILES: { tier: PlayerTier; pct: number }[] = [
  { tier: 'high1', pct: 0.20 },
  { tier: 'mid1', pct: 0.25 },
  { tier: 'low1', pct: 0.20 },
  { tier: 'upper2', pct: 0.20 },
  { tier: 'mid2', pct: 0.10 },
  { tier: 'lower2', pct: 0.05 },
];

function recalculateDynamicTiers(players: PlayerRating[]): void {
  const n = players.length;
  if (n === 0) return;
  const sorted = [...players].sort((a, b) => b.currentElo - a.currentElo);

  let assigned = 0;
  let cumulativePct = 0;
  TIER_PERCENTILES.forEach((entry, idx) => {
    cumulativePct += entry.pct;
    const isLast = idx === TIER_PERCENTILES.length - 1;
    const boundary = isLast ? n : Math.round(n * cumulativePct);
    const count = Math.max(0, boundary - assigned);
    for (let k = 0; k < count && assigned < n; k++) {
      sorted[assigned].tier = entry.tier;
      assigned++;
    }
  });
  // Rounding safety net — should be unreachable given the isLast boundary above.
  while (assigned < n) {
    sorted[assigned].tier = 'lower2';
    assigned++;
  }
}

// ─── Core per-match Elo application ──────────────────────────────────────────────

interface Side {
  player: PlayerRating;
  playerPreElo: number;
  teammatePreElo: number;
  perfDiff: number;
  expected: number;
  expectedMargin: number;
  actualMargin: number;
  actualPerf: number;
  expectedPerf: number;
  teamAvg: number;
  opponentAvg: number;
  isWinner: boolean;
}

function applyMatch(working: Map<string, PlayerRating>, m: NormalizedMatch): void {
  const [aId1, aId2] = m.teamAIds;
  const [bId1, bId2] = m.teamBIds;
  const a1 = working.get(aId1);
  const a2 = working.get(aId2);
  const b1 = working.get(bId1);
  const b2 = working.get(bId2);
  if (!a1 || !a2 || !b1 || !b2) {
    console.warn(`recalculatePlayerRatings: skipping match ${m.id} — a player is missing from the roster`);
    return;
  }

  const teamAAvg = (a1.currentElo + a2.currentElo) / 2;
  const teamBAvg = (b1.currentElo + b2.currentElo) / 2;

  const expectedA = 1 / (1 + Math.exp((teamBAvg - teamAAvg) / EXPECTED_SCALE));
  const expectedB = 1 - expectedA;

  const rawMarginA = clamp(m.teamAScore - m.teamBScore, -MAX_MARGIN, MAX_MARGIN);
  const rawMarginB = -rawMarginA;

  const expectedMarginA = (2 * expectedA - 1) * MAX_MARGIN;
  const expectedMarginB = -expectedMarginA;

  const actualPerfA = 1 / (1 + Math.exp(-rawMarginA / MARGIN_PERFORMANCE_SCALE));
  const expectedPerfA = 1 / (1 + Math.exp(-expectedMarginA / MARGIN_PERFORMANCE_SCALE));
  const perfDiffA = actualPerfA - expectedPerfA;

  const actualPerfB = 1 - actualPerfA;
  const expectedPerfB = 1 - expectedPerfA;
  const perfDiffB = actualPerfB - expectedPerfB;

  const winnerTeam: 'A' | 'B' = m.teamAScore > m.teamBScore ? 'A' : 'B';

  const sides: Side[] = [
    { player: a1, playerPreElo: a1.currentElo, teammatePreElo: a2.currentElo, perfDiff: perfDiffA, expected: expectedA, expectedMargin: expectedMarginA, actualMargin: rawMarginA, actualPerf: actualPerfA, expectedPerf: expectedPerfA, teamAvg: teamAAvg, opponentAvg: teamBAvg, isWinner: winnerTeam === 'A' },
    { player: a2, playerPreElo: a2.currentElo, teammatePreElo: a1.currentElo, perfDiff: perfDiffA, expected: expectedA, expectedMargin: expectedMarginA, actualMargin: rawMarginA, actualPerf: actualPerfA, expectedPerf: expectedPerfA, teamAvg: teamAAvg, opponentAvg: teamBAvg, isWinner: winnerTeam === 'A' },
    { player: b1, playerPreElo: b1.currentElo, teammatePreElo: b2.currentElo, perfDiff: perfDiffB, expected: expectedB, expectedMargin: expectedMarginB, actualMargin: rawMarginB, actualPerf: actualPerfB, expectedPerf: expectedPerfB, teamAvg: teamBAvg, opponentAvg: teamAAvg, isWinner: winnerTeam === 'B' },
    { player: b2, playerPreElo: b2.currentElo, teammatePreElo: b1.currentElo, perfDiff: perfDiffB, expected: expectedB, expectedMargin: expectedMarginB, actualMargin: rawMarginB, actualPerf: actualPerfB, expectedPerf: expectedPerfB, teamAvg: teamBAvg, opponentAvg: teamAAvg, isWinner: winnerTeam === 'B' },
  ];

  for (const side of sides) {
    const playerK = Math.max(K_MIN, (K_BASE * STABILITY_GAMES) / (STABILITY_GAMES + side.player.gamesPlayed));
    const deltaBeforeHrtp = clamp(playerK * side.perfDiff, -MAX_MATCH_DELTA, MAX_MATCH_DELTA);

    let finalDelta = deltaBeforeHrtp;
    let hrtpApplied = false;
    let hrtpFactor: number | undefined;
    const gap = Math.abs(side.playerPreElo - side.teammatePreElo);

    // HRTP: final protection layer only — never touches expected win prob,
    // margins, performance diff, or K-factor above. Only reduces the
    // higher-rated teammate's already-negative loss on a losing team.
    if (!side.isWinner && side.playerPreElo > side.teammatePreElo && gap >= HRTP_THRESHOLD_ELO && deltaBeforeHrtp < 0) {
      const protectionStrength = clamp((gap - HRTP_THRESHOLD_ELO) / HRTP_THRESHOLD_ELO, 0, 1);
      hrtpFactor = 0.35 - 0.25 * protectionStrength;
      finalDelta = deltaBeforeHrtp * hrtpFactor;
      hrtpApplied = true;
    }

    const newElo = side.playerPreElo + finalDelta;

    const historyEntry: RatingHistoryEntry = {
      matchId: m.id,
      matchType: m.matchType,
      date: m.sortKey,
      oldElo: side.playerPreElo,
      newElo,
      deltaBeforeHrtp,
      finalDelta,
      teamAvgElo: side.teamAvg,
      opponentAvgElo: side.opponentAvg,
      expectedWinProbability: side.expected,
      expectedSignedMargin: side.expectedMargin,
      actualSignedMargin: side.actualMargin,
      actualPerformance: side.actualPerf,
      expectedPerformance: side.expectedPerf,
      performanceDiff: side.perfDiff,
      playerK,
      teammateGap: gap,
      hrtpApplied,
      hrtpFactor,
    };

    side.player.currentElo = newElo;
    side.player.gamesPlayed += 1;
    side.player.ratingHistory = [...(side.player.ratingHistory ?? []), historyEntry];
  }
}

// ─── Public entry point ──────────────────────────────────────────────────────────
// Called any time practice or tournament match history changes (create, edit,
// delete) or a player's baseElo is edited in Admin. Always replays the full
// history from baseElo — never patches a single stale delta.
export function recalculatePlayerRatings(
  matches: AnyMatch[],
  players: PlayerRating[],
  teams: Team[]
): PlayerRating[] {
  const working = new Map<string, PlayerRating>();
  for (const p of players) {
    working.set(p.id, { ...p, currentElo: p.baseElo, gamesPlayed: 0, ratingHistory: [] });
  }

  const normalized = normalizeMatches(matches, teams, players);
  for (const m of normalized) {
    applyMatch(working, m);
  }

  const result = Array.from(working.values());
  recalculateDynamicTiers(result);
  return result;
}

// ─── Debugging helper ─────────────────────────────────────────────────────────────
// Pulls the full breakdown (expected win prob, margins, performance diff,
// K-factor, HRTP details, ...) for one player's rating change in one match.
export function explainRatingChange(player: PlayerRating, matchId: string): RatingHistoryEntry | undefined {
  return player.ratingHistory?.find(h => h.matchId === matchId);
}
