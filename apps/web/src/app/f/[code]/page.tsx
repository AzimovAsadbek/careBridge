'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { API_URL } from '@/lib/api';
import { Alert, Button, Field, Icon, Input, Loading, Textarea, cx } from '@/components/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

type Facility = { publicCode: string; name: string; type: string; district: string };
const TYPES = ['COMPLAINT', 'SUGGESTION', 'PRAISE', 'OTHER'] as const;
type LoadError = 'invalid' | 'later' | 'noInternet';
type SendError = 'chooseRating' | 'tooMany' | 'sendFailed' | 'noConnection';

/** Public, anonymous feedback form reached by scanning a ward QR code. Uses no session. */
export default function PublicFeedbackPage() {
  const { code } = useParams<{ code: string }>();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const { t } = useI18n();
  const q = t.qr;
  const [rating, setRating] = useState(0);
  const [type, setType] = useState<(typeof TYPES)[number]>('COMPLAINT');
  const [ward, setWard] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<SendError | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/facilities/${encodeURIComponent(code)}`)
      .then(async (r) => (r.ok ? setFacility(await r.json()) : setLoadError(r.status === 404 ? 'invalid' : 'later')))
      .catch(() => setLoadError('noInternet'));
  }, [code]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError('chooseRating');
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
      if (!r.ok) {
        setError(r.status === 429 ? 'tooMany' : 'sendFailed');
        setState('error');
        return;
      }
      setState('sent');
    } catch {
      setError('noConnection');
      setState('error');
    }
  }

  const RATING_LABELS = q.ratings;
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
            <p className="text-xs font-medium text-slate-500">{q.header}</p>
            <h1 className="truncate text-base font-semibold text-slate-900">{facility?.name ?? 'CareBridge'}</h1>
          </div>
          <span className="inline-flex h-7 items-center gap-1 rounded-full bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <Icon name="lock" className="h-3.5 w-3.5" /> {q.anonymous}
          </span>
        </div>
        <div className="mx-auto flex max-w-md justify-end px-4 pb-3">
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {loadError ? (
          <Alert>{q[loadError]}</Alert>
        ) : !facility ? (
          <Loading label={q.loading} rows={3} />
        ) : state === 'sent' ? (
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-8 text-center shadow-[var(--shadow-card)]" role="status">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Icon name="checkCircle" className="h-7 w-7" />
            </span>
            <p className="mt-4 text-lg font-semibold text-slate-900">{q.thanks}</p>
            <p className="mt-1 text-sm text-slate-600">{q.thanksBody}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{q.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{q.intro}</p>
            </div>
            {error && <Alert>{q[error]}</Alert>}

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-900">{q.rating}</legend>
              <div className="flex gap-2" role="radiogroup" aria-label={q.ratingGroup} onKeyDown={onRatingKey}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${q.ofFive(n)} — ${RATING_LABELS[n]}`}
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
              <legend className="mb-2 text-sm font-semibold text-slate-900">{q.about}</legend>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    aria-pressed={type === ty}
                    onClick={() => setType(ty)}
                    className={cx(
                      'h-12 rounded-[var(--radius-control)] border text-sm font-medium',
                      type === ty ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                    )}
                  >
                    {t.enums.feedbackType[ty]}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label={q.text} htmlFor="text" optional hint={q.textHint(text.length)}>
              <Textarea id="text" rows={5} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Field label={q.ward} htmlFor="ward" optional>
              <Input id="ward" maxLength={40} value={ward} onChange={(e) => setWard(e.target.value)} placeholder={q.wardPlaceholder} />
            </Field>

            <div className="space-y-3">
              <Button type="submit" size="lg" loading={state === 'sending'} className="w-full">
                <Icon name="lock" className="h-4 w-4" /> {q.send}
              </Button>
              <p className="flex items-start gap-2 text-xs text-slate-600">
                <Icon name="shield" className="mt-0.5 h-3.5 w-3.5" />
                {q.privacy}
              </p>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
