import { looksLikeUserConfirm, scrubToolIdsFromPublicText } from './ai-chat-timeline.types';

describe('scrubToolIdsFromPublicText', () => {
  it('drops snake_case tool ids and keeps the human sentence', () => {
    expect(scrubToolIdsFromPublicText(
      'Отлично! create_endpoints_bulk подготовил черновик для создания абонентов 102 и 103.',
    )).toBe('Отлично! подготовил черновик для создания абонентов 102 и 103.');
  });

  it('leaves ordinary names and numbers alone', () => {
    expect(scrubToolIdsFromPublicText('IVR «Рога и копыта», абоненты 101-103, контекст sip-out.'))
      .toBe('IVR «Рога и копыта», абоненты 101-103, контекст sip-out.');
  });
});

describe('looksLikeUserConfirm', () => {
  it.each([
    'подтверждаю',
    'подтвердить',
    'подтвердите',
    'да, подтверждаю',
    'да подтверждаю',
    'подтверждаю!',
    'подтверждаю, делай',
    'Да, подтверждаю, делай',
    'согласен',
    'согласна',
    'делай',
    'применяй',
    'ок, делай',
    'apply',
  ])('accepts %s', (text) => {
    expect(looksLikeUserConfirm(text)).toBe(true);
  });

  it.each([
    '',
    'как подтвердить',
    'как подтвердить?',
    'не подтверждаю',
    'не согласен',
    'создай IVR',
    'таймаут 30',
    'ок',
    'да',
  ])('rejects %s', (text) => {
    expect(looksLikeUserConfirm(text)).toBe(false);
  });
});
