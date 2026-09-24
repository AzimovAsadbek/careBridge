import { Module } from '@nestjs/common';
import { PatientsModule } from '../patients/patients.module';
import { FollowUpsModule } from '../follow-ups/follow-ups.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({ imports: [PatientsModule, FollowUpsModule], controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
