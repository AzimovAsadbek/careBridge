import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { PrismaClient, Role, FacilityType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

export const PASSWORD = 'TestPassword123!';

export async function createApp(customize: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b) {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

/** Wipes and seeds the test database (only ever pointed at carebridge_test). */
export async function seed(prisma: PrismaClient) {
  if (!process.env.DATABASE_URL?.includes('_test')) throw new Error('Refusing to wipe a non-test database');
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditLog","FeedbackAnalysis","Feedback","RiskAssessment","Observation","FollowUp","Referral","Patient","User","Facility" CASCADE',
  );
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const hospital = await prisma.facility.create({ data: { name: 'Test Hospital', type: FacilityType.HOSPITAL, district: 'A', publicCode: 'TST-H-1' } });
  const clinic = await prisma.facility.create({ data: { name: 'Test Clinic', type: FacilityType.FAMILY_CLINIC, district: 'A', publicCode: 'TST-C-1' } });
  const rural = await prisma.facility.create({ data: { name: 'Test Rural Post', type: FacilityType.RURAL_POST, district: 'A', publicCode: 'TST-R-1' } });
  const mk = (email: string, role: Role, facilityId: string) =>
    prisma.user.create({ data: { email, role, facilityId, fullName: email, passwordHash } });
  const users = {
    admin: await mk('admin@test.uz', Role.ADMIN, hospital.id),
    hospitalDoctor: await mk('hdoc@test.uz', Role.DOCTOR, hospital.id),
    familyDoctor: await mk('fdoc@test.uz', Role.DOCTOR, clinic.id),
    otherDoctor: await mk('odoc@test.uz', Role.DOCTOR, rural.id),
    nurse: await mk('nurse@test.uz', Role.NURSE, rural.id),
    otherNurse: await mk('nurse2@test.uz', Role.NURSE, clinic.id),
  };
  return { facilities: { hospital, clinic, rural }, users };
}

export async function login(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken as string;
}
