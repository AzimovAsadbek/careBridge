import { FeedbackType, Priority, Sentiment } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaginationQuery } from '../common/pagination';

/** Strip control characters; rendering is escaped by React, this just keeps storage clean. */
// eslint-disable-next-line no-control-regex -- intentionally matching control characters
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(CONTROL_CHARS, '').trim() : value;

export class PublicFeedbackDto {
  @Matches(/^[A-Z0-9-]{3,20}$/)
  facilityCode: string;

  @IsOptional()
  @Transform(clean)
  @Matches(/^[\p{L}\p{N} .,#/-]{1,40}$/u)
  ward?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsOptional()
  @Transform(clean)
  @IsString()
  @MaxLength(1000)
  text?: string;
}

export class ListFeedbackQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(Sentiment)
  sentiment?: Sentiment;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  facilityId?: string;
}
