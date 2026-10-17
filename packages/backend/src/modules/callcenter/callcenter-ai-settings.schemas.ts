import { z } from 'zod';
import { CC_REPORT_IDS } from './reports/callcenter-reports.types';
import { CALLBACK_DIAL_ORDERS, CALLBACK_ORDER_MODES } from '@krasterisk/shared';

const seconds = z.number().int().min(0).describe('Секунды; 0 отключает ограничение');
const boolMap = z.record(z.string(), z.boolean());
const permissions = z.strictObject({
  can_spy: z.boolean().optional(), spyable: z.boolean().optional(),
  spy_modes: z.array(z.enum(['listen', 'whisper', 'barge'])).optional(),
  click_to_call: z.boolean().optional(), customize_ui: z.boolean().optional(),
});
const event = z.enum(['incoming_call', 'missed_call', 'queue_missed_pool', 'sla_threshold', 'chat_message', 'spy_connected']);
const matrix = z.partialRecord(event, z.array(z.enum(['chat', 'sound', 'popup'])));
const pauseOptions = { pauseReasonId: z.number().int().positive().optional(), pauseDurationSec: seconds.optional() };
export const ccSettingsSchemas = {
  tenant: z.strictObject({
    default_sla_threshold: seconds.optional().describe('Время ответа для SLA по умолчанию; индивидуальный servicelevel очереди имеет приоритет'),
    short_abandon_sec: z.number().int().min(0).max(60).optional().describe('Короткие потери исключаются из знаменателя SLA/доли ответов/потерь; 0 отключает исключение'),
    journal_depth: z.number().int().min(1).max(500).optional(), alert_sound_enabled: z.boolean().optional(),
    alert_thresholds: z.strictObject({ max_wait_sec: seconds.optional(), abandon_rate_pct: z.number().min(0).max(100).optional(), sla_critical_pct: z.number().min(0).max(100).optional(), agents_available_min: z.number().int().min(0).optional() }).optional(),
    autopause_enabled: z.boolean().optional().describe('Общий выключатель автоматических пауз, включая RONA'),
    autopause_rules: z.array(z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('missed_count'), threshold: z.number().int().positive(), ...pauseOptions }),
      z.strictObject({ type: z.literal('idle_time'), thresholdSec: seconds, ...pauseOptions }),
      z.strictObject({ type: z.literal('status_duration'), status: z.string().min(1), thresholdSec: seconds, ...pauseOptions }),
    ])).max(20).optional(),
    shift_policy: z.strictObject({
      max_duration_min: z.number().int().min(0).optional(), close_at_eod: z.boolean().optional(),
      eod_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().describe('HH:MM в часовом поясе сервера КЦ'),
      idle_timeout_min: z.number().int().min(0).optional(), idle_requires_unregistered: z.boolean().optional(), free_exten_on_close: z.boolean().optional(),
    }).optional(),
    callback_policy: z.strictObject({ order_mode: z.enum(CALLBACK_ORDER_MODES), dtmf_digit: z.string().regex(/^[0-9*#]$/).optional(), dial_order: z.enum(CALLBACK_DIAL_ORDERS).optional() }).optional(),
    agent_hotkeys: z.record(z.string(), z.string()).nullable().optional().describe('Карта action→Alt+KeyA; null восстанавливает стандартные сочетания'),
  }),
  operator: z.strictObject({ pickup_enabled: z.boolean().optional(), auto_answer: z.boolean().optional(), auto_answer_zip_tone: z.boolean().optional(), wrapup_timeout: seconds.optional(), wrapup_extend_step: seconds.optional(), wrapup_autosave_draft: z.boolean().optional(), sound_incoming: z.boolean().optional(), sound_missed: z.boolean().optional(), notifications_enabled: z.boolean().optional(), volume: z.number().int().min(0).max(100).optional() }),
  ui: z.strictObject({ ui_visibility: boolMap.optional(), softphone_placement: z.enum(['bottom-right', 'bottom-left', 'hidden']).optional() }),
  permissions,
  notifications: z.strictObject({ notification_matrix: matrix.optional() }),
  permission_defaults: z.strictObject({ role_permission_defaults: z.partialRecord(z.enum(['0', '1', '2', '3', '5']), permissions).optional(), permission_locks: z.partialRecord(z.enum(['0', '1', '2', '3', '5']), boolMap).optional() }),
  ui_defaults: z.strictObject({ ui_visibility_defaults: boolMap.optional(), ui_visibility_locks: boolMap.optional() }),
  notification_defaults: z.strictObject({ notification_defaults: matrix.optional(), notification_locks: matrix.optional() }),
};
export const pauseReasonSchema = z.strictObject({ name: z.string().min(1).max(128), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), max_duration: seconds.describe('Лимит паузы в минутах; 0 — без лимита').optional(), is_paid: z.boolean().optional(), sort_order: z.number().optional() });
export const alertRoutingSchema = z.strictObject({ integration_uid: z.number().int().positive().nullable().optional(), target: z.string().max(255).nullable().optional(), enabled: z.boolean().optional(), cooldown_sec: z.number().int().min(30).max(3600).optional() });
export const scheduleSchema = z.strictObject({
  name: z.string().min(1).max(128), report_id: z.enum(CC_REPORT_IDS), format: z.enum(['csv', 'xlsx']),
  period_preset: z.enum(['today', 'yesterday', 'last-7-days', 'last-30-days', 'previous-month']),
  filters: z.strictObject({ queueName: z.string().optional(), agentInterface: z.string().optional() }).optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']), hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(), day_of_month: z.number().int().min(1).max(28).nullable().optional(),
  integration_uid: z.number().int().positive(), target: z.string().max(256).nullable().optional(), subject_template: z.string().max(256).nullable().optional(), message_template: z.string().nullable().optional(), enabled: z.boolean().optional(),
});
