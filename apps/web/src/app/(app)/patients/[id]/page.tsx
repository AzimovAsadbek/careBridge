'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import { age, dueIn, fmtDate, fmtDateTime } from '@/lib/format';
import { session } from '@/lib/session';
import { usePollWhile } from '@/lib/poll';
import { localizeText, aiMap, useI18n } from '@/lib/i18n';
import type { PatientDetail } from '@/lib/types';
import { FollowUpStatusBadge, PatientStatusBadge, PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { CareJourney, RiskCard, VitalsTable } from '@/components/clinical';
import { DischargePanel } from '@/components/DischargePanel';
import { Alert, Button, Card, CardTitle, DescriptionList, ErrorState, Icon, Loading, PageHeader, cx } from '@/components/ui';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error, loading, reload } = useResource<PatientDetail>(`/patients/${id}`);
  const [discharging, setDischarging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const role = session.user?.role;
  const { t, locale } = useI18n();
  const tp = t.patient;
  usePollWhile(!!p?.riskAssessments[0]?.aiPending, reload);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !p) return <Loading label={tp.loading} />;
  if (!p) return null;

  const canDischarge = p.status === 'ADMITTED' && (role === 'ADMIN' || role === 'DOCTOR');
  const referral = p.referrals[0];
  const followUp = referral?.followUps[0];
  const risk = p.riskAssessments[0];
  const due = referral && !referral.completedAt ? dueIn(referral.deadline) : null;
  const synced = p.observations.some((o) => followUp && o.followUpId === followUp.id);

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
      <PageHeader
        back={{ href: '/patients', label: t.nav.patients }}
        title={p.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {t.common.years(age(p.birthDate))} · {p.sex === 'MALE' ? t.common.male : t.common.female} · {p.district}
            </span>
            <PatientStatusBadge status={p.status} />
            <RiskBadge level={p.riskLevel} />
          </span>
        }
        actions={canDischarge && !discharging && <Button onClick={() => setDischarging(true)}>{tp.discharge}</Button>}
      />

      <div className="space-y-4">
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

        {/* At-a-glance summary: what matters and what happens next. */}
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <p className="text-sm font-medium text-slate-600">{tp.currentRisk}</p>
            <div className="mt-2">
              <RiskBadge level={risk?.level ?? p.riskLevel} />
            </div>
            <p className="mt-2 text-sm text-slate-800">{risk ? localizeText(risk.recommendedAction, t, aiMap(risk.i18n, locale)) : tp.notAssessedHint}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-600">{tp.referral}</p>
            {referral ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ReferralStatusBadge status={referral.status} />
                  <PriorityBadge priority={referral.priority} />
                </div>
                <p className="mt-2 text-sm text-slate-800">
                  {referral.completedAt ? tp.completedOn(fmtDate(referral.completedAt)) : <span className={cx(due?.overdue && 'font-semibold text-red-700')}>{due?.text}</span>}
                  {' · '}
                  {referral.assignedDoctor?.fullName ?? tp.noDoctor}
                </p>
                <Link href={`/referrals/${referral.id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                  {tp.openReferral} <Icon name="chevronRight" className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-700">{tp.referralAuto}</p>
            )}
          </Card>
          <Card>
            <p className="text-sm font-medium text-slate-600">{tp.continuity}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">{p.continuity.score}%</p>
            <p className="text-sm text-slate-700">{tp.handoffs(p.continuity.steps.filter((s) => s.done).length, p.continuity.steps.length)}</p>
          </Card>
        </div>

        <Card>
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
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
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

          <div className="min-w-0 space-y-4">
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
              <Card>
                <CardTitle>{tp.history}</CardTitle>
                <ul className="space-y-3">
                  {p.referrals.map((r) => (
                    <li key={r.id} className="rounded-[var(--radius-control)] border border-line p-3">
                      <Link href={`/referrals/${r.id}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700">
                        {r.fromFacility.name} → {r.toFacility.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-slate-700">{r.reason}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <ReferralStatusBadge status={r.status} />
                        {r.followUps[0] && <FollowUpStatusBadge status={r.followUps[0].status} />}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {tp.created(fmtDateTime(r.createdAt))}
                        {r.followUps[0]?.assignedNurse && ` · ${tp.nurse(r.followUps[0].assignedNurse.fullName)}`}
                      </p>
                      {r.followUps[0]?.outcome && <p className="mt-1 text-xs text-slate-600">{tp.outcome}: {r.followUps[0].outcome}</p>}
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
