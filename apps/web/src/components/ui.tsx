import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useI18n } from '@/lib/i18n';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

/* ─────────────────────────── Icons (stroke, 24px grid) ─────────────────────────── */

const ICONS = {
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 13l4 4L19 7',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M19 9l-7 7-7-7',
  arrowLeft: 'M15 19l-7-7 7-7',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  sparkle: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  shield: 'M12 3l7 3v6c0 4.4-3 8.3-7 9-4-.7-7-4.6-7-9V6l7-3z',
  cloudOff: 'M3 3l18 18M8.5 8.5A4.5 4.5 0 0 0 6 17h11m2.8-1.2A4 4 0 0 0 17 10h-.3A6 6 0 0 0 10 6.2',
  cloudCheck: 'M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 11a3.5 3.5 0 0 1-.5 7H7zm2.5-5 2 2 3.5-3.5',
  refresh: 'M4 4v6h6M20 20v-6h-6M5.6 15A8 8 0 0 0 19 17M18.4 9A8 8 0 0 0 5 7',
  device: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 17h2',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z',
  phone: 'M3 5a2 2 0 0 1 2-2h3.3a1 1 0 0 1 1 .7l1.5 4.5a1 1 0 0 1-.5 1.2L8 10.8a11 11 0 0 0 5.2 5.2l1.4-2.3a1 1 0 0 1 1.2-.5l4.5 1.5a1 1 0 0 1 .7 1V19a2 2 0 0 1-2 2h-1C9.7 21 3 14.3 3 6V5z',
  lock: 'M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z',
  inbox: 'M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.6a1 1 0 0 0-.7.3l-2.4 2.4a1 1 0 0 1-.7.3h-3.2a1 1 0 0 1-.7-.3l-2.4-2.4a1 1 0 0 0-.7-.3H4',
  plus: 'M12 4v16m8-8H4',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  mapPin: 'M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  search: 'M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.2-1.6M2 9.5a15 15 0 0 1 4.3-2.8M22 9.5A15 15 0 0 0 11 5.1M12 20h.01',
  logout: 'M15 16l4-4m0 0-4-4m4 4H9m4 8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx('shrink-0', className ?? 'h-4 w-4')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ─────────────────────────── Buttons ─────────────────────────── */

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/45',
  secondary: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/45',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-[15px]',
};
const buttonBase =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-[background-color,box-shadow,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonBase, variants[variant], sizes[size], className)}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonBase, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

/* ─────────────────────────── Surfaces ─────────────────────────── */

/** The one card style: white, 1px line, 12px radius, near-flat shadow. Never nest cards. */
export function Card({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]', padded && 'p-4 sm:p-5', className)}>
      {children}
    </section>
  );
}

/** Card heading: section size, semibold; optional description and trailing action. */
export function CardTitle({ children, action, description }: { children: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-section font-semibold text-slate-900">{children}</h2>
        {description && <p className="mt-0.5 text-meta text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Heading row for a card whose body is edge-to-edge (lists, tables). */
export function CardHeader({ children, action, description }: { children: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-section font-semibold text-slate-900">{children}</h2>
        {description && <p className="mt-0.5 text-meta text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small label naming a sub-block inside a panel. */
export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-xs font-medium uppercase tracking-wide text-slate-500', className)}>{children}</p>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const s = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }[size];
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600', s)} aria-hidden>
      {initials}
    </span>
  );
}

/* ─────────────────────────── Badges ─────────────────────────── */

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand';
const tones: Record<Tone, { box: string; dot: string }> = {
  slate: { box: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  green: { box: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  amber: { box: 'bg-amber-50 text-amber-900', dot: 'bg-amber-500' },
  red: { box: 'bg-red-50 text-red-800', dot: 'bg-red-500' },
  blue: { box: 'bg-sky-50 text-sky-800', dot: 'bg-sky-500' },
  brand: { box: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
};

/** Status pill. `dot` adds a leading indicator — use it for states, not categories. */
export function Badge({ tone = 'slate', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium', tones[tone].box, className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', tones[tone].dot)} aria-hidden />}
      {children}
    </span>
  );
}

/* ─────────────────────────── Feedback states ─────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin text-current', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}

/** Loading placeholder shaped like the content it replaces (list rows or a detail workspace). */
export function Loading({ label, rows = 4, variant = 'list' }: { label?: string; rows?: number; variant?: 'list' | 'detail' }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label ?? t.common.loading}</span>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-64 max-w-full" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      {variant === 'detail' ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-20 lg:col-span-3" />
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="mt-6 divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const alertTones = {
  red: { box: 'border-red-200 bg-red-50 text-red-900', icon: 'alert' as IconName },
  amber: { box: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'alert' as IconName },
  green: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: 'checkCircle' as IconName },
  blue: { box: 'border-sky-200 bg-sky-50 text-sky-900', icon: 'info' as IconName },
};

export function Alert({
  tone = 'red',
  title,
  children,
  action,
  icon,
}: {
  tone?: keyof typeof alertTones;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  const t = alertTones[tone];
  return (
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('flex animate-enter gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm', t.box)}>
      <Icon name={icon ?? t.icon} className="mt-0.5 h-5 w-5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** Error that says why it happened and what the user can still do (offline work continues). */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const offline = message === t.errors.offline;
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-line bg-white px-6 py-10 text-center">
      <span className={cx('mb-3 flex h-11 w-11 items-center justify-center rounded-full', offline ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
        <Icon name={offline ? 'wifiOff' : 'alert'} className="h-5 w-5" />
      </span>
      <p className="font-medium text-slate-900">{offline ? t.errors.offlineTitle : t.common.couldNotLoad}</p>
      <p className="mt-1 max-w-md text-sm text-slate-600">{offline ? t.errors.offlineHint : message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <Icon name="refresh" className="h-3.5 w-3.5" /> {t.common.tryAgain}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon = 'inbox', action }: { title: string; children?: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-medium text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── Page structure ─────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="-ml-1 mb-2 inline-flex h-8 items-center gap-1 rounded-md px-1 text-meta font-medium text-slate-500 hover:text-slate-900">
          <Icon name="arrowLeft" className="h-3.5 w-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-meta font-medium text-slate-500">{eyebrow}</p>}
          <h1 className="text-[22px] font-semibold leading-8 tracking-tight text-slate-900 sm:text-page">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Forms ─────────────────────────── */

const fieldClass =
  'block h-10 w-full rounded-[var(--radius-control)] border border-slate-300 bg-white px-3 text-base text-slate-900 transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-600/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-500 sm:text-sm';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  required?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        )}
        {optional && <span className="ml-1 font-normal text-slate-400">· {t.common.optional}</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-700">
          <Icon name="alert" className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}

/** Numeric input with a trailing unit (mmHg, °C, %…) so units never crowd the label. */
export function UnitInput({ unit, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { unit: string }) {
  return (
    <div className="relative">
      <input {...props} className={cx(fieldClass, 'pr-14 tabular-nums', className)} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{unit}</span>
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, 'pr-8', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'h-auto py-2', props.className)} />;
}

/** Titled group of related fields — keeps long clinical forms scannable. */
export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 border-t border-line-soft pt-5 first:border-t-0 first:pt-0', className)}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-meta text-slate-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ─────────────────────────── Data display ─────────────────────────── */

/** Label/value pairs. `rows` renders a compact list with the value right-aligned. */
export function DescriptionList({ items, columns = 2, rows }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2; rows?: boolean }) {
  if (rows) {
    return (
      <dl className="divide-y divide-line-soft text-sm">
        {items.map((i) => (
          <div key={i.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-slate-600">{i.label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-900">{i.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cx('grid gap-x-6 gap-y-3 text-sm', columns === 2 && 'sm:grid-cols-2')}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-meta text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 break-words text-slate-900">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Step {
  label: string;
  detail?: ReactNode;
  state: 'done' | 'current' | 'upcoming' | 'late';
}

export function StepMarker({ state, index }: { state: Step['state']; index: number }) {
  const cls = {
    done: 'border-emerald-500 bg-emerald-500 text-white',
    current: 'border-brand-600 bg-white text-brand-700 shadow-[0_0_0_4px_var(--color-brand-100)]',
    late: 'border-red-600 bg-red-600 text-white shadow-[0_0_0_4px_rgb(254_226_226)]',
    upcoming: 'border-dashed border-slate-300 bg-white text-slate-400',
  }[state];
  return (
    <span className={cx('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold', cls)}>
      {state === 'done' ? <Icon name="check" className="h-3.5 w-3.5" /> : state === 'late' ? '!' : index + 1}
    </span>
  );
}

/**
 * Workflow progress. Horizontal when its container is wide enough, otherwise vertical.
 * State is conveyed by marker shape, weight and text — never colour alone.
 */
export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  const { t } = useI18n();
  const wide = steps.length > 5;
  const L = wide
    ? { ol: '@4xl:auto-cols-fr @4xl:grid-flow-col', li: '@4xl:flex-col @4xl:gap-2 @4xl:pb-0 @4xl:pr-3', line: '@4xl:left-6 @4xl:top-[11px] @4xl:h-0.5 @4xl:w-[calc(100%-1.5rem)]' }
    : { ol: '@2xl:auto-cols-fr @2xl:grid-flow-col', li: '@2xl:flex-col @2xl:gap-2 @2xl:pb-0 @2xl:pr-3', line: '@2xl:left-6 @2xl:top-[11px] @2xl:h-0.5 @2xl:w-[calc(100%-1.5rem)]' };
  return (
    <div className="@container">
      <ol aria-label={label} className={cx('grid gap-0', L.ol)}>
        {steps.map((s, i) => (
          <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className={cx('relative flex gap-3 pb-5 last:pb-0', L.li)}>
            {i < steps.length - 1 && (
              <span aria-hidden className={cx('absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5', L.line, s.state === 'done' ? 'bg-emerald-500' : 'bg-slate-200')} />
            )}
            <StepMarker state={s.state} index={i} />
            <div className="min-w-0">
              <p
                className={cx(
                  'text-sm [overflow-wrap:anywhere]',
                  s.state === 'current' || s.state === 'late' ? 'font-semibold text-slate-900' : s.state === 'done' ? 'text-slate-700' : 'text-slate-400',
                )}
              >
                {s.label}
                <span className="sr-only"> — {t.stepper[s.state]}</span>
              </p>
              {s.detail && <p className={cx('text-xs', s.state === 'late' ? 'font-medium text-red-700' : 'text-slate-500')}>{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
