import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FollowUpStatus, PatientStatus, ReferralStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { followUpScope, referralScope } from '../common/access/scopes';
import { CreateFollowUpDto, UpdateFollowUpDto } from './dto/follow-up.dto';

const TRANSITIONS: Record<FollowUpStatus, FollowUpStatus[]> = {
  SCHEDULED: [FollowUpStatus.IN_PROGRESS, FollowUpStatus.COMPLETED],
  IN_PROGRESS: [FollowUpStatus.COMPLETED],
  COMPLETED: [],
};

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Nurse worklist: my visits that are not completed, soonest deadline first. */
  mine(user: AuthUser) {
    return this.prisma.followUp.findMany({
      where: { AND: [followUpScope(user), { status: { not: FollowUpStatus.COMPLETED } }] },
      orderBy: { referral: { deadline: 'asc' } },
      include: {
        patient: {
          select: { id: true, fullName: true, birthDate: true, sex: true, address: true, district: true, phone: true, riskLevel: true, diagnosisNote: true },
        },
        referral: { select: { id: true, priority: true, reason: true, deadline: true, status: true } },
      },
    });
  }

  /** Doctor delegates the home visit to a nurse. */
  async create(user: AuthUser, dto: CreateFollowUpDto) {
    const referral = await this.prisma.referral.findFirst({ where: { AND: [{ id: dto.referralId }, referralScope(user)] } });
    if (!referral) throw new NotFoundException('Referral not found');
    if (referral.status === ReferralStatus.COMPLETED) throw new BadRequestException('Referral already completed');

    const nurse = await this.prisma.user.findFirst({ where: { id: dto.assignedNurseId, role: Role.NURSE, isActive: true } });
    if (!nurse) throw new BadRequestException('Nurse not found');

    const followUp = await this.prisma.$transaction(async (tx) => {
      const fu = await tx.followUp.create({
        data: {
          referralId: referral.id,
          patientId: referral.patientId,
          assignedNurseId: nurse.id,
          scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : null,
        },
      });
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: ReferralStatus.IN_PROGRESS,
          acceptedAt: referral.acceptedAt ?? new Date(),
          assignedDoctorId: referral.assignedDoctorId ?? (user.role === Role.DOCTOR ? user.id : undefined),
        },
      });
      await tx.patient.update({ where: { id: referral.patientId }, data: { status: PatientStatus.IN_FOLLOW_UP } });
      return fu;
    });
    await this.audit.log({
      actorId: user.id,
      action: 'followup.create',
      entityType: 'FollowUp',
      entityId: followUp.id,
      metadata: { referralId: referral.id },
    });
    return followUp;
  }

  async update(user: AuthUser, id: string, dto: UpdateFollowUpDto, opts: { fromOffline?: boolean } = {}) {
    const followUp = await this.prisma.followUp.findFirst({
      where: { AND: [{ id }, followUpScope(user)] },
      include: { referral: true },
    });
    if (!followUp) throw new NotFoundException('Follow-up not found');

    // Replayed offline op: already in (or past) the requested state → no-op.
    if (followUp.status === dto.status) return followUp;
    if (!TRANSITIONS[followUp.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot move follow-up from ${followUp.status} to ${dto.status}`);
    }

    const at = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const completing = dto.status === FollowUpStatus.COMPLETED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const fu = await tx.followUp.update({
        where: { id },
        data: {
          status: dto.status,
          outcome: dto.outcome ?? undefined,
          visitStartedAt: followUp.visitStartedAt ?? at,
          completedAt: completing ? at : undefined,
          syncedFromOffline: opts.fromOffline ? true : undefined,
        },
      });
      await tx.referral.update({
        where: { id: followUp.referralId },
        data: completing
          ? { status: ReferralStatus.COMPLETED, completedAt: at }
          : { status: ReferralStatus.IN_PROGRESS },
      });
      if (completing) {
        await tx.patient.update({
          where: { id: followUp.patientId },
          data: { status: dto.patientStatus ?? PatientStatus.STABLE },
        });
      }
      return fu;
    });
    await this.audit.log({
      actorId: user.id,
      action: completing ? 'followup.complete' : 'followup.start',
      entityType: 'FollowUp',
      entityId: id,
      metadata: { offline: !!opts.fromOffline },
    });
    return updated;
  }
}
