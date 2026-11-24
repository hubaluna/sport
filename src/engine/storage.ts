import {
  COACH_COPY_EDITS,
  COMBO_TABLE,
  DAYS,
  GUIDE,
  PROFILE,
  PROGRAM_REVISION,
  PULL_REFERENCE,
  WEEKS,
} from '../data/program';
import type {
  ComplexSpec,
  ForgeState,
  PullPlan,
  WorkoutEntry,
  WorkoutLog,
  WorkoutSession,
} from '../types/forge';
import {dateISO, nextMonday} from './calendar';
import {buildSessionPlan} from './session';

export const STORAGE_KEY = 'forge8.mobile.v2';
export const RECOVERY_KEY = 'forge8.recovery.backup.v1';
export const LOG_INDEX_KEY = 'forge8.log.index.v1';

export function parseBandMeta(bandText?: string): {bandResist: string; bandAttach: string} {
  const s = (bandText || '').toLowerCase();
  let bandResist = 'Зелена';
  if (s.includes('без резинки')) bandResist = 'Без резинки';
  else if (s.includes('червон')) bandResist = 'Червона';
  else if (s.includes('чорн')) bandResist = 'Чорна';
  else if (s.includes('фіолет') || s.includes('фиолет')) bandResist = 'Фіолетова';
  else if (s.includes('зелен')) bandResist = 'Зелена';

  const bandAttach = s.includes('колін') || s.includes('колен') ? 'Коліно' : 'Стопа';
  return {bandResist, bandAttach};
}

export function baseState(now = new Date()): ForgeState {
  return {
    version: 2,
    programRevision: PROGRAM_REVISION,
    week: 1,
    frequency: 3,
    start: nextMonday(now),
    band: PROFILE.band,
    bandResist: 'Зелена',
    bandAttach: 'Стопа',
    coach: {
      strictMax: PROFILE.pull,
      strictAt: 0,
      assistedMax: PROFILE.assisted,
      assistedROM: PROFILE.assistedROM,
      assistedAt: 0,
      pushMax: PROFILE.push,
      core: 'wheel',
    },
    warmupPrefs: {
      fatigue: 'normal',
      pain: false,
      lowImpact: false,
      mergeWalk: false,
      equipment: {bar: true, band: true, wheel: true},
    },
    selectedDay: 0,
    currentWorkoutIndex: 0,
    completedInCycle: 0,
    exerciseProgress: {},
    logs: [],
    ready: [],
    active: null,
    sound: true,
    keepScreen: true,
    installDismissed: false,
    wod: null,
    googleDriveUrl: '',
    googleDriveSecret: '',
    googleDriveAutoSync: true,
    lastSyncedAt: 0,
    pendingSyncIds: [],
  };
}

const numberOK = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

const textOK = (s: unknown, max = 5000): s is string => typeof s === 'string' && s.length <= max;

const optNum = (n: unknown, min: number, max: number) =>
  n === null || n === undefined || numberOK(n, min, max);

export function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function validComplex(p: unknown): p is ComplexSpec {
  const c = p as ComplexSpec;
  return (
    !!c &&
    Number.isInteger(c.rounds) &&
    numberOK(c.rounds, 1, 5) &&
    Array.isArray(c.reps) &&
    c.reps.length === 4 &&
    c.reps.every((n) => Number.isInteger(n) && numberOK(n, 1, 100)) &&
    numberOK(c.cap, 1, 1440)
  );
}

export function validPullPlan(p: unknown): p is PullPlan {
  const pp = p as PullPlan;
  return (
    !!pp &&
    Array.isArray(pp.targets) &&
    pp.targets.length >= 1 &&
    pp.targets.length <= 6 &&
    pp.targets.every((n) => Number.isInteger(n) && n >= 1 && n <= 50) &&
    ['band', 'none', 'foundation'].includes(pp.mode) &&
    Number.isInteger(pp.level) &&
    pp.level >= 0 &&
    pp.level <= 4
  );
}

export function validEntry(e: unknown): e is WorkoutEntry {
  const x = e as WorkoutEntry;
  return (
    !!x &&
    textOK(x.name, 160) &&
    [
      'rest',
      'warm',
      'cool',
      'prep',
      'timed',
      'hold',
      'reps',
      'test',
      'complex',
      'repeat',
      'skip',
      'skipped',
      'interval',
      'instruction',
    ].includes(x.kind) &&
    Number.isInteger(x.cursor) &&
    numberOK(x.cursor, 0, 499) &&
    optNum(x.reps, 0, 200) &&
    optNum(x.seconds, 0, 100000000) &&
    optNum(x.eccentricSeconds, 0, 20) &&
    (!x.assistance ||
      ['band', 'none', 'negative', 'band-hold', 'band-partial'].includes(x.assistance)) &&
    numberOK(x.at, 0, 9999999999999) &&
    typeof x.completed === 'boolean'
  );
}

export function validLog(l: unknown): l is WorkoutLog {
  const x = l as WorkoutLog;
  return (
    !!x &&
    (!x.pullPlan || validPullPlan(x.pullPlan)) &&
    textOK(x.id, 150) &&
    /^[a-zA-Z0-9_-]{1,150}$/.test(x.id) &&
    validDate(x.date) &&
    Number.isInteger(x.week) &&
    numberOK(x.week, 1, 8) &&
    Number.isInteger(x.day) &&
    numberOK(x.day, 0, 6) &&
    numberOK(x.minutes, 0, 100000) &&
    numberOK(x.rounds, 0, 5) &&
    textOK(x.actual, 50000) &&
    textOK(x.notes) &&
    textOK(x.band, 160) &&
    optNum(x.rpe, 1, 10) &&
    optNum(x.pain, 0, 10) &&
    optNum(x.sleep, 0, 24) &&
    optNum(x.push, 0, 200) &&
    optNum(x.pull, 0, 200) &&
    optNum(x.assisted, 0, 200) &&
    optNum(x.pullReserve, 0, 2) &&
    typeof x.completed === 'boolean' &&
    typeof x.standard === 'boolean' &&
    (!x.laps || (Array.isArray(x.laps) && x.laps.length <= 5 && x.laps.every((n) => numberOK(n, 0, 1440000)))) &&
    (!x.entries || (Array.isArray(x.entries) && x.entries.length <= 500 && x.entries.every(validEntry))) &&
    (!x.plannedComplex || validComplex(x.plannedComplex)) &&
    (!x.pullEntries || (Array.isArray(x.pullEntries) && x.pullEntries.every(validEntry))) &&
    (!x.title || textOK(x.title, 160)) &&
    (!x.cycleId || textOK(x.cycleId, 80)) &&
    (!x.plannedDate || validDate(x.plannedDate)) &&
    (!x.wellbeing || ['good', 'normal', 'hard'].includes(x.wellbeing))
  );
}

export function validWorkout(a: unknown): a is WorkoutSession {
  const x = a as WorkoutSession;
  return (
    !!x &&
    (!x.pullPlan || validPullPlan(x.pullPlan)) &&
    (!x.countdownCue ||
      (textOK(x.countdownCue.key, 40) &&
        Number.isInteger(x.countdownCue.last) &&
        numberOK(x.countdownCue.last, 1, 3))) &&
    textOK(x.id, 150) &&
    validDate(x.date) &&
    Number.isInteger(x.week) &&
    numberOK(x.week, 1, 8) &&
    Number.isInteger(x.day) &&
    numberOK(x.day, 0, 6) &&
    [3, 4].includes(x.frequency) &&
    textOK(x.band, 160) &&
    (!x.title || textOK(x.title, 160)) &&
    (!x.cycleId || textOK(x.cycleId, 80)) &&
    (!x.plannedDate || validDate(x.plannedDate)) &&
    numberOK(x.started, 0, Date.now() + 60000) &&
    optNum(x.ended, 0, 9999999999999) &&
    Array.isArray(x.steps) &&
    x.steps.length > 0 &&
    x.steps.length <= 500 &&
    x.steps.every(
      (s) =>
        !!s &&
        ['reps', 'test', 'hold', 'timed', 'interval', 'complex', 'warm', 'cool', 'prep', 'instruction'].includes(
          s.kind,
        ) &&
        textOK(s.name, 160) &&
        textOK(s.note) &&
        (!s.technique ||
          (Array.isArray(s.technique) &&
            s.technique.length <= 10 &&
            s.technique.every((t) => textOK(t, 2000)))) &&
        (!s.exerciseId || textOK(s.exerciseId, 80)) &&
        numberOK(s.target, 0, 10000) &&
        numberOK(s.rest, 0, 10000) &&
        (!s.section || textOK(s.section, 80)) &&
        (!s.miniTimer ||
          (textOK(s.groupTitle, 80) &&
            Number.isInteger(s.miniIndex) &&
            Number.isInteger(s.miniCount) &&
            numberOK(s.miniIndex, 1, 50) &&
            numberOK(s.miniCount, s.miniIndex!, 50) &&
            numberOK(s.groupSeconds, 1, 10000))) &&
        (s.kind !== 'complex' ||
          (Array.isArray(s.reps) &&
            s.reps.length === 4 &&
            s.reps.every((n) => numberOK(n, 1, 100)) &&
            numberOK(s.rounds, 1, 5))),
    ) &&
    Array.isArray(x.entries) &&
    x.entries.length <= 500 &&
    x.entries.every(validEntry) &&
    Number.isInteger(x.cursor) &&
    numberOK(x.cursor, 0, x.steps.length) &&
    ['exercise', 'rest', 'summary', 'complex-end'].includes(x.phase) &&
    ['active', 'paused', 'complete', 'interrupted'].includes(x.status) &&
    (x.phase === 'summary' ? x.cursor <= x.steps.length : x.cursor < x.steps.length) &&
    (x.phase !== 'rest' || (x.steps[x.cursor]?.rest || 0) > 0) &&
    optNum(x.stageStarted, 0, 9999999999999) &&
    optNum(x.restStarted, 0, 9999999999999) &&
    optNum(x.restUntil, 0, 9999999999999) &&
    optNum(x.complexStarted, 0, 9999999999999) &&
    optNum(x.complexEnded, 0, 9999999999999) &&
    optNum(x.pausedAt, 0, 9999999999999) &&
    numberOK(x.pausedMs, 0, 9999999999999) &&
    Number.isInteger(x.complexIndex) &&
    numberOK(x.complexIndex, 0, 20) &&
    Array.isArray(x.laps) &&
    x.laps.length <= 5 &&
    x.laps.every((n) => numberOK(n, 0, 1440000)) &&
    optNum(x.complexRepProgress, 0, 100) &&
    optNum(x.eccentricOverride, 0, 20) &&
    (!x.assistanceOverride ||
      ['band', 'none', 'negative', 'band-hold', 'band-partial'].includes(x.assistanceOverride))
  );
}

export function validState(s: unknown): s is ForgeState {
  const x = s as ForgeState;
  return (
    !!x &&
    (!x.warmupPrefs ||
      (['normal', 'high'].includes(x.warmupPrefs.fatigue) &&
        typeof x.warmupPrefs.pain === 'boolean' &&
        typeof x.warmupPrefs.lowImpact === 'boolean' &&
        !!x.warmupPrefs.equipment &&
        ['bar', 'band', 'wheel'].every(
          (k) => typeof x.warmupPrefs.equipment[k as keyof typeof x.warmupPrefs.equipment] === 'boolean',
        ))) &&
    (!x.coach ||
      ((x.coach.assistedMax === undefined ||
        (Number.isInteger(x.coach.assistedMax) && numberOK(x.coach.assistedMax, 0, 50))) &&
        optNum(x.coach.assistedROM, 0, 100) &&
        optNum(x.coach.assistedAt, 0, 9999999999999) &&
        optNum(x.coach.strictMax, 0, 50) &&
        optNum(x.coach.pushMax, 0, 200) &&
        ['wheel', 'deadbug', undefined].includes(x.coach.core))) &&
    (x.keepScreen === undefined || typeof x.keepScreen === 'boolean') &&
    (x.readyCycle === undefined || textOK(x.readyCycle, 80)) &&
    [3, 4].includes(x.frequency) &&
    Number.isInteger(x.week) &&
    numberOK(x.week, 1, 8) &&
    validDate(x.start) &&
    textOK(x.band, 160) &&
    Number.isInteger(x.selectedDay) &&
    numberOK(x.selectedDay, 0, 6) &&
    Array.isArray(x.logs) &&
    x.logs.length <= 3000 &&
    x.logs.every(validLog) &&
    Array.isArray(x.ready) &&
    x.ready.every((n) => Number.isInteger(n) && numberOK(n, 0, 7)) &&
    (!x.active || validWorkout(x.active)) &&
    (x.googleDriveUrl === undefined || textOK(x.googleDriveUrl, 1000)) &&
    (x.googleDriveSecret === undefined || textOK(x.googleDriveSecret, 200)) &&
    (x.googleDriveAutoSync === undefined || typeof x.googleDriveAutoSync === 'boolean') &&
    (x.lastSyncedAt === undefined || optNum(x.lastSyncedAt, 0, 9999999999999)) &&
    (x.pendingSyncIds === undefined ||
      (Array.isArray(x.pendingSyncIds) &&
        x.pendingSyncIds.length <= 500 &&
        x.pendingSyncIds.every((id) => textOK(id, 150))))
  );
}

export function recoverState(candidate: unknown): ForgeState | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const c = candidate as Partial<ForgeState>;
  const next = baseState();
  if (typeof c.week === 'number' && Number.isInteger(c.week) && c.week >= 1 && c.week <= 8) {
    next.week = c.week;
  }
  if (c.frequency === 3 || c.frequency === 4) next.frequency = c.frequency;
  if (validDate(c.start)) next.start = c.start;
  if (textOK(c.band, 160)) next.band = c.band;
  const parsedBand = parseBandMeta(next.band);
  next.bandResist = textOK(c.bandResist, 40) ? c.bandResist : parsedBand.bandResist;
  next.bandAttach = textOK(c.bandAttach, 40) ? c.bandAttach : parsedBand.bandAttach;
  if (typeof c.selectedDay === 'number' && Number.isInteger(c.selectedDay) && c.selectedDay >= 0 && c.selectedDay <= 6) {
    next.selectedDay = c.selectedDay;
  }
  if (typeof c.sound === 'boolean') next.sound = c.sound;
  if (typeof c.keepScreen === 'boolean') next.keepScreen = c.keepScreen;
  if (typeof c.installDismissed === 'boolean') next.installDismissed = c.installDismissed;
  if (typeof c.currentWorkoutIndex === 'number' && Number.isInteger(c.currentWorkoutIndex)) {
    next.currentWorkoutIndex = Math.max(0, Math.min(3, c.currentWorkoutIndex));
  }
  if (typeof c.completedInCycle === 'number' && Number.isInteger(c.completedInCycle)) {
    next.completedInCycle = Math.max(0, Math.min(4, c.completedInCycle));
  }
  if (c.coach && typeof c.coach === 'object') next.coach = {...next.coach, ...c.coach};
  if (c.warmupPrefs && typeof c.warmupPrefs === 'object') {
    next.warmupPrefs = {
      ...next.warmupPrefs,
      ...c.warmupPrefs,
      equipment: {...next.warmupPrefs.equipment, ...c.warmupPrefs.equipment},
    };
  }
  if (c.exerciseProgress && typeof c.exerciseProgress === 'object') {
    next.exerciseProgress = c.exerciseProgress;
  }
  if (Array.isArray(c.ready)) {
    next.ready = c.ready.filter((n) => Number.isInteger(n) && n >= 0 && n <= 7);
  }
  if (Array.isArray(c.logs)) {
    next.logs = c.logs.filter(validLog).slice(0, 3000);
  }
  if (textOK(c.googleDriveUrl, 1000)) next.googleDriveUrl = c.googleDriveUrl;
  if (textOK(c.googleDriveSecret, 200)) next.googleDriveSecret = c.googleDriveSecret;
  if (typeof c.googleDriveAutoSync === 'boolean') next.googleDriveAutoSync = c.googleDriveAutoSync;
  if (typeof c.lastSyncedAt === 'number') next.lastSyncedAt = c.lastSyncedAt;
  if (Array.isArray(c.pendingSyncIds)) {
    next.pendingSyncIds = c.pendingSyncIds.filter((id) => textOK(id, 150)).slice(0, 500);
  }
  next.active = validWorkout(c.active) ? c.active : null;
  return validState(next) ? next : null;
}

export function applyCoachCopyEdits(state: ForgeState): void {
  if (!state.active) return;
  for (const step of state.active.steps) {
    step.name = COACH_COPY_EDITS[step.name] ?? step.name;
    step.note = COACH_COPY_EDITS[step.note] ?? step.note;
    if (step.technique) {
      step.technique = step.technique.map((t) => COACH_COPY_EDITS[t] ?? t);
    }
  }
}

export function readLogShards(storage: Pick<Storage, 'getItem'>): WorkoutLog[] | null {
  try {
    const raw = storage.getItem(LOG_INDEX_KEY);
    if (!raw) return null;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return null;
    return ids
      .map((id) => {
        try {
          const item = storage.getItem('forge8.log.' + id);
          return item ? JSON.parse(item) : null;
        } catch {
          return null;
        }
      })
      .filter(validLog);
  } catch {
    return null;
  }
}

export function persistLogShards(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  logs: WorkoutLog[],
  dirtyIds: Set<string>,
  structureDirty: boolean,
): boolean {
  try {
    const oldRaw = storage.getItem(LOG_INDEX_KEY);
    const old = oldRaw ? JSON.parse(oldRaw) : [];
    const ids: string[] = [];
    for (const log of logs) {
      const id = String(log.id);
      if (!/^[a-zA-Z0-9_-]{1,150}$/.test(id)) throw Error('invalid log id');
      ids.push(id);
      if (structureDirty || dirtyIds.has(id)) {
        storage.setItem('forge8.log.' + id, JSON.stringify(log));
      }
    }
    if (structureDirty || !Array.isArray(old)) {
      storage.setItem(LOG_INDEX_KEY, JSON.stringify(ids));
    }
    if (structureDirty && Array.isArray(old)) {
      for (const id of old) {
        if (!ids.includes(id)) storage.removeItem('forge8.log.' + id);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function loadState(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): {state: ForgeState; recoveryRaw: string | null; recoveryNotice: string} {
  let state = baseState();
  let recoveryRaw: string | null = null;
  let recoveryNotice = '';

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      let current: unknown = null;
      try {
        current = JSON.parse(raw);
      } catch {
        current = null;
      }

      if (validState(current)) {
        state = {...state, ...current};
        const shards = readLogShards(storage);
        if (shards) {
          state.logs = shards;
        }
      } else {
        const recovered = recoverState(current);
        recoveryRaw = raw;
        try {
          storage.setItem(RECOVERY_KEY, raw);
        } catch {
          // ignore quota error on backup
        }
        if (recovered) {
          state = recovered;
          recoveryNotice =
            'Частину пошкодженого стану пропущено. Спочатку експортуй збережену копію.';
        } else {
          recoveryNotice =
            'Пошкоджені дані збережено як резервну копію; експортуй її перед новими змінами.';
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  if (!Number.isInteger(state.coach?.assistedMax)) {
    state.coach = {
      ...state.coach,
      strictMax: 0,
      strictAt: Date.now(),
      assistedMax: 0,
      assistedROM: 60,
      assistedAt: Date.now(),
    };
  }
  if (!state.band) state.band = PROFILE.band;
  if (!state.bandResist || !state.bandAttach) {
    const parsedBand = parseBandMeta(state.band);
    if (!state.bandResist) state.bandResist = parsedBand.bandResist;
    if (!state.bandAttach) state.bandAttach = parsedBand.bandAttach;
  }
  applyCoachCopyEdits(state);

  return {state, recoveryRaw, recoveryNotice};
}

export function saveState(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  state: ForgeState,
  dirtyIds: Set<string>,
  structureDirty: boolean,
): boolean {
  try {
    const shardsOk =
      !dirtyIds.size && !structureDirty
        ? true
        : persistLogShards(storage, state.logs, dirtyIds, structureDirty);
    const shell = {...state, logs: []};
    const shellStr = JSON.stringify(shell);
    if (shellStr.length > 3500000) return false;
    storage.setItem(STORAGE_KEY, shellStr);
    return shardsOk;
  } catch {
    return false;
  }
}

export function encodeBackupCode(state: ForgeState): string {
  const payload = JSON.stringify({format: 'forge8', version: 2, data: state});
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBackupCode(code: string): ForgeState {
  const trimmed = code.trim();
  const binary = atob(trimmed);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const text = new TextDecoder().decode(bytes);
  return parseImportPayload(text);
}

export function parseImportPayload(rawText: string): ForgeState {
  const parsed = JSON.parse(rawText);
  const wrapped = parsed?.format === 'forge8';
  const json = wrapped
    ? parsed
    : {format: 'forge8', version: 2, data: recoverState(parsed)};

  if (json.format !== 'forge8' || ![1, 2].includes(json.version) || !json.data) {
    throw new Error('invalid-format');
  }

  const incoming: ForgeState = wrapped
    ? {...baseState(), ...json.data}
    : (json.data as ForgeState);

  if (wrapped && json.version === 1) {
    incoming.active = null;
    incoming.logs = (incoming.logs || []).map((l) => ({...l, source: 'manual'}));
  }

  if (!validState(incoming)) {
    throw new Error('invalid-state');
  }

  const totalLogBytes = incoming.logs.reduce((n, l) => n + JSON.stringify(l).length, 0);
  if (totalLogBytes > 2300000) {
    throw new Error('backup-size');
  }

  incoming.version = 2;
  return incoming;
}

export function planMarkdown(state: ForgeState): string {
  let t =
    '# FORGE / 8 — мобільний тренер\n\nПрофіль: чоловік, 31 рік, 82 кг, 183 см.\nЦіль: 5 × (10 / 10 / 5 / 10) за ≤22 хв, 10 строгих підтягувань.\n\n';
  for (let i = 0; i < WEEKS.length; i++) {
    t += `## Рівень ${i + 1} — ${WEEKS[i].name} (${WEEKS[i].tag})\n`;
    t += `Підтягування орієнтовно: ${PULL_REFERENCE[i]} · Комплекс Б: ${COMBO_TABLE[i][1][0]} раундів\n\n`;
    for (const d of [0, 2, 4, 6]) {
      const s = buildSessionPlan(i + 1, d, state, dateISO());
      t += `### ${DAYS[d]} / ${s.title}\n`;
      for (const r of s.rows) {
        t += `- **${r.name}**: ${r.sets} (відпочинок ${r.rest}) — ${r.note}\n`;
      }
      t += '\n';
    }
  }
  t += '## Методичні правила\n';
  for (const g of GUIDE) {
    t += `### ${g.title}\n${g.text}\n\n`;
  }
  return t;
}
