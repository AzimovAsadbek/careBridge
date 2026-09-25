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
import { Avatar, cx, Icon, Skeleton } from './ui';

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

      <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-line bg-white md:flex lg:w-60">
        <Link href="/" className="flex h-16 items-center gap-2.5 px-[22px] lg:px-5">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="hidden text-[16px] font-semibold tracking-tight text-slate-900 lg:inline">
            CareBridge<span className="font-normal text-slate-400"> AI</span>
          </span>
        </Link>
        <nav aria-label={t.nav.main} className="flex-1 space-y-0.5 px-3 pt-2">
          {nav.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                title={label(n.key)}
                className={cx(
                  'relative flex h-10 items-center justify-center gap-3 rounded-[var(--radius-control)] px-3 text-sm transition-colors lg:h-9 lg:justify-start',
                  active ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                {active && <span aria-hidden className="absolute -left-3 top-2 h-5 w-[3px] rounded-r-full bg-brand-600" />}
                <span className={active ? 'text-brand-600' : 'text-slate-400'}>
                  <NavIcon d={n.icon} />
                </span>
                <span className="sr-only lg:not-sr-only">{label(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-line p-3">
          <div className="hidden lg:block">
            <LanguageSwitcher className="w-full justify-between [&>button]:flex-1" />
          </div>
          <div className="flex flex-col items-center gap-2 px-1 lg:flex-row lg:gap-3">
            <Avatar name={user.fullName} size="sm" />
            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
              <p className="truncate text-xs text-slate-500">{t.roles[user.role]}</p>
            </div>
            <button
              onClick={signOut}
              title={t.nav.signOut}
              aria-label={t.nav.signOut}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6 md:h-16">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="text-[15px] font-semibold tracking-tight">CareBridge</span>
          </Link>
          <p className="hidden min-w-0 items-center gap-1.5 truncate text-meta text-slate-500 md:flex">
            <Icon name="mapPin" className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate text-slate-700">{user.facility.name}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{t.nav.workspace(t.roles[user.role])}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <SyncIndicator compact />
            <div className="hidden md:block lg:hidden">
              <LanguageSwitcher />
            </div>
            <div className="relative md:hidden">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={t.nav.accountMenu}
                className="flex h-10 w-10 items-center justify-center rounded-full"
              >
                <Avatar name={user.fullName} size="sm" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-12 w-72 animate-enter rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-[var(--shadow-pop)]">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.fullName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {t.roles[user.role]} · {user.facility.name}
                      </p>
                    </div>
                  </div>
                  <p className="mb-1.5 mt-4 text-xs text-slate-500">{t.common.language}</p>
                  <LanguageSwitcher className="w-full [&>button]:h-9 [&>button]:flex-1" />
                  <button
                    role="menuitem"
                    onClick={signOut}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300"
                  >
                    <Icon name="logout" /> {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-5 outline-none sm:px-6 sm:pt-8 md:pb-12">
          <div key={pathname} className="animate-enter">
            {children}
          </div>
        </main>
      </div>

      <nav aria-label={t.nav.main} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? 'page' : undefined}
              className={cx('relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-medium text-slate-900' : 'text-slate-500')}
            >
              {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand-600" />}
              <span className={active ? 'text-brand-600' : 'text-slate-400'}>
                <NavIcon d={n.icon} />
              </span>
              {label(n.key, true)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
