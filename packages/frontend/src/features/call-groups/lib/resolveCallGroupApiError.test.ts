import { describe, it, expect } from 'vitest';
import { resolveCallGroupApiError } from './resolveCallGroupApiError';

const t = (key: string, options?: string | Record<string, unknown>) => {
  if (typeof options === 'string') return options;
  const params = options ?? {};
  if (key === 'callGroups.errors.CALL_GROUP_EXTEN_USED_BY_ENDPOINT') {
    return `Номер «${params.exten}» уже занят внутренним абонентом`;
  }
  if (key === 'common.error') return 'Ошибка сохранения';
  return (params.defaultValue as string) || key;
};

describe('resolveCallGroupApiError', () => {
  it('maps structured conflict code to i18n', () => {
    expect(
      resolveCallGroupApiError(
        {
          data: {
            code: 'CALL_GROUP_EXTEN_USED_BY_ENDPOINT',
            message: 'Extension "901" is already used by an internal number',
            params: { exten: '901' },
          },
        },
        t,
      ),
    ).toBe('Номер «901» уже занят внутренним абонентом');
  });

  it('falls back to server message when code is unknown', () => {
    expect(
      resolveCallGroupApiError(
        { data: { code: 'UNKNOWN', message: 'raw server text' } },
        t,
      ),
    ).toBe('raw server text');
  });

  it('falls back to common.error', () => {
    expect(resolveCallGroupApiError({}, t)).toBe('Ошибка сохранения');
  });
});
