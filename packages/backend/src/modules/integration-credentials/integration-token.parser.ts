import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export type ParsedCredential =
  | { kind: 'jwt'; token: string }
  | { kind: 'integration'; selector: string; secret: string };

/** New integration endpoints never accept the legacy SSE query-token fallback. */
export function parseIntegrationAuthorization(request: {
  headers?: Record<string, unknown>;
  rawHeaders?: string[];
  query?: Record<string, unknown>;
}): ParsedCredential {
  const raw = request.rawHeaders ?? [];
  const authorizationFields = raw.filter((field, index) => index % 2 === 0
    && field.toLowerCase() === 'authorization').length;
  if (authorizationFields > 1 || request.query?.token !== undefined) {
    throw new BadRequestException({ code: 'ambiguous_or_query_credential' });
  }
  const value = request.headers?.authorization;
  if (typeof value !== 'string' || value.length > 1600) {
    throw new UnauthorizedException({ code: 'credential_required' });
  }
  const match = /^Bearer ([^\s]+)$/.exec(value);
  if (!match) throw new UnauthorizedException({ code: 'credential_invalid' });
  const token = match[1];
  if (token.startsWith('krint_v1_')) {
    const integration = /^krint_v1_([A-Za-z0-9_-]{22})_([A-Za-z0-9_-]{43})$/.exec(token);
    if (!integration) throw new UnauthorizedException({ code: 'credential_invalid' });
    return { kind: 'integration', selector: integration[1], secret: integration[2] };
  }
  if (token.length > 1400 || token.split('.').length !== 3) {
    throw new UnauthorizedException({ code: 'credential_invalid' });
  }
  return { kind: 'jwt', token };
}
