/* Demo seed data. All people and records are fictional. */
import { PrismaClient, Role, FacilityType, Sex, PatientStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
  const patients = [
    { fullName: 'Rustam Aliyev', birthDate: '1954-03-12', sex: Sex.MALE, address: 'Kamangaron village, 14 Navoi st.', diagnosisNote: 'Heart failure exacerbation' },
    { fullName: 'Zulfiya Nazarova', birthDate: '1961-11-02', sex: Sex.FEMALE, address: 'Urgut, 3 Mustaqillik st.', diagnosisNote: 'Type 2 diabetes, hyperglycemia' },
    { fullName: 'Sherzod Qodirov', birthDate: '1988-07-21', sex: Sex.MALE, address: 'Kamangaron village, 2 Bog st.', diagnosisNote: 'Community-acquired pneumonia' },
  ];
  const existing = await prisma.patient.count();
  if (existing === 0) {
    for (const p of patients) {
      await prisma.patient.create({
        data: {
          ...p,
          birthDate: new Date(p.birthDate),
          district: 'Urgut',
          status: PatientStatus.ADMITTED,
          admittedAt: new Date(Date.now() - 5 * 86_400_000),
          facilityId: hospital.id,
          familyDoctorId,
        },
      });
    }
  }

  console.log(`Seeded 3 facilities, ${users.length} users. Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
