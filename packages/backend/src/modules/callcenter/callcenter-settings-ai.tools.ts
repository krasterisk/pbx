import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { type AiToolDefinition } from '../ai-platform/ai-adapter.types';
import { jsonSchemaOf, type AiMutationContext } from '../ai-platform/ai-mutation.contract';
import { CallCenterSettingsService } from './callcenter-settings.service';
import { CallCenterService } from './callcenter.service';
import { CallCenterWallboardService } from './callcenter-wallboard.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterReportSchedulesService, computeNextRun } from './reports/callcenter-report-schedules.service';
import { ccConfigMutation, requireCcSupervisor } from './callcenter-ai-config.util';
import { ccSettingsSchemas, pauseReasonSchema, scheduleSchema, alertRoutingSchema } from './callcenter-ai-settings.schemas';

const id = z.number().int().positive();
const empty = z.strictObject({});
const byId = z.strictObject({ id });
type Context = AiMutationContext;

@Injectable()
export class CallCenterSettingsAiTools  {
  constructor(
    private readonly settings: CallCenterSettingsService,
    private readonly cc: CallCenterService,
    private readonly wallboard: CallCenterWallboardService,
    private readonly schedules: CallCenterReportSchedulesService,
    private readonly state: CallCenterStateService,
  ) {}

  getKnowledgeBlock() {
    return `## Настройка колл-центра через чат
- Сначала прочитайте cc_get_* и текущие очереди get_queue_configuration/list_queues. Изменяйте только запрошенные поля; каждое cc_update/create/delete требует предпросмотра и подтверждения. Конфликт ревизии требует нового предложения.
- Общие настройки: SLA (секунды), короткие потери, журнал, пороги предупреждений, автоматические паузы, правила завершения смены, обратный звонок и горячие клавиши — cc_get/update_tenant_settings. Смена политики может закрыть действующие смены при следующей проверке; 0 отключает ограничение времени.
- RONA — встроенная реакция на неответ, не пользовательское правило. autopause_enabled отключает все автоматические паузы. Причины пауз настраиваются отдельно.
- SLA КЦ — порог по умолчанию; servicelevel очереди имеет приоритет. Короткие потери меняют знаменатель SLA/ответов/потерь. Пороги сигналов не изменяют маршрутизацию.
- Оператор: operatorId не указан → текущий пользователь из сессии; чужие настройки доступны только супервизору/администратору. Права/уведомления/видимость объединяются с ролью и блокировками сервера.
- Роли: 0 супер-админ, 1 админ, 2 оператор, 3 супервизор, 5 чтение. Числовое сравнение уровней недопустимо. can_spy/spy_modes управляют прослушиванием, spyable — разрешением слушать оператора.
- Локальные виды карточки/таблица и вкладки компьютера сохраняются в браузере, не являются серверной настройкой MCP.
- Расписания отчётов используют время сервера (cc_preview_report_schedule). enabled=true включает реальную отправку по расписанию через существующую интеграцию; run-now не выполняется этими инструментами. Не выдумывайте integration_uid/адрес получателя.
- cc_update_alert_routing включает реальные уведомления, cooldown_sec ограничивает частоту. Секреты интеграций в чат не передаются.
- TV-доступ: cc_list/create/revoke_display_token; токен доступен человеку в настройках экранов, модель получает только метаданные, без bearer-ссылки.
- Очереди/стратегия/таймаут/ожидание/музыка/участники: существующие create_queue/update_queue/get_queue_configuration. timeout — время вызова одному оператору, не общее ожидание. cc_*_queue_member меняет участие в текущей смене; постоянный состав — update_queue.
- Карточки: cc_list/get/create/update_card_template. Списки бизнес-значений — универсальные list_directories/create_directory/list_directory_records, затем привязка поля к UID справочника и колонок; не создавайте статические таблицы для темы/источника/услуги.`;
  }

  getTools(): AiToolDefinition[] {
    const tools: AiToolDefinition[] = [];
    const tenantKinds = [
      ['tenant', 'tenant_settings', 'Общие политики и пороги КЦ', 'getTenantSettings', 'updateTenantSettings'],
      ['permission_defaults', 'permission_defaults', 'Ролевые права и блокировки КЦ', 'getTenantPermissionsDefaults', 'updateTenantPermissionsDefaults'],
      ['ui_defaults', 'ui_defaults', 'Видимость панелей по умолчанию и блокировки', 'getTenantUiDefaults', 'updateTenantUiDefaults'],
      ['notification_defaults', 'notification_defaults', 'Уведомления по умолчанию и блокировки событий', 'getTenantNotificationDefaults', 'updateTenantNotificationDefaults'],
    ] as const;
    for (const [kind, suffix, description, get, update] of tenantKinds) {
      const read = (_a: any, ctx: Context) => this.settings[get](ctx.vpbxUserUid);
      tools.push(this.read(`cc_get_${suffix}`, description, empty, read, kind !== 'tenant'));
      tools.push(ccConfigMutation({ name: `cc_update_${suffix}`, description, schema: z.strictObject({ patch: ccSettingsSchemas[kind] }), read,
        write: (a, ctx) => (this.settings[update] as any)(ctx.vpbxUserUid, a.patch), preview: (a, before) => ({ ...before, ...a.patch }) }));
    }
    const operatorKinds = [
      ['operator', 'operator_settings', 'Настройки обработки звонка оператора (время в секундах)', 'getOperatorSettings', 'updateOperatorSettings'],
      ['ui', 'operator_ui', 'Видимость панелей и положение телефона оператора', 'getOperatorUiCustomization', 'updateOperatorUiCustomization'],
      ['permissions', 'operator_permissions', 'Права оператора с учётом ролевых блокировок', 'getOperatorPermissions', 'updateOperatorPermissions'],
      ['notifications', 'operator_notifications', 'Матрица событий и каналов уведомлений оператора', 'getOperatorNotifications', 'updateOperatorNotifications'],
    ] as const;
    for (const [kind, suffix, description, get, update] of operatorKinds) {
      const target = (a: any, ctx: Context) => a.operatorId ?? ctx.userUid;
      const authorize = (a: any, ctx: Context) => {
        if (!Number.isInteger(ctx.userUid) || ctx.userUid <= 0) throw new Error('Authenticated user required');
        if (a.operatorId != null && a.operatorId !== ctx.userUid) requireCcSupervisor(ctx);
      };
      const read = (a: any, ctx: Context) => { authorize(a, ctx); return (this.settings[get] as any)(ctx.vpbxUserUid, target(a, ctx)); };
      tools.push(this.read(`cc_get_${suffix}`, description, z.strictObject({ operatorId: id.optional() }), read, false));
      tools.push(ccConfigMutation({ name: `cc_update_${suffix}`, description, schema: z.strictObject({ operatorId: id.optional(), patch: ccSettingsSchemas[kind] }), read, authorize,
        write: (a, ctx) => (this.settings[update] as any)(ctx.vpbxUserUid, target(a, ctx), a.patch), preview: (a, before) => ({ ...before, ...a.patch }) }));
    }
    tools.push(this.read('cc_get_permissions_matrix', 'Эффективные права всех операторов КЦ', empty, (_a, c) => this.settings.getPermissionsMatrix(c.vpbxUserUid)));
    tools.push(this.read('cc_list_pause_reasons', 'Причины пауз КЦ', empty, (_a, c) => this.cc.getPauseReasons(c.vpbxUserUid), false));
    const reasonRead = async (a: any, c: Context) => {
      const rows = await this.cc.getPauseReasons(c.vpbxUserUid);
      if (a.id == null) return rows;
      const found = rows.find(r => r.uid === a.id); if (!found) throw new Error('Pause reason not found'); return found;
    };
    tools.push(ccConfigMutation({ name: 'cc_create_pause_reason', description: 'Создать причину паузы; max_duration в минутах, 0 — без лимита', schema: pauseReasonSchema, read: reasonRead, write: (a, c) => this.cc.createPauseReason(a, c.vpbxUserUid) }));
    tools.push(ccConfigMutation({ name: 'cc_update_pause_reason', description: 'Изменить причину паузы', schema: z.strictObject({ id, patch: pauseReasonSchema.partial() }), read: reasonRead, write: (a, c) => this.cc.updatePauseReason(a.id, a.patch, c.vpbxUserUid) }));
    tools.push(ccConfigMutation({ name: 'cc_delete_pause_reason', description: 'Удалить причину паузы', destructive: true, schema: byId, read: reasonRead, write: (a, c) => this.cc.deletePauseReason(a.id, c.vpbxUserUid) }));
    const watchedRead = (_a: any, c: Context) => this.cc.getWatchedAgents(c.vpbxUserUid, c.userUid);
    tools.push(this.read('cc_get_watched_agents', 'Личный список наблюдения супервизора', empty, watchedRead));
    tools.push(ccConfigMutation({ name: 'cc_update_watched_agents', description: 'Заменить личный список наблюдения; доступ проверяется сервером', schema: z.strictObject({ userIds: z.array(id) }), read: watchedRead, write: (a, c) => this.cc.setWatchedAgents(c.vpbxUserUid, c.userUid, a.userIds) }));
    for (const action of ['add', 'remove', 'penalty'] as const) {
      tools.push(ccConfigMutation({ name: `cc_${action}_queue_member`, description: `${action}: участие оператора в очереди текущей смены (не постоянный состав)`,
        schema: z.strictObject({ agentInterface: z.string().min(1).max(64), queue: z.string().min(1).max(64), ...(action === 'remove' ? {} : { penalty: z.number().int().min(0) }) }),
        read: async (a, c) => this.state.getAllAgents(c.vpbxUserUid).find(agent => agent.interface === a.agentInterface) ?? null,
        write: (a, c) => action === 'add' ? this.cc.supervisorQueueAdd(a.agentInterface, a.queue, a.penalty, c.vpbxUserUid, c.userUid)
          : action === 'remove' ? this.cc.supervisorQueueRemove(a.agentInterface, a.queue, c.vpbxUserUid) : this.cc.supervisorQueuePenalty(a.agentInterface, a.queue, a.penalty, c.vpbxUserUid),
      }));
    }
    const alertRead = (_a: any, c: Context) => this.wallboard.getAlertConfig(c.vpbxUserUid);
    tools.push(this.read('cc_get_alert_routing', 'Доставка предупреждений КЦ', empty, alertRead));
    tools.push(ccConfigMutation({ name: 'cc_update_alert_routing', description: 'Изменить доставку предупреждений; enabled включает реальные отправки', schema: alertRoutingSchema, read: alertRead, write: (a, c) => this.wallboard.updateAlertConfig(c.vpbxUserUid, a) }));
    const scheduleRead = (a: any, c: Context) => a.id == null ? this.schedules.findAll(c.vpbxUserUid) : this.schedules.findOne(a.id, c.vpbxUserUid);
    tools.push(this.read('cc_list_report_schedules', 'Расписания автоматической доставки отчётов', empty, scheduleRead));
    tools.push(this.read('cc_preview_report_schedule', 'Следующий запуск по часам сервера; без отправки', scheduleSchema, async (a) => ({ nextRunAt: computeNextRun(a).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })));
    tools.push(ccConfigMutation({ name: 'cc_create_report_schedule', description: 'Создать расписание; enabled=true включает реальную доставку', schema: scheduleSchema, read: scheduleRead, write: (a, c) => this.schedules.create(a, c.vpbxUserUid) }));
    tools.push(ccConfigMutation({ name: 'cc_update_report_schedule', description: 'Изменить расписание доставки отчётов', schema: z.strictObject({ id, patch: scheduleSchema.partial() }), read: scheduleRead, write: (a, c) => this.schedules.update(a.id, a.patch, c.vpbxUserUid) }));
    tools.push(ccConfigMutation({ name: 'cc_delete_report_schedule', description: 'Удалить расписание доставки отчётов', destructive: true, schema: byId, read: scheduleRead, write: (a, c) => this.schedules.remove(a.id, c.vpbxUserUid) }));
    const tokensRead = async (_a: any, c: Context) => (await this.wallboard.listTokens(c.vpbxUserUid)).map(row => ({ uid: row.uid, label: row.label, expires_at: row.expires_at, revoked_at: row.revoked_at }));
    tools.push(this.read('cc_list_display_tokens', 'Метаданные TV-доступа без секретных токенов', empty, tokensRead));
    tools.push(ccConfigMutation({ name: 'cc_create_display_token', description: 'Создать доступ TV; человек получает ссылку в настройках экранов', schema: z.strictObject({ label: z.string().max(128).optional(), expires_in_days: id.optional() }), read: tokensRead, write: (a, c) => this.wallboard.generateToken(c.vpbxUserUid, c.userUid, a) }));
    tools.push(ccConfigMutation({ name: 'cc_revoke_display_token', description: 'Отозвать доступ TV', destructive: true, schema: byId, read: tokensRead, write: (a, c) => this.wallboard.revokeToken(c.vpbxUserUid, a.id) }));
    return tools;
  }

  private read(name: string, description: string, schema: z.ZodObject<any>, run: (a: any, ctx: Context) => Promise<any>, supervisor = true): AiToolDefinition {
    return { name, description, entityType: 'callcenter_config', inputSchema: jsonSchemaOf(schema).properties,
      handler: async (raw, tenant, caller) => {
        const a = schema.parse(raw); const ctx = { vpbxUserUid: tenant, userUid: caller?.userUid ?? 0, role: caller?.role ?? -1, isAdmin: false };
        if (supervisor) requireCcSupervisor(ctx);
        return { configuration: await run(a, ctx) };
      } };
  }
}
