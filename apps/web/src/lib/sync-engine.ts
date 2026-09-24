import type { CareBridgeDB, OutboxOp } from './db';

export interface SyncResult {
  localOperationId: string;
  status: 'applied' | 'duplicate' | 'rejected' | 'error';
  error?: string;
  serverId?: string;
}

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  rejected: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

export interface SyncDeps {
  db: CareBridgeDB;
  send: (ops: Omit<OutboxOp, 'syncStatus' | 'retryCount' | 'nextAttemptAt' | 'lastError' | 'syncedAt' | 'meta'>[]) => Promise<SyncResult[]>;
  isOnline: () => boolean;
  /** Cheap reachability check; used to detect recovery when the browser claims to be online but the server is unreachable. */
  ping?: () => Promise<boolean>;
  /** Errors of this kind mean "never reached the server" (as opposed to a server-side failure). */
  isNetworkError?: (e: unknown) => boolean;
  now?: () => number;
}

const BATCH_SIZE = 50;
const MAX_BACKOFF_MS = 5 * 60_000;
export const backoffMs = (retry: number) => Math.min(MAX_BACKOFF_MS, 2_000 * 2 ** Math.max(0, retry - 1));

/**
 * Outbox-based sync engine. Every offline mutation is queued in IndexedDB and pushed
 * in order via POST /sync/batch. The server is idempotent, so retries are always safe.
 */
export class SyncEngine {
  private state: SyncState;
  private listeners = new Set<() => void>();
  private running: Promise<void> | null = null;

  constructor(private readonly deps: SyncDeps) {
    this.state = { online: deps.isOnline(), syncing: false, pending: 0, failed: 0, rejected: 0, lastSyncAt: null, lastError: null };
  }

  private now() {
    return this.deps.now?.() ?? Date.now();
  }

  getState = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async refreshCounts() {
    const { outbox } = this.deps.db;
    const [pending, failed, rejected] = await Promise.all([
      outbox.where('syncStatus').anyOf('pending', 'syncing').count(),
      outbox.where('syncStatus').equals('failed').count(),
      outbox.where('syncStatus').equals('rejected').count(),
    ]);
    this.set({ pending, failed, rejected });
  }

  /** Recover ops left in 'syncing' when the tab closed mid-request. */
  async recover() {
    await this.deps.db.outbox.where('syncStatus').equals('syncing').modify({ syncStatus: 'pending' });
    await this.refreshCounts();
  }

  async enqueue(op: Omit<OutboxOp, 'syncStatus' | 'retryCount' | 'nextAttemptAt'>) {
    await this.deps.db.outbox.put({ ...op, syncStatus: 'pending', retryCount: 0, nextAttemptAt: 0 });
    await this.refreshCounts();
    void this.flush();
  }

  setOnline(online: boolean) {
    this.set({ online });
    if (online) void this.retryNow();
  }

  /** Push due ops. Concurrent calls share one run. */
  flush(): Promise<void> {
    if (!this.running) {
      this.running = this.run().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async run() {
    if (!this.deps.isOnline()) {
      this.set({ online: false });
      return;
    }
    const { outbox } = this.deps.db;
    if (this.deps.ping) {
      // Probe on every flush — also when nothing is queued — so the UI never shows
      // "online / synced" while the server is actually unreachable (weak rural signal).
      const reachable = await this.deps.ping().catch(() => false);
      if (!reachable) {
        this.set({ online: false });
        return;
      }
      if (!this.state.online) {
        this.set({ online: true });
        // Connectivity is back: everything queued is due now, not after its backoff.
        await outbox.where('syncStatus').equals('failed').modify({ nextAttemptAt: 0 });
      }
    }
    const now = this.now();
    const due = (await outbox.where('syncStatus').anyOf('pending', 'failed').sortBy('createdAt'))
      .filter((op) => op.nextAttemptAt <= now)
      .slice(0, BATCH_SIZE);
    if (due.length === 0) return;

    this.set({ syncing: true, online: true });
    await outbox.bulkUpdate(due.map((op) => ({ key: op.localOperationId, changes: { syncStatus: 'syncing' as const } })));

    try {
      const results = await this.deps.send(
        due.map(({ localOperationId, entityType, entityId, operationType, payload, createdAt }) => ({
          localOperationId,
          entityType,
          entityId,
          operationType,
          payload,
          createdAt,
        })),
      );
      const byId = new Map(results.map((r) => [r.localOperationId, r]));
      await this.deps.db.transaction('rw', outbox, async () => {
        for (const op of due) {
          const r = byId.get(op.localOperationId);
          if (r && (r.status === 'applied' || r.status === 'duplicate')) {
            await outbox.update(op.localOperationId, { syncStatus: 'synced', syncedAt: this.now(), lastError: undefined });
          } else if (r?.status === 'rejected') {
            await outbox.update(op.localOperationId, { syncStatus: 'rejected', lastError: r.error });
          } else {
            const retryCount = op.retryCount + 1;
            await outbox.update(op.localOperationId, {
              syncStatus: 'failed',
              retryCount,
              nextAttemptAt: this.now() + backoffMs(retryCount),
              lastError: r?.error ?? 'No result from server',
            });
          }
        }
      });
      this.set({ lastSyncAt: this.now(), lastError: null });
    } catch (e) {
      // Whole request failed (network drop, 5xx, auth): back off and retry later.
      await this.deps.db.transaction('rw', outbox, async () => {
        for (const op of due) {
          const retryCount = op.retryCount + 1;
          await outbox.update(op.localOperationId, {
            syncStatus: 'failed',
            retryCount,
            nextAttemptAt: this.now() + backoffMs(retryCount),
            lastError: e instanceof Error ? e.message : String(e),
          });
        }
      });
      const unreachable = this.deps.isNetworkError?.(e) ?? false;
      this.set({ lastError: e instanceof Error ? e.message : String(e), ...(unreachable ? { online: false } : {}) });
    } finally {
      this.set({ syncing: false });
      await this.refreshCounts();
    }

    // More queued than one batch → continue.
    const remaining = await outbox.where('syncStatus').equals('pending').count();
    if (remaining > 0 && this.deps.isOnline() && this.state.online) await this.run();
  }

  /** Make every failed op due immediately (user pressed "Sync now"). */
  async retryNow() {
    await this.deps.db.outbox.where('syncStatus').equals('failed').modify({ nextAttemptAt: 0 });
    return this.flush();
  }

  async discard(localOperationId: string) {
    await this.deps.db.outbox.delete(localOperationId);
    await this.refreshCounts();
  }
}
