#!/usr/bin/env node

/**
 * FORGE / 8 - Щотижневий автономний аналізатор тренувань та адаптер програми.
 *
 * Запускається щонеділі о 23:00 (через Antigravity scheduler або cron):
 * 1. Завантажує збережені за тиждень тренування з Google Таблиці (через Web App URL).
 * 2. Аналізує виконання вправ: віджимання, підтягування, тягу резинки, присідання, випади, міст, кор.
 * 3. Враховує біль (pain == 0) та завершені підходи.
 * 4. Адаптує кількість підходів і повторень у src/data/targets.json.
 * 5. Запускає перевірку типів, тести (npm test) та збірку (npm run build).
 * 6. Фіксує зміни в git та публікує на GitHub Pages (git push).
 */

import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const targetsPath = path.join(rootDir, 'src', 'data', 'targets.json');
const configPath = path.join(__dirname, 'coach_config.json');

let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Помилка читання coach_config.json:', e);
  }
}

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
    console.log(`Отримання тренувань з Google Таблиці...`);
    try {
      workouts = await fetchWorkouts(config.url, config.secret);
      console.log(`Успішно завантажено записів: ${workouts.length}`);
    } catch (err) {
      console.error(`Помилка отримання даних: ${err.message}`);
    }
  } else {
    console.log('Google URL ще не налаштовано в scripts/coach_config.json.');
  }

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

  const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  const adaptations = [];
  let hasPain = false;

  for (const w of recentWorkouts) {
    if ((w.pain || 0) > 0) {
      hasPain = true;
      console.log(`Увага: у тренуванні від ${w.date} зафіксовано біль (${w.pain}/10). Навантаження не збільшується.`);
    }
  }

  if (!hasPain && recentWorkouts.length >= 2) {
    const counts = {
      pushups: 0,
      squats: 0,
      lunges: 0,
      bandRow: 0,
      bridge: 0,
      wheel: 0,
      deadbug: 0,
    };

    for (const w of recentWorkouts) {
      if (!Array.isArray(w.entries)) continue;
      for (const e of w.entries) {
        if (!e.name || e.completed === false) continue;
        const n = e.name.toLowerCase();
        if (n.includes('віджимання')) counts.pushups++;
        else if (n.includes('присідання')) counts.squats++;
        else if (n.includes('випади')) counts.lunges++;
        else if (n.includes('тяга резинки сидячи')) counts.bandRow++;
        else if (n.includes('сідничний міст')) counts.bridge++;
        else if (n.includes('колесо')) counts.wheel++;
        else if (n.includes('мертвий жук')) counts.deadbug++;
      }
    }

    if (counts.pushups >= 3 && targets.pushups) {
      if (targets.pushups.reps < 12) {
        targets.pushups.reps += 1;
        adaptations.push(`Віджимання: ${targets.pushups.sets} × ${targets.pushups.reps}`);
      } else if (targets.pushups.sets < 4) {
        targets.pushups.sets += 1;
        targets.pushups.reps = 8;
        adaptations.push(`Віджимання: додано 4-й підхід (4 × 8)`);
      }
    }

    if (counts.squats >= 2 && targets.squats && targets.squats.reps < 18) {
      targets.squats.reps += 1;
      adaptations.push(`Присідання: ${targets.squats.sets} × ${targets.squats.reps}`);
    }

    if (counts.lunges >= 2 && targets.lunges && targets.lunges.reps < 12) {
      targets.lunges.reps += 1;
      adaptations.push(`Випади: ${targets.lunges.sets} × ${targets.lunges.reps} на ногу`);
    }

    if (counts.bandRow >= 2 && targets.bandRow && targets.bandRow.reps < 16) {
      targets.bandRow.reps += 1;
      adaptations.push(`Тяга резинки сидячи: ${targets.bandRow.sets} × ${targets.bandRow.reps}`);
    }

    if (counts.bridge >= 2 && targets.bridge && targets.bridge.reps < 16) {
      targets.bridge.reps += 1;
      adaptations.push(`Сідничний міст: ${targets.bridge.sets} × ${targets.bridge.reps}`);
    }

    if (counts.wheel >= 2 && targets.wheel && targets.wheel.reps < 8) {
      targets.wheel.reps += 1;
      adaptations.push(`Колесо з колін: ${targets.wheel.sets} × ${targets.wheel.reps}`);
    }

    if (counts.deadbug >= 2 && targets.deadbug && targets.deadbug.reps < 12) {
      targets.deadbug.reps += 1;
      adaptations.push(`Мертвий жук: ${targets.deadbug.sets} × ${targets.deadbug.reps}`);
    }
  }

  if (adaptations.length === 0) {
    console.log('Поточний обсяг закріплено. Змін у програмі на наступний тиждень не потрібно.');
    return;
  }

  console.log('\n--- Адаптація програми на наступний тиждень ---');
  adaptations.forEach((a) => console.log(`✓ ${a}`));

  fs.writeFileSync(targetsPath, JSON.stringify(targets, null, 2) + '\n', 'utf8');
  console.log('\nsrc/data/targets.json успішно оновлено!');

  try {
    console.log('Запуск перевірки типів, тестів та збірки...');
    execSync('npm run lint && npm test && npm run build', {cwd: rootDir, stdio: 'inherit'});
    console.log('Збірка успішна!');

    try {
      execSync(
        'git add src/data/targets.json assets/ index.html sw.js FORGE-8-single.html',
        {cwd: rootDir},
      );
      execSync(`git commit -m "Coach weekly auto-adaptation: ${adaptations.join('; ')}"`, {
        cwd: rootDir,
      });
      console.log('Коміт створено.');
      try {
        execSync('git push origin main', {cwd: rootDir});
        console.log('Зміни успішно відправлено на GitHub.');
      } catch (pushErr) {
        console.log('Не вдалося виконати git push:', pushErr.message);
      }
    } catch (gitErr) {
      console.log('Git commit пропущено:', gitErr.message);
    }
  } catch (buildErr) {
    console.error('Помилка при збірці після адаптації! Відкат змін...');
    execSync('git checkout -- src/data/targets.json', {cwd: rootDir});
  }
}

run().catch((err) => {
  console.error('Помилка роботи тренера:', err);
  process.exit(1);
});
