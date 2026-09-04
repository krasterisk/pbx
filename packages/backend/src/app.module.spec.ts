import { assertProviderKeySecret, PROVIDER_KEY_SECRET_VAR } from './app.module';

const backendPkg = require('../package.json') as { scripts: Record<string, string> };

describe('AppModule provider key secret (D-16)', () => {
  it('fails at startup outside development when the secret is missing and names the variable', () => {
    expect(() => assertProviderKeySecret({ NODE_ENV: 'production' })).toThrow(
      new RegExp(PROVIDER_KEY_SECRET_VAR),
    );
    expect(() => assertProviderKeySecret({ NODE_ENV: 'test' })).toThrow(
      new RegExp(PROVIDER_KEY_SECRET_VAR),
    );
  });

  it('warns and continues in development when the secret is missing', () => {
    const warn = jest.fn();
    expect(() =>
      assertProviderKeySecret({ NODE_ENV: 'development' }, { warn }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(PROVIDER_KEY_SECRET_VAR));
  });

  it('narrow test:ai pattern covers platform, chat and external-entry modules', () => {
    expect(backendPkg.scripts['test:ai']).toMatch(/ai-platform/);
    expect(backendPkg.scripts['test:ai']).toMatch(/ai-chat/);
    expect(backendPkg.scripts['test:ai']).toMatch(/mcp/);
  });

  it('does nothing when the secret is set', () => {
    const warn = jest.fn();
    expect(() =>
      assertProviderKeySecret(
        { NODE_ENV: 'production', CC_AI_KEY_SECRET: 'set' },
        { warn },
      ),
    ).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
});
