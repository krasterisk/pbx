import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Export does not need the query-token exception used by EventSource. */
@Injectable()
export class AutodialExportAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!/^Bearer\s+\S+$/i.test(request.headers.authorization ?? '') || 'token' in request.query) {
      throw new UnauthorizedException({ code: 'AC_EXPORT_HEADER_REQUIRED' });
    }
    return true;
  }
}
