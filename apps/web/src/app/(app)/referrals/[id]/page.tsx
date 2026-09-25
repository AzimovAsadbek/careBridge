'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import { age, dueIn, fmtDateTime } from '@/lib/format';
import { session } from '@/lib/session';
import type { ReferralDetail, StaffMember } from '@/lib/types';
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

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !r) return <Loading label="Loading referral…" />;
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
      setMsg({ tone: 'green', text: kind === 'accept' ? 'Referral accepted.' : 'Home visit assigned. The nurse sees it in their visit list.' });
      await reload();
    } catch (e) {
      setMsg({ tone: 'red', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  const nextAction = (() => {
    if (r.status === 'COMPLETED') return { title: 'Follow-up completed', body: `Closed ${fmtDateTime(r.completedAt)}.`, done: true };
    if (!r.acceptedAt) return { title: 'Accept this referral', body: 'Confirm that your clinic takes over follow-up care.' };
    if (!openFollowUp) return { title: 'Assign a home visit', body: 'Choose the nurse who will visit the patient.' };
    return { title: 'Waiting for the home visit', body: `${openFollowUp.assignedNurse?.fullName ?? 'The nurse'} will record observations — offline if needed.` };
  })();

  return (
    <>
      <PageHeader
        back={{ href: '/doctor', label: 'Referrals' }}
        eyebrow="Follow-up referral"
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
            Patient record <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {overdue && (
          <Alert tone="red" title="Overdue — escalated">
            The deadline passed on {fmtDateTime(r.deadline)} without a home visit. Assign a nurse now.
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle description="Hospital → family doctor → nurse → home">Workflow</CardTitle>
            <CareJourney
              steps={[
                { label: 'Discharged', at: r.createdAt, done: true },
                { label: 'Doctor accepted', at: r.acceptedAt, done: !!r.acceptedAt, late: overdue },
                { label: 'Nurse assigned', at: latestFollowUp?.createdAt ?? null, done: !!latestFollowUp, late: overdue },
                { label: 'Home visit', at: latestFollowUp?.visitStartedAt, done: !!latestFollowUp?.visitStartedAt },
                { label: 'Completed', at: r.completedAt, done: !!r.completedAt },
              ]}
            />
          </Card>

          <Card className={cx(!nextAction.done && canManage && 'border-brand-200 ring-1 ring-brand-100')}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Next action</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{nextAction.title}</p>
            <p className="mt-0.5 text-sm text-slate-600">{nextAction.body}</p>
            {canManage && r.status !== 'COMPLETED' && (
              <div className="mt-4 space-y-3">
                {!r.acceptedAt && (
                  <Button className="w-full" loading={busy === 'accept'} onClick={() => run('accept')}>
                    Accept referral
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
                    <Field label="Nurse for the home visit" htmlFor="nurse">
                      <Select id="nurse" required value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
                        <option value="">Select nurse</option>
                        {nurses.data?.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.fullName} · {n.facility.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Button type="submit" variant={r.acceptedAt ? 'primary' : 'secondary'} className="w-full" loading={busy === 'assign'} disabled={!nurseId}>
                      Assign home visit
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
              <CardTitle>Discharge information</CardTitle>
              <p className="text-sm font-medium text-slate-900">{r.reason}</p>
              {r.dischargeSummary && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.dischargeSummary}</p>}
              <div className="mt-4 border-t border-line pt-4">
                <DescriptionList
                  items={[
                    { label: 'Created', value: fmtDateTime(r.createdAt) },
                    {
                      label: 'Deadline',
                      value: (
                        <span className={cx(due.overdue && r.status !== 'COMPLETED' && 'text-red-700')}>
                          {fmtDateTime(r.deadline)} {r.status !== 'COMPLETED' && `(${due.text})`}
                        </span>
                      ),
                    },
                    { label: 'Family doctor', value: r.assignedDoctor?.fullName ?? '—' },
                    { label: 'Accepted', value: fmtDateTime(r.acceptedAt) },
                  ]}
                />
              </div>
            </Card>

            {r.followUps.map((f) => (
              <Card key={f.id}>
                <CardTitle action={<FollowUpStatusBadge status={f.status} />} description={`Nurse ${f.assignedNurse?.fullName ?? '—'}`}>
                  Home visit
                </CardTitle>
                <p className="mb-3 text-sm text-slate-600">
                  {f.visitStartedAt ? `Started ${fmtDateTime(f.visitStartedAt)}` : 'Not started yet'}
                  {f.completedAt && ` · completed ${fmtDateTime(f.completedAt)}`}
                  {f.syncedFromOffline && ' · captured offline, synced'}
                </p>
                {f.outcome && (
                  <p className="mb-3 rounded-[var(--radius-control)] bg-slate-50 px-3 py-2 text-sm text-slate-800">
                    <span className="font-medium">Outcome:</span> {f.outcome}
                  </p>
                )}
                <VitalsTable observations={f.observations} />
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardTitle>Patient</CardTitle>
            <div className="mb-3">
              <RiskBadge level={r.patient.riskLevel} />
            </div>
            <DescriptionList
              columns={1}
              items={[
                { label: 'Age · sex', value: `${age(r.patient.birthDate)} y · ${r.patient.sex === 'MALE' ? 'Male' : 'Female'}` },
                { label: 'Address', value: `${r.patient.address}, ${r.patient.district}` },
                { label: 'Phone', value: r.patient.phone ?? '—' },
                ...(r.patient.diagnosisNote ? [{ label: 'Clinical note', value: r.patient.diagnosisNote }] : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
