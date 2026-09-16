import { ExecutionContext, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConferenceGuestTokenGuard } from './conference-guest-token.guard';

function mockContext(token?: string) {
  const req: { params: Record<string, unknown>; user: unknown } = {
    params: token !== undefined ? { token } : {},
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
}

function errorBody(err: unknown) {
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
  expect(err).toBeInstanceOf(UnauthorizedException);
  return (err as HttpException).getResponse() as { code?: string };
}

describe('ConferenceGuestTokenGuard (16.1-01)', () => {
  let guard: ConferenceGuestTokenGuard;
  let tokenModel: { findOne: jest.Mock };
  let roomModel: { findOne: jest.Mock };

  beforeEach(() => {
    tokenModel = { findOne: jest.fn() };
    roomModel = { findOne: jest.fn() };
    guard = new ConferenceGuestTokenGuard(tokenModel as any, roomModel as any);
  });

  it('rejects a missing params.token as CONFERENCE_GUEST_TOKEN_INVALID', async () => {
    const { context } = mockContext();
    try {
      await guard.canActivate(context);
      throw new Error('expected invalid token');
    } catch (err) {
      expect(errorBody(err).code).toBe('CONFERENCE_GUEST_TOKEN_INVALID');
    }
    expect(tokenModel.findOne).not.toHaveBeenCalled();
  });

  it('rejects an unknown token as CONFERENCE_GUEST_TOKEN_INVALID', async () => {
    tokenModel.findOne.mockResolvedValue(null);
    const { context } = mockContext('missing-token');
    try {
      await guard.canActivate(context);
      throw new Error('expected invalid token');
    } catch (err) {
      expect(errorBody(err).code).toBe('CONFERENCE_GUEST_TOKEN_INVALID');
    }
  });

  it('rejects a revoked token as CONFERENCE_GUEST_TOKEN_REVOKED', async () => {
    tokenModel.findOne.mockResolvedValue({
      uid: 1,
      room_uid: 77,
      kind: 'shared_link',
      invite_name: null,
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 86_400_000),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const { context } = mockContext('revoked');
    try {
      await guard.canActivate(context);
      throw new Error('expected revoked token');
    } catch (err) {
      expect(errorBody(err).code).toBe('CONFERENCE_GUEST_TOKEN_REVOKED');
    }
  });

  it('rejects an expired token as CONFERENCE_GUEST_TOKEN_EXPIRED', async () => {
    tokenModel.findOne.mockResolvedValue({
      uid: 1,
      room_uid: 77,
      kind: 'shared_link',
      invite_name: null,
      revoked_at: null,
      expires_at: new Date(Date.now() - 60_000),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const { context } = mockContext('expired');
    try {
      await guard.canActivate(context);
      throw new Error('expected expired token');
    } catch (err) {
      expect(errorBody(err).code).toBe('CONFERENCE_GUEST_TOKEN_EXPIRED');
    }
  });

  it('sets req.user to the six guest keys and stamps last_used_at', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    tokenModel.findOne.mockResolvedValue({
      uid: 9,
      room_uid: 77,
      kind: 'named_invite',
      invite_name: 'Иван',
      revoked_at: null,
      expires_at: new Date(Date.now() + 86_400_000),
      update,
    });
    roomModel.findOne.mockResolvedValue({ uid: 77, user_uid: 42 });
    const { req, context } = mockContext('a'.repeat(64));

    const ok = await guard.canActivate(context);

    expect(ok).toBe(true);
    expect(Object.keys(req.user as object).sort()).toEqual([
      'guestTokenUid',
      'guestVpbxUserUid',
      'inviteName',
      'isGuest',
      'roomUid',
      'tokenKind',
    ]);
    expect(req.user).toEqual({
      isGuest: true,
      roomUid: 77,
      guestTokenUid: 9,
      tokenKind: 'named_invite',
      inviteName: 'Иван',
      guestVpbxUserUid: 42,
    });
    expect((req.user as { sub?: unknown }).sub).toBeUndefined();
    expect((req.user as { level?: unknown }).level).toBeUndefined();
    expect(update).toHaveBeenCalledWith({ last_used_at: expect.any(Date) });
    expect(roomModel.findOne).toHaveBeenCalledWith({ where: { uid: 77 } });
  });
});
