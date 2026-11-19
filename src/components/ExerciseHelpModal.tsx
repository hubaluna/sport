import {ExternalLink, Play, X} from 'lucide-react';
import {useEffect} from 'react';
import {EXERCISES, exerciseHelpKey} from '../data/exercises';
import type {ExerciseHelp} from '../types/forge';

interface ExerciseHelpModalProps {
  exerciseName: string | null;
  fallbackNote?: string;
  complexRemaining?: string | null;
  pausedWorkout?: boolean;
  onClose: () => void;
}

export function ExerciseHelpModal({
  exerciseName,
  fallbackNote = '',
  complexRemaining,
  pausedWorkout,
  onClose,
}: ExerciseHelpModalProps) {
  useEffect(() => {
    if (!exerciseName) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exerciseName, onClose]);

  if (!exerciseName) return null;

  const key = exerciseHelpKey(exerciseName);
  const help: ExerciseHelp = (key ? EXERCISES[key] : null) || {
    name: exerciseName,
    category: 'Рух із твого плану',
    muscles: '',
    why: 'Виконуй цей підготовчий рух легко, без болю та виснаження.',
    setup: 'Займи стійку комфортну позицію й підготуй місце.',
    steps: fallbackNote
      ? fallbackNote.split(/[.!?]+\s+/).filter(Boolean)
      : [
          'Виконуй рух плавно у комфортній амплітуді.',
          'Дихай вільно та зберігай контроль положення тіла.',
        ],
    mistakes: ['Ривки, затримка дихання або рух через біль.'],
    easier: 'Зменш амплітуду чи інтенсивність; за потреби пропусти рух.',
    query: `${exerciseName} exercise technique`,
  };

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(help.query || `${exerciseName} technique`)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-help-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-white/15 bg-[#191D16] p-5 sm:p-6 text-[#F2F6EB] shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-medium text-[#CEFA42]">{help.category}</p>
            <h2 id="exercise-help-title" className="font-display text-2xl font-bold mt-1">
              {help.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити опис"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#F2F6EB] hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 py-4 text-sm leading-relaxed text-[#DCE3D3]">
          {complexRemaining && (
            <div className="rounded-xl border border-[#CEFA42]/40 bg-[#222B18] p-3.5 text-xs">
              <strong className="text-[#CEFA42] block mb-0.5">
                Таймер комплексу продовжує працювати
              </strong>
              <span className="tabular-nums text-[#F2F6EB]">{complexRemaining}</span>
            </div>
          )}

          {!complexRemaining && pausedWorkout && (
            <div className="rounded-xl border border-white/10 bg-[#21271D] p-3.5 text-xs text-[#9FA995]">
              Таймер заняття на паузі. Закрий опис, щоб продовжити.
            </div>
          )}

          {help.muscles && (
            <p>
              <strong className="text-[#CEFA42]">М’язи:</strong> {help.muscles}
            </p>
          )}

          <p>
            <strong className="text-[#F2F6EB]">Для чого:</strong> {help.why}
          </p>

          <div>
            <h3 className="text-sm font-bold text-[#F2F6EB] mb-1">Вихідне положення</h3>
            <p className="text-[#BAC4B0]">{help.setup}</p>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#F2F6EB] mb-1.5">Кроки руху</h3>
            <ol className="list-decimal pl-5 space-y-1.5 text-[#BAC4B0]">
              {help.steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>
          </div>

          {help.tempo && (
            <p className="text-xs text-[#9FA995]">
              <strong className="text-[#F2F6EB]">Темп:</strong> {help.tempo}
            </p>
          )}

          <div>
            <h3 className="text-sm font-bold text-[#F2F6EB] mb-1.5">Поширені помилки</h3>
            <ul className="list-disc pl-5 space-y-1 text-[#F2A98C]">
              {help.mistakes.map((m, idx) => (
                <li key={idx}>{m}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#F2F6EB] mb-1">Як полегшити</h3>
            <p className="text-[#BAC4B0]">{help.easier}</p>
          </div>

          {help.video && (
            <div className="pt-2 border-t border-white/10 space-y-2">
              <h3 className="text-sm font-bold text-[#F2F6EB]">Відео демонстрація</h3>
              <a
                href={help.video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#21271D] px-4 py-3 text-sm font-medium text-[#F2F6EB] hover:border-[#CEFA42]/50"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Play className="w-4 h-4 text-[#CEFA42] shrink-0" />
                  <span className="truncate">{help.video.title}</span>
                </span>
                <span className="text-xs text-[#9FA995] shrink-0">
                  {help.video.credit || 'YouTube'}
                </span>
              </a>
              {help.video.note && <p className="text-xs text-[#9FA995]">{help.video.note}</p>}
            </div>
          )}

          <div className="pt-1">
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#CEFA42] hover:underline"
            >
              <span>Шукати інші відео на YouTube</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[46px] rounded-xl bg-[#CEFA42] px-4 py-2.5 text-sm font-bold text-[#111310] hover:bg-[#d8fc64]"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
}
