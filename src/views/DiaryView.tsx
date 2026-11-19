import {CheckCircle2, Circle, Search, Trash2} from 'lucide-react';
import {useMemo, useState} from 'react';
import {Sparkline} from '../components/Sparkline';
import {clock, fmtDate} from '../engine/calendar';
import {progressMetrics} from '../engine/progression';
import type {ForgeState} from '../types/forge';

interface DiaryViewProps {
  state: ForgeState;
  onDeleteLog: (id: string) => void;
}

export function DiaryView({state, onDeleteLog}: DiaryViewProps) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'tests'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(30);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const metrics = progressMetrics(state);
  const pullTests = useMemo(() => state.logs.filter((l) => l.pull != null), [state.logs]);

  const sortedLogs = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA');
    return state.logs
      .slice()
      .sort((a, b) => (b.started || 0) - (a.started || 0))
      .filter((l) => {
        if (filter === 'completed' && !l.completed) return false;
        if (filter === 'tests' && l.type !== 'wod' && l.pull == null && !l.goalMet) return false;
        if (!q) return true;
        return (
          (l.title || '').toLocaleLowerCase('uk-UA').includes(q) ||
          (l.actual || '').toLocaleLowerCase('uk-UA').includes(q) ||
          (l.notes || '').toLocaleLowerCase('uk-UA').includes(q) ||
          l.date.includes(q)
        );
      });
  }, [state.logs, filter, query]);

  const visibleLogs = sortedLogs.slice(0, limit);
  const totalFinished = state.logs.reduce((n, l) => n + (l.completed ? 1 : 0), 0);
  const totalMinutes = Math.round(state.logs.reduce((n, l) => n + (l.minutes || 0), 0));
  const goals = [1, 3, 5, 7, 10];

  return (
    <div className="space-y-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB]">Щоденник</h1>
        <p className="text-xs text-[#9FA995] font-mono tabular-nums">
          {totalFinished} зав. · {totalMinutes} хв
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <section className="rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3.5">
          <h2 className="text-sm font-bold text-[#F2F6EB]">Рекорди та досягнення</h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="font-display text-2xl font-bold tabular-nums text-[#CEFA42]">
                {metrics.strict}
              </p>
              <p className="text-[11px] text-[#9FA995]">строгі макс.</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold tabular-nums text-[#F2F6EB]">
                {metrics.push}
              </p>
              <p className="text-[11px] text-[#9FA995]">віджимання</p>
            </div>
            <div>
              <p className="font-display text-2xl font-bold tabular-nums text-[#F2F6EB]">
                {metrics.best === null ? '—' : clock(metrics.best * 1000)}
              </p>
              <p className="text-[11px] text-[#9FA995]">5 раундів</p>
            </div>
          </div>

          <p className="text-xs text-[#9FA995] leading-relaxed">
            З резинкою: <strong className="text-[#F2F6EB] tabular-nums">{metrics.assisted}</strong>{' '}
            найбільший записаний підхід. Порівнюй лише однакову резинку, хват і розміщення.
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-white/10 text-xs">
            {goals.map((n) => {
              const reached = metrics.strict >= n;
              return (
                <span
                  key={n}
                  className={`inline-flex items-center gap-1.5 ${
                    reached ? 'text-[#CEFA42] font-semibold' : 'text-[#9FA995]'
                  }`}
                >
                  {reached ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  {n} строгих
                </span>
              );
            })}
            <span
              className={`inline-flex items-center gap-1.5 ${
                metrics.times.length ? 'text-[#CEFA42] font-semibold' : 'text-[#9FA995]'
              }`}
            >
              {metrics.times.length ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              Перші 5 раундів
            </span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                metrics.best !== null && metrics.best <= 1320
                  ? 'text-[#CEFA42] font-semibold'
                  : 'text-[#9FA995]'
              }`}
            >
              {metrics.best !== null && metrics.best <= 1320 ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              ≤22:00
            </span>
          </div>

          <div className="space-y-4 pt-2 border-t border-white/10">
            <Sparkline
              values={pullTests.map((l) => l.pull || 0)}
              label="Контрольні строгі підтягування"
            />
            <Sparkline
              values={metrics.times.map((l) => l.complexSeconds || 0)}
              label="5 стандартних раундів (секунди, менше — краще)"
              unit="с"
            />
          </div>
        </section>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9FA995] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук за датою, вправою чи нотаткою…"
                className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#191D16] pl-10 pr-3.5 py-2 text-sm text-[#F2F6EB] placeholder:text-[#9FA995]/70 focus-visible:outline-2 focus-visible:outline-[#CEFA42]"
              />
            </div>

            <div className="inline-flex items-center rounded-xl border border-white/10 bg-[#191D16] p-1 self-start">
              {(
                [
                  ['all', 'Усі'],
                  ['completed', 'Завершені'],
                  ['tests', 'WOD / тести'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setFilter(val)}
                  className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                    filter === val
                      ? 'bg-[#CEFA42] text-[#111310]'
                      : 'text-[#9FA995] hover:text-[#F2F6EB]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visibleLogs.length === 0 ? (
            <section className="rounded-2xl border border-white/10 bg-[#191D16] p-6 text-center space-y-2">
              <p className="text-sm font-semibold text-[#F2F6EB]">Записів не знайдено</p>
              <p className="text-xs text-[#9FA995]">
                {state.logs.length === 0
                  ? 'Запусти перше заняття на вкладці «План» — кожен підхід збережеться автоматично.'
                  : 'Спробуй змінити фільтр або пошуковий запит.'}
              </p>
            </section>
          ) : (
            <div className="space-y-3">
              {visibleLogs.map((l) => (
                <article
                  key={l.id}
                  className="rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[#9FA995]">
                        {fmtDate(l.date)} · рівень {l.week} ·{' '}
                        {l.completed ? (
                          <span className="text-[#CEFA42] font-semibold">Завершено</span>
                        ) : (
                          <span className="text-[#F2A98C]">Частково</span>
                        )}
                        {l.isReturnWorkout || l.returnWorkout ? ' · Втягувальне (Full-Body)' : ''}
                      </p>
                      <h3 className="text-sm font-bold text-[#F2F6EB] mt-0.5 truncate">
                        {l.title || `Заняття рівня ${l.week}`}
                      </h3>
                    </div>

                    {confirmDeleteId === l.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteLog(l.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[36px] rounded-lg bg-[#F2A98C] px-2.5 py-1 text-xs font-bold text-[#111310]"
                        >
                          Видалити
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#9FA995]"
                        >
                          Ні
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(l.id)}
                        aria-label="Видалити запис"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#9FA995] hover:text-[#F2A98C] hover:bg-white/5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-[#9FA995]">
                    <span>Час: {l.minutes} хв</span>
                    {l.complexSeconds !== null && <span>Комплекс: {clock(l.complexSeconds * 1000)}</span>}
                    {l.rounds > 0 && <span>Раунди: {l.rounds}</span>}
                    {l.rpe != null && <span>RPE: {l.rpe}/10</span>}
                    {l.pain != null && (
                      <span className={l.pain > 0 ? 'text-[#F2A98C]' : ''}>Біль: {l.pain}/10</span>
                    )}
                  </div>

                  <details className="border-t border-white/10 pt-2">
                    <summary className="min-h-[34px] cursor-pointer text-xs font-semibold text-[#CEFA42]">
                      Деталі підходів
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-[#BAC4B0] leading-relaxed">
                      {l.actual}
                    </pre>
                    {l.notes && (
                      <p className="mt-2 text-xs text-[#DCE3D3] border-t border-white/10 pt-2">
                        Нотатка: {l.notes}
                      </p>
                    )}
                  </details>
                </article>
              ))}

              {sortedLogs.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + 30)}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#191D16] px-4 py-2.5 text-xs font-semibold text-[#F2F6EB]"
                >
                  Показати старіші записи ({sortedLogs.length - limit})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
