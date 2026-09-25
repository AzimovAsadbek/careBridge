'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { homeFor, session } from '@/lib/session';
import type { UserProfile } from '@/lib/types';
import { Alert, Button, Field, Input } from '@/components/ui';

const DEMO = [
  { label: 'Admin', email: 'admin@carebridge.uz' },
  { label: 'Hospital doctor', email: 'hospital.doctor@carebridge.uz' },
  { label: 'Family doctor', email: 'doctor@carebridge.uz' },
  { label: 'Rural nurse', email: 'nurse@carebridge.uz' },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ accessToken: string; user: UserProfile }>('/auth/login', { method: 'POST', body: { email, password } });
      session.save(res.accessToken, res.user);
      const next = params.get('next');
      // Only allow same-app relative redirects.
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(res.user.role));
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {params.get('expired') && <Alert tone="amber">Your session expired. Please sign in again.</Alert>}
      {error && <Alert tone="red">{error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>
      {process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false' && (
        <div className="rounded-[var(--radius-control)] border border-line bg-slate-50 p-3">
          <p className="mb-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Demo accounts</span> · password <span className="font-mono">CareBridge2026!</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className="h-9 rounded-[var(--radius-control)] border border-slate-300 bg-white px-2 text-left text-xs font-medium text-slate-800 hover:border-brand-600"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-900 p-12 text-brand-50 lg:flex">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold">CareBridge AI</span>
        </div>
        <div>
          <p className="text-3xl font-semibold leading-tight text-white">Continuity of care from hospital to home — even without internet.</p>
          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            <li>Discharge automatically creates a follow-up referral for the family doctor.</li>
            <li>Rural nurses record home visits offline; data syncs when the connection returns.</li>
            <li>AI risk prioritization and patient-voice analysis — decision support, never diagnosis.</li>
          </ul>
        </div>
        <p className="text-xs text-brand-200">Demo environment · all patient data is fictional</p>
      </section>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/icon.svg" alt="" className="h-10 w-10" />
            <div>
              <p className="text-lg font-semibold tracking-tight">CareBridge AI</p>
              <p className="text-sm text-slate-600">Continuity of care, hospital to home</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">Use your CareBridge staff account.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
