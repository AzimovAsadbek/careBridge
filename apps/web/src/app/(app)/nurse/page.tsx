'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, dueIn, fmtDateTime } from '@/lib/format';
import { useOutbox } from '@/lib/outbox';
import { useSyncState } from '@/lib/sync';
import type { NurseVisit } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { DeadlineChip, FollowUpStatusBadge, PriorityBadge, RiskBadge } from '@/components/badges';
import { Avatar, Badge, ButtonLink, EmptyState, ErrorState, Icon, Loading, PageHeader } from '@/components/ui';
import { SyncBanner } from '@/components/SyncIndicator';

export default function NursePage() {
  const { data, error, loading, stale, cachedAt, reload } = useResource<NurseVisit[]>('/follow-ups/mine', { offline: true });
  const sync = useSyncState();
  const local = useOutbox((op) => op.syncStatus !== 'synced');
  const { t } = useI18n();

  // Refresh the worklist after a successful sync.
  useEffect(() => {
    if (sync.online && sync.lastSyncAt) void reload();
  }, [sync.online, sync.lastSyncAt, reload]);

  return (
    <>
      <PageHeader
        title={t.nurse.title}
        subtitle={data ? t.nurse.subtitle(data.length) : t.nurse.subtitleDefault}
      />
      <div className="mb-6">
        <SyncBanner savedAt={stale ? fmtDateTime(cachedAt) : null} />
      </div>
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label={t.nurse.loading} />
      ) : !data?.length ? (
        <EmptyState title={t.nurse.empty} icon="checkCircle">
          {t.nurse.emptyHint}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((v) => {
            const due = dueIn(v.referral.deadline);
            const pending = local.filter((op) => op.meta?.followUpId === v.id).length;
            return (
              <li key={v.id} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]">
                <Link href={`/nurse/visit?id=${v.id}`} className="block p-4 transition-colors hover:bg-slate-50 active:bg-slate-100 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={v.patient.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-base font-semibold text-slate-900">{v.patient.fullName}</p>
                        <FollowUpStatusBadge status={v.status} />
                      </div>
                      <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-600">
                        <Icon name="mapPin" className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {t.common.years(age(v.patient.birthDate))} · {v.patient.address}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-800">{v.referral.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <RiskBadge level={v.patient.riskLevel} />
                    <PriorityBadge priority={v.referral.priority} />
                    <DeadlineChip deadline={v.referral.deadline} />
                    {pending > 0 && (
                      <Badge tone="amber">
                        <Icon name="device" className="h-3 w-3" /> {t.sync.onDevice(pending)}
                      </Badge>
                    )}
                  </div>
                </Link>
                <div className="border-t border-line-soft p-3 sm:px-5">
                  <ButtonLink
                    href={`/nurse/visit?id=${v.id}`}
                    size="lg"
                    variant={due.overdue || v.status === 'IN_PROGRESS' ? 'primary' : 'secondary'}
                    className="w-full sm:h-10 sm:w-auto sm:text-sm"
                  >
                    {v.status === 'SCHEDULED' ? t.nurse.start : t.nurse.continue} <Icon name="arrowRight" />
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
