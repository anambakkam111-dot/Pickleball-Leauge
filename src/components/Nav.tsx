export type Tab = 'home' | 'teams' | 'schedule' | 'practice' | 'standings' | 'history' | 'admin';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'teams', label: 'Teams' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'practice', label: 'Practice Games' },
  { id: 'standings', label: 'Standings' },
  { id: 'history', label: 'History' },
  { id: 'admin', label: '🔒 Admin' },
];

export default function Nav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="bg-stone-900 sticky top-0 z-10 shadow-lg shadow-black/40 border-b border-stone-800">
      <div className="max-w-4xl mx-auto flex overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-shrink-0 px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-yellow-500 text-yellow-400 bg-stone-950/60'
                : 'border-transparent text-stone-400 hover:text-yellow-400 hover:border-stone-700 hover:bg-stone-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
