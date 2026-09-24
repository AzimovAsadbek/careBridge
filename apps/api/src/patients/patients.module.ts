import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { ObservationsService } from './observations.service';

@Module({
  imports: [AiModule],
  controllers: [PatientsController],
  providers: [PatientsService, ObservationsService],
  exports: [PatientsService, ObservationsService],
})
export class PatientsModule {}
