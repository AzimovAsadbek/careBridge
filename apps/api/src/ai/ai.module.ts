import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiProvider } from './ai-provider';
import { GeminiProvider } from './gemini.provider';
import { RiskService } from './risk.service';
import { FeedbackAnalysisService } from './feedback-analysis.service';

@Module({
  controllers: [AiController],
  providers: [{ provide: AiProvider, useClass: GeminiProvider }, RiskService, FeedbackAnalysisService],
  exports: [AiProvider, RiskService, FeedbackAnalysisService],
})
export class AiModule {}
