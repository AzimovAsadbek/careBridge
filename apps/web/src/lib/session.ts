import type { UserProfile } from './types';

const TOKEN_KEY = 'cb.token';
const USER_KEY = 'cb.user';

/**
 * The session lives in localStorage so nurses stay signed in while offline.
 * XSS exposure is mitigated by a strict CSP and React's escaping (no raw HTML rendering).
 */
export const session = {
  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get user(): UserProfile | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  },
  save(token: string, user: UserProfile) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

export function homeFor(role: UserProfile['role']) {
  return role === 'ADMIN' ? '/dashboard' : role === 'DOCTOR' ? '/doctor' : '/nurse';
}
