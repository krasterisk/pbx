import { VoicemailController } from './voicemail.controller';

describe('VoicemailController', () => {
  let service: { list: jest.Mock };
  let controller: VoicemailController;
  const req = { user: { vpbx_user_uid: 100 } };

  beforeEach(() => {
    service = { list: jest.fn().mockResolvedValue([]) };
    controller = new VoicemailController(service as any);
  });

  it('lists only rows for req.user.vpbx_user_uid', async () => {
    await controller.list(req, {});
    expect(service.list).toHaveBeenCalledWith(100);
  });

  it('ignores a different tenant id in the query string', async () => {
    await controller.list(req, { tenant: '999', user_uid: '999', vpbx_user_uid: '999' });
    expect(service.list).toHaveBeenCalledWith(100);
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
});
