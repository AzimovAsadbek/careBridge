import { Priority, ReferralStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class ListReferralsQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  /** `active` = everything not completed. */
  @IsOptional()
  @IsIn(['active', 'all'])
  view?: 'active' | 'all';
}

export class UpdateReferralDto {
  @IsIn(['accept'])
  action: 'accept';
}
