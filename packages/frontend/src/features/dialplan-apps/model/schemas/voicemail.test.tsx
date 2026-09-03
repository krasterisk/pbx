import { describe, it, expect } from 'vitest';
import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { dialplanAppsRegistry } from '../registry';
import { buildVoicemailSchema, summarizeVoicemail } from './voicemail';

const t = (key: string, fallback?: string) => fallback ?? key;

const RECORD_FLAGS = ['q', 'o', 'x', 'y', 'n', 's', 'u'] as const;

describe('voicemail schema D-56 / D-74', () => {
  it('defaultParams.max_duration is 120 (D-74)', () => {
    expect(dialplanAppsRegistry.voicemail.defaultParams?.max_duration).toBe(120);
  });

  it('schema exposes greeting, duration, Record flags, notify, STT/LLM — and no k', () => {
    const schema = buildVoicemailSchema(t);
    const keys = schema.map((field) => field.key);

    expect(keys).toEqual(expect.arrayContaining([
      'greeting',
      'max_duration',
      'silence_timeout',
      'notify.integration_uid',
      'notify.body',
      'notify.target',
      'notify.subject',
      'stt_engine_uid',
      'llm_provider_uid',
    ]));

    for (const flag of RECORD_FLAGS) {
      expect(keys.some((key) => key === flag || key === `record_options.${flag}`)).toBe(true);
    }

    expect(keys).not.toContain('k');
    expect(keys.some((key) => key === 'k' || key.endsWith('.k'))).toBe(false);

    const notifyUid = schema.find((field) => field.key === 'notify.integration_uid');
    expect(notifyUid?.optionsSource).toBe('notifications');

    const greeting = schema.find((field) => field.key === 'greeting');
    expect(greeting?.optionsSource).toBe('prompts');
  });

  it('registry is schema-driven and summarize returns a non-empty t(key, fallback) string', () => {
    const config = dialplanAppsRegistry.voicemail;
    expect(config.schema?.length).toBeGreaterThan(0);
    expect(config.schema.some((field) => field.key === 'greeting')).toBe(true);

    const summary = config.summarize(config.defaultParams ?? {}, t);
    expect(summary.trim().length).toBeGreaterThan(0);

    const viaBuilder = summarizeVoicemail({ max_duration: 120, greeting: 'vm-hello' }, t);
    expect(viaBuilder.trim().length).toBeGreaterThan(0);
  });

  it('keeps terminal meta conditional', () => {
    expect(DIALPLAN_ACTION_META.voicemail.terminal).toBe('conditional');
    expect(dialplanAppsRegistry.voicemail.terminal).toBe('conditional');
  });
});
