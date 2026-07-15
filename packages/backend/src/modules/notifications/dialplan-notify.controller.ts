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
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotifyDialplanDto } from './dto/notify-dialplan.dto';

/**
 * Internal endpoint for Asterisk dialplan multi-channel notifications (D-12).
 * Called via CURL() from dialplan — no JWT auth, uses DIALPLAN_API_KEY.
 *
 * Endpoint: POST /api/internal/dialplan/notify
 */
@Controller('internal/dialplan')
export class DialplanNotifyController {
  private readonly logger = new Logger(DialplanNotifyController.name);
  private readonly apiKey: string;

  constructor(
    private readonly dispatcher: NotificationDispatcherService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('notify')
  @HttpCode(200)
  async notify(
    @Headers('x-api-key') headerKey: string,
    @Body() body: NotifyDialplanDto & { api_key?: string },
  ) {
    const providedKey = headerKey || body.api_key;
    if (this.apiKey && providedKey !== this.apiKey) {
      this.logger.warn('Unauthorized dialplan notify attempt');
      throw new UnauthorizedException('Invalid API key');
    }

    this.dispatcher
      .dispatch(body)
      .catch((e) =>
        this.logger.error(`notify dispatch failed: ${e?.message ?? e}`),
      );
    return { accepted: true };
  }
}
