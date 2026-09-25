'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import { age, dueIn, fmtDateTime } from '@/lib/format';
import { session } from '@/lib/session';
import type { ReferralDetail, StaffMember } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { FollowUpStatusBadge, PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { CareJourney, VitalsTable } from '@/components/clinical';
import { Alert, Button, Card, CardTitle, DescriptionList, ErrorState, Field, Icon, Loading, PageHeader, Select, cx } from '@/components/ui';

export default function ReferralPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, loading, reload } = useResource<ReferralDetail>(`/referrals/${id}`);
  const role = session.user?.role;
  const nurses = useResource<StaffMember[]>(role === 'NURSE' ? null : '/users?role=NURSE');
  const [nurseId, setNurseId] = useState('');
  const [busy, setBusy] = useState<'accept' | 'assign' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);
  const { t } = useI18n();
  const tr = t.referral;

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !r) return <Loading label={tr.loading} />;
  if (!r) return null;

  const canManage = role === 'DOCTOR' || role === 'ADMIN';
  const due = dueIn(r.deadline);
  const openFollowUp = r.followUps.find((f) => f.status !== 'COMPLETED');
  const latestFollowUp = r.followUps[0];
  const overdue = r.status === 'OVERDUE';

  async function run(kind: 'accept' | 'assign') {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'accept') await api(`/referrals/${id}`, { method: 'PATCH', body: { action: 'accept' } });
      else await api('/follow-ups', { method: 'POST', body: { referralId: id, assignedNurseId: nurseId } });
      setMsg({ tone: 'green', text: kind === 'accept' ? tr.accepted : tr.assigned });
      await reload();
    } catch (e) {
      setMsg({ tone: 'red', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const nextAction = (() => {
    const n = tr.next;
    if (r.status === 'COMPLETED') return { title: n.done, body: n.doneBody(fmtDateTime(r.completedAt)), done: true };
    if (!r.acceptedAt) return { title: n.accept, body: n.acceptBody };
    if (!openFollowUp) return { title: n.assign, body: n.assignBody };
    return { title: n.wait, body: n.waitBody(openFollowUp.assignedNurse?.fullName ?? n.theNurse) };
  })();

  return (
    <>
      <PageHeader
        back={{ href: '/doctor', label: t.nav.referrals }}
        eyebrow={tr.eyebrow}
        title={r.patient.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {r.fromFacility.name} → {r.toFacility.name}
            </span>
            <ReferralStatusBadge status={r.status} />
            <PriorityBadge priority={r.priority} />
          </span>
        }
        actions={
          <Link href={`/patients/${r.patient.id}`} className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            {tr.patientRecord} <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {overdue && (
          <Alert tone="red" title={tr.overdueTitle}>
            {tr.overdueBody(fmtDateTime(r.deadline))}
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle description={tr.workflowDesc}>{tr.workflow}</CardTitle>
            <CareJourney
              steps={[
                { label: t.patient.steps.discharged, at: r.createdAt, done: true },
                { label: t.patient.steps.doctorAccepted, at: r.acceptedAt, done: !!r.acceptedAt, late: overdue },
                { label: t.patient.steps.nurseAssigned, at: latestFollowUp?.createdAt ?? null, done: !!latestFollowUp, late: overdue },
                { label: t.patient.steps.homeVisit, at: latestFollowUp?.visitStartedAt, done: !!latestFollowUp?.visitStartedAt },
                { label: t.patient.steps.completed, at: r.completedAt, done: !!r.completedAt },
              ]}
            />
          </Card>

          <Card className={cx(!nextAction.done && canManage && 'border-brand-200 ring-1 ring-brand-100')}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{tr.nextAction}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{nextAction.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{nextAction.body}</p>
            {canManage && r.status !== 'COMPLETED' && (
              <div className="mt-4 space-y-3">
                {!r.acceptedAt && (
                  <Button className="w-full" loading={busy === 'accept'} onClick={() => run('accept')}>
                    {tr.accept}
                  </Button>
                )}
                {!openFollowUp && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run('assign');
                    }}
                    className="space-y-2"
                  >
                    <Field label={tr.nurseField} htmlFor="nurse">
                      <Select id="nurse" required value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
                        <option value="">{tr.selectNurse}</option>
                        {nurses.data?.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.fullName} · {n.facility.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button type="submit" variant={r.acceptedAt ? 'primary' : 'secondary'} className="w-full" loading={busy === 'assign'} disabled={!nurseId}>
                      {tr.assign}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <Card>
              <CardTitle>{tr.dischargeInfo}</CardTitle>
              <p className="text-sm font-medium text-slate-900">{r.reason}</p>
              {r.dischargeSummary && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.dischargeSummary}</p>}
              <div className="mt-4 border-t border-line pt-4">
                <DescriptionList
                  items={[
                    { label: tr.created, value: fmtDateTime(r.createdAt) },
                    {
                      label: tr.deadline,
                      value: (
                        <span className={cx(due.overdue && r.status !== 'COMPLETED' && 'text-red-700')}>
                          {fmtDateTime(r.deadline)} {r.status !== 'COMPLETED' && `(${due.text})`}
                        </span>
                      ),
                    },
                    { label: tr.familyDoctor, value: r.assignedDoctor?.fullName ?? '—' },
                    { label: tr.acceptedAt, value: fmtDateTime(r.acceptedAt) },
                  ]}
                />
              </div>
            </Card>

            {r.followUps.map((f) => (
              <Card key={f.id}>
                <CardTitle action={<FollowUpStatusBadge status={f.status} />} description={tr.nurse(f.assignedNurse?.fullName ?? '—')}>
                  {tr.homeVisit}
                </CardTitle>
                <p className="mb-3 text-sm text-slate-600">
                  {f.visitStartedAt ? tr.started(fmtDateTime(f.visitStartedAt)) : tr.notStarted}
                  {f.completedAt && ` · ${tr.completedAt(fmtDateTime(f.completedAt))}`}
                  {f.syncedFromOffline && ` · ${tr.offlineSynced}`}
                </p>
                {f.outcome && (
                  <p className="mb-3 rounded-[var(--radius-control)] bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <span className="font-medium">{tr.outcome}:</span> {f.outcome}
                  </p>
                )}
                <VitalsTable observations={f.observations} />
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardTitle>{tr.patient}</CardTitle>
            <div className="mb-3">
              <RiskBadge level={r.patient.riskLevel} />
            </div>
            <DescriptionList
              columns={1}
              items={[
                { label: tr.ageSex, value: `${t.common.years(age(r.patient.birthDate))} · ${r.patient.sex === 'MALE' ? t.common.male : t.common.female}` },
                { label: tr.address, value: `${r.patient.address}, ${r.patient.district}` },
                { label: tr.phone, value: r.patient.phone ?? '—' },
                ...(r.patient.diagnosisNote ? [{ label: tr.clinicalNote, value: r.patient.diagnosisNote }] : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
