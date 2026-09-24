import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { PublicFeedbackController } from './public-feedback.controller';

@Module({ imports: [AiModule], controllers: [PublicFeedbackController, FeedbackController], providers: [FeedbackService] })
export class FeedbackModule {}
