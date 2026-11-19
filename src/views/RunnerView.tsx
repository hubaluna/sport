import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {MOVES, TECHNIQUE} from '../data/program';
import {clock} from '../engine/calendar';
import {evaluateWorkoutProgression} from '../engine/progression';
import {
  complexMilliseconds,
  currentStep,
  timerRemaining,
  workoutMilliseconds,
} from '../engine/workout';
import type {
  AssistanceType,
  ForgeState,
  TabRoute,
  Wellbeing,
  WorkoutSession,
} from '../types/forge';

interface RunnerViewProps {
  state: ForgeState;
  pendingWorkout: WorkoutSession | null;
  wakeLockActive: boolean;
  wakeLockStatusText: string;
  onStartPendingWithWarmup: () => void;
  onSkipPendingWarmup: () => void;
  onCancelPending: () => void;
  onOpenExerciseHelp: (name: string, note?: string) => void;
  onPauseToggle: () => void;
  onStartMiniTimer: () => void;
  onRepeatMini: () => void;
  onSkipStep: () => void;
  onCompleteMiniManual: () => void;
  onStartWarmupGateRest: () => void;
  onFinishWarmupGate: () => void;
  onRepeatWarmup: () => void;
  onStopDueToPain: () => void;
  onStartComplex: () => void;
  onConfirmComplexMove: (reps: number, modified: boolean) => void;
  onEndComplexEarly: () => void;
  onConfirmComplexEnd: (standard: boolean) => void;
  onConfirmStep: (reps: number, modified: boolean) => void;
  onStartTimedStep: () => void;
  onExtendRest: (seconds: 30 | 60) => void;
  onFinishRestEarly: () => void;
  onSetAssistanceOverride: (assist: AssistanceType) => void;
  onSetEccentricOverride: (sec: number) => void;
  onToggleSound: () => void;
  onInterruptWorkout: (painStop?: boolean) => void;
  onSaveSummary: (feedback: {
    rpe: number | null;
    pain: number | null;
    pullReserve: number | null;
    sleep: number | null;
    wellbeing: Wellbeing | null;
    notes: string;
  }) => void;
  onNavigate: (route: TabRoute) => void;
}

const ASSIST_LABELS: Record<AssistanceType, string> = {
  none: 'Строгі',
  band: 'Резинка',
  negative: 'Негатив',
  'band-hold': 'Рез.+затр.',
  'band-partial': 'Часткові',
};

export function RunnerView({
  state,
  pendingWorkout,
  wakeLockActive,
  wakeLockStatusText,
  onStartPendingWithWarmup,
  onSkipPendingWarmup,
  onCancelPending,
  onOpenExerciseHelp,
  onPauseToggle,
  onStartMiniTimer,
  onRepeatMini,
  onSkipStep,
  onCompleteMiniManual,
  onStartWarmupGateRest,
  onFinishWarmupGate,
  onRepeatWarmup,
  onStopDueToPain,
  onStartComplex,
  onConfirmComplexMove,
  onEndComplexEarly,
  onConfirmComplexEnd,
  onConfirmStep,
  onStartTimedStep,
  onExtendRest,
  onFinishRestEarly,
  onSetAssistanceOverride,
  onSetEccentricOverride,
  onToggleSound,
  onInterruptWorkout,
  onSaveSummary,
  onNavigate,
}: RunnerViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const [showWarmParts, setShowWarmParts] = useState(false);
  const [repDraft, setRepDraft] = useState<number>(0);
  const [complexRepDraft, setComplexRepDraft] = useState<number>(10);
  const [modified, setModified] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'stop' | 'pain' | 'end-complex' | null>(null);
  const [complexStdChoice, setComplexStdChoice] = useState(true);

  const [rpe, setRpe] = useState<number | null>(7);
  const [pain, setPain] = useState<number | null>(0);
  const [pullReserve, setPullReserve] = useState<number | null>(1);
  const [sleep, setSleep] = useState<string>('7.5');
  const [wellbeing, setWellbeing] = useState<Wellbeing | null>('normal');
  const [notes, setNotes] = useState('');

  const active = state.active;
  const step = currentStep(active);

  useEffect(() => {
    if (!active || active.phase === 'summary') return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || !step) return;
    setConfirmAction(null);
    setModified(false);
    if (step.kind === 'complex') {
      const move = active.complexIndex % 4;
      const repsArr = step.reps || [10, 10, 5, 10];
      const rem = Math.max(1, repsArr[move] - (active.complexRepProgress || 0));
      setComplexRepDraft(rem);
    } else {
      setRepDraft(active.repOverride ?? step.target ?? 0);
    }
  }, [
    active?.id,
    active?.cursor,
    active?.phase,
    active?.complexIndex,
    active?.complexRepProgress,
    step,
  ]);

  const progressionPreview = useMemo(() => {
    if (!active || active.phase !== 'summary') return [];
    return evaluateWorkoutProgression(active, state.exerciseProgress).changes;
  }, [active, state.exerciseProgress]);

  // 1. Pending warmup preview — fits 100dvh cleanly
  if (pendingWorkout) {
    const warm = pendingWorkout.warmup;
    return (
      <div className="mx-auto max-w-xl h-[calc(100dvh-3.75rem)] flex flex-col justify-between py-2 overflow-hidden">
        <section className="flex-1 min-h-0 flex flex-col justify-between rounded-2xl border border-[#CEFA42]/35 bg-[#191D16] p-4 sm:p-5 overflow-hidden">
          <div className="space-y-2.5 overflow-y-auto pr-0.5">
            <div>
              <p className="text-xs font-semibold text-[#CEFA42]">
                Цикл {pendingWorkout.week} / 8 · Підготовка до старту
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB] mt-0.5">
                {pendingWorkout.title}
              </h1>
              {warm && (
                <p className="text-xs text-[#9FA995] mt-1 leading-snug">
                  {warm.name} ({Math.round(warm.seconds / 60)} хв) · {warm.reason}
                </p>
              )}
            </div>

            {warm?.blocked && (
              <div className="rounded-xl border border-[#F2A98C]/40 bg-[#231915] px-3 py-2 text-xs text-[#F2A98C]">
                Обережна розминка: ударні й стрибкові рухи виключено через біль.
              </div>
            )}

            {warm?.missing && (
              <div className="rounded-xl border border-white/15 bg-[#21271D] px-3 py-2 text-xs text-[#DCE3D3]">
                Адаптовано під доступний інвентар у профілі.
              </div>
            )}

            {warm && warm.parts.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-[#111310]/60 px-3 py-2">
                <button
                  type="button"
                  aria-expanded={showWarmParts}
                  onClick={() => setShowWarmParts((v) => !v)}
                  className="min-h-[36px] w-full flex items-center justify-between text-xs font-semibold text-[#F2F6EB]"
                >
                  <span>Склад розминки ({warm.parts.length} вправ)</span>
                  {showWarmParts ? (
                    <ChevronUp className="w-4 h-4 text-[#CEFA42]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#CEFA42]" />
                  )}
                </button>
                {showWarmParts && (
                  <div className="mt-1 divide-y divide-white/10 border-t border-white/10">
                    {warm.parts.map((part, i) => (
                      <div
                        key={`${part.key}-${i}`}
                        className="py-2 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-[#DCE3D3] truncate">
                          {i + 1}. {part.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono tabular-nums text-[11px] text-[#CEFA42]">
                            {part.dose || `${part.seconds} с`}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenExerciseHelp(part.name, part.note)}
                            aria-label={`Техніка: ${part.name}`}
                            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-white/10 bg-[#21271D] text-[#CEFA42]"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 space-y-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onStartPendingWithWarmup}
              className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2.5 text-sm font-bold text-[#111310]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Почати розминку ({warm ? Math.round(warm.seconds / 60) : 5} хв)</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSkipPendingWarmup}
                className="min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] px-3 text-xs font-semibold text-[#F2F6EB]"
              >
                Пропустити розминку
              </button>
              <button
                type="button"
                onClick={onCancelPending}
                className="min-h-[44px] rounded-xl border border-white/10 px-3 text-xs font-medium text-[#9FA995]"
              >
                До плану
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // 2. No active workout
  if (!active) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 text-center space-y-3">
          <h1 className="font-display text-2xl font-bold text-[#F2F6EB]">Немає активного заняття</h1>
          <p className="text-xs text-[#9FA995]">
            Обери тренування на вкладці «План» або запусти контрольний WOD-таймер.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="min-h-[44px] rounded-xl bg-[#CEFA42] px-5 py-2 text-sm font-bold text-[#111310]"
          >
            Перейти до плану
          </button>
        </section>
      </div>
    );
  }

  const totalWorkMs = workoutMilliseconds(active, now);
  const paused = active.pausedAt !== null;

  // 3. Summary Phase (compact form with progression & records summary)
  if (active.phase === 'summary') {
    const totalReps = active.entries.reduce((n, e) => n + (e.reps || 0), 0);
    const hasPullInSession = active.entries.some(
      (e) => e.mainPull || e.assistance || e.testKey === 'pull',
    );
    const recordsBroken = active.recordsBroken || [];

    return (
      <div className="mx-auto max-w-2xl pb-6">
        <section className="rounded-2xl border border-[#CEFA42]/40 bg-[#191D16] p-4 sm:p-5 space-y-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-[#CEFA42]">
                {active.status === 'interrupted' ? 'Заняття зупинено' : 'Заняття завершено'}
                {active.isReturnWorkout || active.returnWorkout ? ' · Втягувальне (Full-Body)' : ''}
              </p>
              <h1 className="font-display text-2xl font-bold text-[#F2F6EB]">{active.title}</h1>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-2.5">
            <div>
              <p className="font-display text-xl font-bold tabular-nums text-[#CEFA42]">
                {clock(totalWorkMs)}
              </p>
              <p className="text-[11px] text-[#9FA995]">Тривалість</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold tabular-nums text-[#F2F6EB]">
                {totalReps}
              </p>
              <p className="text-[11px] text-[#9FA995]">Повторень</p>
            </div>
            <div>
              <p className="font-display text-xl font-bold tabular-nums text-[#F2F6EB]">
                {active.laps.length}
              </p>
              <p className="text-[11px] text-[#9FA995]">Раундів</p>
            </div>
          </div>

          {(recordsBroken.length > 0 || progressionPreview.length > 0) && (
            <div className="rounded-xl border border-[#CEFA42]/35 bg-[#222B18] px-3.5 py-2.5 space-y-1">
              <p className="text-xs font-bold text-[#CEFA42]">Оновлення прогресу</p>
              <ul className="space-y-0.5 text-xs text-[#DCE3D3]">
                {recordsBroken.map((rec, idx) => (
                  <li key={`rec-${idx}`}>🏆 Новий рекорд! {rec}</li>
                ))}
                {progressionPreview.map((c, idx) => (
                  <li key={`prog-${idx}`}>• {c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-[#F2F6EB] mb-1.5">Навантаження (RPE 1–10)</p>
              <div className="grid grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setRpe(v)}
                    className={`min-h-[36px] rounded-lg border font-mono text-xs font-bold ${
                      rpe === v
                        ? 'border-[#CEFA42] bg-[#CEFA42] text-[#111310]'
                        : 'border-white/10 bg-[#21271D] text-[#DCE3D3]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#F2F6EB] mb-1.5">Біль у суглобах (0–10)</p>
              <div className="grid grid-cols-11 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPain(v)}
                    className={`min-h-[36px] rounded-lg border font-mono text-xs font-bold ${
                      pain === v
                        ? v > 0
                          ? 'border-[#F2A98C] bg-[#F2A98C] text-[#111310]'
                          : 'border-[#CEFA42] bg-[#CEFA42] text-[#111310]'
                        : 'border-white/10 bg-[#21271D] text-[#DCE3D3]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {hasPullInSession && (
              <div>
                <p className="text-xs font-semibold text-[#F2F6EB] mb-1.5">Запас у тязі</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    [0, '0 (впритул)'],
                    [1, '1 повтор'],
                    [2, '2+ запасу'],
                  ].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPullReserve(Number(val))}
                      className={`min-h-[38px] rounded-xl border px-2 text-xs font-semibold ${
                        pullReserve === val
                          ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                          : 'border-white/10 bg-[#21271D] text-[#DCE3D3]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
              <div>
                <p className="text-xs font-semibold text-[#F2F6EB] mb-1">Самопочуття</p>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      ['good', 'Добре'],
                      ['normal', 'Норм'],
                      ['hard', 'Важко'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWellbeing(val)}
                      className={`min-h-[38px] rounded-xl border px-1.5 text-xs font-semibold ${
                        wellbeing === val
                          ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                          : 'border-white/10 bg-[#21271D] text-[#DCE3D3]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="summary-sleep" className="block text-xs font-semibold text-[#F2F6EB] mb-1">
                  Сон (год)
                </label>
                <input
                  id="summary-sleep"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#111310] px-2.5 text-sm text-[#F2F6EB] font-mono tabular-nums"
                />
              </div>
            </div>

            <input
              id="summary-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Коротка нотатка до тренування…"
              className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#111310] px-3 text-xs text-[#F2F6EB] placeholder:text-[#9FA995]/60"
            />

            <button
              type="button"
              onClick={() =>
                onSaveSummary({
                  rpe,
                  pain,
                  pullReserve: hasPullInSession ? pullReserve : null,
                  sleep: sleep ? Math.max(0, Math.min(24, Number(sleep))) : null,
                  wellbeing,
                  notes: notes.trim(),
                })
              }
              className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2.5 text-sm font-bold text-[#111310]"
            >
              <Check className="w-4 h-4" />
              <span>Зберегти в щоденник і завершити</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  // 4. Active Workout Screen — STRICT 100dvh, NO VERTICAL SCROLL
  const remaining = timerRemaining(active, step, now);
  const nextStepObj = active.steps[active.cursor + 1] || null;

  const isMini = active.phase === 'exercise' && !!step?.miniTimer && !step.warmupGate;
  const headerProgressText = isMini
    ? `${step.miniIndex} / ${step.miniCount}`
    : `${Math.min(active.cursor + 1, active.steps.length)} / ${active.steps.length}`;
  const headerProgressPct = isMini
    ? Math.min(100, Math.round(((step.miniIndex || 1) / (step.miniCount || 1)) * 100))
    : active.steps.length
      ? Math.min(100, Math.round(((active.cursor + 1) / active.steps.length) * 100))
      : 0;

  // Compact next-exercise line
  const nextLine = (() => {
    if (active.phase === 'exercise' && step?.kind === 'complex' && active.complexStarted !== null) {
      const nextMoveIdx = (active.complexIndex + 1) % 4;
      return `Далі: ${MOVES[nextMoveIdx]}`;
    }
    if (nextStepObj) {
      return `Далі: ${nextStepObj.name}`;
    }
    return 'Далі: Підсумок тренування';
  })();

  return (
    <div className="mx-auto max-w-xl h-[calc(100dvh-3.75rem)] max-h-[820px] flex flex-col justify-between gap-2 py-1 overflow-hidden">
      {/* Compact Header with progress + controls */}
      <div className="shrink-0 rounded-2xl border border-white/10 bg-[#191D16] px-3.5 py-2 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#CEFA42] truncate leading-tight">
              {isMini ? step.groupTitle : active.title}
            </p>
            <p className="text-[11px] text-[#9FA995] font-mono tabular-nums leading-tight mt-0.5">
              {headerProgressText} · {clock(totalWorkMs)}
              {paused ? ' · ПАУЗА' : wakeLockActive ? ' · екран вкл.' : ''}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={state.sound ? 'Вимкнути звук' : 'Увімкнути звук'}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#DCE3D3]"
            >
              {state.sound ? <Volume2 className="w-4 h-4 text-[#CEFA42]" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onPauseToggle}
              aria-label={paused ? 'Продовжити' : 'Пауза'}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#F2F6EB]"
            >
              {paused ? <Play className="w-4 h-4 text-[#CEFA42]" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setConfirmAction((c) => (c === 'stop' ? null : 'stop'))}
              aria-label="Завершити заняття"
              className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-[#F2A98C]/35 bg-[#231915] px-2.5 text-xs font-semibold text-[#F2A98C]"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Стоп</span>
            </button>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2A3124]">
          <div
            className="h-full bg-[#CEFA42] transition-all duration-300"
            style={{width: `${headerProgressPct}%`}}
          />
        </div>

        {confirmAction === 'stop' && (
          <div className="rounded-xl border border-[#F2A98C]/40 bg-[#231915] px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-xs text-[#F2F6EB]">Завершити заняття зараз?</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  onInterruptWorkout(false);
                }}
                className="min-h-[34px] rounded-lg bg-[#F2A98C] px-2.5 text-xs font-bold text-[#111310]"
              >
                Так
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="min-h-[34px] rounded-lg border border-white/15 px-2.5 text-xs text-[#DCE3D3]"
              >
                Ні
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Focal Card — Flex-1 so it ALWAYS fits remaining height without scrolling */}
      <section className="flex-1 min-h-0 flex flex-col justify-between rounded-2xl border border-[#CEFA42]/35 bg-[#191D16] p-4 sm:p-5 overflow-hidden">
        {/* PHASE: REST */}
        {active.phase === 'rest' && (
          <>
            <div className="flex items-center justify-between text-xs text-[#9FA995]">
              <span className="font-semibold text-[#CEFA42]">Відпочинок</span>
              <span className="truncate">{wakeLockActive ? 'Екран активний' : wakeLockStatusText}</span>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
              <div
                role="timer"
                aria-label="Таймер відпочинку"
                className={`font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none ${
                  remaining !== null && remaining <= 0 ? 'text-[#CEFA42]' : 'text-[#F2F6EB]'
                }`}
              >
                {remaining === null ? '00:00' : remaining <= 0 ? 'ГОТОВО' : clock(remaining)}
              </div>
              {nextStepObj && (
                <p className="text-xs text-[#BAC4B0] truncate max-w-full">
                  Підготуйся: <strong className="text-[#F2F6EB]">{nextStepObj.name}</strong>
                </p>
              )}
            </div>

            <div className="shrink-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onExtendRest(30)}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                >
                  +30 с
                </button>
                <button
                  type="button"
                  onClick={() => onExtendRest(60)}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                >
                  +60 с
                </button>
              </div>
              <button
                type="button"
                onClick={onFinishRestEarly}
                className="w-full min-h-[48px] rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
              >
                {remaining !== null && remaining <= 0 ? 'Почати наступну вправу' : 'Продовжити раніше'}
              </button>
              <p className="text-[11px] text-[#9FA995] text-center truncate">{nextLine}</p>
            </div>
          </>
        )}

        {/* PHASE: COMPLEX END */}
        {active.phase === 'complex-end' && (
          <>
            <div>
              <p className="text-xs font-semibold text-[#CEFA42]">Комплекс завершено</p>
              <h2 className="font-display text-2xl font-bold text-[#F2F6EB] mt-0.5">
                Раундів: {active.laps.length} · {clock(complexMilliseconds(active, now))}
              </h2>
            </div>

            <div className="flex-1 min-h-0 flex flex-col justify-center space-y-3">
              {active.laps.length > 0 && (
                <div className="divide-y divide-white/10 border-y border-white/10">
                  {active.laps.map((ms, i) => (
                    <div key={i} className="flex justify-between py-1.5 text-xs font-mono tabular-nums">
                      <span className="text-[#9FA995]">Раунд {i + 1}</span>
                      <span className="text-[#F2F6EB] font-semibold">{clock(ms)}</span>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer text-xs text-[#DCE3D3]">
                <input
                  type="checkbox"
                  checked={complexStdChoice}
                  onChange={(e) => setComplexStdChoice(e.target.checked)}
                  className="h-4 w-4 accent-[#CEFA42]"
                />
                <span>Виконано за стандартом (повна амплітуда)</span>
              </label>
            </div>

            <div className="shrink-0 space-y-1.5">
              <button
                type="button"
                onClick={() => onConfirmComplexEnd(complexStdChoice)}
                className="w-full min-h-[48px] rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
              >
                Підтвердити та продовжити
              </button>
              <p className="text-[11px] text-[#9FA995] text-center truncate">{nextLine}</p>
            </div>
          </>
        )}

        {/* PHASE: WARMUP GATE */}
        {active.phase === 'exercise' && step?.warmupGate && (
          <>
            <div>
              <p className="text-xs font-semibold text-[#CEFA42]">Розминку виконано</p>
              <h2 className="font-display text-2xl font-bold text-[#F2F6EB] mt-0.5">{step.name}</h2>
              <p className="text-xs text-[#9FA995] mt-0.5">{step.note}</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center text-center">
              {active.warmupRestUntil ? (
                <div className="space-y-1">
                  <p className="text-xs text-[#9FA995]">Спокійне дихання</p>
                  <p
                    role="timer"
                    className="font-display text-6xl font-bold tabular-nums text-[#CEFA42]"
                  >
                    {clock(Math.max(0, active.warmupRestUntil - now))}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[#DCE3D3]">
                  Суглоби розігріті. Можна переходити до силової частини.
                </p>
              )}
            </div>

            <div className="shrink-0 space-y-2">
              <button
                type="button"
                onClick={onFinishWarmupGate}
                className="w-full min-h-[48px] rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
              >
                Перейти до основного тренування
              </button>

              <div className="grid grid-cols-2 gap-2">
                {!active.warmupRestUntil ? (
                  <button
                    type="button"
                    onClick={onStartWarmupGateRest}
                    className="min-h-[42px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                  >
                    Подихати 2 хв
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRepeatWarmup}
                    className="min-h-[42px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                  >
                    Повторити розминку
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setConfirmAction((c) => (c === 'pain' ? null : 'pain'))}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1 rounded-xl border border-[#F2A98C]/40 bg-[#231915] px-2 text-xs font-semibold text-[#F2A98C]"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Є біль — стоп</span>
                </button>
              </div>

              {confirmAction === 'pain' && (
                <div className="rounded-xl border border-[#F2A98C]/40 bg-[#231915] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-[#F2F6EB]">Зупинити через біль?</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmAction(null);
                        onStopDueToPain();
                      }}
                      className="min-h-[34px] rounded-lg bg-[#F2A98C] px-2.5 text-xs font-bold text-[#111310]"
                    >
                      Так
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="min-h-[34px] rounded-lg border border-white/15 px-2.5 text-xs text-[#DCE3D3]"
                    >
                      Ні
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[#9FA995] text-center truncate">{nextLine}</p>
            </div>
          </>
        )}

        {/* PHASE: MINI TIMER (Warmup) — ZERO 10-card grid, pure 100dvh focus */}
        {isMini && step && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#CEFA42]">
                  Розминка · {step.miniIndex} / {step.miniCount}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB] leading-tight mt-0.5 line-clamp-2">
                  {step.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenExerciseHelp(step.name, step.note)}
                aria-label={`Техніка: ${step.name}`}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#CEFA42] shrink-0"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2 px-1">
              <div
                role="timer"
                aria-label="Таймер вправи розминки"
                className="font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none text-[#CEFA42]"
              >
                {active.stageStarted === null
                  ? clock(step.target * 1000)
                  : clock(Math.max(0, remaining ?? 0))}
              </div>
              {step.dose && <p className="text-xs font-semibold text-[#F2F6EB]">{step.dose}</p>}
              <p className="text-xs text-[#9FA995] leading-snug line-clamp-2 max-w-md">
                {step.note}
              </p>
            </div>

            <div className="shrink-0 space-y-2">
              {active.stageStarted === null ? (
                <button
                  type="button"
                  onClick={onStartMiniTimer}
                  disabled={paused}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310] disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Старт ({step.target} с)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCompleteMiniManual}
                  disabled={paused}
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310] disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Виконано · Далі</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRepeatMini}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Спочатку</span>
                </button>
                <button
                  type="button"
                  onClick={onSkipStep}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#9FA995]"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Пропустити</span>
                </button>
              </div>

              <p className="text-[11px] text-[#9FA995] text-center truncate">{nextLine}</p>
            </div>
          </>
        )}

        {/* PHASE: COMPLEX */}
        {active.phase === 'exercise' && step?.kind === 'complex' && (
          <>
            {active.complexStarted === null ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-[#CEFA42]">
                    CrossFit-комплекс · {step.rounds} раундів · ≤{Math.round(step.target / 60)} хв
                  </p>
                  <h2 className="font-display text-2xl font-bold text-[#F2F6EB] mt-0.5">
                    {step.name}
                  </h2>
                </div>

                <div className="flex-1 min-h-0 flex flex-col justify-center divide-y divide-white/10 border-y border-white/10 my-2">
                  {MOVES.map((m, idx) => (
                    <div key={m} className="py-2 flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-medium text-[#F2F6EB] truncate">
                        {idx + 1}. {m}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-xs font-bold text-[#CEFA42]">
                          × {step.reps?.[idx] ?? 10}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenExerciseHelp(m, TECHNIQUE[idx])}
                          aria-label={`Техніка: ${m}`}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg border border-white/10 bg-[#21271D] text-[#CEFA42]"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="shrink-0 space-y-1.5">
                  <button
                    type="button"
                    onClick={onStartComplex}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Старт комплексу</span>
                  </button>
                  <p className="text-[11px] text-[#9FA995] text-center truncate">{nextLine}</p>
                </div>
              </>
            ) : (
              (() => {
                const moveIdx = active.complexIndex % 4;
                const roundNum = Math.floor(active.complexIndex / 4) + 1;
                const repsArr = step.reps || [10, 10, 5, 10];
                const targetMove = repsArr[moveIdx];
                const remMove = Math.max(1, targetMove - (active.complexRepProgress || 0));
                const timeLeft = Math.max(0, remaining ?? 0);

                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#CEFA42]">
                        Раунд {roundNum} / {step.rounds} · Вправа {moveIdx + 1}/4
                      </span>
                      <div className="flex items-center gap-1">
                        {Array.from({length: step.rounds || 3}).map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-2 w-5 rounded-full ${
                              idx < active.laps.length
                                ? 'bg-[#CEFA42]'
                                : idx === active.laps.length
                                  ? 'bg-[#CEFA42]/45'
                                  : 'bg-[#2A3124]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5">
                      <div className="text-center">
                        <div
                          role="timer"
                          className="font-display text-5xl sm:text-6xl font-bold tabular-nums leading-none text-[#CEFA42]"
                        >
                          {clock(timeLeft)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#111310]/70 px-3 py-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-xl font-bold text-[#F2F6EB] truncate">
                            {MOVES[moveIdx]}
                          </h3>
                          <p className="text-xs font-mono tabular-nums text-[#CEFA42]">
                            Залишилось: {remMove} з {targetMove}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenExerciseHelp(MOVES[moveIdx], TECHNIQUE[moveIdx])}
                          aria-label={`Техніка: ${MOVES[moveIdx]}`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-white/10 bg-[#21271D] text-[#CEFA42] shrink-0"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 px-2">
                        <button
                          type="button"
                          onClick={() => setComplexRepDraft((n) => Math.max(1, n - 1))}
                          aria-label="Зменшити повторення"
                          className="min-h-[44px] min-w-[52px] rounded-xl border border-white/15 bg-[#21271D] text-lg font-bold text-[#F2F6EB]"
                        >
                          −
                        </button>
                        <div className="text-center">
                          <span className="font-display text-3xl font-bold tabular-nums text-[#F2F6EB]">
                            {complexRepDraft}
                          </span>
                          <span className="block text-[10px] text-[#9FA995]">повторень</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setComplexRepDraft((n) => Math.min(remMove, n + 1))}
                          aria-label="Збільшити повторення"
                          className="min-h-[44px] min-w-[52px] rounded-xl border border-white/15 bg-[#21271D] text-lg font-bold text-[#F2F6EB]"
                        >
                          +
                        </button>
                      </div>

                      <label className="flex items-center justify-center gap-2 text-xs text-[#DCE3D3] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modified}
                          onChange={(e) => setModified(e.target.checked)}
                          className="h-4 w-4 accent-[#CEFA42]"
                        />
                        <span>Полегшений варіант</span>
                      </label>
                    </div>

                    <div className="shrink-0 space-y-2">
                      <button
                        type="button"
                        onClick={() => onConfirmComplexMove(complexRepDraft, modified)}
                        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {complexRepDraft < remMove
                            ? `Записати серію +${complexRepDraft}`
                            : `Підтвердити (${complexRepDraft})`}
                        </span>
                      </button>

                      {confirmAction === 'end-complex' ? (
                        <div className="rounded-xl border border-[#F2A98C]/40 bg-[#231915] px-3 py-1.5 flex items-center justify-between gap-2">
                          <span className="text-xs text-[#F2F6EB]">Завершити комплекс?</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmAction(null);
                                onEndComplexEarly();
                              }}
                              className="min-h-[34px] rounded-lg bg-[#F2A98C] px-2.5 text-xs font-bold text-[#111310]"
                            >
                              Так
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction(null)}
                              className="min-h-[34px] rounded-lg border border-white/15 px-2.5 text-xs text-[#DCE3D3]"
                            >
                              Ні
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-[#9FA995] truncate">{nextLine}</p>
                          <button
                            type="button"
                            onClick={() => setConfirmAction('end-complex')}
                            className="text-[11px] font-semibold text-[#9FA995] hover:text-[#F2F6EB] shrink-0"
                          >
                            Завершити раніше
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            )}
          </>
        )}

        {/* PHASE: STRENGTH / TEST / HOLD / TIMED / PREP */}
        {active.phase === 'exercise' &&
          step &&
          !step.miniTimer &&
          !step.warmupGate &&
          step.kind !== 'complex' && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#CEFA42] truncate">
                    {step.section || 'Основна частина'}
                    {step.sets && step.sets > 1 ? ` · Підхід ${step.set}/${step.sets}` : ''}
                    {step.adaptationBadge ? ` · ${step.adaptationBadge}` : ''}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB] leading-tight mt-0.5 line-clamp-2">
                    {step.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenExerciseHelp(step.name, step.note)}
                  aria-label={`Техніка: ${step.name}`}
                  className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#CEFA42] shrink-0"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 flex flex-col justify-center gap-2.5">
                <p className="text-xs text-[#9FA995] leading-snug line-clamp-2">{step.note}</p>

                {step.kind === 'reps' || step.kind === 'test' ? (
                  <>
                    {(step.assistance || step.mainPull) && (
                      <div className="flex flex-wrap gap-1">
                        {(['none', 'band', 'negative', 'band-hold', 'band-partial'] as const).map(
                          (a) => {
                            const currentAssist = active.assistanceOverride ?? step.assistance ?? 'none';
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => onSetAssistanceOverride(a)}
                                className={`min-h-[32px] rounded-lg border px-2 text-[11px] font-medium ${
                                  currentAssist === a
                                    ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                                    : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                                }`}
                              >
                                {ASSIST_LABELS[a]}
                              </button>
                            );
                          },
                        )}
                        {(active.assistanceOverride ?? step.assistance) === 'negative' && (
                          <div className="w-full flex items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-[#9FA995]">Опускання:</span>
                            {[2, 3, 4, 5].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => onSetEccentricOverride(s)}
                                className={`min-h-[30px] min-w-[32px] rounded-lg border font-mono text-[11px] font-bold ${
                                  (active.eccentricOverride ?? 4) === s
                                    ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                                    : 'border-white/10 bg-[#21271D] text-[#DCE3D3]'
                                }`}
                              >
                                {s}с
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111310]/80 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setRepDraft((n) => Math.max(0, n - 1))}
                        aria-label="Зменшити повторення"
                        className="min-h-[48px] min-w-[54px] rounded-xl border border-white/15 bg-[#21271D] text-xl font-bold text-[#F2F6EB]"
                      >
                        −
                      </button>
                      <div className="text-center">
                        <span className="font-display text-5xl font-bold tabular-nums leading-none text-[#CEFA42]">
                          {repDraft}
                        </span>
                        <span className="block text-[11px] text-[#9FA995] mt-1">
                          {step.kind === 'test'
                            ? 'Результат тесту'
                            : `План: ${step.target}${step.targetMax ? `–${step.targetMax}` : ''}${step.perSide ? ' / ногу' : ''}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRepDraft((n) => Math.min(step.testMax ?? 200, n + 1))}
                        aria-label="Збільшити повторення"
                        className="min-h-[48px] min-w-[54px] rounded-xl border border-white/15 bg-[#21271D] text-xl font-bold text-[#F2F6EB]"
                      >
                        +
                      </button>
                    </div>

                    <label className="flex items-center justify-center gap-2 text-xs text-[#DCE3D3] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modified}
                        onChange={(e) => setModified(e.target.checked)}
                        className="h-4 w-4 accent-[#CEFA42]"
                      />
                      <span>З полегшенням / скороченою амплітудою</span>
                    </label>
                  </>
                ) : (
                  <div className="text-center space-y-1">
                    <div
                      role="timer"
                      className="font-display text-6xl font-bold tabular-nums leading-none text-[#CEFA42]"
                    >
                      {step.target > 0
                        ? active.stageStarted === null
                          ? clock(step.target * 1000)
                          : clock(Math.max(0, remaining ?? 0))
                        : '—'}
                    </div>
                    <p className="text-xs text-[#9FA995]">
                      {step.target > 0 ? `Ціль: ${step.target} с` : 'Підготовчий етап'}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-2">
                {step.kind === 'reps' || step.kind === 'test' ? (
                  <button
                    type="button"
                    disabled={paused}
                    onClick={() => onConfirmStep(repDraft, modified)}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310] disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Підтвердити {repDraft} повт.</span>
                  </button>
                ) : step.target > 0 && active.stageStarted === null ? (
                  <button
                    type="button"
                    disabled={paused}
                    onClick={onStartTimedStep}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310] disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Старт ({step.target} с)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={paused}
                    onClick={() => onConfirmStep(0, modified)}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310] disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Підтвердити та далі</span>
                  </button>
                )}

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[#9FA995] truncate">{nextLine}</p>
                  {(step.optional || !['reps', 'test'].includes(step.kind)) && (
                    <button
                      type="button"
                      onClick={onSkipStep}
                      className="text-[11px] font-semibold text-[#9FA995] hover:text-[#F2F6EB] shrink-0"
                    >
                      Пропустити
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
      </section>
    </div>
  );
}
