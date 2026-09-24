import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, ReferralStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { referralScope } from '../common/access/scopes';
import { ListReferralsQuery } from './dto/referral.dto';

const OVERDUE_SWEEP_MS = 60_000;
/** Referrals where nobody has started a home visit yet become OVERDUE after the deadline. */
const NOT_STARTED: ReferralStatus[] = [ReferralStatus.PENDING, ReferralStatus.ASSIGNED];

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

@Injectable()
export class ReferralsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.markOverdue().catch((e) => this.logger.warn(`Overdue sweep failed: ${(e as Error).message}`));
    }, OVERDUE_SWEEP_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Escalation: flag referrals past deadline with no visit started. Returns number escalated. */
  async markOverdue(now = new Date()) {
    const due = await this.prisma.referral.findMany({
      where: { status: { in: NOT_STARTED }, deadline: { lt: now } },
      select: { id: true, escalatedAt: true },
    });
    if (due.length === 0) return 0;
    await this.prisma.referral.updateMany({
      where: { id: { in: due.map((r) => r.id) } },
      data: { status: ReferralStatus.OVERDUE },
    });
    await this.prisma.referral.updateMany({
      where: { id: { in: due.filter((r) => !r.escalatedAt).map((r) => r.id) } },
      data: { escalatedAt: now },
    });
    for (const r of due) {
      await this.audit.log({ action: 'referral.overdue', entityType: 'Referral', entityId: r.id });
    }
    return due.length;
  }

  async list(user: AuthUser, q: ListReferralsQuery) {
    await this.markOverdue();
    const where: Prisma.ReferralWhereInput = {
      AND: [
        referralScope(user),
        q.status ? { status: q.status } : {},
        q.priority ? { priority: q.priority } : {},
        q.view === 'active' ? { status: { not: ReferralStatus.COMPLETED } } : {},
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.referral.findMany({
        where,
        orderBy: [{ deadline: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          patient: { select: { id: true, fullName: true, birthDate: true, district: true, riskLevel: true, status: true } },
          fromFacility: { select: { name: true } },
          toFacility: { select: { name: true } },
          assignedDoctor: { select: { id: true, fullName: true } },
          followUps: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, assignedNurse: { select: { id: true, fullName: true } } },
          },
        },
      }),
      this.prisma.referral.count({ where }),
    ]);
    // Worklist order: overdue first, then priority, then deadline.
    items.sort(
      (a, b) =>
        Number(b.status === 'OVERDUE') - Number(a.status === 'OVERDUE') ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.deadline.getTime() - b.deadline.getTime(),
    );
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async get(user: AuthUser, id: string) {
    const referral = await this.prisma.referral.findFirst({
      where: { AND: [{ id }, referralScope(user)] },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            birthDate: true,
            sex: true,
            address: true,
            district: true,
            phone: true,
            diagnosisNote: true,
            riskLevel: true,
            status: true,
          },
        },
        fromFacility: { select: { name: true, type: true } },
        toFacility: { select: { name: true, type: true } },
        assignedDoctor: { select: { id: true, fullName: true } },
        followUps: {
          orderBy: { createdAt: 'desc' },
          include: {
            assignedNurse: { select: { id: true, fullName: true } },
            observations: { orderBy: { recordedAt: 'desc' } },
          },
        },
      },
    });
    if (!referral) throw new NotFoundException('Referral not found');
    return referral;
  }

  /** Doctor acknowledges the referral. Overdue referrals stay OVERDUE until a visit starts. */
  async accept(user: AuthUser, id: string) {
    const referral = await this.get(user, id);
    if (referral.status === ReferralStatus.COMPLETED) throw new BadRequestException('Referral already completed');
    if (user.role === Role.DOCTOR && referral.assignedDoctorId && referral.assignedDoctorId !== user.id) {
      throw new BadRequestException('Referral is assigned to another doctor');
    }
    const updated = await this.prisma.referral.update({
      where: { id },
      data: {
        acceptedAt: referral.acceptedAt ?? new Date(),
        assignedDoctorId: referral.assignedDoctorId ?? (user.role === Role.DOCTOR ? user.id : undefined),
        status: referral.status === ReferralStatus.PENDING ? ReferralStatus.ASSIGNED : undefined,
      },
    });
    await this.audit.log({ actorId: user.id, action: 'referral.accept', entityType: 'Referral', entityId: id });
    return updated;
  }
}
