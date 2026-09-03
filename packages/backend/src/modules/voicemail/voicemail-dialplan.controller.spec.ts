import { UnauthorizedException } from '@nestjs/common';
import { VoicemailDialplanController } from './voicemail-dialplan.controller';
import {
  VoicemailService,
  toRelativeFileRel,
  sanitizeUniqueid,
} from './voicemail.service';

describe('VoicemailDialplanController', () => {
  let configService: { get: jest.Mock };
  let service: { ingest: jest.Mock };
  let controller: VoicemailDialplanController;

  const body = {
    uniqueid: '1693731234.12',
    file: '/usr/records/42/voicemail/1693731234.12-1.wav',
    status: 'HANGUP',
    clid: '79001234567',
    exten: '100',
    vpbx_user_uid: 42,
  };

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('secret-key') };
    service = { ingest: jest.fn().mockResolvedValue(undefined) };
    controller = new VoicemailDialplanController(
      service as any,
      configService as any,
    );
  });

  it('returns { accepted: true } and calls ingest on valid x-api-key header', async () => {
    const result = await controller.ingest('secret-key', body);

    expect(result).toEqual({ accepted: true });
    expect(service.ingest).toHaveBeenCalledWith(body);
  });

  it('returns { accepted: true } and calls ingest on valid body.api_key', async () => {
    const result = await controller.ingest('', { ...body, api_key: 'secret-key' });

    expect(result).toEqual({ accepted: true });
    expect(service.ingest).toHaveBeenCalledWith(
      expect.objectContaining({ uniqueid: '1693731234.12', api_key: 'secret-key' }),
    );
  });

  it('throws UnauthorizedException on invalid api key', async () => {
    await expect(controller.ingest('bad-key', body)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.ingest).not.toHaveBeenCalled();
  });

  it('returns before ingest completes (fire-and-forget, not awaited)', async () => {
    let resolved = false;
    service.ingest.mockReturnValue(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          resolved = true;
          resolve();
        }, 50);
      }),
    );

    const result = await controller.ingest('secret-key', body);

    expect(result).toEqual({ accepted: true });
    expect(resolved).toBe(false);
    expect(service.ingest).toHaveBeenCalled();
  });
});

describe('VoicemailService.ingest', () => {
  let messages: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let service: VoicemailService;
  const transcribe = jest.fn();
  const summarize = jest.fn();

  beforeEach(() => {
    transcribe.mockReset();
    summarize.mockReset();
    messages = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ uid: 1 }),
    };
    service = new VoicemailService(messages as any);
  });

  it('upserts a pending row and does not invoke STT or LLM (D-60)', async () => {
    await service.ingest({
      uniqueid: '1693731234.12',
      file: '/usr/records/42/voicemail/1693731234.12-1.wav',
      status: 'HANGUP',
      clid: '79001234567',
      exten: '100',
      vpbx_user_uid: 42,
    });

    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 42,
        uniqueid: '1693731234.12',
        file_rel: '42/voicemail/1693731234.12-1.wav',
        notify_status: 'pending',
        transcript_status: 'pending',
      }),
    );
    expect(transcribe).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
    expect((service as any).transcribe).toBeUndefined();
    expect((service as any).summarize).toBeUndefined();
  });

  it('accepts user_uid from the signed CURL when vpbx_user_uid is absent', async () => {
    await service.ingest({
      uniqueid: '1693731234.12',
      file: '/usr/records/7/voicemail/1693731234.12-1',
      user_uid: '7',
    });

    expect(messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 7,
        file_rel: '7/voicemail/1693731234.12-1.wav',
      }),
    );
  });

  it('stores a relative D-72 path even when the CURL file is absolute', () => {
    expect(toRelativeFileRel(42, '1693731234.12', '/etc/passwd')).toBe(
      '42/voicemail/1693731234.12.wav',
    );
    expect(sanitizeUniqueid('../escape')).toBeNull();
    expect(sanitizeUniqueid('1693731234.12')).toBe('1693731234.12');
  });
});
