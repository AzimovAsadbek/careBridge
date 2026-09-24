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
import { VitalsTable } from '@/components/clinical';
import { Alert, Button, Card, CardTitle, ErrorState, Field, Loading, PageHeader, Select } from '@/components/ui';

export default function ReferralPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, loading, reload } = useResource<ReferralDetail>(`/referrals/${id}`);
  const role = session.user?.role;
  const nurses = useResource<StaffMember[]>(role === 'NURSE' ? null : '/users?role=NURSE');
  const [nurseId, setNurseId] = useState('');
  const [busy, setBusy] = useState<'accept' | 'assign' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'green' | 'red'; text: string } | null>(null);

  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (loading && !r) return <Loading />;
  if (!r) return null;

  const canManage = role === 'DOCTOR' || role === 'ADMIN';
  const due = dueIn(r.deadline);
  const openFollowUp = r.followUps.find((f) => f.status !== 'COMPLETED');

  async function run(kind: 'accept' | 'assign') {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === 'accept') await api(`/referrals/${id}`, { method: 'PATCH', body: { action: 'accept' } });
      else await api('/follow-ups', { method: 'POST', body: { referralId: id, assignedNurseId: nurseId } });
      setMsg({ tone: 'green', text: kind === 'accept' ? 'Referral accepted.' : 'Home visit assigned. The nurse sees it in their worklist.' });
      await reload();
    } catch (e) {
      setMsg({ tone: 'red', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title={`Referral · ${r.patient.fullName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {r.fromFacility.name} → {r.toFacility.name}
            <PriorityBadge priority={r.priority} />
            <ReferralStatusBadge status={r.status} />
          </span>
        }
        actions={<Link href={`/patients/${r.patient.id}`} className="text-sm font-semibold text-brand-700 hover:underline">Patient record →</Link>}
      />
      <div className="space-y-4">
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        {r.status === 'OVERDUE' && (
          <Alert tone="red" title="Follow-up overdue — escalated">
            The deadline passed on {fmtDateTime(r.deadline)} without a home visit. Assign a nurse now.
          </Alert>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardTitle>Discharge information</CardTitle>
              <p className="text-sm font-medium text-slate-900">{r.reason}</p>
              {r.dischargeSummary && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.dischargeSummary}</p>}
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-slate-500">Created</dt><dd className="font-medium">{fmtDateTime(r.createdAt)}</dd></div>
                <div><dt className="text-slate-500">Deadline</dt><dd className={due.overdue && r.status !== 'COMPLETED' ? 'font-semibold text-red-600' : 'font-medium'}>{fmtDateTime(r.deadline)}</dd></div>
                <div><dt className="text-slate-500">Accepted</dt><dd className="font-medium">{fmtDateTime(r.acceptedAt)}</dd></div>
              </dl>
            </Card>

            {r.followUps.map((f) => (
              <Card key={f.id}>
                <CardTitle action={<FollowUpStatusBadge status={f.status} />}>Home visit</CardTitle>
                <p className="text-sm text-slate-600">
                  Nurse: <span className="font-medium text-slate-900">{f.assignedNurse?.fullName ?? '—'}</span>
                  {f.visitStartedAt && ` · started ${fmtDateTime(f.visitStartedAt)}`}
                  {f.completedAt && ` · completed ${fmtDateTime(f.completedAt)}`}
                  {f.syncedFromOffline && ' · captured offline, synced'}
                </p>
                {f.outcome && <p className="mt-2 text-sm"><span className="text-slate-500">Outcome:</span> {f.outcome}</p>}
                <div className="mt-3"><VitalsTable observations={f.observations} /></div>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card>
              <CardTitle>Patient</CardTitle>
              <p className="font-semibold">{r.patient.fullName}</p>
              <p className="text-sm text-slate-600">{age(r.patient.birthDate)} y · {r.patient.sex === 'MALE' ? 'Male' : 'Female'}</p>
              <p className="mt-2 text-sm text-slate-600">{r.patient.address}, {r.patient.district}</p>
              {r.patient.phone && <p className="text-sm text-slate-600">{r.patient.phone}</p>}
              <div className="mt-3"><RiskBadge level={r.patient.riskLevel} /></div>
            </Card>

            {canManage && r.status !== 'COMPLETED' && (
              <Card>
                <CardTitle>Actions</CardTitle>
                <div className="space-y-4">
                  {!r.acceptedAt && (
                    <Button className="w-full" loading={busy === 'accept'} onClick={() => run('accept')}>Accept referral</Button>
                  )}
                  {!openFollowUp && (
                    <form onSubmit={(e) => { e.preventDefault(); void run('assign'); }} className="space-y-2">
                      <Field label="Assign home visit to nurse" htmlFor="nurse">
                        <Select id="nurse" required value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
                          <option value="">— Select nurse —</option>
                          {nurses.data?.map((n) => <option key={n.id} value={n.id}>{n.fullName} · {n.facility.name}</option>)}
                        </Select>
                      </Field>
                      <Button type="submit" variant="secondary" className="w-full" loading={busy === 'assign'} disabled={!nurseId}>Start follow-up</Button>
                    </form>
                  )}
                  {openFollowUp && <p className="text-sm text-slate-600">Home visit assigned to {openFollowUp.assignedNurse?.fullName}.</p>}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
