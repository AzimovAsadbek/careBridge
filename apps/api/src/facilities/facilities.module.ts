import { Module } from '@nestjs/common';
import { FacilitiesController } from './facilities.controller';

@Module({ controllers: [FacilitiesController] })
export class FacilitiesModule {}
