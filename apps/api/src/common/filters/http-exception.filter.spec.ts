import { Prisma } from '@prisma/client';
import { describeError } from './http-exception.filter';

describe('describeError', () => {
  it('never includes Prisma validation messages (they embed query data / PHI)', () => {
    const e = new Prisma.PrismaClientValidationError('Invalid `prisma.patient.create()` { fullName: "Rustam Aliyev" }', {
      clientVersion: '6',
    });
    const out = describeError(e);
    expect(out).toBe('PrismaClientValidationError');
    expect(out).not.toContain('Rustam');
  });

  it('logs only the code for known request errors', () => {
    const e = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on (`email`) = `a@b.uz`', {
      code: 'P2002',
      clientVersion: '6',
    });
    expect(describeError(e)).toBe('Prisma P2002');
  });

  it('truncates other messages', () => {
    expect(describeError(new Error('x'.repeat(500))).length).toBeLessThan(220);
  });
});
