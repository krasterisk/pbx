import { describe, it, expect } from 'vitest';
import { DIALPLAN_ACTION_META } from '@krasterisk/shared';
import { dialplanAppsRegistry } from '../../model/registry';
import { allowedTypesForHost } from '../../model/hostTypes';
import { buildCallbackSchema, summarizeCallback, validateCallbackParams } from './CallbackApp';

const t = (key: string, fallback?: string) => fallback ?? key;

describe('CallbackApp schema (D-41 Surface K)', () => {
  it('registers window/attempts fields and conditional terminal on route only', () => {
    const config = dialplanAppsRegistry.callback;
    const keys = config.schema.map((field) => field.key);
    expect(keys).toEqual(expect.arrayContaining([
      'window_start',
      'window_end',
      'max_attempts',
      'pause_minutes',
    ]));
    expect(config.schema.find((field) => field.key === 'window_start')?.kind).toBe('custom');
    expect(config.terminal).toBe('conditional');
    expect(DIALPLAN_ACTION_META.callback.terminal).toBe('conditional');
    expect(config.allowedIn).toEqual(['route']);
    expect(allowedTypesForHost('route')).toContain('callback');
    expect(allowedTypesForHost('ivr')).not.toContain('callback');
    expect(allowedTypesForHost('directory_policy')).not.toContain('callback');
  });

  it('summarize is a sentence from window and attempts', () => {
    const summary = summarizeCallback(
      { window_start: '10:00', window_end: '18:00', max_attempts: 5 },
      t,
    );
    expect(summary).toBe('Callback, up to 5 attempts, from 10:00 to 18:00');
    expect(dialplanAppsRegistry.callback.summarize(
      dialplanAppsRegistry.callback.defaultParams ?? {},
      t,
    )).toContain('09:00');
  });

  it('validate rejects bad time and non-positive attempts', () => {
    expect(validateCallbackParams({
      window_start: '09:00',
      window_end: '21:00',
      max_attempts: 3,
      pause_minutes: 30,
    })).toEqual({});
    expect(validateCallbackParams({
      window_start: '9',
      window_end: '25:00',
      max_attempts: 0,
      pause_minutes: -1,
    })).toEqual({
      window_start: 'time',
      window_end: 'time',
      max_attempts: 'min',
      pause_minutes: 'min',
    });
  });

  it('buildCallbackSchema exposes time-row window fields', () => {
    const schema = buildCallbackSchema(t);
    const start = schema.find((field) => field.key === 'window_start');
    const end = schema.find((field) => field.key === 'window_end');
    expect(start?.row).toBe('window');
    expect(end?.row).toBe('window');
    expect(start?.hintKey).toBe('routes.apps.callback.windowHint');
  });
});
