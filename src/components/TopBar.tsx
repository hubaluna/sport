import {BookOpen, CalendarDays, Dumbbell, Settings} from 'lucide-react';
import type {TabRoute, WorkoutSession} from '../types/forge';

interface TopBarProps {
  currentRoute: TabRoute;
  activeWorkout: WorkoutSession | null;
  onNavigate: (route: TabRoute) => void;
  onResumeWorkout: () => void;
}

const NAV_ITEMS: {route: TabRoute; label: string; icon: typeof Dumbbell}[] = [
  {route: 'home', label: 'План', icon: CalendarDays},
  {route: 'diary', label: 'Щоденник', icon: BookOpen},
  {route: 'guide', label: 'Тренер', icon: Dumbbell},
  {route: 'profile', label: 'Профіль', icon: Settings},
];

export function TopBar({
  currentRoute,
  activeWorkout,
  onNavigate,
  onResumeWorkout,
}: TopBarProps) {
  const isTabActive = (route: TabRoute) =>
    currentRoute === route ||
    (route === 'home' && (currentRoute === 'plan' || currentRoute === 'fullplan'));

  const hasResumable = activeWorkout && activeWorkout.phase !== 'summary';

  return (
    <header className="no-print sticky top-0 z-30 border-b border-white/10 bg-[#111310]/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-3.5 sm:px-6 md:gap-8">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('home');
          }}
          className="font-display text-lg font-bold tracking-tight text-[#F2F6EB] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#CEFA42]"
        >
          FORGE / 8
        </a>

        <nav
          aria-label="Основна навігація"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9FA995]"
        >
          {NAV_ITEMS.map(({route, label}) => {
            const active = isTabActive(route);
            return (
              <a
                key={route}
                href={`#${route}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(route);
                }}
                aria-current={active ? 'page' : undefined}
                className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  active
                    ? 'border-[#CEFA42] text-[#F2F6EB]'
                    : 'border-transparent hover:text-[#F2F6EB]'
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          {hasResumable ? (
            <button
              type="button"
              onClick={onResumeWorkout}
              className="min-h-[38px] rounded-xl bg-[#CEFA42] px-4 py-1.5 text-xs font-bold text-[#111310] whitespace-nowrap shrink-0 transition-transform active:scale-[0.98] hover:bg-[#d8fc64] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CEFA42]"
            >
              Продовжити заняття
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('wod')}
              className="min-h-[38px] rounded-xl border border-white/15 bg-[#191D16] px-4 py-1.5 text-xs font-semibold text-[#F2F6EB] whitespace-nowrap shrink-0 transition-colors hover:border-[#CEFA42]/50 hover:text-[#CEFA42] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CEFA42]"
            >
              WOD 22 хв
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
