'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { session } from '@/lib/session';
import { clearLocalData } from '@/lib/db';
import type { Role, UserProfile } from '@/lib/types';
import { SyncIndicator } from './SyncIndicator';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from '@/lib/i18n';
import { cx, Skeleton } from './ui';

type NavKey = 'overview' | 'referrals' | 'visits' | 'patients' | 'voice';
const NAV: { href: string; key: NavKey; roles: Role[]; icon: string }[] = [
  { href: '/dashboard', key: 'overview', roles: ['ADMIN'], icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { href: '/doctor', key: 'referrals', roles: ['DOCTOR', 'ADMIN'], icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4' },
  { href: '/nurse', key: 'visits', roles: ['NURSE'], icon: 'M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6' },
  { href: '/patients', key: 'patients', roles: ['ADMIN', 'DOCTOR', 'NURSE'], icon: 'M17 20h5v-2a3 3 0 0 0-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 0 1 5.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 0 1 9.28 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { href: '/feedback', key: 'voice', roles: ['ADMIN'], icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z' },
];


function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useI18n();
  const label = (k: NavKey, short = false) =>
    ({
      overview: t.nav.overview,
      referrals: t.nav.referrals,
      visits: short ? t.nav.visitsShort : t.nav.homeVisits,
      patients: t.nav.patients,
      voice: short ? t.nav.feedbackShort : t.nav.patientVoice,
    })[k];

  useEffect(() => {
    const u = session.user;
    if (!session.token || !u) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setUser(u);
  }, [router, pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <span className="sr-only" role="status">
          {t.nav.checkingSession}
        </span>
      </div>
    );
  }

  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const signOut = async () => {
    session.clear();
    await clearLocalData().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        {t.nav.skip}
      </a>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">
            CareBridge<span className="text-brand-600"> AI</span>
          </span>
        </Link>
        <nav aria-label={t.nav.main} className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? 'page' : undefined}
              className={cx(
                'flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium',
                isActive(n.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <NavIcon d={n.icon} /> {label(n.key)}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700" aria-hidden>
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">
                {t.roles[user.role]} · {user.facility.name}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="mt-3 h-8 w-full rounded-[var(--radius-control)] border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {t.nav.signOut}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-6">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">CareBridge</span>
          </Link>
          <p className="hidden min-w-0 truncate text-sm text-slate-500 md:block">
            {t.nav.workspace(t.roles[user.role])} · <span className="text-slate-700">{user.facility.name}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <SyncIndicator compact />
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            <div className="relative md:hidden">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={t.nav.accountMenu}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
              >
                {initials(user.fullName)}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-11 w-64 rounded-[var(--radius-card)] border border-line bg-white p-3 shadow-lg">
                  <p className="text-sm font-semibold text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {t.roles[user.role]} · {user.facility.name}
                  </p>
                  <LanguageSwitcher className="mt-3" />
                  <button role="menuitem" onClick={signOut} className="mt-3 h-9 w-full rounded-[var(--radius-control)] border border-slate-300 text-sm font-semibold text-slate-700">
                    {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 md:pb-12">
          {children}
        </main>
      </div>

      <nav aria-label={t.nav.main} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(n.href) ? 'page' : undefined}
            className={cx(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
              isActive(n.href) ? 'text-brand-700' : 'text-slate-500',
            )}
          >
            <NavIcon d={n.icon} />
            {label(n.key, true)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
