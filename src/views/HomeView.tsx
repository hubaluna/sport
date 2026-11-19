import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {useMemo, useState} from 'react';
import {
  COMBO_TABLE,
  CYCLE_LABELS,
  PROFILE,
  PULL_REFERENCE,
  SHORT,
  WEEKS,
} from '../data/program';
import {calendarMonday, cycleDaysFor, dateISO} from '../engine/calendar';
import {daysSinceLastWorkout, pullPlan} from '../engine/progression';
import {buildSessionPlan} from '../engine/session';
import type {ForgeState, SessionRow, TabRoute} from '../types/forge';

interface HomeViewProps {
  state: ForgeState;
  isInstalled: boolean;
  onSelectFrequency: (freq: 3 | 4) => void;
  onSelectWeek: (week: number) => void;
  onSelectDay: (day: number) => void;
  onStartWorkout: (day: number) => void;
  onStartReturnWorkout: () => void;
  onResumeWorkout: () => void;
  onOpenExerciseHelp: (name: string, note?: string) => void;
  onNavigate: (route: TabRoute) => void;
  onOpenInstall: () => void;
  onDismissInstall: () => void;
}

function sessionPreviewRows(rows: SessionRow[], limit: number): SessionRow[] {
  const filtered = rows.filter(
    (r) =>
      !['warm', 'cool', 'prep', 'instruction'].includes(r.kind || '') &&
      !/^\d\./.test(r.name),
  );
  const pullRows = filtered.filter((r) => r.mainPull);
  let shownPull = false;

  return filtered
    .flatMap((r) => {
      if (!r.mainPull) return [r];
      if (shownPull) return [];
      shownPull = true;
      const targets = pullRows.map((p) => p.reps ?? 0);
      const sets = targets.every((n) => n === targets[0])
        ? `${targets.length} × ${targets[0]}`
        : targets.join(' / ');
      return [{...r, sets}];
    })
    .slice(0, limit);
}

export function HomeView({
  state,
  isInstalled,
  onSelectFrequency,
  onSelectWeek,
  onSelectDay,
  onStartWorkout,
  onStartReturnWorkout,
  onResumeWorkout,
  onOpenExerciseHelp,
  onNavigate,
  onOpenInstall,
  onDismissInstall,
}: HomeViewProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<'progress' | 'coach' | 'table' | null>(null);

  const cycleDays = cycleDaysFor(state.frequency);
  const curIdx = Math.max(0, Math.min(state.currentWorkoutIndex || 0, cycleDays.length - 1));
  const selIdx = cycleDays.indexOf(state.selectedDay);
  const activeIdx = selIdx >= 0 ? selIdx : curIdx;
  const currentDay = cycleDays[activeIdx] ?? 0;

  const plan = buildSessionPlan(state.week, currentDay, state);
  const cycleLabel = CYCLE_LABELS[activeIdx] || 'А';
  const cycleNum = activeIdx + 1;
  const doneInCycle = state.completedInCycle || 0;
  const weekMeta = WEEKS[state.week - 1] || WEEKS[0];
  const hasActive = !!state.active && state.active.phase !== 'summary';
  const daysSince = daysSinceLastWorkout(state.logs);
  const showReturnHint = state.logs.length === 0 || daysSince >= 7;
  const previewRows = sessionPreviewRows(plan.rows, hasActive ? 2 : 3);
  const pullInfo = pullPlan(state.week, currentDay === 4 ? 4 : 0, state);

  // 7-day factual activity strip (current calendar week Mon..Sun) — ONLY completed logs, no future schedule
  const weekActivity = useMemo(() => {
    const todayIso = dateISO();
    const monIso = calendarMonday(todayIso);
    const monDate = new Date(monIso + 'T12:00:00Z');
    const completedDates = new Set(
      (state.logs || []).filter((l) => l.completed).map((l) => l.date),
    );
    return SHORT.map((label, idx) => {
      const d = new Date(monDate);
      d.setUTCDate(monDate.getUTCDate() + idx);
      const iso = d.toISOString().slice(0, 10);
      return {
        label,
        dayNum: d.getUTCDate(),
        iso,
        isToday: iso === todayIso,
        done: completedDates.has(iso),
      };
    });
  }, [state.logs]);

  const toggleAcc = (key: 'progress' | 'coach' | 'table') =>
    setOpenAccordion((prev) => (prev === key ? null : key));

  return (
    <div className="space-y-3">
      {/* Compact Header Row: Level + 3/4 day switcher + level select */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F6EB] leading-none">
            Рівень {state.week} / 8
          </h1>
          <p className="text-[11px] text-[#9FA995] mt-0.5 truncate">{weekMeta.name}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            role="group"
            aria-label="Режим циклу"
            className="inline-flex items-center rounded-xl border border-white/10 bg-[#191D16] p-0.5"
          >
            {([3, 4] as const).map((freq) => {
              const selected = state.frequency === freq;
              return (
                <button
                  key={freq}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectFrequency(freq)}
                  className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    selected
                      ? 'bg-[#CEFA42] text-[#111310]'
                      : 'text-[#9FA995] hover:text-[#F2F6EB]'
                  }`}
                >
                  {freq} дні
                </button>
              );
            })}
          </div>

          <label className="sr-only" htmlFor="week-select">
            Рівень циклу
          </label>
          <select
            id="week-select"
            value={state.week}
            onChange={(e) => onSelectWeek(Number(e.target.value))}
            className="min-h-[38px] max-w-[130px] rounded-xl border border-white/10 bg-[#191D16] px-2.5 py-1 text-xs font-semibold text-[#F2F6EB] focus-visible:outline-2 focus-visible:outline-[#CEFA42]"
          >
            {WEEKS.map((w, idx) => (
              <option key={idx + 1} value={idx + 1}>
                Рівень {idx + 1} · {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 7-Day Factual Activity Strip (completed sessions only) */}
      <div
        aria-label="Фактична активність цього тижня"
        className="grid grid-cols-7 gap-1 rounded-xl border border-white/10 bg-[#191D16] px-2 py-1.5"
      >
        {weekActivity.map((d) => (
          <div
            key={d.iso}
            className={`flex flex-col items-center justify-center rounded-lg py-1 ${
              d.isToday ? 'bg-white/5' : ''
            }`}
          >
            <span className="text-[10px] text-[#9FA995] leading-none">{d.label}</span>
            <span
              className={`mt-1 text-xs font-mono tabular-nums leading-none ${
                d.isToday ? 'font-bold text-[#F2F6EB]' : 'text-[#BAC4B0]'
              }`}
            >
              {d.dayNum}
            </span>
            <span
              aria-label={d.done ? 'Тренування виконано' : undefined}
              className={`mt-1 h-1.5 w-1.5 rounded-full ${
                d.done ? 'bg-[#CEFA42]' : 'bg-transparent'
              }`}
            />
          </div>
        ))}
      </div>

      {hasActive && state.active && (
        <section
          aria-label="Незавершене заняття"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#CEFA42]/50 bg-[#1E2616] px-3.5 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#CEFA42] leading-tight">
              Активне заняття збережено
            </p>
            <p className="text-xs font-bold text-[#F2F6EB] truncate">
              {state.active.title} · рівень {state.active.week}
            </p>
          </div>
          <button
            type="button"
            onClick={onResumeWorkout}
            className="min-h-[38px] rounded-xl bg-[#CEFA42] px-3.5 py-1.5 text-xs font-bold text-[#111310] whitespace-nowrap shrink-0"
          >
            Продовжити
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-3.5 items-start">
        {/* Left / Primary Card: Next in Queue */}
        <section className="rounded-2xl border border-[#CEFA42]/35 bg-[#191D16] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-[#9FA995]">
            <span className="truncate">
              Наступне по черзі · Цикл {state.week} / 8 · Заняття {cycleNum} з {state.frequency}
            </span>
            <span className="font-mono tabular-nums text-[#F2F6EB] shrink-0">
              {plan.minutes} хв
            </span>
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F2F6EB] leading-tight">
            {plan.title}
          </h2>

          {showPicker && (
            <div
              role="tablist"
              aria-label="Обрати заняття в циклі"
              className="grid gap-1.5 pt-0.5"
              style={{gridTemplateColumns: `repeat(${cycleDays.length}, minmax(0, 1fr))`}}
            >
              {cycleDays.map((day, idx) => {
                const isSelected = activeIdx === idx;
                const isDone = idx < doneInCycle;
                return (
                  <button
                    key={day}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectDay(day);
                      setShowPicker(false);
                    }}
                    className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl border px-1.5 py-1 transition-colors ${
                      isSelected
                        ? 'border-[#CEFA42] bg-[#222B18] text-[#F2F6EB]'
                        : isDone
                          ? 'border-white/15 bg-[#111310]/60 text-[#F2F6EB]'
                          : 'border-white/10 bg-[#111310]/40 text-[#9FA995]'
                    }`}
                  >
                    <span className="font-display text-base font-bold leading-none">
                      {CYCLE_LABELS[idx]}
                    </span>
                    <span
                      className={`mt-1 text-[10px] leading-none whitespace-nowrap ${
                        isSelected
                          ? 'text-[#CEFA42]'
                          : isDone
                            ? 'text-[#B4D854]'
                            : 'text-[#9FA995]'
                      }`}
                    >
                      {isDone ? '✓ Готово' : isSelected ? 'Обрано' : 'Черга'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="divide-y divide-white/10 border-y border-white/10">
            {previewRows.map((row, idx) => (
              <div
                key={`${row.name}-${idx}`}
                className="flex items-center justify-between gap-3 py-1.5 text-xs sm:text-sm"
              >
                <span className="text-[#DCE3D3] truncate">{row.name}</span>
                <strong className="font-mono tabular-nums text-xs text-[#CEFA42] shrink-0">
                  {row.sets}
                </strong>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onStartWorkout(currentDay)}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2.5 text-sm font-bold text-[#111310] hover:bg-[#d8fc64] active:scale-[0.99] transition-transform"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Почати заняття {cycleLabel}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-expanded={showPicker}
                onClick={() => setShowPicker((v) => !v)}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] px-2.5 py-2 text-xs font-semibold text-[#F2F6EB] hover:border-[#CEFA42]/50 whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#CEFA42] shrink-0" />
                <span className="truncate">Обрати інше заняття</span>
              </button>

              <button
                type="button"
                onClick={onStartReturnWorkout}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] px-2.5 py-2 text-xs font-semibold text-[#F2F6EB] hover:border-[#CEFA42]/50 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#CEFA42] shrink-0" />
                <span className="truncate">Давно не займався</span>
              </button>
            </div>

            {showReturnHint && (
              <p className="text-[11px] text-[#9FA995] leading-snug">
                Перерва понад 7 днів — почни з легкого втягування без кріпатури
              </p>
            )}
          </div>

          {/* Expandable Full Exercise List */}
          <div className="border-t border-white/10 pt-1">
            <button
              type="button"
              aria-expanded={showAllExercises}
              onClick={() => setShowAllExercises((v) => !v)}
              className="min-h-[38px] w-full flex items-center justify-between text-xs font-semibold text-[#CEFA42]"
            >
              <span>Усі вправи, підходи й техніка ({plan.rows.length})</span>
              {showAllExercises ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAllExercises && (
              <div className="mt-1 divide-y divide-white/10 border-t border-white/10">
                {plan.rows.map((row, idx) => (
                  <div
                    key={`${row.name}-${idx}`}
                    className="py-2 flex items-start justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F2F6EB]">{row.name}</p>
                      <p className="text-[11px] text-[#9FA995] leading-snug mt-0.5">{row.note}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        <span className="block font-mono tabular-nums text-xs font-bold text-[#CEFA42]">
                          {row.sets}
                        </span>
                        <span className="block text-[10px] text-[#9FA995]">відп. {row.rest}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenExerciseHelp(row.name, row.note)}
                        aria-label={`Техніка: ${row.name}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-white/10 bg-[#21271D] text-[#CEFA42]"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right / Secondary Column: Compact Accordions */}
        <aside className="space-y-2">
          {/* Accordion 1: Cycle Progress & Records */}
          <section className="rounded-xl border border-white/10 bg-[#191D16] px-3.5 py-2">
            <button
              type="button"
              aria-expanded={openAccordion === 'progress'}
              onClick={() => toggleAcc('progress')}
              className="min-h-[40px] w-full flex items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#F2F6EB] block">
                  Прогрес циклу · {doneInCycle}/{state.frequency}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[#9FA995] block truncate">
                  Відж. {state.coach.pushMax ?? PROFILE.push} · Строгі{' '}
                  {state.coach.strictMax ?? PROFILE.pull} · Резинка{' '}
                  {state.coach.assistedMax ?? PROFILE.assisted}
                </span>
              </div>
              {openAccordion === 'progress' ? (
                <ChevronUp className="w-4 h-4 text-[#CEFA42] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#9FA995] shrink-0" />
              )}
            </button>

            <div className={`${openAccordion === 'progress' ? 'block' : 'hidden lg:block'} pt-2 pb-1.5 space-y-2.5 border-t border-white/10 mt-1.5`}>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2A3124]">
                <div
                  className="h-full bg-[#CEFA42] transition-all duration-300"
                  style={{width: `${Math.min(100, (100 * doneInCycle) / state.frequency)}%`}}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="font-display text-xl font-bold tabular-nums text-[#F2F6EB]">
                    {state.coach.pushMax ?? PROFILE.push}
                  </p>
                  <p className="text-[11px] text-[#9FA995]">віджимання</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold tabular-nums text-[#CEFA42]">
                    {state.coach.strictMax ?? PROFILE.pull}
                  </p>
                  <p className="text-[11px] text-[#9FA995]">строгі</p>
                </div>
                <div>
                  <p className="font-display text-xl font-bold tabular-nums text-[#F2F6EB]">
                    {state.coach.assistedMax ?? PROFILE.assisted}
                  </p>
                  <p className="text-[11px] text-[#9FA995]">з резинкою</p>
                </div>
              </div>
            </div>
          </section>

          {/* Accordion 2: Coach Advice */}
          <section className="rounded-xl border border-white/10 bg-[#191D16] px-3.5 py-2">
            <button
              type="button"
              aria-expanded={openAccordion === 'coach'}
              onClick={() => toggleAcc('coach')}
              className="min-h-[40px] w-full flex items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#F2F6EB] block">
                  Порада тренера · тяга ({pullInfo.targets.join('/')})
                </span>
                <span className="text-[11px] text-[#9FA995] block truncate">
                  {pullInfo.mode === 'foundation'
                    ? 'Підготовчий етап · тяга резинки'
                    : pullInfo.mode === 'band'
                      ? `Робота з резинкою · ${state.band}`
                      : 'Строгі підтягування без резинки'}
                </span>
              </div>
              {openAccordion === 'coach' ? (
                <ChevronUp className="w-4 h-4 text-[#CEFA42] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#9FA995] shrink-0" />
              )}
            </button>

            <div className={`${openAccordion === 'coach' ? 'block' : 'hidden lg:block'} pt-2 pb-1.5 border-t border-white/10 mt-1.5 space-y-1.5`}>
              <p className="font-mono tabular-nums text-xs font-bold text-[#CEFA42]">
                Рівень {pullInfo.level + 1}/5 · Ціль: {pullInfo.targets.join(' / ')}
              </p>
              <p className="text-xs text-[#9FA995] leading-relaxed">{pullInfo.reason}</p>
            </div>
          </section>

          {/* Accordion 3: 8-Week Overview Table */}
          <section className="rounded-xl border border-white/10 bg-[#191D16] px-3.5 py-2">
            <button
              type="button"
              aria-expanded={openAccordion === 'table'}
              onClick={() => toggleAcc('table')}
              className="min-h-[40px] w-full flex items-center justify-between gap-2 text-left"
            >
              <span className="text-xs font-bold text-[#F2F6EB]">8-тижнева таблиця програми</span>
              {openAccordion === 'table' ? (
                <ChevronUp className="w-4 h-4 text-[#CEFA42] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#9FA995] shrink-0" />
              )}
            </button>

            {openAccordion === 'table' && (
              <div className="pt-2 pb-1.5 border-t border-white/10 mt-1.5 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[#9FA995]">
                        <th className="py-1.5 pr-2 font-semibold">Рівень</th>
                        <th className="py-1.5 pr-2 font-semibold">Тяга А/В</th>
                        <th className="py-1.5 font-semibold">Комплекс Б</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {WEEKS.map((w, i) => (
                        <tr
                          key={i}
                          className={state.week === i + 1 ? 'text-[#CEFA42]' : 'text-[#DCE3D3]'}
                        >
                          <td className="py-1.5 pr-2 font-medium">
                            {i + 1}. {w.name}
                          </td>
                          <td className="py-1.5 pr-2 font-mono tabular-nums whitespace-nowrap">
                            {PULL_REFERENCE[i]}
                          </td>
                          <td className="py-1.5 font-mono tabular-nums whitespace-nowrap">
                            {COMBO_TABLE[i][1][0]} × ({COMBO_TABLE[i][1].slice(1).join('/')})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('fullplan')}
                  className="min-h-[36px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#CEFA42] hover:underline"
                >
                  <span>Повна програма та друк / PDF</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </section>

          {!isInstalled && !state.installDismissed && (
            <section className="rounded-xl border border-white/10 bg-[#191D16] px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#F2F6EB] truncate">
                Додати FORGE / 8 на екран
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onOpenInstall}
                  className="min-h-[36px] rounded-lg bg-[#21271D] border border-white/15 px-3 text-xs font-semibold text-[#CEFA42]"
                >
                  Встановити
                </button>
                <button
                  type="button"
                  onClick={onDismissInstall}
                  className="min-h-[36px] px-2 text-xs text-[#9FA995]"
                >
                  ×
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
