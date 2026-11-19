import {useCallback, useEffect, useRef, useState} from 'react';

export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  const pendingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  const release = useCallback(async () => {
    const lock = lockRef.current;
    lockRef.current = null;
    setActive(false);
    if (lock) {
      try {
        await lock.release();
      } catch {
        // ignore
      }
    }
  }, []);

  const request = useCallback(async () => {
    if (
      !enabled ||
      typeof document === 'undefined' ||
      document.visibilityState !== 'visible' ||
      !supported ||
      pendingRef.current ||
      (lockRef.current && !lockRef.current.released)
    ) {
      return;
    }
    pendingRef.current = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!enabled || document.visibilityState !== 'visible') {
        await sentinel.release();
        return;
      }
      lockRef.current = sentinel;
      setActive(true);
      setError(false);
      sentinel.addEventListener('release', () => {
        if (lockRef.current === sentinel) {
          lockRef.current = null;
          setActive(false);
        }
      });
    } catch {
      setError(true);
      setActive(false);
    } finally {
      pendingRef.current = false;
    }
  }, [enabled, supported]);

  useEffect(() => {
    if (enabled) {
      void request();
    } else {
      void release();
    }
  }, [enabled, request, release]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && enabled) {
        void request();
      } else if (document.visibilityState === 'hidden') {
        void release();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, request, release]);

  const statusText = !enabled
    ? 'Екран: автоблокування дозволене'
    : error
      ? 'Браузер не підтвердив утримання екрана'
      : !supported
        ? 'Екран: Wake Lock не підтримується цим браузером'
        : active
          ? 'Екран залишається активним'
          : 'Екран: очікуємо активації';

  return {active, supported, error, statusText, request, release};
}
