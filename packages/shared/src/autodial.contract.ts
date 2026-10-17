import { z } from 'zod';
import { CONDITION_OPS, CONDITION_SOURCES } from './types/dialplan-condition.types';
import { PLAYBACK_MODES } from './types/dialplan-params.types';
import { AUTODIAL_FIELD_TYPES, AUTODIAL_DIAL_MODES, AUTODIAL_DISPOSITIONS } from './types/autodial.types';

export const autodialFieldSchema = z.strictObject({
  uid: z.number().int().positive().optional(),
  key: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
  label: z.string().max(255), type: z.enum(AUTODIAL_FIELD_TYPES),
  required: z.boolean().optional(), position: z.number().int().nonnegative().optional(),
  is_phone: z.boolean().optional(), var_name: z.string().regex(/^(?:AC_[A-Z0-9_]+)?$/).max(64).optional(),
  enum_values: z.array(z.string().min(1).max(255)).max(1000).nullable().optional(),
  format: z.strictObject({ currency: z.enum(['RUB', 'USD', 'EUR']).optional(), date_input: z.enum(['auto', 'iso', 'ru']).optional(),
    decimal_places: z.number().int().min(0).max(6).optional() }).nullable().optional(),
});
export const autodialFieldsSchema = z.array(autodialFieldSchema).min(1).max(100);
export const autodialSchemaMigrationSchema = z.strictObject({ expected_revision: z.number().int().nonnegative(),
  fields: autodialFieldsSchema, defaults: z.record(z.string(), z.union([z.string().max(10000), z.number().finite(), z.boolean()])).optional(),
  invalid_optional_policy: z.enum(['reject', 'archive_omit']).default('reject'), preview_hash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export const autodialModeSchema = z.enum(AUTODIAL_DIAL_MODES);
export const autodialDispositionSchema = z.enum(AUTODIAL_DISPOSITIONS);
export const autodialPacingProviderTypeSchema = z.enum(['static', 'queue_agents', 'trunk_channels', 'tenant_cap']);
export const autodialTaskActionSchema = z.strictObject({
  action: z.enum(['exclude', 'reschedule']), phone_uid: z.number().int().positive().optional(),
  next_attempt_at: z.iso.datetime({ offset: true }).optional(),
});
export const autodialUiActionSchema = z.strictObject({ action: z.enum(['open_campaign', 'open_launch', 'open_import']),
  campaign_uid: z.number().int().positive(), tab: z.enum(['overview', 'contacts', 'scenario', 'settings', 'report', 'journal']).optional(),
  include_dispositions: z.array(z.enum(['no_answer', 'busy', 'congestion', 'failed', 'answered_short', 'amd_machine', 'voicemail', 'max_attempts', 'callback_scheduled'])).max(9).optional() });
export type AutodialUiAction = z.infer<typeof autodialUiActionSchema>;
export function autodialUiActionPath(input: AutodialUiAction): string {
  const action = autodialUiActionSchema.parse(input);
  const params = new URLSearchParams({ tab: action.action === 'open_import' ? 'contacts' : action.tab ?? 'overview' });
  if (action.action === 'open_launch') { params.set('start', '1'); if (action.include_dispositions?.length) params.set('redial', action.include_dispositions.join(',')); }
  if (action.action === 'open_import') params.set('import', '1');
  return `/autodial/campaigns/${action.campaign_uid}?${params}`;
}

/** Runtime scenario contract. Legacy spelling is accepted only as explicit aliases. */
const variable = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(64);
const label = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(128);
const mediaFile = z.string().regex(/^[A-Za-z0-9_-]+(?:\.(?:wav|gsm|ulaw|alaw|sln16|sln|mp3|ogg))?$/);
const optionalMediaFile = z.union([mediaFile, z.literal('')]).optional();
const integerOrString = z.union([z.number().int().nonnegative(), z.string().regex(/^\d*$/)]);
const fixedTarget = z.strictObject({ source: z.literal('fixed'), value: z.union([z.string(), z.number()]) });
const mediaOptions = z.union([z.string(), z.strictObject({
  noanswer: z.boolean().optional(), skip: z.boolean().optional(), p: z.boolean().optional(),
  mixMode: z.enum(['say', 'mix']).optional(), raw: z.string().optional(),
})]);
const ttsSettings = z.strictObject({ voice: z.string().optional(), speed: z.union([z.number(), z.string()]).optional(),
  role: z.string().optional(), pitch_shift: z.string().optional(), language_code: z.string().optional(), speaking_rate: z.string().optional() });
const branch = z.strictObject({
  source: z.enum(CONDITION_SOURCES).optional(),
  name: variable.optional(), device: z.string().optional(),
  op: z.enum(CONDITION_OPS).optional(),
  value: z.string().optional(), values: z.union([z.string(), z.array(z.string())]).optional(),
  dialstatus: z.union([z.string(), z.array(z.string())]).optional(),
});
const metadata = { id: z.string().max(255).optional(), enabled: z.boolean().optional(),
  condition: z.strictObject({ dialstatus: z.union([z.literal(''), z.array(z.never()).max(0)]).optional() }).optional() };
const step = <T extends string, S extends z.ZodType>(type: T, params: S) => z.strictObject({ ...metadata, type: z.literal(type), params });

export const autodialScenarioActionSchema = z.discriminatedUnion('type', [
  step('playback', z.strictObject({
    mode: z.enum(PLAYBACK_MODES).optional(), files: z.union([z.string(), z.array(z.string())]).optional(),
    file: z.string().optional(), prompt: z.string().optional(), options: mediaOptions.optional(),
    langoverride: z.string().optional(), digittimeout: z.number().int().optional(),
    digitExit: z.boolean().optional(), digit: z.string().optional(), digitExitDest: z.string().optional(),
  }).default({})),
  step('text2speech', z.strictObject({ text: z.string().trim().min(1).max(10000), engine: z.union([z.string(), z.number().int()]).optional(),
    settings: ttsSettings.optional(), options: mediaOptions.optional(), langoverride: z.string().optional(), digittimeout: z.number().int().optional() })),
  step('toqueue', z.strictObject({ target: fixedTarget.optional(), queue: z.string().optional(), queue_name: z.string().optional(),
    timeout: integerOrString.optional(), options: z.string().regex(/^[A-Za-z]*$/).optional(),
    announceoverride: optionalMediaFile, priority: z.union([z.number().int(), fixedTarget]).optional() }).default({})),
  step('toexten', z.strictObject({ target: fixedTarget.optional(), exten: z.string().optional(), extension: z.string().optional(),
    webrtc: z.boolean().optional(), timeout: integerOrString.optional(), options: z.string().regex(/^[A-Za-z]*$/).optional() }).default({})),
  step('voicerobot', z.strictObject({ robot_uid: z.union([z.number().int(), z.string().regex(/^\d*$/)]).optional(), robotUid: z.number().int().optional() }).default({})),
  step('ai_voice_robot', z.strictObject({ deployment_id: z.string().optional(), deploymentId: z.string().optional(), robot_uid: z.union([z.string(), z.number()]).optional() }).default({})),
  step('collect_input', z.strictObject({
    variableName: z.union([variable, z.literal('')]).optional(), promptFile: optionalMediaFile,
    digitsCount: z.number().int().min(1).max(255).optional(), digits: z.number().int().min(1).max(255).optional(),
    timeout: z.number().int().min(1).max(3600).optional(), attempts: z.number().int().min(1).max(100).optional(),
    mode: z.literal('digits').optional(),
    outcomeMap: z.record(z.string().regex(/^[0-9*#]{1,32}$/), z.string().regex(/^[a-z][a-z0-9_]{0,63}$/)).optional(),
  }).default({})),
  step('label', z.strictObject({ label_name: label.optional(), name: label.optional() })),
  step('goto', z.strictObject({ label_name: label.optional(), label: label.optional(), condition: branch.optional(), false_label: label.optional() })),
  step('hangup', z.strictObject({ signal: z.enum(['busy', 'congestion', 'hangup']).optional(), timeout: integerOrString.optional(), causecode: z.string().regex(/^\d*$/).optional() }).default({})),
]);

export const autodialScenarioSchema = z.array(autodialScenarioActionSchema).max(100);
export type AutodialScenarioAction = z.infer<typeof autodialScenarioActionSchema>;
export const AUTODIAL_CONTRACT_VERSION = 'autodial-scenario-2';

export function autodialScenarioJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(autodialScenarioActionSchema, { target: 'draft-7' });
}
