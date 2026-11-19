import {Pause, Play, Plus, RotateCcw} from 'lucide-react';
import {useEffect, useState} from 'react';
import {clock} from '../engine/calendar';
import type {WodState} from '../types/forge';

interface WodViewProps {
  wod: WodState | null;
  onStart: () => void;
  onPause: () => void;
  onRound: () => void;
  onFinish: () => void;
  onReset: () => void;
  onExit: () => void;
}

const WOD_MOVES = [
  '10 віджимань',
  '10 стрибків у планці',
  '5 вистрибувань із присіду',
  '10 прес: руки до стоп',
];

const LIMIT_MS = 22 * 60 * 1000;

export function WodView({
  wod,
  onStart,
  onPause,
  onRound,
  onFinish,
  onReset,
  onExit,
}: WodViewProps) {
  const [now, setNow] = useState(() => Date.now());
  const w: WodState = wod || {
    running: false,
    started: null,
    elapsed: 0,
    round: 0,
    splits: [],
    done: false,
  };

  useEffect(() => {
    if (!w.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [w.running]);

  const elapsed = w.running && w.started ? w.elapsed + (now - w.started) : w.elapsed;
  const remaining = Math.max(0, LIMIT_MS - elapsed);
  const pct = Math.min(100, (elapsed / LIMIT_MS) * 100);

  if (w.done || w.round >= 5) {
    return (
      <div className="mx-auto max-w-lg h-[calc(100dvh-3.75rem)] max-h-[820px] flex flex-col justify-between py-2 overflow-hidden">
        <section className="flex-1 min-h-0 flex flex-col justify-between rounded-2xl border border-[#CEFA42]/40 bg-[#191D16] p-5 overflow-hidden">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#CEFA42]">WOD завершено</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB]">
              Результат контрольного комплексу
            </h1>
            <p className="text-sm text-[#9FA995] font-mono tabular-nums">
              {w.round} / 5 раундів · загальний час {clock(w.elapsed)}
            </p>
          </div>

          {w.splits.length > 0 && (
            <div className="divide-y divide-white/10 border-y border-white/10 my-3">
              {w.splits.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-xs sm:text-sm">
                  <span className="text-[#9FA995]">Раунд {i + 1}</span>
                  <span className="font-mono tabular-nums font-semibold text-[#F2F6EB]">
                    {clock(s)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onReset}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Новий WOD</span>
            </button>
            <button
              type="button"
              onClick={onExit}
              className="min-h-[48px] rounded-xl border border-white/15 bg-[#21271D] px-4 text-sm font-semibold text-[#F2F6EB]"
            >
              До плану
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg h-[calc(100dvh-3.75rem)] max-h-[820px] flex flex-col justify-between py-1 overflow-hidden">
      <section className="flex-1 min-h-0 flex flex-col justify-between rounded-2xl border border-[#CEFA42]/40 bg-[#191D16] p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between text-xs text-[#9FA995] shrink-0">
          <span className="font-semibold text-[#CEFA42]">WOD · ліміт 22:00</span>
          <button
            type="button"
            onClick={onExit}
            className="min-h-[36px] px-2 text-xs text-[#9FA995] hover:text-[#F2F6EB]"
          >
            Вийти
          </button>
        </div>

        <div className="text-center space-y-1.5 shrink-0">
          <div
            role="timer"
            aria-label="Залишок часу WOD"
            className="font-display text-6xl font-bold tabular-nums tracking-tight leading-none text-[#CEFA42]"
          >
            {clock(remaining)}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2A3124]">
            <div
              className="h-full bg-[#CEFA42] transition-all duration-300"
              style={{width: `${pct}%`}}
            />
          </div>
          <p className="text-base font-bold text-[#F2F6EB] pt-1">Раунд {w.round + 1} / 5</p>
        </div>

        <ul className="divide-y divide-white/10 border-y border-white/10 text-xs sm:text-sm text-[#DCE3D3] my-1">
          {WOD_MOVES.map((m) => (
            <li key={m} className="py-2">
              {m}
            </li>
          ))}
        </ul>

        <div className="space-y-2 shrink-0">
          {w.splits.length > 0 && (
            <p className="text-[11px] text-[#9FA995] font-mono tabular-nums text-center truncate">
              Спліти: {w.splits.map((s, i) => `${i + 1}: ${clock(s)}`).join(' · ')}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            {w.running ? (
              <>
                <button
                  type="button"
                  onClick={onRound}
                  className="col-span-2 min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
                >
                  <Plus className="w-4 h-4" />
                  <span>+1 раунд (Раунд {w.round + 1} / 5)</span>
                </button>
                <button
                  type="button"
                  onClick={onPause}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                >
                  <Pause className="w-4 h-4" />
                  <span>Пауза</span>
                </button>
                <button
                  type="button"
                  onClick={onFinish}
                  className="min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                >
                  Завершити WOD
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStart}
                  className="col-span-2 min-h-[50px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 text-sm font-bold text-[#111310]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{w.started === null ? 'Старт WOD' : 'Продовжити'}</span>
                </button>
                {w.round > 0 && (
                  <button
                    type="button"
                    onClick={onFinish}
                    className="col-span-2 min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] text-xs font-semibold text-[#F2F6EB]"
                  >
                    Завершити та зберегти ({w.round} / 5)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
