import { ExecutionContext, HttpException, UnauthorizedException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VoicemailLinkGuard } from './voicemail-link.guard';

describe('VoicemailLinkGuard', () => {
  let guard: VoicemailLinkGuard;
  let tokenModel: { findOne: jest.Mock };

  const makeContext = (token?: string) => {
    const req: { query: Record<string, unknown>; user: unknown } = {
      query: token !== undefined ? { token } : {},
      user: undefined,
    };
    return {
      req,
      context: {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as ExecutionContext,
    };
  };

  beforeEach(() => {
    tokenModel = { findOne: jest.fn() };
    guard = new VoicemailLinkGuard(tokenModel as any);
  });

  it('throws UnauthorizedException when token is missing', async () => {
    const { context } = makeContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(tokenModel.findOne).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when token is unknown', async () => {
    tokenModel.findOne.mockResolvedValue(null);
    const { context } = makeContext('unknown-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is revoked', async () => {
    tokenModel.findOne.mockResolvedValue({
      vpbx_user_uid: 5,
      message_uid: 1,
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 86_400_000),
    });
    const { context } = makeContext('revoked');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token with 401 or 410', async () => {
    tokenModel.findOne.mockResolvedValue({
      vpbx_user_uid: 1,
      message_uid: 1,
      revoked_at: null,
      expires_at: new Date(Date.now() - 60_000),
    });
    const { context } = makeContext('expired');
    try {
      await guard.canActivate(context);
      fail('expected expired token to be rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect([401, 410]).toContain((err as HttpException).getStatus());
    }
  });

  it('sets req.user to only vpbx_user_uid and isDisplayToken for a valid token', async () => {
    tokenModel.findOne.mockResolvedValue({
      vpbx_user_uid: 12,
      message_uid: 99,
      revoked_at: null,
      expires_at: new Date(Date.now() + 7 * 86_400_000),
    });
    const { req, context } = makeContext('a'.repeat(64));

    const ok = await guard.canActivate(context);

    expect(ok).toBe(true);
    expect(req.user).toEqual({
      vpbx_user_uid: 12,
      isDisplayToken: true,
    });
    expect(Object.keys(req.user as object).sort()).toEqual(['isDisplayToken', 'vpbx_user_uid']);
    expect((req.user as { sub?: unknown }).sub).toBeUndefined();
    expect((req.user as { level?: unknown }).level).toBeUndefined();
  });
});

describe('vm_access_tokens migration', () => {
  const src = fs.readFileSync(path.join(__dirname, 'migrate-voicemail.ts'), 'utf8');

  it('creates vm_access_tokens idempotently with unique token index', () => {
    expect(src).toMatch(/createTable\(\s*['"]vm_access_tokens['"]/);
    expect(src).toContain('ifNotExists: true');
    expect(src).toMatch(/addIndex\(\s*['"]vm_access_tokens['"]/);
    expect(src).toMatch(/unique:\s*true/);
    expect(src).toMatch(/message_uid/);
    expect(src).toMatch(/vpbx_user_uid/);
    expect(src).toMatch(/expires_at/);
    expect(src).toMatch(/revoked_at/);
  });
});
