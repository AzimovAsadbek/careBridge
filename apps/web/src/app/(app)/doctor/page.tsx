'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age } from '@/lib/format';
import type { Paginated, ReferralListItem } from '@/lib/types';
import { DeadlineChip, PriorityBadge, RiskBadge } from '@/components/badges';
import { Avatar, Card, EmptyState, ErrorState, Icon, Loading, PageHeader, cx } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';

type GroupKey = keyof Dict['doctor']['groups'];
type Group = { key: GroupKey; tone: 'red' | 'brand' | 'slate'; items: ReferralListItem[] };

function group(items: ReferralListItem[]): Group[] {
  const g: Group[] = [
    { key: 'overdue', tone: 'red', items: [] },
    { key: 'accept', tone: 'brand', items: [] },
    { key: 'assign', tone: 'brand', items: [] },
    { key: 'visit', tone: 'slate', items: [] },
    { key: 'done', tone: 'slate', items: [] },
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
  const { t } = useI18n();
  const d = t.doctor;
  const { data, error, loading, reload } = useResource<Paginated<ReferralListItem>>(`/referrals?view=${view}&pageSize=100`);
  const groups = group(data?.items ?? []);
  const actionable = groups.filter((g) => g.tone !== 'slate').reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        title={d.title}
        subtitle={data ? (actionable ? d.needAction(actionable) : d.nothing) : d.subtitleDefault}
        actions={
          <div role="group" aria-label={d.show} className="inline-flex rounded-[var(--radius-control)] bg-slate-100 p-0.5 text-sm">
            {(['active', 'all'] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cx('h-8 rounded-md px-3 font-medium transition-colors', view === v ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900')}
              >
                {v === 'active' ? d.active : d.all}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <Loading label={d.loading} />
      ) : groups.length === 0 ? (
        <EmptyState title={d.empty} icon="checkCircle">
          {d.emptyHint}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`}>
              <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h2 id={`g-${g.key}`} className="flex items-center gap-2 text-section font-semibold text-slate-900">
                  {g.tone === 'red' && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                  {d.groups[g.key].title}
                  <span className="rounded-full bg-slate-100 px-2 text-xs font-medium tabular-nums text-slate-600">{g.items.length}</span>
                </h2>
                <p className="text-meta text-slate-500">{d.groups[g.key].hint}</p>
              </div>
              <Card padded={false}>
                <ul className="divide-y divide-line-soft">
                  {g.items.map((r) => {
                    const fu = r.followUps[0];
                    return (
                      <li key={r.id}>
                        <Link href={`/referrals/${r.id}`} className="group flex gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:items-center sm:px-5">
                          <Avatar name={r.patient.fullName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <p className="font-medium text-slate-900">{r.patient.fullName}</p>
                              <span className="text-meta text-slate-500">
                                {t.common.years(age(r.patient.birthDate))} · {r.patient.district}
                              </span>
                            </div>
                            <p className="mt-0.5 line-clamp-1 text-sm text-slate-700">{r.reason}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                              <RiskBadge level={r.patient.riskLevel} />
                              <PriorityBadge priority={r.priority} />
                              {r.status === 'COMPLETED' ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                                  <Icon name="checkCircle" className="h-3.5 w-3.5" /> {d.completed}
                                </span>
                              ) : (
                                <DeadlineChip deadline={r.deadline} />
                              )}
                              {fu?.assignedNurse && <span className="text-xs text-slate-500">{t.referral.nurse(fu.assignedNurse.fullName)}</span>}
                            </div>
                          </div>
                          <span
                            className={cx(
                              'hidden h-8 shrink-0 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-medium transition-colors sm:inline-flex',
                              g.tone === 'red'
                                ? 'bg-red-600 text-white group-hover:bg-red-700'
                                : g.tone === 'brand'
                                  ? 'text-slate-800 ring-1 ring-inset ring-slate-300 group-hover:bg-white'
                                  : 'text-slate-500 group-hover:text-slate-900',
                            )}
                          >
                            {d.groups[g.key].action}
                          </span>
                          <Icon name="chevronRight" className="mt-2.5 h-4 w-4 shrink-0 text-slate-300 sm:hidden" />
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
