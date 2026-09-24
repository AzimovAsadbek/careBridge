/* eslint-disable no-console -- CLI script output */
/* Demo seed data. All people and records are fictional. */
import { PrismaClient, Role, FacilityType, Sex, PatientStatus, Priority, ReferralStatus, FollowUpStatus, FeedbackType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { analyzeFeedbackByRules } from '../src/ai/feedback.rules';

const prisma = new PrismaClient();
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'CareBridge2026!';

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const hospital = await prisma.facility.upsert({
    where: { publicCode: 'SAM-RH-01' },
    update: {},
    create: { name: 'Samarkand Regional Hospital', type: FacilityType.HOSPITAL, district: 'Samarkand', publicCode: 'SAM-RH-01' },
  });
  const clinic = await prisma.facility.upsert({
    where: { publicCode: 'URG-FP-07' },
    update: {},
    create: { name: 'Urgut Family Polyclinic #7', type: FacilityType.FAMILY_CLINIC, district: 'Urgut', publicCode: 'URG-FP-07' },
  });
  const rural = await prisma.facility.upsert({
    where: { publicCode: 'URG-QVP-12' },
    update: {},
    create: { name: 'Kamangaron Rural Health Post', type: FacilityType.RURAL_POST, district: 'Urgut', publicCode: 'URG-QVP-12' },
  });

  const users = [
    { email: 'admin@carebridge.uz', fullName: 'Dilnoza Karimova', role: Role.ADMIN, facilityId: hospital.id },
    { email: 'hospital.doctor@carebridge.uz', fullName: 'Dr. Bekzod Rakhimov', role: Role.DOCTOR, facilityId: hospital.id },
    { email: 'doctor@carebridge.uz', fullName: 'Dr. Malika Yusupova', role: Role.DOCTOR, facilityId: clinic.id },
    { email: 'nurse@carebridge.uz', fullName: 'Gulnora Tosheva', role: Role.NURSE, facilityId: rural.id },
  ];
  const created: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, facilityId: u.facilityId },
      create: { ...u, passwordHash },
    });
    created[u.email] = user.id;
  }

  const familyDoctorId = created['doctor@carebridge.uz'];
  const nurseId = created['nurse@carebridge.uz'];
  const hospitalDoctorId = created['hospital.doctor@carebridge.uz'];
  const day = 86_400_000;
  const ago = (d: number) => new Date(Date.now() - d * day);
  const base = { district: 'Urgut', facilityId: hospital.id, familyDoctorId };

  if ((await prisma.patient.count()) === 0) {
    // 1. Still in hospital — used for the live discharge in the demo.
    await prisma.patient.create({
      data: { ...base, fullName: 'Rustam Aliyev', birthDate: new Date('1954-03-12'), sex: Sex.MALE, phone: '+998 91 555 12 34', address: 'Kamangaron village, 14 Navoi st.', diagnosisNote: 'Heart failure exacerbation', status: PatientStatus.ADMITTED, admittedAt: ago(5) },
    });

    // 2. Discharged yesterday, home visit scheduled for the rural nurse.
    const zulfiya = await prisma.patient.create({
      data: { ...base, fullName: 'Zulfiya Nazarova', birthDate: new Date('1961-11-02'), sex: Sex.FEMALE, address: 'Kamangaron village, 3 Mustaqillik st.', diagnosisNote: 'Type 2 diabetes, hyperglycemia', status: PatientStatus.IN_FOLLOW_UP, admittedAt: ago(6), dischargedAt: ago(1) },
    });
    const zRef = await prisma.referral.create({
      data: { patientId: zulfiya.id, fromFacilityId: hospital.id, toFacilityId: clinic.id, assignedDoctorId: familyDoctorId, priority: Priority.MEDIUM, reason: 'Glucose control after hyperglycemia; insulin started', status: ReferralStatus.IN_PROGRESS, deadline: new Date(ago(1).getTime() + 7 * day), acceptedAt: ago(0.8), createdAt: ago(1) },
    });
    await prisma.followUp.create({ data: { referralId: zRef.id, patientId: zulfiya.id, assignedNurseId: nurseId, status: FollowUpStatus.SCHEDULED, scheduledFor: new Date(Date.now() + day) } });

    // 3. Serious patient whose follow-up never happened — overdue and escalated.
    const sherzod = await prisma.patient.create({
      data: { ...base, fullName: 'Sherzod Qodirov', birthDate: new Date('1948-07-21'), sex: Sex.MALE, address: 'Kamangaron village, 2 Bog st.', diagnosisNote: 'Community-acquired pneumonia', status: PatientStatus.DISCHARGED, riskLevel: Priority.HIGH, admittedAt: ago(10), dischargedAt: ago(4) },
    });
    await prisma.referral.create({
      data: { patientId: sherzod.id, fromFacilityId: hospital.id, toFacilityId: clinic.id, assignedDoctorId: familyDoctorId, priority: Priority.HIGH, reason: 'Pneumonia, elderly; check breathing and SpO2', status: ReferralStatus.OVERDUE, deadline: ago(2), escalatedAt: ago(2), createdAt: ago(4) },
    });

    // 4. A completed journey (captured offline) for continuity analytics.
    const dilshod = await prisma.patient.create({
      data: { ...base, fullName: 'Dilshod Rahimov', birthDate: new Date('1970-01-15'), sex: Sex.MALE, address: 'Urgut, 21 Amir Temur st.', diagnosisNote: 'Hypertensive urgency', status: PatientStatus.STABLE, riskLevel: Priority.LOW, admittedAt: ago(20), dischargedAt: ago(14) },
    });
    const dRef = await prisma.referral.create({
      data: { patientId: dilshod.id, fromFacilityId: hospital.id, toFacilityId: clinic.id, assignedDoctorId: familyDoctorId, priority: Priority.MEDIUM, reason: 'Blood pressure control', status: ReferralStatus.COMPLETED, deadline: ago(7), acceptedAt: ago(13), completedAt: ago(10), createdAt: ago(14) },
    });
    const dFu = await prisma.followUp.create({
      data: { referralId: dRef.id, patientId: dilshod.id, assignedNurseId: nurseId, status: FollowUpStatus.COMPLETED, visitStartedAt: ago(10), completedAt: ago(10), outcome: 'BP controlled on medication', syncedFromOffline: true },
    });
    const obs = await prisma.observation.create({
      data: { patientId: dilshod.id, followUpId: dFu.id, recordedById: nurseId, systolic: 132, diastolic: 84, pulse: 74, temperature: 36.6, spo2: 97, symptoms: [], generalCondition: 'GOOD', recordedAt: ago(10), syncedFromOffline: true },
    });
    await prisma.riskAssessment.create({
      data: { patientId: dilshod.id, observationId: obs.id, level: Priority.LOW, score: 0, factors: [], recommendedAction: 'Continue routine follow-up plan.', engine: 'RULES' },
    });
    void hospitalDoctorId;
  }

  if ((await prisma.feedback.count()) === 0) {
    const samples: { facilityId: string; ward?: string; rating: number; type: FeedbackType; text?: string; daysAgo: number }[] = [
      { facilityId: hospital.id, ward: 'Terapiya 2', rating: 2, type: FeedbackType.COMPLAINT, text: 'Palatada juda uzoq kutdik, hamshirani chaqirsak kech keldi.', daysAgo: 1 },
      { facilityId: hospital.id, ward: 'Kardiologiya', rating: 5, type: FeedbackType.PRAISE, text: 'Shifokorlarga katta rahmat, juda e’tiborli bo‘lishdi!', daysAgo: 2 },
      { facilityId: hospital.id, ward: 'Хирургия', rating: 1, type: FeedbackType.COMPLAINT, text: 'Перед операцией требовали деньги, это взятка.', daysAgo: 2 },
      { facilityId: clinic.id, rating: 3, type: FeedbackType.SUGGESTION, text: 'Navbat tizimi elektron bo‘lsa yaxshi bo‘lardi.', daysAgo: 3 },
      { facilityId: hospital.id, ward: 'Terapiya 1', rating: 2, type: FeedbackType.COMPLAINT, text: 'Hojatxona iflos, tozalanmaydi.', daysAgo: 4 },
      { facilityId: rural.id, rating: 5, type: FeedbackType.PRAISE, text: 'The nurse visited us at home and explained everything. Thank you!', daysAgo: 5 },
    ];
    for (const f of samples) {
      const fb = await prisma.feedback.create({
        data: { facilityId: f.facilityId, ward: f.ward, rating: f.rating, type: f.type, text: f.text, createdAt: ago(f.daysAgo) },
      });
      const a = analyzeFeedbackByRules(f);
      await prisma.feedbackAnalysis.create({ data: { feedbackId: fb.id, ...a, engine: 'RULES' } });
    }
  }

  console.log(`Seeded demo data (3 facilities, ${users.length} users). Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
