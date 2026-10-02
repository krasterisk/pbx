import { AuthService } from './auth.service';

describe('AuthService registration postcommit behavior', () => {
  function fixture(mode = 'OPENSOURCE') {
    const users = { findByLogin: jest.fn().mockResolvedValue(null) };
    const config = { get: jest.fn((key, fallback) => key === 'DEPLOYMENT_MODE' ? mode : fallback) };
    const logger = { logAction: jest.fn().mockRejectedValue(new Error('audit unavailable')) };
    const mailer = { sendActivationMail: jest.fn().mockRejectedValue(new Error('mail unavailable')) };
    const registration = { create: jest.fn().mockResolvedValue({ uniqueid: 71 }) };
    const cloudSettings = {
      isRegistrationEnabled: jest.fn().mockResolvedValue(mode === 'OPENSOURCE'),
    };
    const service = new AuthService(users as any, {} as any, config as any,
      logger as any, mailer as any, {} as any, registration as any, cloudSettings as any);
    return { service, users, logger, mailer, registration, cloudSettings };
  }

  it('keeps committed identity successful when mail and audit transports fail', async () => {
    const f = fixture();
    await expect(f.service.register('pilot', 'password123', 'Pilot', 'pilot@example.invalid'))
      .resolves.toMatchObject({ success: true, requiresActivation: true });
    expect(f.registration.create).toHaveBeenCalledTimes(1);
    expect(f.mailer.sendActivationMail).toHaveBeenCalledTimes(1);
    expect(f.logger.logAction).toHaveBeenCalledTimes(1);
  });

  it('keeps CLOUD public self-signup disabled', async () => {
    const f = fixture('CLOUD');
    await expect(f.service.register('pilot', 'password123', 'Pilot'))
      .rejects.toMatchObject({ status: 403 });
    expect(f.registration.create).not.toHaveBeenCalled();
  });

  it('blocks signup when the platform flag is off, including BOX', async () => {
    const f = fixture('BOX');
    f.cloudSettings.isRegistrationEnabled.mockResolvedValue(false);
    await expect(f.service.register('pilot', 'password123', 'Pilot'))
      .rejects.toMatchObject({ status: 403 });
    expect(f.registration.create).not.toHaveBeenCalled();
  });

  it('allows signup when the platform flag is on, including CLOUD', async () => {
    const f = fixture('CLOUD');
    f.cloudSettings.isRegistrationEnabled.mockResolvedValue(true);
    await expect(f.service.register('pilot', 'password123', 'Pilot'))
      .resolves.toMatchObject({ success: true, requiresActivation: false });
    expect(f.registration.create).toHaveBeenCalledTimes(1);
  });
});
