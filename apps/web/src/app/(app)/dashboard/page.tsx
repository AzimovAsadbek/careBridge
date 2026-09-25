'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { fmtToday } from '@/lib/format';
import { session } from '@/lib/session';
import { useI18n } from '@/lib/i18n';
import type { AiStatus, Dashboard } from '@/lib/types';
import { DeadlineChip, RiskBadge } from '@/components/badges';
import { AiDisclaimer, modelName } from '@/components/clinical';
import { Avatar, Card, CardHeader, CardTitle, DescriptionList, ErrorState, Icon, Loading, Overline, PageHeader, cx, type IconName } from '@/components/ui';

/** One cell of the "needs action" strip. Calm at zero, red only when something is waiting. */
function ActionCell({ label, value, hint, href, icon }: { label: string; value: number; hint: string; href: string; icon: IconName }) {
  const { t } = useI18n();
  const alert = value > 0;
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:block sm:px-5 sm:py-4">
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:hidden', alert ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-400')}>
        <Icon name={alert ? icon : 'checkCircle'} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-meta text-slate-600">
          <Icon name={icon} className={cx('hidden h-3.5 w-3.5 sm:block', alert ? 'text-red-600' : 'text-slate-400')} />
          {label}
        </span>
        <span className={cx('block text-xs sm:hidden', alert ? 'text-slate-600' : 'text-slate-400')}>{alert ? hint : t.dashboard.nothingNeedsAction}</span>
      </span>
      <span className={cx('text-2xl font-semibold tabular-nums sm:mt-1 sm:block sm:text-[28px] sm:leading-9', alert ? 'text-red-700' : 'text-slate-300')}>{value}</span>
      <span className={cx('hidden text-xs sm:block', alert ? 'text-slate-600' : 'text-slate-400')}>{alert ? hint : t.dashboard.nothingNeedsAction}</span>
      <Icon name="chevronRight" className="h-4 w-4 text-slate-300 sm:hidden" />
    </Link>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useResource<Dashboard>('/analytics/dashboard');
  const ai = useResource<AiStatus>('/ai/status');
  const { t } = useI18n();
  const d = t.dashboard;

  useEffect(() => {
    const t = setInterval(() => void reload(), 30_000);
    return () => clearInterval(t);
  }, [reload]);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const k = data.kpis;
  const s = data.feedbackSentiment;
  const fbTotal = s.POSITIVE + s.NEUTRAL + s.NEGATIVE;
  const hour = new Date().getHours();
  const firstName = (session.user?.fullName ?? '').replace(/^Dr\.?\s+/i, '').split(/\s+/)[0] ?? '';
  const greeting = hour < 12 ? d.greeting.morning(firstName) : hour < 18 ? d.greeting.afternoon(firstName) : d.greeting.evening(firstName);
  const urgent = k.overdueFollowUps + k.highRiskPatients + k.urgentFeedback;
  const continuityTone = k.careContinuityRate >= 80 ? 'text-emerald-700' : k.careContinuityRate >= 50 ? 'text-amber-700' : 'text-red-700';
  const continuityBar = k.careContinuityRate >= 80 ? 'bg-emerald-500' : k.careContinuityRate >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <>
      <PageHeader
        eyebrow={fmtToday()}
        title={greeting}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', urgent ? 'bg-red-500' : 'bg-emerald-500')} aria-hidden />
            {urgent ? d.statusAttention(urgent) : d.statusClear}
          </span>
        }
      />

      {/* 1 · What needs action — one strip, not three competing cards */}
      <section aria-labelledby="needs-action" className="mb-8">
        <h2 id="needs-action" className="sr-only">
          {d.needsAction}
        </h2>
        <div className="grid divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <ActionCell label={d.overdue} value={k.overdueFollowUps} hint={d.overdueHint} href="/doctor" icon="clock" />
          <ActionCell label={d.highRisk} value={k.highRiskPatients} hint={d.highRiskHint} href="/patients?risk=HIGH" icon="alert" />
          <ActionCell label={d.urgentFeedback} value={k.urgentFeedback} hint={d.urgentFeedbackHint} href="/feedback" icon="shield" />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        {/* 2 · Worklist */}
        <Card className="lg:col-span-2" padded={false}>
          <CardHeader description={d.attentionDesc}>{d.attentionTitle}</CardHeader>
          {data.attention.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon name="checkCircle" className="h-5 w-5" />
              </span>
              <p className="font-medium text-slate-900">{d.allOnTrack}</p>
              <p className="mt-1 text-sm text-slate-500">{d.allOnTrackHint}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {data.attention.map((a) => {
                const reasons = (a.reasonCodes ?? []).map((c) => d.reasons[c] ?? c).join(' · ') || a.reasons.join(' · ');
                return (
                  <li key={a.id}>
                    <Link href={`/referrals/${a.id}`} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 sm:px-5">
                      <Avatar name={a.patient.fullName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate font-medium text-slate-900">{a.patient.fullName}</p>
                          <RiskBadge level={a.patient.riskLevel} />
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-700">{reasons}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <DeadlineChip deadline={a.deadline} />
                          <span className="truncate">
                            {a.patient.district} · {a.assignedDoctor?.fullName ?? d.noDoctor}
                          </span>
                        </div>
                      </div>
                      <span className="hidden h-8 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-medium text-slate-700 ring-1 ring-inset ring-slate-300 group-hover:bg-white sm:inline-flex">
                        {t.common.review}
                      </span>
                      <Icon name="chevronRight" className="h-4 w-4 text-slate-300 sm:hidden" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* 3 · Continuity + insight */}
        <div className="space-y-6">
          <Card>
            <CardTitle description={d.continuityDesc}>{d.continuityTitle}</CardTitle>
            <p className={cx('text-[32px] font-semibold leading-10 tabular-nums tracking-tight', continuityTone)}>{k.careContinuityRate}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={d.continuityTitle} aria-valuenow={k.careContinuityRate} aria-valuemin={0} aria-valuemax={100}>
              <div className={cx('h-full rounded-full', continuityBar)} style={{ width: `${k.careContinuityRate}%` }} />
            </div>
            <div className="mt-5">
              <DescriptionList
                rows
                items={[
                  { label: d.onTime, value: k.onTimeCompletionRate == null ? '—' : `${k.onTimeCompletionRate}%` },
                  { label: d.activeReferrals, value: k.activeReferrals },
                  { label: d.offlineVisits, value: k.offlineSyncedVisits },
                  { label: d.patients, value: k.totalPatients },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardTitle
              description={
                ai.data
                  ? ai.data.enabled
                    ? d.coordinatorDesc(modelName(ai.data.model) ?? '', ai.data.fallbackModels.map(modelName).join(', '))
                    : d.coordinatorRules
                  : undefined
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="sparkle" className="h-4 w-4 text-slate-400" /> {d.coordinator}
              </span>
            </CardTitle>
            <ul className="space-y-2.5">
              {(data.insightItems ?? data.insights.map((text) => ({ code: text, value: 0 }))).map((i) => (
                <li key={i.code} className="flex gap-2.5 text-sm text-slate-800">
                  <span className={cx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', i.code === 'all_clear' ? 'bg-emerald-500' : 'bg-slate-400')} aria-hidden />
                  {d.insights[i.code]?.(i.value) ?? i.code}
                </li>
              ))}
            </ul>
            <AiDisclaimer className="mt-4 border-t border-line-soft pt-3" />
          </Card>
        </div>
      </div>

      {/* 4 · Patient voice */}
      <Card className="mt-6">
        <CardTitle
          description={d.voiceDesc(k.feedbackCount)}
          action={
            <Link href="/feedback" className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-900">
              {d.viewAll} <Icon name="chevronRight" className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {d.voice}
        </CardTitle>
        {fbTotal === 0 ? (
          <p className="text-sm text-slate-600">{d.noFeedback}</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <Overline>{d.sentiment}</Overline>
              <div
                className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full"
                role="img"
                aria-label={`${t.enums.sentiment.POSITIVE} ${s.POSITIVE}, ${t.enums.sentiment.NEUTRAL} ${s.NEUTRAL}, ${t.enums.sentiment.NEGATIVE} ${s.NEGATIVE}`}
              >
                <div className="bg-emerald-500" style={{ width: `${(s.POSITIVE / fbTotal) * 100}%` }} />
                <div className="bg-slate-300" style={{ width: `${(s.NEUTRAL / fbTotal) * 100}%` }} />
                <div className="bg-red-500" style={{ width: `${(s.NEGATIVE / fbTotal) * 100}%` }} />
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {(
                  [
                    ['POSITIVE', 'bg-emerald-500'],
                    ['NEUTRAL', 'bg-slate-300'],
                    ['NEGATIVE', 'bg-red-500'],
                  ] as const
                ).map(([key, dot]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={cx('h-2 w-2 rounded-full', dot)} aria-hidden />
                    <dt className="text-slate-600">{t.enums.sentiment[key]}</dt>
                    <dd className="font-medium tabular-nums text-slate-900">{s[key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {data.feedbackTopics.length > 0 && (
              <div>
                <Overline>{d.topTopics}</Overline>
                <ul className="mt-3 space-y-2">
                  {data.feedbackTopics.map((tp) => {
                    const max = data.feedbackTopics[0].count;
                    return (
                      <li key={tp.topic} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
                        <span className="truncate text-slate-700">{t.enums.topic[tp.topic] ?? tp.topic}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                          <span className="block h-full rounded-full bg-slate-400" style={{ width: `${(tp.count / max) * 100}%` }} />
                        </span>
                        <span className="text-right tabular-nums text-slate-600">{tp.count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
