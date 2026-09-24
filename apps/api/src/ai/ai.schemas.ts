import { z } from 'zod/v4';

export const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Level = (typeof LEVELS)[number];

export const RiskFactorSchema = z.object({
  code: z.string().max(40),
  label: z.string().max(160),
  weight: z.number().int().min(0).max(5),
});
export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export const RiskResultSchema = z.object({
  riskLevel: z.enum(LEVELS),
  score: z.number().int().min(0).max(40),
  factors: z.array(RiskFactorSchema).max(15),
  recommendedAction: z.string().max(300),
});
export type RiskResult = z.infer<typeof RiskResultSchema>;

/** What the LLM is allowed to add on top of the rule engine. */
export const RiskLlmReviewSchema = z.object({
  riskLevel: z.enum(LEVELS),
  additionalFactors: z
    .array(z.object({ label: z.string().max(160), weight: z.number().int().min(1).max(3) }))
    .max(5),
  recommendedAction: z.string().max(300),
});
export type RiskLlmReview = z.infer<typeof RiskLlmReviewSchema>;

export const FEEDBACK_CATEGORIES = [
  'service_quality',
  'staff_behavior',
  'cleanliness',
  'clinical_safety',
  'corruption',
  'infrastructure',
  'praise',
  'other',
] as const;

export const FEEDBACK_TOPICS = [
  'waiting_time',
  'staff_response',
  'staff_attitude',
  'cleanliness',
  'food',
  'medication',
  'cost',
  'communication',
  'facilities',
  'treatment_quality',
] as const;

export const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  category: z.enum(FEEDBACK_CATEGORIES),
  topics: z.array(z.enum(FEEDBACK_TOPICS)).max(5),
  priority: z.enum(LEVELS),
  summary: z.string().max(200),
});
export type FeedbackAnalysisResult = z.infer<typeof FeedbackAnalysisSchema>;
