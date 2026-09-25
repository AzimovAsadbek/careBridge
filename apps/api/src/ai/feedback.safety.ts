import { AiEngine } from '@prisma/client';
import { FeedbackAnalysisResult, GeminiFeedback, TextTranslations, TRANSLATION_LOCALES } from './ai.schemas';

export interface FinalFeedback extends FeedbackAnalysisResult {
  engine: AiEngine;
  warnings: string[];
  /** Uzbek / Russian summary (scrubbed of identifiers like the English one). */
  i18n: TextTranslations | null;
}

const SAFETY_CATEGORIES = new Set(['corruption', 'clinical_safety', 'staff_behavior']);
const PHONE = /\+?\d[\d\s()-]{6,}\d/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;

/** Anonymity: never let identifiers leak into stored summaries. */
export const scrubSummary = (s: string) => s.replace(PHONE, '[number removed]').replace(EMAIL, '[email removed]').slice(0, 200);

/**
 * Combines keyword rules and Gemini. Invariants:
 *  1. A safety/integrity signal from either side is kept, and always means HIGH priority.
 *  2. If rules found a safety signal, the AI cannot move the item out of a safety category.
 *  3. Summaries are scrubbed of phone numbers and e-mail addresses.
 */
export function applyFeedbackSafetyLayer(
  rules: FeedbackAnalysisResult,
  ai: GeminiFeedback | null,
  opts: { aiConfigured: boolean; failure?: string },
): FinalFeedback {
  if (!ai) {
    return {
      ...rules,
      priority: rules.safetySignal ? 'HIGH' : rules.priority,
      engine: opts.aiConfigured ? AiEngine.FALLBACK_RULE_ENGINE : AiEngine.RULE_ENGINE,
      warnings: opts.aiConfigured ? [`AI classification unavailable (${opts.failure ?? 'error'}); keyword rules used.`] : [],
      i18n: null,
    };
  }

  const warnings: string[] = [];
  let overridden = false;
  let category = ai.category;
  if (rules.safetySignal && !SAFETY_CATEGORIES.has(ai.category)) {
    category = rules.category;
    overridden = true;
    warnings.push(`Safety keywords detected; category kept as ${rules.category.replace(/_/g, ' ')} instead of ${ai.category.replace(/_/g, ' ')}.`);
  }
  const safetySignal = ai.safetySignal || rules.safetySignal;
  let priority = ai.priority;
  if (safetySignal && priority !== 'HIGH') {
    if (rules.safetySignal && !ai.safetySignal) overridden = true;
    warnings.push(`Safety signal present; priority raised from ${priority} to HIGH.`);
    priority = 'HIGH';
  }
  if (rules.safetySignal && !ai.safetySignal) {
    overridden = true;
    warnings.push('Gemini did not flag a safety concern, but safety keywords were found. Please review.');
  }

  const summary = scrubSummary(ai.summary);
  let i18n: TextTranslations | null = null;
  if (ai.translations && summary) {
    i18n = {};
    for (const loc of TRANSLATION_LOCALES) {
      const tr = ai.translations[loc]?.summary?.trim();
      i18n[loc] = tr ? { [summary]: scrubSummary(tr) } : {};
    }
  }

  return {
    i18n,
    category,
    sentiment: ai.sentiment,
    priority,
    topics: ai.topics.length ? ai.topics : rules.topics,
    safetySignal,
    summary,
    engine: overridden ? AiEngine.GEMINI_WITH_RULE_OVERRIDE : AiEngine.GEMINI,
    warnings,
  };
}
