import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { VoiceRobotsService } from './voice-robots.service';
import { VoiceRobotConfigurationService, redactRobotSecrets } from './voice-robot-configuration.service';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import { botActionSchema, dataListSchema, groupFields, keywordSchema, scenarioFileSchema, validateScenario } from './voice-robot-scenario';

const id = z.number().int().positive();
const robotId = z.strictObject({ robotId: id });
export const robotSettingsSchema = z.strictObject({
  name: z.string().trim().min(1).max(255), description: z.string().max(12000).nullable().optional(),
  active: z.boolean().optional(), language: z.enum(['ru-RU', 'en-US', 'kk-KZ']).optional(),
  stt_engine_id: id.nullable().optional(), tts_engine_id: id.nullable().optional(),
  greeting_tts_text: z.string().max(12000).nullable().optional(), initial_group_id: id.nullable().optional(),
  max_conversation_steps: z.number().int().min(1).max(50).optional(), silence_timeout_seconds: z.number().int().min(5).max(120).optional(),
  max_inactivity_repeats: z.number().int().min(1).max(10).optional(), tts_mode: z.enum(['batch', 'streaming']).optional(),
  stt_mode: z.enum(['hybrid', 'full_stream']).optional(), tts_cache_max_age_days: z.number().int().min(0).max(3650).optional(),
  vad_config: z.strictObject({ silence_timeout_ms: z.number().int().min(100).max(10000).optional(),
    max_duration_seconds: z.number().int().min(1).max(60).optional(), barge_in: z.boolean().optional(),
    min_speech_duration_ms: z.number().int().min(100).max(5000).optional() }).optional(),
  fallback_bot_action: botActionSchema.nullable().optional(), max_retries_bot_action: botActionSchema.nullable().optional(),
});
export interface RobotTool {
  name: string; description: string; input: z.ZodObject<any>; readOnly: boolean;
  execute(args: Record<string, any>, tenant: number, expectedRevision?: string): Promise<any>;
}
/** Shared catalog: base MCP/chat propose via adapter, standalone MCP executes credential-authorized writes. */
@Injectable()
export class VoiceRobotToolsService {
  constructor(private readonly service: VoiceRobotsService, readonly configuration: VoiceRobotConfigurationService,
    private readonly providers: AiProvidersService) {}
  definitions(): RobotTool[] {
    const read = (name: string, description: string, input: z.ZodObject<any>, execute: RobotTool['execute']): RobotTool => ({ name, description, input, readOnly: true,
      execute: async (args, tenant, revision) => redactRobotSecrets(await execute(args, tenant, revision)) });
    const write = (name: string, description: string, input: z.ZodObject<any>): RobotTool => ({ name, description, input, readOnly: false,
      execute: (args, tenant, revision) => this.configuration.write(name, args, tenant, revision) });
    const group = z.strictObject(groupFields);
    const partial = (schema: z.ZodObject<any>) => schema.partial().refine(data => Object.keys(data).length > 0, 'At least one changed field required');
    return [
      read('get_voice_robot_configuration', 'Полные настройки, группы, фразы и справочники своего робота, portable scenario и revision для контроля параллельных изменений. Секреты скрыты.', robotId,
        (a, t) => this.configuration.configuration(t, a.robotId)),
      read('export_voice_robot_scenario', 'Экспорт JSON формата krasterisk.voice-robot.scenario v1 для Диалог → Импорт JSON. Секреты webhook исключаются; не импортируй повторно без необходимости.', robotId,
        (a, t) => this.configuration.exportScenario(t, a.robotId)),
      read('validate_voice_robot_scenario', 'Проверить portable JSON, ссылки, поля и ограничения runtime без записи и звонков.', z.strictObject({ file: z.unknown() }),
        async a => validateScenario(a.file)),
      read('check_voice_robot_readiness', 'Готовность конфигурации: активность, движки, стартовый сценарий и ошибки. Не подтверждает реальный звук, доступность облака или маршрут звонка.', robotId,
        async (a, t) => this.readiness(t, a.robotId)),
      read('list_voice_robot_speech_engines', 'Доступные STT/TTS этого кабинета: uid, имя, vendor, enabled и configured. Ключи не возвращаются; сначала выбери существующие движки.', z.strictObject({ kind: z.enum(['stt', 'tts']) }),
        async (a, t) => { const rows = await this.providers.findAll(t, a.kind); return { engines: rows.map((r: any) => ({
          uid: r.uid, name: r.name, vendor: r.vendor ?? r.type, enabled: r.enabled ?? true,
          configured: r.type === 'custom' || r.vendor === 'custom' ? !!(r.custom_url || r.endpoint)
            : !!(r.has_api_key || r.encrypted_api_key || r.has_token || r.token),
        })) }; }),
      read('list_voice_robot_keyword_groups', 'Группы своего робота, включая global и inactive.', robotId, (a, t) => this.service.getKeywordGroups(t, a.robotId)),
      read('list_voice_robot_keywords', 'Фразы, синонимы и действия одной группы своего робота. Секреты скрыты.', z.strictObject({ groupId: id }),
        async (a, t) => redactRobotSecrets(await this.service.getKeywords(t, a.groupId))),
      read('list_voice_robot_data_lists', 'Справочники своего робота: uid, колонки, строки.', robotId, (a, t) => this.service.getDataLists(t, a.robotId)),
      read('test_voice_robot_match', 'Текстовая имитация STT: сопоставить фразу со ВСЕМИ активными группами. Не выполняет действие, FSM, TTS или реальный звонок.', robotId.extend({ text: z.string().trim().min(1).max(4000) }),
        (a, t) => this.service.testMatch(t, a.robotId, a.text)),
      read('test_voice_robot_data_list', 'Проверить запрос и возвращаемую колонку своего справочника без звонка.', z.strictObject({ uid: id, query: z.string().trim().min(1).max(4000), returnField: z.string().min(1).max(64) }),
        (a, t) => this.service.testDataListSearch(t, a.uid, a.query, a.returnField)),
      read('list_voice_robot_calls', 'Последние CDR своего робота. История может содержать персональные данные звонящего.', robotId.extend({ limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) }),
        (a, t) => this.service.findAllCdr(t, { robotId: a.robotId, limit: a.limit, offset: a.offset })),
      read('get_voice_robot_call', 'Одна запись CDR с шагами и распознанными репликами своего кабинета. Не генерирует звонок.', z.strictObject({ uid: id }), (a, t) => this.service.getCdrWithLogs(t, a.uid)),
      read('get_voice_robot_logs', 'Логи распознавания своего робота для диагностики. Не выполняет действия.', robotId, (a, t) => this.service.getLogs(t, a.robotId)),
      write('create_voice_robot', 'Создать робота своего кабинета; optional scenario импортируется атомарно вместе с ним. По умолчанию inactive. Не создаёт маршрут и не перезагружает Asterisk.',
        z.strictObject({ data: robotSettingsSchema, scenario: scenarioFileSchema.optional() })),
      write('update_voice_robot', 'Изменить только переданные настройки своего робота: движки, язык, приветствие, лимиты, VAD и fallback. UID движков предварительно проверить. Без dialplan reload.',
        z.strictObject({ uid: id, data: partial(robotSettingsSchema) })),
      write('delete_voice_robot', 'Удалить своего робота с его группами/фразами/справочниками. Отказ при ссылке из маршрута. Требует явного намерения пользователя.', z.strictObject({ uid: id })),
      write('import_voice_robot_scenario', 'Атомарно ДОБАВИТЬ группы, фразы, справочники portable JSON; обновить приветствие/старт/fallback. Не заменяет и не удаляет старые группы; повтор создаёт дубликаты.',
        robotId.extend({ file: scenarioFileSchema })),
      write('create_voice_robot_keyword_group', 'Создать группу в своём роботе. Настрой active/is_global явно; после создания добавь фразы.', robotId.extend({ data: group })),
      write('update_voice_robot_keyword_group', 'Изменить имя, описание, активность или global существующей группы. Отказ при невалидном стартовом состоянии.', z.strictObject({ uid: id, data: partial(group) })),
      write('delete_voice_robot_keyword_group', 'Удалить группу и её фразы. Отказ если на группу ссылается сценарий; сначала убери переходы.', z.strictObject({ uid: id })),
      write('create_voice_robot_keyword', 'Создать фразу в своей группе. keywords — одна фраза; synonyms — альтернативы. В отдельных CRUD действиях switch_group использует реальный UID; portable ключи только при импорте.', z.strictObject({ groupId: id, data: keywordSchema })),
      write('update_voice_robot_keyword', 'Изменить фразу, синонимы, действие, лимит повторов или тег своей фразы. Не переносит между группами.', z.strictObject({ uid: id, data: partial(keywordSchema) })),
      write('delete_voice_robot_keyword', 'Удалить одну свою фразу. Отказ если стартовая или целевая группа останется пустой.', z.strictObject({ uid: id })),
      write('create_voice_robot_data_list', 'Создать справочник в своём роботе. Все значения строк — строки, названия колонок уникальны; нужен searchable столбец.', robotId.extend({ data: dataListSchema })),
      write('update_voice_robot_data_list', 'Изменить имя/описание/колонки/строки своего справочника; несовместимые ссылки returnField отклоняются.', z.strictObject({ uid: id, data: partial(dataListSchema) })),
      write('delete_voice_robot_data_list', 'Удалить свой справочник. Отказ если действия робота продолжают на него ссылаться.', z.strictObject({ uid: id })),
    ];
  }
  private async readiness(tenant: number, uid: number) {
    const configuration = await this.configuration.configuration(tenant, uid);
    const errors: string[] = []; const engines: Record<string, any> = {};
    for (const kind of ['stt', 'tts'] as const) {
      const engineId = configuration.robot[`${kind}_engine_id`];
      if (!engineId) { errors.push(`${kind.toUpperCase()} engine not selected`); continue; }
      try {
        const engine = await this.providers.loadSpeechEngine(tenant, engineId, kind);
        const configured = engine.type === 'custom' ? !!engine.custom_url : !!engine.token;
        engines[kind] = { uid: engineId, name: engine.name, configured };
        if (!configured) errors.push(`${kind.toUpperCase()} credentials/endpoint not configured`);
      } catch { errors.push(`${kind.toUpperCase()} engine missing, disabled or unavailable for tenant`); }
    }
    const scenario = validateScenario(configuration.scenario);
    errors.push(...scenario.errors);
    if (!configuration.robot.active) errors.push('Robot inactive');
    return { configurationReady: errors.length === 0, errors, warnings: scenario.warnings, engines,
      revision: configuration.revision, gates: { scenario: scenario.valid ? 'pass' : 'fail',
        cloudProvidersLive: 'pending', callRoute: 'manual-check-required', realAudioConversation: 'pending' },
      nextSteps: ['Check Dialogue → Tree and Test text matches', 'Configure a dedicated test call route with PBX administrator',
        'Make one test call and inspect Voice robots → Call log; no automatic call is made by this tool'] };
  }
}
