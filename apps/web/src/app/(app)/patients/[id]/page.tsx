'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import { age, dueIn, fmtDate, fmtDateTime } from '@/lib/format';
import { session } from '@/lib/session';
import { usePollWhile } from '@/lib/poll';
import type { PatientDetail } from '@/lib/types';
import { FollowUpStatusBadge, PatientStatusBadge, PriorityBadge, ReferralStatusBadge, RiskBadge } from '@/components/badges';
import { ContinuityCard, RiskCard, VitalsTable } from '@/components/clinical';
import { DischargePanel } from '@/components/DischargePanel';
import { Alert, Button, Card, CardTitle, ErrorState, Loading, PageHeader } from '@/components/ui';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error, loading, reload } = useResource<PatientDetail>(`/patients/${id}`);
  const [discharging, setDischarging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const role = session.user?.role;
  usePollWhile(!!p?.riskAssessments[0]?.aiPending, reload);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !p) return <Loading />;
  if (!p) return null;

  const canDischarge = p.status === 'ADMITTED' && (role === 'ADMIN' || role === 'DOCTOR');
  const referral = p.referrals[0];

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
        title={p.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {age(p.birthDate)} y · {p.sex === 'MALE' ? 'Male' : 'Female'} · {p.district}
            <PatientStatusBadge status={p.status} />
            <RiskBadge level={p.riskLevel} />
          </span>
        }
        actions={canDischarge && !discharging && <Button onClick={() => setDischarging(true)}>Discharge patient</Button>}
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

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardTitle>Patient</CardTitle>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Home address</dt><dd className="font-medium">{p.address}</dd></div>
                <div><dt className="text-slate-500">Phone</dt><dd className="font-medium">{p.phone ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Facility</dt><dd className="font-medium">{p.facility.name}</dd></div>
                <div><dt className="text-slate-500">Family doctor</dt><dd className="font-medium">{p.familyDoctor ? `${p.familyDoctor.fullName} (${p.familyDoctor.facility.name})` : '—'}</dd></div>
                <div><dt className="text-slate-500">Admitted</dt><dd className="font-medium">{fmtDate(p.admittedAt)}</dd></div>
                <div><dt className="text-slate-500">Discharged</dt><dd className="font-medium">{fmtDate(p.dischargedAt)}</dd></div>
                {p.diagnosisNote && <div className="sm:col-span-2"><dt className="text-slate-500">Clinical note</dt><dd className="font-medium">{p.diagnosisNote}</dd></div>}
              </dl>
            </Card>

            <Card>
              <CardTitle>Care journey</CardTitle>
              {p.referrals.length === 0 ? (
                <p className="text-sm text-slate-500">No referrals yet. A follow-up referral is created automatically at discharge.</p>
              ) : (
                <ul className="space-y-3">
                  {p.referrals.map((r) => {
                    const due = dueIn(r.deadline);
                    return (
                      <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/referrals/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                            {r.fromFacility.name} → {r.toFacility.name}
                          </Link>
                          <div className="flex gap-2"><PriorityBadge priority={r.priority} /><ReferralStatusBadge status={r.status} /></div>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{r.reason}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created {fmtDateTime(r.createdAt)} · {r.assignedDoctor?.fullName ?? 'unassigned'} ·{' '}
                          {r.completedAt ? `completed ${fmtDateTime(r.completedAt)}` : <span className={due.overdue ? 'font-semibold text-red-600' : ''}>{due.text}</span>}
                        </p>
                        {r.followUps.map((f) => (
                          <div key={f.id} className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                            <FollowUpStatusBadge status={f.status} />
                            <span>Nurse: {f.assignedNurse?.fullName ?? '—'}</span>
                            {f.outcome && <span>· Outcome: {f.outcome}</span>}
                          </div>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>Observations</CardTitle>
              <VitalsTable observations={p.observations} />
            </Card>
          </div>

          <div className="space-y-4">
            <ContinuityCard continuity={p.continuity} />
            <RiskCard
              assessment={p.riskAssessments[0]}
              action={<Button variant="ghost" className="min-h-0 px-2 py-1 text-xs" loading={assessing} onClick={assess}>Re-assess</Button>}
            />
            {referral && (
              <Card>
                <CardTitle>Active referral</CardTitle>
                <Link href={`/referrals/${referral.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Open referral →</Link>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
