'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { ru } from './ru';
import { uz } from './uz';

export type Locale = 'uz' | 'ru' | 'en';
export const LOCALES: Locale[] = ['uz', 'ru', 'en'];
export const DEFAULT_LOCALE: Locale = 'uz';
const DICTS: Record<Locale, Dict> = { uz, ru, en };
const INTL_LOCALE: Record<Locale, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' };
const STORAGE_KEY = 'cb.lang';

/* Module-level current locale for non-React helpers (date formatting, error messages). */
let current: Locale = DEFAULT_LOCALE;
export const getLocale = () => current;
export const getDict = () => DICTS[current];
export const intlLocale = () => INTL_LOCALE[current];

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && LOCALES.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  // Uzbek by default (many devices in Uzbekistan run an English system locale);
  // Russian-language devices start in Russian. Users switch any time (UZ · RU · EN).
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
  return nav.startsWith('ru') ? 'ru' : DEFAULT_LOCALE;
}

interface Ctx {
  locale: Locale;
  t: Dict;
  setLocale: (l: Locale) => void;
}
const I18nContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, t: DICTS[DEFAULT_LOCALE], setLocale: () => undefined });

/**
 * Renders children once the saved locale is known (no flash of the wrong language, no
 * hydration mismatch). Changing the language remounts the tree so every screen — including
 * non-React helpers such as date formatting — uses the new locale consistently.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale | null>(null);

  useEffect(() => {
    const l = detect();
    current = l;
    document.documentElement.lang = l;
    setLocaleState(l);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    current = l;
    document.documentElement.lang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
    setLocaleState(l);
  }, []);

  if (!locale) return null;
  return (
    <I18nContext.Provider value={{ locale, t: DICTS[locale], setLocale }}>
      <div key={locale} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);

/* ───────────── Localisation of server-generated content ───────────── */

/** Measured value inside a rule label, e.g. "Very low SpO2 (89%)" → "89%", "Age 77" → "77". */
const labelValue = (label: string) => label.match(/\(([^)]+)\)/)?.[1] ?? label.match(/(\d+)\s*$/)?.[1] ?? '';

export function localizeFactor(f: { code: string; label: string; source?: string }, t: Dict, ai?: Record<string, string> | null) {
  if (f.source === 'ai') return ai?.[f.label] ?? f.label;
  const tpl = t.risk.factors[f.code];
  return tpl ? tpl(labelValue(f.label).replace(/\bbpm\b/, t.risk.bpm)) : f.label;
}

const LEVEL = /\b(HIGH|MEDIUM|LOW)\b/;
const levelWord = (t: Dict, l: string) => t.risk.levelWord[l] ?? l;

/**
 * Translate a stored English text: first the AI translation map (safety-checked on the server),
 * then known system messages (rule actions, safety-layer warnings), else the original text.
 */
export function localizeText(text: string, t: Dict, ai?: Record<string, string> | null): string {
  if (ai?.[text]) return ai[text];
  const actions = en.risk.actions;
  if (text === actions.HIGH) return t.risk.actions.HIGH;
  if (text === actions.MEDIUM) return t.risk.actions.MEDIUM;
  if (text === actions.LOW) return t.risk.actions.LOW;

  let m = text.match(/^AI review unavailable \((\w+)\)/);
  if (m) return t.risk.warnings.aiUnavailable(t.risk.failure[m[1]] ?? m[1]);
  m = text.match(/^Gemini suggested (\w+) risk; safety rules kept (\w+)/);
  if (m) return t.risk.warnings.lowered(levelWord(t, m[1]), levelWord(t, m[2]));
  m = text.match(/^Gemini escalated the risk from (\w+) to (\w+)/);
  if (m) return t.risk.warnings.escalated(levelWord(t, m[1]), levelWord(t, m[2]));
  if (text.startsWith('Part of the AI output contained medication')) return t.risk.warnings.medication;
  if (text.startsWith('Diagnostic conclusions in the AI output')) return t.risk.warnings.diagnosis;

  m = text.match(/^AI classification unavailable \((\w+)\)/);
  if (m) return t.feedback.warnings.aiUnavailable(t.risk.failure[m[1]] ?? m[1]);
  m = text.match(/^Safety keywords detected; category kept as (.+) instead of (.+)\.$/);
  if (m) {
    const cat = (c: string) => t.enums.category[c.replace(/ /g, '_')] ?? c;
    return t.feedback.warnings.categoryKept(cat(m[1]), cat(m[2]));
  }
  m = text.match(/^Safety signal present; priority raised from (\w+)/);
  if (m && LEVEL.test(m[1])) return t.feedback.warnings.priorityRaised(t.enums.priority[m[1] as 'HIGH' | 'MEDIUM' | 'LOW'].toLowerCase());
  if (text.startsWith('Gemini did not flag a safety concern')) return t.feedback.warnings.notFlagged;
  return text;
}

/** Per-locale AI translation map stored with an assessment / analysis (English → locale). */
export function aiMap(i18n: unknown, locale: Locale): Record<string, string> | null {
  if (locale === 'en' || !i18n || typeof i18n !== 'object') return null;
  return ((i18n as Record<string, Record<string, string>>)[locale] as Record<string, string>) ?? null;
}
