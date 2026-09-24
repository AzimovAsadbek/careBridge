import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'rejected' | 'synced';

/** One local mutation waiting to reach the server (the offline "outbox"). */
export interface OutboxOp {
  localOperationId: string;
  entityType: 'observation' | 'followUp';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE';
  payload: Record<string, unknown>;
  createdAt: string;
  syncStatus: SyncStatus;
  retryCount: number;
  nextAttemptAt: number;
  lastError?: string;
  syncedAt?: number;
  /** Denormalised for the UI (e.g. showing pending vitals on a visit page). */
  meta?: { patientId?: string; followUpId?: string; label?: string };
}

/** Last successful GET response per key — lets screens render offline. */
export interface CacheEntry {
  key: string;
  data: unknown;
  updatedAt: number;
}

export class CareBridgeDB extends Dexie {
  outbox!: Table<OutboxOp, string>;
  cache!: Table<CacheEntry, string>;

  constructor(name = 'carebridge') {
    super(name);
    this.version(1).stores({
      outbox: 'localOperationId, syncStatus, createdAt, entityId',
      cache: 'key, updatedAt',
    });
  }
}

const g = globalThis as typeof globalThis & { __carebridgeDb?: CareBridgeDB };
export function getDb() {
  if (!g.__carebridgeDb) g.__carebridgeDb = new CareBridgeDB();
  return g.__carebridgeDb;
}

/** Wipe local data on sign-out so the next user on a shared device sees nothing. */
export async function clearLocalData() {
  const db = getDb();
  await db.cache.clear();
  // Unsynced work is kept on purpose — it must not be lost; it syncs on the next sign-in.
  await db.outbox.where('syncStatus').equals('synced').delete();
}
