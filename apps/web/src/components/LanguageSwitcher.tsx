'use client';

import { LOCALES, useI18n, type Locale } from '@/lib/i18n';
import { cx } from './ui';

const SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };
const NAME: Record<Locale, string> = { uz: 'Oʻzbekcha', ru: 'Русский', en: 'English' };

/** UZ · RU · EN segmented control. Each option is labelled in its own language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t.common.language} className={cx('inline-flex rounded-full border border-slate-300 bg-white p-0.5', className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          aria-label={NAME[l]}
          title={NAME[l]}
          onClick={() => setLocale(l)}
          className={cx(
            'h-7 min-w-9 rounded-full px-2 text-xs font-semibold transition-colors',
            locale === l ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
