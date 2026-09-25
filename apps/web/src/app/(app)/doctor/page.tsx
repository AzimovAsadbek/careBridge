'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, dueIn } from '@/lib/format';
import type { Paginated, ReferralListItem } from '@/lib/types';
import { PriorityBadge, RiskBadge } from '@/components/badges';
import { Card, EmptyState, ErrorState, Icon, Loading, PageHeader, cx } from '@/components/ui';

type Group = { key: string; title: string; hint: string; action: string; tone: 'red' | 'brand' | 'slate'; items: ReferralListItem[] };

function group(items: ReferralListItem[]): Group[] {
  const g: Group[] = [
    { key: 'overdue', title: 'Overdue', hint: 'Deadline passed without a home visit', action: 'Assign now', tone: 'red', items: [] },
    { key: 'accept', title: 'Needs your acceptance', hint: 'New discharges assigned to your clinic', action: 'Accept', tone: 'brand', items: [] },
    { key: 'assign', title: 'Assign a nurse', hint: 'Accepted — no home visit scheduled yet', action: 'Assign nurse', tone: 'brand', items: [] },
    { key: 'visit', title: 'Visit in progress', hint: 'Nurse assigned or visiting', action: 'View', tone: 'slate', items: [] },
    { key: 'done', title: 'Completed', hint: 'Follow-up closed', action: 'View', tone: 'slate', items: [] },
  ];
  for (const r of items) {
    const idx =
      r.status === 'OVERDUE' ? 0 : r.status === 'COMPLETED' ? 4 : !r.acceptedAt ? 1 : r.followUps.length === 0 ? 2 : 3;
    g[idx].items.push(r);
  }
  return g.filter((x) => x.items.length > 0);
}

export default function DoctorPage() {
  const [view, setView] = useState<'active' | 'all'>('active');
  const { data, error, loading, reload } = useResource<Paginated<ReferralListItem>>(`/referrals?view=${view}&pageSize=100`);
  const groups = group(data?.items ?? []);
  const actionable = groups.filter((g) => g.tone !== 'slate').reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        title="Follow-up referrals"
        subtitle={data ? (actionable ? `${actionable} referral${actionable > 1 ? 's' : ''} need your action` : 'Nothing needs your action right now') : 'Discharged patients assigned to your clinic'}
        actions={
          <div role="group" aria-label="Show" className="inline-flex rounded-[var(--radius-control)] border border-slate-300 bg-white p-0.5 text-sm">
            {(['active', 'all'] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cx('h-8 rounded-md px-3 font-medium', view === v ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-50')}
              >
                {v === 'active' ? 'Active' : 'All'}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label="Loading referrals…" />
      ) : groups.length === 0 ? (
        <EmptyState title="No referrals" icon="checkCircle">
          New discharge referrals for your clinic appear here automatically.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <div className="mb-2 flex items-baseline gap-2">
                <h2 id={`g-${g.key}`} className={cx('text-sm font-semibold', g.tone === 'red' ? 'text-red-700' : 'text-slate-900')}>
                  {g.title} <span className="font-normal text-slate-500">({g.items.length})</span>
                </h2>
                <p className="hidden text-xs text-slate-500 sm:block">{g.hint}</p>
              </div>
              <Card padded={false} className={cx(g.tone === 'red' && 'border-red-200')}>
                <ul className="divide-y divide-slate-100">
                  {g.items.map((r) => {
                    const due = dueIn(r.deadline);
                    const fu = r.followUps[0];
                    return (
                      <li key={r.id}>
                        <Link href={`/referrals/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{r.patient.fullName}</p>
                              <span className="text-sm text-slate-500">
                                {age(r.patient.birthDate)} y · {r.patient.district}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-slate-700">{r.reason}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <RiskBadge level={r.patient.riskLevel} />
                              <PriorityBadge priority={r.priority} />
                              <span className={cx('text-xs', due.overdue && r.status !== 'COMPLETED' ? 'font-semibold text-red-700' : 'text-slate-500')}>
                                {r.status === 'COMPLETED' ? 'Completed' : due.text}
                                {fu?.assignedNurse && ` · Nurse ${fu.assignedNurse.fullName}`}
                              </span>
                            </div>
                          </div>
                          <span
                            className={cx(
                              'hidden h-8 items-center rounded-[var(--radius-control)] px-3 text-xs font-semibold sm:inline-flex',
                              g.tone === 'red' ? 'bg-red-600 text-white' : g.tone === 'brand' ? 'bg-brand-600 text-white' : 'text-brand-700',
                            )}
                          >
                            {g.action}
                          </span>
                          <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
