/**
 * CallCenter DTO classes with class-validator decorators.
 * Used by NestJS ValidationPipe for automatic request body validation.
 */
import { IsString, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean, Min, MaxLength } from 'class-validator';

// ─── Agent DTOs ────────────────────────────────────────────

export class AgentLoginDto {
  /** Agent SIP interface, e.g. "PJSIP/e101_42" */
  @IsString()
  @MaxLength(64)
  interface: string;

  /** Queue names to join on login */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queues?: string[];
}

export class AgentPauseDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;

  /** Pause in all queues or specific queue */
  @IsOptional()
  @IsString()
  queue?: string;
}

export class AgentUnpauseDto {
  @IsOptional()
  @IsString()
  queue?: string;
}

export class AgentHangupDto {
  @IsOptional()
  @IsString()
  channel?: string;
}

export class TransferDto {
  /** Call uniqueid to transfer */
  @IsString()
  uniqueid: string;

  /** Target: extension, queue name, or agent interface */
  @IsString()
  @MaxLength(64)
  target: string;

  /** Transfer type */
  @IsEnum(['blind', 'attended'])
  type: 'blind' | 'attended';
}

// ─── Supervisor DTOs ───────────────────────────────────────

export class SupervisorSpyDto {
  @IsString()
  @MaxLength(64)
  agentInterface: string;

  @IsOptional()
  @IsEnum(['spy', 'whisper', 'barge'])
  mode?: 'spy' | 'whisper' | 'barge';
}

export class SupervisorForceActionDto {
  @IsString()
  @MaxLength(64)
  agentInterface: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reason?: string;
}

export class SupervisorQueueActionDto {
  @IsString()
  @MaxLength(64)
  agentInterface: string;

  @IsString()
  @MaxLength(64)
  queue: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  penalty?: number;
}

// ─── Pause Reason DTOs ─────────────────────────────────────

export class CreatePauseReasonDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_duration?: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}

export class UpdatePauseReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  max_duration?: number;

  @IsOptional()
  @IsBoolean()
  is_paid?: boolean;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}
