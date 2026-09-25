import { AiEngine } from '@prisma/client';
import { GeminiFeedback } from './ai.schemas';
import { analyzeFeedbackByRules } from './feedback.rules';
import { applyFeedbackSafetyLayer, scrubSummary } from './feedback.safety';

const ai = (over: Partial<GeminiFeedback> = {}): GeminiFeedback => ({
  category: 'service_quality',
  sentiment: 'NEGATIVE',
  priority: 'MEDIUM',
  topics: ['waiting_time'],
  safetySignal: false,
  summary: 'Long waiting time in the ward.',
  ...over,
});
const bribe = analyzeFeedbackByRules({ rating: 1, type: 'COMPLAINT', text: 'Pora so‘rashdi' });
const waiting = analyzeFeedbackByRules({ rating: 2, type: 'COMPLAINT', text: 'Juda uzoq kutdik' });

describe('applyFeedbackSafetyLayer', () => {
  it('accepts Gemini for ordinary complaints', () => {
    const r = applyFeedbackSafetyLayer(waiting, ai(), { aiConfigured: true });
    expect(r).toMatchObject({ engine: AiEngine.GEMINI, priority: 'MEDIUM', safetySignal: false });
  });

  it('never lets Gemini downgrade a keyword safety signal (bribery)', () => {
    const r = applyFeedbackSafetyLayer(bribe, ai({ category: 'praise', sentiment: 'POSITIVE', priority: 'LOW', safetySignal: false }), { aiConfigured: true });
    expect(r).toMatchObject({ category: 'corruption', priority: 'HIGH', safetySignal: true, engine: AiEngine.GEMINI_WITH_RULE_OVERRIDE });
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('a Gemini-detected safety signal also forces HIGH', () => {
    const r = applyFeedbackSafetyLayer(waiting, ai({ category: 'clinical_safety', safetySignal: true, priority: 'MEDIUM' }), { aiConfigured: true });
    expect(r).toMatchObject({ priority: 'HIGH', safetySignal: true, engine: AiEngine.GEMINI });
  });

  it('falls back to rules (HIGH kept) when AI failed', () => {
    const r = applyFeedbackSafetyLayer(bribe, null, { aiConfigured: true, failure: 'unavailable' });
    expect(r).toMatchObject({ engine: AiEngine.FALLBACK_RULE_ENGINE, priority: 'HIGH', safetySignal: true });
  });

  it('stores scrubbed Uzbek / Russian summaries', () => {
    const r = applyFeedbackSafetyLayer(
      waiting,
      ai({ summary: 'Long wait.', translations: { uz: { summary: 'Uzoq kutish. Tel +998 90 123 45 67' }, ru: { summary: 'Долгое ожидание.' } } }),
      { aiConfigured: true },
    );
    expect(r.i18n?.uz?.['Long wait.']).toBe('Uzoq kutish. Tel [number removed]');
    expect(r.i18n?.ru?.['Long wait.']).toBe('Долгое ожидание.');
  });

  it('scrubs phone numbers and e-mails from summaries', () => {
    expect(scrubSummary('Call +998 90 123 45 67 or a@b.uz')).toBe('Call [number removed] or [email removed]');
  });
});
