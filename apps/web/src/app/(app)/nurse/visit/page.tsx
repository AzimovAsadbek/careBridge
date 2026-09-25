'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useResource } from '@/lib/resource';
import { errorMessage } from '@/lib/api';
import { age, fmtDateTime } from '@/lib/format';
import { queueFollowUpStatus, queueObservation, useOutbox } from '@/lib/outbox';
import { getSyncEngine, useSyncState } from '@/lib/sync';
import { usePollWhile } from '@/lib/poll';
import type { GeneralCondition, NurseVisit, Observation, PatientDetail } from '@/lib/types';
import type { OutboxOp } from '@/lib/db';
import { DeadlineChip, FollowUpStatusBadge, PriorityBadge, RiskBadge } from '@/components/badges';
import { RiskCard, VitalsTable } from '@/components/clinical';
import { Alert, Button, ButtonLink, Card, CardTitle, EmptyState, ErrorState, Field, FormSection, Icon, Input, Loading, PageHeader, Select, Textarea, UnitInput, cx } from '@/components/ui';
import { SyncBanner } from '@/components/SyncIndicator';
import { useI18n } from '@/lib/i18n';

/** Outbox labels are stored in English; map them to dictionary keys for display. */
const OP_LABEL: Record<string, 'observation' | 'started' | 'completed'> = { 'Vital signs': 'observation', 'Visit started': 'started', 'Visit completed': 'completed' };

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
  const { t } = useI18n();
  const tv = t.visit;

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
      <EmptyState
        title={tv.notAvailable}
        icon="wifiOff"
        action={
          <ButtonLink href="/nurse" variant="secondary" size="sm">
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {tv.back}
          </ButtonLink>
        }
      >
        {tv.notAvailableHint}
      </EmptyState>
    );
  }

  const rank = { SCHEDULED: 0, IN_PROGRESS: 1, COMPLETED: 2 } as const;
  const status = lastLocalStatus && rank[lastLocalStatus] > rank[visit.status] ? lastLocalStatus : visit.status;
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
      setFormError(tv.needData);
      return;
    }
    setSaving(true);
    try {
      if (status === 'SCHEDULED') await queueFollowUpStatus(id, visit!.patient.id, { status: 'IN_PROGRESS' });
      await queueObservation(visit!.patient.id, id, payload);
      setVitals(emptyVitals);
      setSymptoms([]);
      setSaved(tv.saved);
    } catch {
      setFormError(tv.storageError);
    } finally {
      setSaving(false);
    }
  }

  async function complete(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await queueFollowUpStatus(id, visit!.patient.id, { status: 'COMPLETED', outcome: outcome.trim() || undefined, patientStatus });
      setSaved(tv.completedSaved);
    } finally {
      setSaving(false);
    }
  }

  const setV = (k: keyof typeof emptyVitals) => (e: { target: { value: string } }) => setVitals((v) => ({ ...v, [k]: e.target.value }));

  const hasObs = serverObs.length + localObs.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/nurse', label: tv.back }}
        eyebrow={tv.eyebrow}
        title={visit.patient.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {t.common.years(age(visit.patient.birthDate))} · {visit.patient.sex === 'MALE' ? t.common.male : t.common.female}
            </span>
            <FollowUpStatusBadge status={status} />
            <RiskBadge level={patient.data?.riskLevel ?? visit.patient.riskLevel} />
          </span>
        }
      />

      {/* Not sticky: the header status pill stays visible while the form is filled in. */}
      <SyncBanner savedAt={visits.stale || patient.stale ? fmtDateTime(visits.cachedAt ?? patient.cachedAt) : null} />

      <Card>
        <CardTitle
          description={<DeadlineChip deadline={visit.referral.deadline} />}
          action={<PriorityBadge priority={visit.referral.priority} />}
        >
          {tv.brief}
        </CardTitle>
        <p className="text-sm font-medium text-slate-900">{visit.referral.reason}</p>
        {visit.patient.diagnosisNote && visit.patient.diagnosisNote !== visit.referral.reason && (
          <p className="mt-1 text-sm text-slate-600">{visit.patient.diagnosisNote}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4 text-sm text-slate-700">
          <span className="flex min-w-0 flex-1 items-start gap-1.5">
            <Icon name="mapPin" className="mt-0.5 h-4 w-4 text-slate-400" />
            {visit.patient.address}, {visit.patient.district}
          </span>
          {visit.patient.phone && (
            <a
              href={`tel:${visit.patient.phone}`}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 font-medium text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:h-10 sm:w-auto"
            >
              <Icon name="phone" /> {tv.callPatient}
            </a>
          )}
        </div>
      </Card>

      {saved && (
        <Alert
          tone="green"
          action={
            <button className="h-8 px-1 text-xs font-medium underline underline-offset-2" onClick={() => setSaved(null)}>
              {t.common.dismiss}
            </button>
          }
        >
          {saved}
        </Alert>
      )}
      {rejected.map((op) => (
        <Alert
          key={op.localOperationId}
          tone="red"
          title={tv.rejectedTitle(op.meta?.label && OP_LABEL[op.meta.label] ? tv.labels[OP_LABEL[op.meta.label]] : tv.labels.observation)}
          action={
            <Button variant="secondary" size="sm" onClick={() => void getSyncEngine().discard(op.localOperationId)}>
              {tv.discard}
            </Button>
          }
        >
          {op.lastError}
        </Alert>
      ))}

      {status !== 'COMPLETED' && (
        <Card>
          <CardTitle description={tv.recordDesc}>
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">1</span>
            {tv.record}
          </CardTitle>
          <form onSubmit={saveVitals} className="space-y-6">
            {formError && <Alert>{formError}</Alert>}
            <FormSection title={tv.groups.bp}>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <Field label={tv.f.systolic} htmlFor="sys">
                  <UnitInput unit="mmHg" id="sys" type="number" inputMode="numeric" min={50} max={260} value={vitals.systolic} onChange={setV('systolic')} />
                </Field>
                <Field label={tv.f.diastolic} htmlFor="dia">
                  <UnitInput unit="mmHg" id="dia" type="number" inputMode="numeric" min={30} max={160} value={vitals.diastolic} onChange={setV('diastolic')} />
                </Field>
              </div>
            </FormSection>
            <FormSection title={tv.groups.heart}>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <Field label={tv.f.pulse} htmlFor="pulse">
                  <UnitInput unit={t.risk.bpm} id="pulse" type="number" inputMode="numeric" min={20} max={250} value={vitals.pulse} onChange={setV('pulse')} />
                </Field>
                <Field label={tv.f.spo2} htmlFor="spo2">
                  <UnitInput unit="%" id="spo2" type="number" inputMode="numeric" min={50} max={100} value={vitals.spo2} onChange={setV('spo2')} />
                </Field>
              </div>
            </FormSection>
            <FormSection title={tv.groups.general}>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
                <Field label={tv.f.temperature} htmlFor="temp">
                  <UnitInput unit="°C" id="temp" type="number" inputMode="decimal" step="0.1" min={30} max={44} value={vitals.temperature} onChange={setV('temperature')} />
                </Field>
                <div role="radiogroup" aria-labelledby="cond-label" className="min-w-0">
                  <p id="cond-label" className="mb-1.5 text-[13px] font-medium text-slate-700">
                    {tv.condition}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(['GOOD', 'FAIR', 'POOR', 'CRITICAL'] as const).map((c) => {
                      const on = vitals.generalCondition === c;
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={on}
                          key={c}
                          onClick={() => setVitals((v) => ({ ...v, generalCondition: on ? '' : c }))}
                          className={cx(
                            'h-10 rounded-[var(--radius-control)] border px-2 text-sm transition-colors',
                            on
                              ? c === 'CRITICAL' || c === 'POOR'
                                ? 'border-red-500 bg-red-50 font-medium text-red-800'
                                : 'border-brand-600 bg-brand-50 font-medium text-brand-800'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                          )}
                        >
                          {t.enums.condition[c]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </FormSection>
            <FormSection title={tv.symptoms} description={tv.symptomsHint}>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map((s) => {
                  const on = symptoms.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      aria-pressed={on}
                      onClick={() => setSymptoms((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
                      className={cx(
                        'inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors',
                        on ? 'border-brand-600 bg-brand-50 font-medium text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      {on && <Icon name="check" className="h-3.5 w-3.5" />}
                      {t.enums.symptom[s] ?? s}
                    </button>
                  );
                })}
              </div>
              <label htmlFor="other" className="sr-only">
                {tv.otherSymptoms}
              </label>
              <Input id="other" className="mt-3" placeholder={tv.otherSymptoms} maxLength={300} value={vitals.other} onChange={setV('other')} />
            </FormSection>
            <div className="border-t border-line-soft pt-5">
              <Field label={tv.notes} htmlFor="notes" optional hint={tv.notesHint}>
                <Textarea id="notes" rows={3} maxLength={1000} value={vitals.notes} onChange={setV('notes')} />
              </Field>
            </div>
            <div className="-mx-4 -mb-4 border-t border-line-soft bg-slate-50/70 px-4 py-3 sm:-mx-5 sm:-mb-5 sm:rounded-b-[var(--radius-card)] sm:px-5">
              <Button type="submit" size="lg" loading={saving} className="w-full sm:w-auto">
                <Icon name={sync.online ? 'check' : 'device'} className="h-5 w-5" />
                {sync.online ? tv.saveOnline : tv.saveOffline}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle description={localObs.length ? tv.waiting(localObs.length) : undefined}>{tv.thisVisit}</CardTitle>
        <VitalsTable
          observations={[...localObs.map(toObservation), ...serverObs.filter((o) => !localObs.some((l) => l.entityId === o.clientId))]}
          pendingIds={new Set(localObs.map((o) => o.entityId))}
        />
      </Card>

      {!sync.online && localObs.length > 0 ? (
        <Alert tone="blue" icon="sparkle" title={tv.riskAfterSync}>
          {tv.riskAfterSyncBody}
        </Alert>
      ) : (
        patient.data && <RiskCard assessment={patient.data.riskAssessments[0]} />
      )}

      {status !== 'COMPLETED' && (
        <Card>
          <CardTitle description={tv.completeDesc}>
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-medium text-white">2</span>
            {tv.complete}
          </CardTitle>
          <form onSubmit={complete} className="space-y-4">
            <Field label={tv.outcome} htmlFor="outcome">
              <Textarea id="outcome" rows={3} maxLength={2000} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={tv.outcomePlaceholder} />
            </Field>
            {riskLevel === 'HIGH' && patientStatus === 'STABLE' && (
              <Alert tone="amber">{tv.highRiskWarning}</Alert>
            )}
            <Field label={tv.statusAfter} htmlFor="pst">
              <Select id="pst" value={patientStatus} onChange={(e) => setPatientStatus(e.target.value as 'STABLE' | 'IN_FOLLOW_UP')}>
                <option value="STABLE">{tv.stable}</option>
                <option value="IN_FOLLOW_UP">{tv.continued}</option>
              </Select>
            </Field>
            <Button type="submit" variant="secondary" size="lg" className="w-full sm:w-auto" loading={saving} disabled={!hasObs}>
              {tv.complete}
            </Button>
            {!hasObs && <p className="text-xs text-slate-600">{tv.needObservation}</p>}
          </form>
        </Card>
      )}
    </div>
  );
}

function VisitPage() {
  const id = useSearchParams().get('id');
  const { t } = useI18n();
  if (!id) return <EmptyState title={t.visit.noneSelected} />;
  return <Visit id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VisitPage />
    </Suspense>
  );
}
