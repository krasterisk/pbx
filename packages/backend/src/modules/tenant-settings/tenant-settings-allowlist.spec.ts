import { assertWritableKey } from './tenant-settings-ai.adapter';

describe('tenant-settings allowlist writes', () => {
  it('allows value flags from the allow list', () => {
    expect(() => assertWritableKey('routes.show_flowchart')).not.toThrow();
  });

  it('forbids identity and presence/secret keys', () => {
    expect(() => assertWritableKey('tenant.name')).toThrow(/FORBIDDEN/);
    expect(() => assertWritableKey('integrations.provider_token')).toThrow(/NOT_ALLOWLISTED/);
    expect(() => assertWritableKey('billing.plan')).toThrow(/FORBIDDEN/);
  });
});
