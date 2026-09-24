'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { API_URL } from '@/lib/api';
import { Alert, Button, Field, Input, Loading, Textarea, cx } from '@/components/ui';

type Facility = { publicCode: string; name: string; type: string; district: string };
const TYPES = [
  { value: 'COMPLAINT', label: 'Complaint' },
  { value: 'SUGGESTION', label: 'Suggestion' },
  { value: 'PRAISE', label: 'Thanks' },
  { value: 'OTHER', label: 'Other' },
] as const;

/** Public, anonymous feedback form reached by scanning a ward QR code. Uses no session. */
export default function PublicFeedbackPage() {
  const { code } = useParams<{ code: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('COMPLAINT');
  const [ward, setWard] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/facilities/${encodeURIComponent(code)}`)
      .then(async (r) => (r.ok ? setFacility(await r.json()) : setLoadError(r.status === 404 ? 'This QR code is not valid.' : 'Please try again later.')))
      .catch(() => setLoadError('No internet connection. Please try again later.'));
  }, [code]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError('Please choose a rating.');
      return;
    }
    setState('sending');
    setError(null);
    try {
      const r = await fetch(`${API_URL}/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityCode: facility!.publicCode, rating, type, ward: ward.trim() || undefined, text: text.trim() || undefined }),
      });
      if (r.status === 429) throw new Error('Too many submissions from this device. Please wait a minute.');
      if (!r.ok) throw new Error('Your feedback could not be sent. Please check the form.');
      setState('sent');
    } catch (err) {
      setError(err instanceof TypeError ? 'No internet connection. Please try again.' : (err as Error).message);
      setState('error');
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-10 w-10" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Patient voice · Bemor fikri</p>
          <h1 className="text-lg font-bold leading-tight">{facility?.name ?? 'Anonymous feedback'}</h1>
        </div>
      </div>

      {loadError ? (
        <Alert>{loadError}</Alert>
      ) : !facility ? (
        <Loading />
      ) : state === 'sent' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-semibold text-emerald-800">Thank you! · Rahmat!</p>
          <p className="mt-1 text-sm text-emerald-700">Your anonymous feedback was received and will be reviewed by the facility administration.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Alert tone="blue">Anonymous — we do not ask for or store your name, phone or any personal data.</Alert>
          {error && <Alert>{error}</Alert>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">How was your experience? · Qanday baholaysiz?</legend>
            <div className="flex justify-between gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} of 5`}
                  onClick={() => setRating(n)}
                  className={cx('h-12 flex-1 rounded-lg border text-2xl', n <= rating ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-200 text-slate-300')}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Type</legend>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button key={t.value} type="button" aria-pressed={type === t.value} onClick={() => setType(t.value)} className={cx('min-h-10 rounded-lg border text-sm font-medium', type === t.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-700')}>
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Ward / room (optional)" htmlFor="ward"><Input id="ward" maxLength={40} value={ward} onChange={(e) => setWard(e.target.value)} placeholder="e.g. Cardiology 3" /></Field>
          <Field label="Your feedback (any language)" htmlFor="text" hint={`${text.length}/1000 · Please do not include names or phone numbers.`}>
            <Textarea id="text" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button type="submit" loading={state === 'sending'} className="w-full">Send anonymously</Button>
        </form>
      )}
    </div>
  );
}
