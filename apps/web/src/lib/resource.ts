'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, NetworkError } from './api';
import { getDb } from './db';

interface ResourceState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** True when showing cached data because the network was unavailable. */
  stale: boolean;
  cachedAt: number | null;
}

/**
 * GET with an IndexedDB fallback: online → fresh data (and cache it);
 * offline → last cached copy, flagged as stale.
 */
export function useResource<T>(path: string | null, opts: { offline?: boolean } = {}) {
  const [state, setState] = useState<ResourceState<T>>({ data: null, error: null, loading: !!path, stale: false, cachedAt: null });
  const offline = opts.offline ?? false;
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api<T>(path);
      if (offline) await getDb().cache.put({ key: path, data, updatedAt: Date.now() }).catch(() => undefined);
      if (id === seq.current) setState({ data, error: null, loading: false, stale: false, cachedAt: null });
    } catch (error) {
      if (offline && error instanceof NetworkError) {
        const cached = await getDb().cache.get(path).catch(() => undefined);
        if (cached && id === seq.current) {
          setState({ data: cached.data as T, error: null, loading: false, stale: true, cachedAt: cached.updatedAt });
          return;
        }
      }
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path, offline]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
