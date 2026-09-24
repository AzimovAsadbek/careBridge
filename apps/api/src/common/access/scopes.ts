import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Data-access boundaries, enforced server-side on every query.
 * ADMIN: everything. DOCTOR: own facility, own family-doctor list, referrals assigned to them.
 * NURSE: own facility and patients whose follow-ups are assigned to them.
 */
export function patientScope(user: AuthUser): Prisma.PatientWhereInput {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.DOCTOR) {
    return {
      OR: [
        { facilityId: user.facilityId },
        { familyDoctorId: user.id },
        { referrals: { some: { OR: [{ assignedDoctorId: user.id }, { toFacilityId: user.facilityId }] } } },
      ],
    };
  }
  return { OR: [{ facilityId: user.facilityId }, { followUps: { some: { assignedNurseId: user.id } } }] };
}

export function referralScope(user: AuthUser): Prisma.ReferralWhereInput {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.DOCTOR) {
    return {
      OR: [{ assignedDoctorId: user.id }, { toFacilityId: user.facilityId }, { fromFacilityId: user.facilityId }],
    };
  }
  return { followUps: { some: { assignedNurseId: user.id } } };
}

export function followUpScope(user: AuthUser): Prisma.FollowUpWhereInput {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.DOCTOR) return { referral: referralScope(user) };
  return { assignedNurseId: user.id };
}
