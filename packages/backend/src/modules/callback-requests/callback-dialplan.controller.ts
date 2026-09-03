import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeApiKeyEqual } from '../dialplan-bridge/dialplan-api-key';
import {
  CallbackRequestsService,
  type CallbackEnqueueBody,
} from './callback-requests.service';

/**
 * Internal enqueue for Asterisk CURL (D-38 / D-41).
 * No JWT — DIALPLAN_API_KEY via timingSafeApiKeyEqual (T-14-14).
 *
 * Endpoint: POST /api/internal/callback-requests/enqueue
 */
@Controller('internal/callback-requests')
export class CallbackDialplanController {
  private readonly logger = new Logger(CallbackDialplanController.name);
  private readonly apiKey: string;

  constructor(
    private readonly service: CallbackRequestsService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('enqueue')
  @HttpCode(200)
  async enqueue(
    @Headers('x-api-key') headerKey: string,
    @Body() body: CallbackEnqueueBody & { api_key?: string },
  ) {
    this.assertKey(headerKey || body.api_key);
    const row = await this.service.enqueue(body);
    return { accepted: true, id: row?.uid ?? null };
  }

  private assertKey(provided?: string): void {
    if (!timingSafeApiKeyEqual(this.apiKey, provided)) {
      this.logger.warn('Unauthorized internal callback enqueue');
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
