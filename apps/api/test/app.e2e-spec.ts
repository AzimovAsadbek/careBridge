import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { ReferralsService } from '../src/referrals/referrals.service';
import { createApp, login, seed } from './helpers';

describe('CareBridge API (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let ctx: Awaited<ReturnType<typeof seed>>;
  const tokens: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    ctx = await seed(prisma);
    app = await createApp();
    for (const [key, u] of Object.entries(ctx.users)) tokens[key] = await login(app, u.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function createPatient(token = 'hospitalDoctor') {
    const res = await http()
      .post('/api/patients')
      .set(as(token))
      .send({ fullName: 'E2E Patient', birthDate: '1950-02-03', sex: 'FEMALE', address: 'Village 1', district: 'Urgut', familyDoctorId: ctx.users.familyDoctor.id });
    if (res.status !== 201) throw new Error(JSON.stringify(res.body));
    return res.body.id as string;
  }

  async function dischargedWithFollowUp() {
    const patientId = await createPatient();
    const d = await http().post(`/api/patients/${patientId}/discharge`).set(as('hospitalDoctor')).send({ priority: 'HIGH', reason: 'Heart failure' }).expect(201);
    const fu = await http().post('/api/follow-ups').set(as('familyDoctor')).send({ referralId: d.body.referralId, assignedNurseId: ctx.users.nurse.id }).expect(201);
    return { patientId, referralId: d.body.referralId as string, followUpId: fu.body.id as string };
  }

  describe('authentication', () => {
    it('rejects invalid credentials with a generic message', async () => {
      const res = await http().post('/api/auth/login').send({ email: 'admin@test.uz', password: 'wrong-password' }).expect(401);
      expect(res.body.message).toBe('Invalid email or password');
      await http().post('/api/auth/login').send({ email: 'nobody@test.uz', password: 'wrong-password' }).expect(401);
    });

    it('rejects requests without or with a forged token', async () => {
      await http().get('/api/patients').expect(401);
      await http().get('/api/patients').set({ Authorization: 'Bearer not.a.jwt' }).expect(401);
    });

    it('rejects unknown fields (mass assignment)', async () => {
      await http().post('/api/auth/login').send({ email: 'admin@test.uz', password: 'x'.repeat(10), role: 'ADMIN' }).expect(400);
    });

    it('never returns password hashes', async () => {
      const res = await http().get('/api/users').set(as('admin')).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });
  });

  describe('role-based access control', () => {
    it('forbids nurses from discharging and from admin endpoints', async () => {
      const patientId = await createPatient();
      await http().post(`/api/patients/${patientId}/discharge`).set(as('nurse')).send({ priority: 'HIGH', reason: 'x'.repeat(5) }).expect(403);
      await http().get('/api/analytics/dashboard').set(as('nurse')).expect(403);
      await http().get('/api/feedback').set(as('familyDoctor')).expect(403);
      await http().get('/api/audit').set(as('nurse')).expect(403);
    });

    it('hides patients outside the caller scope (404, not 403)', async () => {
      const patientId = await createPatient();
      await http().get(`/api/patients/${patientId}`).set(as('nurse')).expect(404);
      await http().patch(`/api/patients/${patientId}`).set(as('otherDoctor')).send({ district: 'Other' }).expect(404);
      await http().get(`/api/patients/${patientId}`).set(as('admin')).expect(200);
    });
  });

  describe('patients', () => {
    it('creates, reads and updates a patient with validation', async () => {
      const id = await createPatient();
      await http().patch(`/api/patients/${id}`).set(as('hospitalDoctor')).send({ phone: '+998 90 111 22 33' }).expect(200);
      const res = await http().get(`/api/patients/${id}`).set(as('hospitalDoctor')).expect(200);
      expect(res.body.phone).toBe('+998 90 111 22 33');
      expect(res.body.continuity.score).toBe(0);
      await http().post('/api/patients').set(as('hospitalDoctor')).send({ fullName: 'X', birthDate: 'yesterday', sex: 'OTHER' }).expect(400);
      await http().get('/api/patients/not-a-uuid').set(as('hospitalDoctor')).expect(400);
    });

    it('paginates and searches', async () => {
      const res = await http().get('/api/patients?search=e2e&pageSize=2&page=1').set(as('admin')).expect(200);
      expect(res.body.items.length).toBeLessThanOrEqual(2);
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.items.length);
      await http().get('/api/patients?pageSize=1000').set(as('admin')).expect(400);
    });
  });

  describe('discharge → referral → follow-up workflow', () => {
    it('creates an assigned referral with a priority-based deadline on discharge', async () => {
      const patientId = await createPatient();
      const before = Date.now();
      const res = await http().post(`/api/patients/${patientId}/discharge`).set(as('hospitalDoctor')).send({ priority: 'HIGH', reason: 'Serious case' }).expect(201);
      const ref = await prisma.referral.findUniqueOrThrow({ where: { id: res.body.referralId } });
      expect(ref.status).toBe('ASSIGNED');
      expect(ref.assignedDoctorId).toBe(ctx.users.familyDoctor.id);
      expect(ref.toFacilityId).toBe(ctx.facilities.clinic.id);
      expect(ref.deadline.getTime() - before).toBeGreaterThan(47 * 3_600_000);
      expect(ref.deadline.getTime() - before).toBeLessThan(49 * 3_600_000);
      await http().post(`/api/patients/${patientId}/discharge`).set(as('hospitalDoctor')).send({ priority: 'HIGH', reason: 'Again' }).expect(400);
      const list = await http().get('/api/referrals?view=active').set(as('familyDoctor')).expect(200);
      expect(list.body.items.map((r: { id: string }) => r.id)).toContain(ref.id);
    });

    it('runs accept → assign nurse → visit → complete and reaches 100% continuity', async () => {
      const patientId = await createPatient();
      const d = await http().post(`/api/patients/${patientId}/discharge`).set(as('hospitalDoctor')).send({ priority: 'MEDIUM', reason: 'Pneumonia' }).expect(201);
      const referralId = d.body.referralId;
      await http().patch(`/api/referrals/${referralId}`).set(as('otherDoctor')).send({ action: 'accept' }).expect(404);
      await http().patch(`/api/referrals/${referralId}`).set(as('familyDoctor')).send({ action: 'accept' }).expect(200);
      const fu = await http().post('/api/follow-ups').set(as('familyDoctor')).send({ referralId, assignedNurseId: ctx.users.nurse.id }).expect(201);
      const mine = await http().get('/api/follow-ups/mine').set(as('nurse')).expect(200);
      expect(mine.body.map((f: { id: string }) => f.id)).toContain(fu.body.id);
      await http().patch(`/api/follow-ups/${fu.body.id}`).set(as('otherNurse')).send({ status: 'IN_PROGRESS' }).expect(404);
      await http().patch(`/api/follow-ups/${fu.body.id}`).set(as('nurse')).send({ status: 'IN_PROGRESS' }).expect(200);
      const obs = await http().post(`/api/patients/${patientId}/observations`).set(as('nurse')).send({ followUpId: fu.body.id, spo2: 88, systolic: 130, diastolic: 80 }).expect(201);
      expect(obs.body.risk.level).toBe('HIGH');
      await http().patch(`/api/follow-ups/${fu.body.id}`).set(as('nurse')).send({ status: 'COMPLETED', outcome: 'Referred to clinic', patientStatus: 'IN_FOLLOW_UP' }).expect(200);
      const p = await http().get(`/api/patients/${patientId}`).set(as('familyDoctor')).expect(200);
      expect(p.body.referrals[0].status).toBe('COMPLETED');
      expect(p.body.status).toBe('IN_FOLLOW_UP');
      expect(p.body.continuity.score).toBe(100);
    });

    it('escalates referrals past their deadline to OVERDUE', async () => {
      const patientId = await createPatient();
      const d = await http().post(`/api/patients/${patientId}/discharge`).set(as('hospitalDoctor')).send({ priority: 'HIGH', reason: 'Late case' }).expect(201);
      await prisma.referral.update({ where: { id: d.body.referralId }, data: { deadline: new Date(Date.now() - 3_600_000) } });
      const escalated = await app.get(ReferralsService).markOverdue();
      expect(escalated).toBeGreaterThanOrEqual(1);
      const ref = await prisma.referral.findUniqueOrThrow({ where: { id: d.body.referralId } });
      expect(ref.status).toBe('OVERDUE');
      expect(ref.escalatedAt).not.toBeNull();
      const dash = await http().get('/api/analytics/dashboard').set(as('admin')).expect(200);
      expect(dash.body.kpis.overdueFollowUps).toBeGreaterThanOrEqual(1);
      expect(dash.body.attention.some((a: { id: string }) => a.id === d.body.referralId)).toBe(true);
    });
  });

  describe('offline sync', () => {
    it('applies a batch, is idempotent on replay, and isolates bad operations', async () => {
      const { patientId, followUpId, referralId } = await dischargedWithFollowUp();
      const obsId = randomUUID();
      const at = new Date(Date.now() - 2 * 3_600_000).toISOString(); // captured 2 h ago, offline
      const operations = [
        { localOperationId: randomUUID(), entityType: 'followUp', entityId: followUpId, operationType: 'UPDATE', payload: { status: 'IN_PROGRESS' }, createdAt: at },
        { localOperationId: randomUUID(), entityType: 'observation', entityId: obsId, operationType: 'CREATE', payload: { patientId, followUpId, pulse: 90, recordedAt: at }, createdAt: at },
        { localOperationId: randomUUID(), entityType: 'observation', entityId: randomUUID(), operationType: 'CREATE', payload: { patientId, spo2: 500 }, createdAt: at },
        { localOperationId: randomUUID(), entityType: 'observation', entityId: randomUUID(), operationType: 'CREATE', payload: { patientId: randomUUID(), pulse: 80 }, createdAt: at },
        { localOperationId: randomUUID(), entityType: 'followUp', entityId: followUpId, operationType: 'UPDATE', payload: { status: 'COMPLETED' }, createdAt: at },
      ];
      const first = await http().post('/api/sync/batch').set(as('nurse')).send({ operations }).expect(200);
      expect(first.body.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied', 'rejected', 'rejected', 'applied']);

      const replay = await http().post('/api/sync/batch').set(as('nurse')).send({ operations }).expect(200);
      expect(replay.body.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'duplicate', 'rejected', 'rejected', 'applied']);
      expect(await prisma.observation.count({ where: { clientId: obsId } })).toBe(1);

      const obs = await prisma.observation.findUniqueOrThrow({ where: { clientId: obsId } });
      expect(obs.syncedFromOffline).toBe(true);
      expect(obs.recordedAt.toISOString()).toBe(at);
      const fu = await prisma.followUp.findUniqueOrThrow({ where: { id: followUpId } });
      expect(fu.status).toBe('COMPLETED');
      expect(fu.syncedFromOffline).toBe(true);
      expect((await prisma.referral.findUniqueOrThrow({ where: { id: referralId } })).status).toBe('COMPLETED');
    });

    it('rejects sync from roles and nurses that do not own the visit', async () => {
      const { followUpId } = await dischargedWithFollowUp();
      const op = { localOperationId: randomUUID(), entityType: 'followUp', entityId: followUpId, operationType: 'UPDATE', payload: { status: 'IN_PROGRESS' }, createdAt: new Date().toISOString() };
      await http().post('/api/sync/batch').set(as('admin')).send({ operations: [op] }).expect(403);
      const res = await http().post('/api/sync/batch').set(as('otherNurse')).send({ operations: [op] }).expect(200);
      expect(res.body.results[0].status).toBe('rejected');
      await http().post('/api/sync/batch').set(as('nurse')).send({ operations: [] }).expect(400);
      await http().post('/api/sync/batch').set(as('nurse')).send({ operations: [{ ...op, entityType: 'user' }] }).expect(400);
    });
  });

  describe('AI risk assessment', () => {
    it('produces an explainable, persisted assessment (rule engine without API key)', async () => {
      const { patientId } = await dischargedWithFollowUp();
      await http().post(`/api/patients/${patientId}/observations`).set(as('familyDoctor')).send({ temperature: 38.4, pulse: 104 }).expect(201);
      const res = await http().post(`/api/ai/risk-assessment/${patientId}`).set(as('familyDoctor')).expect(201);
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(res.body.level);
      expect(res.body.engine).toBe('RULES');
      expect(res.body.factors.length).toBeGreaterThan(0);
      await http().post(`/api/ai/risk-assessment/${patientId}`).set(as('otherNurse')).expect(404);
    });
  });

  describe('anonymous QR feedback', () => {
    it('exposes only public facility info', async () => {
      const res = await http().get('/api/public/facilities/TST-H-1').expect(200);
      expect(Object.keys(res.body).sort()).toEqual(['district', 'name', 'publicCode', 'type']);
      await http().get('/api/public/facilities/NOPE-1').expect(404);
    });

    it('stores feedback anonymously, classifies it and handles malicious input', async () => {
      await http().post('/api/public/feedback').send({ facilityCode: 'TST-H-1', rating: 2, type: 'COMPLAINT', patientId: randomUUID() }).expect(400);
      await http()
        .post('/api/public/feedback')
        .send({ facilityCode: 'TST-H-1', rating: 1, type: 'COMPLAINT', text: "Pora so'rashdi <script>alert(1)</script>'; DROP TABLE \"Feedback\";--" })
        .expect(201);
      await new Promise((r) => setTimeout(r, 300)); // analysis runs in the background
      const list = await http().get('/api/feedback').set(as('admin')).expect(200);
      const fb = list.body.items[0];
      expect(fb.text).toContain('<script>'); // stored verbatim; React escapes on render
      expect(fb.analysis.priority).toBe('HIGH');
      expect(fb.analysis.category).toBe('corruption');
      const row = await prisma.feedback.findFirstOrThrow({ where: { id: fb.id } });
      expect(Object.keys(row).sort()).toEqual(['createdAt', 'facilityId', 'id', 'rating', 'text', 'type', 'ward']);
    });

    it('rate limits the public endpoint', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 7; i++) {
        const r = await http().post('/api/public/feedback').send({ facilityCode: 'TST-C-1', rating: 4, type: 'OTHER' });
        codes.push(r.status);
      }
      expect(codes).toContain(429);
    });
  });
});
