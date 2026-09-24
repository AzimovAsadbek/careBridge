'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { dueIn, humanize } from '@/lib/format';
import type { Dashboard } from '@/lib/types';
import { PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { AiDisclaimer } from '@/components/clinical';
import { Card, CardTitle, ErrorState, Loading, PageHeader, Stat, cx } from '@/components/ui';

export default function DashboardPage() {
  const { data, error, loading, reload } = useResource<Dashboard>('/analytics/dashboard');

  useEffect(() => {
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const k = data.kpis;
  const fbTotal = data.feedbackSentiment.POSITIVE + data.feedbackSentiment.NEUTRAL + data.feedbackSentiment.NEGATIVE;

  return (
    <>
      <PageHeader title="Command center" subtitle="Continuity of care across hospital, family clinics and rural health posts." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Care continuity" value={`${k.careContinuityRate}%`} hint="avg. over referrals, last 90 days" tone={k.careContinuityRate >= 80 ? 'green' : k.careContinuityRate >= 50 ? 'amber' : 'red'} />
        <Stat label="Active referrals" value={k.activeReferrals} hint={`${k.totalPatients} patients total`} tone="brand" href="/doctor" />
        <Stat label="Overdue follow-ups" value={k.overdueFollowUps} hint="escalated" tone={k.overdueFollowUps ? 'red' : 'slate'} />
        <Stat label="High-risk patients" value={k.highRiskPatients} hint="AI risk prioritization" tone={k.highRiskPatients ? 'red' : 'slate'} href="/patients" />
        <Stat label="On-time completion" value={k.onTimeCompletionRate == null ? '—' : `${k.onTimeCompletionRate}%`} hint="follow-ups within deadline" />
        <Stat label="Offline visits synced" value={k.offlineSyncedVisits} hint="captured without internet" tone="brand" />
        <Stat label="Patient feedback" value={k.feedbackCount} hint="anonymous, via QR" href="/feedback" />
        <Stat label="Urgent feedback" value={k.urgentFeedback} hint="safety / corruption flags" tone={k.urgentFeedback ? 'red' : 'slate'} href="/feedback" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Needs attention now</CardTitle>
          {data.attention.length === 0 ? (
            <p className="text-sm text-slate-500">No overdue or high-risk follow-ups.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.attention.map((a) => (
                <li key={a.id} className="py-3">
                  <Link href={`/referrals/${a.id}`} className="flex flex-wrap items-center justify-between gap-2 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{a.patient.fullName}</p>
                      <p className="text-xs text-slate-500">
                        {a.patient.district} · {a.assignedDoctor?.fullName ?? 'unassigned'} ·{' '}
                        <span className={a.overdue ? 'font-semibold text-red-600' : ''}>{dueIn(a.deadline).text}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">{a.reasons.join(' · ')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <RiskBadge level={a.patient.riskLevel} />
                      <PriorityBadge priority={a.priority} />
                      <ReferralStatusBadge status={a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>AI care coordinator</CardTitle>
            <ul className="space-y-2">
              {data.insights.map((i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-800">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  {i}
                </li>
              ))}
            </ul>
            <AiDisclaimer className="mt-3" />
          </Card>

          <Card>
            <CardTitle action={<Link href="/feedback" className="text-xs font-semibold text-brand-700">Details →</Link>}>Patient voice</CardTitle>
            {fbTotal === 0 ? (
              <p className="text-sm text-slate-500">No analysed feedback yet.</p>
            ) : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={`Positive ${data.feedbackSentiment.POSITIVE}, neutral ${data.feedbackSentiment.NEUTRAL}, negative ${data.feedbackSentiment.NEGATIVE}`}>
                  {(['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const).map((s) => (
                    <div key={s} className={cx(s === 'POSITIVE' ? 'bg-emerald-500' : s === 'NEUTRAL' ? 'bg-slate-300' : 'bg-red-500')} style={{ width: `${(data.feedbackSentiment[s] / fbTotal) * 100}%` }} />
                  ))}
                </div>
                <dl className="mt-2 grid grid-cols-3 text-center text-xs">
                  <div><dt className="text-slate-500">Positive</dt><dd className="font-semibold text-emerald-700">{data.feedbackSentiment.POSITIVE}</dd></div>
                  <div><dt className="text-slate-500">Neutral</dt><dd className="font-semibold text-slate-700">{data.feedbackSentiment.NEUTRAL}</dd></div>
                  <div><dt className="text-slate-500">Negative</dt><dd className="font-semibold text-red-700">{data.feedbackSentiment.NEGATIVE}</dd></div>
                </dl>
                {data.feedbackTopics.length > 0 && (
                  <>
                    <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Top topics</p>
                    <ul className="space-y-1">
                      {data.feedbackTopics.map((t) => (
                        <li key={t.topic} className="flex justify-between text-sm"><span>{humanize(t.topic)}</span><span className="tabular-nums text-slate-500">{t.count}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
