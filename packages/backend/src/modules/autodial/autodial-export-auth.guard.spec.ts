import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AutodialExportAuthGuard } from './autodial-export-auth.guard';

const context = (authorization?: string, query: Record<string, string> = {}) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization }, query }) }),
}) as ExecutionContext;

describe('autodial export authorization transport', () => {
  const guard = new AutodialExportAuthGuard();
  it('requires bearer transport even when a query token would authenticate EventSource', () => {
    expect(() => guard.canActivate(context(undefined, { token: 'test-only' }))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('Basic test-only'))).toThrow(UnauthorizedException);
  });
  it('rejects credentials in the URL even alongside a valid header', () => {
    expect(() => guard.canActivate(context('Bearer test-only', { token: 'test-only' }))).toThrow(UnauthorizedException);
  });
  it('allows header transport for the existing JWT and module guards to authorize', () => {
    expect(guard.canActivate(context('Bearer test-only', { from: '2026-10-18' }))).toBe(true);
  });
});
