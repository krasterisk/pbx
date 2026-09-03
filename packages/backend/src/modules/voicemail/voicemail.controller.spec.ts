import { NotFoundException } from '@nestjs/common';
import { VoicemailController } from './voicemail.controller';

describe('VoicemailController', () => {
  let service: {
    list: jest.Mock;
    findByUniqueid: jest.Mock;
    streamByUniqueid: jest.Mock;
    retryStt: jest.Mock;
  };
  let controller: VoicemailController;
  const req = { user: { vpbx_user_uid: 100, sub: 7 } };

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue([]),
      findByUniqueid: jest.fn(),
      streamByUniqueid: jest.fn(),
      retryStt: jest.fn(),
    };
    controller = new VoicemailController(service as any);
  });

  it('lists only rows for req.user.vpbx_user_uid', async () => {
    await controller.list(req, {});
    expect(service.list).toHaveBeenCalledWith(100, 7);
  });

  it('ignores a different tenant id in the query string', async () => {
    await controller.list(req, { tenant: '999', user_uid: '999', vpbx_user_uid: '999' });
    expect(service.list).toHaveBeenCalledWith(100, 7);
    expect(service.list).not.toHaveBeenCalledWith(999);
  });

  it('list JSON has no play-by-token URL field', async () => {
    service.list.mockResolvedValue([
      {
        uid: 1,
        uniqueid: '1693731234.12',
        file_rel: '100/voicemail/1693731234.12.wav',
        notify_status: 'pending',
        transcript_status: 'pending',
      },
    ]);
    const result = await controller.list(req, {});
    const row = Array.isArray(result) ? result[0] : (result as { items: unknown[] }).items[0];
    expect(row).not.toHaveProperty('token_url');
    expect(row).not.toHaveProperty('playUrl');
    expect(row).not.toHaveProperty('play_url');
    expect(JSON.stringify(row)).not.toMatch(/token/i);
  });

  it('getByUniqueid uses viewer tenant from req.user.vpbx_user_uid', async () => {
    service.findByUniqueid.mockResolvedValue({ uniqueid: '1693731234.12', transcript_status: 'pending' });
    await controller.getByUniqueid(req, '1693731234.12');
    expect(service.findByUniqueid).toHaveBeenCalledWith(100, '1693731234.12', 7);
  });

  it('getByUniqueid 404s for another tenant uniqueid', async () => {
    service.findByUniqueid.mockRejectedValue(new NotFoundException('Voicemail message not found'));
    await expect(controller.getByUniqueid(req, 'other-tenant.1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detail JSON has no play-by-token URL field', async () => {
    service.findByUniqueid.mockResolvedValue({
      uid: 1,
      uniqueid: '1693731234.12',
      file_rel: '100/voicemail/1693731234.12.wav',
      notify_status: 'sent',
      transcript_status: 'ready',
      transcript: 'hello',
    });
    const row = await controller.getByUniqueid(req, '1693731234.12');
    expect(row).not.toHaveProperty('token');
    expect(row).not.toHaveProperty('token_url');
    expect(row).not.toHaveProperty('playUrl');
    expect(row).not.toHaveProperty('play_url');
    expect(JSON.stringify(row)).not.toMatch(/token/i);
  });

  it('play streams via tenant-scoped uniqueid and passes the request', async () => {
    const res = { setHeader: jest.fn() };
    service.streamByUniqueid.mockResolvedValue(undefined);
    await controller.play(req as any, '1693731234.12', res as any);
    expect(service.streamByUniqueid).toHaveBeenCalledWith(100, '1693731234.12', res, req, 7);
  });

  it('retryStt uses viewer tenant and uniqueid', async () => {
    service.retryStt.mockResolvedValue({ ok: true });
    await controller.retryStt(req, '1693731234.12');
    expect(service.retryStt).toHaveBeenCalledWith(100, '1693731234.12', 7);
  });
});
