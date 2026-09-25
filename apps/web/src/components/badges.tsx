'use client';

import type { FollowUpStatus, PatientStatus, Priority, ReferralStatus, Sentiment } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { Badge, cx, type Tone } from './ui';

/** Risk = clinical urgency of the patient. Shape + text, never colour alone. */
const RISK: Record<Priority, { tone: Tone; mark: string }> = {
  HIGH: { tone: 'red', mark: '▲' },
  MEDIUM: { tone: 'amber', mark: '◆' },
  LOW: { tone: 'green', mark: '●' },
};

export function RiskBadge({ level }: { level: Priority | null | undefined }) {
  const { t } = useI18n();
  if (!level) return <Badge tone="slate">{t.enums.risk.none}</Badge>;
  const r = RISK[level];
  return (
    <Badge tone={r.tone}>
      <span aria-hidden className="text-[10px]">
        {r.mark}
      </span>
      {t.enums.risk[level]}
    </Badge>
  );
}

/** Large risk indicator for decision-support panels. */
export function RiskLevel({ level }: { level: Priority }) {
  const { t } = useI18n();
  const r = RISK[level];
  const box = { red: 'bg-red-50 text-red-800 ring-red-200', amber: 'bg-amber-50 text-amber-900 ring-amber-200', green: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }[
    r.tone as 'red' | 'amber' | 'green'
  ];
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-1.5 text-lg font-semibold ring-1 ring-inset', box)}>
      <span aria-hidden className="text-sm">
        {r.mark}
      </span>
      {t.enums.risk[level]}
    </span>
  );
}

/** Priority = urgency of the referral set at discharge (distinct from patient risk). */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  const label = t.enums.priority[priority];
  return (
    <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700">
      <span className="text-slate-500">{t.enums.priorityLabel}</span>
      <span className={priority === 'HIGH' ? 'font-semibold text-red-700' : priority === 'MEDIUM' ? 'font-semibold text-amber-800' : 'text-slate-800'}>{label}</span>
    </span>
  );
}

const REFERRAL: Record<ReferralStatus, Tone> = { PENDING: 'slate', ASSIGNED: 'blue', IN_PROGRESS: 'brand', COMPLETED: 'green', OVERDUE: 'red' };

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const { t } = useI18n();
  const tone = REFERRAL[status];
  const label = t.enums.referralStatus[status];
  return (
    <Badge tone={tone}>
      {status === 'OVERDUE' && <span aria-hidden>!</span>}
      {label}
    </Badge>
  );
}

const PATIENT: Record<PatientStatus, Tone> = { ADMITTED: 'blue', DISCHARGED: 'amber', IN_FOLLOW_UP: 'brand', STABLE: 'green' };

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const { t } = useI18n();
  return <Badge tone={PATIENT[status]}>{t.enums.patientStatus[status]}</Badge>;
}

const FOLLOW_UP: Record<FollowUpStatus, Tone> = { SCHEDULED: 'blue', IN_PROGRESS: 'brand', COMPLETED: 'green' };

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const { t } = useI18n();
  return <Badge tone={FOLLOW_UP[status]}>{t.enums.followUpStatus[status]}</Badge>;
}

const SENTIMENT: Record<Sentiment, [Tone, string]> = { POSITIVE: ['green', '+'], NEUTRAL: ['slate', '○'], NEGATIVE: ['red', '−'] };
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { t } = useI18n();
  const [tone, mark] = SENTIMENT[sentiment];
  return (
    <Badge tone={tone}>
      <span aria-hidden>{mark}</span> {t.enums.sentiment[sentiment]}
    </Badge>
  );
}
