import type {ForgeState, WorkoutLog} from '../types/forge';

export interface SyncResponse {
  ok: boolean;
  status?: string;
  count?: number;
  error?: string;
  workouts?: WorkoutLog[];
}

/**
 * Відправляє одне тренування або весь журнал на Google Диск через Google Apps Script Web App.
 * Тіло запиту передається як text/plain, щоб уникнути блокування CORS preflight в Google Apps Script.
 */
export async function uploadToGoogleDrive(
  url: string,
  secret: string | undefined,
  payload: {
    log?: WorkoutLog;
    logs?: WorkoutLog[];
    state?: Partial<ForgeState>;
  },
): Promise<SyncResponse> {
  if (!url || !url.trim()) {
    return {ok: false, error: 'URL Google Apps Script не вказано'};
  }
  const cleanUrl = url.trim();
  try {
    const body = JSON.stringify({
      action: 'save',
      secret: secret?.trim() || '',
      ...payload,
      timestamp: Date.now(),
    });

    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body,
    });

    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}: ${res.statusText}`};
    }

    const data = await res.json().catch(() => null);
    if (data && data.error) {
      return {ok: false, error: data.error};
    }
    return {ok: true, status: data?.status || 'ok', count: data?.count};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {ok: false, error: msg};
  }
}

/**
 * Перевіряє зв'язок із веб-програмою Google Apps Script.
 */
export async function testGoogleDriveConnection(
  url: string,
  secret?: string,
): Promise<SyncResponse> {
  if (!url || !url.trim()) {
    return {ok: false, error: 'URL Google Apps Script не вказано'};
  }
  const cleanUrl = url.trim();
  try {
    const u = new URL(cleanUrl);
    u.searchParams.set('action', 'ping');
    if (secret?.trim()) {
      u.searchParams.set('secret', secret.trim());
    }

    const res = await fetch(u.toString(), {
      method: 'GET',
    });

    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}: ${res.statusText}`};
    }

    const data = await res.json().catch(() => null);
    if (data && data.error) {
      return {ok: false, error: data.error};
    }
    return {ok: true, status: data?.status || 'ok', count: data?.count};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {ok: false, error: msg};
  }
}

/**
 * Отримує всі збережені тренування з Google Диска.
 */
export async function fetchGoogleDriveWorkouts(
  url: string,
  secret?: string,
): Promise<{ok: boolean; workouts?: WorkoutLog[]; error?: string}> {
  if (!url || !url.trim()) {
    return {ok: false, error: 'URL Google Apps Script не вказано'};
  }
  const cleanUrl = url.trim();
  try {
    const u = new URL(cleanUrl);
    u.searchParams.set('action', 'get');
    if (secret?.trim()) {
      u.searchParams.set('secret', secret.trim());
    }

    const res = await fetch(u.toString(), {
      method: 'GET',
    });

    if (!res.ok) {
      return {ok: false, error: `HTTP ${res.status}: ${res.statusText}`};
    }

    const data = await res.json().catch(() => null);
    if (Array.isArray(data)) {
      return {ok: true, workouts: data};
    }
    if (data && Array.isArray(data.workouts)) {
      return {ok: true, workouts: data.workouts};
    }
    if (data && data.error) {
      return {ok: false, error: data.error};
    }
    return {ok: true, workouts: []};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {ok: false, error: msg};
  }
}
