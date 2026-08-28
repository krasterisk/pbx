import {
  Controller, Get, Query, HttpCode, Logger, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../dialplan-bridge/dialplan-api-key';
import {
  DirectoriesService,
  type DirectoryLookupResult,
} from './directories.service';

@Controller('internal/dialplan')
export class DirectoryLookupController {
  private readonly logger = new Logger(DirectoryLookupController.name);
  private readonly apiKey: string;

  constructor(
    private readonly directoriesService: DirectoriesService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Get('directory-lookup')
  @HttpCode(200)
  async lookup(
    @Query('directory_uid') directoryUidRaw: string,
    @Query('user_uid') userUidRaw: string,
    @Query('key') key: string,
    @Query('field_uids') fieldUidsRaw: string,
    @Query('api_key') apiKey?: string,
  ): Promise<string> {
    this.assertKey(apiKey);

    const started = Date.now();
    let outcome = 'error';
    let matchKind: string | null = null;
    let directoryUid: number | null = parsePositiveInt(directoryUidRaw);
    let userUid: number | null = parsePositiveInt(userUidRaw);

    try {
      const fieldUids = parseFieldUids(fieldUidsRaw);
      if (directoryUid == null || userUid == null || fieldUids == null) {
        return 'KDL1|ERROR';
      }

      const result = await this.directoriesService.lookup({
        directoryUid,
        userUid,
        key,
        fieldUids,
      });
      outcome = result.status === 'FOUND'
        ? 'found'
        : result.status === 'NOT_FOUND'
          ? 'not_found'
          : 'error';
      matchKind = result.matchKind ?? null;
      return encodeLookupResponse(result);
    } catch (err) {
      this.logger.error(
        'Directory lookup failed',
        err instanceof Error ? err.stack : String(err),
      );
      return 'KDL1|ERROR';
    } finally {
      this.logger.log(JSON.stringify({
        duration_ms: Date.now() - started,
        outcome,
        user_uid: userUid,
        directory_uid: directoryUid,
        match_kind: matchKind,
      }));
    }
  }

  private assertKey(provided?: string): void {
    if (!timingSafeApiKeyEqual(this.apiKey, provided)) {
      this.logger.warn('Unauthorized internal directory lookup');
      throw new UnauthorizedException('Invalid API key');
    }
  }
}

function encodeLookupResponse(result: DirectoryLookupResult): string {
  if (result.status !== 'FOUND') return `KDL1|${result.status}`;
  return [
    'KDL1',
    'FOUND',
    ...result.values.map((value) => Buffer.from(String(value ?? ''), 'utf8').toString('base64')),
  ].join('|');
}

function parsePositiveInt(raw: string): number | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

function parseFieldUids(raw: string): number[] | null {
  if (raw == null || String(raw).trim() === '') return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const part of String(raw).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < 1) return null;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
