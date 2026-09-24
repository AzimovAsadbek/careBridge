'use client';

import { useEffect } from 'react';

/** Re-run `reload` every `ms` while `active` (e.g. an AI review is still pending). */
export function usePollWhile(active: boolean, reload: () => unknown, ms = 4_000) {
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void reload(), ms);
    return () => clearInterval(t);
  }, [active, reload, ms]);
}
