'use client';

import { useEffect } from 'react';

/** Registered only in production builds — avoids stale caches during development. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      // Build-versioned URL: a new deploy always installs a new worker with fresh caches.
      .register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev')}`, { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => undefined);
  }, []);
  return null;
}
