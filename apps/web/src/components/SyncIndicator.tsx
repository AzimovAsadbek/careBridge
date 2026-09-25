'use client';

import { useEffect, useState } from 'react';
import { getSyncEngine, startSync, useSyncState } from '@/lib/sync';
import type { SyncState } from '@/lib/sync-engine';
import { Icon, cx, type IconName } from './ui';
import { ago } from '@/lib/format';
import { getDict, useI18n } from '@/lib/i18n';

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
  const t = getDict().sync;
  const queued = s.pending + s.failed;
  if (!s.online) {
    return {
      kind: 'offline',
      icon: 'cloudOff',
      short: queued ? t.offlineShort(queued) : t.offline,
      label: queued ? t.offlineLabel(queued) : t.offlineWorking,
      tone: 'bg-amber-50 text-amber-950 ring-amber-300',
    };
  }
  if (s.syncing) {
    return { kind: 'syncing', icon: 'refresh', short: t.syncingShort, label: t.syncingLabel(queued), tone: 'bg-sky-50 text-sky-900 ring-sky-200' };
  }
  if (queued) {
    return { kind: 'queued', icon: 'clock', short: t.queuedShort(queued), label: t.queuedLabel(queued), tone: 'bg-amber-50 text-amber-950 ring-amber-300' };
  }
  return {
    kind: 'synced',
    icon: 'cloudCheck',
    short: t.syncedShort,
    label: s.lastSyncAt ? t.syncedAgo(ago(s.lastSyncAt)) : t.onlineSynced,
    tone: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  };
}

/** Compact, always-visible connectivity + outbox status for the app header. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const s = useSyncState();
  const { t } = useI18n();
  const [, tick] = useState(0);
  useEffect(() => {
    startSync();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const v = describeSync(s);

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className={cx('inline-flex h-8 items-center gap-1.5 rounded-full text-xs font-semibold ring-1 ring-inset', compact && v.kind === 'synced' ? 'px-2 lg:px-3' : 'px-3', v.tone)} title={v.label}>
        <Icon name={v.icon} className={cx('h-4 w-4', v.kind === 'syncing' && 'animate-spin')} />
        {compact ? (
          <>
            {/* Phones: the healthy "synced" state is icon-only; problems always show words. */}
            <span className={v.kind === 'synced' ? 'sr-only lg:not-sr-only lg:hidden' : 'lg:hidden'}>{v.short}</span>
            <span className="hidden lg:inline">{v.label}</span>
          </>
        ) : (
          v.label
        )}
      </span>
      {s.online && s.failed > 0 && !s.syncing && (
        <button onClick={() => void getSyncEngine().retryNow()} className="h-8 rounded-full px-2 text-xs font-semibold text-brand-700 underline underline-offset-2">
          {t.sync.syncNow}
        </button>
      )}
      {s.rejected > 0 && (
        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-red-50 px-3 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-200">
          <Icon name="alert" className="h-3.5 w-3.5" /> {t.sync.rejected(s.rejected)}
        </span>
      )}
    </div>
  );
}

/** Large, explicit status for offline-first screens (nurse visit). */
export function SyncBanner({ savedAt }: { savedAt?: string | null }) {
  const s = useSyncState();
  const { t } = useI18n();
  const v = describeSync(s);
  const b = t.sync.banner;
  const copy: Record<Kind, { title: string; body: string }> = {
    offline: { title: b.offlineTitle, body: b.offlineBody(savedAt ?? null) },
    queued: { title: b.queuedTitle, body: b.queuedBody },
    syncing: { title: b.syncingTitle, body: b.syncingBody },
    synced: { title: b.syncedTitle, body: b.syncedBody(s.lastSyncAt ? ago(s.lastSyncAt) : null) },
  };
  const c = copy[v.kind];
  const queued = s.pending + s.failed;
  return (
    <div role="status" aria-live="polite" className={cx('flex gap-3 rounded-[var(--radius-card)] px-4 py-3 ring-1 ring-inset', v.tone)}>
      <Icon name={v.icon} className={cx('mt-0.5 h-5 w-5', v.kind === 'syncing' && 'animate-spin')} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {c.title}
          {(v.kind === 'offline' || v.kind === 'queued') && queued > 0 && ` · ${t.sync.onDevice(queued)}`}
        </p>
        <p className="text-sm opacity-90">{c.body}</p>
      </div>
    </div>
  );
}
