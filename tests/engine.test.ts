import assert from 'node:assert/strict';
import {PROGRAM_REVISION} from '../src/data/program';
import {
  calendarDay,
  calendarGap,
  calendarMonday,
  clock,
  cycleDaysFor,
  cycleLetter,
} from '../src/engine/calendar';
import {
  comboFor,
  evaluateWorkoutProgression,
  pullPlan,
} from '../src/engine/progression';
import {
  buildSessionPlan,
  makeReturnWorkout,
  makeWorkout,
} from '../src/engine/session';
import {
  baseState,
  decodeBackupCode,
  encodeBackupCode,
  loadState,
  parseBandMeta,
  recoverState,
  saveState,
  validState,
} from '../src/engine/storage';
import {buildCooldown, buildWarmup} from '../src/engine/warmup';
import {
  advanceWorkoutQueue,
  confirmComplexMove,
  confirmStep,
  workoutLog,
} from '../src/engine/workout';
import type {ForgeState, WorkoutLog} from '../src/types/forge';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

function makePullLog(overrides: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    week: 1,
    day: 0,
    date: '2026-04-01',
    programRevision: PROGRAM_REVISION,
    started: Date.now() - 86400000,
    ended: Date.now() - 86000000,
    minutes: 35,
    complexSeconds: null,
    rounds: 0,
    actual: 'ok',
    band: 'Товста зелена резинка',
    standard: true,
    completed: true,
    notes: '',
    rpe: 7,
    pain: 0,
    pullReserve: 1,
    pullQuality: true,
    ...overrides,
  };
}

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}

test('Calendar utilities compute ISO weekdays, Monday snap, gaps and clocks', () => {
  assert.equal(calendarMonday('2026-04-08'), '2026-04-06');
  assert.equal(calendarDay('2026-04-06'), 0);
  assert.equal(calendarDay('2026-04-12'), 6);
  assert.equal(calendarGap('2026-04-20', '2026-04-06'), 14);
  assert.equal(clock(125000), '02:05');
  assert.deepEqual(cycleDaysFor(3), [0, 2, 4]);
  assert.deepEqual(cycleDaysFor(4), [0, 2, 4, 6]);
  assert.equal(cycleLetter(4), 'В');
});

test('Pull-up progression levels 0..4 and safety rules work properly', () => {
  const s0 = baseState();
  const p0 = pullPlan(1, 0, s0, '2026-04-10');
  assert.equal(p0.mode, 'foundation');
  assert.equal(p0.level, 0);
  assert.deepEqual(p0.targets, [8, 8, 8]);

  // Level 1 with band progression after 2 good identical sessions
  const s1: ForgeState = {
    ...baseState(),
    coach: {...baseState().coach, strictMax: 2, assistedMax: 4},
  };
  const baseTargets = [1, 1, 1, 1, 1];
  const logA = makePullLog({
    date: '2026-04-06',
    started: 1000,
    pullPlan: {
      targets: baseTargets,
      mode: 'band',
      level: 1,
      max: 2,
      reason: 'ok',
      suggest: false,
      strictSingles: 1,
    },
  });
  const logB = makePullLog({
    date: '2026-04-08',
    started: 2000,
    pullPlan: {
      targets: baseTargets,
      mode: 'band',
      level: 1,
      max: 2,
      reason: 'ok',
      suggest: false,
      strictSingles: 1,
    },
  });
  s1.logs = [logA, logB];
  const p1Up = pullPlan(2, 0, s1, '2026-04-10');
  assert.equal(p1Up.mode, 'band');
  assert.equal(p1Up.level, 1);
  assert.equal(p1Up.strictSingles, 1);
  assert.deepEqual(p1Up.targets, [2, 2, 1, 1, 1]);

  // Pain blocks progression even if prior sessions exist
  s1.logs = [
    logA,
    makePullLog({
      ...logB,
      pain: 3,
    }),
  ];
  const p1Pain = pullPlan(2, 0, s1, '2026-04-10');
  assert.deepEqual(p1Pain.targets, [1, 1, 1, 1, 1]);

  // 14+ day gap falls back to last successful level without increase
  s1.logs = [logA, logB];
  const p1Gap = pullPlan(2, 0, s1, '2026-04-25');
  assert.deepEqual(p1Gap.targets, [1, 1, 1, 1, 1]);

  // Level 2, 3, 4 switch to strict mode ('none')
  const s2: ForgeState = {...baseState(), coach: {...baseState().coach, strictMax: 5}};
  assert.equal(pullPlan(1, 0, s2, '2026-04-10').mode, 'none');
  assert.equal(pullPlan(1, 0, s2, '2026-04-10').level, 2);

  const s4: ForgeState = {...baseState(), coach: {...baseState().coach, strictMax: 10}};
  assert.equal(pullPlan(1, 0, s4, '2026-04-10').level, 4);
});

test('Complex round progression caps cleanly when prior B-day had high RPE or missing completion', () => {
  const s = baseState();
  // Week 3 B wants 4 rounds, without prior B log it caps at 3
  const cNoHistory = comboFor(3, 2, s);
  assert.equal(cNoHistory.rounds, 3);

  // With good 3-round B log (pain 0, rpe 7, standard), unlocks 4 rounds
  s.logs = [
    makePullLog({
      day: 2,
      week: 2,
      rounds: 3,
      rpe: 7,
      pain: 0,
      standard: true,
      completed: true,
      plannedComplex: {rounds: 3, reps: [10, 10, 5, 10], cap: 22},
    }),
  ];
  assert.equal(comboFor(3, 2, s).rounds, 4);

  // With RPE 9, remains capped at 3
  s.logs[0].rpe = 9;
  assert.equal(comboFor(3, 2, s).rounds, 3);
});

test('Global exercise target progression updates after exceeding target without failure', () => {
  const s = baseState();
  const workout = makeWorkout(1, 0, s, '2026-04-10', 100000);
  workout.entries = [
    {
      cursor: 1,
      name: 'Віджимання від підлоги',
      kind: 'reps',
      set: 1,
      reps: 8,
      seconds: null,
      target: 6,
      at: 100100,
      modified: false,
      completed: true,
    },
    {
      cursor: 2,
      name: 'Віджимання від підлоги',
      kind: 'reps',
      set: 2,
      reps: 6,
      seconds: null,
      target: 6,
      at: 100200,
      modified: false,
      completed: true,
    },
  ];
  const {nextProgress, changes} = evaluateWorkoutProgression(
    workout,
    s.exerciseProgress,
    '2026-04-10',
  );
  assert.equal(nextProgress.pushups.targetReps, 7);
  assert.equal(changes.length, 1);

  // Return workout does not modify global targets
  const ret = makeReturnWorkout(s, '2026-04-10', 100000);
  ret.entries = workout.entries;
  const retEval = evaluateWorkoutProgression(ret, s.exerciseProgress, '2026-04-10');
  assert.deepEqual(retEval.changes, []);
});

test('Cycle queue advances correctly for 3 and 4 sessions/week up to week 8', () => {
  let s = baseState();
  s.frequency = 3;
  s.week = 1;
  s.completedInCycle = 0;

  let q = advanceWorkoutQueue(s);
  assert.equal(q.nextWeek, 1);
  assert.equal(q.nextCompletedInCycle, 1);
  assert.equal(q.nextSelectedDay, 2);

  s.completedInCycle = 2;
  q = advanceWorkoutQueue(s);
  assert.equal(q.nextWeek, 2);
  assert.equal(q.nextCompletedInCycle, 0);
  assert.equal(q.nextSelectedDay, 0);
  assert.equal(q.cycleCompleted, true);

  s.week = 8;
  s.frequency = 4;
  s.completedInCycle = 3;
  q = advanceWorkoutQueue(s);
  assert.equal(q.nextWeek, 8);
  assert.equal(q.finishedProgram, true);
});

test('Warmup and cooldown respect pain, lowImpact, mergeWalk, and missing equipment', () => {
  const s = baseState();
  const plan = buildSessionPlan(1, 0, s, '2026-04-10');
  const warmBlocked = buildWarmup({
    week: 1,
    day: 0,
    rows: plan.rows,
    profile: {
      fatigue: 'normal',
      pain: true,
      lowImpact: true,
      mergeWalk: false,
      equipment: {bar: false, band: false, wheel: false},
    },
    level: 0,
    test: false,
  });
  assert.equal(warmBlocked.blocked, true);
  assert.equal(warmBlocked.missing, true);
  assert.ok(warmBlocked.parts.length >= 3);

  s.warmupPrefs.mergeWalk = true;
  const recoveryPlan = buildSessionPlan(1, 6, s, '2026-04-10');
  assert.equal(recoveryPlan.warmup?.seconds, 300);

  const cooldown = buildCooldown({
    rows: plan.rows,
    profile: s.warmupPrefs,
  });
  assert.ok(cooldown.parts.length >= 3);
});

test('Complex partial series and lap completion record accurately', () => {
  const s = baseState();
  const workout = makeWorkout(1, 2, s, '2026-04-10', 10000);
  const complexIdx = workout.steps.findIndex((st) => st.kind === 'complex');
  assert.ok(complexIdx >= 0);
  workout.cursor = complexIdx;
  workout.complexStarted = 20000;

  // Partial 6 + 4 on first move (10 pushups)
  assert.equal(confirmComplexMove(workout, 6, 30000, false), true);
  assert.equal(workout.complexRepProgress, 6);
  assert.equal(workout.complexIndex, 0);

  assert.equal(confirmComplexMove(workout, 4, 40000, false), true);
  assert.equal(workout.complexRepProgress, 0);
  assert.equal(workout.complexIndex, 1);

  // Finish remaining 3 moves in round 1 -> completes lap 1
  assert.equal(confirmComplexMove(workout, 10, 50000, false), true);
  assert.equal(confirmComplexMove(workout, 5, 60000, false), true);
  assert.equal(confirmComplexMove(workout, 10, 70000, false), true);
  assert.equal(workout.laps.length, 1);
  assert.equal(workout.laps[0], 50000);
});

test('confirmStep adapts targets dynamically when exceeded or missed', () => {
  const s = baseState();
  const workout = makeWorkout(1, 0, s, '2026-04-10', 10000);
  const pushIdx = workout.steps.findIndex((st) => st.name.includes('Віджимання'));
  assert.ok(pushIdx >= 0);
  workout.cursor = pushIdx;
  const initialTarget = workout.steps[pushIdx].target;

  const res = confirmStep(workout, initialTarget + 2, s, 20000, false);
  assert.equal(res.ok, true);
  assert.equal(workout.steps[pushIdx + 1].target, initialTarget + 1);
});

test('Storage sharding, recovery, and backup encode/decode reject malformed payloads', () => {
  const storage = new MemoryStorage();
  const s = baseState();
  const session = makeWorkout(1, 0, s, '2026-04-10', 10000);
  const log = workoutLog(session, {}, 20000);
  s.logs = [log];
  assert.equal(validState(s), true);

  assert.equal(saveState(storage, s, new Set([log.id]), true), true);
  assert.ok(storage.getItem('forge8.log.' + log.id));

  const loaded = loadState(storage);
  assert.equal(loaded.state.logs.length, 1);
  assert.equal(loaded.state.logs[0].id, log.id);

  // Backup roundtrip
  const code = encodeBackupCode(s);
  const decoded = decodeBackupCode(code);
  assert.equal(decoded.logs.length, 1);
  assert.equal(decoded.logs[0].id, log.id);

  // Corrupted backup throws
  assert.throws(() => decodeBackupCode('not-valid-base64!!!'));

  // Partial recovery strips invalid log entries while preserving valid state
  const partial = recoverState({week: 3, frequency: 4, logs: [{bad: true}, log]});
  assert.ok(partial);
  assert.equal(partial.week, 3);
  assert.equal(partial.logs.length, 1);
});

test('Autoregulation handles +3 overperformance, cross-day propagation, underperformance +15s rest, and new records', () => {
  const s = baseState();
  // Day A has Reverse Lunges (also present on Day C)
  const dayA = makeWorkout(1, 0, s, '2026-04-10', 10000);
  const lunge1Idx = dayA.steps.findIndex((st) => st.name.includes('Зворотні випади'));
  assert.ok(lunge1Idx >= 0);
  const baseLungeTarget = dayA.steps[lunge1Idx].target;
  dayA.cursor = lunge1Idx;

  // Set 1: +3 overperformance -> Set 2 bumps +1
  const resOver = confirmStep(dayA, baseLungeTarget + 3, s, 20000, false);
  assert.equal(resOver.ok, true);
  assert.equal(dayA.steps[lunge1Idx + 1].target, baseLungeTarget + 1);
  assert.equal(dayA.steps[lunge1Idx + 1].adaptationBadge, '↑ +1 за запасом');

  // Complete Set 2 on target
  dayA.phase = 'exercise';
  dayA.cursor = lunge1Idx + 1;
  confirmStep(dayA, baseLungeTarget + 1, s, 30000, false);

  // Evaluate progression and verify Day C ("В") picks up updated lunges target
  const {nextProgress} = evaluateWorkoutProgression(dayA, s.exerciseProgress, '2026-04-10');
  s.exerciseProgress = nextProgress;
  const dayCPlan = buildSessionPlan(1, 4, s, '2026-04-12');
  const dayCLunge = dayCPlan.rows.find((r) => r.name.includes('Зворотні випади'));
  assert.ok(dayCLunge);
  assert.equal(dayCLunge.reps, baseLungeTarget + 1);

  // Underperformance (-2) on push-ups adapts remaining sets and adds +15s rest
  const wUnder = makeWorkout(1, 0, s, '2026-04-12', 40000);
  const pushIdx = wUnder.steps.findIndex((st) => st.name.includes('Віджимання від підлоги'));
  assert.ok(pushIdx >= 0);
  const initPushTarget = wUnder.steps[pushIdx].target;
  const initRest = wUnder.steps[pushIdx].rest;
  wUnder.cursor = pushIdx;
  const resUnder = confirmStep(wUnder, initPushTarget - 2, s, 50000, false);
  assert.equal(resUnder.ok, true);
  assert.equal(wUnder.steps[pushIdx + 1].target, Math.max(1, initPushTarget - 2));
  assert.equal(wUnder.steps[pushIdx].rest, initRest + 15);

  // Breaking pushMax updates coach.pushMax and adds 🏆 Новий рекорд!
  const wRec = makeWorkout(1, 0, s, '2026-04-12', 60000);
  const pIdx = wRec.steps.findIndex((st) => st.name.includes('Віджимання від підлоги'));
  wRec.cursor = pIdx;
  const resRec = confirmStep(wRec, (s.coach.pushMax || 16) + 2, s, 70000, false);
  assert.ok(resRec.notice?.includes('🏆 Новий рекорд!'));
  assert.equal(s.coach.pushMax, 18);
});

test('Return workout scales chosen core exercise and legacy band strings parse cleanly', () => {
  const s = baseState();
  s.coach.core = 'wheel';
  const retWheel = makeReturnWorkout(s, '2026-04-10', 10000);
  assert.ok(retWheel.steps.some((st) => st.name.includes('Колесо з колін')));
  assert.equal(retWheel.cooldown, undefined);

  s.coach.core = 'deadbug';
  const retBug = makeReturnWorkout(s, '2026-04-10', 10000);
  assert.ok(retBug.steps.some((st) => st.name.includes('Мертвий жук')));

  // Legacy band string compatibility
  assert.deepEqual(parseBandMeta('Фіолетова резинка на коліно'), {
    bandResist: 'Фіолетова',
    bandAttach: 'Коліно',
  });
  assert.deepEqual(parseBandMeta('Товста зелена резинка'), {
    bandResist: 'Зелена',
    bandAttach: 'Стопа',
  });
});

console.log(`\nAll ${passed} tests passed!`);
