import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ModuleAccessGuard } from './module-access.guard';

function context(user: any): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('ModuleAccessGuard AI products', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const modules = {
    resolveAiProductAccess: jest.fn(),
    tenantHasModule: jest.fn(),
  };
  const guard = new ModuleAccessGuard(reflector as any, modules as any);

  beforeEach(() => jest.clearAllMocks());

  it('rejects missing identity before querying policy', async () => {
    reflector.getAllAndOverride.mockReturnValue('ai_voice_robots');
    await expect(guard.canActivate(context(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(modules.resolveAiProductAccess).not.toHaveBeenCalled();
  });

  it('does not let SUPERADMIN bypass tenant product admission', async () => {
    reflector.getAllAndOverride.mockReturnValue('speech_analytics');
    modules.resolveAiProductAccess.mockResolvedValue({
      allowed: false, reason: 'product_disabled', product: 'speech_analytics', policyRevision: 1,
    });
    await expect(guard.canActivate(context({ level: 0, vpbx_user_uid: 0 })))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(modules.resolveAiProductAccess).toHaveBeenCalledWith(0, 'speech_analytics');
  });

  it('keeps the legacy superadmin path', async () => {
    reflector.getAllAndOverride.mockReturnValue('voice_robot');
    await expect(guard.canActivate(context({ level: 0, vpbx_user_uid: 0 }))).resolves.toBe(true);
    expect(modules.tenantHasModule).not.toHaveBeenCalled();
  });
});
