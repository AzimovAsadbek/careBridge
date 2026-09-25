import type { FollowUpStatus, PatientStatus, Priority, ReferralStatus, Sentiment } from '@/lib/types';
import { Badge, cx, type Tone } from './ui';

/** Risk = clinical urgency of the patient. Shape + text, never colour alone. */
const RISK: Record<Priority, { tone: Tone; mark: string; label: string }> = {
  HIGH: { tone: 'red', mark: '▲', label: 'High risk' },
  MEDIUM: { tone: 'amber', mark: '◆', label: 'Medium risk' },
  LOW: { tone: 'green', mark: '●', label: 'Low risk' },
};

export function RiskBadge({ level }: { level: Priority | null | undefined }) {
  if (!level) return <Badge tone="slate">Risk not assessed</Badge>;
  const r = RISK[level];
  return (
    <Badge tone={r.tone}>
      <span aria-hidden className="text-[10px]">
        {r.mark}
      </span>
      {r.label}
    </Badge>
  );
}

/** Large risk indicator for decision-support panels. */
export function RiskLevel({ level }: { level: Priority }) {
  const r = RISK[level];
  const box = { red: 'bg-red-50 text-red-800 ring-red-200', amber: 'bg-amber-50 text-amber-900 ring-amber-200', green: 'bg-emerald-50 text-emerald-800 ring-emerald-200' }[
    r.tone as 'red' | 'amber' | 'green'
  ];
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-1.5 text-lg font-semibold ring-1 ring-inset', box)}>
      <span aria-hidden className="text-sm">
        {r.mark}
      </span>
      {r.label}
    </span>
  );
}

/** Priority = urgency of the referral set at discharge (distinct from patient risk). */
export function PriorityBadge({ priority }: { priority: Priority }) {
  const label = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' }[priority];
  return (
    <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700">
      <span className="text-slate-500">Priority</span>
      <span className={priority === 'HIGH' ? 'font-semibold text-red-700' : priority === 'MEDIUM' ? 'font-semibold text-amber-800' : 'text-slate-800'}>{label}</span>
    </span>
  );
}

const REFERRAL: Record<ReferralStatus, [Tone, string]> = {
  PENDING: ['slate', 'Pending'],
  ASSIGNED: ['blue', 'Awaiting doctor'],
  IN_PROGRESS: ['brand', 'Visit in progress'],
  COMPLETED: ['green', 'Completed'],
  OVERDUE: ['red', 'Overdue'],
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const [tone, label] = REFERRAL[status];
  return (
    <Badge tone={tone}>
      {status === 'OVERDUE' && <span aria-hidden>!</span>}
      {label}
    </Badge>
  );
}

const PATIENT: Record<PatientStatus, [Tone, string]> = {
  ADMITTED: ['blue', 'In hospital'],
  DISCHARGED: ['amber', 'Discharged'],
  IN_FOLLOW_UP: ['brand', 'In follow-up'],
  STABLE: ['green', 'Stable'],
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const [tone, label] = PATIENT[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const FOLLOW_UP: Record<FollowUpStatus, [Tone, string]> = {
  SCHEDULED: ['blue', 'Scheduled'],
  IN_PROGRESS: ['brand', 'Visit in progress'],
  COMPLETED: ['green', 'Completed'],
};

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const [tone, label] = FOLLOW_UP[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const SENTIMENT: Record<Sentiment, [Tone, string]> = {
  POSITIVE: ['green', '+ Positive'],
  NEUTRAL: ['slate', '○ Neutral'],
  NEGATIVE: ['red', '− Negative'],
};
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const [tone, label] = SENTIMENT[sentiment];
  return <Badge tone={tone}>{label}</Badge>;
}
