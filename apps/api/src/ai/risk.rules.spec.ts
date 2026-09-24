import { assessRiskByRules } from './risk.rules';

describe('assessRiskByRules', () => {
  it('returns LOW with no factors for a healthy adult', () => {
    const r = assessRiskByRules({ ageYears: 40, systolic: 120, diastolic: 80, pulse: 72, spo2: 98, temperature: 36.6 });
    expect(r.riskLevel).toBe('LOW');
    expect(r.factors).toHaveLength(0);
  });

  it('flags critical SpO2 as HIGH regardless of total score', () => {
    const r = assessRiskByRules({ ageYears: 30, spo2: 86 });
    expect(r.riskLevel).toBe('HIGH');
    expect(r.factors[0].code).toBe('spo2_critical');
  });

  it('combines moderate factors into MEDIUM with explainable reasons', () => {
    const r = assessRiskByRules({ ageYears: 68, spo2: 93, pulse: 104 });
    expect(r.riskLevel).toBe('MEDIUM');
    expect(r.factors.map((f) => f.code)).toEqual(expect.arrayContaining(['spo2_low', 'age_65', 'pulse_high']));
    expect(r.score).toBe(4);
  });

  it('reaches HIGH for recently discharged elderly patient with red-flag symptoms', () => {
    const r = assessRiskByRules({
      ageYears: 72,
      daysSinceDischarge: 3,
      referralPriority: 'HIGH',
      symptoms: ["nafas qisilishi"],
      spo2: 92,
    });
    expect(r.riskLevel).toBe('HIGH');
    expect(r.factors.map((f) => f.code)).toContain('symptom_dyspnea');
    expect(r.recommendedAction).toMatch(/Urgent physician review/);
  });

  it('detects Russian red flags in notes', () => {
    const r = assessRiskByRules({ ageYears: 50, notes: 'Жалуется на боль в груди' });
    expect(r.factors.map((f) => f.code)).toContain('symptom_chest_pain');
  });
});
