import { autodialWebhookUrl, isAutodialPublicIpv4, sendAutodialWebhook } from './autodial-webhook-http';
import * as dns from 'node:dns/promises';
import * as https from 'node:https';
import { EventEmitter } from 'node:events';
jest.mock('node:dns/promises', () => ({ __esModule: true, lookup: jest.fn() }));
jest.mock('node:https', () => ({ __esModule: true, request: jest.fn() }));
describe('Autodial webhook destinations', () => {
  it.each(['http://example.com', 'https://localhost', 'https://user:secret@example.com', 'https://example.com:8443',
    'https://127.0.0.1', 'https://2130706433', 'https://10.0.0.1', 'https://100.127.1.2', 'https://169.254.169.254',
    'https://192.0.2.1', 'https://198.19.0.1', 'https://224.0.0.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://example.com/#fragment'])('rejects %s', (url) => {
      expect(() => autodialWebhookUrl(url)).toThrow('AC_WEBHOOK_URL');
    });
  it('accepts public HTTPS and only routable IPv4 answers for pinned delivery', () => {
    expect(autodialWebhookUrl('https://crm.example.com/events').hostname).toBe('crm.example.com');
    expect(isAutodialPublicIpv4('8.8.8.8')).toBe(true);
    expect(isAutodialPublicIpv4('172.15.0.1')).toBe(true);
    expect(isAutodialPublicIpv4('172.16.0.1')).toBe(false);
    expect(isAutodialPublicIpv4('::ffff:8.8.8.8')).toBe(false);
  });
});

describe('Autodial HTTPS transport', () => {
  afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); jest.useRealTimers(); });
  it('pins the validated address and sends exact UTF-8 body; redirects remain responses', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
    const request = jest.spyOn(https, 'request').mockImplementation(((_url: unknown, options: any, callback: any) => {
      expect(options.agent).toBe(false); expect(options.family).toBe(4);
      expect(options.headers['Content-Length']).toBe(String(Buffer.byteLength('Тест')));
      const pin = jest.fn(); options.lookup('crm.example.com', {}, pin); expect(pin).toHaveBeenCalledWith(null, '8.8.8.8', 4);
      const req = new EventEmitter() as any;
      req.end = (body: string) => { expect(body).toBe('Тест'); queueMicrotask(() => callback({ statusCode: 302, destroy: jest.fn() })); };
      return req;
    }) as never);
    await expect(sendAutodialWebhook('https://crm.example.com/events', 'Тест', {})).resolves.toBe(302);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects a mixed DNS answer before opening a connection', async () => {
    jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }] as never);
    const request = jest.spyOn(https, 'request');
    await expect(sendAutodialWebhook('https://crm.example.com', '{}', {})).rejects.toThrow('AC_WEBHOOK_ADDRESS');
    expect(request).not.toHaveBeenCalled();
  });
  it('bounds DNS lookup time independently of the HTTP timeout', async () => {
    jest.useFakeTimers(); jest.spyOn(dns, 'lookup').mockReturnValue(new Promise(() => {}) as never);
    const result = expect(sendAutodialWebhook('https://crm.example.com', '{}', {})).rejects.toThrow('AC_WEBHOOK_DNS_TIMEOUT');
    await jest.advanceTimersByTimeAsync(5000); await result;
  });
  it('enforces an absolute HTTP deadline even if the socket never reaches its inactivity timeout', async () => {
    jest.useFakeTimers(); jest.spyOn(dns, 'lookup').mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
    jest.spyOn(https, 'request').mockImplementation((() => {
      const req = new EventEmitter() as any; req.end = jest.fn(); req.destroy = (error: Error) => req.emit('error', error); return req;
    }) as never);
    const result = expect(sendAutodialWebhook('https://crm.example.com', '{}', {})).rejects.toThrow('AC_WEBHOOK_TIMEOUT');
    await jest.advanceTimersByTimeAsync(5000); await result;
  });
});
