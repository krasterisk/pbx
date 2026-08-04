import pino from 'pino';
import { getActiveTraceId, scenarioContext } from './tracing.js';

const SENSITIVE_KEY = /token|password|secret|authorization/i;
const SENSITIVE_VALUE = /PW_PASS|accessToken/i;

export const REDACTED = '[REDACTED]';

function redactValue(value: unknown): unknown {
  if (typeof value === 'string' && SENSITIVE_VALUE.test(value)) {
    return REDACTED;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value && typeof value === 'object') {
    return redactObject(value as Record<string, unknown>);
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactValue(value);
    }
  }
  return out;
}

export const logger = pino({
  level: process.env.HARNESS_LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'msg',
  mixin() {
    const traceId = getActiveTraceId();
    const scenario = scenarioContext.getStore();
    return {
      ...(traceId ? { trace_id: traceId } : {}),
      ...(scenario ? { scenario_id: scenario.scenarioId } : {}),
    };
  },
  formatters: {
    level(label) {
      return { level: label };
    },
    log(object) {
      return redactObject(object as Record<string, unknown>);
    },
  },
});

export type HarnessLogger = typeof logger;
