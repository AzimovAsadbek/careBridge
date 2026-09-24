import { Injectable, NotFoundException } from '@nestjs/common';
import { Observation, RiskAssessment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { followUpScope } from '../common/access/scopes';
import { PatientsService } from './patients.service';
import { RiskService } from '../ai/risk.service';
import { CreateObservationDto } from './dto/observation.dto';

@Injectable()
export class ObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly patients: PatientsService,
    private readonly risk: RiskService,
  ) {}

  /**
   * Idempotent on clientId: a retried offline submission returns the already-stored row.
   * Returns `created=false` when the observation already existed.
   */
  async record(
    user: AuthUser,
    patientId: string,
    dto: CreateObservationDto,
    opts: { fromOffline?: boolean } = {},
  ): Promise<{ observation: Observation; created: boolean; risk?: RiskAssessment }> {
    await this.patients.assertAccess(user, patientId);

    if (dto.clientId) {
      const existing = await this.prisma.observation.findUnique({ where: { clientId: dto.clientId } });
      if (existing) {
        if (existing.patientId !== patientId) throw new NotFoundException('Observation not found');
        return { observation: existing, created: false };
      }
    }

    if (dto.followUpId) {
      const followUp = await this.prisma.followUp.findFirst({
        where: { AND: [{ id: dto.followUpId, patientId }, followUpScope(user)] },
        select: { id: true },
      });
      if (!followUp) throw new NotFoundException('Follow-up not found');
    }

    const { recordedAt, ...rest } = dto;
    const observation = await this.prisma.observation.create({
      data: {
        ...rest,
        symptoms: dto.symptoms ?? [],
        patientId,
        recordedById: user.id,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        syncedFromOffline: !!opts.fromOffline,
      },
    });
    if (opts.fromOffline && dto.followUpId) {
      await this.prisma.followUp.update({ where: { id: dto.followUpId }, data: { syncedFromOffline: true } });
    }
    await this.audit.log({
      actorId: user.id,
      action: 'observation.create',
      entityType: 'Observation',
      entityId: observation.id,
      metadata: { patientId, offline: !!opts.fromOffline },
    });
    // Every new observation is triaged immediately so risky patients surface on dashboards.
    const risk = await this.risk.assessPatient(patientId, observation.id);
    return { observation, created: true, risk };
  }
}
