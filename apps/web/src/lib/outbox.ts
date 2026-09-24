'use client';

import { useEffect, useState } from 'react';
import { getDb, type OutboxOp } from './db';
import { getSyncEngine } from './sync';
import { uuid } from './format';

/** Live view of outbox ops (re-queried whenever the sync engine state changes). */
export function useOutbox(filter: (op: OutboxOp) => boolean, deps: unknown[] = []) {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  useEffect(() => {
    let active = true;
    const load = () =>
      getDb()
        .outbox.orderBy('createdAt')
        .filter(filter)
        .toArray()
        .then((rows) => active && setOps(rows))
        .catch(() => undefined);
    void load();
    const unsub = getSyncEngine().subscribe(load);
    return () => {
      active = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ops;
}

export function queueObservation(patientId: string, followUpId: string, vitals: Record<string, unknown>) {
  const clientId = uuid();
  return getSyncEngine().enqueue({
    localOperationId: uuid(),
    entityType: 'observation',
    entityId: clientId,
    operationType: 'CREATE',
    payload: { patientId, followUpId, ...vitals },
    createdAt: new Date().toISOString(),
    meta: { patientId, followUpId, label: 'Vital signs' },
  });
}

export function queueFollowUpStatus(
  followUpId: string,
  patientId: string,
  payload: { status: 'IN_PROGRESS' | 'COMPLETED'; outcome?: string; patientStatus?: 'STABLE' | 'IN_FOLLOW_UP' },
) {
  return getSyncEngine().enqueue({
    localOperationId: uuid(),
    entityType: 'followUp',
    entityId: followUpId,
    operationType: 'UPDATE',
    payload,
    createdAt: new Date().toISOString(),
    meta: { patientId, followUpId, label: payload.status === 'COMPLETED' ? 'Visit completed' : 'Visit started' },
  });
}
