import { HTTP_RESULT_VAR } from '@krasterisk/shared';
import {
  CURL_TIMEOUT_SEC,
  buildCurlCall,
  decodeCurlPostData,
  extractCurlInvocation,
} from './dialplan-curl.util';

describe('buildCurlCall', () => {
  const ctx = {
    baseUrl: 'http://backend.test/api',
    apiKey: 'wave0-key',
    vpbxUserUid: 42,
  };

  it('emits CURL() with an explicit httptimeout', () => {
    const line = buildCurlCall('setclid', { list_uid: '5' }, ctx);
    expect(line).toContain(`CURLOPT(httptimeout)=${CURL_TIMEOUT_SEC}`);
    expect(line).toContain('CURL(');
  });

  it('stores the CURL result in the http_result channel variable', () => {
    const line = buildCurlCall('webhook', { url: 'https://example.com' }, ctx);
    expect(line).toContain(`Set(${HTTP_RESULT_VAR}=`);
    expect(HTTP_RESULT_VAR).toBe('KRSK_HTTP_RESULT');
  });

  it('reads base URL and key from ctx/env, not from payload', () => {
    const line = buildCurlCall(
      'setclid',
      { list_uid: '5', api_key: 'attacker' },
      ctx,
    );
    expect(line).toContain('http://backend.test/api/internal/dialplan/setclid');
    expect(line).toContain('api_key=wave0-key');
    expect(line).not.toContain('api_key=attacker');
  });

  it('URL-encodes payload so quotes and newlines cannot break the dialplan line', () => {
    const line = buildCurlCall('webhook', { note: 'a"b\nc;d' }, ctx);
    const curl = extractCurlInvocation(line);
    expect(curl).toContain('CURL(');
    expect(curl).not.toContain('"');
    expect(curl).not.toContain('\n');
    const payload = decodeCurlPostData(curl);
    expect(payload.note).toBe('a"b\nc;d');
  });
});
