'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { useResource } from '@/lib/resource';
import type { PatientListItem, StaffMember } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Card, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';

export default function NewPatientPage() {
  const router = useRouter();
  const doctors = useResource<StaffMember[]>('/users?role=DOCTOR');
  const [form, setForm] = useState({ fullName: '', birthDate: '', sex: 'FEMALE', phone: '', address: '', district: '', diagnosisNote: '', familyDoctorId: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();
  const n = t.newPatient;
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
      <PageHeader back={{ href: '/patients', label: t.nav.patients }} title={n.title} subtitle={n.subtitle} />
      <Card className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
          <div className="sm:col-span-2">
            <Field label={n.fullName} htmlFor="fullName"><Input id="fullName" required minLength={2} maxLength={120} value={form.fullName} onChange={set('fullName')} /></Field>
          </div>
          <Field label={n.birthDate} htmlFor="birthDate"><Input id="birthDate" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={set('birthDate')} /></Field>
          <Field label={n.sex} htmlFor="sex">
            <Select id="sex" value={form.sex} onChange={set('sex')}><option value="FEMALE">{t.common.female}</option><option value="MALE">{t.common.male}</option></Select>
          </Field>
          <Field label={n.phone} htmlFor="phone" optional><Input id="phone" type="tel" inputMode="tel" pattern="\+?[0-9 ()\-]{7,20}" value={form.phone} onChange={set('phone')} /></Field>
          <Field label={n.district} htmlFor="district"><Input id="district" required minLength={2} value={form.district} onChange={set('district')} /></Field>
          <div className="sm:col-span-2">
            <Field label={n.address} htmlFor="address" hint={n.addressHint}><Input id="address" required minLength={3} value={form.address} onChange={set('address')} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={n.familyDoctor} htmlFor="fd" hint={n.familyDoctorHint}>
              <Select id="fd" value={form.familyDoctorId} onChange={set('familyDoctorId')}>
                <option value="">{n.selectLater}</option>
                {doctors.data?.map((d) => <option key={d.id} value={d.id}>{d.fullName} · {d.facility.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={n.note} htmlFor="dx" optional hint={n.noteHint}><Textarea id="dx" rows={2} maxLength={500} value={form.diagnosisNote} onChange={set('diagnosisNote')} /></Field>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4 sm:col-span-2">
            <Button type="submit" loading={saving}>{n.create}</Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>{t.common.cancel}</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
