/**
 * Honest processed-file metrics.
 *
 * Production uses the persistent /api/processed-count endpoint. Development and
 * unavailable-backend states use a clearly labelled, device-local count. There
 * is deliberately no synthetic baseline, timer, or estimated global activity.
 */

const LOCAL_COUNT_KEY = 'compactor_processed_on_device_v1';
const PENDING_EVENTS_KEY = 'compactor_pending_metric_events_v1';
const CONFIGURED_API_URL = (import.meta.env.VITE_PROCESSED_COUNT_API_URL || '').trim();
const API_PATH = CONFIGURED_API_URL || '/api/processed-count';

export type CounterScope = 'global' | 'device';

export interface ProcessedCountSnapshot {
  count: number;
  scope: CounterScope;
}

interface CounterApiResponse {
  count: number;
}

const hasPersistentCounter = (): boolean =>
  CONFIGURED_API_URL.length > 0 || (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  );

const readLocalCount = (): number => {
  try {
    const parsed = Number.parseInt(localStorage.getItem(LOCAL_COUNT_KEY) || '0', 10);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeLocalCount = (count: number): void => {
  try {
    localStorage.setItem(LOCAL_COUNT_KEY, Math.max(0, count).toString());
  } catch {
    // Metrics must never interrupt the actual file operation.
  }
};

const readPendingEvents = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string').slice(-100)
      : [];
  } catch {
    return [];
  }
};

const writePendingEvents = (events: string[]): void => {
  try {
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(events.slice(-100)));
  } catch {
    // Ignore storage quota/private mode failures.
  }
};

const createEventId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const requestCount = async (
  method: 'GET' | 'POST',
  eventIds?: string[]
): Promise<number> => {
  const response = await fetch(API_PATH, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify({ eventIds }) : undefined,
    credentials: CONFIGURED_API_URL ? 'omit' : 'same-origin',
  });
  if (!response.ok) throw new Error(`Counter API unavailable (${response.status})`);
  const data = await response.json() as CounterApiResponse;
  if (!Number.isSafeInteger(data.count) || data.count < 0) {
    throw new Error('Counter API returned an invalid value');
  }
  return data.count;
};

export async function getProcessedCount(): Promise<ProcessedCountSnapshot> {
  if (!hasPersistentCounter()) {
    return { count: readLocalCount(), scope: 'device' };
  }

  try {
    const pending = readPendingEvents();
    const count = pending.length > 0
      ? await requestCount('POST', pending)
      : await requestCount('GET');
    if (pending.length > 0) writePendingEvents([]);
    return { count, scope: 'global' };
  } catch {
    return { count: readLocalCount(), scope: 'device' };
  }
}

export async function recordProcessedFiles(amount: number = 1): Promise<ProcessedCountSnapshot> {
  const safeAmount = Math.min(25, Math.max(1, Math.floor(amount)));
  const localCount = readLocalCount() + safeAmount;
  writeLocalCount(localCount);

  if (!hasPersistentCounter()) {
    const snapshot = { count: localCount, scope: 'device' } as const;
    window.dispatchEvent(new CustomEvent('compactor:count-updated', { detail: snapshot }));
    return snapshot;
  }

  const pending = readPendingEvents();
  const newEvents = Array.from({ length: safeAmount }, createEventId);
  const queued = [...pending, ...newEvents].slice(-100);
  writePendingEvents(queued);

  try {
    const count = await requestCount('POST', queued);
    writePendingEvents([]);
    const snapshot = { count, scope: 'global' } as const;
    window.dispatchEvent(new CustomEvent('compactor:count-updated', { detail: snapshot }));
    return snapshot;
  } catch {
    const snapshot = { count: localCount, scope: 'device' } as const;
    window.dispatchEvent(new CustomEvent('compactor:count-updated', { detail: snapshot }));
    return snapshot;
  }
}
