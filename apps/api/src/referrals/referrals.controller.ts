import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ReferralsService } from './referrals.service';
import { ListReferralsQuery, UpdateReferralDto } from './dto/referral.dto';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListReferralsQuery) {
    return this.referrals.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.referrals.get(user, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DOCTOR)
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() _dto: UpdateReferralDto) {
    return this.referrals.accept(user, id);
  }
}
