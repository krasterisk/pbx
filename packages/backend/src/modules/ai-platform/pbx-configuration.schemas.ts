import { z } from 'zod';
import { isIP } from 'node:net';
import { ADVANCED_PJSIP_FIELDS, pjsipValueError } from '@krasterisk/shared';

// Same public field catalog as the form, excluding credential references.
export const CHAT_PJSIP_FIELDS = ADVANCED_PJSIP_FIELDS.filter((field) =>
  !['dtls_private_key', 'outbound_auth', 'auth', 'aors', 'id', 'tenantid', 'webrtc'].includes(field),
);
export const pjsipSettingsSchema = z.strictObject(Object.fromEntries(CHAT_PJSIP_FIELDS.map((field) => [
  field, z.string().max(2048).regex(/^[^\r\n]*$/).refine(value => !value.includes(String.fromCharCode(0))).refine((value) => !pjsipValueError(field, value), `Invalid ${field}`).nullable().optional(),
])));

export const networksSchema = z.string().max(2048).refine((value) => value.split(/[,;\s]+/).filter(Boolean).every((entry) => {
  const [address, mask, extra] = entry.split('/');
  const family = isIP(address);
  return !!family && !extra && (mask === undefined || (/^\d+$/.test(mask) && Number(mask) <= (family === 4 ? 32 : 128)));
}), 'Expected IP addresses or CIDR networks');

export const endpointConfigurationShape = {
  context: z.string().trim().min(1).max(128).optional(),
  displayName: z.string().max(128).optional(),
  transport: z.enum(['transport-udp', 'transport-tcp', 'transport-tls', 'transport-ws', 'transport-wss']).optional(),
  codecs: z.string().trim().min(1).optional(),
  natProfile: z.enum(['lan', 'nat']).optional(),
  webrtcEnabled: z.boolean().optional(),
  blfEnabled: z.boolean().optional(),
  department: z.string().max(128).optional(),
  namedCallGroup: z.string().optional(),
  namedPickupGroup: z.string().optional(),
  provisionEnabled: z.boolean().optional(),
  macAddress: z.string().regex(/^(?:[a-fA-F0-9]{12})?$/).optional(),
  provisionTemplateId: z.number().int().positive().nullable().optional(),
  pvVars: z.string().optional(),
  permit: networksSchema.optional(),
  deny: networksSchema.optional(),
  advanced: pjsipSettingsSchema.optional(),
};

export const trunkConfigurationShape = {
  host: z.string().trim().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  context: z.string().trim().min(1).max(128).optional(),
  transport: z.enum(['transport-udp', 'transport-tcp', 'transport-tls']).optional(),
  codecs: z.string().trim().min(1).optional(),
  fromUser: z.string().optional(),
  fromDomain: z.string().optional(),
  contactUser: z.string().optional(),
  matchIp: z.string().optional(),
  qualifyFrequency: z.number().int().min(0).optional(),
  registrationExpiration: z.number().int().positive().optional(),
  maxChannels: z.number().int().min(0).optional(),
  advanced: pjsipSettingsSchema.optional(),
};
