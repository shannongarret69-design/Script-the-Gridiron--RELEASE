/**
 * Firestore Quota Circuit Breaker & Manager
 * Prevents repetitive retry loops and backend spam when Google Cloud Firestore daily quotas are exhausted.
 */

const QUOTA_STORAGE_KEY = 'gridiron_firestore_quota_exceeded';
const QUOTA_TIME_KEY = 'gridiron_firestore_quota_timestamp';

type QuotaListener = (exceeded: boolean) => void;
const listeners = new Set<QuotaListener>();

let networkDisconnector: (() => void) | null = null;
let networkReconnector: (() => void) | null = null;

export function registerNetworkDisconnector(disconnector: () => void, reconnector?: () => void): void {
  networkDisconnector = disconnector;
  if (reconnector) networkReconnector = reconnector;
  // If quota is already marked as exceeded, immediately disconnect
  if (isFirestoreQuotaExceeded()) {
    try {
      disconnector();
    } catch {
      // ignore
    }
  }
}

export function isFirestoreQuotaExceeded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY) || sessionStorage.getItem(QUOTA_STORAGE_KEY);
    if (val === 'true') {
      const timeStr = localStorage.getItem(QUOTA_TIME_KEY) || sessionStorage.getItem(QUOTA_TIME_KEY);
      if (timeStr) {
        const time = parseInt(timeStr, 10);
        // Free quota resets daily at midnight Pacific Time (~08:00 UTC).
        // If set within the last 20 hours, retain the circuit breaker.
        if (!isNaN(time) && Date.now() - time < 20 * 60 * 60 * 1000) {
          return true;
        } else {
          resetFirestoreQuotaCircuitBreaker();
          return false;
        }
      }
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function markFirestoreQuotaExceeded(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, 'true');
    localStorage.setItem(QUOTA_TIME_KEY, String(now));
    sessionStorage.setItem(QUOTA_STORAGE_KEY, 'true');
    sessionStorage.setItem(QUOTA_TIME_KEY, String(now));
  } catch {
    // ignore
  }

  // Disconnect network immediately to prevent Firestore SDK background retry loops
  if (networkDisconnector) {
    try {
      networkDisconnector();
    } catch {
      // ignore
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(true);
    } catch (e) {
      console.error('Error notifying quota listener:', e);
    }
  });
}

export function resetFirestoreQuotaCircuitBreaker(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    localStorage.removeItem(QUOTA_TIME_KEY);
    sessionStorage.removeItem(QUOTA_STORAGE_KEY);
    sessionStorage.removeItem(QUOTA_TIME_KEY);
  } catch {
    // ignore
  }

  if (networkReconnector) {
    try {
      networkReconnector();
    } catch {
      // ignore
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(false);
    } catch (e) {
      console.error('Error notifying quota listener:', e);
    }
  });
}

export function subscribeToQuotaStatus(listener: QuotaListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as any)?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    code === 'resource-exhausted' ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('resource-exhausted')
  );
}

