import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientStatus, Prisma, Priority, ReferralStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { patientScope } from '../common/access/scopes';
import { Paginated } from '../common/pagination';
import { computeContinuity } from '../continuity/continuity';
import { CreatePatientDto, DischargeDto, ListPatientsQuery, UpdatePatientDto } from './dto/patient.dto';

const FOLLOW_UP_DAYS: Record<Priority, number> = { HIGH: 2, MEDIUM: 7, LOW: 14 };

const listSelect = {
  id: true,
  fullName: true,
  birthDate: true,
  sex: true,
  district: true,
  status: true,
  riskLevel: true,
  dischargedAt: true,
  updatedAt: true,
  facility: { select: { id: true, name: true } },
  familyDoctor: { select: { id: true, fullName: true } },
} satisfies Prisma.PatientSelect;

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: ListPatientsQuery): Promise<Paginated<Prisma.PatientGetPayload<{ select: typeof listSelect }>>> {
    const where: Prisma.PatientWhereInput = {
      AND: [
        patientScope(user),
        q.search ? { fullName: { contains: q.search, mode: 'insensitive' } } : {},
        q.status ? { status: q.status } : {},
        q.riskLevel ? { riskLevel: q.riskLevel } : {},
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        select: listSelect,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  /** Throws 404 (not 403) for out-of-scope patients so ids cannot be probed. */
  async assertAccess(user: AuthUser, id: string) {
    const found = await this.prisma.patient.findFirst({ where: { AND: [{ id }, patientScope(user)] }, select: { id: true } });
    if (!found) throw new NotFoundException('Patient not found');
  }

  async get(user: AuthUser, id: string) {
    await this.assertAccess(user, id);
    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: {
        facility: { select: { id: true, name: true, type: true } },
        familyDoctor: { select: { id: true, fullName: true, facility: { select: { name: true } } } },
        observations: {
          orderBy: { recordedAt: 'desc' },
          take: 20,
          include: { recordedBy: { select: { fullName: true, role: true } } },
        },
        referrals: {
          orderBy: { createdAt: 'desc' },
          include: {
            fromFacility: { select: { name: true } },
            toFacility: { select: { name: true } },
            assignedDoctor: { select: { id: true, fullName: true } },
            followUps: {
              orderBy: { createdAt: 'desc' },
              include: {
                assignedNurse: { select: { id: true, fullName: true } },
                _count: { select: { observations: true } },
              },
            },
          },
        },
        riskAssessments: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    const latest = patient.referrals[0];
    return { ...patient, continuity: computeContinuity(latest) };
  }

  async create(user: AuthUser, dto: CreatePatientDto) {
    if (dto.familyDoctorId) await this.assertDoctor(dto.familyDoctorId);
    const patient = await this.prisma.patient.create({
      data: {
        ...dto,
        birthDate: new Date(dto.birthDate),
        facilityId: user.facilityId,
        admittedAt: new Date(),
      },
      select: listSelect,
    });
    await this.audit.log({ actorId: user.id, action: 'patient.create', entityType: 'Patient', entityId: patient.id });
    return patient;
  }

  async update(user: AuthUser, id: string, dto: UpdatePatientDto) {
    await this.assertAccess(user, id);
    // Care status and the responsible doctor change only through the clinical workflow.
    if (user.role === Role.NURSE && (dto.status !== undefined || dto.familyDoctorId !== undefined)) {
      throw new ForbiddenException('Nurses cannot change care status or the family doctor');
    }
    if (dto.familyDoctorId) await this.assertDoctor(dto.familyDoctorId);
    const patient = await this.prisma.patient.update({
      where: { id },
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined },
      select: listSelect,
    });
    await this.audit.log({
      actorId: user.id,
      action: 'patient.update',
      entityType: 'Patient',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return patient;
  }

  /**
   * Discharge + automatic referral in one transaction: a serious patient can never leave
   * hospital without an active follow-up task for local care.
   */
  async discharge(user: AuthUser, id: string, dto: DischargeDto) {
    await this.assertAccess(user, id);
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id } });
    if (patient.status !== PatientStatus.ADMITTED) {
      throw new BadRequestException('Only admitted patients can be discharged');
    }

    const doctorId = dto.familyDoctorId ?? patient.familyDoctorId;
    if (!doctorId) throw new BadRequestException('A family doctor is required to create the follow-up referral');
    const doctor = await this.assertDoctor(doctorId);

    const days = dto.followUpWithinDays ?? FOLLOW_UP_DAYS[dto.priority];
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id },
        data: { status: PatientStatus.DISCHARGED, dischargedAt: now, familyDoctorId: doctorId },
      });
      const referral = await tx.referral.create({
        data: {
          patientId: id,
          fromFacilityId: patient.facilityId,
          toFacilityId: doctor.facilityId,
          assignedDoctorId: doctorId,
          priority: dto.priority,
          reason: dto.reason,
          dischargeSummary: dto.dischargeSummary,
          status: ReferralStatus.ASSIGNED,
          deadline: new Date(now.getTime() + days * 86_400_000),
        },
      });
      await this.audit.log(
        { actorId: user.id, action: 'patient.discharge', entityType: 'Patient', entityId: id },
        tx,
      );
      await this.audit.log(
        {
          actorId: user.id,
          action: 'referral.create',
          entityType: 'Referral',
          entityId: referral.id,
          metadata: { priority: dto.priority, automatic: true },
        },
        tx,
      );
      return referral;
    });

    return { referralId: result.id, deadline: result.deadline, assignedDoctor: { id: doctor.id, fullName: doctor.fullName } };
  }

  private async assertDoctor(id: string) {
    const doctor = await this.prisma.user.findFirst({
      where: { id, role: Role.DOCTOR, isActive: true },
      select: { id: true, fullName: true, facilityId: true },
    });
    if (!doctor) throw new BadRequestException('Family doctor not found');
    return doctor;
  }
}
