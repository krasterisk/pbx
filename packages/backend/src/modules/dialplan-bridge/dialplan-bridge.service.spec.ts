import { DialplanBridgeService } from './dialplan-bridge.service';

describe('DialplanBridgeService', () => {
  const numbers = { findById: jest.fn() };
  const http = { axiosRef: { post: jest.fn() } };
  const mailer = { sendNotification: jest.fn().mockResolvedValue({ success: true }) };
  const telegram = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const ttsEngines = { findAll: jest.fn(), findOne: jest.fn() };
  const ivrTts = { synthesizeToBuffer: jest.fn() };
  const ttsCache = { writeWav: jest.fn() };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

  let service: DialplanBridgeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DialplanBridgeService(
      numbers as any,
      http as any,
      mailer as any,
      telegram as any,
      ttsEngines as any,
      ivrTts as any,
      ttsCache as any,
    );
    (service as any).logger = logger;
  });

  it('setclid returns a number from the tenant list and ignores foreign lists', async () => {
    numbers.findById.mockResolvedValue({
      id: 5,
      user_uid: 42,
      numbers: ['79001112233'],
    });
    await expect(
      service.setclid({ list_uid: '5', clidnum: '7900', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ callerid: '79001112233' });

    numbers.findById.mockResolvedValue(null);
    await expect(
      service.setclid({ list_uid: '5', clidnum: '7900', vpbx_user_uid: '99' }),
    ).resolves.toEqual({ callerid: '' });
  });

  it('webhook posts only to http(s) URLs from the request and never throws to the caller', async () => {
    http.axiosRef.post.mockResolvedValue({ data: 'ok' });
    await expect(
      service.webhook({
        url: 'https://hooks.example.com/crm',
        clid: '1',
        exten: '100',
        uniqueid: 'u1',
        vpbx_user_uid: '42',
      }),
    ).resolves.toEqual({ body: 'ok' });

    await expect(
      service.webhook({ url: 'file:///etc/passwd', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ body: '', error: 'invalid_url' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('sendmailpeer and telegram accept the request and log failures without throwing', async () => {
    mailer.sendNotification.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      service.sendmailpeer({ exten: '101', text: 'missed', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ accepted: true });
    expect(logger.error).toHaveBeenCalled();

    telegram.sendMessage.mockRejectedValueOnce(new Error('tg down'));
    await expect(
      service.telegram({ chat_id: '1', text: 'hi', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ accepted: true });
  });

  it('tts writes a sanitized basename and logs when the engine fails', async () => {
    ttsEngines.findAll.mockResolvedValue([{ uid: 3, name: 'Yandex', type: 'yandex' }]);
    ivrTts.synthesizeToBuffer.mockResolvedValue(Buffer.from('RIFF'));
    ttsCache.writeWav.mockReturnValue('/tmp/krasterisk-ivr-tts/42/abc.wav');

    await expect(
      service.tts({ text: 'hello', engine: '3', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ status: 'ok', file: 'abc' });

    ivrTts.synthesizeToBuffer.mockRejectedValueOnce(new Error('engine down'));
    await expect(
      service.tts({ text: 'hello', engine: '3', vpbx_user_uid: '42' }),
    ).resolves.toEqual({ status: 'error', file: '' });
    expect(logger.error).toHaveBeenCalled();
  });

  it('tts rejects an unknown engine and sanitizes path traversal from the engine response', async () => {
    ttsEngines.findAll.mockResolvedValue([{ uid: 3, name: 'Yandex', type: 'yandex' }]);
    await expect(
      service.tts({ text: 'hello', engine: '99', vpbx_user_uid: '42' }),
    ).rejects.toThrow('Unknown TTS engine');

    ttsEngines.findAll.mockResolvedValue([{ uid: 3, name: 'Yandex', type: 'yandex' }]);
    ivrTts.synthesizeToBuffer.mockResolvedValue(Buffer.from('RIFF'));
    ttsCache.writeWav.mockReturnValue('/tmp/krasterisk-ivr-tts/42/../../etc/passwd');
    const result = await service.tts({ text: 'hello', engine: '3', vpbx_user_uid: '42' });
    expect(result.file).not.toContain('..');
    expect(result.file).not.toContain('/');
  });
});
