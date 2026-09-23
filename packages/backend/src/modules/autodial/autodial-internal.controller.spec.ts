import { AutodialInternalController } from './autodial-internal.controller';

describe('AutodialInternalController', () => {
  function controllerWith(attempts: { markAmdMachine: jest.Mock }) {
    const controller = Object.create(
      AutodialInternalController.prototype,
    ) as AutodialInternalController;
    controller['apiKey'] = 'test-key';
    controller['attempts'] = attempts as never;
    controller['logger'] = { warn: jest.fn(), error: jest.fn() } as never;
    return controller;
  }

  it('marks a machine result before the dialplan hangs the channel up', async () => {
    const markAmdMachine = jest.fn().mockResolvedValue(undefined);
    const controller = controllerWith({ markAmdMachine });

    await expect(
      controller.attemptMachine({ api_key: 'test-key', attempt: '41' }),
    ).resolves.toBe('OK');
    expect(markAmdMachine).toHaveBeenCalledWith(41, 'hangup');
  });

  it('does not mutate data for a malformed attempt id', async () => {
    const markAmdMachine = jest.fn();
    const controller = controllerWith({ markAmdMachine });

    await expect(
      controller.attemptMachine({ api_key: 'test-key', attempt: '0' }),
    ).resolves.toBe('IGNORED');
    expect(markAmdMachine).not.toHaveBeenCalled();
  });
});
