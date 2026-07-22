/**
 * DTOs for the professional call-control set (D-27/D-28/D-29/D-33).
 * Kept in a separate file from dto/callcenter.dto.ts to avoid a wave-2/3
 * collision with other plans editing that file (same convention as
 * dto/callcenter-permissions.dto.ts).
 */
import { IsString, MaxLength } from 'class-validator';

export class ParkCallDto {
  /** uniqueid of the operator's own active call to park */
  @IsString()
  @MaxLength(64)
  uniqueid: string;
}

export class RetrieveParkedCallDto {
  /** Parking-space extension announced by Asterisk when the call was parked */
  @IsString()
  @MaxLength(32)
  parkingSpace: string;
}

export class ConferenceAddDto {
  /** uniqueid of the operator's own active call to conference */
  @IsString()
  @MaxLength(64)
  uniqueid: string;

  /** Extension/agent interface to add as the third party */
  @IsString()
  @MaxLength(64)
  target: string;
}

export class ZombieResetDto {
  /** uniqueid of the operator's own stuck call to reset */
  @IsString()
  @MaxLength(64)
  uniqueid: string;
}

export class WarmTransferQueueDto {
  /** uniqueid of the operator's own active call to transfer */
  @IsString()
  @MaxLength(64)
  uniqueid: string;

  /** Target queue name */
  @IsString()
  @MaxLength(64)
  queue: string;
}

export class ClickToCallDto {
  /** Number/extension to dial */
  @IsString()
  @MaxLength(64)
  target: string;
}
