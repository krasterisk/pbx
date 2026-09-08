import { assertNoSecretArgs, redactSecrets } from './ai-secret-redaction';

describe('ai-secret-redaction', () => {
  it('redacts nested password and api_key fields', () => {
    expect(
      redactSecrets({
        name: 'trunk',
        password: 's3cret',
        nested: { api_key: 'k', host: 'sip.example' },
      }),
    ).toEqual({
      name: 'trunk',
      password: '[REDACTED]',
      nested: { api_key: '[REDACTED]', host: 'sip.example' },
    });
  });

  it('refuses secret-bearing tool args', () => {
    expect(() => assertNoSecretArgs({ password: 'x' })).toThrow(/SECRET_ARG_FORBIDDEN/);
    expect(() => assertNoSecretArgs({ name: 'ok' })).not.toThrow();
  });
});
