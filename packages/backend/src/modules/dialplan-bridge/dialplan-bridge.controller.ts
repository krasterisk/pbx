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
import { DialplanBridgeService } from './dialplan-bridge.service';
import { timingSafeApiKeyEqual } from './dialplan-api-key';
import type {
  HttpRequestDialplanDto,
  SendmailPeerDialplanDto,
  SetclidDialplanDto,
  TelegramDialplanDto,
  TtsDialplanDto,
  WebhookDialplanDto,
} from './dto/dialplan-bridge.dto';

/**
 * Internal endpoints for Asterisk dialplan (D-31).
 * Guarded by DIALPLAN_API_KEY (timing-safe). Not a public user API.
 *
 * Deploy recommendation: bind /internal/dialplan/* to the Asterisk host network
 * only (firewall / loopback). Network isolation is not enforced here.
 */
@Controller('internal/dialplan')
export class DialplanBridgeController {
  private readonly logger = new Logger(DialplanBridgeController.name);
  private readonly apiKey: string;

  constructor(
    private readonly bridge: DialplanBridgeService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('setclid')
  @HttpCode(200)
  async setclid(
    @Headers('x-api-key') headerKey: string,
    @Body() body: SetclidDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    const result = await this.bridge.setclid(body);
    return result.callerid ?? '';
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-api-key') headerKey: string,
    @Body() body: WebhookDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    const result = await this.bridge.webhook(body);
    return result.body ?? '';
  }

  @Post('http-request')
  @HttpCode(200)
  async httpRequest(
    @Headers('x-api-key') headerKey: string,
    @Body() body: HttpRequestDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    return this.bridge.httpRequest(body);
  }

  @Post('sendmailpeer')
  @HttpCode(200)
  async sendmailpeer(
    @Headers('x-api-key') headerKey: string,
    @Body() body: SendmailPeerDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    return this.bridge.sendmailpeer(body);
  }

  @Post('telegram')
  @HttpCode(200)
  async telegram(
    @Headers('x-api-key') headerKey: string,
    @Body() body: TelegramDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    return this.bridge.telegram(body);
  }

  @Post('tts')
  @HttpCode(200)
  async tts(
    @Headers('x-api-key') headerKey: string,
    @Body() body: TtsDialplanDto,
  ) {
    this.assertKey(headerKey || body.api_key);
    const result = await this.bridge.tts(body);
    return result.file ?? '';
  }

  private assertKey(provided?: string): void {
    if (!timingSafeApiKeyEqual(this.apiKey, provided)) {
      this.logger.warn('Unauthorized internal dialplan request');
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
