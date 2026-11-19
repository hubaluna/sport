import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-16 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border border-[#F2A98C]/40 bg-[#231915]/95 px-3.5 py-2 text-xs font-medium text-[#F2A98C] shadow-lg backdrop-blur-md"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Офлайн-режим · дані зберігаються локально</span>
    </div>
  );
}

export function Toast({message}: {message: string | null}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,420px)] rounded-xl border border-[#CEFA42]/40 bg-[#1E2517]/95 px-4 py-3 text-center text-sm font-medium text-[#F2F6EB] shadow-xl backdrop-blur-md"
    >
      {message}
    </div>
  );
}
