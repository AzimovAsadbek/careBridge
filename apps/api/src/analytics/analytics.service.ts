import { Injectable } from '@nestjs/common';
import { Priority, ReferralStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeContinuity } from '../continuity/continuity';

const continuitySelect = {
  deadline: true,
  acceptedAt: true,
  completedAt: true,
  followUps: { select: { visitStartedAt: true, _count: { select: { observations: true } } } },
} as const;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const since = new Date(now.getTime() - 90 * 86_400_000);
    const active = { status: { not: ReferralStatus.COMPLETED } };
    const overdueWhere = {
      OR: [{ status: ReferralStatus.OVERDUE }, { status: ReferralStatus.IN_PROGRESS, deadline: { lt: now } }],
    };

    const [
      totalPatients,
      activeReferrals,
      overdue,
      highRisk,
      feedbackCount,
      sentimentGroups,
      priorityGroups,
      referrals,
      offlineVisits,
      topicRows,
      attention,
    ] = await Promise.all([
      this.prisma.patient.count(),
      this.prisma.referral.count({ where: active }),
      this.prisma.referral.count({ where: overdueWhere }),
      this.prisma.patient.count({ where: { riskLevel: Priority.HIGH } }),
      this.prisma.feedback.count(),
      this.prisma.feedbackAnalysis.groupBy({ by: ['sentiment'], _count: { _all: true } }),
      this.prisma.feedbackAnalysis.groupBy({ by: ['priority'], _count: { _all: true } }),
      this.prisma.referral.findMany({ where: { createdAt: { gte: since } }, select: continuitySelect }),
      this.prisma.followUp.count({ where: { syncedFromOffline: true } }),
      this.prisma.$queryRaw<{ topic: string; count: bigint }[]>`
        SELECT unnest(topics) AS topic, COUNT(*) AS count
        FROM "FeedbackAnalysis" GROUP BY topic ORDER BY count DESC LIMIT 6`,
      this.attentionQueue(now),
    ]);

    const scores = referrals.map((r) => computeContinuity(r).score);
    const continuityRate = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const completed = referrals.filter((r) => r.completedAt);
    const onTimeRate = completed.length
      ? Math.round((completed.filter((r) => r.completedAt! <= r.deadline).length / completed.length) * 100)
      : null;

    const sentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
    for (const g of sentimentGroups) sentiment[g.sentiment] = g._count._all;
    const urgentFeedback = priorityGroups.find((g) => g.priority === Priority.HIGH)?._count._all ?? 0;

    return {
      kpis: {
        totalPatients,
        activeReferrals,
        overdueFollowUps: overdue,
        highRiskPatients: highRisk,
        feedbackCount,
        urgentFeedback,
        careContinuityRate: continuityRate,
        onTimeCompletionRate: onTimeRate,
        offlineSyncedVisits: offlineVisits,
      },
      feedbackSentiment: sentiment,
      feedbackTopics: topicRows.map((r) => ({ topic: r.topic, count: Number(r.count) })),
      attention,
      insights: this.insights({ highRisk, overdue, urgentFeedback, continuityRate, sentiment }),
      insightItems: this.insightItems({ highRisk, overdue, urgentFeedback, continuityRate, sentiment }),
    };
  }

  /** Care-coordinator worklist: overdue referrals and high-risk patients, most urgent first. */
  private async attentionQueue(now: Date) {
    const referrals = await this.prisma.referral.findMany({
      where: {
        status: { not: ReferralStatus.COMPLETED },
        OR: [{ deadline: { lt: now } }, { patient: { riskLevel: Priority.HIGH } }, { priority: Priority.HIGH }],
      },
      orderBy: { deadline: 'asc' },
      take: 20,
      select: {
        id: true,
        status: true,
        priority: true,
        deadline: true,
        patient: { select: { id: true, fullName: true, riskLevel: true, district: true } },
        assignedDoctor: { select: { fullName: true } },
      },
    });
    const urgency = (r: (typeof referrals)[number]) =>
      (r.deadline < now ? 4 : 0) + (r.patient.riskLevel === Priority.HIGH ? 3 : 0) + (r.priority === Priority.HIGH ? 1 : 0);
    return referrals
      .map((r) => ({
        ...r,
        overdue: r.deadline < now,
        reasons: [
          r.deadline < now ? 'Follow-up deadline missed' : null,
          r.patient.riskLevel === Priority.HIGH ? 'AI risk: HIGH' : null,
          r.priority === Priority.HIGH ? 'High-priority discharge' : null,
        ].filter(Boolean) as string[],
        // Stable codes so clients can localise (uz / ru / en).
        reasonCodes: [
          r.deadline < now ? 'overdue' : null,
          r.patient.riskLevel === Priority.HIGH ? 'ai_high' : null,
          r.priority === Priority.HIGH ? 'priority_high' : null,
        ].filter(Boolean) as string[],
      }))
      .sort((a, b) => urgency(b) - urgency(a) || a.deadline.getTime() - b.deadline.getTime())
      .slice(0, 8);
  }

  /** Same insights as codes + values, for localised clients. */
  private insightItems(d: { highRisk: number; overdue: number; urgentFeedback: number; continuityRate: number; sentiment: Record<string, number> }) {
    const out: { code: string; value: number }[] = [];
    if (d.highRisk) out.push({ code: 'high_risk', value: d.highRisk });
    if (d.overdue) out.push({ code: 'overdue', value: d.overdue });
    if (d.urgentFeedback) out.push({ code: 'urgent_feedback', value: d.urgentFeedback });
    const totalFb = d.sentiment.POSITIVE + d.sentiment.NEUTRAL + d.sentiment.NEGATIVE;
    if (totalFb >= 5 && d.sentiment.NEGATIVE / totalFb > 0.4) out.push({ code: 'negative_feedback', value: 40 });
    if (d.continuityRate && d.continuityRate < 60) out.push({ code: 'low_continuity', value: d.continuityRate });
    if (!out.length) out.push({ code: 'all_clear', value: 0 });
    return out;
  }

  /** Plain-language operational insights (decision support for coordinators). */
  private insights(d: {
    highRisk: number;
    overdue: number;
    urgentFeedback: number;
    continuityRate: number;
    sentiment: Record<string, number>;
  }) {
    const out: string[] = [];
    if (d.highRisk) out.push(`${d.highRisk} high-risk patient${d.highRisk > 1 ? 's' : ''} require physician attention.`);
    if (d.overdue) out.push(`${d.overdue} follow-up${d.overdue > 1 ? 's are' : ' is'} overdue — escalate to the responsible clinic.`);
    if (d.urgentFeedback) out.push(`${d.urgentFeedback} patient feedback item${d.urgentFeedback > 1 ? 's' : ''} flagged as high priority.`);
    const totalFb = d.sentiment.POSITIVE + d.sentiment.NEUTRAL + d.sentiment.NEGATIVE;
    if (totalFb >= 5 && d.sentiment.NEGATIVE / totalFb > 0.4) out.push('More than 40% of recent feedback is negative.');
    if (d.continuityRate && d.continuityRate < 60) out.push(`Care continuity is ${d.continuityRate}% — many discharges are not reaching completed home follow-up.`);
    if (!out.length) out.push('No urgent issues detected. All active follow-ups are on track.');
    return out;
  }
}
