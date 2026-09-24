'use client';

import { useEffect } from 'react';

/** Registered only in production builds — avoids stale caches during development. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.update())
      .catch(() => undefined);
  }, []);
  return null;
}
