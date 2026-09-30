/**
 * STT and scoring calls against the platform speech-analytics providers.
 * Upload and hangup analysis share this path.
 */

import { readFile } from 'node:fs/promises';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { resolveProjectInsights, type SaProjectConfigV1 } from '@krasterisk/shared';
import type { CcAiProvider } from '../../ai-connectivity/ai-provider.model';
import { resolveChatCompletionsUrl } from '../../ai-connectivity/chat-endpoint.util';
import { applyProviderAuth } from '../../ai-connectivity/provider-auth';
import {
  chatReasoningParams,
  chatSamplingParams,
  chatTokenLimitParams,
} from '../../voicemail/llm-summary.service';
import type { SpeechEngineConfig } from '../../ai-connectivity/speech-engine';
import {
  analysisToMetricRows,
  buildAnalysisPrompt,
  coerceMetricValue,
  configForAnalysis,
  parseAnalysisResponse,
  parseJsonObject,
  scoringMetrics,
  type AnalysisScore,
} from './analysis-prompt';
import type { DiarizedSegment, ScoreResult, SttResult } from './run-analysis';

const STT_TIMEOUT_MS = 120_000;
const SCORE_TIMEOUT_MS = 90_000;
const sttLog = new Logger('SpeechAnalyticsStt');
const scoreLog = new Logger('SpeechAnalyticsScore');

function responseSnippet(data: unknown): string {
  const raw = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  return raw.replace(/\s+/g, ' ').slice(0, 400);
}

function whisperTranscriptionUrl(endpoint: string): string {
  const base = endpoint.replace(/\/$/, '');
  if (/\/audio\/transcriptions$/i.test(base)) return base;
  try {
    const path = new URL(base).pathname.replace(/\/$/, '');
    if (path === '' || path === '/v1') {
      return path === '/v1' ? `${base}/audio/transcriptions` : `${base}/v1/audio/transcriptions`;
    }
  } catch {
    return base;
  }
  return base;
}

function describeSttFailure(error: unknown, method: string, url: string, detail: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'none';
    const body = responseSnippet(error.response?.data);
    const code = error.code ? ` code=${error.code}` : '';
    const detailMessage = error.message ? ` message=${error.message}` : '';
    return new Error(`${method} ${url} ${detail} status=${status}${code}${detailMessage} body=${body}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${method} ${url} ${detail} ${message}`);
}

export async function transcribeProviderAudio(
  engine: SpeechEngineConfig,
  audio: Buffer,
  filename: string,
  modelId: string,
): Promise<SttResult | null> {
  const vendor = String(engine.type || '').toLowerCase();
  if (vendor === 'yandex') return transcribeYandex(engine, audio, modelId);
  return transcribeWhisper(engine, audio, filename, modelId);
}

export async function scoreProviderTranscript(input: {
  provider: CcAiProvider;
  token: string;
  segments: DiarizedSegment[];
  transcript?: string;
  projectConfig?: SaProjectConfigV1 | null;
  modelId: string;
}): Promise<ScoreResult | null> {
  const config = configForAnalysis(input.projectConfig);
  const transcript = input.transcript?.trim()
    || input.segments.map((row) => row.text).filter(Boolean).join('\n');
  if (!transcript) {
    throw new Error('score skipped: transcript is empty');
  }
  const url = resolveChatCompletionsUrl(input.provider.endpoint);
  if (!url) {
    throw new Error(`score skipped: no chat URL for endpoint=${input.provider.endpoint}`);
  }
  const model = (typeof input.provider.defaults?.model === 'string' && input.provider.defaults.model.trim())
    ? input.provider.defaults.model.trim()
    : input.modelId;
  scoreLog.log(
    `Score POST ${url} provider=${input.provider.uid} name=${input.provider.name} model=${model} transcriptChars=${transcript.length} source=${input.provider.endpoint}`,
  );
  const headers = applyProviderAuth(
    { 'Content-Type': 'application/json' },
    input.provider.auth_type,
    input.token,
  );
  let response;
  try {
    response = await axios.post(url, {
      ...(model ? { model } : {}),
      ...chatSamplingParams(model, 0.2),
      ...chatTokenLimitParams(model, 8000),
      ...chatReasoningParams(
        model,
        typeof input.provider.defaults?.reasoning_effort === 'string'
          ? input.provider.defaults.reasoning_effort
          : undefined,
      ),
      ...deepseekStructuredParams(model, input.provider.endpoint),
      messages: [{ role: 'user', content: buildAnalysisPrompt(config, transcript) }],
      response_format: { type: 'json_object' },
    }, { headers, timeout: SCORE_TIMEOUT_MS });
  } catch (error) {
    throw describeSttFailure(error, 'POST', url, `provider=${input.provider.name} model=${model}`);
  }
  const message = response.data?.choices?.[0]?.message;
  const raw = completionText(message);
  scoreLog.log(`Score completion chars=${raw.length} sample=${raw.replace(/\s+/g, ' ').slice(0, 400)}`);
  if (!raw.trim()) {
    const finish = response.data?.choices?.[0]?.finish_reason ?? 'n/a';
    const keys = message && typeof message === 'object' ? Object.keys(message).join(',') : 'none';
    throw new Error(
      `POST ${url} model=${model} status=${response.status} finish=${finish} messageKeys=${keys} empty completion body=${responseSnippet(response.data)}`,
    );
  }
  const parsed = parseAnalysisResponse(raw, config);
  const repairTokens = await fillMissingMetricValues({
    provider: input.provider,
    token: input.token,
    model,
    url,
    headers,
    transcript,
    config,
    parsed,
  });
  const tokens = Number(response.data?.usage?.total_tokens);
  const firstTokens = Number.isFinite(tokens) ? tokens : 0;
  return {
    metrics: analysisToMetricRows(parsed, parsed.assessments, resolveProjectInsights(config)),
    summary: parsed.summary,
    providerTokens: firstTokens + repairTokens,
    modelId: model || input.modelId,
  };
}

async function fillMissingMetricValues(input: {
  provider: CcAiProvider;
  token: string;
  model: string;
  url: string;
  headers: Record<string, string>;
  transcript: string;
  config: SaProjectConfigV1;
  parsed: AnalysisScore;
}): Promise<number> {
  const missing = input.parsed.metrics.filter((row) => row.value == null);
  if (missing.length === 0) return 0;
  const specs = scoringMetrics(input.config)
    .filter((metric) => missing.some((row) => row.id === metric.id))
    .map((metric) => {
      if (metric.type === 'number') {
        const range = metric.min != null || metric.max != null
          ? `${metric.min ?? 0}-${metric.max ?? 100}`
          : '0|25|50|75|100';
        return `${metric.id} number ${range}`;
      }
      if (metric.type === 'boolean') return `${metric.id} boolean`;
      if (metric.type === 'enum' && metric.enumValues?.length) {
        return `${metric.id} enum ${metric.enumValues.join('|')}`;
      }
      return metric.id;
    });
  if (specs.length === 0) return 0;
  scoreLog.warn(`Score omitted ${missing.length} metric values, requesting them again`);
  let response;
  try {
    response = await axios.post(input.url, {
      ...(input.model ? { model: input.model } : {}),
      ...chatSamplingParams(input.model, 0),
      ...chatTokenLimitParams(input.model, 2000),
      ...chatReasoningParams(
        input.model,
        typeof input.provider.defaults?.reasoning_effort === 'string'
          ? input.provider.defaults.reasoning_effort
          : undefined,
      ),
      ...deepseekStructuredParams(input.model, input.url),
      messages: [{
        role: 'user',
        content: [
          'Return JSON only: {"metrics":[{"id":"...","value":...}]}.',
          'Every id below is required. value is required. Do not write rationale.',
          ...specs,
          'TRANSCRIPT:',
          input.transcript.slice(0, 12_000),
        ].join('\n'),
      }],
      response_format: { type: 'json_object' },
    }, { headers: input.headers, timeout: SCORE_TIMEOUT_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scoreLog.warn(`Score value repair failed: ${message}`);
    return 0;
  }
  const raw = completionText(response.data?.choices?.[0]?.message);
  const body = parseJsonObject(raw);
  if (!body) return 0;
  const listed = Array.isArray(body.metrics) ? body.metrics : [];
  const byId = new Map<string, unknown>();
  for (const row of listed) {
    if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') {
      byId.set((row as { id: string }).id, (row as { value?: unknown }).value);
    }
  }
  const types = new Map(scoringMetrics(input.config).map((metric) => [metric.id, metric.type]));
  for (const metric of input.parsed.metrics) {
    if (metric.value != null) continue;
    const next = coerceMetricValue(byId.get(metric.id) ?? body[metric.id], types.get(metric.id) ?? 'number');
    if (next != null) metric.value = next;
  }
  const tokens = Number(response.data?.usage?.total_tokens);
  return Number.isFinite(tokens) ? tokens : 0;
}

const SPEAKER_CHUNK = 10;

export function normalizeSpeakerRole(value: unknown): 'operator' | 'customer' | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'operator' || raw === 'agent' || raw.startsWith('опер') || raw.startsWith('админ')) return 'operator';
  if (raw === 'customer' || raw === 'client' || raw === 'caller' || raw.startsWith('клиен') || raw.startsWith('паци')) {
    return 'customer';
  }
  return null;
}

/** Accept a parallel list or {"i","role"} rows. Null slots stay unlabeled. */
export function readSpeakerRoles(
  body: Record<string, unknown> | null,
  expected: number,
): Array<'operator' | 'customer' | null> | null {
  if (!body || expected <= 0) return null;
  const listed = body.roles ?? body.speakers ?? body.labels;
  if (!Array.isArray(listed) || listed.length === 0) return null;
  const out: Array<'operator' | 'customer' | null> = Array.from({ length: expected }, () => null);
  const indexed = listed.every((item) => item && typeof item === 'object' && 'i' in (item as object));
  if (indexed) {
    for (const item of listed) {
      const row = item as { i?: unknown; role?: unknown; speaker?: unknown };
      const index = Number(row.i);
      const role = normalizeSpeakerRole(row.role ?? row.speaker);
      if (Number.isInteger(index) && index >= 0 && index < expected && role) out[index] = role;
    }
  } else if (listed.length === expected) {
    listed.forEach((item, index) => {
      const role = item && typeof item === 'object'
        ? normalizeSpeakerRole((item as { role?: unknown; speaker?: unknown }).role
          ?? (item as { speaker?: unknown }).speaker)
        : normalizeSpeakerRole(item);
      if (role) out[index] = role;
    });
  } else {
    return null;
  }
  return out.some((role) => role != null) ? out : null;
}

export async function labelProviderSpeakers(input: {
  provider: CcAiProvider;
  token: string;
  modelId: string;
  segments: Array<{ text: string }>;
}): Promise<Array<'operator' | 'customer' | null> | null> {
  if (input.segments.length === 0) return null;
  const url = resolveChatCompletionsUrl(input.provider.endpoint);
  if (!url) return null;
  const model = (typeof input.provider.defaults?.model === 'string' && input.provider.defaults.model.trim())
    ? input.provider.defaults.model.trim()
    : input.modelId;
  const headers = applyProviderAuth(
    { 'Content-Type': 'application/json' },
    input.provider.auth_type,
    input.token,
  );
  const roles: Array<'operator' | 'customer' | null> = [];
  let labeled = 0;
  for (let offset = 0; offset < input.segments.length; offset += SPEAKER_CHUNK) {
    const chunk = input.segments.slice(offset, offset + SPEAKER_CHUNK);
    const part = await labelSpeakerChunk({ url, model, headers, endpoint: input.provider.endpoint, segments: chunk });
    if (!part) {
      roles.push(...chunk.map(() => null));
      continue;
    }
    labeled += part.filter((role) => role != null).length;
    roles.push(...part);
  }
  if (labeled === 0) return null;
  return roles;
}

async function labelSpeakerChunk(input: {
  url: string;
  model: string;
  headers: Record<string, string>;
  endpoint: string;
  segments: Array<{ text: string }>;
}): Promise<Array<'operator' | 'customer' | null> | null> {
  const lines = input.segments
    .map((segment, index) => `${index}. ${segment.text.replace(/\s+/g, ' ').slice(0, 240)}`)
    .join('\n');
  let response;
  try {
    response = await axios.post(input.url, {
      ...(input.model ? { model: input.model } : {}),
      ...chatSamplingParams(input.model, 0),
      ...chatTokenLimitParams(input.model, 1200),
      ...deepseekStructuredParams(input.model, input.endpoint),
      messages: [{
        role: 'user',
        content: [
          'Label each numbered line of a phone call.',
          'operator greets, names the company or a role, and offers a slot. customer asks for a service or answers a question.',
          `Return JSON {"roles":[{"i":0,"role":"operator"|"customer"}, ...]} with one item for every line 0..${input.segments.length - 1}.`,
          lines,
        ].join('\n'),
      }],
      response_format: { type: 'json_object' },
    }, { headers: input.headers, timeout: SCORE_TIMEOUT_MS });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scoreLog.warn(`Speaker labels failed: ${message}`);
    return null;
  }
  const raw = completionText(response.data?.choices?.[0]?.message);
  const roles = readSpeakerRoles(parseJsonObject(raw), input.segments.length);
  if (!roles) {
    scoreLog.warn(
      `Speaker labels unmatched lines=${input.segments.length} sample=${raw.replace(/\s+/g, ' ').slice(0, 240)}`,
    );
  }
  return roles;
}

async function transcribeYandex(
  engine: SpeechEngineConfig,
  audio: Buffer,
  modelId: string,
): Promise<SttResult | null> {
  const base = (engine.custom_url || 'https://stt.api.cloud.yandex.net').replace(/\/$/, '');
  const url = `${base}/speech/v1/stt:recognize`;
  sttLog.log(`STT POST ${url} engine=${engine.name} vendor=${engine.type} model=${modelId || 'general'} bytes=${audio.length}`);
  const headers = applyProviderAuth(
    { 'Content-Type': 'application/octet-stream' },
    engine.auth_mode || 'bearer',
    engine.token,
  );
  if (engine.token && engine.auth_mode !== 'custom') {
    headers.Authorization = `Api-Key ${engine.token}`;
  }
  let response;
  try {
    response = await axios.post(
      url,
      audio,
      { headers, params: { lang: 'ru-RU', topic: 'general' }, timeout: STT_TIMEOUT_MS },
    );
  } catch (error) {
    throw describeSttFailure(error, 'POST', url, `engine=${engine.name} model=${modelId || 'general'}`);
  }
  const text = String(response.data?.result ?? '').trim();
  if (!text) return null;
  return singleSegment(text, modelId);
}

async function transcribeWhisper(
  engine: SpeechEngineConfig,
  audio: Buffer,
  filename: string,
  modelId: string,
): Promise<SttResult | null> {
  const base = (engine.custom_url || '').replace(/\/$/, '');
  if (!base) {
    sttLog.warn(`STT skipped: engine ${engine.name} has no endpoint`);
    return null;
  }
  const url = whisperTranscriptionUrl(base);
  const model = modelId || 'whisper-1';
  sttLog.log(`STT POST ${url} engine=${engine.name} vendor=${engine.type} model=${model} bytes=${audio.length} source=${engine.custom_url}`);
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)]), filename || 'audio.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  const headers = applyProviderAuth({}, engine.auth_mode, engine.token);
  let response;
  try {
    response = await axios.post(url, form, { headers, timeout: STT_TIMEOUT_MS });
  } catch (error) {
    throw describeSttFailure(error, 'POST', url, `engine=${engine.name} model=${model}`);
  }
  const text = String(response.data?.text ?? '').trim();
  if (!text) return null;
  const duration = Number(response.data?.duration);
  const segments = Array.isArray(response.data?.segments)
    ? response.data.segments.map((row: { start?: number; end?: number; text?: string }) => ({
      start: Number(row.start) || 0,
      end: Number(row.end) || 0,
      text: String(row.text ?? ''),
    })).filter((row: { text: string }) => row.text.trim())
    : [];
  return {
    text,
    durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
    segments: segments.length ? segments : [{ start: 0, end: Number.isFinite(duration) ? duration : 0, text }],
    providerTokens: 0,
    modelId: modelId || 'whisper-1',
  };
}

/**
 * deepseek-flash thinks by default and spends max_tokens on reasoning_content,
 * so the JSON score never arrives. Structured calls turn that mode off.
 */
export function deepseekStructuredParams(
  model: string | undefined,
  endpoint: string | undefined,
): Record<string, unknown> {
  const modelName = String(model ?? '').toLowerCase();
  let host = '';
  try {
    host = new URL(endpoint ?? '').hostname.toLowerCase();
  } catch {
    host = '';
  }
  const deepseek = modelName.includes('deepseek')
    || host === 'api.deepseek.com'
    || host.endsWith('.deepseek.com');
  if (!deepseek) return {};
  return {
    thinking: { type: 'disabled' },
    reasoning_effort: 'none',
  };
}

function completionText(message: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown; thinking?: unknown } | null | undefined): string {
  if (typeof message?.content === 'string' && message.content.trim()) return message.content;
  if (Array.isArray(message?.content)) {
    const joined = message.content
      .map((part: { text?: unknown } | string) => (
        typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''
      ))
      .join('');
    if (joined.trim()) return joined;
  }
  for (const key of ['reasoning_content', 'reasoning', 'thinking'] as const) {
    const value = message?.[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (parseJsonObject(value)) return value;
  }
  return '';
}

function singleSegment(text: string, modelId: string): SttResult {
  return {
    text,
    durationSec: 0,
    segments: [{ start: 0, end: 0, text }],
    providerTokens: 0,
    modelId,
  };
}

export async function readAudioFile(audioPath: string): Promise<Buffer> {
  return readFile(audioPath);
}
