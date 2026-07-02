import type { Team, Match } from '../types';
import { calculateStandings } from '../utils/standings';
import type { Tab } from './Nav';

interface Props {
  teams: Team[];
  matches: Match[];
  onNavigate: (tab: Tab) => void;
}

export default function DashboardTab({ teams, matches, onNavigate }: Props) {
  const completedMatches = matches.filter(m => m.team1Score !== null);
  const standings = teams.length > 0 ? calculateStandings(teams, matches) : [];
  const leader = standings[0];
  const anyPlayed = completedMatches.length > 0;

  const recentMatches = completedMatches
    .slice()
    .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))
    .slice(0, 3);

  const teamMap = new Map(teams.map(t => [t.id, t]));

  return (
    <div className="space-y-5">
      {/* Title board — espresso-black sign */}
      <div className="bg-stone-950 rounded-2xl p-6 text-center shadow-xl shadow-black/40 border border-stone-800 card-texture">
        <p className="text-yellow-600 text-xs uppercase tracking-[0.2em] mb-2 font-bold">Welcome to the</p>
        <h1 className="text-stone-100 text-3xl font-black uppercase tracking-wide leading-tight">
          Pickleball League
        </h1>
        <div className="w-16 h-0.5 bg-yellow-700 mx-auto mt-3 mb-2 rounded-full opacity-60" />
        <p className="text-stone-500 text-sm">Family &amp; Friends Tournament Board</p>
      </div>

      {/* Stats grid — dark elevated panels */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Total Matches" value={matches.length} />
        <StatCard label="Played" value={completedMatches.length} />
        <StatCard
          label="Remaining"
          value={Math.max(0, matches.length - completedMatches.length)}
        />
      </div>

      {/* Leader board — muted gold accent card */}
      {anyPlayed && leader && (
        <div className="bg-yellow-950/25 border border-yellow-800/40 rounded-2xl p-4 shadow-md shadow-black/20">
          <p className="text-yellow-600 text-xs uppercase tracking-[0.15em] font-bold mb-3 flex items-center gap-1.5">
            <span>🏆</span> Current Leader
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-stone-100 font-black text-xl leading-tight truncate">{leader.team.name}</p>
              <p className="text-stone-400 text-sm mt-0.5">{leader.team.player1} &amp; {leader.team.player2}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-yellow-400 font-black text-2xl tabular-nums">{leader.wins}–{leader.losses}</p>
              <p className="text-stone-500 text-xs">
                {leader.played > 0 ? Math.round((leader.wins / leader.played) * 100) : 0}% win rate
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-stone-300 text-xs uppercase tracking-[0.15em] font-bold mb-3 px-0.5">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          <ActionButton label="Enter Score" sub="Record match result" onClick={() => onNavigate('schedule')} />
          <ActionButton label="View Standings" sub="League rankings" onClick={() => onNavigate('standings')} />
          <ActionButton label="Manage Teams" sub="Add or build teams" onClick={() => onNavigate('teams')} />
          <ActionButton label="Match History" sub="Past results" onClick={() => onNavigate('history')} />
        </div>
      </div>

      {/* Recent results */}
      {recentMatches.length > 0 && (
        <div>
          <p className="text-stone-300 text-xs uppercase tracking-[0.15em] font-bold mb-3 px-0.5">Recent Results</p>
          <div className="space-y-2">
            {recentMatches.map(m => {
              const t1 = teamMap.get(m.team1Id);
              const t2 = teamMap.get(m.team2Id);
              if (!t1 || !t2) return null;
              const t1Won = m.team1Score! > m.team2Score!;
              return (
                <div key={m.id} className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm shadow-black/20">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-sm font-bold ${t1Won ? 'text-yellow-400' : 'text-stone-400'}`}>{t1.name}</span>
                    <span className="font-mono text-base font-black text-stone-100 tabular-nums">{m.team1Score}–{m.team2Score}</span>
                    <span className={`text-sm font-bold ${!t1Won ? 'text-yellow-400' : 'text-stone-400'}`}>{t2.name}</span>
                  </div>
                  {m.playedAt && (
                    <time className="text-xs text-stone-500 flex-shrink-0 ml-2">
                      {new Date(m.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </time>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {teams.length === 0 && (
        <div className="text-center py-8">
          <p className="text-stone-400 text-sm">
            No teams set up yet.{' '}
            <button className="text-stone-200 underline font-semibold" onClick={() => onNavigate('teams')}>
              Head to Teams
            </button>{' '}
            to get started.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-stone-800 border border-stone-700 rounded-xl px-4 py-4 shadow-md shadow-black/20 text-center">
      <p className="text-3xl font-black text-stone-100 tabular-nums">{value}</p>
      <p className="text-stone-400 text-xs uppercase tracking-wider mt-1 font-semibold">{label}</p>
    </div>
  );
}

function ActionButton({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-emerald-50 rounded-xl px-4 py-3.5 text-left transition-colors shadow-md shadow-black/30 border border-emerald-900/60"
    >
      <p className="font-bold text-sm tracking-wide">{label}</p>
      <p className="text-emerald-300/80 text-xs mt-0.5">{sub}</p>
    </button>
  );
}
