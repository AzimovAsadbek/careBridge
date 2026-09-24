import type { FollowUpStatus, PatientStatus, Priority, ReferralStatus, Sentiment } from '@/lib/types';
import { Badge, type Tone } from './ui';

const RISK: Record<Priority, Tone> = { HIGH: 'red', MEDIUM: 'amber', LOW: 'green' };

export function RiskBadge({ level }: { level: Priority | null | undefined }) {
  if (!level) return <Badge tone="slate">Not assessed</Badge>;
  return <Badge tone={RISK[level]}>{level === 'HIGH' ? '▲ ' : ''}Risk: {level.toLowerCase()}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={RISK[priority]}>{priority.toLowerCase()} priority</Badge>;
}

const REFERRAL: Record<ReferralStatus, [Tone, string]> = {
  PENDING: ['slate', 'Pending'],
  ASSIGNED: ['blue', 'Assigned'],
  IN_PROGRESS: ['brand', 'In progress'],
  COMPLETED: ['green', 'Completed'],
  OVERDUE: ['red', 'Overdue'],
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const [tone, label] = REFERRAL[status];
  return <Badge tone={tone}>{label}</Badge>;
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

const SENTIMENT: Record<Sentiment, Tone> = { POSITIVE: 'green', NEUTRAL: 'slate', NEGATIVE: 'red' };
export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return <Badge tone={SENTIMENT[sentiment]}>{sentiment.toLowerCase()}</Badge>;
}
