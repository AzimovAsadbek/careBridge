import { GeneralCondition } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Physiologically plausible bounds reject typos without making clinical judgements. */
export class CreateObservationDto {
  /** Client-generated UUID; repeated submissions with the same id are ignored (offline sync). */
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsUUID()
  followUpId?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(260)
  systolic?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(160)
  diastolic?: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(250)
  pulse?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(30)
  @Max(44)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  spo2?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  symptoms?: string[];

  @IsOptional()
  @IsEnum(GeneralCondition)
  generalCondition?: GeneralCondition;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  /** When the observation was taken (may be hours before sync). Defaults to now. */
  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}
