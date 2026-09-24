import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { ObservationsService } from './observations.service';

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, ObservationsService],
  exports: [PatientsService, ObservationsService],
})
export class PatientsModule {}
