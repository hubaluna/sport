import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Cloud,
  CloudUpload,
  Download,
  HelpCircle,
  RefreshCw,
  Smartphone,
  Upload,
  Volume2,
} from 'lucide-react';
import {useRef, useState} from 'react';
import {
  APP_VERSION,
  BAND_ATTACHES,
  BAND_RESISTS,
  PROFILE,
  PROGRAM_REVISION,
} from '../data/program';
import {calendarMonday, dateISO} from '../engine/calendar';
import {
  decodeBackupCode,
  encodeBackupCode,
  parseBandMeta,
  parseImportPayload,
} from '../engine/storage';
import type {ForgeState} from '../types/forge';
import {downloadFile, playSignal} from '../utils/audio';
import {testGoogleDriveConnection, uploadToGoogleDrive} from '../utils/googleDriveSync';

interface ProfileViewProps {
  state: ForgeState;
  isInstalled: boolean;
  wakeLockStatusText: string;
  recoveryRaw: string | null;
  recoveryNotice: string;
  onUpdateState: (updater: (prev: ForgeState) => ForgeState, notice?: string) => void;
  onImportState: (incoming: ForgeState, notice: string) => void;
  onResetAll: () => void;
  onOpenInstall: () => void;
  onToast: (msg: string) => void;
}

export function ProfileView({
  state,
  isInstalled,
  wakeLockStatusText,
  recoveryRaw,
  recoveryNotice,
  onUpdateState,
  onImportState,
  onResetAll,
  onOpenInstall,
  onToast,
}: ProfileViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [backupInput, setBackupInput] = useState('');
  const [exportedCode, setExportedCode] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [driveUrl, setDriveUrl] = useState(state.googleDriveUrl || '');
  const [driveSecret, setDriveSecret] = useState(state.googleDriveSecret || '');
  const [autoSync, setAutoSync] = useState(state.googleDriveAutoSync ?? true);
  const [isTestingDrive, setIsTestingDrive] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [showDriveGuide, setShowDriveGuide] = useState(false);

  const parsedBand = parseBandMeta(state.band);
  const resist = state.bandResist || parsedBand.bandResist;
  const attach = state.bandAttach || parsedBand.bandAttach;

  const applyBand = (nextResist: string, nextAttach: string) => {
    const label =
      nextResist === 'Без резинки' ? 'Без резинки' : `${nextResist} (${nextAttach.toLowerCase()})`;
    onUpdateState((prev) => ({
      ...prev,
      bandResist: nextResist,
      bandAttach: nextAttach,
      band: label,
      coach: {
        ...prev.coach,
        assistedAt: Date.now(),
      },
    }));
  };

  const handleCopyBackup = async () => {
    try {
      const code = encodeBackupCode(state);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        onToast('Код бекапу скопійовано в буфер обміну');
        setExportedCode(null);
      } else {
        setExportedCode(code);
        onToast('Код бекапу згенеровано нижче');
      }
    } catch {
      const code = encodeBackupCode(state);
      setExportedCode(code);
      onToast('Скопіюй код вручну з поля нижче');
    }
  };

  const handleRestoreFromCode = () => {
    const trimmed = backupInput.trim();
    if (!trimmed) {
      onToast('Встав код бекапу у поле');
      return;
    }
    try {
      const incoming = decodeBackupCode(trimmed);
      onImportState(incoming, `Дані відновлено · записів: ${incoming.logs.length}`);
      setBackupInput('');
      setShowPasteBox(false);
    } catch {
      onToast('Невірний або пошкоджений код бекапу');
    }
  };

  const handleExportJson = () => {
    const payload = JSON.stringify({format: 'forge8', version: 2, data: state}, null, 2);
    downloadFile(`forge8-backup-${dateISO()}.json`, payload, 'application/json');
    onToast('JSON-бекап завантажено');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const incoming = parseImportPayload(text);
      onImportState(incoming, `Файл імпортовано · записів: ${incoming.logs.length}`);
    } catch {
      onToast('Не вдалося прочитати JSON-бекап');
    }
  };

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F2F6EB]">Профіль</h1>
        <p className="text-xs text-[#9FA995]">
          Максимуми, резинка, параметри розминки й резервні копії.
        </p>
      </div>

      {recoveryNotice && (
        <section className="rounded-2xl border border-[#F2A98C]/40 bg-[#231915] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2 text-xs text-[#F2A98C]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{recoveryNotice}</span>
          </div>
          {recoveryRaw && (
            <button
              type="button"
              onClick={() =>
                downloadFile(`forge8-recovery-${dateISO()}.json`, recoveryRaw, 'application/json')
              }
              className="min-h-[36px] rounded-xl border border-[#F2A98C]/40 bg-[#111310] px-3 py-1 text-xs font-semibold text-[#F2A98C] shrink-0"
            >
              Завантажити копію
            </button>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3.5">
          {/* Strength calibration */}
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3">
            <h2 className="text-sm font-bold text-[#F2F6EB]">Поточні максимуми та тяга</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="prof-push" className="block text-xs text-[#9FA995] mb-1">
                  Віджимання макс.
                </label>
                <input
                  id="prof-push"
                  type="number"
                  min={0}
                  max={200}
                  value={state.coach.pushMax ?? PROFILE.push}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(200, Math.round(Number(e.target.value) || 0)));
                    onUpdateState((prev) => ({
                      ...prev,
                      coach: {...prev.coach, pushMax: v, pushAt: Date.now()},
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-sm font-mono tabular-nums text-[#F2F6EB]"
                />
              </div>

              <div>
                <label htmlFor="prof-strict" className="block text-xs text-[#9FA995] mb-1">
                  Строгі підтягування
                </label>
                <input
                  id="prof-strict"
                  type="number"
                  min={0}
                  max={50}
                  value={state.coach.strictMax ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(50, Math.round(Number(e.target.value) || 0)));
                    onUpdateState((prev) => ({
                      ...prev,
                      coach: {...prev.coach, strictMax: v, strictAt: Date.now()},
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-sm font-mono tabular-nums text-[#CEFA42]"
                />
              </div>

              <div>
                <label htmlFor="prof-assisted" className="block text-xs text-[#9FA995] mb-1">
                  З резинкою (повні)
                </label>
                <input
                  id="prof-assisted"
                  type="number"
                  min={0}
                  max={50}
                  value={state.coach.assistedMax ?? 0}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(50, Math.round(Number(e.target.value) || 0)));
                    onUpdateState((prev) => ({
                      ...prev,
                      coach: {...prev.coach, assistedMax: v, assistedAt: Date.now()},
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-sm font-mono tabular-nums text-[#F2F6EB]"
                />
              </div>

              <div>
                <label htmlFor="prof-rom" className="block text-xs text-[#9FA995] mb-1">
                  Частковий хід (%)
                </label>
                <input
                  id="prof-rom"
                  type="number"
                  min={10}
                  max={100}
                  step={5}
                  value={state.coach.assistedROM ?? 60}
                  onChange={(e) => {
                    const v = Math.max(10, Math.min(100, Math.round(Number(e.target.value) || 60)));
                    onUpdateState((prev) => ({
                      ...prev,
                      coach: {...prev.coach, assistedROM: v},
                    }));
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-sm font-mono tabular-nums text-[#F2F6EB]"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <p className="text-xs font-semibold text-[#F2F6EB]">Опір резинки</p>
              <div className="flex flex-wrap gap-1.5">
                {BAND_RESISTS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => applyBand(r, attach)}
                    className={`min-h-[38px] rounded-lg border px-3 text-xs font-medium ${
                      resist === r
                        ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                        : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {resist !== 'Без резинки' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#F2F6EB]">Кріплення резинки</p>
                <div className="flex flex-wrap gap-2">
                  {BAND_ATTACHES.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => applyBand(resist, a)}
                      className={`min-h-[38px] rounded-lg border px-3 text-xs font-medium ${
                        attach === a
                          ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                          : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Schedule & Core */}
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-4 space-y-3">
            <h2 className="text-sm font-bold text-[#F2F6EB]">Графік та вправа для кора</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="prof-start" className="block text-xs text-[#9FA995] mb-1">
                  Дата старту (не змінює чергу)
                </label>
                <input
                  id="prof-start"
                  type="date"
                  value={state.start}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const monday = calendarMonday(e.target.value);
                    onUpdateState(
                      (prev) => ({...prev, start: monday}),
                      monday !== e.target.value ? `Прив’язано до понеділка: ${monday}` : undefined,
                    );
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-sm font-mono text-[#F2F6EB]"
                />
              </div>

              <div>
                <p className="text-xs text-[#9FA995] mb-1">Кількість занять у циклі</p>
                <div className="grid grid-cols-2 gap-2">
                  {([3, 4] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          frequency: freq,
                          currentWorkoutIndex: Math.min(prev.currentWorkoutIndex, freq - 1),
                        }))
                      }
                      className={`min-h-[44px] rounded-xl border text-xs font-semibold ${
                        state.frequency === freq
                          ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                          : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                      }`}
                    >
                      {freq} занять
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-xs font-semibold text-[#F2F6EB] mb-2">Вправа на кор у день А</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['wheel', 'Колесо з колін'],
                    ['deadbug', 'Мертвий жук'],
                  ] as const
                ).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      onUpdateState((prev) => ({
                        ...prev,
                        coach: {...prev.coach, core: val},
                      }))
                    }
                    className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold ${
                      (state.coach.core || 'wheel') === val
                        ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                        : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          {/* Warmup, Equipment, Audio, WakeLock */}
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 space-y-4">
            <h2 className="text-base font-bold text-[#F2F6EB]">Розминка, обладнання та екран</h2>

            <div className="divide-y divide-white/10 text-xs text-[#DCE3D3]">
              <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer min-h-[44px]">
                <span>Є біль або дискомфорт у суглобах (виключити стрибки)</span>
                <input
                  type="checkbox"
                  checked={state.warmupPrefs.pain}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      warmupPrefs: {...prev.warmupPrefs, pain: e.target.checked},
                    }))
                  }
                  className="h-4 w-4 accent-[#CEFA42] shrink-0"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer min-h-[44px]">
                <span>Підвищена втома (скорочена розминка 5 хв)</span>
                <input
                  type="checkbox"
                  checked={state.warmupPrefs.fatigue === 'high'}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      warmupPrefs: {
                        ...prev.warmupPrefs,
                        fatigue: e.target.checked ? 'high' : 'normal',
                      },
                    }))
                  }
                  className="h-4 w-4 accent-[#CEFA42] shrink-0"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer min-h-[44px]">
                <span>Тільки низькоударні рухи (без стрибків у розминці)</span>
                <input
                  type="checkbox"
                  checked={state.warmupPrefs.lowImpact}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      warmupPrefs: {...prev.warmupPrefs, lowImpact: e.target.checked},
                    }))
                  }
                  className="h-4 w-4 accent-[#CEFA42] shrink-0"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer min-h-[44px]">
                <span>Перші 5 хв прогулянки в день Г зараховувати як розминку</span>
                <input
                  type="checkbox"
                  checked={state.warmupPrefs.mergeWalk}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      warmupPrefs: {...prev.warmupPrefs, mergeWalk: e.target.checked},
                    }))
                  }
                  className="h-4 w-4 accent-[#CEFA42] shrink-0"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs font-semibold text-[#F2F6EB]">Доступне обладнання</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['bar', 'Турнік'],
                    ['band', 'Резинка'],
                    ['wheel', 'Колесо'],
                  ] as const
                ).map(([key, lbl]) => {
                  const has = state.warmupPrefs.equipment[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          warmupPrefs: {
                            ...prev.warmupPrefs,
                            equipment: {
                              ...prev.warmupPrefs.equipment,
                              [key]: !prev.warmupPrefs.equipment[key],
                            },
                          },
                        }))
                      }
                      className={`min-h-[42px] rounded-xl border text-xs font-semibold ${
                        has
                          ? 'border-[#CEFA42] bg-[#222B18] text-[#CEFA42]'
                          : 'border-white/10 bg-[#21271D] text-[#9FA995]'
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 text-xs text-[#DCE3D3] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.sound}
                    onChange={(e) =>
                      onUpdateState((prev) => ({...prev, sound: e.target.checked}))
                    }
                    className="h-4 w-4 accent-[#CEFA42]"
                  />
                  <span>Звукові сигнали й вібрація таймера</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    void playSignal('finish', true, true);
                    onToast('Тестовий сигнал відтворено');
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] px-3 text-xs font-semibold text-[#F2F6EB]"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#CEFA42]" />
                  <span>Тест</span>
                </button>
              </div>

              <div>
                <label className="flex items-center gap-2.5 text-xs text-[#DCE3D3] cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={state.keepScreen}
                    onChange={(e) =>
                      onUpdateState((prev) => ({...prev, keepScreen: e.target.checked}))
                    }
                    className="h-4 w-4 accent-[#CEFA42]"
                  />
                  <span>Не вимикати екран під час активного заняття (Wake Lock)</span>
                </label>
                <p className="text-[11px] text-[#9FA995] pl-6">{wakeLockStatusText}</p>
              </div>
            </div>
          </section>

          {/* Google Drive Cloud Sync */}
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-[#CEFA42]" />
                <h2 className="text-base font-bold text-[#F2F6EB]">Google Диск (Хмарне збереження)</h2>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  state.googleDriveUrl
                    ? 'bg-[#CEFA42]/20 text-[#CEFA42] border border-[#CEFA42]/40'
                    : 'bg-white/5 text-[#9FA995] border border-white/10'
                }`}
              >
                {state.googleDriveUrl ? 'Підключено' : 'Не налаштовано'}
              </span>
            </div>

            <p className="text-xs text-[#9FA995]">
              Автоматичне надсилання результатів тренувань у твій приватний Google Диск після кожного заняття. Щонеділі тренер аналізує збережені дані та адаптує кількість підходів і повторень у програмі.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-[#DCE3D3] mb-1.5">
                  URL веб-програми Google Apps Script
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-xs text-[#F2F6EB] placeholder:text-[#5F6759] focus:border-[#CEFA42] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#DCE3D3] mb-1.5">
                  Секретний ключ (Secret Token, якщо вказано у скрипті)
                </label>
                <input
                  type="password"
                  placeholder="Залиш пустим або введи SECRET_KEY зі скрипта"
                  value={driveSecret}
                  onChange={(e) => setDriveSecret(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111310] px-3 py-2 text-xs text-[#F2F6EB] placeholder:text-[#5F6759] focus:border-[#CEFA42] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 text-xs text-[#DCE3D3] cursor-pointer min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="h-4 w-4 accent-[#CEFA42]"
                  />
                  <span>Автоматично зберігати на Google Диск після завершення вправ</span>
                </label>
              </div>

              {state.lastSyncedAt ? (
                <p className="text-[11px] text-[#9FA995]">
                  Остання синхронізація:{' '}
                  <span className="text-[#CEFA42] font-mono">
                    {new Date(state.lastSyncedAt).toLocaleString('uk-UA')}
                  </span>
                </p>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState(
                      (prev) => ({
                        ...prev,
                        googleDriveUrl: driveUrl.trim(),
                        googleDriveSecret: driveSecret.trim(),
                        googleDriveAutoSync: autoSync,
                      }),
                      'Налаштування Google Диска збережено',
                    );
                  }}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#CEFA42] px-3 text-xs font-bold text-[#111310]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Зберегти</span>
                </button>

                <button
                  type="button"
                  disabled={!driveUrl || isTestingDrive}
                  onClick={async () => {
                    setIsTestingDrive(true);
                    const res = await testGoogleDriveConnection(driveUrl, driveSecret);
                    setIsTestingDrive(false);
                    if (res.ok) {
                      onToast('Зв’язок із Google Диском успішний!');
                    } else {
                      onToast(`Помилка зв’язку: ${res.error || 'помилка'}`);
                    }
                  }}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] px-3 text-xs font-semibold text-[#F2F6EB] disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#CEFA42] ${isTestingDrive ? 'animate-spin' : ''}`} />
                  <span>Перевірити зв'язок</span>
                </button>

                <button
                  type="button"
                  disabled={!driveUrl || isSyncingDrive}
                  onClick={async () => {
                    setIsSyncingDrive(true);
                    const res = await uploadToGoogleDrive(driveUrl, driveSecret, {
                      logs: state.logs,
                      state,
                    });
                    setIsSyncingDrive(false);
                    if (res.ok) {
                      onUpdateState(
                        (prev) => ({...prev, lastSyncedAt: Date.now()}),
                        `Синхронізовано записів: ${res.count ?? state.logs.length}`,
                      );
                    } else {
                      onToast(`Помилка: ${res.error}`);
                    }
                  }}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#21271D] px-3 text-xs font-semibold text-[#F2F6EB] disabled:opacity-50"
                >
                  <CloudUpload className={`w-3.5 h-3.5 text-[#CEFA42] ${isSyncingDrive ? 'animate-pulse' : ''}`} />
                  <span>Синхронізувати все</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowDriveGuide((v) => !v)}
                  className="text-xs text-[#CEFA42] hover:underline inline-flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showDriveGuide ? 'Приховати інструкцію' : 'Як підключити свій Google Диск (1 хвилина)'}</span>
                </button>
              </div>

              {showDriveGuide && (
                <div className="rounded-xl border border-white/10 bg-[#111310] p-3.5 space-y-2.5 text-xs text-[#DCE3D3]">
                  <p className="font-semibold text-[#F2F6EB]">Швидке налаштування у 3 кроки:</p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-[#9FA995]">
                    <li>
                      Перейди на <strong className="text-[#F2F6EB]">script.google.com</strong> та натисни <strong className="text-[#F2F6EB]">«Новий проєкт»</strong>.
                    </li>
                    <li>
                      Встав підготовлений код скрипта та натисни <strong className="text-[#F2F6EB]">«Зберегти»</strong>.
                    </li>
                    <li>
                      Натисни <strong className="text-[#F2F6EB]">«Розгорнути» (Deploy)</strong> → <strong className="text-[#F2F6EB]">«Нове розгортання»</strong> → тип: <strong className="text-[#F2F6EB]">«Веб-програма»</strong> (Доступ: «Усі», виконання: «Мене»).
                    </li>
                    <li>
                      Скопіюй отриману <strong className="text-[#F2F6EB]">URL-адресу веб-програми</strong> і встав її в поле вище.
                    </li>
                  </ol>
                  <button
                    type="button"
                    onClick={async () => {
                      const scriptCode = `/** FORGE / 8 - Google Apps Script Sync */
const SECRET_KEY = "${driveSecret.trim()}";
function getOrCreateFolder() {
  const name = "FORGE_8_Data";
  const f = DriveApp.getFoldersByName(name);
  return f.hasNext() ? f.next() : DriveApp.createFolder(name);
}
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (SECRET_KEY && data.secret !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({error:"Unauthorized"})).setMimeType(ContentService.MimeType.JSON);
    }
    const folder = getOrCreateFolder();
    const files = folder.getFilesByName("forge_workouts.json");
    let file = files.hasNext() ? files.next() : folder.createFile("forge_workouts.json", "[]", "application/json");
    let workouts = JSON.parse(file.getBlob().getDataAsString() || "[]");
    if (data.log) {
      const idx = workouts.findIndex(w => w.id === data.log.id);
      if (idx >= 0) workouts[idx] = data.log;
      else workouts.push(data.log);
    } else if (Array.isArray(data.logs)) {
      workouts = data.logs;
    }
    file.setContent(JSON.stringify(workouts, null, 2));
    if (data.state) {
      const sfld = folder.getFilesByName("forge_state.json");
      const sf = sfld.hasNext() ? sfld.next() : folder.createFile("forge_state.json", "{}", "application/json");
      sf.setContent(JSON.stringify(data.state, null, 2));
    }
    return ContentService.createTextOutput(JSON.stringify({status:"ok", count: workouts.length})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(e) {
  try {
    const token = e.parameter ? e.parameter.secret : "";
    if (SECRET_KEY && token !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({error:"Unauthorized"})).setMimeType(ContentService.MimeType.JSON);
    }
    if (e.parameter && e.parameter.action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({status:"ok", ping:"pong"})).setMimeType(ContentService.MimeType.JSON);
    }
    const folder = getOrCreateFolder();
    const files = folder.getFilesByName("forge_workouts.json");
    const content = files.hasNext() ? files.next().getBlob().getDataAsString() : "[]";
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                      try {
                        await navigator.clipboard.writeText(scriptCode);
                        onToast('Код скрипта скопійовано в буфер обміну!');
                      } catch {
                        onToast('Код є у файлі scripts/google-drive-sync.gs');
                      }
                    }}
                    className="mt-2 min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-[#CEFA42]/30 bg-[#21271D] px-3 text-xs font-semibold text-[#CEFA42]"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    <span>Скопіювати готовий код скрипта</span>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Backup & PWA */}
          <section className="rounded-2xl border border-white/10 bg-[#191D16] p-5 space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[#F2F6EB]">Резервні копії та застосунок</h2>
              <span className="text-[11px] font-mono text-[#9FA995]">
                v{APP_VERSION} · {PROGRAM_REVISION}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#21271D] px-4 text-xs font-semibold text-[#F2F6EB]"
              >
                <Download className="w-4 h-4 text-[#CEFA42]" />
                <span>Експорт JSON</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#21271D] px-4 text-xs font-semibold text-[#F2F6EB]"
              >
                <Upload className="w-4 h-4 text-[#CEFA42]" />
                <span>Імпорт JSON</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleCopyBackup}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#21271D] px-4 text-xs font-semibold text-[#F2F6EB]"
              >
                <ClipboardCopy className="w-4 h-4 text-[#CEFA42]" />
                <span>Скопіювати код бекапу</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPasteBox((v) => !v)}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#21271D] px-4 text-xs font-semibold text-[#F2F6EB]"
              >
                <RefreshCw className="w-4 h-4 text-[#CEFA42]" />
                <span>Вставити код бекапу</span>
              </button>
            </div>

            {exportedCode && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-[#9FA995]">Код резервної копії:</p>
                <textarea
                  readOnly
                  rows={3}
                  value={exportedCode}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border border-white/10 bg-[#111310] p-2.5 text-[11px] font-mono text-[#DCE3D3]"
                />
              </div>
            )}

            {showPasteBox && (
              <div className="rounded-xl border border-[#CEFA42]/30 bg-[#111310] p-3.5 space-y-2.5">
                <label htmlFor="paste-backup-area" className="block text-xs font-semibold text-[#F2F6EB]">
                  Встав код бекапу для відновлення
                </label>
                <textarea
                  id="paste-backup-area"
                  rows={3}
                  value={backupInput}
                  onChange={(e) => setBackupInput(e.target.value)}
                  placeholder="Встав Base64-код бекапу…"
                  className="w-full rounded-xl border border-white/10 bg-[#191D16] p-2.5 text-xs font-mono text-[#F2F6EB]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRestoreFromCode}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#CEFA42] px-4 text-xs font-bold text-[#111310]"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Відновити</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(false)}
                    className="min-h-[40px] rounded-xl border border-white/10 px-3 text-xs text-[#9FA995]"
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            )}

            {!isInstalled && (
              <button
                type="button"
                onClick={onOpenInstall}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#CEFA42]/40 bg-[#222B18] px-4 text-xs font-bold text-[#CEFA42]"
              >
                <Smartphone className="w-4 h-4" />
                <span>Встановити FORGE / 8 на екран пристрою</span>
              </button>
            )}

            <div className="pt-2 border-t border-white/10">
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[40px] text-xs font-semibold text-[#F2A98C] hover:underline"
                >
                  Скинути всі дані й почати з нуля
                </button>
              ) : (
                <div className="rounded-xl border border-[#F2A98C]/40 bg-[#231915] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs text-[#F2F6EB]">
                    Видалити весь журнал і прогрес? Дія незворотна.
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onResetAll();
                      }}
                      className="min-h-[36px] rounded-lg bg-[#F2A98C] px-3 text-xs font-bold text-[#111310]"
                    >
                      Скинути
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[36px] rounded-lg border border-white/15 px-3 text-xs text-[#DCE3D3]"
                    >
                      Скасувати
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
