import { AuthService } from './auth.service';

describe('AuthService registration postcommit behavior', () => {
  function fixture(mode = 'BOX') {
    const users = { findByLogin: jest.fn().mockResolvedValue(null) };
    const config = { get: jest.fn((key, fallback) => key === 'DEPLOYMENT_MODE' ? mode : fallback) };
    const logger = { logAction: jest.fn().mockRejectedValue(new Error('audit unavailable')) };
    const mailer = { sendActivationMail: jest.fn().mockRejectedValue(new Error('mail unavailable')) };
    const registration = { create: jest.fn().mockResolvedValue({ uniqueid: 71 }) };
    const service = new AuthService(users as any, {} as any, config as any,
      logger as any, mailer as any, {} as any, registration as any);
    return { service, users, logger, mailer, registration };
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
});
