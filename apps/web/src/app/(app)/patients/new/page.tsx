'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import type { PatientListItem, StaffMember } from '@/lib/types';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';

export default function NewPatientPage() {
  const router = useRouter();
  const doctors = useResource<StaffMember[]>('/users?role=DOCTOR');
  const [form, setForm] = useState({ fullName: '', birthDate: '', sex: 'FEMALE', phone: '', address: '', district: '', diagnosisNote: '', familyDoctorId: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      const p = await api<PatientListItem>('/patients', { method: 'POST', body });
      router.replace(`/patients/${p.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="New patient" subtitle="Register a patient admitted to your facility." />
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <div className="sm:col-span-2">
            <Field label="Full name" htmlFor="fullName"><Input id="fullName" required minLength={2} maxLength={120} value={form.fullName} onChange={set('fullName')} /></Field>
          </div>
          <Field label="Date of birth" htmlFor="birthDate"><Input id="birthDate" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={set('birthDate')} /></Field>
          <Field label="Sex" htmlFor="sex">
            <Select id="sex" value={form.sex} onChange={set('sex')}><option value="FEMALE">Female</option><option value="MALE">Male</option></Select>
          </Field>
          <Field label="Phone" htmlFor="phone" hint="Optional"><Input id="phone" type="tel" inputMode="tel" pattern="\+?[0-9 ()\-]{7,20}" value={form.phone} onChange={set('phone')} /></Field>
          <Field label="District" htmlFor="district"><Input id="district" required minLength={2} value={form.district} onChange={set('district')} /></Field>
          <div className="sm:col-span-2">
            <Field label="Home address" htmlFor="address" hint="Used by the nurse for the home visit"><Input id="address" required minLength={3} value={form.address} onChange={set('address')} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Family doctor" htmlFor="fd" hint="Receives the follow-up referral at discharge">
              <Select id="fd" value={form.familyDoctorId} onChange={set('familyDoctorId')}>
                <option value="">— Select later —</option>
                {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName} · {d.facility.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Admission note" htmlFor="dx" hint="Short clinical context (optional)"><Textarea id="dx" rows={2} maxLength={500} value={form.diagnosisNote} onChange={set('diagnosisNote')} /></Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={saving}>Create patient</Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
