import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsDateString, IsIn, IsObject, IsUUID, ValidateNested } from 'class-validator';

export const SYNC_ENTITIES = ['observation', 'followUp'] as const;
export const SYNC_OPERATIONS = ['CREATE', 'UPDATE'] as const;

export class SyncOperationDto {
  @IsUUID()
  localOperationId: string;

  @IsIn(SYNC_ENTITIES)
  entityType: (typeof SYNC_ENTITIES)[number];

  @IsUUID()
  entityId: string;

  @IsIn(SYNC_OPERATIONS)
  operationType: (typeof SYNC_OPERATIONS)[number];

  /** Validated per entity type against the same DTOs as the online endpoints. */
  @IsObject()
  payload: Record<string, unknown>;

  @IsDateString()
  createdAt: string;
}

export class SyncBatchDto {
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  operations: SyncOperationDto[];
}

export type SyncOpStatus = 'applied' | 'duplicate' | 'rejected' | 'error';

export interface SyncOpResult {
  localOperationId: string;
  status: SyncOpStatus;
  /** Non-retryable reasons (validation / permission) or retryable server errors. */
  error?: string;
  serverId?: string;
}
