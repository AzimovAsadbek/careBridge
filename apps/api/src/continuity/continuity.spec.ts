import { computeContinuity } from './continuity';

const base = { deadline: new Date('2026-01-10'), acceptedAt: null, completedAt: null, followUps: [] };

describe('computeContinuity', () => {
  it('scores 0 when no referral exists', () => {
    expect(computeContinuity(null).score).toBe(0);
  });

  it('scores 20% for a referral nobody has acted on', () => {
    expect(computeContinuity(base).score).toBe(20);
  });

  it('scores 100% for a fully completed on-time journey', () => {
    const r = computeContinuity({
      ...base,
      acceptedAt: new Date('2026-01-02'),
      completedAt: new Date('2026-01-05'),
      followUps: [{ visitStartedAt: new Date('2026-01-04'), _count: { observations: 2 } }],
    });
    expect(r.score).toBe(100);
    expect(r.onTime).toBe(true);
    expect(r.steps.every((s) => s.done)).toBe(true);
  });

  it('does not count a visit without synchronized data', () => {
    const r = computeContinuity({
      ...base,
      acceptedAt: new Date(),
      followUps: [{ visitStartedAt: new Date(), _count: { observations: 0 } }],
    });
    expect(r.score).toBe(60);
    expect(r.steps.find((s) => s.key === 'data_synced')?.done).toBe(false);
  });
});
