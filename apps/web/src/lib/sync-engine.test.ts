import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CareBridgeDB } from './db';
import { backoffMs, SyncEngine, type SyncResult } from './sync-engine';

let n = 0;
const op = (over: Partial<Parameters<SyncEngine['enqueue']>[0]> = {}) => ({
  localOperationId: `op-${++n}`,
  entityType: 'observation' as const,
  entityId: `obs-${n}`,
  operationType: 'CREATE' as const,
  payload: { patientId: 'p1', spo2: 95 },
  createdAt: new Date(2026, 0, 1, 0, 0, n).toISOString(),
  ...over,
});

describe('SyncEngine', () => {
  let db: CareBridgeDB;
  let online: boolean;
  let clock: number;
  let send: ReturnType<typeof vi.fn>;
  let engine: SyncEngine;

  const applyAll = async (ops: { localOperationId: string }[]): Promise<SyncResult[]> =>
    ops.map((o) => ({ localOperationId: o.localOperationId, status: 'applied' }));

  beforeEach(async () => {
    db = new CareBridgeDB(`test-${Math.random()}`);
    online = false;
    clock = 1_000_000;
    send = vi.fn(applyAll);
    engine = new SyncEngine({ db, send, isOnline: () => online, now: () => clock });
  });

  it('keeps operations created offline in the local queue', async () => {
    await engine.enqueue(op());
    await engine.enqueue(op({ entityType: 'followUp', operationType: 'UPDATE', payload: { status: 'COMPLETED' } }));
    await engine.flush();
    expect(send).not.toHaveBeenCalled();
    expect(engine.getState().pending).toBe(2);
    expect(engine.getState().online).toBe(false);
  });

  it('syncs queued operations in creation order when the connection returns', async () => {
    const a = op();
    const b = op();
    await engine.enqueue(b);
    await engine.enqueue(a);
    online = true;
    engine.setOnline(true);
    await engine.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].map((o: { localOperationId: string }) => o.localOperationId)).toEqual([a, b].sort((x, y) => x.createdAt.localeCompare(y.createdAt)).map((o) => o.localOperationId));
    expect((await db.outbox.toArray()).every((o) => o.syncStatus === 'synced')).toBe(true);
    expect(engine.getState().pending).toBe(0);
    expect(engine.getState().lastSyncAt).toBe(clock);
  });

  it('retries with backoff after a network failure, then succeeds', async () => {
    online = true;
    send.mockRejectedValueOnce(new Error('network down'));
    await engine.enqueue(op());
    await engine.flush();
    let [stored] = await db.outbox.toArray();
    expect(stored.syncStatus).toBe('failed');
    expect(stored.retryCount).toBe(1);
    expect(stored.nextAttemptAt).toBe(clock + backoffMs(1));

    await engine.flush(); // not due yet
    expect(send).toHaveBeenCalledTimes(1);

    clock += backoffMs(1);
    await engine.flush();
    [stored] = await db.outbox.toArray();
    expect(stored.syncStatus).toBe('synced');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('marks server-rejected operations without blocking the rest', async () => {
    online = true;
    const bad = op();
    const good = op();
    send.mockImplementationOnce(async () => [
      { localOperationId: bad.localOperationId, status: 'rejected', error: 'spo2 must not be greater than 100' },
      { localOperationId: good.localOperationId, status: 'duplicate' },
    ]);
    await db.outbox.bulkPut([bad, good].map((o) => ({ ...o, syncStatus: 'pending' as const, retryCount: 0, nextAttemptAt: 0 })));
    await engine.flush();
    expect((await db.outbox.get(bad.localOperationId))?.syncStatus).toBe('rejected');
    expect((await db.outbox.get(good.localOperationId))?.syncStatus).toBe('synced');
    expect(engine.getState().rejected).toBe(1);
  });

  it('recovers operations stuck in "syncing" after a crash', async () => {
    await db.outbox.put({ ...op(), syncStatus: 'syncing', retryCount: 0, nextAttemptAt: 0 });
    await engine.recover();
    expect(engine.getState().pending).toBe(1);
    expect((await db.outbox.toArray())[0].syncStatus).toBe('pending');
  });

  it('treats an unreachable server as offline and recovers via ping', async () => {
    class NetErr extends Error {}
    let reachable = true;
    engine = new SyncEngine({
      db,
      send,
      isOnline: () => true, // browser claims online (weak rural signal / captive network)
      isNetworkError: (e) => e instanceof NetErr,
      ping: async () => reachable,
      now: () => clock,
    });
    send.mockRejectedValueOnce(new NetErr('unreachable')); // server drops right after the probe
    await engine.enqueue(op());
    await engine.flush();
    expect(engine.getState().online).toBe(false);
    expect(engine.getState().failed).toBe(1);

    reachable = false;
    await engine.flush(); // probe fails → stays queued, no send
    expect(send).toHaveBeenCalledTimes(1);
    expect(engine.getState().online).toBe(false);

    reachable = true;
    await engine.flush(); // probe ok → backoff skipped, op synced immediately
    expect(engine.getState().online).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect((await db.outbox.toArray())[0].syncStatus).toBe('synced');
  });

  it('shows offline even with an empty queue when the server is unreachable', async () => {
    engine = new SyncEngine({ db, send, isOnline: () => true, ping: async () => false, now: () => clock });
    expect(engine.getState().online).toBe(true);
    await engine.flush();
    expect(engine.getState().online).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('never loses queued data when every sync attempt fails', async () => {
    online = true;
    send.mockRejectedValue(new Error('server down'));
    await engine.enqueue(op());
    for (let i = 0; i < 5; i++) {
      clock += 10 * 60_000;
      await engine.flush();
    }
    const [stored] = await db.outbox.toArray();
    expect(stored.syncStatus).toBe('failed');
    expect(stored.retryCount).toBe(5); // enqueue's flush shares the first run
    expect(stored.payload).toEqual({ patientId: 'p1', spo2: 95 });
    expect(engine.getState().lastError).toBe('server down');
  });

  it('caps the backoff', () => {
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(3)).toBe(8_000);
    expect(backoffMs(50)).toBe(5 * 60_000);
  });
});
