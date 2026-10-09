import { IsObject, IsOptional } from 'class-validator';
import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

/** Only the authenticated confirmation endpoint receives these values. Never persist or replay them. */
export class SecureConfirmationDto {
  @IsOptional()
  @IsObject()
  secureInputs?: Record<string, { password: string }>;
}

export type SecureConfirmationInputs = NonNullable<SecureConfirmationDto['secureInputs']>;
const secureInputsSchema = z.record(z.string().min(1).max(128), z.strictObject({ password: z.string().min(4).max(256) }));

export function parseSecureConfirmationInputs(value: unknown): SecureConfirmationInputs {
  const parsed = secureInputsSchema.safeParse(value ?? {});
  if (!parsed.success) throw new BadRequestException('Invalid secure confirmation');
  return parsed.data;
}
