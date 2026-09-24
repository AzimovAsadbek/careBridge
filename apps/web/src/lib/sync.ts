'use client';

import { useSyncExternalStore } from 'react';
import { api, API_URL, NetworkError } from './api';
import { getDb } from './db';
import { SyncEngine, type SyncResult, type SyncState } from './sync-engine';

// Pinned to globalThis: Next may bundle this module into several chunks, and a second
// engine instance would race the first one over the same IndexedDB outbox.
const g = globalThis as typeof globalThis & { __carebridgeSync?: SyncEngine; __carebridgeSyncStarted?: boolean };

export function getSyncEngine() {
  if (!g.__carebridgeSync) {
    g.__carebridgeSync = new SyncEngine({
      db: getDb(),
      isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
      isNetworkError: (e) => e instanceof NetworkError,
      ping: async () => {
        try {
          return (await fetch(`${API_URL}/health`, { cache: 'no-store' })).ok;
        } catch {
          return false;
        }
      },
      send: async (operations) => (await api<{ results: SyncResult[] }>('/sync/batch', { method: 'POST', body: { operations } })).results,
    });
  }
  return g.__carebridgeSync;
}

/** Wire browser connectivity events + periodic retry. Idempotent. */
export function startSync() {
  if (g.__carebridgeSyncStarted || typeof window === 'undefined') return;
  g.__carebridgeSyncStarted = true;
  const e = getSyncEngine();
  // Fresh app start: anything queued is due now, regardless of earlier backoff.
  void e.recover().then(() => e.retryNow());
  window.addEventListener('online', () => e.setOnline(true));
  window.addEventListener('offline', () => e.setOnline(false));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void e.flush();
  });
  setInterval(() => void e.flush(), 15_000);
}

const serverSnapshot: SyncState = { online: true, syncing: false, pending: 0, failed: 0, rejected: 0, lastSyncAt: null, lastError: null };

export function useSyncState(): SyncState {
  const e = getSyncEngine();
  return useSyncExternalStore(e.subscribe, e.getState, () => serverSnapshot);
}
