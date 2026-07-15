import { NotificationDispatcherService } from './notification-dispatcher.service';

describe('NotificationDispatcherService', () => {
  let notificationsService: { findByUidInternal: jest.Mock };
  let telegram: { send: jest.Mock };
  let email: { send: jest.Mock };
  let whatsapp: { send: jest.Mock };
  let webhook: { send: jest.Mock };
  let max: { send: jest.Mock };
  let vk: { send: jest.Mock };
  let dispatcher: NotificationDispatcherService;

  beforeEach(() => {
    notificationsService = {
      findByUidInternal: jest.fn(),
    };
    telegram = { send: jest.fn().mockResolvedValue({ success: true }) };
    email = { send: jest.fn().mockResolvedValue({ success: true }) };
    whatsapp = { send: jest.fn().mockResolvedValue({ success: true }) };
    webhook = { send: jest.fn().mockResolvedValue({ success: true }) };
    max = { send: jest.fn().mockResolvedValue({ success: true }) };
    vk = { send: jest.fn().mockResolvedValue({ success: true }) };

    dispatcher = new NotificationDispatcherService(
      notificationsService as any,
      telegram as any,
      email as any,
      whatsapp as any,
      webhook as any,
      max as any,
      vk as any,
    );
  });

  function mockInteg(channel: string) {
    notificationsService.findByUidInternal.mockResolvedValue({
      uid: 15,
      channel,
      config: {},
      credentials: { token: 'x' },
    });
  }

  it('routes telegram via findByUidInternal + telegram provider', async () => {
    mockInteg('telegram');
    await dispatcher.dispatch({
      integration_uid: 15,
      message: 'hi',
      target: 'chat-1',
    });
    expect(notificationsService.findByUidInternal).toHaveBeenCalledWith(15);
    expect(telegram.send).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'telegram' }),
      'chat-1',
      'hi',
    );
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each([
    ['email', () => email],
    ['whatsapp', () => whatsapp],
    ['webhook', () => webhook],
    ['max', () => max],
    ['vk', () => vk],
  ] as const)('routes %s to its provider', async (channel, getProvider) => {
    mockInteg(channel);
    await dispatcher.dispatch({
      integration_uid: 3,
      message: 'm',
      target: 't',
    });
    expect(getProvider().send).toHaveBeenCalledWith(
      expect.objectContaining({ channel }),
      't',
      'm',
    );
  });

  it('defaults message to empty string', async () => {
    mockInteg('telegram');
    await dispatcher.dispatch({ integration_uid: 1 });
    expect(telegram.send).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      '',
    );
  });

  it('handles unknown channel without throwing', async () => {
    mockInteg('carrier-pigeon' as any);
    await expect(
      dispatcher.dispatch({ integration_uid: 1, message: 'x' }),
    ).resolves.toBeUndefined();
    expect(telegram.send).not.toHaveBeenCalled();
  });

  it('does not throw when findByUidInternal fails', async () => {
    notificationsService.findByUidInternal.mockRejectedValue(
      new Error('not found'),
    );
    await expect(
      dispatcher.dispatch({ integration_uid: 99, message: 'x' }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when provider rejects', async () => {
    mockInteg('telegram');
    telegram.send.mockRejectedValue(new Error('boom'));
    await expect(
      dispatcher.dispatch({ integration_uid: 1, message: 'x' }),
    ).resolves.toBeUndefined();
  });
});
