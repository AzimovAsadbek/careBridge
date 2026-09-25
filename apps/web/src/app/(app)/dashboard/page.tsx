'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { dueIn, humanize } from '@/lib/format';
import type { AiStatus, Dashboard } from '@/lib/types';
import { ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { AiDisclaimer, modelName } from '@/components/clinical';
import { Card, CardTitle, DescriptionList, ErrorState, Icon, Loading, PageHeader, cx, type IconName } from '@/components/ui';

function ActionTile({ label, value, hint, href, icon, alert }: { label: string; value: number; hint: string; href: string; icon: IconName; alert: boolean }) {
  const badge = (
    <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', alert ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
      <Icon name={alert ? icon : 'checkCircle'} className="h-5 w-5" />
    </span>
  );
  const number = <span className={cx('text-3xl font-semibold tabular-nums', alert ? 'text-red-700' : 'text-slate-900')}>{value}</span>;
  const text = (
    <>
      <span className="block text-sm font-medium text-slate-800">{label}</span>
      <span className="block text-xs text-slate-600">{alert ? hint : 'Nothing needs action'}</span>
    </>
  );
  return (
    <Link
      href={href}
      className={cx(
        'group block min-w-0 rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-slate-50',
        alert ? 'border-red-200' : 'border-line',
      )}
    >
      {/* Phones: one compact row per metric. */}
      <span className="flex items-center gap-3 sm:hidden">
        {badge}
        <span className="min-w-0 flex-1">{text}</span>
        {number}
        <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
      </span>
      {/* Larger screens: stacked tile. */}
      <span className="hidden sm:block">
        <span className="flex items-center justify-between">
          {badge}
          <Icon name="chevronRight" className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
        </span>
        <span className="mt-3 block">{number}</span>
        {text}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useResource<Dashboard>('/analytics/dashboard');
  const ai = useResource<AiStatus>('/ai/status');

  useEffect(() => {
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !data) return <Loading label="Loading overview…" />;
  if (!data) return null;
  const k = data.kpis;
  const s = data.feedbackSentiment;
  const fbTotal = s.POSITIVE + s.NEUTRAL + s.NEGATIVE;
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <>
      <PageHeader eyebrow={today} title="Care overview" subtitle="Hospital → family clinic → rural health post, in one view." />

      <section aria-labelledby="needs-action" className="mb-6">
        <h2 id="needs-action" className="sr-only">
          Needs action
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionTile label="Overdue follow-ups" value={k.overdueFollowUps} hint="Past deadline — escalate to the clinic" href="/doctor" icon="clock" alert={k.overdueFollowUps > 0} />
          <ActionTile label="High-risk patients" value={k.highRiskPatients} hint="Need physician review" href="/patients?risk=HIGH" icon="alert" alert={k.highRiskPatients > 0} />
          <ActionTile label="Urgent patient feedback" value={k.urgentFeedback} hint="Safety or corruption signals" href="/feedback" icon="shield" alert={k.urgentFeedback > 0} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardTitle description="Overdue, AI high-risk and high-priority follow-ups, most urgent first">Needs attention now</CardTitle>
          </div>
          {data.attention.length === 0 ? (
            <div className="flex items-center gap-3 px-5 pb-6 text-sm text-slate-600">
              <Icon name="checkCircle" className="h-5 w-5 text-emerald-600" /> All active follow-ups are on track.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-line">
              {data.attention.map((a) => {
                const due = dueIn(a.deadline);
                return (
                  <li key={a.id}>
                    <Link href={`/referrals/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                      <span className={cx('h-10 w-1 shrink-0 rounded-full', a.overdue || a.patient.riskLevel === 'HIGH' ? 'bg-red-500' : 'bg-amber-400')} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{a.patient.fullName}</p>
                          <RiskBadge level={a.patient.riskLevel} />
                          <ReferralStatusBadge status={a.status} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-600">{a.reasons.join(' · ')}</p>
                        <p className="text-xs text-slate-500">
                          {a.patient.district} · {a.assignedDoctor?.fullName ?? 'No doctor assigned'} ·{' '}
                          <span className={due.overdue ? 'font-semibold text-red-700' : ''}>{due.text}</span>
                        </p>
                      </div>
                      <span className="hidden text-sm font-semibold text-brand-700 sm:inline">Review</span>
                      <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle description="Average hand-offs completed, last 90 days">Care continuity</CardTitle>
          <p className={cx('text-4xl font-semibold tabular-nums', k.careContinuityRate >= 80 ? 'text-emerald-700' : k.careContinuityRate >= 50 ? 'text-amber-700' : 'text-red-700')}>
            {k.careContinuityRate}%
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Care continuity" aria-valuenow={k.careContinuityRate} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${k.careContinuityRate}%` }} />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <DescriptionList
              items={[
                { label: 'On-time completion', value: k.onTimeCompletionRate == null ? '—' : `${k.onTimeCompletionRate}%` },
                { label: 'Active referrals', value: k.activeReferrals },
                { label: 'Offline visits synced', value: k.offlineSyncedVisits },
                { label: 'Patients', value: k.totalPatients },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle
            description={
              ai.data
                ? ai.data.enabled
                  ? `${modelName(ai.data.model)}${ai.data.fallbackModels.length ? ` · fallback ${ai.data.fallbackModels.map(modelName).join(', ')}` : ''} + deterministic safety rules`
                  : 'Deterministic rule engine (AI not configured)'
                : 'Operational insights'
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Icon name="sparkle" className="h-4 w-4 text-brand-600" /> AI care coordinator
            </span>
          </CardTitle>
          <ul className="space-y-2.5">
            {data.insights.map((i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-800">
                <Icon name="chevronRight" className="mt-0.5 h-4 w-4 text-brand-600" />
                {i}
              </li>
            ))}
          </ul>
          <AiDisclaimer className="mt-4 border-t border-line pt-3" />
        </Card>

        <Card>
          <CardTitle
            description={`${k.feedbackCount} anonymous submissions via QR`}
            action={
              <Link href="/feedback" className="text-sm font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            }
          >
            Patient voice
          </CardTitle>
          {fbTotal === 0 ? (
            <p className="text-sm text-slate-600">No analysed feedback yet.</p>
          ) : (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Positive ${s.POSITIVE}, neutral ${s.NEUTRAL}, negative ${s.NEGATIVE}`}>
                <div className="bg-emerald-600" style={{ width: `${(s.POSITIVE / fbTotal) * 100}%` }} />
                <div className="bg-slate-300" style={{ width: `${(s.NEUTRAL / fbTotal) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(s.NEGATIVE / fbTotal) * 100}%` }} />
              </div>
              <dl className="mt-2 flex gap-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
                  <dt className="text-slate-600">Positive</dt>
                  <dd className="font-semibold tabular-nums">{s.POSITIVE}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden />
                  <dt className="text-slate-600">Neutral</dt>
                  <dd className="font-semibold tabular-nums">{s.NEUTRAL}</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                  <dt className="text-slate-600">Negative</dt>
                  <dd className="font-semibold tabular-nums">{s.NEGATIVE}</dd>
                </div>
              </dl>
              {data.feedbackTopics.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-600">Most mentioned topics</h3>
                  <ul className="space-y-2">
                    {data.feedbackTopics.map((t) => {
                      const max = data.feedbackTopics[0].count;
                      return (
                        <li key={t.topic} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-3 text-sm">
                          <span className="truncate text-slate-800">{humanize(t.topic)}</span>
                          <span className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                            <span className="block h-full rounded-full bg-slate-400" style={{ width: `${(t.count / max) * 100}%` }} />
                          </span>
                          <span className="text-right tabular-nums text-slate-600">{t.count}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
