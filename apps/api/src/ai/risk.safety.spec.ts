import { AiEngine } from '@prisma/client';
import { GeminiRisk } from './ai.schemas';
import { assessRiskByRules } from './risk.rules';
import { applyRiskSafetyLayer, isPrescriptive } from './risk.safety';

const gemini = (over: Partial<GeminiRisk> = {}): GeminiRisk => ({
  riskLevel: 'MEDIUM',
  reasons: ['Borderline oxygen saturation'],
  recommendedAction: 'Physician review within 72 hours.',
  confidence: 0.8,
  warnings: [],
  ...over,
});
const high = assessRiskByRules({ ageYears: 75, spo2: 89, symptoms: ['shortness of breath'] });
const medium = assessRiskByRules({ ageYears: 68, spo2: 93, pulse: 104 });
const low = assessRiskByRules({ ageYears: 40, spo2: 98 });

describe('applyRiskSafetyLayer — AI may never lower a safety risk', () => {
  it('rules HIGH + Gemini LOW → HIGH, marked as rule override, rule action kept', () => {
    const r = applyRiskSafetyLayer(high, gemini({ riskLevel: 'LOW', recommendedAction: 'No action needed.' }), { aiConfigured: true });
    expect(r.riskLevel).toBe('HIGH');
    expect(r.engine).toBe(AiEngine.GEMINI_WITH_RULE_OVERRIDE);
    expect(r.recommendedAction).toBe(high.recommendedAction);
    expect(r.warnings[0]).toMatch(/Gemini suggested LOW.*kept HIGH/);
    expect(r.factors.filter((f) => f.source === 'rule')).toEqual(high.factors);
  });

  it('rules MEDIUM + Gemini HIGH → HIGH (AI may escalate)', () => {
    const r = applyRiskSafetyLayer(medium, gemini({ riskLevel: 'HIGH', recommendedAction: 'Same-day physician call.' }), { aiConfigured: true });
    expect(r.riskLevel).toBe('HIGH');
    expect(r.engine).toBe(AiEngine.GEMINI);
    expect(r.recommendedAction).toBe('Same-day physician call.');
    expect(r.warnings.some((w) => /escalated/.test(w))).toBe(true);
  });

  it('rules HIGH + Gemini HIGH → HIGH with AI reasons appended', () => {
    const r = applyRiskSafetyLayer(high, gemini({ riskLevel: 'HIGH', reasons: ['Hypoxia with dyspnea in elderly patient'] }), { aiConfigured: true });
    expect(r.engine).toBe(AiEngine.GEMINI);
    expect(r.factors.at(-1)).toMatchObject({ source: 'ai', weight: 0, label: 'Hypoxia with dyspnea in elderly patient' });
    expect(r.score).toBe(high.score); // score stays deterministic
  });

  it('keeps LOW when both agree and records confidence', () => {
    const r = applyRiskSafetyLayer(low, gemini({ riskLevel: 'LOW', confidence: 0.9 }), { aiConfigured: true });
    expect(r).toMatchObject({ riskLevel: 'LOW', engine: AiEngine.GEMINI, confidence: 0.9 });
  });

  it('withholds medication / dosing advice', () => {
    const r = applyRiskSafetyLayer(
      medium,
      gemini({ riskLevel: 'HIGH', recommendedAction: 'Give furosemide 40 mg now.', reasons: ['Fluid overload', 'Increase the dose of diuretic'] }),
      { aiConfigured: true },
    );
    expect(r.recommendedAction).not.toMatch(/mg|furosemide/);
    expect(r.factors.map((f) => f.label)).not.toContain('Increase the dose of diuretic');
    expect(r.warnings.some((w) => /medication or dosing/.test(w))).toBe(true);
  });

  it('marks FALLBACK_RULE_ENGINE when AI is configured but failed', () => {
    const r = applyRiskSafetyLayer(high, null, { aiConfigured: true, failure: 'quota' });
    expect(r).toMatchObject({ riskLevel: 'HIGH', engine: AiEngine.FALLBACK_RULE_ENGINE, confidence: null });
    expect(r.warnings[0]).toMatch(/quota/);
  });

  it('marks RULE_ENGINE when no AI is configured', () => {
    expect(applyRiskSafetyLayer(low, null, { aiConfigured: false })).toMatchObject({ engine: AiEngine.RULE_ENGINE, warnings: [] });
  });

  it('detects prescriptive text in several languages', () => {
    expect(isPrescriptive('Take 2 tablets daily')).toBe(true);
    expect(isPrescriptive('Kuniga 1 tabletka')).toBe(true);
    expect(isPrescriptive('Physician review within 24 hours')).toBe(false);
  });
});
