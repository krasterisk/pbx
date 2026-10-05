import { BadRequestException } from '@nestjs/common';
import { buildSipId, buildWebrtcSipId, extractExtension } from './endpoint-ids.util';

export function blfContext(tenant: number): string {
  if (!Number.isSafeInteger(tenant) || tenant < 0) throw new BadRequestException('Invalid tenant');
  return `krsk-blf-${tenant}`;
}

export function subscriptionsEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === 'yes' || value === 'true' || value === 'on';
}

export function blfSettings(enabled: unknown, tenant: number) {
  return {
    allow_subscribe: subscriptionsEnabled(enabled) ? 'yes' : 'no',
    subscribe_context: blfContext(tenant),
  };
}

export function buildBlfHints(ids: string[], tenant: number): string[] {
  const owned = new Set(ids);
  return ids.filter((id) => {
    const extension = extractExtension(id);
    // Never emit arbitrary database text as dialplan syntax or cross-tenant devices.
    return /^[A-Za-z0-9*#+.-]{1,20}$/.test(extension) && id === buildSipId(tenant, extension);
  }).sort().map((id) => {
    const extension = extractExtension(id);
    const companion = buildWebrtcSipId(tenant, extension);
    const devices = owned.has(companion) ? `${id}&PJSIP/${companion}` : id;
    return `exten => ${extension},hint,PJSIP/${devices}`;
  });
}
