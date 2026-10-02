import { buildEndpointContext, stripEndpointContext } from './endpoint-context-name';

describe('endpoint context names', () => {
  const tenantId = 362;

  it('keeps a catalog name that already contains the tenant id', () => {
    expect(buildEndpointContext('ctx-362', tenantId)).toBe('ctx-362');
    expect(buildEndpointContext('ctx-362-ext', tenantId)).toBe('ctx-362-ext');
    expect(stripEndpointContext('ctx-362', tenantId)).toBe('ctx-362');
    expect(stripEndpointContext('ctx-362-ext', tenantId)).toBe('ctx-362-ext');
  });

  it('does not chop a longer name that merely ends with the tenant digits', () => {
    expect(stripEndpointContext('ctx-362', 62)).toBe('ctx-362');
    expect(stripEndpointContext('ctx-362', 2)).toBe('ctx-362');
  });

  it('still glues and strips the legacy suffix without a hyphen', () => {
    expect(buildEndpointContext('from-internal', tenantId)).toBe('from-internal362');
    expect(buildEndpointContext('sip-out', 0)).toBe('sip-out0');
    expect(stripEndpointContext('from-internal362', tenantId)).toBe('from-internal');
    expect(stripEndpointContext('sip-out0', 0)).toBe('sip-out');
    expect(buildEndpointContext('from-internal362', tenantId)).toBe('from-internal362');
  });

  it('uses the legacy default when context is empty', () => {
    expect(buildEndpointContext('', tenantId)).toBe('from-internal362');
    expect(buildEndpointContext(null, tenantId)).toBe('from-internal362');
  });
});
