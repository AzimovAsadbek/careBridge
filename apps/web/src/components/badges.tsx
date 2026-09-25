'use client';

import type { FollowUpStatus, PatientStatus, Priority, ReferralStatus, Sentiment } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { Badge, Icon, cx, type Tone } from './ui';
import { dueIn } from '@/lib/format';

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

/** Large risk indicator for decision-support panels: shape + word, coloured text on a soft tint. */
export function RiskLevel({ level }: { level: Priority }) {
  const { t } = useI18n();
  const r = RISK[level];
  const box = { red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-900', green: 'bg-emerald-50 text-emerald-800' }[r.tone as 'red' | 'amber' | 'green'];
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-[var(--radius-control)] px-2.5 py-1 text-base font-semibold', box)}>
      <span aria-hidden className="text-xs">
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
    <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-white px-2.5 text-xs font-medium text-slate-700">
      <span className="text-slate-500">{t.enums.priorityLabel}</span>
      <span className={priority === 'HIGH' ? 'text-red-700' : priority === 'MEDIUM' ? 'text-amber-800' : 'text-slate-800'}>{label}</span>
    </span>
  );
}

/* Status tones follow the semantic system: neutral = not started, sky = scheduled / in progress,
   green = completed, amber = waiting on someone, red = overdue. Brand teal is never a status colour. */
const REFERRAL: Record<ReferralStatus, Tone> = { PENDING: 'slate', ASSIGNED: 'blue', IN_PROGRESS: 'blue', COMPLETED: 'green', OVERDUE: 'red' };

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const { t } = useI18n();
  const tone = REFERRAL[status];
  const label = t.enums.referralStatus[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

const PATIENT: Record<PatientStatus, Tone> = { ADMITTED: 'slate', DISCHARGED: 'amber', IN_FOLLOW_UP: 'blue', STABLE: 'green' };

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={PATIENT[status]} dot>
      {t.enums.patientStatus[status]}
    </Badge>
  );
}

const FOLLOW_UP: Record<FollowUpStatus, Tone> = { SCHEDULED: 'slate', IN_PROGRESS: 'blue', COMPLETED: 'green' };

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={FOLLOW_UP[status]} dot>
      {t.enums.followUpStatus[status]}
    </Badge>
  );
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

/** Follow-up deadline: red when missed, amber inside 24 h, neutral otherwise. Always says it in words. */
export function DeadlineChip({ deadline, className }: { deadline: string; className?: string }) {
  const due = dueIn(deadline);
  const soon = !due.overdue && new Date(deadline).getTime() - Date.now() < 86_400_000;
  const tone = due.overdue ? 'text-red-700' : soon ? 'text-amber-800' : 'text-slate-500';
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap text-xs', due.overdue && 'font-medium', tone, className)}>
      <Icon name={due.overdue ? 'alert' : 'clock'} className="h-3.5 w-3.5" />
      {due.text}
    </span>
  );
}
