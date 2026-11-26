import {COOL_LIBRARY, PREP_LIBRARY} from '../data/exercises';
import type {
  CooldownPlan,
  SessionRow,
  WarmupPart,
  WarmupPlan,
  WarmupPrefs,
} from '../types/forge';

export interface WarmupFeatures {
  foundation: boolean;
  verticalBandPull: boolean;
  pull: boolean;
  horizontalPull: boolean;
  push: boolean;
  legs: boolean;
  bridge: boolean;
  core: boolean;
  wheel: boolean;
  jump: boolean;
  complex: boolean;
  test: boolean;
  bandPull: boolean;
  strictPull: boolean;
  intensity: number;
  [key: string]: unknown;
}

export function analyzeWarmupPlan(rows: SessionRow[]): WarmupFeatures {
  const actual = rows.filter((r) => !['warm', 'cool', 'prep'].includes(r.kind || ''));
  const names = actual.map((r) => r.name).join(' ').toLowerCase();
  const ids = new Set(actual.map((r) => r.exerciseId));
  const complex = actual.some((r) => r.kind === 'complex');

  return {
    foundation: actual.some((r) => r.foundation || r.assistance === 'band-partial'),
    verticalBandPull: ids.has('band-pulldown'),
    pull: ids.has('pull-up') || /підтяг|верхньої позиції|активний вис/.test(names),
    horizontalPull: ids.has('band-row-seated') || /тяга резинки сидяч|горизонтальн.*тяг/.test(names),
    push: complex || ids.has('push-up') || /віджим/.test(names),
    legs: complex || ids.has('lower-body') || /присід|присідан|випади|міст/.test(names),
    bridge: /міст/.test(names),
    core: complex || ids.has('core') || /колесо|жук|планк|прес/.test(names),
    wheel: /колесо/.test(names),
    jump: complex || /стриб/.test(names),
    complex,
    test: actual.some((r) => r.kind === 'test'),
    bandPull: actual.some((r) => r.assistance === 'band'),
    strictPull: actual.some((r) => r.assistance === 'none' && /підтяг/.test(r.name)),
    intensity: Math.max(0, ...actual.map((r) => r.combo?.rpe || 0)),
  };
}

export function buildWarmup({
  day,
  week,
  rows,
  profile = {},
  level = 0,
  test = false,
}: {
  day: number;
  week: number;
  rows: SessionRow[];
  profile?: Partial<WarmupPrefs>;
  level?: number;
  test?: boolean;
}): WarmupPlan {
  const f = analyzeWarmupPlan(rows);
  const testing = test || f.test;
  const light = week === 4 || profile.fatigue === 'high' || (f.intensity > 0 && f.intensity <= 5);
  const equipment = {bar: true, band: true, wheel: true, ...profile.equipment};

  const templates: Record<number, [string, number][]> = {
    0: [
      ['walk', 75],
      ['shoulders', 45],
      ['wrists', 45],
      ['chest', 45],
      ['rotatorCuff', 55],
      ['scap', 65],
      ['legs', 45],
      ['pullPrep', 75],
    ],
    2: [
      ['walk', 75],
      ['shoulders', 45],
      ['wristLoad', 45],
      ['anklePrep', 45],
      ['legs', 55],
      ['gluteBridgePrep', 50],
      ['pushPrep', 55],
      ['plank', 50],
      ['rehearsal', 95],
    ],
    4: [
      ['walk', 75],
      ['wrists', 45],
      ['shoulders', 45],
      ['rotatorCuff', 50],
      ['anklePrep', 45],
      ['hips', 45],
      ['legs', 45],
      ['lunges', 50],
      ['scap', 55],
      ['pullPrep', 65],
      ['core', 45],
    ],
    6: [
      ['walk', 120],
      ['shoulders', 60],
      ['hips', 60],
      ['mobility', 60],
    ],
  };

  let chosen: [string, number][] = [...(templates[day] || templates[6])].filter(
    ([key]) =>
      (day === 6 || PREP_LIBRARY[key].tags.some((t) => t === 'general' || Boolean(f[t]))) &&
      (key !== 'pullPrep' || f.bandPull),
  );

  const ensure = (key: string, time: number) => {
    if (!chosen.some(([k]) => k === key)) chosen.push([key, time]);
  };

  if (f.pull || f.verticalBandPull || f.horizontalPull) {
    ensure('shoulders', 45);
    ensure('wrists', 45);
    ensure('rotatorCuff', 55);
  }
  if (f.pull) {
    ensure('scap', 65);
    if (f.bandPull) ensure('pullPrep', 75);
  }
  if (f.verticalBandPull) ensure('latPrep', 60);
  if (f.foundation) {
    chosen = chosen.map(([k, t]) => [
      k === 'scap' ? 'wallScap' : k === 'pullPrep' ? 'latPrep' : k,
      t,
    ]);
  }
  if (f.horizontalPull) ensure('rowPrep', 50);
  if (f.push) {
    ensure('wristLoad', 45);
    ensure('chest', 45);
    ensure('shoulders', 45);
    ensure('pushPrep', 55);
  }
  if (f.legs || f.bridge) {
    ensure('anklePrep', 45);
    ensure('hips', 45);
    ensure('gluteBridgePrep', 50);
  }
  if (f.core && !chosen.some(([k]) => k === 'core' || k === 'plank')) ensure('core', 50);
  if (f.wheel) {
    ensure('wristLoad', 45);
    ensure('core', 50);
  }
  if (testing) ensure('recovery', 120);
  if (f.jump && !chosen.some(([k]) => k === 'rehearsal' || k === 'landing')) ensure('landing', 50);
  if (!f.complex) chosen = chosen.filter(([k]) => k !== 'rehearsal');

  chosen = chosen.map(([key, t]) =>
    PREP_LIBRARY[key].equipment.every((k) => equipment[k]) ? [key, t] : ['chest', t],
  );
  chosen = chosen.filter(([k], i, a) => a.findIndex(([x]) => x === k) === i);
  if (!chosen.length) {
    chosen = [
      ['walk', 120],
      ['mobility', 180],
    ];
  }

  const stage: Record<string, number> = {locomotion: 0, mobility: 1, activation: 2, specific: 3};
  chosen.sort((a, b) => stage[PREP_LIBRARY[a[0]].pattern] - stage[PREP_LIBRARY[b[0]].pattern]);

  const normal = day === 6 ? 300 : 600;
  const target = testing ? 720 : normal;
  const sum = chosen.reduce((n, x) => n + x[1], 0);
  if (sum < target) {
    // Додаємо вільний час насамперед у цільову активацію та підвідні рухи робочих м’язів
    let extra = target - sum;
    const priorityIdx = chosen
      .map((item, i) => ({i, pat: PREP_LIBRARY[item[0]].pattern}))
      .filter((x) => x.pat === 'specific' || x.pat === 'activation')
      .map((x) => x.i);
    const pool = priorityIdx.length ? priorityIdx : [0];
    let p = 0;
    while (extra > 0) {
      const add = Math.min(extra, 10);
      chosen[pool[p % pool.length]][1] += add;
      extra -= add;
      p++;
    }
  } else if (sum > target) {
    // При скороченні спочатку зменшуємо загальні вправи, зберігаючи час на цільові м’язи
    const minimum = chosen.map(([k]) => {
      const pat = PREP_LIBRARY[k].pattern;
      if (k === 'walk') return 60;
      if (pat === 'specific') return 45;
      if (pat === 'activation') return 40;
      return 30;
    });
    let excess = sum - target;
    for (let i = 0; i < chosen.length && excess > 0; i++) {
      const take = Math.min(excess, Math.max(0, chosen[i][1] - minimum[i]));
      chosen[i][1] -= take;
      excess -= take;
    }
  }

  const parts: WarmupPart[] = chosen.map(([key, seconds]) => {
    const x = PREP_LIBRARY[key];
    let tech = x.tech;
    if ((light || level === 0) && key === 'pullPrep') {
      tech =
        '0–1 дуже легке повторення з резинкою лише із запасом. Якщо воно важке — легкі рухи лопатками біля стіни. Решта часу — відпочинок.';
    }
    if (light && x.reps) {
      if (key === 'scap') {
        tech =
          '1×3 легких лопаткових рухи з прямими ліктями; за потреби стопи на підлозі. Решта вікна — відпочинок.';
      } else if (key === 'pullPrep') {
        tech =
          'Лише 1 дуже легке повторення з резинкою; якщо запасу немає — рухи лопатками біля стіни. Решта вікна — відпочинок.';
      } else {
        tech += ' Полегшений режим: один короткий підхід із меншою кількістю повторень.';
      }
    }
    if (profile.lowImpact && ['rehearsal', 'landing'].includes(key)) {
      tech =
        key === 'landing'
          ? 'Підйоми на носки й кроки; без стрибків.'
          : '3 віджимання від стіни, 4 крокові підтягування ніг у планці, 2 присідання без стрибка, 4 легкі підйоми тулуба. Решта часу — відпочинок.';
    }

    return {
      key,
      name: x.name,
      seconds,
      manual: !!x.reps,
      dose: tech,
      why: x.why,
      note:
        x.why +
        ' ' +
        tech +
        (x.reps ? ' Час — вікно, а не вимога поспішати. Підтвердь завершення, коли закінчиш.' : ''),
      tags: x.tags,
      joints: x.joints,
      muscles: x.muscles,
      pattern: x.pattern,
      difficulty: light ? 0 : x.difficulty,
      equipment: x.equipment.filter((k) => equipment[k]),
    };
  });

  const missing =
    (f.pull && (!equipment.bar || (f.bandPull && !equipment.band))) ||
    (f.horizontalPull && !equipment.band) ||
    (f.verticalBandPull && (!equipment.bar || !equipment.band));
  const blocked = !!profile.pain;

  const dayMap: Record<number, string> = {0: 'А', 2: 'Б', 4: 'В', 6: 'Г'};

  const focusGroups: string[] = [];
  if (f.pull || f.verticalBandPull || f.horizontalPull) focusGroups.push('спина й лопатки');
  if (f.push) focusGroups.push('груди, плечі й кисті');
  if (f.legs || f.bridge || f.jump) focusGroups.push('ноги, коліна й сідниці');
  if (f.core || f.wheel) focusGroups.push('кор');

  const focusText = focusGroups.length
    ? `Загальний розігрів → акцент на цільові м’язи (${focusGroups.join(', ')}) → підвідні повторення.`
    : 'Загальний розігрів → мобільність → активація → репетиція фактичних рухів.';

  return {
    name: testing ? 'Розминка перед контрольним тестом' : `Розминка ${dayMap[day] || 'відновлення'}`,
    seconds: parts.reduce((n, p) => n + p.seconds, 0),
    parts,
    features: f,
    testing,
    blocked,
    missing,
    reason: blocked
      ? 'Є повідомлення про біль: припини або модифікуй відповідну активність; за потреби звернися до фахівця.'
      : missing
        ? 'Для запланованих підтягувань бракує перекладини або резинки. Розминка їх не замінює: перевір план та інвентар.'
        : light
          ? 'Легка активація й більше відновлення без збільшення повторень.'
          : focusText,
  };
}

export function buildCooldown({
  rows,
  seconds = 300,
  profile = {},
}: {
  rows: SessionRow[];
  seconds?: number;
  profile?: Partial<WarmupPrefs>;
}): CooldownPlan {
  const f = analyzeWarmupPlan(rows);
  const keys = ['slowWalk'];

  if (!profile.pain) {
    if (f.pull || f.horizontalPull || f.verticalBandPull) keys.push('back');
    if (f.push) keys.push('chestLeft', 'chestRight');
    if (f.legs || f.jump) keys.push('hipLeft', 'hipRight');
    if (f.jump) keys.push('calfLeft', 'calfRight');
  }
  keys.push('breathe');
  if (profile.pain) keys.splice(0, keys.length, 'breathe');

  const total = Math.max(1, Math.round(seconds));
  const selected = total < keys.length ? ['breathe'] : keys;
  const times = selected.map((k) => COOL_LIBRARY[k].seconds);

  if (total === 300 && selected.length === 9) {
    times[0] = 45;
    times[1] = 45;
    times[times.length - 1] = 30;
  }

  const sum = times.reduce((n, x) => n + x, 0);
  if (sum < total) {
    const extra = total - sum;
    times[0] += Math.floor(extra / 2);
    times[times.length - 1] += extra - Math.floor(extra / 2);
  } else if (sum > total) {
    for (let i = 0; i < times.length; i++) {
      times[i] = Math.max(1, Math.floor((times[i] * total) / sum));
    }
    let remainder = total - times.reduce((n, x) => n + x, 0);
    for (let i = 0; remainder > 0; i = (i + 1) % times.length) {
      times[i]++;
      remainder--;
    }
  }

  const parts: WarmupPart[] = selected.map((key, i) => {
    const x = COOL_LIBRARY[key];
    return {
      key,
      name: x.name,
      seconds: times[i],
      manual: false,
      why: x.why,
      dose: x.tech,
      note: (profile.pain ? 'Не розтягуй болісну ділянку. ' : '') + x.tech,
    };
  });

  return {
    name: 'Заминка',
    seconds: parts.reduce((n, p) => n + p.seconds, 0),
    parts,
    features: f,
    reason:
      'Повільна ходьба → легка рухливість навантажених ділянок → спокійне дихання. Без ривків і силового розтягування.',
  };
}

export function cooldownRow(c: CooldownPlan): SessionRow {
  return {
    name: c.name,
    sets: `${Math.ceil(c.seconds / 60)} хв`,
    rest: '—',
    note: c.reason,
    section: null,
    kind: 'cool',
    seconds: c.seconds,
    parts: c.parts,
    dynamicCooldown: true,
  };
}
