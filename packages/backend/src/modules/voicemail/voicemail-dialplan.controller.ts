import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../dialplan-bridge/dialplan-api-key';
import { VoicemailService, type VoicemailIngestBody } from './voicemail.service';

/**
 * Internal ingest for Asterisk hangup-handler CURL (D-62).
 * No JWT — DIALPLAN_API_KEY via timingSafeApiKeyEqual (T-13-03).
 *
 * Endpoint: POST /api/internal/dialplan/voicemail
 */
@Controller('internal/dialplan')
export class VoicemailDialplanController {
  private readonly logger = new Logger(VoicemailDialplanController.name);
  private readonly apiKey: string;

  constructor(
    private readonly service: VoicemailService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('voicemail')
  @HttpCode(200)
  async ingest(
    @Headers('x-api-key') headerKey: string,
    @Body() body: VoicemailIngestBody & { api_key?: string },
  ) {
    this.assertKey(headerKey || body.api_key);
    void this.service.ingest(body).catch((e) =>
      this.logger.error(`voicemail ingest failed: ${e?.message ?? e}`),
    );
    return { accepted: true };
  }

  private assertKey(provided?: string): void {
    if (!timingSafeApiKeyEqual(this.apiKey, provided)) {
      this.logger.warn('Unauthorized internal voicemail ingest');
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
