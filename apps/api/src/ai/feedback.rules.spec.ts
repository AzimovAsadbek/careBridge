import { analyzeFeedbackByRules } from './feedback.rules';

describe('analyzeFeedbackByRules', () => {
  it('classifies the Uzbek waiting-time complaint', () => {
    const r = analyzeFeedbackByRules({
      rating: 2,
      type: 'COMPLAINT',
      text: 'Palatada juda uzoq kutdik, hamshirani chaqirsak kech keldi.',
    });
    expect(r.sentiment).toBe('NEGATIVE');
    expect(r.category).toBe('service_quality');
    expect(r.topics).toEqual(expect.arrayContaining(['waiting_time', 'staff_response']));
    expect(r.priority).toBe('MEDIUM');
  });

  it('escalates bribery to HIGH corruption', () => {
    const r = analyzeFeedbackByRules({ rating: 1, type: 'COMPLAINT', text: 'Operatsiya uchun pora so‘rashdi' });
    expect(r.category).toBe('corruption');
    expect(r.priority).toBe('HIGH');
  });

  it('recognises praise', () => {
    const r = analyzeFeedbackByRules({ rating: 5, type: 'PRAISE', text: 'Shifokorlarga katta rahmat!' });
    expect(r.sentiment).toBe('POSITIVE');
    expect(r.category).toBe('praise');
    expect(r.priority).toBe('LOW');
  });

  it('handles rating-only feedback and hostile markup safely', () => {
    const r = analyzeFeedbackByRules({ rating: 3, type: 'OTHER', text: '<script>alert(1)</script>' });
    expect(r.sentiment).toBe('NEUTRAL');
    expect(r.summary).not.toContain('<script>');
  });
});
