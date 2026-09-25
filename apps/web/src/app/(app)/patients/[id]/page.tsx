'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import { age, fmtDate, fmtDateTime } from '@/lib/format';
import { session } from '@/lib/session';
import { usePollWhile } from '@/lib/poll';
import { useI18n } from '@/lib/i18n';
import type { PatientDetail } from '@/lib/types';
import { DeadlineChip, FollowUpStatusBadge, PatientStatusBadge, PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { CareJourney, RiskCard, VitalsTable } from '@/components/clinical';
import { DischargePanel } from '@/components/DischargePanel';
import { Alert, Avatar, Button, ButtonLink, Card, CardTitle, DescriptionList, ErrorState, Icon, Loading, Overline, cx } from '@/components/ui';

type NextKey = 'discharge' | 'waitingDischarge' | 'accept' | 'assignNurse' | 'homeVisit' | 'done';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error, loading, reload } = useResource<PatientDetail>(`/patients/${id}`);
  const [discharging, setDischarging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const role = session.user?.role;
  const { t } = useI18n();
  const tp = t.patient;
  usePollWhile(!!p?.riskAssessments[0]?.aiPending, reload);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !p) return <Loading label={tp.loading} variant="detail" />;
  if (!p) return null;

  const canDischarge = p.status === 'ADMITTED' && (role === 'ADMIN' || role === 'DOCTOR');
  const referral = p.referrals[0];
  const followUp = referral?.followUps[0];
  const risk = p.riskAssessments[0];
  const synced = p.observations.some((o) => followUp && o.followUpId === followUp.id);
  const handoffsDone = p.continuity.steps.filter((s) => s.done).length;

  // What should happen next for this patient — shown in the header so nobody has to work it out.
  const next: NextKey =
    p.status === 'ADMITTED'
      ? canDischarge
        ? 'discharge'
        : 'waitingDischarge'
      : !referral
        ? 'waitingDischarge'
        : referral.completedAt
          ? 'done'
          : !referral.acceptedAt
            ? 'accept'
            : !followUp?.assignedNurse
              ? 'assignNurse'
              : 'homeVisit';
  const nextCta =
    next === 'discharge' ? (
      !discharging && <Button onClick={() => setDischarging(true)}>{tp.discharge}</Button>
    ) : next === 'homeVisit' && role === 'NURSE' && followUp ? (
      <ButtonLink href={`/nurse/visit?id=${followUp.id}`}>
        {followUp.status === 'IN_PROGRESS' ? t.nurse.continue : t.nurse.start} <Icon name="arrowRight" />
      </ButtonLink>
    ) : referral && next !== 'waitingDischarge' ? (
      <ButtonLink href={`/referrals/${referral.id}`} variant={next === 'accept' || next === 'assignNurse' ? 'primary' : 'secondary'}>
        {next === 'accept' || next === 'assignNurse' ? tp.nextCta[next] : tp.openReferral} <Icon name="arrowRight" />
      </ButtonLink>
    ) : null;

  async function assess() {
    setAssessing(true);
    setActionError(null);
    try {
      await api(`/ai/risk-assessment/${id}`, { method: 'POST' });
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setAssessing(false);
    }
  }

  return (
    <>
      <Link href="/patients" className="-ml-1 mb-3 inline-flex h-8 items-center gap-1 rounded-md px-1 text-meta font-medium text-slate-500 hover:text-slate-900">
        <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {t.nav.patients}
      </Link>

      {/* Workspace header: identity · risk · care status · next action */}
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={p.fullName} size="lg" />
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold leading-8 tracking-tight text-slate-900 sm:text-page">{p.fullName}</h1>
            <p className="text-sm text-slate-600">
              {t.common.years(age(p.birthDate))} · {p.sex === 'MALE' ? t.common.male : t.common.female} · {p.district}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <RiskBadge level={risk?.level ?? p.riskLevel} />
              <PatientStatusBadge status={p.status} />
            </div>
          </div>
        </div>
        <div
          className={cx(
            'flex flex-col gap-3 rounded-[var(--radius-card)] border px-4 py-3 sm:flex-row sm:items-center lg:max-w-md',
            next === 'done' ? 'border-emerald-200 bg-emerald-50/60' : referral?.status === 'OVERDUE' ? 'border-red-200 bg-red-50/60' : 'border-line bg-white',
          )}
        >
          <div className="min-w-0 flex-1">
            <Overline>{tp.nextStep}</Overline>
            <p className="mt-0.5 text-sm font-medium text-slate-900">{tp.next[next]}</p>
          </div>
          {nextCta && <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{nextCta}</div>}
        </div>
      </header>

      <div className="space-y-6">
        {notice && <Alert tone="green">{notice}</Alert>}
        {actionError && <Alert>{actionError}</Alert>}
        {discharging && (
          <DischargePanel
            patient={p}
            onCancel={() => setDischarging(false)}
            onDone={(msg) => {
              setDischarging(false);
              setNotice(msg);
              void reload();
            }}
          />
        )}

        {/* Journey + status in one surface */}
        <Card padded={false}>
          <div className="p-4 sm:p-5">
            <CardTitle description={tp.journeyDesc}>{tp.journey}</CardTitle>
            <CareJourney
              steps={[
                { label: tp.steps.admitted, at: p.admittedAt, done: !!p.admittedAt },
                { label: tp.steps.discharged, at: p.dischargedAt, done: !!p.dischargedAt },
                { label: tp.steps.referralSent, at: referral?.createdAt, done: !!referral },
                { label: tp.steps.doctorAccepted, at: referral?.acceptedAt, done: !!referral?.acceptedAt, late: referral?.status === 'OVERDUE' },
                { label: tp.steps.homeVisit, at: followUp?.visitStartedAt, done: !!followUp?.visitStartedAt, late: referral?.status === 'OVERDUE' },
                { label: tp.steps.dataSynced, done: synced },
                { label: tp.steps.completed, at: referral?.completedAt, done: !!referral?.completedAt },
              ]}
            />
          </div>
          <dl className="grid divide-y divide-line-soft border-t border-line-soft sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="min-w-0 px-4 py-3 sm:px-5">
              <dt className="text-meta text-slate-500">{tp.referral}</dt>
              <dd className="mt-1.5">
                {referral ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <ReferralStatusBadge status={referral.status} />
                      <PriorityBadge priority={referral.priority} />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {referral.completedAt ? tp.completedOn(fmtDate(referral.completedAt)) : <DeadlineChip deadline={referral.deadline} />}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">{tp.referralAuto}</p>
                )}
              </dd>
            </div>
            <div className="min-w-0 px-4 py-3 sm:px-5">
              <dt className="text-meta text-slate-500">{tp.careTeam}</dt>
              <dd className="mt-1.5 space-y-0.5 text-sm">
                <p className="truncate text-slate-900">{referral?.assignedDoctor?.fullName ?? p.familyDoctor?.fullName ?? tp.noDoctor}</p>
                <p className="truncate text-slate-600">{followUp?.assignedNurse ? tp.nurse(followUp.assignedNurse.fullName) : tp.noNurse}</p>
              </dd>
            </div>
            <div className="min-w-0 px-4 py-3 sm:px-5">
              <dt className="text-meta text-slate-500">{tp.continuity}</dt>
              <dd className="mt-1">
                <span className="text-xl font-semibold tabular-nums text-slate-900">{p.continuity.score}%</span>
                <span className="ml-2 text-xs text-slate-500">{tp.handoffs(handoffsDone, p.continuity.steps.length)}</span>
              </dd>
            </div>
          </dl>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <RiskCard
              assessment={risk}
              action={
                <Button variant="secondary" size="sm" loading={assessing} onClick={assess}>
                  <Icon name="refresh" className="h-3.5 w-3.5" /> {tp.reassess}
                </Button>
              }
            />
            <Card>
              <CardTitle description={tp.observationsDesc}>{tp.observations}</CardTitle>
              <VitalsTable observations={p.observations} />
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <Card>
              <CardTitle>{tp.details}</CardTitle>
              <DescriptionList
                columns={1}
                items={[
                  { label: tp.address, value: p.address },
                  { label: tp.phone, value: p.phone ?? '—' },
                  { label: tp.facility, value: p.facility.name },
                  { label: tp.familyDoctor, value: p.familyDoctor ? `${p.familyDoctor.fullName} · ${p.familyDoctor.facility.name}` : '—' },
                  { label: tp.admittedDischarged, value: `${fmtDate(p.admittedAt)} · ${fmtDate(p.dischargedAt)}` },
                  ...(p.diagnosisNote ? [{ label: tp.clinicalNote, value: p.diagnosisNote }] : []),
                ]}
              />
            </Card>
            {p.referrals.length > 0 && (
              <Card padded={false}>
                <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                  <CardTitle>{tp.history}</CardTitle>
                </div>
                <ul className="divide-y divide-line-soft border-t border-line-soft">
                  {p.referrals.map((r) => (
                    <li key={r.id}>
                      <Link href={`/referrals/${r.id}`} className="block px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5">
                        <p className="text-sm font-medium text-slate-900">
                          {r.fromFacility.name} → {r.toFacility.name}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{r.reason}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ReferralStatusBadge status={r.status} />
                          {r.followUps[0] && t.enums.followUpStatus[r.followUps[0].status] !== t.enums.referralStatus[r.status] && <FollowUpStatusBadge status={r.followUps[0].status} />}
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {tp.created(fmtDateTime(r.createdAt))}
                          {r.followUps[0]?.assignedNurse && ` · ${tp.nurse(r.followUps[0].assignedNurse.fullName)}`}
                        </p>
                        {r.followUps[0]?.outcome && (
                          <p className="mt-1 text-xs text-slate-600">
                            {tp.outcome}: {r.followUps[0].outcome}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
