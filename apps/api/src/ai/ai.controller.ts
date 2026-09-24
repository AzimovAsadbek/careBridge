import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { patientScope } from '../common/access/scopes';
import { AuditService } from '../audit/audit.service';
import { RiskService } from './risk.service';
import { LlmProvider } from './llm.provider';

@Controller('ai')
export class AiController {
  constructor(
    private readonly risk: RiskService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly llm: LlmProvider,
  ) {}

  @Get('status')
  status() {
    return { llmEnabled: this.llm.enabled, ruleEngine: true };
  }

  @Post('risk-assessment/:patientId')
  async assess(@CurrentUser() user: AuthUser, @Param('patientId', ParseUUIDPipe) patientId: string) {
    const visible = await this.prisma.patient.count({ where: { AND: [{ id: patientId }, patientScope(user)] } });
    if (!visible) throw new NotFoundException('Patient not found');
    const result = await this.risk.assessPatient(patientId);
    await this.audit.log({
      actorId: user.id,
      action: 'ai.risk_assessment',
      entityType: 'Patient',
      entityId: patientId,
      metadata: { level: result.level, engine: result.engine },
    });
    return result;
  }
}
