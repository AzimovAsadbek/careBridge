import { AiEngine } from '@prisma/client';
import { GeminiRisk, Level, RiskFactor, RiskResult, TextTranslations, TRANSLATION_LOCALES } from './ai.schemas';
import { levelRank, RISK_ACTIONS } from './risk.rules';

export interface FinalRisk extends RiskResult {
  engine: AiEngine;
  confidence: number | null;
  warnings: string[];
  /** Uzbek / Russian versions of AI free text that passed the same safety checks. */
  i18n: TextTranslations | null;
}

/** A translation is used only if its English source survived unchanged and the translation itself is safe. */
const safeTranslation = (tr: string | undefined) => !!tr && !isPrescriptive(tr) && stripDiagnosis(tr) === tr.trim();

/** Medication / dosing language. The product is decision support: AI may not prescribe. */
const PRESCRIPTIVE =
  /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|ml|units?|iu|tablets?|tabs?|capsules?|puffs?)\b|\b(?:prescrib\w*|dosage|dosing|dose of|increase the dose|mg\/kg|start (?:taking|on) \w+)\b|таблет|dozasi|tabletka/i;

export const isPrescriptive = (text: string) => PRESCRIPTIVE.test(text);

/** Disease / condition conclusions. The product prioritises risk; it never diagnoses. */
const CONDITION =
  /(failure|pneumonia|sepsis|septic|infarct\w*|embolism|stroke|infection|decompensat\w*|exacerbation|disease|syndrome|cancer|tumou?r|diabet\w*|ketoacidosis|hypertensive (?:crisis|emergency)|ACS|MI\b|PE\b|CHF|COPD)/i;
const DIAGNOSTIC_CLAUSE =
  /[,;]?\s*(?:(?:strongly|highly|most)\s+)?(?:suggesting|suggestive of|suggests|consistent with|indicative of|indicating|concerning for|(?:for|due to|because of|of)\s+(?:suspected|possible|probable|likely|presumed))\s+[^.;]*/gi;
const DIAGNOSTIC = new RegExp(
  `\\b(?:diagnos\\w*|suspected|probable|likely|presumed)\\b[^.;]{0,60}${CONDITION.source}|tashxis|диагноз|подозрение на`,
  'i',
);

/**
 * Remove diagnostic conclusions from AI text ("…, suggesting heart failure"). Returns null when
 * the text is still diagnostic after stripping (it is then withheld).
 */
export function stripDiagnosis(text: string): string | null {
  const cleaned = text
    .replace(DIAGNOSTIC_CLAUSE, (m) => (CONDITION.test(m) ? '' : m))
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
  return cleaned && !DIAGNOSTIC.test(cleaned) ? cleaned : null;
}

/**
 * The single place where AI and rules are combined. Invariants:
 *  1. The final level is never below the deterministic rule level (AI can only escalate).
 *  2. Rule factors (incl. emergency thresholds) are always kept.
 *  3. Prescriptive AI text (drugs, doses) is withheld.
 *  4. Diagnostic conclusions are stripped or withheld (decision support, not diagnosis).
 *  5. Every override is explained in `warnings`.
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
      i18n: null,
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

  const nonPrescriptive = ai.reasons.filter((r) => !isPrescriptive(r));
  let recommendedAction = aiLowered ? rules.recommendedAction : ai.recommendedAction;
  if (isPrescriptive(recommendedAction) || nonPrescriptive.length < ai.reasons.length) {
    warnings.push('Part of the AI output contained medication or dosing advice and was withheld.');
    if (isPrescriptive(recommendedAction)) recommendedAction = RISK_ACTIONS[level];
  }
  const aiReasons = nonPrescriptive.map(stripDiagnosis).filter((r): r is string => !!r);
  const cleanedAction = stripDiagnosis(recommendedAction);
  if (aiReasons.length < nonPrescriptive.length || cleanedAction !== recommendedAction) {
    warnings.push('Diagnostic conclusions in the AI output were removed — CareBridge prioritises risk, it does not diagnose.');
  }
  recommendedAction = cleanedAction ?? RISK_ACTIONS[level];

  const factors: RiskFactor[] = [
    ...rules.factors,
    ...aiReasons.map((label, i) => ({ code: `ai_${i}`, label, weight: 0, source: 'ai' as const })),
  ];

  const finalWarnings = [
    ...warnings,
    ...ai.warnings.filter((w) => !isPrescriptive(w)).map(stripDiagnosis).filter((w): w is string => !!w),
  ].slice(0, 8);

  let i18n: TextTranslations | null = null;
  if (ai.translations) {
    i18n = {};
    for (const loc of TRANSLATION_LOCALES) {
      const tr = ai.translations[loc];
      const map: Record<string, string> = {};
      ai.reasons.forEach((en, i) => {
        if (aiReasons.includes(en) && safeTranslation(tr.reasons[i])) map[en] = tr.reasons[i].trim();
      });
      if (recommendedAction === ai.recommendedAction && safeTranslation(tr.recommendedAction)) map[recommendedAction] = tr.recommendedAction.trim();
      ai.warnings.forEach((en, i) => {
        if (finalWarnings.includes(en) && safeTranslation(tr.warnings[i])) map[en] = tr.warnings[i].trim();
      });
      i18n[loc] = map;
    }
  }

  return {
    i18n,
    riskLevel: level,
    score: rules.score,
    factors,
    recommendedAction,
    engine: aiLowered ? AiEngine.GEMINI_WITH_RULE_OVERRIDE : AiEngine.GEMINI,
    confidence: ai.confidence,
    warnings: finalWarnings,
  };
}
