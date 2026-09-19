import { UnauthorizedException } from '@nestjs/common';
import { DialplanNotifyController } from './dialplan-notify.controller';

describe('Mailer DialplanNotifyController', () => {
  const mailerService = { sendNotification: jest.fn().mockResolvedValue({ success: true }) };
  const configService = { get: jest.fn() };

  function create(secret: string | undefined) {
    configService.get.mockReturnValue(secret);
    return new DialplanNotifyController(mailerService as any, configService as any);
  }

  beforeEach(() => jest.clearAllMocks());

  it('rejects when DIALPLAN_API_KEY is missing from env', async () => {
    await expect(create('').sendMail('', { to: 'a@b.c' } as any))
      .rejects.toThrow(UnauthorizedException);
    expect(mailerService.sendNotification).not.toHaveBeenCalled();
  });

  it('rejects a wrong key', async () => {
    await expect(create('secret').sendMail('wrong', { to: 'a@b.c' } as any))
      .rejects.toThrow(UnauthorizedException);
  });

  it('accepts a matching x-api-key', async () => {
    await expect(create('secret').sendMail('secret', { to: 'a@b.c' } as any))
      .resolves.toEqual({ success: true });
  });
});
