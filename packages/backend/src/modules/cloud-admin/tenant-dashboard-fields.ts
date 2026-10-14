import { BadRequestException } from '@nestjs/common';

interface Fields {
  plan_name?: string | null;
  plan_expires_at?: string | null;
  max_concurrent_calls?: number | null;
  timezone?: string;
}

/** Runtime validation is required: the existing platform DTOs are interfaces. */
export function normalizeTenantDashboardFields(input: Fields, defaultTimezone?: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (input.plan_name !== undefined) {
    if (input.plan_name !== null && typeof input.plan_name !== 'string') {
      throw new BadRequestException('plan_name must be a string or null');
    }
    const name = input.plan_name?.trim() || null;
    if (name && name.length > 128) throw new BadRequestException('plan_name exceeds 128 characters');
    result.plan_name = name;
  }
  if (input.plan_expires_at !== undefined) {
    const value = input.plan_expires_at;
    if (value === null || value === '') result.plan_expires_at = null;
    else {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
        throw new BadRequestException('plan_expires_at must be an ISO date');
      }
      const parsed = new Date(value);
      const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || calendarDate.toISOString().slice(0, 10) !== value.slice(0, 10)) {
        throw new BadRequestException('plan_expires_at is not a valid date');
      }
      result.plan_expires_at = parsed;
    }
  }
  if (input.max_concurrent_calls !== undefined) {
    const value = input.max_concurrent_calls;
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000)) {
      throw new BadRequestException('max_concurrent_calls must be null or an integer between 0 and 1000000');
    }
    result.max_concurrent_calls = value;
  }
  if (input.timezone !== undefined && typeof input.timezone !== 'string') {
    throw new BadRequestException('timezone must be an IANA timezone');
  }
  const timezone = input.timezone ?? defaultTimezone;
  if (timezone !== undefined) {
    if (typeof timezone !== 'string' || !timezone.trim() || timezone.length > 64) {
      throw new BadRequestException('timezone must be an IANA timezone');
    }
    try { new Intl.DateTimeFormat('en', { timeZone: timezone.trim() }).format(); }
    catch { throw new BadRequestException('timezone must be an IANA timezone'); }
    result.timezone = timezone.trim();
  }
  return result;
}
