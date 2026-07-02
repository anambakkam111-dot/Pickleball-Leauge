import { useState, useEffect } from 'react';
import type { Team, Match, PlayerRating, PracticeMatch } from './types';
import {
  loadLeague, saveLeague,
  loadRatings, saveRatings,
  loadPracticeMatches, savePracticeMatches,
} from './storage';
import { SEED_RATINGS } from './data/seedRatings';
import { generateCustomSchedule } from './utils/matchups';
import { recalculatePlayerRatings } from './utils/ratingRecalculation';
import Nav from './components/Nav';
import type { Tab } from './components/Nav';
import DashboardTab from './components/DashboardTab';
import TeamsTab from './components/TeamsTab';
import ScheduleTab from './components/ScheduleTab';
import PracticeGamesTab from './components/PracticeGamesTab';
import StandingsTab from './components/StandingsTab';
import HistoryTab from './components/HistoryTab';
import AdminPage from './components/AdminPage';

export default function App() {
  const [teams, setTeams] = useState<Team[]>(() => loadLeague().teams);
  const [matches, setMatches] = useState<Match[]>(() => loadLeague().matches);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Ratings: the single central player database (id, name, rating, tier, notes).
  // Seed on first load if empty.
  const [ratings, setRatings] = useState<PlayerRating[]>(() => {
    const saved = loadRatings();
    if (saved.length === 0) {
      saveRatings(SEED_RATINGS);
      return SEED_RATINGS;
    }
    return saved;
  });

  const [practiceMatches, setPracticeMatches] = useState<PracticeMatch[]>(() => loadPracticeMatches());

  // Persist league whenever it changes
  useEffect(() => {
    saveLeague({ teams, matches });
  }, [teams, matches]);

  // Persist ratings whenever they change
  useEffect(() => {
    saveRatings(ratings);
  }, [ratings]);

  // Persist practice matches whenever they change
  useEffect(() => {
    savePracticeMatches(practiceMatches);
  }, [practiceMatches]);

  // ─── Centralized rating recalculation ────────────────────────────────────────
  // Runs any time the match history (tournament or practice) changes — i.e. on
  // every create/edit/delete of either match type. Currently a no-op
  // placeholder (see utils/ratingRecalculation.ts) that preserves whatever
  // ratings/tiers are set manually in Admin.
  useEffect(() => {
    setRatings(prev => recalculatePlayerRatings([...matches, ...practiceMatches], prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, practiceMatches]);

  const completedCount = matches.filter(m => m.team1Score !== null).length;

  // ─── Team / schedule handlers ────────────────────────────────────────────────

  const handleAddTeam = (team: Team) => setTeams(prev => [...prev, team]);

  const handleRemoveTeam = (id: string) => setTeams(prev => prev.filter(t => t.id !== id));

  const handleSaveGeneratedTeams = (newTeams: Team[]): boolean => {
    const replace = teams.length === 0 || window.confirm(
      `Replace all ${teams.length} existing team${teams.length !== 1 ? 's' : ''} with ${newTeams.length} generated teams? The current schedule will also be cleared.`
    );
    if (!replace) return false;
    setTeams(newTeams);
    setMatches([]);
    setActiveTab('teams');
    return true;
  };

  const handleGenerateSchedule = (gamesPerTeam: number) => {
    setMatches(generateCustomSchedule(teams, gamesPerTeam));
    setActiveTab('schedule');
  };

  const handleClearScore = (matchId: string) => {
    setMatches(prev =>
      prev.map(m =>
        m.id === matchId ? { ...m, team1Score: null, team2Score: null, playedAt: null } : m
      )
    );
  };

  // Full match correction: reassign teams, edit score, edit date, in one save.
  const handleUpdateMatch = (
    matchId: string,
    patch: { team1Id: string; team2Id: string; team1Score: number | null; team2Score: number | null; playedAt: string | null }
  ) => {
    setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, ...patch } : m)));
  };

  const handleDeleteMatch = (matchId: string) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
  };

  // ─── Practice match handlers ─────────────────────────────────────────────────

  const handleAddPracticeMatch = (match: Omit<PracticeMatch, 'id' | 'matchType' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    setPracticeMatches(prev => [
      ...prev,
      { ...match, id: crypto.randomUUID(), matchType: 'practice', createdAt: now, updatedAt: now },
    ]);
  };

  const handleUpdatePracticeMatch = (
    matchId: string,
    patch: Omit<PracticeMatch, 'id' | 'matchType' | 'createdAt' | 'updatedAt'>
  ) => {
    setPracticeMatches(prev =>
      prev.map(m => (m.id === matchId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m))
    );
  };

  const handleDeletePracticeMatch = (matchId: string) => {
    setPracticeMatches(prev => prev.filter(m => m.id !== matchId));
  };

  const handleReset = () => {
    if (window.confirm('Reset the entire league? All teams and scores will be deleted. This cannot be undone.')) {
      setTeams([]);
      setMatches([]);
      setActiveTab('home');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Espresso-black header */}
      <header className="bg-stone-950 shadow-xl shadow-black/50 border-b border-stone-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-black uppercase tracking-widest text-stone-100">
            🏓 Pickleball League
          </h1>
          <p className="text-yellow-700 text-xs mt-0.5 tracking-wide">
            {teams.length} team{teams.length !== 1 ? 's' : ''}
            {matches.length > 0 && ` · ${completedCount}/${matches.length} matches played`}
          </p>
        </div>
      </header>

      <Nav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-5 pb-14">
        {activeTab === 'home' && (
          <DashboardTab teams={teams} matches={matches} onNavigate={setActiveTab} />
        )}
        {activeTab === 'teams' && (
          <TeamsTab
            teams={teams}
            ratings={ratings}
            hasMatches={matches.length > 0}
            onAddTeam={handleAddTeam}
            onRemoveTeam={handleRemoveTeam}
            onSaveGeneratedTeams={handleSaveGeneratedTeams}
            onGenerateSchedule={handleGenerateSchedule}
            onReset={handleReset}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            teams={teams}
            matches={matches}
            onClearScore={handleClearScore}
            onUpdateMatch={handleUpdateMatch}
            onDeleteMatch={handleDeleteMatch}
          />
        )}
        {activeTab === 'practice' && (
          <PracticeGamesTab
            players={ratings}
            practiceMatches={practiceMatches}
            onAddMatch={handleAddPracticeMatch}
            onUpdateMatch={handleUpdatePracticeMatch}
            onDeleteMatch={handleDeletePracticeMatch}
          />
        )}
        {activeTab === 'standings' && (
          <StandingsTab teams={teams} matches={matches} />
        )}
        {activeTab === 'history' && (
          <HistoryTab
            teams={teams}
            matches={matches}
            onNavigateToSchedule={() => setActiveTab('schedule')}
            onDeleteMatch={handleDeleteMatch}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPage ratings={ratings} onUpdateRatings={setRatings} />
        )}
      </main>
    </div>
  );
}
