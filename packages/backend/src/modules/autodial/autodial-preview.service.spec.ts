import { NotFoundException } from '@nestjs/common';
import { AutodialPreviewService } from './autodial-preview.service';

describe('AutodialPreviewService', () => {
  const fixture = () => {
    const campaigns = { findOne: jest.fn().mockResolvedValue({ uid: 4, revision: 2, base_uid: 8, name: 'UAT', amd: { enabled: false }, queue_names: [],
      scenario_actions: [{ id: 'hello', type: 'text2speech', params: { text: 'Здравствуйте, {AC_NAME}', engine: 3, settings: { voice: 'alena' } } }] }) };
    const bases = { findOne: jest.fn().mockResolvedValue({ uid: 8, fields: [{ uid: 1, key: 'name', label: 'Имя', type: 'string', var_name: 'AC_NAME' }] }),
      findContact: jest.fn().mockResolvedValue({ uid: 12, values: { name: 'Тестовый клиент' }, phones: [] }) };
    const tts = { loadEngine: jest.fn().mockResolvedValue({ type: 'test' }), synthesizeToBuffer: jest.fn().mockResolvedValue(Buffer.from('wav')) };
    return { service: new AutodialPreviewService(campaigns as never, bases as never, tts as never), campaigns, bases, tts };
  };
  it('substitutes customer fields and redacts the internal key from the compiled preview', async () => {
    const old = process.env.DIALPLAN_API_KEY;
    process.env.DIALPLAN_API_KEY = 'test-private-key';
    try {
      const { service } = fixture();
      const result = await service.preview(7, 4, 12);
      expect(result.steps[0]).toMatchObject({ text: 'Здравствуйте Тестовый клиент', missing: [] });
      expect(result.dialplan).toContain('api_key=[redacted]');
      expect(JSON.stringify(result)).not.toContain('test-private-key');
      expect(result.dialplan).toContain('voice=alena');
    } finally { if (old === undefined) delete process.env.DIALPLAN_API_KEY; else process.env.DIALPLAN_API_KEY = old; }
  });
  it('renders audio with the same text and voice settings without calling a destination', async () => {
    const { service, tts } = fixture();
    await service.audio(7, 4, 12, 'hello');
    expect(tts.loadEngine).toHaveBeenCalledWith(3, 7);
    expect(tts.synthesizeToBuffer).toHaveBeenCalledWith({ type: 'test' }, 'Здравствуйте Тестовый клиент', { voice: 'alena' });
  });
  it('does not send another tenant customer to a speech provider', async () => {
    const { service, bases, tts } = fixture();
    bases.findContact.mockRejectedValue(new NotFoundException());
    await expect(service.audio(7, 4, 99, 'hello')).rejects.toBeInstanceOf(NotFoundException);
    expect(tts.loadEngine).not.toHaveBeenCalled();
  });
});
