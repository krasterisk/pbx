import axios from 'axios';
import { WebhookProvider, resolvePayloadTemplate } from './webhook.provider';
import { DecryptedNotificationIntegration } from './notification-provider.interface';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function webhookInteg(
  overrides: Partial<DecryptedNotificationIntegration> = {},
): DecryptedNotificationIntegration {
  return {
    uid: 1,
    name: 'crm-hook',
    channel: 'webhook',
    config: {
      url: 'https://hooks.example.com/crm',
      payload_template: { customer: '{{customer_name}}', note: '{{unknown_var}}' },
    },
    credentials: {},
    ...overrides,
  };
}

describe('WebhookProvider extraVars', () => {
  const provider = new WebhookProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ data: { ok: true }, status: 200 });
  });

  it('send without extraVars — backward compatible payload', async () => {
    const result = await provider.send(
      webhookInteg({
        config: {
          url: 'https://hooks.example.com/notify',
          payload_template: { text: '{{message}}', dest: '{{target}}' },
        },
      }),
      'dest-1',
      'hello hook',
    );

    expect(result.success).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.example.com/notify',
      { text: 'hello hook', dest: 'dest-1' },
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('send with extraVars substitutes into payload_template', async () => {
    await provider.send(
      webhookInteg(),
      undefined,
      '',
      { customer_name: 'Alice Corp' },
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.example.com/crm',
      { customer: 'Alice Corp', note: '' },
      expect.any(Object),
    );
  });

  it('unknown {{var}} in template becomes empty string', async () => {
    await provider.send(
      webhookInteg({
        config: {
          url: 'https://hooks.example.com/crm',
          payload_template: { only: '{{missing_key}}' },
        },
      }),
      undefined,
      '',
      {},
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.example.com/crm',
      { only: '' },
      expect.any(Object),
    );
  });

  it('accepts payload_template as a JSON string', async () => {
    await provider.send(
      webhookInteg({
        config: {
          url: 'https://hooks.example.com/crm',
          payload_template: '{"text":"{{message}}","caller":"{{clid}}"}',
        },
      }),
      undefined,
      'hi',
      { clid: '7900' },
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.example.com/crm',
      { text: 'hi', caller: '7900' },
      expect.any(Object),
    );
  });

  it('default payload includes message + call ids when no template', async () => {
    await provider.send(
      webhookInteg({
        config: { url: 'https://hooks.example.com/crm' },
      }),
      undefined,
      'hello',
      { clid: '1', exten: '100', uniqueid: 'u1' },
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://hooks.example.com/crm',
      { message: 'hello', clid: '1', exten: '100', uniqueid: 'u1' },
      expect.any(Object),
    );
  });
});

describe('resolvePayloadTemplate', () => {
  it('parses object and JSON string, rejects arrays', () => {
    expect(resolvePayloadTemplate({ a: 1 })).toEqual({ a: 1 });
    expect(resolvePayloadTemplate('{"a":1}')).toEqual({ a: 1 });
    expect(resolvePayloadTemplate('[]')).toBeNull();
    expect(resolvePayloadTemplate('')).toBeNull();
  });
});
