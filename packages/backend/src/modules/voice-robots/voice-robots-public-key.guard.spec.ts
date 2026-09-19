import { UnauthorizedException } from '@nestjs/common';
import { VoiceRobotsPublicKeyGuard } from './voice-robots-public-key.guard';

describe('VoiceRobotsPublicKeyGuard', () => {
  const config = { get: jest.fn() };
  const guard = () => new VoiceRobotsPublicKeyGuard(config as any);

  function context(parts: { header?: string; query?: string; body?: string }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: parts.header ? { 'x-api-key': parts.header } : {},
          query: parts.query ? { api_key: parts.query } : {},
          body: parts.body ? { api_key: parts.body } : {},
        }),
      }),
    } as any;
  }

  beforeEach(() => jest.clearAllMocks());

  it('rejects when no public or dialplan key is configured', () => {
    config.get.mockReturnValue('');
    expect(() => guard().canActivate(context({}))).toThrow(UnauthorizedException);
  });

  it('accepts VOICE_ROBOTS_PUBLIC_API_KEY from the x-api-key header', () => {
    config.get.mockImplementation((key: string) => (
      key === 'VOICE_ROBOTS_PUBLIC_API_KEY' ? 'public-secret' : ''
    ));
    expect(guard().canActivate(context({ header: 'public-secret' }))).toBe(true);
  });

  it('falls back to DIALPLAN_API_KEY for v3 clients', () => {
    config.get.mockImplementation((key: string) => (
      key === 'DIALPLAN_API_KEY' ? 'dialplan-secret' : ''
    ));
    expect(guard().canActivate(context({ query: 'dialplan-secret' }))).toBe(true);
  });

  it('rejects a wrong key without removing the public URL', () => {
    config.get.mockImplementation((key: string) => (
      key === 'DIALPLAN_API_KEY' ? 'dialplan-secret' : ''
    ));
    expect(() => guard().canActivate(context({ header: 'wrong' }))).toThrow(UnauthorizedException);
  });
});
