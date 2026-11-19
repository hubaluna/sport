export type StepKind =
  | 'reps'
  | 'test'
  | 'hold'
  | 'timed'
  | 'interval'
  | 'complex'
  | 'warm'
  | 'cool'
  | 'prep'
  | 'instruction';

export type EntryKind = StepKind | 'rest' | 'repeat' | 'skip' | 'skipped';

export type AssistanceType = 'band' | 'none' | 'negative' | 'band-hold' | 'band-partial';

export type Wellbeing = 'good' | 'normal' | 'hard';

export type TabRoute = 'home' | 'plan' | 'train' | 'diary' | 'guide' | 'profile' | 'fullplan' | 'wod';

export interface EquipmentPrefs {
  bar: boolean;
  band: boolean;
  wheel: boolean;
}

export interface WarmupPrefs {
  fatigue: 'normal' | 'high';
  pain: boolean;
  lowImpact: boolean;
  mergeWalk: boolean;
  equipment: EquipmentPrefs;
}

export interface CoachState {
  strictMax: number;
  strictAt?: number;
  assistedMax: number;
  assistedROM: number;
  assistedAt?: number;
  pushMax?: number;
  pushAt?: number;
  core?: 'wheel' | 'deadbug';
}

export interface PullPlan {
  targets: number[];
  mode: 'foundation' | 'band' | 'none';
  level: number;
  max: number;
  reason: string;
  suggest: boolean;
  strictSingles: number;
  foundationMixed?: boolean;
}

export interface ComplexSpec {
  rounds: number;
  reps: [number, number, number, number];
  cap: number;
  rpe?: number;
  reason?: string;
}

export interface WarmupPart {
  key: string;
  name: string;
  seconds: number;
  manual: boolean;
  dose?: string;
  why?: string;
  note: string;
  tags?: string[];
  joints?: string[];
  muscles?: string[];
  pattern?: string;
  difficulty?: number;
  equipment?: string[];
}

export interface WarmupPlan {
  name: string;
  seconds: number;
  parts: WarmupPart[];
  features?: Record<string, unknown>;
  testing?: boolean;
  blocked?: boolean;
  missing?: boolean;
  reason: string;
}

export interface CooldownPlan {
  name: string;
  seconds: number;
  parts: WarmupPart[];
  features?: Record<string, unknown>;
  reason: string;
}

export interface SessionRow {
  name: string;
  sets: string;
  rest: string;
  note: string;
  section: string | null;
  exerciseId?: string;
  kind?: StepKind;
  seconds?: number;
  secondsMax?: number;
  parts?: WarmupPart[];
  dynamicWarmup?: boolean;
  dynamicCooldown?: boolean;
  combo?: ComplexSpec;
  technique?: string[];
  setsCount?: number;
  reps?: number;
  repsMax?: number;
  restSeconds?: number;
  perSide?: boolean;
  optional?: boolean;
  assistance?: AssistanceType;
  bucket?: string;
  mainPull?: boolean;
  foundation?: boolean;
  setNumber?: number;
  totalSets?: number;
  restAfter?: boolean;
  testKey?: 'push' | 'pull' | 'assisted';
  testMax?: number;
}

export interface SessionPlan {
  type: 'rest' | 'cardio' | 'strength' | 'complex' | 'test' | 'return';
  title: string;
  minutes: string;
  rows: SessionRow[];
  pullLevel?: number;
  pullPlan?: PullPlan | null;
  warmup?: WarmupPlan | null;
  cooldown?: CooldownPlan | null;
  returnWorkout?: boolean;
  isReturnWorkout?: boolean;
  returnInfo?: {gap: number; remaining: number} | null;
}

export interface WorkoutStep {
  kind: StepKind;
  name: string;
  note: string;
  target: number;
  targetMax?: number | null;
  set?: number;
  sets?: number;
  restSeconds?: number;
  rest: number;
  perSide?: boolean;
  optional?: boolean;
  assistance?: AssistanceType | null;
  bucket?: string | null;
  section?: string | null;
  mainPull?: boolean;
  foundation?: boolean;
  exerciseId?: string | null;
  testKey?: 'push' | 'pull' | 'assisted' | null;
  testMax?: number;
  miniTimer?: boolean;
  manual?: boolean;
  dose?: string;
  why?: string;
  groupTitle?: string;
  miniIndex?: number;
  miniCount?: number;
  groupSeconds?: number;
  warmupGate?: boolean;
  rounds?: number;
  reps?: [number, number, number, number];
  technique?: string[];
  adaptationBadge?: string;
}

export interface WorkoutEntry {
  cursor: number;
  name: string;
  kind: EntryKind;
  set: number;
  reps: number | null;
  seconds: number | null;
  target: number;
  mainPull?: boolean;
  at: number;
  modified: boolean;
  completed: boolean;
  testKey?: 'push' | 'pull' | 'assisted' | null;
  perSide?: boolean;
  optional?: boolean;
  assistance?: AssistanceType | null;
  eccentricSeconds?: number | null;
  quality?: 'full' | 'partial' | 'incomplete';
  partial?: boolean;
  series?: boolean;
  autoTimed?: boolean;
}

export interface WorkoutSession {
  id: string;
  week: number;
  day: number;
  frequency: 3 | 4;
  band: string;
  date: string;
  cycleId?: string;
  plannedDate?: string;
  returnWorkout?: boolean;
  isReturnWorkout?: boolean;
  returnInfo?: {gap: number; remaining: number} | null;
  warmup?: WarmupPlan | null;
  cooldown?: CooldownPlan | null;
  pullPlan?: PullPlan | null;
  title: string;
  programRevision: string;
  complexRepProgress: number;
  assistanceOverride: AssistanceType | null;
  eccentricOverride: number | null;
  started: number;
  ended: number | null;
  steps: WorkoutStep[];
  cursor: number;
  entries: WorkoutEntry[];
  stageStarted: number | null;
  restUntil: number | null;
  restStarted: number | null;
  restSignaled?: boolean;
  blockSignaled?: boolean;
  warmupRestUntil?: number | null;
  warmupRestSignaled?: boolean;
  countdownCue?: {key: string; last: number} | null;
  phase: 'exercise' | 'rest' | 'summary' | 'complex-end';
  complexStarted: number | null;
  complexEnded: number | null;
  complexIndex: number;
  laps: number[];
  complexStandard: boolean;
  repOverride: number | null;
  modified: boolean;
  status: 'active' | 'paused' | 'complete' | 'interrupted';
  pausedAt: number | null;
  pausedMs: number;
  preparationCorrected?: boolean;
  cooldownPrepared?: boolean;
  recordsBroken?: string[];
}

export interface WorkoutLog {
  id: string;
  type?: string;
  week: number;
  day: number;
  date: string;
  title?: string;
  programRevision?: string;
  cycleId?: string;
  plannedDate?: string;
  returnWorkout?: boolean;
  isReturnWorkout?: boolean;
  pullPlan?: PullPlan | null;
  pullQuality?: boolean;
  plannedComplex?: ComplexSpec | null;
  pullEntries?: WorkoutEntry[];
  goalMet?: boolean;
  complexTotalReps?: number;
  source?: 'auto' | 'manual';
  status?: 'active' | 'paused' | 'complete' | 'interrupted';
  started: number;
  ended: number | null;
  minutes: number;
  complexSeconds: number | null;
  rounds: number;
  laps?: number[];
  splits?: number[];
  actual: string;
  entries?: WorkoutEntry[];
  band: string;
  standard: boolean;
  completed: boolean;
  notes: string;
  rpe: number | null;
  pain: number | null;
  sleep?: number | null;
  wellbeing?: Wellbeing | null;
  pullReserve?: number | null;
  push?: number | null;
  pull?: number | null;
  assisted?: number | null;
  progressChanges?: string[];
}

export interface ExerciseProgressEntry {
  targetReps: number;
  name: string;
  lastUpdated: string;
}

export interface WodState {
  running: boolean;
  started: number | null;
  elapsed: number;
  round: number;
  splits: number[];
  done: boolean;
}

export interface ForgeState {
  version: number;
  programRevision: string;
  week: number;
  frequency: 3 | 4;
  start: string;
  band: string;
  bandResist?: string;
  bandAttach?: string;
  coach: CoachState;
  warmupPrefs: WarmupPrefs;
  selectedDay: number;
  currentWorkoutIndex: number;
  completedInCycle: number;
  exerciseProgress: Record<string, ExerciseProgressEntry>;
  logs: WorkoutLog[];
  ready: number[];
  readyCycle?: string;
  active: WorkoutSession | null;
  sound: boolean;
  keepScreen: boolean;
  installDismissed: boolean;
  calendarSeen?: string;
  calendarRevision?: number;
  wod: WodState | null;
}

export interface ExerciseHelp {
  name: string;
  category: string;
  muscles?: string;
  why: string;
  setup: string;
  steps: string[];
  tempo?: string;
  mistakes: string[];
  easier: string;
  video?: {
    url: string;
    title: string;
    credit?: string;
    note?: string;
    source?: string;
  };
  query: string;
}

export interface PrepLibraryItem {
  name: string;
  tags: string[];
  joints: string[];
  muscles: string[];
  pattern: 'locomotion' | 'mobility' | 'activation' | 'specific';
  difficulty: number;
  equipment: ('bar' | 'band' | 'wheel')[];
  reps?: boolean;
  why: string;
  tech: string;
}

export interface CoolLibraryItem {
  name: string;
  seconds: number;
  why: string;
  tech: string;
  query: string;
}
