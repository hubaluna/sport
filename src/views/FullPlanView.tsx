import {ArrowLeft, Download, Printer} from 'lucide-react';
import {DAYS, GUIDE, WEEKS} from '../data/program';
import {buildSessionPlan} from '../engine/session';
import {planMarkdown} from '../engine/storage';
import type {ForgeState} from '../types/forge';
import {downloadFile} from '../utils/audio';

interface FullPlanViewProps {
  state: ForgeState;
  onBack: () => void;
}

export function FullPlanView({state, onBack}: FullPlanViewProps) {
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-[38px] inline-flex items-center gap-1.5 text-xs font-semibold text-[#CEFA42] hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Назад до плану</span>
          </button>
          <h1 className="font-display text-3xl font-bold text-[#F2F6EB]">Повна програма на 8 рівнів</h1>
          <p className="text-xs text-[#9FA995]">Усі вправи, підходи, відпочинок та методичні правила.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2 text-xs font-bold text-[#111310]"
          >
            <Printer className="w-4 h-4" />
            <span>Друк / PDF</span>
          </button>
          <button
            type="button"
            onClick={() =>
              downloadFile('FORGE-8-план.md', planMarkdown(state), 'text/markdown;charset=utf-8')
            }
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#191D16] px-4 py-2 text-xs font-semibold text-[#F2F6EB]"
          >
            <Download className="w-4 h-4" />
            <span>Завантажити .md</span>
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {WEEKS.map((w, i) => (
          <section key={i} className="space-y-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#CEFA42]">
                Рівень {i + 1} — {w.name}
              </h2>
              <p className="text-xs text-[#9FA995]">
                Заняття А, Б, В, Г (активне відновлення). Підтягування адаптуються за журналом.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[0, 2, 4, 6].map((day) => {
                const s = buildSessionPlan(i + 1, day, state);
                return (
                  <article
                    key={day}
                    className="print-card rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3"
                  >
                    <h3 className="text-sm font-bold text-[#F2F6EB]">
                      {DAYS[day]} · {s.title}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[#9FA995]">
                            <th className="py-1.5 pr-2 font-semibold">Вправа</th>
                            <th className="py-1.5 pr-2 font-semibold">Обсяг</th>
                            <th className="py-1.5 font-semibold">Відп.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {s.rows.map((r, rIdx) => (
                            <tr key={rIdx}>
                              <td className="py-2 pr-2 align-top">
                                <span className="font-medium text-[#F2F6EB] block">{r.name}</span>
                                <span className="text-[11px] text-[#9FA995] block">{r.note}</span>
                              </td>
                              <td className="py-2 pr-2 font-mono tabular-nums text-[#CEFA42] whitespace-nowrap align-top">
                                {r.sets}
                              </td>
                              <td className="py-2 font-mono tabular-nums text-[#9FA995] whitespace-nowrap align-top">
                                {r.rest}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <section className="space-y-3 pt-4 border-t border-white/10">
          <h2 className="font-display text-2xl font-bold text-[#F2F6EB]">Методичні правила</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GUIDE.map((g) => (
              <div
                key={g.title}
                className="print-card rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-1.5"
              >
                <h3 className="text-sm font-bold text-[#F2F6EB]">{g.title}</h3>
                <p className="text-xs text-[#9FA995] leading-relaxed whitespace-pre-line">{g.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
