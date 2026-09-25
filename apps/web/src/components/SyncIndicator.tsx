'use client';

import { useEffect, useState } from 'react';
import { getSyncEngine, startSync, useSyncState } from '@/lib/sync';
import type { SyncState } from '@/lib/sync-engine';
import { Icon, cx, type IconName } from './ui';

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

type Kind = 'offline' | 'syncing' | 'queued' | 'synced';
interface View {
  kind: Kind;
  icon: IconName;
  short: string;
  label: string;
  tone: string;
}

/** Single source of truth for how connectivity + outbox state is described. */
export function describeSync(s: SyncState): View {
  const queued = s.pending + s.failed;
  const n = (k: number) => `${k} change${k === 1 ? '' : 's'}`;
  if (!s.online) {
    return {
      kind: 'offline',
      icon: 'cloudOff',
      short: queued ? `Offline · ${queued} to sync` : 'Offline',
      label: queued ? `Offline · ${n(queued)} saved on this device` : 'Offline · working on this device',
      tone: 'bg-amber-50 text-amber-950 ring-amber-300',
    };
  }
  if (s.syncing) {
    return { kind: 'syncing', icon: 'refresh', short: 'Syncing…', label: `Syncing ${n(queued)}…`, tone: 'bg-sky-50 text-sky-900 ring-sky-200' };
  }
  if (queued) {
    return { kind: 'queued', icon: 'clock', short: `${queued} to sync`, label: `${n(queued)} waiting to sync`, tone: 'bg-amber-50 text-amber-950 ring-amber-300' };
  }
  return {
    kind: 'synced',
    icon: 'cloudCheck',
    short: 'Synced',
    label: s.lastSyncAt ? `Online · synced ${ago(s.lastSyncAt)}` : 'Online · all changes synced',
    tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  };
}

/** Compact, always-visible connectivity + outbox status for the app header. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const s = useSyncState();
  const [, tick] = useState(0);
  useEffect(() => {
    startSync();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const v = describeSync(s);

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className={cx('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset', v.tone)}>
        <Icon name={v.icon} className={cx('h-4 w-4', v.kind === 'syncing' && 'animate-spin')} />
        {compact ? (
          <>
            <span className="lg:hidden">{v.short}</span>
            <span className="hidden lg:inline">{v.label}</span>
          </>
        ) : (
          v.label
        )}
      </span>
      {s.online && s.failed > 0 && !s.syncing && (
        <button onClick={() => void getSyncEngine().retryNow()} className="h-8 rounded-full px-2 text-xs font-semibold text-brand-700 underline underline-offset-2">
          Sync now
        </button>
      )}
      {s.rejected > 0 && (
        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-red-50 px-3 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200">
          <Icon name="alert" className="h-3.5 w-3.5" /> {s.rejected} rejected
        </span>
      )}
    </div>
  );
}

/** Large, explicit status for offline-first screens (nurse visit). */
export function SyncBanner({ savedAt }: { savedAt?: string | null }) {
  const s = useSyncState();
  const v = describeSync(s);
  const copy: Record<Kind, { title: string; body: string }> = {
    offline: {
      title: 'You are offline',
      body: `Everything you record is saved on this device${savedAt ? ` (visit data from ${savedAt})` : ''} and will sync automatically when the connection returns.`,
    },
    queued: { title: 'Waiting to sync', body: 'Changes are saved on this device and will be sent to the server shortly.' },
    syncing: { title: 'Syncing', body: 'Sending changes from this device to the server…' },
    synced: {
      title: 'All changes synced',
      body: s.lastSyncAt ? `Last synced ${ago(s.lastSyncAt)}. The server has everything recorded on this device.` : 'Connected. Anything you record is sent to the server immediately.',
    },
  };
  const c = copy[v.kind];
  return (
    <div role="status" aria-live="polite" className={cx('flex gap-3 rounded-[var(--radius-card)] px-4 py-3 ring-1 ring-inset', v.tone)}>
      <Icon name={v.icon} className={cx('mt-0.5 h-5 w-5', v.kind === 'syncing' && 'animate-spin')} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {c.title}
          {(v.kind === 'offline' || v.kind === 'queued') && s.pending + s.failed > 0 && ` · ${s.pending + s.failed} on device`}
        </p>
        <p className="text-sm opacity-90">{c.body}</p>
      </div>
    </div>
  );
}
