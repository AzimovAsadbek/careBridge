import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { FollowUpsService } from './follow-ups.service';
import { CreateFollowUpDto, UpdateFollowUpDto } from './dto/follow-up.dto';

@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUps: FollowUpsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.followUps.mine(user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.DOCTOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFollowUpDto) {
    return this.followUps.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.DOCTOR, Role.NURSE)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFollowUpDto) {
    return this.followUps.update(user, id, dto);
  }
}
