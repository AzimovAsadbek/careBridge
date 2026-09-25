'use client';

import { LOCALES, useI18n, type Locale } from '@/lib/i18n';
import { cx } from './ui';

const SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };
const NAME: Record<Locale, string> = { uz: 'Oʻzbekcha', ru: 'Русский', en: 'English' };

/** UZ · RU · EN segmented control. Each option is labelled in its own language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t.common.language} className={cx('inline-flex rounded-full bg-slate-100 p-0.5', className)}>
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
            'h-7 min-w-9 rounded-full px-2 text-xs font-medium transition-[background-color,color,box-shadow]',
            locale === l ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900',
          )}
        >
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
