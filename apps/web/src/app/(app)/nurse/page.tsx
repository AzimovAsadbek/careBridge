'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, dueIn, fmtDateTime } from '@/lib/format';
import { useOutbox } from '@/lib/outbox';
import { useSyncState } from '@/lib/sync';
import type { NurseVisit } from '@/lib/types';
import { FollowUpStatusBadge, PriorityBadge, RiskBadge } from '@/components/badges';
import { Alert, Badge, EmptyState, ErrorState, Loading, PageHeader, cx } from '@/components/ui';

export default function NursePage() {
  const { data, error, loading, stale, cachedAt, reload } = useResource<NurseVisit[]>('/follow-ups/mine', { offline: true });
  const sync = useSyncState();
  const local = useOutbox((op) => op.syncStatus !== 'synced');

  // Refresh the worklist after a successful sync.
  useEffect(() => {
    if (sync.online && sync.lastSyncAt) void reload();
  }, [sync.online, sync.lastSyncAt, reload]);

  return (
    <>
      <PageHeader title="My home visits" subtitle="Works without internet — everything you record is saved on this device first." />
      {stale && (
        <div className="mb-4">
          <Alert tone="amber" title="Offline mode">Showing the visit list saved on this device ({fmtDateTime(cachedAt)}).</Alert>
        </div>
      )}
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <EmptyState title="No visits assigned">When a doctor assigns you a home visit it appears here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((v) => {
            const due = dueIn(v.referral.deadline);
            const pending = local.filter((op) => op.meta?.followUpId === v.id).length;
            return (
              <li key={v.id}>
                <Link
                  href={`/nurse/visit?id=${v.id}`}
                  className={cx('block rounded-xl border bg-white p-4 shadow-sm active:bg-slate-50', due.overdue ? 'border-red-300' : 'border-slate-200')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">{v.patient.fullName}</p>
                      <p className="text-sm text-slate-500">
                        {age(v.patient.birthDate)} y · {v.patient.address}
                      </p>
                    </div>
                    <FollowUpStatusBadge status={v.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{v.referral.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={v.referral.priority} />
                    <RiskBadge level={v.patient.riskLevel} />
                    <span className={cx('text-xs', due.overdue ? 'font-semibold text-red-600' : 'text-slate-500')}>{due.text}</span>
                    {pending > 0 && <Badge tone="amber">{pending} unsynced</Badge>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
