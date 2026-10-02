import { sanitizeTelegramError } from './telegram.service';

describe('sanitizeTelegramError', () => {
  it('strips bot tokens from request URLs and messages', () => {
    const raw = 'EFATAL: POST https://api.telegram.org/bot123456789:AAExampleTokenValue_forTests/sendMessage';
    expect(sanitizeTelegramError(new Error(raw))).toBe(
      'Error: EFATAL: POST https://api.telegram.org/[redacted]',
    );
  });
});
