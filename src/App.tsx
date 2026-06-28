import { useState, useEffect } from 'react';
import type { Team, Match, PlayerRating } from './types';
import { loadLeague, saveLeague, loadRatings, saveRatings } from './storage';
import { SEED_RATINGS } from './data/seedRatings';
import { generateCustomSchedule } from './utils/matchups';
import Nav from './components/Nav';
import type { Tab } from './components/Nav';
import DashboardTab from './components/DashboardTab';
import TeamsTab from './components/TeamsTab';
import ScheduleTab from './components/ScheduleTab';
import StandingsTab from './components/StandingsTab';
import HistoryTab from './components/HistoryTab';
import AdminPage from './components/AdminPage';

export default function App() {
  const [teams, setTeams] = useState<Team[]>(() => loadLeague().teams);
  const [matches, setMatches] = useState<Match[]>(() => loadLeague().matches);
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // Ratings: seed on first load if empty
  const [ratings, setRatings] = useState<PlayerRating[]>(() => {
    const saved = loadRatings();
    if (saved.length === 0) {
      saveRatings(SEED_RATINGS);
      return SEED_RATINGS;
    }
    return saved;
  });

  // Persist league whenever it changes
  useEffect(() => {
    saveLeague({ teams, matches });
  }, [teams, matches]);

  // Persist ratings whenever they change
  useEffect(() => {
    saveRatings(ratings);
  }, [ratings]);

  const completedCount = matches.filter(m => m.team1Score !== null).length;

  // ─── Handlers ───────────────────────────────────────────────────────────────

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

  const handleSubmitScore = (matchId: string, s1: number, s2: number) => {
    setMatches(prev =>
      prev.map(m =>
        m.id === matchId
          ? { ...m, team1Score: s1, team2Score: s2, playedAt: new Date().toISOString() }
          : m
      )
    );
  };

  const handleClearScore = (matchId: string) => {
    setMatches(prev =>
      prev.map(m =>
        m.id === matchId ? { ...m, team1Score: null, team2Score: null, playedAt: null } : m
      )
    );
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
      {/* Dark mahogany header */}
      <header className="bg-amber-950 shadow-xl border-b-2 border-amber-900">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-black uppercase tracking-widest text-amber-100">
            🏓 Pickleball League
          </h1>
          <p className="text-amber-600 text-xs mt-0.5 tracking-wide">
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
            onSubmitScore={handleSubmitScore}
            onClearScore={handleClearScore}
          />
        )}
        {activeTab === 'standings' && (
          <StandingsTab teams={teams} matches={matches} />
        )}
        {activeTab === 'history' && (
          <HistoryTab teams={teams} matches={matches} />
        )}
        {activeTab === 'admin' && (
          <AdminPage
            ratings={ratings}
            onUpdateRatings={setRatings}
          />
        )}
      </main>
    </div>
  );
}
