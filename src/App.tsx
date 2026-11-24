import {useCallback, useEffect, useRef, useState} from 'react';
import {BottomNav} from './components/BottomNav';
import {ExerciseHelpModal} from './components/ExerciseHelpModal';
import {PWAInstallModal} from './components/PWAInstallModal';
import {OfflineBanner, Toast} from './components/StatusOverlays';
import {TopBar} from './components/TopBar';
import {MOVES, PROGRAM_REVISION} from './data/program';
import {clock, cycleDaysFor, dateISO} from './engine/calendar';
import {evaluateWorkoutProgression} from './engine/progression';
import {
  baseState,
  loadState,
  saveState,
} from './engine/storage';
import {
  advanceWorkoutQueue,
  complexMilliseconds,
  complexRunning,
  confirmComplexMove,
  confirmStep,
  currentStep,
  endComplex,
  extendRest,
  finishCurrentStep,
  moveForward,
  repeatMini,
  timerRemaining,
  toNextFromRest,
  workoutLog,
} from './engine/workout';
import {makeReturnWorkout, makeWorkout} from './engine/session';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {usePWAInstall} from './hooks/usePWAInstall';
import {useWakeLock} from './hooks/useWakeLock';
import type {
  AssistanceType,
  ForgeState,
  TabRoute,
  Wellbeing,
  WorkoutLog,
  WorkoutSession,
} from './types/forge';
import {playSignal, unlockAudio} from './utils/audio';
import {uploadToGoogleDrive} from './utils/googleDriveSync';
import {DiaryView} from './views/DiaryView';
import {FullPlanView} from './views/FullPlanView';
import {GuideView} from './views/GuideView';
import {HomeView} from './views/HomeView';
import {ProfileView} from './views/ProfileView';
import {RunnerView} from './views/RunnerView';
import {WodView} from './views/WodView';

const VALID_ROUTES: TabRoute[] = [
  'home',
  'plan',
  'train',
  'diary',
  'guide',
  'profile',
  'fullplan',
  'wod',
];

function parseHashRoute(): TabRoute {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#/, '').trim().toLowerCase() as TabRoute;
  return VALID_ROUTES.includes(raw) ? raw : 'home';
}

function cloneSession(s: WorkoutSession): WorkoutSession {
  return {
    ...s,
    steps: s.steps.map((st) => ({...st})),
    entries: s.entries.map((e) => ({...e})),
    laps: [...s.laps],
    countdownCue: s.countdownCue ? {...s.countdownCue} : null,
    recordsBroken: s.recordsBroken ? [...s.recordsBroken] : undefined,
  };
}

function upsertSessionLog(
  logs: WorkoutLog[],
  session: WorkoutSession,
  now = Date.now(),
): {logs: WorkoutLog[]; isNew: boolean; logId: string} {
  const idx = logs.findIndex((l) => l.id === session.id);
  const prev = idx >= 0 ? logs[idx] : {};
  const nextLog = workoutLog(session, prev, now);
  if (idx >= 0) {
    const nextLogs = logs.slice();
    nextLogs[idx] = nextLog;
    return {logs: nextLogs, isNew: false, logId: nextLog.id};
  }
  return {logs: [...logs, nextLog], isNew: true, logId: nextLog.id};
}

function togglePauseSession(session: WorkoutSession, now = Date.now()): WorkoutSession {
  const next = cloneSession(session);
  if (next.pausedAt === null) {
    next.pausedAt = now;
    next.status = 'paused';
  } else {
    const delta = Math.max(0, now - next.pausedAt);
    next.pausedMs += delta;
    if (next.stageStarted !== null) next.stageStarted += delta;
    if (next.restStarted !== null) next.restStarted += delta;
    if (next.restUntil !== null) next.restUntil += delta;
    if (next.warmupRestUntil !== null && next.warmupRestUntil !== undefined) {
      next.warmupRestUntil += delta;
    }
    if (next.complexStarted !== null) next.complexStarted += delta;
    next.pausedAt = null;
    next.status = 'active';
  }
  return next;
}

export default function App() {
  const initialRef = useRef<ReturnType<typeof loadState> | null>(null);
  if (!initialRef.current) {
    initialRef.current = loadState(window.localStorage);
  }

  const [state, setState] = useState<ForgeState>(() => initialRef.current!.state);
  const [recoveryRaw, setRecoveryRaw] = useState<string | null>(
    () => initialRef.current!.recoveryRaw,
  );
  const [recoveryNotice, setRecoveryNotice] = useState<string>(
    () => initialRef.current!.recoveryNotice,
  );

  const [route, setRoute] = useState<TabRoute>(() => parseHashRoute());
  const [pendingWorkout, setPendingWorkout] = useState<WorkoutSession | null>(null);
  const [helpModal, setHelpModal] = useState<{name: string; note?: string} | null>(null);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const structureDirtyRef = useRef<boolean>(false);
  const toastTimerRef = useRef<number | null>(null);
  const pausedByHelpRef = useRef<boolean>(false);
  const stateRef = useRef<ForgeState>(state);
  stateRef.current = state;

  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const isOnline = useOnlineStatus();
  const syncingPendingRef = useRef(false);

  const shouldKeepAwake =
    state.keepScreen &&
    ((route === 'train' &&
      !!state.active &&
      state.active.phase !== 'summary' &&
      state.active.pausedAt === null) ||
      (route === 'wod' && !!state.wod?.running));

  const wakeLock = useWakeLock(shouldKeepAwake);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3400);
  }, []);

  // Persist on state changes
  useEffect(() => {
    const dirty = dirtyIdsRef.current;
    const struct = structureDirtyRef.current;
    saveState(window.localStorage, state, dirty, struct);
    dirtyIdsRef.current = new Set();
    structureDirtyRef.current = false;
  }, [state]);

  // Flush save on visibilitychange / pagehide
  useEffect(() => {
    const flush = () => {
      saveState(
        window.localStorage,
        stateRef.current,
        dirtyIdsRef.current,
        structureDirtyRef.current,
      );
      dirtyIdsRef.current = new Set();
      structureDirtyRef.current = false;
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => {
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Sync hash navigation
  useEffect(() => {
    const onHash = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((nextRoute: TabRoute) => {
    setRoute(nextRoute);
    if (window.location.hash !== `#${nextRoute}`) {
      window.location.hash = `#${nextRoute}`;
    }
    window.scrollTo({top: 0, behavior: 'auto'});
  }, []);

  const commitState = useCallback(
    (
      updater: (prev: ForgeState) => ForgeState,
      opts?: {dirtyLogId?: string; structureDirty?: boolean; toast?: string},
    ) => {
      if (opts?.dirtyLogId) dirtyIdsRef.current.add(opts.dirtyLogId);
      if (opts?.structureDirty) structureDirtyRef.current = true;
      setState(updater);
      if (opts?.toast) showToast(opts.toast);
    },
    [showToast],
  );

  // Live timer progression & audio alerts
  useEffect(() => {
    const pending = state.pendingSyncIds || [];
    if (!isOnline || !state.googleDriveUrl || state.googleDriveAutoSync === false) return;
    if (pending.length === 0 || syncingPendingRef.current) return;

    const pendingLogs = state.logs.filter((l) => pending.includes(l.id));
    if (pendingLogs.length === 0) {
      commitState((prev) => ({...prev, pendingSyncIds: []}));
      return;
    }

    syncingPendingRef.current = true;
    void uploadToGoogleDrive(state.googleDriveUrl, state.googleDriveSecret, {
      logs: pendingLogs,
      state,
    })
      .then((res) => {
        if (res.ok) {
          commitState(
            (prev) => ({
              ...prev,
              lastSyncedAt: Date.now(),
              pendingSyncIds: (prev.pendingSyncIds || []).filter(
                (id) => !pending.includes(id),
              ),
            }),
            {toast: `Синхронізовано відкладені тренування (${pendingLogs.length})`},
          );
        }
      })
      .finally(() => {
        syncingPendingRef.current = false;
      });
  }, [
    isOnline,
    state.googleDriveUrl,
    state.googleDriveSecret,
    state.googleDriveAutoSync,
    state.pendingSyncIds,
    state.logs,
    commitState,
  ]);

  useEffect(() => {
    const active = state.active;
    const wod = state.wod;
    const activeRunning = !!active && active.phase !== 'summary' && active.pausedAt === null;
    const wodRunning = !!wod?.running;

    if (!activeRunning && !wodRunning) return;

    const id = window.setInterval(() => {
      const now = Date.now();
      const s = stateRef.current;

      // WOD 22-minute cap
      if (s.wod?.running && s.wod.started !== null) {
        const elapsed = s.wod.elapsed + (now - s.wod.started);
        if (elapsed >= 22 * 60 * 1000) {
          void playSignal('finish', s.sound);
          const finalWod = {
            ...s.wod,
            running: false,
            started: null,
            elapsed: 22 * 60 * 1000,
            done: true,
          };
          const logId = `wod-${now}`;
          const newLog: WorkoutLog = {
            id: logId,
            type: 'wod',
            week: s.week,
            day: 2,
            date: dateISO(new Date(now)),
            title: 'Контрольний WOD (22 хв)',
            programRevision: PROGRAM_REVISION,
            started: now - finalWod.elapsed,
            ended: now,
            minutes: 22,
            complexSeconds: 1320,
            rounds: finalWod.round,
            splits: [...finalWod.splits],
            actual: `WOD 22:00 · завершено ${finalWod.round} / 5 раундів`,
            band: s.band,
            standard: true,
            completed: finalWod.round === 5,
            notes: '',
            rpe: null,
            pain: 0,
          };
          dirtyIdsRef.current.add(logId);
          structureDirtyRef.current = true;
          setState((prev) => ({
            ...prev,
            wod: finalWod,
            logs: [...prev.logs, newLog],
          }));
          showToast('Ліміт WOD 22:00 вичерпано');
          return;
        }
      }

      if (!s.active || s.active.phase === 'summary' || s.active.pausedAt !== null) return;
      const cur = s.active;
      const step = currentStep(cur);
      if (!step) return;

      const rem = timerRemaining(cur, step, now);

      // 3-2-1 countdown cues
      if (rem !== null && rem > 0 && rem <= 3100) {
        const sec = Math.ceil(rem / 1000);
        const cueKey =
          cur.phase === 'rest'
            ? `rest:${cur.cursor}`
            : step.warmupGate
              ? 'warmrest'
              : `step:${cur.cursor}`;
        if (
          sec >= 1 &&
          sec <= 3 &&
          (cur.countdownCue?.key !== cueKey || cur.countdownCue?.last !== sec)
        ) {
          void playSignal('countdown', s.sound);
          setState((prev) =>
            prev.active
              ? {
                  ...prev,
                  active: {...prev.active, countdownCue: {key: cueKey, last: sec}},
                }
              : prev,
          );
        }
      }

      // Warmup gate breathing timer
      if (step.warmupGate && cur.warmupRestUntil && now >= cur.warmupRestUntil && !cur.warmupRestSignaled) {
        void playSignal('finish', s.sound);
        showToast('Дихання завершено — готовий до основної частини');
        setState((prev) =>
          prev.active ? {...prev, active: {...prev.active, warmupRestSignaled: true}} : prev,
        );
        return;
      }

      // Rest timer finished
      if (cur.phase === 'rest' && rem !== null && rem <= 0 && !cur.restSignaled) {
        void playSignal('finish', s.sound);
        showToast('Відпочинок завершено — пора до наступного підходу');
        setState((prev) =>
          prev.active ? {...prev, active: {...prev.active, restSignaled: true}} : prev,
        );
        return;
      }

      // Complex 22-minute cap
      if (
        cur.phase === 'exercise' &&
        step.kind === 'complex' &&
        cur.complexStarted !== null &&
        cur.complexEnded === null &&
        now >= cur.complexStarted + step.target * 1000
      ) {
        void playSignal('finish', s.sound);
        showToast('Час комплексу 22:00 вичерпано');
        setState((prev) => {
          if (!prev.active) return prev;
          const next = cloneSession(prev.active);
          next.complexEnded = next.complexStarted! + step.target * 1000;
          next.phase = 'complex-end';
          const up = upsertSessionLog(prev.logs, next, now);
          dirtyIdsRef.current.add(up.logId);
          return {...prev, active: next, logs: up.logs};
        });
        return;
      }

      // Mini-timer auto-advance or block finish alert
      if (
        cur.phase === 'exercise' &&
        ['warm', 'cool', 'prep', 'hold', 'timed', 'interval'].includes(step.kind) &&
        cur.stageStarted !== null &&
        step.target > 0 &&
        rem !== null &&
        rem <= 0
      ) {
        if (step.miniTimer) {
          void playSignal('finish', s.sound);
          setState((prev) => {
            if (!prev.active) return prev;
            const next = cloneSession(prev.active);
            const curStep = currentStep(next);
            if (!curStep?.miniTimer) return prev;
            next.entries.push({
              cursor: next.cursor,
              name: curStep.name,
              kind: curStep.kind,
              set: 1,
              reps: null,
              seconds: curStep.target,
              target: curStep.target,
              at: now,
              modified: false,
              completed: true,
              autoTimed: true,
            });
            finishCurrentStep(next, now);
            const following = currentStep(next);
            if (following?.miniTimer && !following.warmupGate) {
              next.stageStarted = now;
            }
            const up = upsertSessionLog(prev.logs, next, now);
            dirtyIdsRef.current.add(up.logId);
            return {...prev, active: next, logs: up.logs};
          });
        } else if (!cur.blockSignaled) {
          void playSignal('finish', s.sound);
          showToast('Таймер вправи завершився — підтвердь виконання');
          setState((prev) =>
            prev.active ? {...prev, active: {...prev.active, blockSignaled: true}} : prev,
          );
        }
      }
    }, 200);

    return () => window.clearInterval(id);
  }, [state.active?.id, state.active?.phase, state.active?.pausedAt, state.wod?.running, showToast]);

  // Handlers
  const handleStartWorkout = (day: number) => {
    void unlockAudio();
    const session = makeWorkout(state.week, day, state, dateISO(), Date.now());
    const hasWarmupParts = !!session.warmup?.parts?.length;
    if (hasWarmupParts) {
      setPendingWorkout(session);
      navigate('train');
      return;
    }
    const now = Date.now();
    const up = upsertSessionLog(state.logs, session, now);
    commitState(
      (prev) => ({
        ...prev,
        selectedDay: day,
        active: session,
        logs: up.logs,
      }),
      {dirtyLogId: up.logId, structureDirty: up.isNew},
    );
    navigate('train');
  };

  const handleStartReturnWorkout = () => {
    void unlockAudio();
    const session = makeReturnWorkout(state, dateISO(), Date.now());
    setPendingWorkout(session);
    navigate('train');
  };

  const handleStartPendingWithWarmup = () => {
    if (!pendingWorkout) return;
    void unlockAudio();
    const now = Date.now();
    const session = cloneSession(pendingWorkout);
    session.started = now;
    if (session.steps[0]?.miniTimer) {
      session.stageStarted = now;
    }
    const up = upsertSessionLog(state.logs, session, now);
    void playSignal('start', state.sound);
    setPendingWorkout(null);
    commitState(
      (prev) => ({...prev, active: session, logs: up.logs}),
      {dirtyLogId: up.logId, structureDirty: up.isNew},
    );
  };

  const handleSkipPendingWarmup = () => {
    if (!pendingWorkout) return;
    void unlockAudio();
    const now = Date.now();
    const session = cloneSession(pendingWorkout);
    session.started = now;
    while (
      session.cursor < session.steps.length &&
      (session.steps[session.cursor].kind === 'warm' || session.steps[session.cursor].warmupGate)
    ) {
      session.entries.push({
        cursor: session.cursor,
        name: session.steps[session.cursor].name,
        kind: 'skipped',
        set: 1,
        reps: null,
        seconds: 0,
        target: session.steps[session.cursor].target,
        at: now,
        modified: false,
        completed: false,
      });
      session.cursor++;
    }
    if (session.cursor >= session.steps.length) {
      session.phase = 'summary';
      session.status = 'complete';
      session.ended = now;
    }
    const up = upsertSessionLog(state.logs, session, now);
    setPendingWorkout(null);
    commitState(
      (prev) => ({...prev, active: session, logs: up.logs}),
      {dirtyLogId: up.logId, structureDirty: up.isNew, toast: 'Розминку пропущено'},
    );
  };

  const handleOpenExerciseHelp = useCallback(
    (name: string, note?: string) => {
      const cur = stateRef.current.active;
      if (
        cur &&
        cur.phase !== 'summary' &&
        cur.pausedAt === null &&
        !complexRunning(cur)
      ) {
        pausedByHelpRef.current = true;
        const paused = togglePauseSession(cur, Date.now());
        setState((prev) => ({...prev, active: paused}));
      } else {
        pausedByHelpRef.current = false;
      }
      setHelpModal({name, note});
    },
    [],
  );

  const handleCloseExerciseHelp = useCallback(() => {
    setHelpModal(null);
    if (pausedByHelpRef.current) {
      pausedByHelpRef.current = false;
      const cur = stateRef.current.active;
      if (cur && cur.pausedAt !== null) {
        const resumed = togglePauseSession(cur, Date.now());
        setState((prev) => ({...prev, active: resumed}));
      }
    }
  }, []);

  const mutateActive = (
    fn: (session: WorkoutSession, draftState: ForgeState, now: number) => string | void,
  ) => {
    const now = Date.now();
    let dirtyId: string | undefined;
    let isNew = false;
    let notice: string | undefined;

    setState((prev) => {
      if (!prev.active) return prev;
      const nextState: ForgeState = {
        ...prev,
        coach: {...prev.coach},
        active: cloneSession(prev.active),
      };
      const result = fn(nextState.active!, nextState, now);
      if (typeof result === 'string' && result) notice = result;
      const up = upsertSessionLog(prev.logs, nextState.active!, now);
      dirtyId = up.logId;
      isNew = up.isNew;
      nextState.logs = up.logs;
      return nextState;
    });

    if (dirtyId) dirtyIdsRef.current.add(dirtyId);
    if (isNew) structureDirtyRef.current = true;
    if (notice) showToast(notice);
  };

  const helpComplexRemaining = (() => {
    if (!state.active || !complexRunning(state.active)) return null;
    const step = currentStep(state.active);
    if (!step) return null;
    const left = Math.max(0, step.target * 1000 - complexMilliseconds(state.active));
    const moveIdx = state.active.complexIndex % 4;
    return `Залишок комплексу: ${clock(left)} · Поточна вправа: ${MOVES[moveIdx]}`;
  })();

  const isFullscreenMode =
    (route === 'train' &&
      ((!!state.active && state.active.phase !== 'summary') || !!pendingWorkout)) ||
    route === 'wod';

  const hideBottomNav =
    (route === 'train' && (!!state.active || !!pendingWorkout)) || route === 'wod';

  return (
    <div className="min-h-dvh bg-[#111310] text-[#F2F6EB] flex flex-col">
      <TopBar
        currentRoute={route}
        activeWorkout={state.active}
        onNavigate={navigate}
        onResumeWorkout={() => navigate('train')}
      />

      <main
        className={
          isFullscreenMode
            ? 'flex-1 mx-auto w-full max-w-6xl px-3 sm:px-6 py-1'
            : 'flex-1 mx-auto w-full max-w-6xl px-3.5 sm:px-6 pt-3 pb-18 md:pb-8'
        }
      >
        {(route === 'home' || route === 'plan') && (
          <HomeView
            state={state}
            isInstalled={isInstalled}
            onSelectFrequency={(freq) => {
              const days = cycleDaysFor(freq);
              commitState((prev) => ({
                ...prev,
                frequency: freq,
                currentWorkoutIndex: Math.min(prev.currentWorkoutIndex, freq - 1),
                selectedDay: days.includes(prev.selectedDay) ? prev.selectedDay : days[0],
              }));
            }}
            onSelectWeek={(week) => commitState((prev) => ({...prev, week}))}
            onSelectDay={(day) => commitState((prev) => ({...prev, selectedDay: day}))}
            onStartWorkout={handleStartWorkout}
            onStartReturnWorkout={handleStartReturnWorkout}
            onResumeWorkout={() => navigate('train')}
            onOpenExerciseHelp={handleOpenExerciseHelp}
            onNavigate={navigate}
            onOpenInstall={() => setInstallModalOpen(true)}
            onDismissInstall={() =>
              commitState((prev) => ({...prev, installDismissed: true}))
            }
          />
        )}

        {route === 'train' && (
          <RunnerView
            state={state}
            pendingWorkout={pendingWorkout}
            wakeLockActive={wakeLock.active}
            wakeLockStatusText={wakeLock.statusText}
            onStartPendingWithWarmup={handleStartPendingWithWarmup}
            onSkipPendingWarmup={handleSkipPendingWarmup}
            onCancelPending={() => {
              setPendingWorkout(null);
              navigate('home');
            }}
            onOpenExerciseHelp={handleOpenExerciseHelp}
            onPauseToggle={() => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                const toggled = togglePauseSession(sess, now);
                Object.assign(sess, toggled);
              });
            }}
            onStartMiniTimer={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              mutateActive((sess, _, now) => {
                sess.stageStarted = now;
              });
            }}
            onRepeatMini={() => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                repeatMini(sess, now);
              });
            }}
            onSkipStep={() => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                const st = currentStep(sess);
                if (!st) return;
                sess.entries.push({
                  cursor: sess.cursor,
                  name: st.name,
                  kind: 'skipped',
                  set: st.set || 1,
                  reps: null,
                  seconds: 0,
                  target: st.target,
                  at: now,
                  modified: false,
                  completed: false,
                });
                moveForward(sess, now);
                const nextSt = currentStep(sess);
                if (nextSt?.miniTimer && !nextSt.warmupGate) {
                  sess.stageStarted = now;
                }
              });
            }}
            onCompleteMiniManual={() => {
              void unlockAudio();
              mutateActive((sess, st, now) => {
                const res = confirmStep(sess, 0, st, now, false);
                const nextSt = currentStep(sess);
                if (nextSt?.miniTimer && !nextSt.warmupGate && sess.phase === 'exercise') {
                  sess.stageStarted = now;
                  void playSignal('start', st.sound);
                }
                return res.notice;
              });
            }}
            onStartWarmupGateRest={() => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                sess.warmupRestUntil = now + 120000;
                sess.warmupRestSignaled = false;
              });
            }}
            onFinishWarmupGate={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              mutateActive((sess, _, now) => {
                sess.warmupRestUntil = null;
                moveForward(sess, now);
              });
            }}
            onRepeatWarmup={() => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                sess.cursor = 0;
                sess.warmupRestUntil = null;
                sess.stageStarted = sess.steps[0]?.miniTimer ? now : null;
              });
            }}
            onStopDueToPain={() => {
              mutateActive((sess, _, now) => {
                sess.status = 'interrupted';
                sess.phase = 'summary';
                sess.ended = now;
              });
            }}
            onStartComplex={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              mutateActive((sess, _, now) => {
                sess.complexStarted = now;
              });
            }}
            onConfirmComplexMove={(reps, mod) => {
              void unlockAudio();
              mutateActive((sess, _, now) => {
                const prevLaps = sess.laps.length;
                confirmComplexMove(sess, reps, now, mod);
                if (sess.laps.length > prevLaps && sess.phase === 'exercise') {
                  void playSignal('start', state.sound);
                  return `Раунд ${sess.laps.length} завершено`;
                }
              });
            }}
            onEndComplexEarly={() => {
              mutateActive((sess, _, now) => {
                endComplex(sess, now);
                sess.phase = 'complex-end';
              });
            }}
            onConfirmComplexEnd={(std) => {
              mutateActive((sess, _, now) => {
                sess.complexStandard = std;
                sess.phase = 'exercise';
                moveForward(sess, now);
              });
            }}
            onStartTimedStep={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              mutateActive((sess, _, now) => {
                sess.stageStarted = now;
                sess.blockSignaled = false;
              });
            }}
            onConfirmStep={(reps, mod) => {
              void unlockAudio();
              mutateActive((sess, st, now) => {
                const res = confirmStep(sess, reps, st, now, mod);
                return res.notice;
              });
            }}
            onExtendRest={(sec) => {
              mutateActive((sess, _, now) => {
                extendRest(sess, sec, now);
                return `Додано +${sec} с відпочинку`;
              });
            }}
            onFinishRestEarly={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              mutateActive((sess, _, now) => {
                toNextFromRest(sess, now);
              });
            }}
            onSetAssistanceOverride={(assist: AssistanceType) => {
              mutateActive((sess) => {
                sess.assistanceOverride = assist;
              });
            }}
            onSetEccentricOverride={(sec: number) => {
              mutateActive((sess) => {
                sess.eccentricOverride = sec;
              });
            }}
            onToggleSound={() => {
              void unlockAudio();
              commitState((prev) => ({...prev, sound: !prev.sound}));
            }}
            onInterruptWorkout={() => {
              mutateActive((sess, _, now) => {
                sess.status = 'interrupted';
                sess.phase = 'summary';
                sess.ended = now;
              });
            }}
            onSaveSummary={(feedback) => {
              const cur = state.active;
              if (!cur) return;
              const now = Date.now();
              const {nextProgress, changes} = evaluateWorkoutProgression(
                cur,
                state.exerciseProgress,
                dateISO(new Date(now)),
              );
              const existingIdx = state.logs.findIndex((l) => l.id === cur.id);
              const baseLog = workoutLog(
                cur,
                existingIdx >= 0 ? state.logs[existingIdx] : {},
                now,
              );
              const finalLog: WorkoutLog = {
                ...baseLog,
                ...feedback,
                progressChanges: changes,
              };
              const isTest = cur.day === 0 && cur.week === 8;

              commitState(
                (prev) => {
                  const nextLogs = prev.logs.slice();
                  if (existingIdx >= 0) nextLogs[existingIdx] = finalLog;
                  else nextLogs.push(finalLog);

                  const nextCoach = {...prev.coach};
                  if (finalLog.pull != null) {
                    nextCoach.strictMax = finalLog.pull;
                    nextCoach.strictAt = now;
                  }
                  if (finalLog.push != null && finalLog.push > (nextCoach.pushMax ?? 0)) {
                    nextCoach.pushMax = finalLog.push;
                    nextCoach.pushAt = now;
                  }

                  if (cur.returnWorkout || cur.isReturnWorkout || !finalLog.completed) {
                    return {
                      ...prev,
                      coach: nextCoach,
                      exerciseProgress: nextProgress,
                      logs: nextLogs,
                      active: null,
                    };
                  }

                  const q = advanceWorkoutQueue(prev);
                  return {
                    ...prev,
                    coach: nextCoach,
                    exerciseProgress: nextProgress,
                    logs: nextLogs,
                    active: null,
                    week: q.nextWeek,
                    completedInCycle: q.nextCompletedInCycle,
                    currentWorkoutIndex: q.nextWorkoutIndex,
                    selectedDay: q.nextSelectedDay,
                  };
                },
                {
                  dirtyLogId: finalLog.id,
                  structureDirty: existingIdx < 0,
                  toast: changes[0] || 'Тренування збережено в щоденник',
                },
              );

              if (state.googleDriveUrl && state.googleDriveAutoSync !== false) {
                const url = state.googleDriveUrl;
                const secret = state.googleDriveSecret;
                void uploadToGoogleDrive(url, secret, {
                  log: finalLog,
                  state,
                }).then((res) => {
                  if (res.ok) {
                    commitState((prev) => ({
                      ...prev,
                      lastSyncedAt: Date.now(),
                      pendingSyncIds: (prev.pendingSyncIds || []).filter((id) => id !== finalLog.id),
                    }));
                  } else {
                    commitState((prev) => {
                      const existing = prev.pendingSyncIds || [];
                      if (existing.includes(finalLog.id)) return prev;
                      return {...prev, pendingSyncIds: [...existing, finalLog.id]};
                    });
                  }
                });
              }

              navigate(isTest ? 'diary' : 'home');
            }}
            onNavigate={navigate}
          />
        )}

        {route === 'diary' && (
          <DiaryView
            state={state}
            onDeleteLog={(id) => {
              commitState(
                (prev) => ({
                  ...prev,
                  logs: prev.logs.filter((l) => l.id !== id),
                }),
                {structureDirty: true, toast: 'Запис видалено'},
              );
            }}
          />
        )}

        {route === 'guide' && (
          <GuideView
            state={state}
            onToggleReadiness={(idx) => {
              commitState((prev) => {
                const set = new Set(prev.ready || []);
                if (set.has(idx)) set.delete(idx);
                else set.add(idx);
                return {...prev, ready: [...set].sort((a, b) => a - b)};
              });
            }}
            onOpenExerciseHelp={(name) => handleOpenExerciseHelp(name)}
            onStartWod={() => navigate('wod')}
          />
        )}

        {route === 'fullplan' && (
          <FullPlanView state={state} onBack={() => navigate('home')} />
        )}

        {route === 'wod' && (
          <WodView
            wod={state.wod}
            onStart={() => {
              void unlockAudio();
              void playSignal('start', state.sound);
              const now = Date.now();
              commitState((prev) => {
                const w = prev.wod || {
                  running: false,
                  started: null,
                  elapsed: 0,
                  round: 0,
                  splits: [],
                  done: false,
                };
                return {
                  ...prev,
                  wod: {...w, running: true, started: now},
                };
              });
            }}
            onPause={() => {
              const now = Date.now();
              commitState((prev) => {
                if (!prev.wod || !prev.wod.running || prev.wod.started === null) return prev;
                return {
                  ...prev,
                  wod: {
                    ...prev.wod,
                    running: false,
                    elapsed: prev.wod.elapsed + (now - prev.wod.started),
                    started: null,
                  },
                };
              });
            }}
            onRound={() => {
              void unlockAudio();
              const now = Date.now();
              const w = state.wod;
              if (!w || !w.running || w.started === null) return;
              const elapsed = w.elapsed + (now - w.started);
              const nextRound = w.round + 1;
              const nextSplits = [...w.splits, elapsed];
              if (nextRound >= 5) {
                void playSignal('finish', state.sound);
                const logId = `wod-${now}`;
                const newLog: WorkoutLog = {
                  id: logId,
                  type: 'wod',
                  week: state.week,
                  day: 2,
                  date: dateISO(new Date(now)),
                  title: 'Контрольний WOD (5 раундів)',
                  programRevision: PROGRAM_REVISION,
                  started: now - elapsed,
                  ended: now,
                  minutes: Math.round(elapsed / 6000) / 10,
                  complexSeconds: Math.round(elapsed / 1000),
                  rounds: 5,
                  splits: nextSplits,
                  laps: nextSplits,
                  actual: `WOD 5/5 раундів за ${clock(elapsed)}`,
                  band: state.band,
                  standard: true,
                  completed: true,
                  notes: '',
                  rpe: null,
                  pain: 0,
                };
                commitState(
                  (prev) => ({
                    ...prev,
                    wod: {running: false, started: null, elapsed, round: 5, splits: nextSplits, done: true},
                    logs: [...prev.logs, newLog],
                  }),
                  {dirtyLogId: logId, structureDirty: true, toast: 'WOD завершено та збережено!'},
                );
              } else {
                void playSignal('start', state.sound);
                commitState((prev) => ({
                  ...prev,
                  wod: {...w, round: nextRound, splits: nextSplits},
                }));
              }
            }}
            onFinish={() => {
              const now = Date.now();
              const w = state.wod;
              if (!w) return;
              const elapsed = w.running && w.started !== null ? w.elapsed + (now - w.started) : w.elapsed;
              const logId = `wod-${now}`;
              const newLog: WorkoutLog = {
                id: logId,
                type: 'wod',
                week: state.week,
                day: 2,
                date: dateISO(new Date(now)),
                title: 'Контрольний WOD',
                programRevision: PROGRAM_REVISION,
                started: now - elapsed,
                ended: now,
                minutes: Math.round(elapsed / 6000) / 10,
                complexSeconds: Math.round(elapsed / 1000),
                rounds: w.round,
                splits: [...w.splits],
                laps: [...w.splits],
                actual: `WOD ${w.round}/5 раундів за ${clock(elapsed)}`,
                band: state.band,
                standard: false,
                completed: w.round === 5,
                notes: '',
                rpe: null,
                pain: 0,
              };
              commitState(
                (prev) => ({
                  ...prev,
                  wod: {...w, running: false, started: null, elapsed, done: true},
                  logs: [...prev.logs, newLog],
                }),
                {dirtyLogId: logId, structureDirty: true, toast: 'Результат WOD збережено'},
              );
            }}
            onReset={() => commitState((prev) => ({...prev, wod: null}))}
            onExit={() => navigate('home')}
          />
        )}

        {route === 'profile' && (
          <ProfileView
            state={state}
            isInstalled={isInstalled}
            wakeLockStatusText={wakeLock.statusText}
            recoveryRaw={recoveryRaw}
            recoveryNotice={recoveryNotice}
            onUpdateState={(updater, notice) =>
              commitState(updater, {toast: notice})
            }
            onImportState={(incoming, notice) => {
              setRecoveryRaw(null);
              setRecoveryNotice('');
              commitState(() => incoming, {
                structureDirty: true,
                toast: notice,
              });
            }}
            onResetAll={() => {
              window.localStorage.clear();
              setPendingWorkout(null);
              setRecoveryRaw(null);
              setRecoveryNotice('');
              commitState(() => baseState(), {
                structureDirty: true,
                toast: 'Усі дані скинуто',
              });
              navigate('home');
            }}
            onOpenInstall={() => setInstallModalOpen(true)}
            onToast={showToast}
          />
        )}
      </main>

      {!hideBottomNav && <BottomNav currentRoute={route} onNavigate={navigate} />}

      <ExerciseHelpModal
        exerciseName={helpModal?.name || null}
        fallbackNote={helpModal?.note}
        complexRemaining={helpComplexRemaining}
        pausedWorkout={pausedByHelpRef.current}
        onClose={handleCloseExerciseHelp}
      />

      <PWAInstallModal
        open={installModalOpen}
        isIOS={isIOS}
        isInstallable={isInstallable}
        onInstallNative={install}
        onClose={() => setInstallModalOpen(false)}
      />

      <OfflineBanner />
      <Toast message={toastMsg} />
    </div>
  );
}
