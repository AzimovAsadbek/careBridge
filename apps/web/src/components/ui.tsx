import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

/* ─────────────────────────── Icons (stroke, 24px grid) ─────────────────────────── */

const ICONS = {
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 13l4 4L19 7',
  checkCircle: 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  chevronRight: 'M9 5l7 7-7 7',
  arrowLeft: 'M15 19l-7-7 7-7',
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
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50 disabled:opacity-60',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-600/50',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:opacity-60',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};
const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-colors disabled:cursor-not-allowed';

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

export function Card({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return (
    <section
      className={cx(
        'min-w-0 rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)]',
        padded && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Section heading inside a card: sentence case, strong, with optional description and action. */
export function CardTitle({ children, action, description }: { children: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ─────────────────────────── Badges ─────────────────────────── */

export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand';
const tones: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
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

/** Page-level loading placeholder that mirrors the layout instead of a lone spinner. */
export function Loading({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="space-y-2 pt-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
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
    <div role={tone === 'red' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm', t.box)}>
      <Icon name={icon ?? t.icon} className="mt-0.5 h-5 w-5" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      tone="red"
      title="Could not load data"
      action={
        onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      {message}
    </Alert>
  );
}

export function EmptyState({ title, children, icon = 'inbox' }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-600">{children}</div>}
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
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <Icon name="arrowLeft" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{eyebrow}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Forms ─────────────────────────── */

const fieldClass =
  'block h-10 w-full rounded-[var(--radius-control)] border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/25 disabled:bg-slate-50 sm:text-sm';

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-500">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, 'pr-8', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'h-auto py-2', props.className)} />;
}

/* ─────────────────────────── Data display ─────────────────────────── */

const statTone = {
  slate: 'text-slate-900',
  red: 'text-red-700',
  amber: 'text-amber-700',
  green: 'text-emerald-700',
  brand: 'text-brand-700',
};

/** KPI tile. `emphasis` renders an alert-style tile for metrics that need action. */
export function Stat({
  label,
  value,
  hint,
  tone = 'slate',
  href,
  emphasis,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof statTone;
  href?: string;
  emphasis?: boolean;
  icon?: IconName;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon && <Icon name={icon} className={cx('h-4 w-4', statTone[tone])} />}
      </div>
      <p className={cx('mt-1.5 text-3xl font-semibold tabular-nums tracking-tight', statTone[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = cx(
    'block min-w-0 rounded-[var(--radius-card)] border bg-white p-4 shadow-[var(--shadow-card)]',
    emphasis && tone === 'red' ? 'border-red-200' : emphasis && tone === 'amber' ? 'border-amber-200' : 'border-line',
  );
  return href ? (
    <Link href={href} className={cx(cls, 'transition-colors hover:border-brand-200 hover:bg-brand-50/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Label/value pairs. */
export function DescriptionList({ items, columns = 2 }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3 text-sm', columns === 2 && 'sm:grid-cols-2')}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 break-words font-medium text-slate-900">{i.value}</dd>
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

/**
 * Workflow progress (care journey). Vertical in narrow containers, horizontal when wide.
 * State is conveyed by icon + text, not colour alone.
 */
export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  const marker = {
    done: 'border-emerald-600 bg-emerald-600 text-white',
    current: 'border-brand-600 bg-white text-brand-700 ring-4 ring-brand-100',
    late: 'border-red-600 bg-white text-red-700 ring-4 ring-red-100',
    upcoming: 'border-slate-300 bg-white text-slate-500',
  };
  const stateText = { done: 'completed', current: 'in progress', late: 'overdue', upcoming: 'not started' };
  // Container query: horizontal only when the stepper itself has room (≥ 42rem), not the screen.
  return (
    <div className="@container">
      <ol aria-label={label} className="grid gap-0 @2xl:auto-cols-fr @2xl:grid-flow-col">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0 @2xl:flex-col @2xl:gap-2 @2xl:pb-0 @2xl:pr-3">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  'absolute left-[11px] top-6 h-[calc(100%-1.5rem)] w-0.5 @2xl:left-6 @2xl:top-[11px] @2xl:h-0.5 @2xl:w-[calc(100%-1.5rem)]',
                  s.state === 'done' ? 'bg-emerald-600' : 'bg-slate-200',
                )}
              />
            )}
            <span className={cx('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold', marker[s.state])}>
              {s.state === 'done' ? <Icon name="check" className="h-3.5 w-3.5" /> : s.state === 'late' ? '!' : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cx('text-sm font-medium', s.state === 'upcoming' ? 'text-slate-500' : 'text-slate-900')}>
                {s.label}
                <span className="sr-only"> — {stateText[s.state]}</span>
              </p>
              {s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
