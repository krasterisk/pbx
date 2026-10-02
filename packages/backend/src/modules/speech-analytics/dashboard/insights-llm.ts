/**
 * Insights use the same chat provider as call scoring.
 * Temperature 0, JSON, one retry when the schema or the numbers fail.
 */

import axios from 'axios';
import type { CcAiProvider } from '../../ai-connectivity/ai-provider.model';
import { resolveChatCompletionsUrl } from '../../ai-connectivity/chat-endpoint.util';
import { applyProviderAuth } from '../../ai-connectivity/provider-auth';
import {
  chatReasoningParams,
  chatSamplingParams,
  chatTokenLimitParams,
} from '../../voicemail/llm-summary.service';
import { deepseekStructuredParams } from '../pipeline/provider-analysis';
import type { SaInsight } from './insights.service';
import { parseInsightsPayload, sanitizeInsights } from './insights-validate';

const INSIGHTS_TIMEOUT_MS = 90_000;

export type InsightsChatPost = (body: Record<string, unknown>) => Promise<{ text: string; tokens: number }>;

export function buildInsightsUserMessage(input: {
  projectName: string;
  systemPrompt: string | null;
  insightsFocus: string;
  facts: unknown;
  repairNote?: string | null;
}): string {
  const focus = input.insightsFocus.trim();
  return [
    'Собери 3-6 инсайтов только по JSON фактов ниже.',
    'Не выдумывай числа, операторов, темы и причины. Каждое число в title, observation, recommendation и evidence.value должно уже быть в фактах.',
    'Дельта это текущий период минус предыдущий такой же отрезок. Первая и последняя точка внутри текущего окна трендом не являются.',
    'Если period.comparable равен false, не пиши тренд и не сравнивай периоды. Используй period.comparisonNote.',
    'Один ответ на три роли, без отдельных кнопок. Тип карточки задаёт полку:',
    '- супервизор: оператор и метрика (strength, gap, outlier);',
    '- маркетолог: тема и возражение (trend, когда речь о теме);',
    '- контроль качества: скрипт и приветствие (quality).',
    'В recommendation прямо скажи, для кого действие.',
    'priority это срочность, не оценка хорошо или плохо. Текст title, observation и recommendation пиши на языке расшифровок из фактов. Если язык неясен, пиши на русском.',
    'Цитаты бери только из facts.quotes. Сырой транскрипт не придумывай.',
    input.systemPrompt?.trim() ? `Контекст проекта «${input.projectName}»:\n${input.systemPrompt.trim()}` : `Проект: ${input.projectName}`,
    focus ? `На что смотреть в этом проекте:\n${focus}` : 'Деловой акцент проекта не задан. Работай по общим правилам и фактам.',
    input.repairNote?.trim() ? `Предыдущий ответ отклонён: ${input.repairNote.trim()}` : '',
    'ФАКТЫ:',
    JSON.stringify(input.facts),
  ].filter(Boolean).join('\n\n');
}

export function insightsChatBody(input: {
  model: string;
  endpoint: string;
  skillText: string;
  userText: string;
}): Record<string, unknown> {
  return {
    ...(input.model ? { model: input.model } : {}),
    ...chatSamplingParams(input.model, 0),
    ...chatTokenLimitParams(input.model, 4000),
    ...chatReasoningParams(input.model, 'low'),
    ...deepseekStructuredParams(input.model, input.endpoint),
    messages: [
      { role: 'system', content: input.skillText },
      { role: 'user', content: input.userText },
    ],
    response_format: { type: 'json_object' },
  };
}

export async function completeInsightsChat(input: {
  post: InsightsChatPost;
  model: string;
  endpoint: string;
  skillText: string;
  projectName: string;
  systemPrompt: string | null;
  insightsFocus: string;
  facts: unknown;
}): Promise<{ insights: SaInsight[]; providerTokens: number }> {
  let repairNote: string | null = null;
  let tokens = 0;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = insightsChatBody({
      model: input.model,
      endpoint: input.endpoint,
      skillText: input.skillText,
      userText: buildInsightsUserMessage({
        projectName: input.projectName,
        systemPrompt: input.systemPrompt,
        insightsFocus: input.insightsFocus,
        facts: input.facts,
        repairNote,
      }),
    });
    const response = await input.post(body);
    tokens += response.tokens;
    const parsed = parseInsightsPayload(response.text);
    if (!parsed.ok) {
      repairNote = parsed.error;
      continue;
    }
    const clean = sanitizeInsights(parsed.insights, input.facts);
    if (clean.length > 0) return { insights: clean, providerTokens: tokens };
    repairNote = 'Every cited number must already appear in the facts JSON. Do not invent values.';
  }
  return { insights: [], providerTokens: tokens };
}

function completionText(message: { content?: unknown } | null | undefined): string {
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) {
    return message.content.map((part: { text?: unknown } | string) => (
      typeof part === 'string' ? part : (typeof part?.text === 'string' ? part.text : '')
    )).join('');
  }
  return '';
}

export function insightsProviderModel(
  explicit: string | null | undefined,
  providerModel: string | null | undefined,
): string {
  const chosen = explicit?.trim() ?? '';
  if (chosen && chosen !== 'default-call-analysis') return chosen;
  return providerModel?.trim() ?? '';
}

export async function postInsightsChat(input: {
  provider: CcAiProvider;
  token: string;
  model: string;
  body: Record<string, unknown>;
}): Promise<{ text: string; tokens: number }> {
  const url = resolveChatCompletionsUrl(input.provider.endpoint);
  if (!url) throw new Error('insights chat URL is missing');
  const headers = applyProviderAuth(
    { 'Content-Type': 'application/json' },
    input.provider.auth_type,
    input.token,
  );
  let response;
  try {
    response = await axios.post(url, input.body, { headers, timeout: INSIGHTS_TIMEOUT_MS });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'none';
      const raw = typeof error.response?.data === 'string'
        ? error.response.data
        : JSON.stringify(error.response?.data ?? '');
      const body = raw.replace(/\s+/g, ' ').slice(0, 400);
      throw new Error(`insights chat status=${status} model=${String(input.body.model ?? input.model)} body=${body}`, { cause: error });
    }
    throw error;
  }
  const tokens = Number(response.data?.usage?.total_tokens);
  return {
    text: completionText(response.data?.choices?.[0]?.message),
    tokens: Number.isFinite(tokens) ? tokens : 0,
  };
}
