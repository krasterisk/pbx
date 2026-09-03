import axios from 'axios';
import { TelegramProvider } from './telegram.provider';
import { EmailProvider } from './email.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { WebhookProvider } from './webhook.provider';
import { MaxProvider } from './max.provider';
import { VkProvider } from './vk.provider';
import {
  ATTACHMENT_REJECTED,
  DecryptedNotificationIntegration,
  NOTIFICATION_MESSAGE_MAX_LEN,
} from './notification-provider.interface';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function integ(
  channel: DecryptedNotificationIntegration['channel'],
  overrides: Partial<DecryptedNotificationIntegration> = {},
): DecryptedNotificationIntegration {
  return {
    uid: 1,
    name: 'test',
    channel,
    config: {},
    credentials: {},
    ...overrides,
  };
}

describe('notification providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ data: { ok: true }, status: 200 });
  });

  describe('TelegramProvider', () => {
    const provider = new TelegramProvider();

    it('POSTs sendMessage to api.telegram.org/bot{token}/sendMessage', async () => {
      const result = await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'BOT123' },
          config: { chat_id: '999' },
        }),
        undefined,
        'hello',
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/botBOT123/sendMessage',
        { chat_id: '999', text: 'hello' },
        expect.objectContaining({ timeout: expect.any(Number) }),
      );
    });

    it('uses target override for chat_id', async () => {
      await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'T' },
          config: { chat_id: 'default' },
        }),
        'override-chat',
        'msg',
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('api.telegram.org/bot'),
        { chat_id: 'override-chat', text: 'msg' },
        expect.any(Object),
      );
    });

    it('trims message to 4096 and never throws on axios failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('network'));
      const long = 'x'.repeat(NOTIFICATION_MESSAGE_MAX_LEN + 50);
      const result = await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'T' },
          config: { chat_id: '1' },
        }),
        undefined,
        long,
      );
      expect(result.success).toBe(false);
      const body = mockedAxios.post.mock.calls[0][1] as { text: string };
      expect(body.text).toHaveLength(NOTIFICATION_MESSAGE_MAX_LEN);
    });

    it('POSTs multipart sendDocument when attach is present (not sendVoice/sendAudio)', async () => {
      const content = Buffer.from('RIFF');
      const result = await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'BOT123' },
          config: { chat_id: '999' },
        }),
        undefined,
        'voicemail',
        {
          attach: {
            filename: 'vm.wav',
            content,
            contentType: 'audio/wav',
          },
        },
      );

      expect(result.success).toBe(true);
      const [url, body] = mockedAxios.post.mock.calls[0];
      expect(url).toBe('https://api.telegram.org/botBOT123/sendDocument');
      expect(String(url)).not.toMatch(/sendVoice|sendAudio|sendMessage/);
      expect(body).toBeInstanceOf(FormData);
    });

    it('returns attachment_rejected on Telegram payload/format rejection', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'Request failed with status code 400',
        response: { status: 400, data: { description: 'Bad Request' } },
      });
      const result = await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'T' },
          config: { chat_id: '1' },
        }),
        undefined,
        'caption',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('wav'),
            contentType: 'audio/wav',
          },
        },
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(ATTACHMENT_REJECTED);
      expect(result.error).toBe('attachment_rejected');
    });

    it('returns a different error on Telegram 5xx transport failure', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        message: 'Request failed with status code 502',
        response: { status: 502, data: {} },
      });
      const result = await provider.send(
        integ('telegram', {
          credentials: { bot_token: 'T' },
          config: { chat_id: '1' },
        }),
        undefined,
        'caption',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('wav'),
            contentType: 'audio/wav',
          },
        },
      );
      expect(result.success).toBe(false);
      expect(result.error).not.toBe(ATTACHMENT_REJECTED);
    });
  });

  describe('EmailProvider', () => {
    it('delegates to MailerService.sendNotification with trim', async () => {
      const mailer = {
        sendNotification: jest.fn().mockResolvedValue({ success: true }),
      };
      const provider = new EmailProvider(mailer as any);
      const long = 'y'.repeat(NOTIFICATION_MESSAGE_MAX_LEN + 10);

      const result = await provider.send(
        integ('email', { config: { subject: 'Alert' } }),
        'user@example.com',
        long,
      );

      expect(result.success).toBe(true);
      expect(mailer.sendNotification).toHaveBeenCalledWith({
        to: 'user@example.com',
        subject: 'Alert',
        text: long.slice(0, NOTIFICATION_MESSAGE_MAX_LEN),
      });
    });

    it('does not throw when mailer fails', async () => {
      const mailer = {
        sendNotification: jest.fn().mockRejectedValue(new Error('smtp')),
      };
      const provider = new EmailProvider(mailer as any);
      const result = await provider.send(
        integ('email', { config: { to: 'a@b.c' } }),
        undefined,
        'hi',
      );
      expect(result.success).toBe(false);
    });

    it('passes attachments[] into mailer when attach is set', async () => {
      const mailer = {
        sendNotification: jest.fn().mockResolvedValue({ success: true }),
      };
      const provider = new EmailProvider(mailer as any);
      const content = Buffer.from('wav-bytes');

      const result = await provider.send(
        integ('email', { config: { to: 'a@b.c', subject: 'VM' } }),
        undefined,
        'new voicemail',
        {
          attach: {
            filename: 'msg.wav',
            content,
            contentType: 'audio/wav',
          },
        },
      );

      expect(result.success).toBe(true);
      expect(mailer.sendNotification).toHaveBeenCalledWith({
        to: 'a@b.c',
        subject: 'VM',
        text: 'new voicemail',
        attachments: [
          { filename: 'msg.wav', content, contentType: 'audio/wav' },
        ],
      });
    });
  });

  describe('WhatsAppProvider', () => {
    const provider = new WhatsAppProvider();

    it('POSTs to graph.facebook.com/v22.0 with Bearer token', async () => {
      const result = await provider.send(
        integ('whatsapp', {
          credentials: {
            access_token: 'WATOKEN',
            phone_number_id: 'PNID99',
          },
        }),
        '79001234567',
        'wa body',
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v22.0/PNID99/messages',
        {
          messaging_product: 'whatsapp',
          to: '79001234567',
          type: 'text',
          text: { body: 'wa body' },
        },
        expect.objectContaining({
          headers: { Authorization: 'Bearer WATOKEN' },
          timeout: expect.any(Number),
        }),
      );
    });

    it('ignores attach and still POSTs text only', async () => {
      await provider.send(
        integ('whatsapp', {
          credentials: {
            access_token: 'WATOKEN',
            phone_number_id: 'PNID99',
          },
        }),
        '79001234567',
        'wa body',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('x'),
            contentType: 'audio/wav',
          },
        },
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://graph.facebook.com/v22.0/PNID99/messages',
        expect.objectContaining({ type: 'text', text: { body: 'wa body' } }),
        expect.any(Object),
      );
    });
  });

  describe('WebhookProvider', () => {
    const provider = new WebhookProvider();

    it('POSTs templated JSON to configured http/https URL', async () => {
      const result = await provider.send(
        integ('webhook', {
          config: {
            url: 'https://hooks.example.com/notify',
            headers: { 'X-Hook': '1' },
            payload_template: { event: 'call', text: '{{message}}', dest: '{{target}}' },
          },
        }),
        'dest-1',
        'hello hook',
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.example.com/notify',
        { event: 'call', text: 'hello hook', dest: 'dest-1' },
        expect.objectContaining({
          headers: { 'X-Hook': '1' },
          timeout: expect.any(Number),
        }),
      );
    });

    it('rejects non-http/https URL schemes (SSRF guard)', async () => {
      const result = await provider.send(
        integ('webhook', {
          config: { url: 'file:///etc/passwd' },
        }),
        undefined,
        'x',
      );
      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('rejects javascript: URL', async () => {
      const result = await provider.send(
        integ('webhook', { config: { url: 'javascript:alert(1)' } }),
        undefined,
        'x',
      );
      expect(result.success).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('ignores attach and still POSTs JSON text (link-only)', async () => {
      const result = await provider.send(
        integ('webhook', {
          config: { url: 'https://hooks.example.com/notify' },
        }),
        undefined,
        'hello hook',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('x'),
            contentType: 'audio/wav',
          },
          extraVars: { clid: '1', exten: '100', uniqueid: 'u1' },
        },
      );
      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.example.com/notify',
        { message: 'hello hook', clid: '1', exten: '100', uniqueid: 'u1' },
        expect.any(Object),
      );
    });
  });

  describe('MaxProvider', () => {
    const provider = new MaxProvider();

    it('POSTs to platform-api2.max.ru with Authorization header', async () => {
      const result = await provider.send(
        integ('max', {
          credentials: { access_token: 'MAXTOKEN' },
          config: { user_id: 'u42' },
        }),
        undefined,
        'max text',
      );

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://platform-api2.max.ru/messages?user_id=u42',
        { text: 'max text' },
        expect.objectContaining({
          headers: { Authorization: 'MAXTOKEN' },
          timeout: expect.any(Number),
        }),
      );
    });

    it('ignores attach and still POSTs text only', async () => {
      await provider.send(
        integ('max', {
          credentials: { access_token: 'MAXTOKEN' },
          config: { user_id: 'u42' },
        }),
        undefined,
        'max text',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('x'),
            contentType: 'audio/wav',
          },
        },
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://platform-api2.max.ru/messages?user_id=u42',
        { text: 'max text' },
        expect.any(Object),
      );
    });
  });

  describe('VkProvider', () => {
    const provider = new VkProvider();

    it('POSTs form-urlencoded messages.send to api.vk.com', async () => {
      const result = await provider.send(
        integ('vk', {
          credentials: { access_token: 'VKTOKEN' },
          config: { peer_id: '200' },
        }),
        undefined,
        'vk msg',
      );

      expect(result.success).toBe(true);
      const [url, body, opts] = mockedAxios.post.mock.calls[0];
      expect(url).toBe(
        'https://api.vk.com/method/messages.send?access_token=VKTOKEN&v=5.199',
      );
      expect(opts).toMatchObject({
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: expect.any(Number),
      });
      const params = new URLSearchParams(body as string);
      expect(params.get('peer_id')).toBe('200');
      expect(params.get('message')).toBe('vk msg');
      expect(params.get('random_id')).toBeTruthy();
    });

    it('uses target as peer_id override', async () => {
      await provider.send(
        integ('vk', {
          credentials: { access_token: 'VK' },
          config: { peer_id: '1' },
        }),
        '77',
        'm',
      );
      const params = new URLSearchParams(
        mockedAxios.post.mock.calls[0][1] as string,
      );
      expect(params.get('peer_id')).toBe('77');
    });

    it('ignores attach and still POSTs text only', async () => {
      await provider.send(
        integ('vk', {
          credentials: { access_token: 'VKTOKEN' },
          config: { peer_id: '200' },
        }),
        undefined,
        'vk msg',
        {
          attach: {
            filename: 'vm.wav',
            content: Buffer.from('x'),
            contentType: 'audio/wav',
          },
        },
      );
      const [url, body] = mockedAxios.post.mock.calls[0];
      expect(url).toContain('messages.send');
      const params = new URLSearchParams(body as string);
      expect(params.get('message')).toBe('vk msg');
    });
  });
});
