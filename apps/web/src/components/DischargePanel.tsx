'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import type { PatientDetail, Priority, StaffMember } from '@/lib/types';
import { Alert, Button, Card, CardTitle, Field, Select, Textarea } from './ui';

const WINDOW: Record<Priority, string> = { HIGH: 'home visit within 48 hours', MEDIUM: 'within 7 days', LOW: 'within 14 days' };

export function DischargePanel({ patient, onDone, onCancel }: { patient: PatientDetail; onDone: (msg: string) => void; onCancel: () => void }) {
  const doctors = useResource<StaffMember[]>('/users?role=DOCTOR');
  const [priority, setPriority] = useState<Priority>('HIGH');
  const [reason, setReason] = useState(patient.diagnosisNote ?? '');
  const [summary, setSummary] = useState('');
  const [doctorId, setDoctorId] = useState(patient.familyDoctor?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ assignedDoctor: { fullName: string } }>(`/patients/${patient.id}/discharge`, {
        method: 'POST',
        body: { priority, reason, dischargeSummary: summary || undefined, familyDoctorId: doctorId || undefined },
      });
      onDone(`Discharged. Follow-up referral sent to ${res.assignedDoctor.fullName}.`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <Card className="border-brand-200 ring-1 ring-brand-100">
      <CardTitle description="The family doctor receives an active follow-up referral with a deadline.">Discharge and refer for follow-up</CardTitle>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <Field label="Follow-up priority" htmlFor="prio" hint={`Deadline: ${WINDOW[priority]}`}>
          <Select id="prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="HIGH">High — serious condition</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
        </Field>
        <Field label="Receiving family doctor" htmlFor="doc">
          <Select id="doc" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select doctor</option>
            {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName} · {d.facility.name}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Reason for follow-up" htmlFor="reason"><Textarea id="reason" required minLength={3} maxLength={500} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Discharge summary for the family doctor" htmlFor="sum" optional hint="Medications, instructions, warning signs">
            <Textarea id="sum" maxLength={2000} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4 sm:col-span-2">
          <Button type="submit" loading={saving}>Discharge and send referral</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
