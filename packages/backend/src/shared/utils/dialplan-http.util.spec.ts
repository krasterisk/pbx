import { HTTP_RESULT_VAR } from '@krasterisk/shared';
import { assertSafeHttpUrl, emitHttpRequest } from './dialplan-http.util';

const SSRF_REJECTED = [
  'http://10.0.0.1/',
  'http://192.168.1.1/',
  'http://172.16.0.1/',
  'http://127.0.0.1/',
  'http://localhost/',
  'http://169.254.169.254/latest/meta-data/',
  'file:///etc/passwd',
  'gopher://x/',
] as const;

describe('emitHttpRequest / assertSafeHttpUrl (D-47)', () => {
  it('accepts https://example.com/x', () => {
    expect(() => assertSafeHttpUrl('https://example.com/x')).not.toThrow();
    const dp = emitHttpRequest({ url: 'https://example.com/x', method: 'GET' });
    expect(dp).toContain('https://example.com/x');
    expect(dp).toContain(`Set(${HTTP_RESULT_VAR}=`);
  });

  it.each([...SSRF_REJECTED])('rejects SSRF address %s in assertSafeHttpUrl and emitHttpRequest', (url) => {
    expect(() => assertSafeHttpUrl(url)).toThrow();
    expect(() => emitHttpRequest({ url, method: 'GET', timeout: 5 })).toThrow();
  });

  it('emits a timeout even when params.timeout is omitted', () => {
    const dp = emitHttpRequest({ url: 'https://example.com/x', method: 'GET' });
    expect(dp).toMatch(/CURLOPT\(httptimeout\)=\d+/);
  });

  it('stores the result in the http_result channel variable name', () => {
    const dp = emitHttpRequest({ url: 'https://example.com/x' });
    expect(HTTP_RESULT_VAR).toBe('KRSK_HTTP_RESULT');
    expect(dp).toContain(`Set(${HTTP_RESULT_VAR}=`);
  });
});
