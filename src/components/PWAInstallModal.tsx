import {Download, Share, X} from 'lucide-react';

interface PWAInstallModalProps {
  open: boolean;
  isIOS: boolean;
  isInstallable: boolean;
  onInstallNative: () => Promise<boolean>;
  onClose: () => void;
}

export function PWAInstallModal({
  open,
  isIOS,
  isInstallable,
  onInstallNative,
  onClose,
}: PWAInstallModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl border border-white/15 bg-[#191D16] p-6 text-[#F2F6EB] shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-medium text-[#CEFA42]">Встановлення PWA</p>
            <h2 id="pwa-install-title" className="font-display text-2xl font-bold mt-1">
              Додати на екран
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити інструкцію"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-[#21271D] text-[#F2F6EB]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-sm text-[#BAC4B0] leading-relaxed">
          {isInstallable ? (
            <>
              <p>
                Встанови FORGE / 8 як окремий застосунок — він працюватиме без інтернету зі
                швидким запуском таймерів і збереженням щоденника.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const ok = await onInstallNative();
                  if (ok) onClose();
                }}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-[#CEFA42] px-4 py-2.5 text-sm font-bold text-[#111310]"
              >
                <Download className="w-4 h-4" />
                Встановити FORGE / 8
              </button>
            </>
          ) : isIOS ? (
            <ol className="list-decimal pl-5 space-y-2.5">
              <li>
                Відкрий цей сайт у <strong>Safari</strong> (не у вбудованому браузері месенджера).
              </li>
              <li className="flex items-start gap-1.5">
                <span>
                  Натисни кнопку <strong className="text-[#F2F6EB]">«Поширити»</strong>{' '}
                  <Share className="inline w-4 h-4 text-[#CEFA42]" /> на нижній панелі.
                </span>
              </li>
              <li>
                Обери <strong className="text-[#F2F6EB]">«На Початковий екран»</strong> та натисни{' '}
                <strong className="text-[#F2F6EB]">«Додати»</strong>.
              </li>
            </ol>
          ) : (
            <ol className="list-decimal pl-5 space-y-2.5">
              <li>Відкрий меню браузера (три крапки у правому верхньому куті).</li>
              <li>
                Обери <strong className="text-[#F2F6EB]">«Встановити застосунок»</strong> або{' '}
                <strong className="text-[#F2F6EB]">«Додати на головний екран»</strong>.
              </li>
              <li>Після встановлення застосунок працюватиме офлайн.</li>
            </ol>
          )}
          <p className="text-xs text-[#9FA995]">
            Порада: іконка на головному екрані iOS може мати окреме сховище від Safari. Перед
            переходом експортуй JSON або код бекапу у профілі.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#21271D] px-4 py-2.5 text-sm font-semibold text-[#F2F6EB]"
        >
          Закрити
        </button>
      </div>
    </div>
  );
}
