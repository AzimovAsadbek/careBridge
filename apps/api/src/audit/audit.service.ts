import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Keep metadata free of PHI: ids, statuses and counts only. */
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    try {
      await (tx ?? this.prisma).auditLog.create({ data: entry });
    } catch (e) {
      // Auditing must never break the clinical workflow.
      this.logger.warn(`Audit write failed for ${entry.action}: ${(e as Error).message}`);
    }
  }

  list(limit = 50) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { actor: { select: { fullName: true, role: true } } },
    });
  }
}
