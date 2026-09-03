import { ValidationPipe } from '@nestjs/common';
import { DialplanDryRunController } from './dialplan-dry-run.controller';
import { DryRunRequestDto } from './dto/dry-run.dto';

describe('DialplanDryRunController', () => {
  let controller: DialplanDryRunController;
  let service: { run: jest.Mock };

  beforeEach(() => {
    service = { run: jest.fn().mockResolvedValue({ segments: [], hopsUsed: 0 }) };
    controller = new DialplanDryRunController(service as never);
  });

  it('POST /dialplan/dry-run passes JWT vpbx_user_uid only', async () => {
    const body: DryRunRequestDto = {
      host: 'route',
      actions: [{ id: 'a', type: 'hangup', params: {}, condition: {} }],
    };
    await controller.run(body, { user: { vpbx_user_uid: 19 } });
    expect(service.run).toHaveBeenCalledWith(19, body);
  });

  it('rejects unknown top-level keys via class-validator whitelist', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        { host: 'route', vpbx_user_uid: 1, actions: [] },
        { type: 'body', metatype: DryRunRequestDto },
      ),
    ).rejects.toBeTruthy();
  });
});
