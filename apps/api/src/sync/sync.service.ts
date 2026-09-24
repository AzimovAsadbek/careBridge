import { HttpException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { ObservationsService } from '../patients/observations.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { CreateObservationDto } from '../patients/dto/observation.dto';
import { UpdateFollowUpDto } from '../follow-ups/dto/follow-up.dto';
import { SyncBatchDto, SyncOperationDto, SyncOpResult } from './sync.dto';

class RejectedError extends Error {}

async function validated<T extends object>(cls: new () => T, payload: unknown): Promise<T> {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    throw new RejectedError(errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; '));
  }
  return instance;
}

/**
 * Applies an ordered batch of offline operations. Each op is independent: one failure
 * never blocks the rest. All handlers are idempotent so the client can safely retry.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly observations: ObservationsService,
    private readonly followUps: FollowUpsService,
    private readonly audit: AuditService,
  ) {}

  async apply(user: AuthUser, batch: SyncBatchDto) {
    const results: SyncOpResult[] = [];
    for (const op of batch.operations) {
      results.push(await this.applyOne(user, op));
    }
    const summary = results.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
    await this.audit.log({ actorId: user.id, action: 'sync.batch', entityType: 'Sync', metadata: summary });
    return { results, serverTime: new Date().toISOString() };
  }

  private async applyOne(user: AuthUser, op: SyncOperationDto): Promise<SyncOpResult> {
    const base = { localOperationId: op.localOperationId };
    try {
      if (op.entityType === 'observation' && op.operationType === 'CREATE') {
        const { patientId, ...rest } = op.payload as { patientId?: unknown };
        if (typeof patientId !== 'string') throw new RejectedError('payload.patientId is required');
        const dto = await validated(CreateObservationDto, { ...rest, clientId: op.entityId });
        const { observation, created } = await this.observations.record(user, patientId, dto, { fromOffline: true });
        return { ...base, status: created ? 'applied' : 'duplicate', serverId: observation.id };
      }
      if (op.entityType === 'followUp' && op.operationType === 'UPDATE') {
        const dto = await validated(UpdateFollowUpDto, { occurredAt: op.createdAt, ...op.payload });
        const fu = await this.followUps.update(user, op.entityId, dto, { fromOffline: true });
        return { ...base, status: 'applied', serverId: fu.id };
      }
      throw new RejectedError(`Unsupported operation ${op.operationType} ${op.entityType}`);
    } catch (e) {
      if (e instanceof RejectedError) return { ...base, status: 'rejected', error: e.message };
      if (e instanceof HttpException && e.getStatus() < 500) {
        const body = e.getResponse();
        const msg = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
        return { ...base, status: 'rejected', error: Array.isArray(msg) ? msg.join('; ') : (msg ?? e.message) };
      }
      this.logger.warn(`Sync op ${op.entityType}/${op.operationType} failed: ${(e as Error).name}`);
      return { ...base, status: 'error', error: 'Temporary server error, will retry' };
    }
  }
}
