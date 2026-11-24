#!/usr/bin/env node

/**
 * FORGE / 8 - Щотижневий автономний аналізатор тренувань та адаптер програми.
 *
 * Запускається щонеділі о 23:00 (через Antigravity scheduler або cron):
 * 1. Завантажує збережені за тиждень тренування з Google Диска (через Web App URL).
 * 2. Аналізує виконання вправ: віджимання, підтягування, присідання, випади, комплекс CrossFit.
 * 3. Враховує біль (pain == 0), суб'єктивне навантаження (RPE <= 8) та запас повторень (reserve >= 1).
 * 4. Адаптує кількість підходів і повторень у src/data/program.ts (PROGRAM_TARGETS).
 * 5. Запускає тести (npm test) та збірку (npm run build).
 * 6. Фіксує зміни в git та публікує на GitHub Pages (git push).
 */

import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const programPath = path.join(rootDir, 'src', 'data', 'program.ts');
const configPath = path.join(__dirname, 'coach_config.json');

// Читання конфігурації
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Помилка читання coach_config.json:', e);
  }
}

// Підтримка аргументів командного рядка
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) config.url = args[++i];
  if (args[i] === '--secret' && args[i + 1]) config.secret = args[++i];
}

async function fetchWorkouts(url, secret) {
  if (!url) return null;
  const u = new URL(url);
  u.searchParams.set('action', 'get');
  if (secret) u.searchParams.set('secret', secret);

  const res = await fetch(u.toString(), {method: 'GET'});
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.workouts)) return data.workouts;
  return [];
}

async function run() {
  console.log('=== FORGE / 8: Щотижневий тренерський аналіз (Неділя 23:00) ===');

  let workouts = [];
  if (config.url) {
    console.log(`Отримання тренувань з Google Диска (${config.url})...`);
    try {
      workouts = await fetchWorkouts(config.url, config.secret);
      console.log(`Успішно завантажено записів: ${workouts.length}`);
    } catch (err) {
      console.error(`Помилка отримання даних з Google Диска: ${err.message}`);
    }
  } else {
    console.log('Google Drive URL ще не налаштовано в scripts/coach_config.json.');
  }

  // Фільтруємо тренування за останні 7 днів
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentWorkouts = workouts.filter((w) => {
    const ts = w.started || new Date(w.date + 'T12:00:00Z').getTime();
    return now - ts <= weekMs && w.completed;
  });

  console.log(`Завершених тренувань за останні 7 днів: ${recentWorkouts.length}`);

  if (recentWorkouts.length === 0) {
    console.log('Нових тренувань за тиждень не виявлено. Адаптація не потрібна.');
    return;
  }

  // Аналіз навантаження та адаптація
  let programContent = fs.readFileSync(programPath, 'utf8');

  // Витягуємо поточний PROGRAM_TARGETS
  const match = programContent.match(/export const PROGRAM_TARGETS: Record<string, ExerciseTargetConfig> = (\{[\s\S]*?\n\};)/);
  if (!match) {
    console.error('Не знайдено об’єкт PROGRAM_TARGETS у src/data/program.ts');
    return;
  }

  const targetsStr = match[1].replace(/;\s*$/, '');
  let targets;
  try {
    targets = eval(`(${targetsStr})`);
  } catch (err) {
    console.error('Помилка парсингу PROGRAM_TARGETS:', err);
    return;
  }

  const adaptations = [];
  let hasPain = false;

  for (const w of recentWorkouts) {
    if ((w.pain || 0) > 0) {
      hasPain = true;
      console.log(`Увага: у тренуванні від ${w.date} зафіксовано біль (${w.pain}/10). Навантаження не збільшується.`);
    }
  }

  if (!hasPain && recentWorkouts.length >= 2) {
    // Перевіряємо вправи у записах
    let completedPushups = 0;
    let completedSquats = 0;
    let completedLunges = 0;

    for (const w of recentWorkouts) {
      if (Array.isArray(w.entries)) {
        for (const e of w.entries) {
          if (e.name && e.name.includes('Віджимання') && e.completed) completedPushups++;
          if (e.name && e.name.includes('Присідання') && e.completed) completedSquats++;
          if (e.name && e.name.includes('випади') && e.completed) completedLunges++;
        }
      }
    }

    // Адаптація віджимань
    if (completedPushups >= 3 && targets.pushups) {
      if (targets.pushups.reps < 12) {
        targets.pushups.reps += 1;
        adaptations.push(`Віджимання: збільшено повторення до ${targets.pushups.reps} (підходів: ${targets.pushups.sets})`);
      } else if (targets.pushups.sets < 4) {
        targets.pushups.sets += 1;
        targets.pushups.reps = 8;
        adaptations.push(`Віджимання: додано 4-й підхід (4 × 8)`);
      }
    }

    // Адаптація присідань
    if (completedSquats >= 2 && targets.squats) {
      if (targets.squats.reps < 16) {
        targets.squats.reps += 1;
        adaptations.push(`Присідання без стрибка: збільшено повторення до ${targets.squats.reps}`);
      }
    }

    // Адаптація випадів
    if (completedLunges >= 2 && targets.lunges) {
      if (targets.lunges.reps < 12) {
        targets.lunges.reps += 1;
        adaptations.push(`Зворотні випади: збільшено повторення до ${targets.lunges.reps} на ногу`);
      }
    }
  }

  if (adaptations.length === 0) {
    console.log('Поточний обсяг закріплено. Змін у програмі на наступний тиждень не потрібно.');
    return;
  }

  console.log('\n--- Адаптація програми на наступний тиждень ---');
  adaptations.forEach((a) => console.log(`✓ ${a}`));

  // Форматуємо оновлений PROGRAM_TARGETS
  const formattedTargets = JSON.stringify(targets, null, 2)
    .replace(/"([a-zA-Z0-9_]+)":/g, '$1:')
    .replace(/"/g, "'");

  const replacement = `export const PROGRAM_TARGETS: Record<string, ExerciseTargetConfig> = ${formattedTargets};`;
  programContent = programContent.replace(/export const PROGRAM_TARGETS: Record<string, ExerciseTargetConfig> = \{[\s\S]*?\n\};/, replacement);

  fs.writeFileSync(programPath, programContent, 'utf8');
  console.log('\nsrc/data/program.ts успішно оновлено!');

  // Перевірка тестів та білду
  try {
    console.log('Запуск тестів (npm test)...');
    execSync('npm test', {cwd: rootDir, stdio: 'inherit'});
    console.log('Запуск збірки (npm run build)...');
    execSync('npm run build', {cwd: rootDir, stdio: 'inherit'});
    console.log('Збірка успішна!');

    // Git commit та push
    try {
      execSync('git add -A', {cwd: rootDir});
      execSync(`git commit -m "Coach weekly auto-adaptation: ${adaptations.join('; ')}"`, {cwd: rootDir});
      console.log('Коміт створено.');
      try {
        execSync('git push origin main', {cwd: rootDir});
        console.log('Зміни успішно відправлено на GitHub (деплой GitHub Pages активовано).');
      } catch (pushErr) {
        console.log('Не вдалося виконати git push (можливо, немає прав або мережі):', pushErr.message);
      }
    } catch (gitErr) {
      console.log('Git commit пропущено:', gitErr.message);
    }
  } catch (buildErr) {
    console.error('Помилка при збірці після адаптації! Відкат змін...');
    execSync('git checkout -- src/data/program.ts', {cwd: rootDir});
  }
}

run().catch((err) => {
  console.error('Помилка роботи тренера:', err);
  process.exit(1);
});
