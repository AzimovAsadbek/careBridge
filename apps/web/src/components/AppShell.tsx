'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { session } from '@/lib/session';
import { clearLocalData } from '@/lib/db';
import type { Role, UserProfile } from '@/lib/types';
import { SyncIndicator } from './SyncIndicator';
import { cx, Loading } from './ui';

const NAV: { href: string; label: string; roles: Role[]; icon: string }[] = [
  { href: '/dashboard', label: 'Command center', roles: ['ADMIN'], icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { href: '/doctor', label: 'Referrals', roles: ['DOCTOR', 'ADMIN'], icon: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4' },
  { href: '/nurse', label: 'My visits', roles: ['NURSE'], icon: 'M3 12l2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6' },
  { href: '/patients', label: 'Patients', roles: ['ADMIN', 'DOCTOR', 'NURSE'], icon: 'M17 20h5v-2a3 3 0 0 0-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 0 1 5.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 0 1 9.28 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { href: '/feedback', label: 'Patient voice', roles: ['ADMIN'], icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z' },
];

function Icon({ d }: { d: string }) {
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = session.user;
    if (!session.token || !u) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setUser(u);
    setReady(true);
  }, [router, pathname]);

  if (!ready || !user) return <Loading label="Checking session…" />;

  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const signOut = async () => {
    session.clear();
    await clearLocalData().catch(() => undefined);
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-slate-900">CareBridge<span className="text-brand-600"> AI</span></span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                pathname.startsWith(n.href) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon d={n.icon} /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-sm">
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">
            {user.role.toLowerCase()} · {user.facility.name}
          </p>
          <button onClick={signOut} className="mt-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <Link href="/" className="flex items-center gap-2 md:hidden">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span className="sr-only">CareBridge AI</span>
          </Link>
          <SyncIndicator compact />
          <button onClick={signOut} className="text-xs font-semibold text-slate-600 md:hidden">
            Sign out
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10">{children}</main>
        <footer className="hidden px-6 pb-6 text-xs text-slate-400 md:block">
          AI outputs are decision support only. Final clinical decisions rest with qualified healthcare professionals.
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', pathname.startsWith(n.href) ? 'text-brand-700' : 'text-slate-500')}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
