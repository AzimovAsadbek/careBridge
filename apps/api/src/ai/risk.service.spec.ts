import { AiEngine } from '@prisma/client';
import { RiskService } from './risk.service';
import { AiProvider } from './ai-provider';
import { PrismaService } from '../prisma/prisma.service';

function service(llm: Partial<AiProvider> & { structured?: jest.Mock }) {
  const generate = llm.structured ? jest.fn(async () => { const d = await llm.structured!(); return d ? { ok: true, data: d } : { ok: false, reason: 'malformed' }; }) : undefined;
  return new RiskService({} as PrismaService, { ...llm, generate } as unknown as AiProvider);
}

const moderate = { ageYears: 68, spo2: 93, pulse: 104 }; // rules → MEDIUM

describe('RiskService.evaluate', () => {
  it('uses rules when the LLM is disabled', async () => {
    const r = await service({ enabled: false }).evaluate(moderate);
    expect(r.engine).toBe(AiEngine.RULES);
    expect(r.result.riskLevel).toBe('MEDIUM');
  });

  it('falls back to rules when the LLM fails', async () => {
    const r = await service({ enabled: true, structured: jest.fn().mockResolvedValue(null) }).evaluate(moderate);
    expect(r.engine).toBe(AiEngine.RULES);
  });

  it('never lets the LLM downgrade the rule-based level', async () => {
    const structured = jest.fn().mockResolvedValue({ riskLevel: 'LOW', additionalFactors: [], recommendedAction: 'none' });
    const r = await service({ enabled: true, structured }).evaluate(moderate);
    expect(r.result.riskLevel).toBe('MEDIUM');
  });

  it('allows the LLM to escalate with explained factors', async () => {
    const structured = jest.fn().mockResolvedValue({
      riskLevel: 'HIGH',
      additionalFactors: [{ label: 'Reports not eating for 3 days', weight: 2 }],
      recommendedAction: 'Same-day physician call',
    });
    const r = await service({ enabled: true, structured }).evaluate(moderate);
    expect(r.engine).toBe(AiEngine.LLM);
    expect(r.result.riskLevel).toBe('HIGH');
    expect(r.result.factors.map((f) => f.label)).toContain('Reports not eating for 3 days');
    expect(r.result.recommendedAction).toBe('Same-day physician call');
  });
});
