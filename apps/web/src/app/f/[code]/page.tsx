'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { API_URL } from '@/lib/api';
import { Alert, Button, Field, Icon, Input, Loading, Textarea, cx } from '@/components/ui';

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

  const RATING_LABELS = ['', 'Very bad · Juda yomon', 'Bad · Yomon', 'Okay · O‘rtacha', 'Good · Yaxshi', 'Excellent · A‘lo'];
  const onRatingKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setRating((r) => Math.min(5, r + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setRating((r) => Math.max(1, r - 1));
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Patient feedback · Bemor fikri</p>
            <h1 className="truncate text-base font-semibold text-slate-900">{facility?.name ?? 'CareBridge'}</h1>
          </div>
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <Icon name="lock" className="h-3.5 w-3.5" /> Anonymous
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {loadError ? (
          <Alert>{loadError}</Alert>
        ) : !facility ? (
          <Loading label="Loading form…" rows={3} />
        ) : state === 'sent' ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]" role="status">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Icon name="checkCircle" className="h-7 w-7" />
            </span>
            <p className="mt-4 text-lg font-semibold text-slate-900">Thank you · Rahmat!</p>
            <p className="mt-1 text-sm text-slate-600">Your anonymous feedback was received and will be reviewed by the facility administration.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">How was your care?</h2>
              <p className="mt-1 text-sm text-slate-600">
                Takes 30 seconds. We never ask for your name or phone, and nothing links this form to you.
              </p>
            </div>
            {error && <Alert>{error}</Alert>}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-900">Your rating · Bahoyingiz</legend>
              <div className="flex gap-2" role="radiogroup" aria-label="Rating from 1 to 5" onKeyDown={onRatingKey}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} of 5 — ${RATING_LABELS[n]}`}
                    tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
                    onClick={() => setRating(n)}
                    className={cx(
                      'h-14 flex-1 rounded-[var(--radius-control)] border text-2xl transition-colors',
                      n <= rating ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-300 bg-white text-slate-300 hover:text-slate-400',
                    )}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-2 h-5 text-sm font-medium text-slate-700" aria-live="polite">
                {rating ? RATING_LABELS[rating] : ''}
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-900">What is it about?</legend>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={type === t.value}
                    onClick={() => setType(t.value)}
                    className={cx(
                      'h-12 rounded-[var(--radius-control)] border text-sm font-medium',
                      type === t.value ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="Your feedback" htmlFor="text" optional hint={`${text.length}/1000 · Any language. Please don’t include names or phone numbers.`}>
              <Textarea id="text" rows={5} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Field label="Ward or room" htmlFor="ward" optional>
              <Input id="ward" maxLength={40} value={ward} onChange={(e) => setWard(e.target.value)} placeholder="e.g. Cardiology 3" />
            </Field>

            <div className="space-y-3">
              <Button type="submit" size="lg" loading={state === 'sending'} className="w-full">
                <Icon name="lock" className="h-4 w-4" /> Send anonymously
              </Button>
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <Icon name="shield" className="mt-0.5 h-3.5 w-3.5" />
                No IP address, device or personal data is stored. Feedback is reviewed by the facility administration.
              </p>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
