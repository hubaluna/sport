import {COMBO_TABLE, PROFILE, PROGRAM_REVISION} from '../data/program';
import type {
  ComplexSpec,
  ExerciseProgressEntry,
  ForgeState,
  PullPlan,
  WorkoutLog,
  WorkoutSession,
} from '../types/forge';
import {calendarGap, dateISO} from './calendar';

export function pullPlan(
  week: number,
  day: number,
  state: Pick<ForgeState, 'logs' | 'coach' | 'band'>,
  today = dateISO(),
): PullPlan {
  const coach = state.coach || {strictMax: 0, assistedMax: 0, assistedROM: 60};
  const all = state.logs || [];
  const pullLogs = all
    .filter(
      (l) =>
        !l.returnWorkout &&
        !l.isReturnWorkout &&
        l.programRevision === PROGRAM_REVISION &&
        [0, 4].includes(l.day) &&
        l.pullPlan &&
        l.status !== 'active' &&
        l.status !== 'paused',
    )
    .sort((a, b) => a.started - b.started);

  const tested = all
    .filter(
      (l) =>
        l.programRevision === PROGRAM_REVISION &&
        Number.isInteger(l.pull) &&
        l.started > (coach.strictAt || 0),
    )
    .sort((a, b) => a.started - b.started)
    .at(-1);

  const max = tested && tested.pull != null ? tested.pull : coach.strictMax || 0;
  const level = max === 0 ? 0 : max <= 3 ? 1 : max <= 6 ? 2 : max <= 9 ? 3 : 4;

  if (max === 0 && (coach.assistedMax ?? PROFILE.assisted) < 2) {
    const sets = week === 4 ? (day === 0 ? 2 : 1) : day === 0 ? 3 : 2;
    const history = pullLogs.filter(
      (l) =>
        l.day === day &&
        l.pullPlan?.mode === 'foundation' &&
        l.band === state.band &&
        l.started >= (coach.assistedAt || 0),
    );
    const last = history.at(-1);
    const prior = history.at(-2);
    const latestPull = pullLogs.at(-1);
    const unsafe = (latestPull?.pain ?? 0) > 0 || latestPull?.pullQuality === false;
    const gap = last ? calendarGap(today, last.date) : 0;
    const good = (l?: WorkoutLog) =>
      !!l &&
      !l.pullPlan?.foundationMixed &&
      l.completed &&
      l.pullQuality === true &&
      l.pain === 0 &&
      (l.pullReserve ?? 0) >= 2;

    let targets = last ? last.pullPlan!.targets.slice(0, sets) : Array(sets).fill(8);
    while (targets.length < sets) targets.push(8);

    if (
      !unsafe &&
      gap < 14 &&
      week !== 4 &&
      week !== 8 &&
      good(last) &&
      good(prior) &&
      JSON.stringify(last!.pullPlan!.targets) === JSON.stringify(prior!.pullPlan!.targets)
    ) {
      targets = targets.map((n, i) => (i < 2 ? Math.min(10, n + 1) : n));
    }
    if (week === 4 || week === 8) {
      targets = Array(sets).fill(8);
    }

    return {
      targets,
      mode: 'foundation',
      level: 0,
      max: 0,
      reason:
        (unsafe
          ? 'Нещодавно був біль або втрата контролю: не підвищуй обсяг і не виконуй болісні рухи. '
          : '') +
        'Підготовка до першого повного підтягування: легка тяга резинки, без ривків і відмови. Частковий рух не є повним повторенням. До робочих одиночних переходимо після підтвердження 2 повних повторень із цією допомогою; цикл сам по собі складність не підвищує.',
      suggest: false,
      strictSingles: 0,
    };
  }

  const mode: 'band' | 'none' = level >= 2 ? 'none' : 'band';
  const base = mode === 'none' ? Math.max(1, Math.floor(max * 0.5)) : 1;
  const sameMode = (l: WorkoutLog) =>
    l.pullPlan?.mode === mode &&
    (mode === 'none' || (l.band === state.band && l.started >= (coach.assistedAt || 0))) &&
    l.pullPlan?.level === level;

  const history = pullLogs.filter((l) => l.day === day && sameMode(l));
  const last = history.at(-1);
  const prior = history.at(-2);
  const signature = (l?: WorkoutLog) => JSON.stringify(l?.pullPlan?.targets);
  const success = (l?: WorkoutLog) =>
    !!l && l.completed && l.pain === 0 && (l.pullReserve ?? 0) >= 1 && l.pullQuality === true;

  let targets = last ? [...last.pullPlan!.targets] : Array(day === 0 ? 5 : 4).fill(base);
  let reason = 'Почни з нижньої межі; залишай 1–2 повторення в запасі.';
  const capacity = mode === 'none' ? Math.max(1, max - 1) : 5;

  if (mode === 'none' && last && targets.some((n) => n > capacity)) {
    targets = Array(Math.max(day === 0 ? 5 : 4, last.pullPlan!.targets.length)).fill(
      Math.max(1, Math.floor(capacity * 0.6)),
    );
    reason = 'Максимум знизився: робочі підходи перераховано зі збереженням запасу.';
  }

  const latestPull = pullLogs.filter((l) => [0, 4].includes(l.day)).at(-1);
  const unsafe = !!latestPull && ((latestPull.pain ?? 0) > 0 || latestPull.pullQuality === false);
  const gap = last ? calendarGap(today, last.date) : 0;

  if (unsafe) {
    reason =
      'Нещодавно був біль або порушилася техніка в тяговій роботі: сьогодні не підвищуй навантаження. Не виконуй болісний рух.';
  } else if (gap >= 14) {
    const good = history.filter(success).at(-1);
    targets = good ? [...good.pullPlan!.targets] : Array(day === 0 ? 5 : 4).fill(base);
    reason = 'Після перерви ≥14 днів повертаємо останній успішний рівень без підвищення.';
  } else if (success(last) && success(prior) && signature(last) === signature(prior)) {
    const cap = mode === 'band' ? 5 : capacity;
    const indices = targets
      .map((n, i) => ({n, i}))
      .filter((x) => x.n < cap)
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .slice(0, 2)
      .map((x) => x.i);
    if (indices.length) {
      targets = targets.map((n, i) => (indices.includes(i) ? Math.min(cap, n + 1) : n));
    }
    reason = indices.length
      ? 'Два якісні заняття з запасом: +1 повторення у двох найлегших підходах.'
      : 'Підходи досягли поточної межі; наступний крок — лише після перевірки слабшої допомоги.';
  } else if (last) {
    reason = 'Повтори останній обсяг. Для підвищення потрібні два якісні заняття, запас ≥1 та біль 0.';
  }

  if (week === 4) {
    targets = targets.slice(0, 3).map((n) => Math.min(n, 2));
    reason = 'Полегшений цикл: 3 короткі підходи, без збільшення складності.';
  }
  if (week === 7) {
    targets = targets.slice(0, day === 0 ? 4 : 3);
  }

  const suggest =
    !unsafe &&
    mode === 'band' &&
    targets.length === 5 &&
    targets.every((n) => n >= 5) &&
    success(last) &&
    success(prior);

  if (suggest) {
    reason +=
      ' Виконуєш 5×5: можна спробувати меншу допомогу. Зафіксуй окремий варіант підтримки; новий рівень почнеться з одиночних.';
  }

  return {
    targets,
    mode,
    level,
    max,
    reason,
    suggest,
    strictSingles: level === 1 && max >= 2 ? Math.min(2, max - 1) : 0,
  };
}

export function comboFor(
  week: number,
  day: number,
  state?: Pick<ForgeState, 'logs'>,
): ComplexSpec {
  const d = day === 0 ? 0 : day === 2 ? 1 : 2;
  const c = COMBO_TABLE[Math.max(0, Math.min(7, week - 1))][d];
  let rounds = c[0];
  let reason = '';

  if (day === 2 && week !== 4 && week !== 8 && rounds > 3 && state) {
    const history = (state.logs || [])
      .filter(
        (l) =>
          !l.returnWorkout &&
          !l.isReturnWorkout &&
          l.programRevision === PROGRAM_REVISION &&
          l.day === 2 &&
          l.week !== 4 &&
          l.plannedComplex,
      )
      .sort((a, b) => a.started - b.started);
    const last = history.at(-1);
    const good =
      !!last &&
      last.completed &&
      last.standard &&
      last.pain === 0 &&
      last.rpe != null &&
      last.rpe <= 8 &&
      last.rounds === last.plannedComplex!.rounds;
    const allowed = good
      ? Math.min(5, last!.rounds + 1)
      : last
        ? last.plannedComplex!.rounds
        : 3;
    rounds = Math.min(rounds, allowed);
    if (rounds < c[0]) {
      reason =
        ' Обсяг утримано за журналом: для наступного раунду заверши поточний стандартно, з болем 0 та RPE ≤8.';
    }
  }

  return {
    rounds,
    reps: [c[1], c[2], c[3], c[4]],
    cap: 22,
    rpe: week === 8 && day === 4 ? 9 : week === 4 || week === 8 ? 5 : day === 4 ? 6 : week <= 2 ? 7 : 8,
    reason,
  };
}

export function exerciseProgressKey(name: string): string {
  if (!name) return '';
  const s = name.toLowerCase();
  if (s.includes('віджиман') && !s.includes('полегшен')) return 'pushups';
  if (s.includes('строг') && s.includes('підтягуван')) return 'strict_pullups';
  if (s.includes('резинк') && s.includes('підтягуван')) return 'band_pullups';
  if (s.includes('тяга') && s.includes('грудей')) return 'band_pulldown';
  if (s.includes('тяга резинки сидячи')) return 'band_row_seated';
  if (s.includes('зворотні випади') || s.includes('випади')) return 'lunges';
  if (s.includes('сідничний міст')) return 'bridge';
  if (s.includes('присідання')) return 'squats';
  if (s.includes('колесо') || s.includes('мертвий жук')) return 'core';
  return s.replace(/[^a-zа-яіїєґ0-9]+/gi, '_');
}

export function getGlobalExerciseTarget(
  name: string,
  defaultReps: number,
  exerciseProgress?: Record<string, ExerciseProgressEntry>,
): number {
  const key = exerciseProgressKey(name);
  const entry = exerciseProgress?.[key];
  if (entry && Number.isInteger(entry.targetReps)) {
    return entry.targetReps;
  }
  return defaultReps;
}

export function evaluateWorkoutProgression(
  workout: WorkoutSession,
  exerciseProgress: Record<string, ExerciseProgressEntry>,
  today = dateISO(),
): {nextProgress: Record<string, ExerciseProgressEntry>; changes: string[]} {
  if (!workout || !workout.entries || workout.isReturnWorkout || workout.returnWorkout) {
    return {nextProgress: exerciseProgress, changes: []};
  }
  const nextProgress: Record<string, ExerciseProgressEntry> = {...exerciseProgress};
  const changes: string[] = [];
  const byExercise = new Map<string, {name: string; sets: {reps: number; target: number}[]}>();

  for (const e of workout.entries) {
    if (e.kind !== 'reps' && e.kind !== 'hold') continue;
    if (!e.name || typeof e.reps !== 'number' || !Number.isInteger(e.reps) || !Number.isInteger(e.target)) {
      continue;
    }
    const key = exerciseProgressKey(e.name);
    if (!byExercise.has(key)) byExercise.set(key, {name: e.name, sets: []});
    byExercise.get(key)!.sets.push({reps: e.reps, target: e.target});
  }

  for (const [key, data] of byExercise.entries()) {
    const sets = data.sets;
    if (!sets.length) continue;
    const totalActual = sets.reduce((sum, s) => sum + s.reps, 0);
    const totalTarget = sets.reduce((sum, s) => sum + s.target, 0);
    const noFailure = sets.every((s) => s.reps >= s.target - 1);
    if (totalActual > totalTarget && noFailure) {
      const currentTarget = nextProgress[key]?.targetReps || sets[0].target;
      const newTarget = currentTarget + 1;
      nextProgress[key] = {targetReps: newTarget, name: data.name, lastUpdated: today};
      changes.push(
        `${data.name}: оновлено глобальну ціль до ${sets.length} × ${newTarget} на наступні дні`,
      );
    }
  }

  return {nextProgress, changes};
}

export function daysSinceLastWorkout(logs: WorkoutLog[], now = Date.now()): number {
  const completed = logs
    .filter((l) => l.completed)
    .sort((a, b) => (b.started || 0) - (a.started || 0));
  const last = completed[0];
  if (!last) return 999;
  const ts = last.started || new Date(last.date + 'T12:00:00Z').getTime();
  return Math.max(0, Math.floor((now - ts) / 86400000));
}

export function progressMetrics(state: ForgeState) {
  const logs = state.logs || [];
  let strict = state.coach?.strictMax || 0;
  let assisted = state.coach?.assistedMax ?? PROFILE.assisted;
  let best: number | null = null;
  let push = state.coach?.pushMax ?? PROFILE.push;
  const times: WorkoutLog[] = [];

  for (const l of logs) {
    strict = Math.max(strict, l.pull || 0);
    push = Math.max(push, l.push || 0);
    for (const e of l.pullEntries || []) {
      if (
        e.assistance === 'band' &&
        e.quality === 'full' &&
        l.started >= (state.coach?.assistedAt || 0)
      ) {
        assisted = Math.max(assisted, e.reps || 0);
      }
    }
    if (
      l.completed &&
      l.standard &&
      l.plannedComplex?.rounds === 5 &&
      l.plannedComplex.reps.join(',') === '10,10,5,10' &&
      l.rounds === 5 &&
      l.complexSeconds != null
    ) {
      times.push(l);
      best = best === null ? l.complexSeconds : Math.min(best, l.complexSeconds);
    }
  }

  const completedCount = logs.filter((l) => l.completed && !l.isReturnWorkout).length;

  return {strict, assisted, best, times, push, completedCount};
}
