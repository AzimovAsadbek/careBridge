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
import { Badge, EmptyState, ErrorState, Icon, Loading, PageHeader, cx } from '@/components/ui';
import { SyncBanner } from '@/components/SyncIndicator';

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
      <PageHeader
        title="Home visits"
        subtitle={data ? `${data.length} visit${data.length === 1 ? '' : 's'} assigned to you · works without internet` : 'Works without internet'}
      />
      <div className="mb-4">
        <SyncBanner savedAt={stale ? fmtDateTime(cachedAt) : null} />
      </div>
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label="Loading visits…" />
      ) : !data?.length ? (
        <EmptyState title="No visits assigned" icon="checkCircle">
          When a doctor assigns you a home visit it appears here — open it once while online to use it offline.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((v) => {
            const due = dueIn(v.referral.deadline);
            const pending = local.filter((op) => op.meta?.followUpId === v.id).length;
            return (
              <li key={v.id}>
                <Link
                  href={`/nurse/visit?id=${v.id}`}
                  className={cx(
                    'block rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-card)] hover:bg-slate-50 active:bg-slate-100',
                    due.overdue ? 'border-red-300' : 'border-line',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">{v.patient.fullName}</p>
                      <p className="text-sm text-slate-600">
                        {age(v.patient.birthDate)} y · {v.patient.address}
                      </p>
                    </div>
                    <FollowUpStatusBadge status={v.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{v.referral.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RiskBadge level={v.patient.riskLevel} />
                    <PriorityBadge priority={v.referral.priority} />
                    {pending > 0 && (
                      <Badge tone="amber">
                        <Icon name="device" className="h-3 w-3" /> {pending} on device
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className={cx('text-sm', due.overdue ? 'font-semibold text-red-700' : 'text-slate-600')}>
                      <Icon name="clock" className="mr-1 inline h-4 w-4 align-[-3px]" />
                      {due.text}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                      {v.status === 'SCHEDULED' ? 'Start visit' : 'Continue'} <Icon name="chevronRight" className="h-4 w-4" />
                    </span>
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
