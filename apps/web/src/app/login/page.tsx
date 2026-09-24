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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Demo accounts · password <span className="font-mono normal-case">CareBridge2026!</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-brand-200"
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">CareBridge AI</h1>
            <p className="text-sm text-slate-500">Continuity of care, hospital to home.</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
