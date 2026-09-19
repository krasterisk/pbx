import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../dialplan-bridge/dialplan-api-key';

/** v3 public robot URLs stay; unauthenticated access is no longer allowed. */
@Injectable()
export class VoiceRobotsPublicKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    }>();
    const header = request.headers?.['x-api-key'];
    const query = request.query?.api_key;
    const body = request.body?.api_key;
    const provided = [header, query, body].find((value): value is string => typeof value === 'string' && value.length > 0) ?? '';
    const expected = this.config.get<string>('VOICE_ROBOTS_PUBLIC_API_KEY')
      || this.config.get<string>('DIALPLAN_API_KEY')
      || '';
    if (!timingSafeApiKeyEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid API key');
    }
    return true;
  }
}
