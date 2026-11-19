import {MOVES, PROFILE} from '../data/program';
import type {
  ForgeState,
  WorkoutEntry,
  WorkoutLog,
  WorkoutSession,
  WorkoutStep,
} from '../types/forge';
import {cycleDaysFor} from './calendar';

export function currentStep(a: WorkoutSession | null | undefined): WorkoutStep | null {
  return a?.steps?.[a.cursor] || null;
}

export function workoutMilliseconds(a: WorkoutSession, now = Date.now()): number {
  return Math.max(0, (a.ended ?? a.pausedAt ?? now) - a.started - a.pausedMs);
}

export function complexMilliseconds(a: WorkoutSession, now = Date.now()): number {
  const step = a.steps.find((x) => x.kind === 'complex');
  if (a.complexStarted === null) return 0;
  return Math.max(0, Math.min((a.complexEnded ?? now) - a.complexStarted, (step?.target || 0) * 1000));
}

export function complexRunning(a: WorkoutSession | null | undefined): boolean {
  return currentStep(a)?.kind === 'complex' && a?.complexStarted !== null && a?.complexEnded === null;
}

export function betweenExercises(a: WorkoutSession): boolean {
  const current = currentStep(a);
  const next = a?.steps[a.cursor + 1];
  return !!current && !!next && (current.name !== next.name || current.kind !== next.kind);
}

export function timerRemaining(
  a: WorkoutSession,
  step: WorkoutStep | null,
  now = Date.now(),
): number | null {
  if (step?.warmupGate && a.warmupRestUntil) return a.warmupRestUntil - now;
  if (a.phase === 'rest') return a.restUntil === null ? null : a.restUntil - now;
  if (a.phase !== 'exercise' || !step) return null;
  if (step.kind === 'complex') {
    return a.complexStarted === null || a.complexEnded !== null
      ? null
      : step.target * 1000 - complexMilliseconds(a, now);
  }
  return a.stageStarted === null ? null : step.target * 1000 - (now - a.stageStarted);
}

export function moveForward(a: WorkoutSession, now = Date.now()): void {
  a.cursor++;
  a.stageStarted = null;
  a.countdownCue = null;
  a.blockSignaled = false;
  a.repOverride = null;
  a.modified = false;
  a.assistanceOverride = null;
  a.eccentricOverride = null;
  if (a.cursor >= a.steps.length) {
    a.phase = 'summary';
    a.status = 'complete';
    a.ended = now;
  }
}

export function finishCurrentStep(a: WorkoutSession, now = Date.now()): void {
  const step = currentStep(a);
  if (step && step.rest > 0) {
    a.phase = 'rest';
    a.restStarted = now;
    a.restUntil = now + step.rest * 1000;
    a.restSignaled = false;
    a.countdownCue = null;
  } else {
    moveForward(a, now);
  }
}

export function extendRest(a: WorkoutSession, seconds: number, now = Date.now()): boolean {
  if (!a || a.phase !== 'rest' || a.pausedAt !== null || ![30, 60].includes(seconds)) return false;
  a.restUntil = Math.max(a.restUntil || now, now) + seconds * 1000;
  a.restSignaled = false;
  a.countdownCue = null;
  return true;
}

export function toNextFromRest(a: WorkoutSession, now = Date.now()): boolean {
  if (!a || a.phase !== 'rest') return false;
  const step = currentStep(a);
  const seconds = Math.max(0, Math.round((now - (a.restStarted || now)) / 1000));
  a.entries.push({
    cursor: a.cursor,
    name: 'Відпочинок',
    kind: 'rest',
    set: 1,
    reps: null,
    seconds,
    target: step?.rest || 0,
    at: now,
    modified: false,
    completed: seconds >= (step?.rest || 0),
  });
  a.restUntil = null;
  a.restStarted = null;
  a.restSignaled = false;
  a.phase = 'exercise';
  moveForward(a, now);
  return true;
}

export function confirmStep(
  a: WorkoutSession,
  reps: number,
  state: ForgeState,
  now = Date.now(),
  modified = false,
): {ok: boolean; notice?: string} {
  const step = currentStep(a);
  if (!step || a.phase !== 'exercise' || a.pausedAt !== null || step.kind === 'complex') {
    return {ok: false};
  }
  if (
    !Number.isInteger(reps) ||
    reps < 0 ||
    reps > 200 ||
    (step.kind === 'test' && reps > (step.testMax ?? 200))
  ) {
    return {ok: false};
  }

  const seconds = a.stageStarted === null ? 0 : Math.max(0, (now - a.stageStarted) / 1000);
  const isTimed = ['warm', 'cool', 'prep', 'hold', 'timed', 'interval'].includes(step.kind);
  let notice: string | undefined;

  if (!isTimed && Number.isInteger(reps) && Number.isInteger(step.target) && step.kind === 'reps') {
    const remainingSets = a.steps
      .slice(a.cursor + 1)
      .filter((s) => s.name === step.name && s.kind === step.kind);

    if (reps >= step.target + 2) {
      const delta = reps >= step.target + 4 ? 2 : 1;
      if (remainingSets.length > 0) {
        remainingSets[0].target += delta;
        remainingSets[0].adaptationBadge = `↑ +${delta} за запасом`;
        notice = `↑ +${delta} за запасом`;
      }
    } else if (reps <= step.target - 2) {
      const adapted = Math.max(1, reps);
      if (remainingSets.length > 0) {
        for (const rem of remainingSets) {
          rem.target = adapted;
          rem.adaptationBadge = '↓ адаптовано під темп';
        }
        step.rest = (step.rest || 60) + 15;
        notice = '↓ адаптовано під темп (+15 с відпочинку)';
      }
    }

    const low = step.name.toLowerCase();
    const recordList = a.recordsBroken || (a.recordsBroken = []);
    if (low.includes('віджиман') && !low.includes('полегшен') && !modified) {
      const curMax = state.coach.pushMax ?? PROFILE.push;
      if (reps > curMax) {
        state.coach.pushMax = reps;
        state.coach.pushAt = now;
        notice = `🏆 Новий рекорд! Віджимання: ${reps}`;
        recordList.push(`Віджимання: новий максимум ${reps}`);
      }
    } else if (low.includes('строг') && low.includes('підтягуван') && !modified) {
      const curMax = state.coach.strictMax ?? PROFILE.pull;
      if (reps > curMax) {
        state.coach.strictMax = reps;
        state.coach.strictAt = now;
        notice = `🏆 Новий рекорд! Строгі підтягування: ${reps}`;
        recordList.push(`Строгі підтягування: новий максимум ${reps}`);
      }
    } else if (low.includes('резинк') && low.includes('підтягуван') && !modified) {
      const curMax = state.coach.assistedMax ?? PROFILE.assisted;
      if (reps > curMax) {
        state.coach.assistedMax = reps;
        state.coach.assistedAt = now;
        notice = `🏆 Новий рекорд! Підтягування з резинкою: ${reps}`;
        recordList.push(`Підтягування з резинкою: новий максимум ${reps}`);
      }
    }
  }

  const effAssist = a.assistanceOverride ?? step.assistance ?? null;
  const incompleteNegative =
    effAssist === 'negative' &&
    a.eccentricOverride !== null &&
    a.eccentricOverride !== undefined &&
    a.eccentricOverride < 3;

  a.entries.push({
    cursor: a.cursor,
    name: step.name,
    kind: step.kind,
    set: step.set || 1,
    reps: isTimed ? null : reps,
    seconds: isTimed ? Math.round(seconds) : null,
    target: step.target,
    mainPull: !!step.mainPull,
    at: now,
    modified,
    completed: isTimed
      ? step.manual
        ? true
        : seconds >= step.target
      : (!modified || !step.assistance) && (step.kind === 'test' || reps >= step.target),
    testKey: modified ? null : step.testKey || null,
    perSide: !!step.perSide,
    optional: !!step.optional,
    assistance: effAssist,
    eccentricSeconds: a.eccentricOverride ?? null,
    quality: effAssist === 'band-partial' ? 'partial' : modified || incompleteNegative ? 'incomplete' : 'full',
  });

  a.modified = false;
  a.assistanceOverride = null;
  a.eccentricOverride = null;
  finishCurrentStep(a, now);
  return {ok: true, notice};
}

export function confirmComplexMove(
  a: WorkoutSession,
  reps: number,
  now = Date.now(),
  modified = false,
): boolean {
  const step = currentStep(a);
  if (
    !step ||
    step.kind !== 'complex' ||
    a.phase !== 'exercise' ||
    a.complexStarted === null ||
    a.complexEnded !== null ||
    now > a.complexStarted + step.target * 1000
  ) {
    return false;
  }

  const move = a.complexIndex % 4;
  const round = Math.floor(a.complexIndex / 4) + 1;
  const progress = a.complexRepProgress || 0;
  const stepReps = step.reps || [10, 10, 5, 10];
  const remaining = stepReps[move] - progress;

  if (!Number.isInteger(reps) || reps < 1 || reps > remaining) return false;

  a.complexRepProgress = progress + reps;
  const complete = a.complexRepProgress >= stepReps[move];

  a.entries.push({
    cursor: a.cursor,
    name: MOVES[move],
    kind: 'complex',
    set: round,
    reps,
    seconds: null,
    target: stepReps[move],
    at: now,
    modified,
    completed: complete,
    series: true,
  });

  if (modified) a.complexStandard = false;
  a.repOverride = null;
  a.modified = false;

  if (complete) {
    a.complexIndex++;
    a.complexRepProgress = 0;
  }
  if (complete && a.complexIndex % 4 === 0) {
    a.laps.push(complexMilliseconds(a, now));
  }
  if (a.laps.length === step.rounds) {
    a.complexEnded = now;
    finishCurrentStep(a, now);
  }
  return true;
}

export function endComplex(a: WorkoutSession, now = Date.now()): boolean {
  const step = currentStep(a);
  if (step?.kind !== 'complex' || a.complexStarted === null || a.complexEnded !== null) {
    return false;
  }
  a.complexEnded = Math.min(now, a.complexStarted + step.target * 1000);
  finishCurrentStep(a, now);
  return true;
}

export function repeatMini(a: WorkoutSession, now = Date.now()): boolean {
  const s = currentStep(a);
  if (!s?.miniTimer || a.phase !== 'exercise') return false;
  a.entries.push({
    cursor: a.cursor,
    name: s.name,
    kind: 'repeat',
    set: 1,
    reps: null,
    seconds: a.stageStarted === null ? 0 : Math.max(0, Math.round(((a.pausedAt ?? now) - a.stageStarted) / 1000)),
    target: s.target,
    at: now,
    completed: false,
    modified: false,
  });
  a.stageStarted = a.pausedAt !== null ? a.pausedAt : now;
  a.countdownCue = null;
  a.blockSignaled = false;
  return true;
}

export function workoutLog(
  a: WorkoutSession,
  previous: Partial<WorkoutLog> = {},
  now = Date.now(),
): WorkoutLog {
  const grouped = new Map<string, Map<number, string[]>>();

  for (const e of a.entries) {
    const help =
      e.assistance === 'none'
        ? ' · без резинки'
        : e.assistance === 'band-partial'
          ? ' · частковий рух із резинкою (не повне підтягування)'
          : e.assistance === 'band'
            ? ' · з резинкою'
            : e.assistance === 'negative'
              ? ' · негативне'
              : e.assistance === 'band-hold'
                ? ' · з резинкою + затримка'
                : '';
    const key =
      e.name + (e.kind === 'complex' ? ' (комплекс)' : '') + help + (e.perSide ? ' · на сторону' : '');
    if (!grouped.has(key)) grouped.set(key, new Map());
    const sets = grouped.get(key)!;
    const set = e.set || 1;
    if (!sets.has(set)) sets.set(set, []);
    sets.get(set)!.push(
      e.reps === null
        ? `${e.seconds ?? 0} с${e.autoTimed ? ' (таймер)' : ''}`
        : `${e.reps}${e.modified ? '*' : ''}${e.partial ? ' (незавершено)' : ''}${e.eccentricSeconds ? ` [${e.eccentricSeconds} с вниз]` : ''}`,
    );
  }

  const lines: string[] = [];
  grouped.forEach((sets, name) => {
    lines.push(`${name}: ${[...sets.values()].map((parts) => parts.join('+')).join(' / ')}`);
  });

  const complexStep = a.steps.find((x) => x.kind === 'complex');
  const pullEntries = a.entries.filter(
    (e) => e.assistance || (e.kind === 'hold' && e.name.includes('верхньої позиції')),
  );
  const plannedComplex = complexStep
    ? {
        rounds: complexStep.rounds || 3,
        reps: (complexStep.reps || [10, 10, 5, 10]) as [number, number, number, number],
        cap: Math.round(complexStep.target / 60),
      }
    : null;

  const strengthTests: {push: number | null; pull: number | null; assisted: number | null} = {
    push: previous.push ?? null,
    pull: previous.pull ?? null,
    assisted: previous.assisted ?? null,
  };
  a.entries
    .filter((e) => e.testKey)
    .forEach((e) => {
      if (e.testKey) strengthTests[e.testKey] = e.reps;
    });

  const main = a.steps.filter(
    (x) => !x.optional && !['warm', 'cool', 'prep', 'instruction'].includes(x.kind),
  );
  const mainDone = main.every((s) => {
    if (s.kind === 'complex') return a.laps.length === s.rounds;
    const i = a.steps.indexOf(s);
    return a.entries.some((e) => e.cursor === i && e.completed);
  });

  const mainPull = a.steps.map((s, i) => ({...s, i})).filter((s) => s.mainPull);
  const pullQuality =
    mainPull.length > 0 &&
    mainPull.every((s) =>
      a.entries.some(
        (e) =>
          e.cursor === s.i &&
          e.completed &&
          e.quality === 'full' &&
          e.assistance === s.assistance &&
          (e.reps ?? 0) >= s.target,
      ),
    );

  return {
    ...previous,
    returnWorkout: !!a.returnWorkout,
    isReturnWorkout: !!a.isReturnWorkout,
    pullPlan: a.pullPlan || null,
    pullQuality,
    id: a.id,
    date: a.date,
    week: a.week,
    day: a.day,
    title: a.title ?? previous.title,
    programRevision: a.programRevision ?? previous.programRevision,
    plannedComplex,
    pullEntries,
    goalMet:
      !!complexStep &&
      complexStep.rounds === 5 &&
      (complexStep.reps || []).join(',') === '10,10,5,10' &&
      a.laps.length === 5 &&
      a.complexStandard &&
      a.complexEnded !== null &&
      complexMilliseconds(a, now) <= 1320000,
    complexTotalReps: a.entries
      .filter((e) => e.kind === 'complex')
      .reduce((n, e) => n + (e.reps || 0), 0),
    source: 'auto',
    status: a.status,
    started: a.started,
    ended: a.ended,
    minutes: Math.round(workoutMilliseconds(a, now) / 6000) / 10,
    complexSeconds:
      a.complexStarted !== null ? Math.round(complexMilliseconds(a, now) / 1000) : null,
    rounds: a.laps.length,
    laps: [...a.laps],
    actual: lines.join('\n') || 'Заняття розпочато; виконані підходи ще не підтверджено.',
    entries: a.entries.map((e) => ({...e})),
    band: a.band,
    standard: a.complexStandard && a.complexStarted !== null,
    completed:
      a.status === 'complete' &&
      mainDone &&
      (main.length > 0 ||
        (a.day === 6 &&
          a.entries.some(
            (e) =>
              e.completed &&
              (e.seconds ?? 0) > 0 &&
              !['warm', 'cool', 'prep', 'rest', 'repeat', 'instruction'].includes(e.kind),
          ))),
    notes: previous.notes || '',
    rpe: previous.rpe ?? null,
    pain: previous.pain ?? null,
    sleep: previous.sleep ?? null,
    wellbeing: previous.wellbeing ?? null,
    pullReserve: previous.pullReserve ?? null,
    ...strengthTests,
  };
}

export function advanceWorkoutQueue(state: ForgeState): {
  nextWeek: number;
  nextCompletedInCycle: number;
  nextWorkoutIndex: number;
  nextSelectedDay: number;
  cycleCompleted: boolean;
  finishedProgram: boolean;
} {
  const cycleDays = cycleDaysFor(state.frequency);
  let completedInCycle = (state.completedInCycle || 0) + 1;
  let currentWorkoutIndex = state.currentWorkoutIndex || 0;
  let week = state.week;
  let cycleCompleted = false;
  let finishedProgram = false;

  if (completedInCycle >= state.frequency) {
    completedInCycle = 0;
    currentWorkoutIndex = 0;
    cycleCompleted = true;
    if (week < 8) {
      week++;
    } else {
      finishedProgram = true;
    }
  } else {
    currentWorkoutIndex = completedInCycle;
  }

  return {
    nextWeek: week,
    nextCompletedInCycle: completedInCycle,
    nextWorkoutIndex: currentWorkoutIndex,
    nextSelectedDay: cycleDays[currentWorkoutIndex] ?? 0,
    cycleCompleted,
    finishedProgram,
  };
}
