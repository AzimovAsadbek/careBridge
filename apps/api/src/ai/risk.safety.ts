import { AiEngine } from '@prisma/client';
import { GeminiRisk, Level, RiskFactor, RiskResult } from './ai.schemas';
import { levelRank, RISK_ACTIONS } from './risk.rules';

export interface FinalRisk extends RiskResult {
  engine: AiEngine;
  confidence: number | null;
  warnings: string[];
}

/** Medication / dosing language. The product is decision support: AI may not prescribe. */
const PRESCRIPTIVE =
  /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|ml|units?|iu|tablets?|tabs?|capsules?|puffs?)\b|\b(?:prescrib\w*|dosage|dosing|dose of|increase the dose|mg\/kg|start (?:taking|on) \w+)\b|таблет|dozasi|tabletka/i;

export const isPrescriptive = (text: string) => PRESCRIPTIVE.test(text);

/**
 * The single place where AI and rules are combined. Invariants:
 *  1. The final level is never below the deterministic rule level (AI can only escalate).
 *  2. Rule factors (incl. emergency thresholds) are always kept.
 *  3. Prescriptive AI text (drugs, doses) is withheld.
 *  4. Every override is explained in `warnings`.
 */
export function applyRiskSafetyLayer(
  rules: RiskResult,
  ai: GeminiRisk | null,
  opts: { aiConfigured: boolean; failure?: string },
): FinalRisk {
  if (!ai) {
    return {
      ...rules,
      engine: opts.aiConfigured ? AiEngine.FALLBACK_RULE_ENGINE : AiEngine.RULE_ENGINE,
      confidence: null,
      warnings: opts.aiConfigured
        ? [`AI review unavailable (${opts.failure ?? 'error'}); showing the rule-based assessment.`]
        : [],
    };
  }

  const warnings: string[] = [];
  const aiLowered = levelRank(ai.riskLevel) < levelRank(rules.riskLevel);
  const level: Level = aiLowered ? rules.riskLevel : ai.riskLevel;
  if (aiLowered) {
    warnings.push(
      `Gemini suggested ${ai.riskLevel} risk; safety rules kept ${rules.riskLevel} because AI may not lower a rule-based risk.`,
    );
  } else if (levelRank(ai.riskLevel) > levelRank(rules.riskLevel)) {
    warnings.push(`Gemini escalated the risk from ${rules.riskLevel} to ${ai.riskLevel}. Please review.`);
  }

  const aiReasons = ai.reasons.filter((r) => !isPrescriptive(r));
  let recommendedAction = aiLowered ? rules.recommendedAction : ai.recommendedAction;
  if (isPrescriptive(recommendedAction) || aiReasons.length < ai.reasons.length) {
    warnings.push('Part of the AI output contained medication or dosing advice and was withheld.');
    if (isPrescriptive(recommendedAction)) recommendedAction = RISK_ACTIONS[level];
  }

  const factors: RiskFactor[] = [
    ...rules.factors,
    ...aiReasons.map((label, i) => ({ code: `ai_${i}`, label, weight: 0, source: 'ai' as const })),
  ];

  return {
    riskLevel: level,
    score: rules.score,
    factors,
    recommendedAction,
    engine: aiLowered ? AiEngine.GEMINI_WITH_RULE_OVERRIDE : AiEngine.GEMINI,
    confidence: ai.confidence,
    warnings: [...warnings, ...ai.warnings.filter((w) => !isPrescriptive(w))].slice(0, 8),
  };
}
