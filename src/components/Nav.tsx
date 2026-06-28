export type Tab = 'home' | 'teams' | 'schedule' | 'standings' | 'history' | 'admin';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'teams', label: 'Teams' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
  { id: 'history', label: 'History' },
  { id: 'admin', label: '🔒 Admin' },
];

export default function Nav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="bg-amber-900 sticky top-0 z-10 shadow-lg border-b-2 border-amber-950">
      <div className="max-w-4xl mx-auto flex overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-yellow-400 text-yellow-300 bg-amber-950/30'
                : 'border-transparent text-amber-300 hover:text-yellow-200 hover:border-amber-700 hover:bg-amber-950/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
