import { FollowUpStatus, PatientStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFollowUpDto {
  @IsUUID()
  referralId: string;

  @IsUUID()
  assignedNurseId: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class UpdateFollowUpDto {
  @IsEnum(FollowUpStatus)
  status: FollowUpStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  outcome?: string;

  /** Patient status after the visit (only on completion). */
  @IsOptional()
  @IsIn([PatientStatus.STABLE, PatientStatus.IN_FOLLOW_UP])
  patientStatus?: PatientStatus;

  /** Client-side time the change happened (offline edits). */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
