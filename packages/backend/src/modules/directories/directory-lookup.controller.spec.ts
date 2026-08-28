import { Logger, UnauthorizedException } from '@nestjs/common';
import { DirectoryLookupController } from './directory-lookup.controller';

describe('DirectoryLookupController', () => {
  const service = {
    lookup: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let controller: DirectoryLookupController;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  function attachLoggerSpies() {
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    warnSpy?.mockRestore();
    logSpy = jest.spyOn((controller as any).logger as Logger, 'log').mockImplementation();
    errorSpy = jest.spyOn((controller as any).logger as Logger, 'error').mockImplementation();
    warnSpy = jest.spyOn((controller as any).logger as Logger, 'warn').mockImplementation();
  }

  function createController(secret: string | undefined = 'secret') {
    configService.get.mockReturnValue(secret);
    controller = new DirectoryLookupController(service as any, configService as any);
    attachLoggerSpies();
    return controller;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service.lookup.mockResolvedValue({
      status: 'FOUND',
      matchKind: 'exact',
      values: ['700', 'Alice'],
    });
    createController('secret');
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('encodes FOUND field values as KDL1 base64 segments', async () => {
    expect(await controller.lookup('7', '100', '100', '17,18', 'secret'))
      .toBe(`KDL1|FOUND|${Buffer.from('700').toString('base64')}|${Buffer.from('Alice').toString('base64')}`);
    expect(service.lookup).toHaveBeenCalledWith({
      directoryUid: 7,
      userUid: 100,
      key: '100',
      fieldUids: [17, 18],
    });
  });

  it('throws UnauthorizedException when the server DIALPLAN_API_KEY is missing', async () => {
    controller = createController('');
    await expect(controller.lookup('7', '100', '100', '17,18', 'secret'))
      .rejects.toThrow(UnauthorizedException);
    expect(service.lookup).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the request key is missing', async () => {
    await expect(controller.lookup('7', '100', '100', '17,18', undefined as any))
      .rejects.toThrow(UnauthorizedException);
    await expect(controller.lookup('7', '100', '100', '17,18', ''))
      .rejects.toThrow(UnauthorizedException);
    expect(service.lookup).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the request key is wrong', async () => {
    await expect(controller.lookup('7', '100', '100', '17,18', 'wrong'))
      .rejects.toThrow(UnauthorizedException);
    expect(service.lookup).not.toHaveBeenCalled();
  });

  it('returns KDL1|NOT_FOUND for a foreign tenant without leaking existence', async () => {
    service.lookup.mockResolvedValue({ status: 'NOT_FOUND', values: [] });
    await expect(controller.lookup('7', '999', '100', '17,18', 'secret'))
      .resolves.toBe('KDL1|NOT_FOUND');
  });

  it('returns KDL1|ERROR for malformed IDs', async () => {
    await expect(controller.lookup('x', '100', '100', '17,18', 'secret'))
      .resolves.toBe('KDL1|ERROR');
    await expect(controller.lookup('7', '0', '100', '17,18', 'secret'))
      .resolves.toBe('KDL1|ERROR');
    await expect(controller.lookup('7', '100', '100', '17,abc', 'secret'))
      .resolves.toBe('KDL1|ERROR');
    await expect(controller.lookup('7', '100', '100', '-1', 'secret'))
      .resolves.toBe('KDL1|ERROR');
    expect(service.lookup).not.toHaveBeenCalled();
  });

  it('logs a service exception and returns KDL1|ERROR', async () => {
    service.lookup.mockRejectedValue(new Error('db down'));
    await expect(controller.lookup('7', '100', 'sensitive-lookup-key', '17,18', 'secret'))
      .resolves.toBe('KDL1|ERROR');
    expect(errorSpy).toHaveBeenCalled();
    const message = String(errorSpy.mock.calls[0][0]);
    expect(message).toBe('Directory lookup failed');
    expect(message).not.toContain('sensitive-lookup-key');
    expect(message).not.toContain('700');
    expect(message).not.toContain('Alice');
  });

  it('emits structured lookup telemetry without key or value data', async () => {
    const key = 'sensitive-lookup-key';
    const secretValue = 'secret-field-value';
    service.lookup.mockResolvedValue({
      status: 'FOUND',
      matchKind: 'exact',
      values: [secretValue],
    });

    await controller.lookup('7', '100', key, '17', 'secret');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload).toEqual({
      duration_ms: expect.any(Number),
      outcome: 'found',
      user_uid: 100,
      directory_uid: 7,
      match_kind: 'exact',
    });
    expect(payload.duration_ms).toBeGreaterThanOrEqual(0);

    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).not.toContain(key);
    expect(logged).not.toContain(secretValue);
  });

  it('preserves pipes, Unicode, commas, line breaks, and empty values in the encoded response', async () => {
    const values = ['a|b', 'Привет, мир', 'a,b', 'line1\nline2', ''];
    service.lookup.mockResolvedValue({
      status: 'FOUND',
      matchKind: 'asterisk_pattern',
      values,
    });

    const encoded = await controller.lookup('7', '100', '100', '17,18,19,20,21', 'secret');
    const parts = encoded.split('|');
    expect(parts[0]).toBe('KDL1');
    expect(parts[1]).toBe('FOUND');
    expect(parts.slice(2).map((part) => Buffer.from(part, 'base64').toString('utf8'))).toEqual(values);
  });

  it('deduplicates field_uids while preserving first-occurrence order', async () => {
    await controller.lookup('7', '100', '100', '18,17,18,19', 'secret');
    expect(service.lookup).toHaveBeenCalledWith({
      directoryUid: 7,
      userUid: 100,
      key: '100',
      fieldUids: [18, 17, 19],
    });
  });
});
