import {HelpCircle, Search, Timer} from 'lucide-react';
import {useMemo, useState} from 'react';
import {EXERCISES} from '../data/exercises';
import {GUIDE, READINESS} from '../data/program';
import type {ForgeState} from '../types/forge';

interface GuideViewProps {
  state: ForgeState;
  onToggleReadiness: (index: number) => void;
  onOpenExerciseHelp: (name: string) => void;
  onStartWod: () => void;
}

export function GuideView({
  state,
  onToggleReadiness,
  onOpenExerciseHelp,
  onStartWod,
}: GuideViewProps) {
  const [search, setSearch] = useState('');
  const readySet = new Set(state.ready || []);

  const exercisesList = useMemo(() => {
    const q = search.toLocaleLowerCase('uk-UA').trim();
    return Object.values(EXERCISES).filter((ex) => {
      if (!q) return true;
      return `${ex.name} ${ex.category}`.toLocaleLowerCase('uk-UA').includes(q);
    });
  }, [search]);

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB]">Тренер</h1>
        <p className="text-xs text-[#9FA995]">
          Техніка вправ, контрольний WOD 22 хв і правила прогресії.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3.5">
          <section className="rounded-2xl border border-[#CEFA42]/35 bg-[#191D16] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-[#CEFA42]">Контрольний тест</p>
              <h2 className="text-base font-bold text-[#F2F6EB]">
                WOD Таймер · 22:00 · 5 раундів
              </h2>
              <p className="text-[11px] text-[#9FA995] mt-0.5">
                10 віджимань · 10 стрибків у планці · 5 вистрибувань · 10 прес
              </p>
            </div>
            <button
              type="button"
              onClick={onStartWod}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2 text-xs font-bold text-[#111310] whitespace-nowrap shrink-0"
            >
              <Timer className="w-4 h-4" />
              <span>Запустити WOD</span>
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#F2F6EB]">Бібліотека вправ</h2>
              <span className="text-xs font-mono tabular-nums text-[#9FA995]">
                {exercisesList.length} вправ
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#9FA995] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Знайти вправу (міст, тяга, планка…)"
                className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] pl-10 pr-3.5 py-2 text-sm text-[#F2F6EB] placeholder:text-[#9FA995]/70 focus-visible:outline-2 focus-visible:outline-[#CEFA42]"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-white/10 pr-1">
              {exercisesList.map((ex) => (
                <div
                  key={ex.name}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F2F6EB] truncate">{ex.name}</p>
                    <p className="text-xs text-[#9FA995] truncate">{ex.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenExerciseHelp(ex.name)}
                    aria-label={`Відкрити техніку: ${ex.name}`}
                    className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#CEFA42] hover:bg-white/10 shrink-0"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold text-[#F2F6EB]">Чек-лист готовності до тесту</h2>
              <span className="text-xs font-mono tabular-nums text-[#CEFA42]">
                {readySet.size}/{READINESS.length}
              </span>
            </div>
            <div className="divide-y divide-white/10">
              {READINESS.map((text, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-3 py-2.5 text-xs text-[#DCE3D3] leading-relaxed cursor-pointer min-h-[44px]"
                >
                  <input
                    type="checkbox"
                    checked={readySet.has(idx)}
                    onChange={() => onToggleReadiness(idx)}
                    className="mt-0.5 h-4 w-4 accent-[#CEFA42] shrink-0"
                  />
                  <span>{text}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 space-y-2">
            <h2 className="text-base font-bold text-[#F2F6EB] mb-2">Методика програми</h2>
            <div className="divide-y divide-white/10">
              {GUIDE.map((g) => (
                <details key={g.title} className="py-2.5 group">
                  <summary className="min-h-[38px] flex items-center justify-between cursor-pointer text-sm font-semibold text-[#F2F6EB] group-open:text-[#CEFA42]">
                    <span>{g.title}</span>
                  </summary>
                  <p className="mt-2 text-xs text-[#9FA995] leading-relaxed whitespace-pre-line">
                    {g.text}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
