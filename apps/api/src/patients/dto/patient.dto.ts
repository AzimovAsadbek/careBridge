import { PartialType } from '@nestjs/mapped-types';
import { PatientStatus, Priority, Sex } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class CreatePatientDto {
  @IsString()
  @Length(2, 120)
  fullName: string;

  @IsDateString({ strict: true })
  birthDate: string;

  @IsEnum(Sex)
  sex: Sex;

  @IsOptional()
  @Matches(/^\+?[0-9 ()-]{7,20}$/)
  phone?: string;

  @IsString()
  @Length(3, 250)
  address: string;

  @IsString()
  @Length(2, 80)
  district: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosisNote?: string;

  @IsOptional()
  @IsUUID()
  familyDoctorId?: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;
}

export class ListPatientsQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;

  @IsOptional()
  @IsEnum(Priority)
  riskLevel?: Priority;
}

export class DischargeDto {
  @IsEnum(Priority)
  priority: Priority;

  @IsString()
  @Length(3, 500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dischargeSummary?: string;

  /** Family doctor receiving the referral. Defaults to the patient's registered family doctor. */
  @IsOptional()
  @IsUUID()
  familyDoctorId?: string;

  /** Override the default follow-up window (HIGH 2d, MEDIUM 7d, LOW 14d). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  followUpWithinDays?: number;
}
