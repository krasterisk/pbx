import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { CallsQuery, CallRecord } from '@krasterisk/shared';
import type { CallsService } from './calls.service';
import { CallsQueryDto } from './calls-query.dto';
import type { AiToolDefinition } from '../../ai-platform/ai-adapter.types';
import { AI_CALL_PERIODS, aiCallPeriod } from './calls-ai-period';
import type { JwtPayloadUser } from '../../auth/auth.service';
import { callsAiTiming } from './calls-ai-timing';

const filters: Record<string, unknown> = {
  mine: { type: 'boolean', description: 'Only calls involving the authenticated employee. Resolved on the server; never supply a guessed employee id.' },
  period: { type: 'string', enum: AI_CALL_PERIODS, description: 'Server resolves company timezone. last_week = previous Monday–Sunday, not rolling seven days. Do not combine with explicit dates.' },
  callerEmployee: { type: 'string', description: 'Exact initiating employee identity from resolve_call_employees; unlike employees, excludes calls where they only participated.' },
  dateFrom: { type: 'string', description: 'First company day YYYY-MM-DD' },
  dateTo: { type: 'string', description: 'Last day inclusive YYYY-MM-DD' },
  from: {
    type: 'string',
    description: 'Inclusive ISO timestamp with timezone',
  },
  to: { type: 'string', description: 'Exclusive ISO timestamp with timezone' },
  search: {
    type: 'string',
    maxLength: 200,
    description:
      'Phone, employee name or department; no transcript/semantic search',
  },
  direction: { type: 'string', enum: ['in', 'out', 'internal', 'external'] },
  outcome: {
    type: 'string',
    enum: [
      'human',
      'robot',
      'voicemail',
      'menu',
      'missed',
      'error',
      'unknown',
      'active',
    ],
  },
  handling: {
    type: 'string',
    enum: ['employee', 'queue', 'menu', 'voiceRobot', 'aiRobot', 'autodial'],
  },
  origin: { type: 'string', enum: ['telephony', 'ai', 'autodial'] },
  focusOutcome: {
    type: 'string',
    enum: [
      'human',
      'robot',
      'voicemail',
      'menu',
      'missed',
      'error',
      'unknown',
      'active',
    ],
  },
  unassignedDimensions: {
    type: 'array',
    items: {
      type: 'string',
      enum: ['employee', 'department', 'companyNumber'],
    },
    maxItems: 3,
  },
  focusEmployee: { type: 'string' },
  focusDepartment: { type: 'string' },
  focusCompanyNumber: { type: 'string' },
  extension: { type: 'string' },
  department: { type: 'string' },
  companyNumber: { type: 'string' },
  dashboardOutcome: {
    type: 'string',
    enum: ['accepted', 'missed', 'unknown', 'active'],
  },
  recording: { type: 'string', enum: ['yes', 'no'] },
  voicemail: { type: 'string', enum: ['1'] },
  analytics: {
    type: 'string',
    enum: ['none', 'queued', 'running', 'analyzed', 'failed'],
  },
  ...Object.fromEntries(
    [
      'employees',
      'departments',
      'companyNumbers',
      'queues',
      'robots',
      'outcomes',
    ].map((k) => [
      k,
      {
        type: 'array',
        items: { type: 'string' },
        maxItems: k === 'outcomes' ? 8 : 30,
      },
    ]),
  ),
};
function query(args: Record<string, unknown>): CallsQuery {
  const copy = { ...args };
  if (copy.direction === 'int') copy.direction = 'internal';
  const requested = Number(copy.limit ?? 20);
  if (!Number.isFinite(requested) || requested < 1)
    throw new BadRequestException('Invalid call limit');
  copy.limit = Math.min(50, Math.floor(requested));
  const dto = plainToInstance(CallsQueryDto, copy);
  if (validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length)
    throw new BadRequestException('Invalid call filters');
  return dto;
}
export const callsAiFilterSchema = filters;
export async function prepareCallsAiQuery(calls: CallsService, user: JwtPayloadUser, args: Record<string, unknown>): Promise<CallsQuery> {
  const copy = {...args};
  if (copy.mine !== undefined) {
    if (typeof copy.mine !== 'boolean') throw new BadRequestException('Invalid own-call selector');
    if (copy.mine) {
      const employee = await calls.aiOwnEmployee(user);
      if (!employee) throw new BadRequestException('Current user has no mapped extension; ask for employee identity');
      if (copy.focusEmployee && copy.focusEmployee !== employee) throw new BadRequestException('Conflicting own-call filters');
      copy.focusEmployee = employee;
    }
    delete copy.mine;
  }
  if (copy.period !== undefined) {
    if (['dateFrom','dateTo','from','to'].some(key=>copy[key] !== undefined)) throw new BadRequestException('Choose a relative period or explicit dates');
    if (typeof copy.period !== 'string') throw new BadRequestException('Invalid relative call period');
    Object.assign(copy, aiCallPeriod(copy.period, await calls.aiTimezone(user)));
    delete copy.period;
  }
  return query(copy);
}
export function callsJournalLink(q: CallsQuery, id?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q))
    if (value !== undefined && key !== 'limit')
      for (const entry of Array.isArray(value) ? value : [value])
        params.append(key, String(entry));
  return `/reports/calls${id ? `/${encodeURIComponent(id)}` : ''}?${params}`;
}
export function callsAiLocalTime(value: string | null | undefined, timezone: string | undefined): string | null {
  if (!value || !timezone || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat('ru-RU', {timeZone: timezone, timeZoneName:'shortOffset',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value));
}
function brief(call: CallRecord, q: CallsQuery, timezone?: string) {
  return {
    id: call.id,
    startedAt: call.startedAt,
    startedAtLocal: callsAiLocalTime(call.startedAt, timezone),
    direction: call.direction,
    outcome: call.outcome,
    caller: call.caller,
    recipient: call.recipient,
    companyNumber: call.companyNumber,
    handling: call.handling,
    ...callsAiTiming(call),
    analytics: call.analytics ? { state: call.analytics.state } : null,
    url: callsJournalLink(q, call.id),
  };
}
export const callsKnowledge = `## Анализ звонков компании
- search_calls/get_call/summarize_calls используют единую модель, фильтры и права журнала. По умолчанию сегодня в часовом поясе компании; лимит20, максимум50.
- Обзор требует период до366 дней; внимание до31 дня. Пустые dateFrom/dateTo означают всю историю только для журнала.
- Human/robot/voicemail/menu/missed/error/unknown различаются. Соединение не доказывает решение вопроса. Unknown и неполноту сообщай явно. Не называй ASR долей принятых человеком.
- connectionTiming.precision=estimated означает приблизительное время (пиши «≈» или «примерно»), observed — измеренное по событиям соединения. Если conversationConfirmed=false, не пиши «разговор состоялся» и не называй connectionTiming.seconds длительностью разговора: это лишь время соединения с неподтверждённым исходом. connectedSec=null означает неизвестное время разговора, не ноль. Не суммируй такие оценки вместо summary.totalConnectedSec.
- list_unreturned_missed группирует пропуски/голосовые в окне организации (по умолчанию24h, фактическое windowHours возвращает инструмент). Номер+номер компании — вероятная связь в доступной истории. Попытка, исходящее соединение и клиент перезвонил сам различаются. Unknown не означает, что компания не перезвонила.
- Разрезы сотрудников показывают участие; итог относится ко всему звонку. Суммы разрезов не складываются, это не персональный рейтинг.
- resolve_call_employees разрешает имя сотрудника в любой последовательности слов; при однофамильцах уточни выбор. summarize_employee_calls: «сколько сделала Мария Иванова» => employeeName, relationship=initiator, direction=out; используй summary.totalConnectedSec всей выборки, не среднее×число и не сумму50 строк. Время всего звонка после переводов не является индивидуальным временем сотрудника.
- summarize_call_conversations: «сводка вчерашних разговоров Петрова Ивана» => employeeName, period=yesterday, relationship=participant. Содержание только из доступных project summaries; охват ограничен20 звонками, указывай coverage. При отсутствии анализа не придумывай темы.
- Для сводки учитывай coverage.includedAnalyses: это число саммари, фактически переданных в ответе инструмента. availableAnalyses может быть больше. При nextAnalysisOffset повторяй summarize_call_conversations с analysisOffset=nextAnalysisOffset и теми же фильтрами до конца продолжения; объединяй страницы без повторов. При contentTruncated без продолжения сузь период; не делай вывод обо всех разговорах из переданной части. Подробные показатели отдельного разговора читай через get_call_analysis; при metricsTruncated полный набор доступен в карточке.
- CSAT, sentiment и success из speech analytics — выводы модели (assessmentSource=model_inference), не ответы клиента в опросе. При containsCustomerSurvey=false нельзя писать «клиент оценил разговор на5»: пиши «прогноз CSAT модели5». success=true — модель сочла вопрос решённым, не подтверждение фактического исполнения услуги. Не превращай прогноз в установленный факт.
- Саммари подтверждает только явно записанные факты. Сохраняй сроки, отрицания и модальность: из условия «после события» не следует, что событие уже произошло. Не добавляй совершившиеся действия, точные слова или события, которых нет в саммари.
- Для «с кем я говорил» perspectiveEmployee с role=current_user — сам пользователь, а не собеседник. Возвращай rows.counterparty; если имя неизвестно, назови номер и явно скажи, что имя не установлено. При counterparty=null личность собеседника не подтверждена исходной парой сторон; не угадывай её по другим участникам.
- total=0 при source.state=ok означает ноль в разрешённой выборке. Ответь с этим периодом и ограничениями доступа; не расширяй направление/инициатора/период, пытаясь получить ненулевой результат. Не подменяй исходящие звонки всеми звонками с участием сотрудника.
- Время компании уже вычислено сервером в startedAtLocal/endedAtLocal. Копируй его из той же строки звонка, не пересчитывай UTC в уме и не вычисляй конец прибавлением длительности. Если локального времени нет, не угадывай его. Ссылки url относительные: используй их дословно, не добавляй домен и не меняй параметры/идентификатор реплики.
- search_call_content: «найди номер и с кем я говорил на прошлой неделе о башенном кране» => phrase="башенный кран", period=last_week, mine=true, mode=semantic. Для «я» используй текущую привязку пользователя; self_unmapped требует уточнения, не ищи по всей компании. Возвращай контакты и ссылки/таймкод из результата. Сырые цитаты открываются в журнале, не пересказывай их из догадок.
- Поиск по теме разговора всегда начинай с search_call_content в mode=semantic, сохраняя полную тему запроса и отрицания. mode=literal нужен только для явно запрошенной точной фразы. Пустой ответ не разрешает ослаблять тему до одного общего слова или выдавать обычные search_calls за тематические совпадения. mine=true у обычного поиска ограничивает участника, но не проверяет содержание разговора.
- get_call_analysis читает разбор одного звонка с актуальными правами SA/проекта. not_applicable и insufficient_evidence не нули и не максимумы. Эти инструменты не предоставляют расшифровки целиком.
- Давай ссылки url, период/часовой пояс/размер выборки и ограничения. Относительный period сервер вычисляет в зоне компании; last_week — предыдущие понедельник–воскресенье. Не смешивай period с точными датами. Ошибка поиска/недоступность не равны отсутствию звонков.
- find_cdr_calls/get_cdr_summary — переходные имена search_calls/summarize_calls с новой моделью результатов.`;

export function callsAiTools(calls: CallsService): AiToolDefinition[] {
  const actor = async (uid: number, ctx?: { userUid: number }) => {
    if (!ctx || !Number.isSafeInteger(ctx.userUid) || ctx.userUid <= 0)
      throw new ForbiddenException('User context is required');
    return calls.aiActor(uid, ctx.userUid);
  };
  const search: AiToolDefinition = {
    name: 'search_calls',
    description:
      'Find logical company calls by structured filters, phone or employee. Same ACL/counts as the journal; no transcript search. At most50 rows.',
    inputSchema: {
      ...filters,
      limit: { type: 'integer', default: 20, minimum: 1, maximum: 50 },
    },
    entityType: 'call',
    handler: async (args, uid, ctx) => {
      const user = await actor(uid, ctx),
        q = await prepareCallsAiQuery(calls, user, args),
        page = await calls.list(user, q);
      await calls.auditResearch(user, 'call_search');
      return {
        ...page,
        rows: page.rows.map((c) => brief(c, q, page.timezone)),
        url: callsJournalLink(q),
      };
    },
  };
  const summary: AiToolDefinition = {
    name: 'summarize_calls',
    description:
      'Company call overview and participation breakdowns for the selected cohort and preceding equal interval. Max366 days; no raw Asterisk ASR.',
    inputSchema: filters,
    entityType: 'call',
    handler: async (args, uid, ctx) => {
      const user = await actor(uid, ctx),
        q = await prepareCallsAiQuery(calls, user, args),
        result = await calls.overview(user, q);
      await calls.auditResearch(user, 'call_aggregate');
      return { ...result, url: callsJournalLink(q) + '&view=overview' };
    },
  };
  return [
    search,
    {
      name: 'get_call',
      description:
        'Read one authorized logical call and human-readable route. Knowing its ID never grants access.',
      inputSchema: { id: { type: 'string', pattern: '^[a-f0-9]{64}$' } },
      entityType: 'call',
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx);
        if (typeof args.id !== 'string')
          throw new BadRequestException('Call id required');
        const detail = await calls.detail(user, args.id);
        return {
          ...detail,
          call: { ...detail.call, ...callsAiTiming(detail.call) },
          startedAtLocal: callsAiLocalTime(detail.call.startedAt, detail.timezone),
          endedAtLocal: callsAiLocalTime(detail.call.endedAt, detail.timezone),
          url: callsJournalLink({}, args.id),
        };
      },
    },
    summary,
    {
      name: 'list_unreturned_missed',
      description:
        'Unconfirmed return contacts for missed incoming calls/voicemail. Max31 days; uses company contact window (default24h), returned as windowHours. Unknown/attempt/connection/return differ. Probable matching, not business resolution.',
      inputSchema: {
        ...filters,
        limit: { type: 'integer', default: 20, minimum: 1, maximum: 50 },
      },
      entityType: 'call',
      handler: async (args, uid, ctx) => {
        const user = await actor(uid, ctx),
          q = await prepareCallsAiQuery(calls, user, args),
          result = await calls.attention(user, { ...q, attentionView: 'open' });
        await calls.auditResearch(user, 'call_attention');
        return {
          ...result,
          rows: result.rows.map((r) => ({
            ...r,
            url: callsJournalLink(q, r.firstCallId),
            attempt: r.attempt
              ? { ...r.attempt, url: callsJournalLink({}, r.attempt.callId) }
              : null,
          })),
          url: callsJournalLink(q) + '&view=attention',
        };
      },
    },
    {
      ...search,
      name: 'find_cdr_calls',
      description:
        'Deprecated alias of search_calls. Unified logical-call results, not raw CDR fields.',
    },
    {
      ...summary,
      name: 'get_cdr_summary',
      description:
        'Deprecated alias of summarize_calls. Truthful logical-call metrics, not raw disposition/ASR.',
    },
  ];
}
