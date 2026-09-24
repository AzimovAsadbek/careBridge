'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, dueIn, fmtDateTime } from '@/lib/format';
import { queueFollowUpStatus, queueObservation, useOutbox } from '@/lib/outbox';
import { getSyncEngine, useSyncState } from '@/lib/sync';
import { usePollWhile } from '@/lib/poll';
import type { GeneralCondition, NurseVisit, Observation, PatientDetail } from '@/lib/types';
import type { OutboxOp } from '@/lib/db';
import { PriorityBadge, RiskBadge } from '@/components/badges';
import { RiskCard, VitalsTable } from '@/components/clinical';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, ErrorState, Field, Input, Loading, Select, Textarea, cx } from '@/components/ui';

const SYMPTOMS = ['Shortness of breath', 'Chest pain', 'Swelling', 'Dizziness', 'Fever', 'Cough', 'Confusion', 'Bleeding', 'Nausea', 'Fatigue'];

const emptyVitals = { systolic: '', diastolic: '', pulse: '', temperature: '', spo2: '', generalCondition: '' as GeneralCondition | '', notes: '', other: '' };

function toObservation(op: OutboxOp): Observation {
  const p = op.payload as Record<string, never>;
  return {
    id: op.entityId,
    clientId: op.entityId,
    followUpId: op.meta?.followUpId ?? null,
    systolic: p.systolic ?? null,
    diastolic: p.diastolic ?? null,
    pulse: p.pulse ?? null,
    temperature: p.temperature ?? null,
    spo2: p.spo2 ?? null,
    symptoms: p.symptoms ?? [],
    generalCondition: p.generalCondition ?? null,
    notes: p.notes ?? null,
    recordedAt: (p.recordedAt as string) ?? op.createdAt,
    syncedFromOffline: true,
  };
}

function Visit({ id }: { id: string }) {
  const visits = useResource<NurseVisit[]>('/follow-ups/mine', { offline: true });
  const visit = visits.data?.find((v) => v.id === id);
  const patient = useResource<PatientDetail>(visit ? `/patients/${visit.patient.id}` : null, { offline: true });
  const sync = useSyncState();
  const ops = useOutbox((op) => op.meta?.followUpId === id, [id]);

  const [vitals, setVitals] = useState(emptyVitals);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [outcome, setOutcome] = useState('');
  const [patientStatus, setPatientStatus] = useState<'STABLE' | 'IN_FOLLOW_UP'>('STABLE');
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  usePollWhile(sync.online && !!patient.data?.riskAssessments[0]?.aiPending, patient.reload);

  // A high-risk patient should not be closed as "stable" by default.
  const riskLevel = patient.data?.riskLevel ?? visit?.patient.riskLevel;
  useEffect(() => {
    if (riskLevel === 'HIGH') setPatientStatus('IN_FOLLOW_UP');
  }, [riskLevel]);

  // Pull fresh risk + observations once local changes reach the server.
  const reloadPatient = patient.reload;
  useEffect(() => {
    if (sync.online && sync.lastSyncAt) void reloadPatient();
  }, [sync.online, sync.lastSyncAt, reloadPatient]);

  const localObs = useMemo(() => ops.filter((o) => o.entityType === 'observation' && o.syncStatus !== 'synced'), [ops]);
  const rejected = ops.filter((o) => o.syncStatus === 'rejected');
  const statusOps = ops.filter((o) => o.entityType === 'followUp');
  const lastLocalStatus = statusOps.at(-1)?.payload.status as 'IN_PROGRESS' | 'COMPLETED' | undefined;
  const serverObs = (patient.data?.observations ?? []).filter((o) => o.followUpId === id);

  if (visits.error) return <ErrorState message={errorMessage(visits.error)} onRetry={visits.reload} />;
  if (visits.loading && !visits.data) return <Loading />;
  if (!visit) {
    return (
      <EmptyState title="Visit not available on this device">
        Open <Link className="text-brand-700 underline" href="/nurse">My visits</Link> while online to download it.
      </EmptyState>
    );
  }

  const rank = { SCHEDULED: 0, IN_PROGRESS: 1, COMPLETED: 2 } as const;
  const status = lastLocalStatus && rank[lastLocalStatus] > rank[visit.status] ? lastLocalStatus : visit.status;
  const due = dueIn(visit.referral.deadline);
  const num = (v: string) => (v === '' ? undefined : Number(v));

  async function saveVitals(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const other = vitals.other.split(',').map((s) => s.trim()).filter(Boolean);
    const payload = {
      systolic: num(vitals.systolic),
      diastolic: num(vitals.diastolic),
      pulse: num(vitals.pulse),
      temperature: num(vitals.temperature),
      spo2: num(vitals.spo2),
      symptoms: [...symptoms, ...other].slice(0, 20),
      generalCondition: vitals.generalCondition || undefined,
      notes: vitals.notes.trim() || undefined,
      recordedAt: new Date().toISOString(),
    };
    const hasData = [payload.systolic, payload.pulse, payload.temperature, payload.spo2, payload.generalCondition].some((v) => v !== undefined) || payload.symptoms.length > 0;
    if (!hasData) {
      setFormError('Record at least one vital sign, symptom or the general condition.');
      return;
    }
    setSaving(true);
    try {
      if (status === 'SCHEDULED') await queueFollowUpStatus(id, visit!.patient.id, { status: 'IN_PROGRESS' });
      await queueObservation(visit!.patient.id, id, payload);
      setVitals(emptyVitals);
      setSymptoms([]);
      setSaved('Saved on this device. It syncs to the server automatically — see the status at the top.');
    } catch {
      setFormError('Could not save on this device. Check browser storage settings.');
    } finally {
      setSaving(false);
    }
  }

  async function complete(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await queueFollowUpStatus(id, visit!.patient.id, { status: 'COMPLETED', outcome: outcome.trim() || undefined, patientStatus });
      setSaved('Visit completion saved on this device. It syncs to the server automatically.');
    } finally {
      setSaving(false);
    }
  }

  const setV = (k: keyof typeof emptyVitals) => (e: { target: { value: string } }) => setVitals((v) => ({ ...v, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div>
        <Link href="/nurse" className="text-sm font-semibold text-brand-700">← My visits</Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">{visit.patient.fullName}</h1>
        <p className="text-sm text-slate-500">
          {age(visit.patient.birthDate)} y · {visit.patient.sex === 'MALE' ? 'Male' : 'Female'} · {visit.patient.address}, {visit.patient.district}
        </p>
        {visit.patient.phone && (
          <a href={`tel:${visit.patient.phone}`} className="mt-1 inline-block text-sm font-semibold text-brand-700">
            Call {visit.patient.phone}
          </a>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={visit.referral.priority} />
          <RiskBadge level={patient.data?.riskLevel ?? visit.patient.riskLevel} />
          <Badge tone={status === 'COMPLETED' ? 'green' : status === 'IN_PROGRESS' ? 'brand' : 'blue'}>
            {status === 'COMPLETED' ? 'Completed' : status === 'IN_PROGRESS' ? 'Visit in progress' : 'Scheduled'}
          </Badge>
          <span className={cx('text-xs', due.overdue ? 'font-semibold text-red-600' : 'text-slate-500')}>{due.text}</span>
        </div>
      </div>

      {(visits.stale || patient.stale) && (
        <Alert tone="amber" title="Offline — using the copy saved on this device">
          Visit details from {fmtDateTime(visits.cachedAt ?? patient.cachedAt)}. Anything you record is stored here and synced automatically.
        </Alert>
      )}

      <Card>
        <CardTitle>Reason for follow-up</CardTitle>
        <p className="text-sm text-slate-800">{visit.referral.reason}</p>
        {visit.patient.diagnosisNote && visit.patient.diagnosisNote !== visit.referral.reason && (
          <p className="mt-1 text-sm text-slate-500">{visit.patient.diagnosisNote}</p>
        )}
      </Card>

      {saved && <Alert tone="green" action={<button className="text-xs font-semibold underline" onClick={() => setSaved(null)}>Dismiss</button>}>{saved}</Alert>}
      {rejected.map((op) => (
        <Alert
          key={op.localOperationId}
          tone="red"
          title={`${op.meta?.label ?? 'Change'} was rejected by the server`}
          action={<Button variant="secondary" onClick={() => void getSyncEngine().discard(op.localOperationId)}>Discard</Button>}
        >
          {op.lastError}
        </Alert>
      ))}

      {status !== 'COMPLETED' && (
        <Card>
          <CardTitle>Record vital signs</CardTitle>
          <form onSubmit={saveVitals} className="space-y-4" noValidate={false}>
            {formError && <Alert>{formError}</Alert>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Systolic BP" htmlFor="sys"><Input id="sys" type="number" inputMode="numeric" min={50} max={260} placeholder="mmHg" value={vitals.systolic} onChange={setV('systolic')} /></Field>
              <Field label="Diastolic BP" htmlFor="dia"><Input id="dia" type="number" inputMode="numeric" min={30} max={160} placeholder="mmHg" value={vitals.diastolic} onChange={setV('diastolic')} /></Field>
              <Field label="Pulse" htmlFor="pulse"><Input id="pulse" type="number" inputMode="numeric" min={20} max={250} placeholder="bpm" value={vitals.pulse} onChange={setV('pulse')} /></Field>
              <Field label="Temperature" htmlFor="temp"><Input id="temp" type="number" inputMode="decimal" step="0.1" min={30} max={44} placeholder="°C" value={vitals.temperature} onChange={setV('temperature')} /></Field>
              <Field label="SpO₂" htmlFor="spo2"><Input id="spo2" type="number" inputMode="numeric" min={50} max={100} placeholder="%" value={vitals.spo2} onChange={setV('spo2')} /></Field>
              <Field label="General condition" htmlFor="cond">
                <Select id="cond" value={vitals.generalCondition} onChange={setV('generalCondition')}>
                  <option value="">—</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="POOR">Poor</option><option value="CRITICAL">Critical</option>
                </Select>
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-700">Symptoms</legend>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => {
                  const on = symptoms.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      aria-pressed={on}
                      onClick={() => setSymptoms((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
                      className={cx('min-h-9 rounded-full border px-3 text-sm', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700')}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <Input className="mt-2" placeholder="Other symptoms, comma separated (any language)" maxLength={300} value={vitals.other} onChange={setV('other')} />
            </fieldset>
            <Field label="Notes" htmlFor="notes"><Textarea id="notes" rows={2} maxLength={1000} value={vitals.notes} onChange={setV('notes')} /></Field>
            <Button type="submit" loading={saving} className="w-full sm:w-auto">Save observation</Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Observations this visit</CardTitle>
        <VitalsTable
          observations={[...localObs.map(toObservation), ...serverObs.filter((o) => !localObs.some((l) => l.entityId === o.clientId))]}
          pendingIds={new Set(localObs.map((o) => o.entityId))}
        />
      </Card>

      {patient.data && <RiskCard assessment={patient.data.riskAssessments[0]} />}
      {!sync.online && localObs.length > 0 && (
        <p className="text-xs text-slate-500">AI risk assessment runs on the server after these observations sync.</p>
      )}

      {status !== 'COMPLETED' && (
        <Card>
          <CardTitle>Complete visit</CardTitle>
          <form onSubmit={complete} className="space-y-3">
            <Field label="Outcome / plan" htmlFor="outcome"><Textarea id="outcome" rows={2} maxLength={2000} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. BP controlled, medication adherence discussed" /></Field>
            {riskLevel === 'HIGH' && patientStatus === 'STABLE' && (
              <Alert tone="amber">AI risk is high for this patient. Confirm with the family doctor before closing follow-up as stable.</Alert>
            )}
            <Field label="Patient status after visit" htmlFor="pst">
              <Select id="pst" value={patientStatus} onChange={(e) => setPatientStatus(e.target.value as 'STABLE' | 'IN_FOLLOW_UP')}>
                <option value="STABLE">Stable — follow-up complete</option>
                <option value="IN_FOLLOW_UP">Needs continued follow-up</option>
              </Select>
            </Field>
            <Button type="submit" variant="secondary" loading={saving} disabled={serverObs.length + localObs.length === 0}>
              Complete visit
            </Button>
            {serverObs.length + localObs.length === 0 && <p className="text-xs text-slate-500">Record at least one observation first.</p>}
          </form>
        </Card>
      )}
    </div>
  );
}

function VisitPage() {
  const id = useSearchParams().get('id');
  if (!id) return <EmptyState title="No visit selected" />;
  return <Visit id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VisitPage />
    </Suspense>
  );
}
