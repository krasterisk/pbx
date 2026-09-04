import { ValidationPipe } from '@nestjs/common';
import { ApplyRouteTemplateDto } from './route-template.dto';

describe('ApplyRouteTemplateDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('keeps dotted slot ids as literal keys', async () => {
    const slotId = 'queue-a_1778039515670_snrw-target.value';
    const body = {
      slotValues: {
        [slotId]: { uid: '701', name: '701 - Поддержка' },
      },
      mode: 'append',
    };

    const parsed = await pipe.transform(body, {
      type: 'body',
      metatype: ApplyRouteTemplateDto,
    });

    expect(parsed.slotValues[slotId]).toEqual({ uid: '701', name: '701 - Поддержка' });
    expect(parsed.mode).toBe('append');
  });
});
