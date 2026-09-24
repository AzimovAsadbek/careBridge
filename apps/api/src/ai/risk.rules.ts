import { GeneralCondition, Priority } from '@prisma/client';
import { Level, RiskFactor, RiskResult } from './ai.schemas';

export interface RiskInput {
  ageYears: number;
  daysSinceDischarge?: number | null;
  referralPriority?: Priority | null;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  symptoms?: string[];
  generalCondition?: GeneralCondition | null;
  notes?: string | null;
}

/** Red-flag symptom phrases in Uzbek (latin), Russian and English. */
const RED_FLAGS: { code: string; label: string; patterns: RegExp }[] = [
  { code: 'chest_pain', label: 'Chest pain reported', patterns: /chest pain|ko['‘’`]?krak.{0,6}og['‘’`]?ri|боль в груди/i },
  { code: 'dyspnea', label: 'Shortness of breath reported', patterns: /short(ness)? of breath|breathless|nafas qis|hansira|одышк|задыха/i },
  { code: 'confusion', label: 'Confusion / altered consciousness', patterns: /confus|faint|unconscious|hushdan|behush|спутан|обморок|без сознания/i },
  { code: 'bleeding', label: 'Bleeding reported', patterns: /bleed|qon ket|кровотеч/i },
  { code: 'swelling', label: 'Oedema / swelling reported', patterns: /swelling|oedema|edema|shish|отек|отёк/i },
];

export const RISK_ACTIONS: Record<Level, string> = {
  HIGH: 'Urgent physician review within 24 hours; consider re-hospitalisation assessment.',
  MEDIUM: 'Physician review within 72 hours; repeat vitals at next visit.',
  LOW: 'Continue routine follow-up plan.',
};

const RANK: Record<Level, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
export const maxLevel = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);
export const levelRank = (l: Level) => RANK[l];

/**
 * Transparent, weighted rule engine. Decision support only — not a diagnosis and not a
 * clinically validated score. Every point added is returned as an explainable factor.
 */
export function assessRiskByRules(input: RiskInput): RiskResult {
  const factors: RiskFactor[] = [];
  let critical = false;
  const add = (code: string, label: string, weight: number, isCritical = false) => {
    factors.push({ code, label, weight, source: 'rule' });
    if (isCritical) critical = true;
  };

  const { spo2, systolic, diastolic, pulse, temperature } = input;
  if (spo2 != null) {
    if (spo2 < 90) add('spo2_critical', `Very low SpO2 (${spo2}%)`, 4, true);
    else if (spo2 < 94) add('spo2_low', `Low SpO2 (${spo2}%)`, 2);
  }
  if (systolic != null || diastolic != null) {
    const s = systolic ?? 0;
    const d = diastolic ?? 0;
    if (s >= 180 || d >= 110) add('bp_crisis', `Severely elevated blood pressure (${s}/${d})`, 3, true);
    else if (s >= 160 || d >= 100) add('bp_high', `Elevated blood pressure (${s}/${d})`, 2);
    else if (systolic != null && s < 90) add('bp_low', `Low blood pressure (${s}/${d})`, 3, true);
  }
  if (pulse != null) {
    if (pulse > 120 || pulse < 45) add('pulse_abnormal', `Abnormal pulse (${pulse} bpm)`, 2);
    else if (pulse > 100) add('pulse_high', `Elevated pulse (${pulse} bpm)`, 1);
  }
  if (temperature != null) {
    if (temperature >= 39) add('fever_high', `High fever (${temperature} °C)`, 2);
    else if (temperature >= 38) add('fever', `Fever (${temperature} °C)`, 1);
    else if (temperature < 35) add('hypothermia', `Low body temperature (${temperature} °C)`, 2);
  }
  if (input.ageYears >= 75) add('age_75', `Age ${input.ageYears}`, 2);
  else if (input.ageYears >= 65) add('age_65', `Age ${input.ageYears}`, 1);

  if (input.daysSinceDischarge != null) {
    if (input.daysSinceDischarge <= 7) add('recent_discharge', 'Discharged from hospital within 7 days', 2);
    else if (input.daysSinceDischarge <= 30) add('discharge_30d', 'Discharged from hospital within 30 days', 1);
  }
  if (input.referralPriority === Priority.HIGH) add('referral_high', 'High-priority discharge referral', 1);

  if (input.generalCondition === GeneralCondition.CRITICAL) add('condition_critical', 'General condition assessed as critical', 4, true);
  else if (input.generalCondition === GeneralCondition.POOR) add('condition_poor', 'General condition assessed as poor', 2);

  const text = [...(input.symptoms ?? []), input.notes ?? ''].join(' ; ');
  let flagPoints = 0;
  for (const flag of RED_FLAGS) {
    if (flagPoints >= 4) break;
    if (flag.patterns.test(text)) {
      add(`symptom_${flag.code}`, flag.label, 2);
      flagPoints += 2;
    }
  }

  const score = factors.reduce((s, f) => s + f.weight, 0);
  let riskLevel: Level = score >= 6 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
  if (critical) riskLevel = 'HIGH';

  factors.sort((a, b) => b.weight - a.weight);
  return { riskLevel, score: Math.min(score, 40), factors, recommendedAction: RISK_ACTIONS[riskLevel] };
}
