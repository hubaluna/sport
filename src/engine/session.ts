import {MOVES, PROFILE, PROGRAM_REVISION, TECHNIQUE} from '../data/program';
import type {
  ForgeState,
  SessionPlan,
  SessionRow,
  WorkoutSession,
  WorkoutStep,
} from '../types/forge';
import {dateISO} from './calendar';
import {comboFor, getGlobalExerciseTarget, pullPlan} from './progression';
import {buildWarmup} from './warmup';

export function exerciseSection(name: string): string | null {
  if (/підтягування|вис|тяга резинки/i.test(name)) return 'Тяга · спина й руки';
  if (/повільні віджимання/i.test(name)) return 'Жим · окрема сила';
  if (/випади|сідничний міст|присідання/i.test(name)) return 'Ноги · таз';
  if (/колесо|мертвий жук|передпліччях|планка/i.test(name)) return 'Кор · окремий блок';
  if (/комплекс:|^[1-4]\./i.test(name)) return 'CrossFit · силова витривалість';
  return null;
}

export function makeRow(
  name: string,
  sets: string,
  rest: string,
  note = '',
  meta: Partial<SessionRow> = {},
): SessionRow {
  const exerciseId = /тяга резинки сидячи/i.test(name)
    ? 'band-row-seated'
    : /підтягування/i.test(name)
      ? 'pull-up'
      : /віджимання/i.test(name)
        ? 'push-up'
        : /присід|випад/i.test(name)
          ? 'lower-body'
          : /колесо|жук|прес/i.test(name)
            ? 'core'
            : /комплекс/i.test(name)
              ? 'conditioning'
              : undefined;

  return {
    name,
    sets,
    rest,
    note,
    section: exerciseSection(name),
    exerciseId,
    ...meta,
  };
}

export function buildReturnWorkoutSession(state: ForgeState): SessionPlan {
  const warmParts = [
    {
      key: 'shoulders',
      name: 'Колові рухи плечима',
      seconds: 60,
      manual: false,
      note: 'Вперед і назад, вільне дихання.',
    },
    {
      key: 'spine',
      name: 'Повороти корпусу й нахили',
      seconds: 60,
      manual: false,
      note: 'М’яка амплітуда без ривків.',
    },
    {
      key: 'hips',
      name: 'Обертання тазом і колінами',
      seconds: 60,
      manual: false,
      note: 'Плавно, розігрів суглобів ніг.',
    },
    {
      key: 'wrists',
      name: 'Розігрів кистей та ліктів',
      seconds: 60,
      manual: false,
      note: 'Підготовка до упору на підлозі.',
    },
  ];
  const warm = makeRow(
    'Суглобова розминка',
    '4 хв',
    '—',
    'Спокійні обертання суглобів, вільне дихання, без втоми.',
    {
      kind: 'warm',
      seconds: 240,
      parts: warmParts,
      dynamicWarmup: true,
    },
  );
  const pushMax = state.coach?.pushMax ?? PROFILE.push;
  const pushReps = Math.max(4, Math.round(pushMax * 0.5));
  const basePullNorm = getGlobalExerciseTarget(
    'Тяга резинки зверху до грудей',
    10,
    state.exerciseProgress,
  );
  const pullReps = Math.max(5, Math.round(basePullNorm * 0.55));
  const bandLabel = state.band || PROFILE.band;
  const isDeadbug = state.coach?.core === 'deadbug';

  const rows: SessionRow[] = [
    warm,
    makeRow(
      'Легка тяга резинки до грудей',
      `2 × ${pullReps}`,
      '65 с',
      `Обрана резинка (${bandLabel}), ~55% робочої норми. Плавно тягни лікті до боків, запас 3+ повторення.`,
      {kind: 'reps', setsCount: 2, reps: pullReps, restSeconds: 65},
    ),
    makeRow(
      'Віджимання від підлоги (втягувальні)',
      `2 × ${pushReps}`,
      '75 с',
      `50% від твого максимуму (${pushMax}). Запас 2–3+ повторення, без відмови та повільних фаз.`,
      {kind: 'reps', setsCount: 2, reps: pushReps, restSeconds: 75},
    ),
    makeRow(
      'Сідничний міст або зворотні випади',
      '2 × 9',
      '60 с',
      'Спокійний темп (8–10 повт.), стабільний таз і коліна, без стрибків.',
      {kind: 'reps', setsCount: 2, reps: 9, restSeconds: 60},
    ),
    isDeadbug
      ? makeRow(
          'Мертвий жук (втягувальний)',
          '2 × 5 на сторону',
          '60 с',
          '~60% стандартного обсягу кора, поперек щільно притиснутий до підлоги.',
          {kind: 'reps', setsCount: 2, reps: 5, restSeconds: 60, perSide: true},
        )
      : makeRow(
          'Колесо з колін (втягувальне)',
          '2 × 3',
          '60 с',
          '~50–60% стандартного обсягу в короткій комфортній амплітуді без прогину попереку.',
          {kind: 'reps', setsCount: 2, reps: 3, restSeconds: 60},
        ),
  ];

  return {
    type: 'return',
    isReturnWorkout: true,
    returnWorkout: true,
    title: 'Втягувальне (Full-Body)',
    minutes: '20–25',
    warmup: {
      name: 'Суглобова розминка',
      seconds: 240,
      parts: warmParts,
      reason: 'М’який розігрів суглобів (4 хв) перед втягувальним навантаженням 50–60%.',
    },
    cooldown: null,
    rows,
  };
}

export function buildSessionPlan(
  week: number,
  day: number,
  state: ForgeState,
  today = dateISO(),
): SessionPlan {
  const final = week === 8 && day === 4;
  const light = week === 4 || week === 8;
  const warm = makeRow(
    'Розминка',
    '10 хв',
    '—',
    'Підбирається за рухами цього заняття, доступним обладнанням і поточним самопочуттям.',
    {kind: 'warm', seconds: 600},
  );

  const reps = (
    name: string,
    sets: number,
    n: number,
    rest = 60,
    note = '',
    extra: Partial<SessionRow> = {},
  ) => {
    const effN = getGlobalExerciseTarget(name, n, state.exerciseProgress);
    const maxReps = extra.repsMax ? Math.max(effN, extra.repsMax) : undefined;
    return makeRow(
      name,
      `${sets} × ${effN}${maxReps ? '–' + maxReps : ''}${extra.perSide ? ' на ногу' : ''}`,
      `${rest} с`,
      note,
      {
        kind: 'reps',
        setsCount: sets,
        reps: effN,
        restSeconds: rest,
        ...extra,
        repsMax: maxReps,
      },
    );
  };

  const hold = (name: string, sets: number, seconds: number, note: string) =>
    makeRow(name, `${sets} × ${seconds} с`, '120 с', note, {
      kind: 'hold',
      setsCount: sets,
      seconds,
      restSeconds: 120,
      optional: true,
    });

  const rowBand = () =>
    reps(
      'Тяга резинки сидячи',
      2,
      10,
      60,
      'Перевір резинку, обведи середину навколо середньої частини обох стоп, а не носків. Сиди зі стабільною спиною, тягни до нижніх ребер. Резинка не має бути спрямована в обличчя.',
      {repsMax: 12},
    );

  if ([1, 3, 5].includes(day)) {
    return {
      type: 'rest',
      title: 'Відпочинок',
      minutes: '0–20',
      rows: [
        makeRow(
          'Легка прогулянка',
          '15 хв',
          '—',
          'За бажанням; якщо втомився, повністю відпочинь.',
          {kind: 'timed', seconds: 900, optional: true},
        ),
      ],
    };
  }

  let base: SessionPlan;

  if (day === 6) {
    base = {
      type: 'cardio',
      title: 'Г — активне відновлення',
      minutes: '25–40',
      rows: [
        makeRow(
          'Швидка ходьба',
          `${week < 4 ? 20 : 30} хв`,
          '—',
          'Темп розмови повними реченнями, RPE 2–3. Пропусти за втоми; без виснажливих комплексів.',
          {kind: 'timed', seconds: (week < 4 ? 20 : 30) * 60, optional: true},
        ),
        makeRow(
          'Мобільність',
          '5–10 хв',
          '—',
          'Легкі рухи плечима, повороти грудного відділу та кульшових суглобів. По 30 с м’якого розтягування на сторону.',
          {kind: 'timed', seconds: 300, optional: true},
        ),
        makeRow('Спокійне дихання', '2 хв', '—', 'Дихай спокійно, розслаб плечі.', {
          kind: 'timed',
          seconds: 120,
          optional: true,
        }),
      ],
    };
  } else {
    const rows: SessionRow[] = [warm];
    const plan = pullPlan(week, day, state, today);
    const foundation = plan.mode === 'foundation';

    const addPull = () => {
      if (foundation) {
        plan.targets.forEach((n, i) =>
          rows.push(
            reps(
              'Тяга резинки зверху до грудей',
              1,
              n,
              75,
              'Легкий натяг, плавно тягни лікті вниз до боків. Повертай руки вгору під контролем. Залишай 2–3 повторення в запасі; якщо 8 важкі, зменш натяг. Це підготовча тяга, не підтягування.',
              {
                mainPull: true,
                foundation: true,
                exerciseId: 'band-pulldown',
                setNumber: i + 1,
                totalSets: plan.targets.length,
                restAfter: true,
              },
            ),
          ),
        );
        if (!light) {
          rows.push(
            reps(
              'Часткове підтягування з резинкою',
              2,
              1,
              120,
              `Опційно: лише короткий, легкий і контрольований рух нижче доступної межі близько ${state.coach?.assistedROM ?? 60}%. Не намагайся щоразу дотягнутися максимально високо. Без розгойдування; плавно повернися вниз. Якщо рух важкий або неконтрольований — пропусти. Це не повне підтягування.`,
              {assistance: 'band-partial', foundation: true, optional: true},
            ),
          );
        }
        return;
      }

      if (plan.strictSingles) {
        rows.push(
          reps(
            'Одиночне строге підтягування',
            plan.strictSingles,
            1,
            180,
            'Лише якщо вже є чисте строге повторення. Без максимуму; за відсутності запасу пропусти.',
            {assistance: 'none', bucket: 'pull', optional: true},
          ),
        );
      }

      plan.targets.forEach((n, i) =>
        rows.push(
          reps(
            plan.mode === 'band' ? 'Підтягування з резинкою' : 'Строгі підтягування',
            1,
            n,
            150,
            `Підхід ${i + 1}/${plan.targets.length}. ${plan.reason} Повна амплітуда, без розгойдування.`,
            {
              assistance: plan.mode === 'band' ? 'band' : 'none',
              bucket: 'pull',
              mainPull: true,
              setNumber: i + 1,
              totalSets: plan.targets.length,
              restAfter: true,
              restSeconds: 150,
            },
          ),
        ),
      );
    };

    if (week === 8 && day === 0 && !foundation) {
      rows.push(
        makeRow(
          'Контрольний тест: підтягування без резинки',
          '1 × технічний максимум',
          '240 с',
          'Після розминки одна спроба строгих повторень. 0 — коректний результат. Без ривків, підборіддя над перекладиною. Після тесту — перехід до щоденника.',
          {
            kind: 'test',
            setsCount: 1,
            reps: 0,
            restSeconds: 240,
            testKey: 'pull',
            assistance: 'none',
          },
        ),
      );
      base = {
        type: 'test',
        title: 'А — тест строгих підтягувань',
        minutes: '20–30',
        rows,
        pullLevel: plan.level,
        pullPlan: null,
      };
    } else if (day === 0) {
      addPull();
      if (!foundation) {
        rows.push(
          reps(
            'Лопаткові підтягування',
            light ? 1 : 2,
            5,
            60,
            'Лікті прямі, плавний короткий рух лопатками; за потреби опора стоп.',
          ),
        );
      }
      if (!light && !foundation) {
        rows.push(
          reps(
            'Негативні підтягування',
            2,
            1,
            150,
            '1–2 повторення лише з контролем 3–5 с і безпечною опорою. За втрати контролю пропусти. Обсяг не збільшуй разом з основними підтягуваннями.',
            {repsMax: 2, assistance: 'negative', bucket: 'accessory', optional: true},
          ),
        );
      }
      rows.push(
        reps(
          'Віджимання від підлоги',
          light ? 2 : 3,
          6,
          90,
          'Повна амплітуда, запас 1–2. За потреби — від надійної високої опори, познач заміну.',
          {repsMax: 8},
        ),
        reps('Зворотні випади', light ? 1 : 2, 8, 60, 'Крок назад, коліно в напрямку носка.', {
          perSide: true,
        }),
      );
      if (state.coach?.core === 'deadbug') {
        rows.push(
          reps(
            'Мертвий жук',
            light ? 1 : 2,
            8,
            60,
            'Протилежні рука й нога; поперек стабільний.',
            {perSide: true},
          ),
        );
      } else {
        rows.push(
          reps(
            'Колесо з колін',
            light ? 1 : 2,
            4,
            75,
            '4–6 лише без прогину попереку. Скороти амплітуду або обери «Мертвий жук» у профілі: 2×8 на сторону.',
            {repsMax: 6},
          ),
        );
      }
      base = {
        type: 'strength',
        title: foundation ? 'А — підготовка до підтягувань' : 'А — сила підтягувань',
        minutes: '45–60',
        rows,
        pullLevel: plan.level,
        pullPlan: plan,
      };
    } else {
      if (day === 4 && !final) {
        addPull();
        if (!light && !foundation) {
          rows.push(
            hold(
              'Утримання верхньої позиції на перекладині',
              2,
              5,
              '5–10 с, безпечний вихід зі стійкої опори; підборіддя над перекладиною. За потреби допомога резинки. Не тримай до втрати хвата.',
            ),
          );
        }
        rows.push(
          rowBand(),
          reps('Присідання без стрибка', light ? 1 : 2, 12, 60, 'Контроль колін і стабільний корпус.'),
          reps('Зворотні випади', light ? 1 : 2, 8, 60, 'Рівномірно на обидві ноги.', {perSide: true}),
        );
      }
      rows.push(
        makeRow(
          'Відпрацювання техніки',
          '5 хв',
          '—',
          'По 2–3 легкі повторення кожної вправи; плавні переходи. Перед стартом віднови дихання.',
          {kind: 'prep', seconds: 300},
        ),
      );
      const combo = comboFor(week, day, state);
      rows.push(
        makeRow(
          'Комплекс: вправи 1–4',
          `${combo.rounds} × (${combo.reps.join(' / ')}) · ≤22 хв`,
          'Паузи входять у загальний час',
          (day === 4 && !final
            ? 'Легка практика, 70–80% свого максимального темпу, RPE 5–6. Без рекорду.'
            : 'Починай спокійно. Віджимання можна ділити 6+4 або 5+3+2; таймер триває. Позначай полегшення. На тижні 4 — легкий темп.') +
            (combo.reason || ''),
          {kind: 'complex', combo, technique: [...TECHNIQUE]},
        ),
      );
      combo.reps.forEach((n, i) =>
        rows.push(makeRow(`${i + 1}. ${MOVES[i]}`, `${n} у раунді`, 'Таймер триває', TECHNIQUE[i])),
      );
      if (day === 2 && week !== 8) {
        rows.push(
          rowBand(),
          reps(
            'Сідничний міст',
            light ? 1 : 2,
            12,
            45,
            'Напруж сідниці, піднімай таз без перерозгинання попереку.',
          ),
        );
      }
      base = {
        type: final ? 'test' : 'complex',
        title:
          day === 2
            ? week === 8
              ? 'Б — 2 легкі раунди'
              : 'Б — основний CrossFit-комплекс'
            : final
              ? 'В — фінальний комплекс'
              : 'В — силова витривалість',
        minutes: day === 2 ? '35–55' : '40–55',
        rows,
        pullLevel: plan.level,
        pullPlan: day === 4 && !final ? plan : null,
      };
    }
  }

  const latest = (state.logs || []).slice().sort((a, b) => b.started - a.started)[0];
  const recentFatigue =
    !!latest && Date.now() - latest.started < 172800000 && ((latest.rpe ?? 0) >= 9 || latest.wellbeing === 'hard');
  const profile = {
    ...(state.warmupPrefs || {}),
    fatigue: (state.warmupPrefs?.fatigue === 'high' || recentFatigue ? 'high' : 'normal') as
      | 'high'
      | 'normal',
  };

  const prepared = buildWarmup({
    week,
    day,
    rows: base.rows,
    profile,
    level: base.pullLevel ?? pullPlan(week, day, state, today).level,
    test: base.type === 'test',
  });

  const finalRows = [...base.rows];
  if (day === 6 && profile.mergeWalk) {
    prepared.parts = [
      {
        key: 'walk',
        name: 'Перші 5 хв легкої прогулянки',
        seconds: 300,
        manual: false,
        note: 'Почни спокійно, поступово прискорюй крок. Ці хвилини одночасно є розминкою та частиною прогулянки.',
      },
    ];
    prepared.seconds = 300;
    prepared.reason = 'Перші 5 хв включено у тривалість прогулянки; повторно їх не додаємо.';
    const original = finalRows.find((r) => r.name === 'Швидка ходьба');
    if (original) {
      const remSec = Math.max(0, (original.seconds || 1200) - 300);
      finalRows.splice(
        0,
        finalRows.length,
        {
          ...original,
          seconds: remSec,
          sets: `${Math.max(0, Math.round(remSec / 60))} хв після розминки`,
        },
      );
    }
  }

  return {
    ...base,
    warmup: prepared,
    cooldown: null,
    rows: [
      makeRow(prepared.name, `${Math.round(prepared.seconds / 60)} хв`, '—', prepared.reason, {
        kind: 'warm',
        seconds: prepared.seconds,
        parts: prepared.parts,
        dynamicWarmup: true,
      }),
      ...finalRows.filter((r) => r.kind !== 'warm' && r.kind !== 'cool'),
    ],
  };
}

export function applyStrengthRests(steps: WorkoutStep[], start = 0): boolean {
  let changed = false;
  for (let i = start; i < steps.length - 1; i++) {
    const step = steps[i];
    const next = steps[i + 1];
    if (step.rest > 0 || next.miniTimer || ['warm', 'cool', 'instruction'].includes(next.kind)) {
      continue;
    }
    let seconds = 0;
    if (['reps', 'hold'].includes(step.kind)) {
      seconds =
        step.restSeconds ||
        (/негативні/i.test(step.name)
          ? 150
          : step.assistance === 'band-partial'
            ? 120
            : step.assistance
              ? 150
              : /віджимання/i.test(step.name)
                ? 90
                : /колесо/i.test(step.name)
                  ? 75
                  : /сідничний міст/i.test(step.name)
                    ? 45
                    : step.kind === 'hold'
                      ? 120
                      : 60);
    } else if (step.kind === 'complex' && ['reps', 'hold', 'test'].includes(next.kind)) {
      seconds = 120;
    }
    if (seconds) {
      step.rest = seconds;
      changed = true;
    }
  }
  return changed;
}

export function workoutSteps(planned: SessionPlan): WorkoutStep[] {
  const out: WorkoutStep[] = [];
  for (const r of planned.rows) {
    if (/^\d\./.test(r.name)) continue;
    if ((r.kind === 'warm' || r.kind === 'cool') && r.parts?.length) {
      r.parts.forEach((part, index) => {
        out.push({
          kind: r.kind!,
          name: part.name,
          note: part.note,
          target: part.seconds,
          rest: 0,
          optional: !!r.optional,
          miniTimer: true,
          manual: !!part.manual,
          dose: part.dose || '',
          why: part.why || '',
          groupTitle: r.name,
          miniIndex: index + 1,
          miniCount: r.parts!.length,
          groupSeconds: r.seconds,
        });
      });
      if (r.dynamicWarmup) {
        out.push({
          kind: 'prep',
          name: 'Розминку завершено',
          note: 'Перевір дихання й готовність до основної частини.',
          target: 0,
          rest: 0,
          warmupGate: true,
        });
      }
      continue;
    }

    if (r.kind === 'complex' && r.combo) {
      out.push({
        kind: 'complex',
        name: 'Комплекс — вправи 1–4',
        note: r.note,
        rounds: r.combo.rounds,
        reps: [...r.combo.reps],
        target: r.combo.cap * 60,
        rest: 0,
        technique: [...(r.technique || TECHNIQUE)],
      });
      continue;
    }

    if (r.kind && ['warm', 'cool', 'prep', 'timed', 'interval'].includes(r.kind)) {
      out.push({
        kind: r.kind,
        name: r.name,
        note: r.note,
        target: r.seconds || 0,
        rest: 0,
        optional: !!r.optional,
      });
      continue;
    }

    if (r.kind === 'test') {
      out.push({
        kind: 'test',
        name: r.name,
        note: r.note,
        target: 0,
        set: 1,
        sets: 1,
        rest: r.restSeconds || 0,
        testKey: r.testKey,
        assistance: r.assistance,
        optional: !!r.optional,
        testMax: r.testMax,
      });
      continue;
    }

    if (r.kind === 'reps' || r.kind === 'hold') {
      const setsCount = r.setsCount || 1;
      for (let set = 1; set <= setsCount; set++) {
        out.push({
          kind: r.kind,
          name: r.name,
          note: r.note,
          target: r.kind === 'hold' ? r.seconds || 0 : r.reps || 0,
          targetMax: r.kind === 'hold' ? r.secondsMax : r.repsMax,
          set: r.setNumber ?? set,
          sets: r.totalSets ?? setsCount,
          restSeconds: r.restSeconds || 0,
          rest: set < setsCount || r.restAfter ? r.restSeconds || 0 : 0,
          perSide: !!r.perSide,
          optional: !!r.optional,
          assistance: r.assistance || null,
          bucket: r.bucket || null,
          section: r.section || null,
          mainPull: !!r.mainPull,
          foundation: !!r.foundation,
          exerciseId: r.exerciseId || null,
        });
      }
      continue;
    }

    out.push({
      kind: 'instruction',
      name: r.name,
      note: r.note,
      target: 0,
      rest: 0,
      optional: true,
    });
  }
  applyStrengthRests(out);
  return out;
}

export function makeWorkout(
  week: number,
  day: number,
  state: ForgeState,
  date = dateISO(),
  now = Date.now(),
  id = crypto.randomUUID(),
): WorkoutSession {
  const planned = buildSessionPlan(week, day, state, date);
  return {
    id,
    week,
    day,
    frequency: state.frequency,
    band: state.band || PROFILE.band,
    date,
    cycleId: 'forge8:' + state.start,
    returnWorkout: !!planned.returnWorkout,
    returnInfo: planned.returnInfo || null,
    warmup: planned.warmup || null,
    pullPlan: planned.pullPlan || null,
    title: planned.title,
    programRevision: PROGRAM_REVISION,
    complexRepProgress: 0,
    assistanceOverride: null,
    eccentricOverride: null,
    started: now,
    ended: null,
    steps: workoutSteps(planned),
    cursor: 0,
    entries: [],
    stageStarted: null,
    restUntil: null,
    restStarted: null,
    phase: 'exercise',
    complexStarted: null,
    complexEnded: null,
    complexIndex: 0,
    laps: [],
    complexStandard: true,
    repOverride: null,
    modified: false,
    status: 'active',
    pausedAt: null,
    pausedMs: 0,
  };
}

export function makeReturnWorkout(
  state: ForgeState,
  date = dateISO(),
  now = Date.now(),
  id = crypto.randomUUID(),
): WorkoutSession {
  const sess = buildReturnWorkoutSession(state);
  return {
    id,
    week: state.week,
    day: state.selectedDay,
    frequency: state.frequency,
    band: state.band || PROFILE.band,
    date,
    cycleId: 'forge8:' + state.start,
    isReturnWorkout: true,
    returnWorkout: true,
    warmup: sess.warmup || null,
    title: sess.title,
    programRevision: PROGRAM_REVISION,
    complexRepProgress: 0,
    assistanceOverride: null,
    eccentricOverride: null,
    started: now,
    ended: null,
    steps: workoutSteps(sess),
    cursor: 0,
    entries: [],
    stageStarted: null,
    restUntil: null,
    restStarted: null,
    phase: 'exercise',
    complexStarted: null,
    complexEnded: null,
    complexIndex: 0,
    laps: [],
    complexStandard: true,
    repOverride: null,
    modified: false,
    status: 'active',
    pausedAt: null,
    pausedMs: 0,
  };
}
