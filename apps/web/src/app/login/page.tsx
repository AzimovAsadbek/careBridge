'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { homeFor, session } from '@/lib/session';
import type { UserProfile } from '@/lib/types';
import { Alert, Button, Field, Input } from '@/components/ui';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

const DEMO = [
  { key: 'admin', email: 'admin@carebridge.uz' },
  { key: 'hospitalDoctor', email: 'hospital.doctor@carebridge.uz' },
  { key: 'familyDoctor', email: 'doctor@carebridge.uz' },
  { key: 'nurse', email: 'nurse@carebridge.uz' },
] as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

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
      {params.get('expired') && <Alert tone="amber">{t.errors.sessionExpired}</Alert>}
      {error && <Alert tone="red">{error}</Alert>}
      <Field label={t.login.email} htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t.login.password} htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        {t.login.signIn}
      </Button>
      {process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== 'false' && (
        <div className="rounded-[var(--radius-control)] border border-line bg-slate-50 p-3">
          <p className="mb-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{t.login.demoAccounts}</span> · {t.login.password_} <span className="font-mono">CareBridge2026!</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className="h-9 rounded-[var(--radius-control)] border border-slate-300 bg-white px-2 text-left text-xs font-medium text-slate-800 hover:border-brand-600"
              >
                {t.login.demo[d.key]}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-900 p-12 text-brand-50 lg:flex">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold">CareBridge AI</span>
        </div>
        <div>
          <p className="text-3xl font-semibold leading-tight text-white">{t.login.heroTitle}</p>
          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            {t.login.hero.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">{t.login.demoEnv}</p>
      </section>

      <main className="relative flex items-center justify-center px-4 py-16">
        <LanguageSwitcher className="absolute right-4 top-4" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/icon.svg" alt="" className="h-10 w-10" />
            <div>
              <p className="text-lg font-semibold tracking-tight">CareBridge AI</p>
              <p className="text-sm text-slate-600">{t.login.tagline}</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t.login.title}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-600">{t.login.subtitle}</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
