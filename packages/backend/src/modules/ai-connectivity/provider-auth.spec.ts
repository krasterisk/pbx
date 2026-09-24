import { applyProviderAuth, encodeCustomAuth, sealCustomAuth } from './provider-auth';

describe('applyProviderAuth', () => {
  it('sets Authorization for bearer and leaves the secret out of other headers', () => {
    const headers = applyProviderAuth({ 'Content-Type': 'application/json' }, 'bearer', 'sk-1');
    expect(headers.Authorization).toBe('Bearer sk-1');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('keeps the legacy X-API-Key mode', () => {
    const headers = applyProviderAuth({}, 'api_key_header', 'sk-1');
    expect(headers['X-API-Key']).toBe('sk-1');
    expect(headers.Authorization).toBeUndefined();
  });

  it('applies each custom header from the stored map', () => {
    const secret = encodeCustomAuth({ 'X-Api-Key': 'sk-1', Authorization: 'Api-Key ya' });
    const headers = applyProviderAuth({ Accept: 'audio/*' }, 'custom', secret);
    expect(headers['X-Api-Key']).toBe('sk-1');
    expect(headers.Authorization).toBe('Api-Key ya');
    expect(headers.Accept).toBe('audio/*');
  });

  it('sends no secret for none', () => {
    expect(applyProviderAuth({ Accept: 'audio/*' }, 'none', 'sk-1')).toEqual({ Accept: 'audio/*' });
  });
});

describe('sealCustomAuth', () => {
  it('keeps a stored value when the form sends a blank field', () => {
    const previous = encodeCustomAuth({ 'X-Api-Key': 'stored' });
    const sealed = sealCustomAuth('custom', previous, [{ key: 'X-Api-Key', value: '  ' }]);
    expect(sealed.keys).toEqual(['X-Api-Key']);
    expect(sealed.plain).toBe(previous);
  });

  it('drops a header that left the list', () => {
    const previous = encodeCustomAuth({ 'X-Api-Key': 'stored', 'X-Env': 'prod' });
    const sealed = sealCustomAuth('custom', previous, [{ key: 'X-Env', value: '' }]);
    expect(sealed.keys).toEqual(['X-Env']);
  });
});
