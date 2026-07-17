import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DecryptedNotificationIntegration,
  INotificationProvider,
  NotificationSendResult,
  trimNotificationMessage,
} from './notification-provider.interface';

const AXIOS_TIMEOUT_MS = 10_000;

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function applyTemplate(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      vars[key] !== undefined ? vars[key] : '',
    );
  }
  if (Array.isArray(value)) {
    return value.map((v) => applyTemplate(v, vars));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyTemplate(v, vars);
    }
    return out;
  }
  return value;
}

/** Accept object (preferred) or JSON string from legacy / textarea saves. */
export function resolvePayloadTemplate(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

@Injectable()
export class WebhookProvider implements INotificationProvider {
  private readonly logger = new Logger(WebhookProvider.name);

  async send(
    integration: DecryptedNotificationIntegration,
    target: string | undefined,
    message: string,
    extraVars?: Record<string, string>,
  ): Promise<NotificationSendResult> {
    const url =
      integration.config?.url ??
      integration.credentials?.url ??
      '';

    if (!url || !isHttpUrl(String(url))) {
      this.logger.warn('Webhook send skipped: invalid or non-http(s) URL');
      return { success: false, error: 'invalid_url' };
    }

    const text = trimNotificationMessage(message);
    const vars: Record<string, string> = {
      message: text,
      target: target ?? '',
      clid: '',
      exten: '',
      uniqueid: '',
      ...extraVars,
    };

    const template = resolvePayloadTemplate(integration.config?.payload_template);
    const payload = template
      ? applyTemplate(template, vars)
      : {
          message: text,
          clid: vars.clid || null,
          exten: vars.exten || null,
          uniqueid: vars.uniqueid || null,
          ...(target ? { target } : {}),
        };

    const headers =
      (integration.config?.headers as Record<string, string> | undefined) ??
      (integration.credentials?.headers as Record<string, string> | undefined) ??
      {};

    try {
      await axios.post(String(url), payload, {
        headers,
        timeout: AXIOS_TIMEOUT_MS,
      });
      return { success: true };
    } catch (e: any) {
      this.logger.error(`Webhook send failed: ${e?.message ?? e}`);
      return { success: false, error: e?.message };
    }
  }
}
