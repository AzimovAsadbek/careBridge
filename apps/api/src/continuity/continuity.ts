/**
 * Care Continuity Score — a product/process metric, NOT a clinical score.
 * It measures whether each hand-off in the hospital → home journey actually happened.
 */
export interface ContinuityReferral {
  deadline: Date;
  acceptedAt: Date | null;
  completedAt: Date | null;
  followUps: { visitStartedAt: Date | null; _count: { observations: number } }[];
}

export interface ContinuityStep {
  key: 'referral_created' | 'doctor_accepted' | 'home_visit' | 'data_synced' | 'follow_up_completed';
  label: string;
  done: boolean;
}

export interface ContinuityScore {
  score: number;
  steps: ContinuityStep[];
  onTime: boolean | null;
}

export function computeContinuity(referral: ContinuityReferral | null | undefined): ContinuityScore {
  if (!referral) {
    return {
      score: 0,
      onTime: null,
      steps: [{ key: 'referral_created', label: 'Referral created', done: false }],
    };
  }
  const visited = referral.followUps.some((f) => f.visitStartedAt);
  const synced = referral.followUps.some((f) => f._count.observations > 0);
  const steps: ContinuityStep[] = [
    { key: 'referral_created', label: 'Referral created', done: true },
    { key: 'doctor_accepted', label: 'Family doctor accepted', done: !!referral.acceptedAt },
    { key: 'home_visit', label: 'Home visit performed', done: visited },
    { key: 'data_synced', label: 'Visit data synchronized', done: synced },
    { key: 'follow_up_completed', label: 'Follow-up completed', done: !!referral.completedAt },
  ];
  const score = Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  const onTime = referral.completedAt ? referral.completedAt <= referral.deadline : null;
  return { score, steps, onTime };
}
