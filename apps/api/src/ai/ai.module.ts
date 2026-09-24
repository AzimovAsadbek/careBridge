import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { LlmProvider } from './llm.provider';
import { RiskService } from './risk.service';
import { FeedbackAnalysisService } from './feedback-analysis.service';

@Module({
  controllers: [AiController],
  providers: [LlmProvider, RiskService, FeedbackAnalysisService],
  exports: [RiskService, FeedbackAnalysisService],
})
export class AiModule {}
