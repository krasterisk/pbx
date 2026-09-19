import { randomUUID } from 'node:crypto';
import {
  BadRequestException, CanActivate, ExecutionContext, HttpException, Injectable,
  NotFoundException, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { requireJwtSecret } from '../auth/jwt-secret';
import { parseIntegrationAuthorization } from './integration-token.parser';
import { TenantContextResolver, type VerifiedUserClaims } from './tenant-context.resolver';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { IntegrationKeyRateLimiter } from './integration-key-rate-limiter';
import { integrationClientAddress } from './integration-client-address';
import type { TenantContext } from './tenant-context';

export type TenantContextRequest = {
  headers?: Record<string, unknown>;
  rawHeaders?: string[];
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
  socket?: { remoteAddress?: string };
  tenantContext?: TenantContext;
};

/** Explicit new-route guard for header-only user JWTs and integration credentials. */
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly resolver: TenantContextResolver,
    private readonly credentials: IntegrationCredentialsService,
    private readonly limiter: IntegrationKeyRateLimiter,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const request = execution.switchToHttp().getRequest<TenantContextRequest>();
    const credential = parseIntegrationAuthorization(request);
    const body = request.body;
    if (body && ['tenantContext', 'tenantUid', 'tenant_uid', 'vpbx_user_uid']
      .some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
      throw new BadRequestException({ code: 'tenant_context_client_supplied' });
    }
    if (credential.kind === 'integration') {
      const remoteAddress = integrationClientAddress(request.socket?.remoteAddress,
        request.headers?.['x-forwarded-for'], this.config.get<string>('INTEGRATION_TRUSTED_PROXY_IPS'));
      await this.limiter.check(remoteAddress, credential.selector);
      let context: TenantContext;
      try {
        context = await this.credentials.authenticate(
          credential.selector, credential.secret, randomUUID(),
        );
      } catch (error) {
        await this.limiter.failure(remoteAddress, credential.selector);
        if (error instanceof HttpException) throw error;
        throw new ServiceUnavailableException({ code: 'credential_auth_unavailable' });
      }
      this.assertRequestScope(request, context);
      request.tenantContext = context;
      return true;
    }
    let claims: VerifiedUserClaims;
    try {
      claims = await this.jwt.verifyAsync<VerifiedUserClaims>(credential.token, {
        secret: requireJwtSecret(this.config),
        issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client',
      });
    } catch {
      throw new UnauthorizedException({ code: 'credential_invalid' });
    }
    const context = await this.resolver.fromUserClaims(claims, randomUUID());
    this.assertRequestScope(request, context);
    request.tenantContext = context;
    return true;
  }

  private assertRequestScope(request: TenantContextRequest, context: TenantContext): void {
    if (request.params?.tenantUid !== undefined
      && String(context.tenantUid) !== String(request.params.tenantUid)) {
      throw new NotFoundException({ code: 'resource_not_found' });
    }
  }
}
