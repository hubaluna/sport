import {BookOpen, CalendarDays, Dumbbell, Settings} from 'lucide-react';
import type {TabRoute} from '../types/forge';

interface BottomNavProps {
  currentRoute: TabRoute;
  onNavigate: (route: TabRoute) => void;
}

const TABS: {route: TabRoute; label: string; icon: typeof Dumbbell}[] = [
  {route: 'home', label: 'План', icon: CalendarDays},
  {route: 'diary', label: 'Щоденник', icon: BookOpen},
  {route: 'guide', label: 'Тренер', icon: Dumbbell},
  {route: 'profile', label: 'Профіль', icon: Settings},
];

export function BottomNav({currentRoute, onNavigate}: BottomNavProps) {
  return (
    <nav
      aria-label="Мобільна навігація"
      className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#111310]/95 backdrop-blur-md pb-safe"
    >
      <div className="grid grid-cols-4 items-center h-13 px-2">
        {TABS.map(({route, label, icon: Icon}) => {
          const active =
            currentRoute === route ||
            (route === 'home' && (currentRoute === 'plan' || currentRoute === 'fullplan'));
          return (
            <button
              key={route}
              type="button"
              onClick={() => onNavigate(route)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-[#CEFA42] ${
                active ? 'text-[#CEFA42]' : 'text-[#9FA995] hover:text-[#F2F6EB]'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[11px] font-medium tracking-tight leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
