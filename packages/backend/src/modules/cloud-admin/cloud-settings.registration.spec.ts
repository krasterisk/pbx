import { CloudSettingsService, REGISTRATION_ENABLED_KEY } from './cloud-settings.service';

describe('CloudSettingsService registration policy', () => {
  function fixture(mode = 'BOX') {
    const settingModel = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn().mockReturnValue(mode) };
    const service = new CloudSettingsService(settingModel as any, config as any);
    return { service, settingModel, config };
  }

  it('defaults to open outside CLOUD when the key is unset', async () => {
    const { service } = fixture('BOX');
    await expect(service.isRegistrationEnabled()).resolves.toBe(true);
  });

  it('defaults to closed in CLOUD when the key is unset', async () => {
    const { service } = fixture('CLOUD');
    await expect(service.isRegistrationEnabled()).resolves.toBe(false);
  });

  it('honors an explicit closed flag', async () => {
    const { service, settingModel } = fixture('BOX');
    settingModel.findOne.mockResolvedValue({ value: '0' });
    await expect(service.isRegistrationEnabled()).resolves.toBe(false);
  });

  it('honors an explicit open flag in CLOUD', async () => {
    const { service, settingModel } = fixture('CLOUD');
    settingModel.findOne.mockResolvedValue({ value: '1' });
    await expect(service.isRegistrationEnabled()).resolves.toBe(true);
  });

  it('stores the flag as 1 or 0', async () => {
    const { service, settingModel } = fixture();
    await service.setRegistrationEnabled(false);
    expect(settingModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
      key: REGISTRATION_ENABLED_KEY,
      value: '0',
    }));
  });
});
