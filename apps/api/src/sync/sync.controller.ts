import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import { SyncBatchDto } from './sync.dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('batch')
  @HttpCode(200)
  @Roles(Role.DOCTOR, Role.NURSE)
  batch(@CurrentUser() user: AuthUser, @Body() dto: SyncBatchDto) {
    return this.sync.apply(user, dto);
  }
}
