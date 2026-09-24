'use client';

import { useEffect, useState } from 'react';
import { startSync, useSyncState, getSyncEngine } from '@/lib/sync';
import { cx } from './ui';

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

/** Always-visible connectivity + outbox status. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const s = useSyncState();
  const [, tick] = useState(0);
  useEffect(() => {
    startSync();
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const queued = s.pending + s.failed;
  let tone = 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  let dot = 'bg-emerald-500';
  let label = 'Online · all changes synced';
  if (!s.online) {
    tone = 'bg-amber-50 text-amber-900 ring-amber-300';
    dot = 'bg-amber-500';
    label = queued ? `Offline · ${queued} change${queued > 1 ? 's' : ''} saved on device` : 'Offline · working locally';
  } else if (s.syncing) {
    tone = 'bg-sky-50 text-sky-800 ring-sky-200';
    dot = 'bg-sky-500 animate-pulse';
    label = `Syncing ${queued} change${queued === 1 ? '' : 's'}…`;
  } else if (queued) {
    tone = 'bg-amber-50 text-amber-900 ring-amber-300';
    dot = 'bg-amber-500';
    label = `${queued} change${queued > 1 ? 's' : ''} waiting to sync`;
  } else if (s.lastSyncAt) {
    label = `Online · synced ${ago(s.lastSyncAt)}`;
  }

  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', tone)}>
        <span className={cx('h-2 w-2 rounded-full', dot)} aria-hidden />
        <span className={compact ? 'max-w-40 truncate sm:max-w-none' : ''}>{label}</span>
      </span>
      {s.online && s.failed > 0 && !s.syncing && (
        <button onClick={() => void getSyncEngine().retryNow()} className="text-xs font-semibold text-brand-700 underline">
          Sync now
        </button>
      )}
      {s.rejected > 0 && (
        <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
          {s.rejected} rejected
        </span>
      )}
    </div>
  );
}
