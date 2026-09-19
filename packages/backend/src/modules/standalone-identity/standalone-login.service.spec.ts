import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';
import { StandaloneLoginService } from './standalone-login.service';

describe('StandaloneLoginService', () => {
  const hash = bcrypt.hashSync('correct horse battery staple', 4);
  const user = {
    uniqueid: 42, login: 'admin@example.test', name: 'Admin',
    passwd: hash, level: 1, role: 0, vpbx_user_uid: 42,
  };
  const users = { findOne: jest.fn() };
  const jwt = { sign: jest.fn().mockReturnValue('access'),
    decode: jest.fn().mockReturnValue({ sub: 42, level: 1, role: 0, vpbx_user_uid: 42, iat: 123 }) };
  const tenantContext = { fromUserClaims: jest.fn() };
  const service = new StandaloneLoginService(users as any, jwt as any, tenantContext as any);

  beforeEach(() => {
    jest.clearAllMocks();
    users.findOne.mockResolvedValue(user);
    tenantContext.fromUserClaims.mockResolvedValue({ tenantUid: 42 });
  });

  it('issues a tenant-scoped access token after checking live tenant state', async () => {
    await expect(service.login('ADMIN@example.test ', 'correct horse battery staple')).resolves.toEqual({
      accessToken: 'access', expiresInSeconds: 7200,
      user: { uniqueid: 42, login: user.login, name: user.name },
    });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 42, level: 1, role: 0, vpbx_user_uid: 42 });
    expect(tenantContext.fromUserClaims).toHaveBeenCalledWith(jwt.decode('access'), 'standalone-login');
  });

  it('does not issue a token for invalid credentials', async () => {
    await expect(service.login(user.login, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('does not issue a token for an unknown login', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(service.login('unknown@example.test', 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('does not return a token when the tenant is inactive', async () => {
    tenantContext.fromUserClaims.mockRejectedValue(new UnauthorizedException());
    await expect(service.login(user.login, 'correct horse battery staple')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
