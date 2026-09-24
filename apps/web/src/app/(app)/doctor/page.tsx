'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, dueIn } from '@/lib/format';
import { session } from '@/lib/session';
import type { Paginated, ReferralListItem } from '@/lib/types';
import { PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Stat, cx } from '@/components/ui';

export default function DoctorPage() {
  const [view, setView] = useState<'active' | 'all'>('active');
  const { data, error, loading, reload } = useResource<Paginated<ReferralListItem>>(`/referrals?view=${view}&pageSize=100`);
  const items = data?.items ?? [];
  const overdue = items.filter((r) => r.status === 'OVERDUE').length;
  const newOnes = items.filter((r) => !r.acceptedAt && r.status !== 'COMPLETED').length;
  const highRisk = items.filter((r) => r.patient.riskLevel === 'HIGH' && r.status !== 'COMPLETED').length;

  return (
    <>
      <PageHeader title="Follow-up referrals" subtitle={`Discharged patients assigned to ${session.user?.fullName ?? 'you'}, most urgent first.`} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="New referrals" value={newOnes} tone={newOnes ? 'brand' : 'slate'} />
        <Stat label="Overdue" value={overdue} tone={overdue ? 'red' : 'slate'} />
        <Stat label="High risk" value={highRisk} tone={highRisk ? 'red' : 'slate'} />
      </div>
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm" role="tablist">
        {(['active', 'all'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('rounded-md px-3 py-1.5 font-medium', view === v ? 'bg-brand-600 text-white' : 'text-slate-600')}>
            {v === 'active' ? 'Active' : 'All'}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="No referrals">New discharge referrals will appear here automatically.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const due = dueIn(r.deadline);
            const fu = r.followUps[0];
            return (
              <li key={r.id}>
                <Link href={`/referrals/${r.id}`} className={cx('block rounded-xl border bg-white p-4 shadow-sm hover:border-brand-200', r.status === 'OVERDUE' ? 'border-red-300' : 'border-slate-200')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {r.patient.fullName} <span className="font-normal text-slate-500">· {age(r.patient.birthDate)} y · {r.patient.district}</span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">{r.reason}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!r.acceptedAt && r.status !== 'COMPLETED' && <Badge tone="brand">New</Badge>}
                      <PriorityBadge priority={r.priority} />
                      <RiskBadge level={r.patient.riskLevel} />
                      <ReferralStatusBadge status={r.status} />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    From {r.fromFacility.name} ·{' '}
                    {r.status === 'COMPLETED' ? 'completed' : <span className={due.overdue ? 'font-semibold text-red-600' : ''}>{due.text}</span>}
                    {fu && ` · Nurse: ${fu.assignedNurse?.fullName ?? '—'}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
