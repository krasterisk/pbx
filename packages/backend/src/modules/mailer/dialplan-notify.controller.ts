import { Controller, Post, Body, HttpCode, Logger, UnauthorizedException, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService, SendNotificationDto } from './mailer.service';

/**
 * Internal endpoint for Asterisk dialplan notifications.
 * Called via CURL() from Asterisk dialplan — no JWT auth,
 * uses a shared API key for internal authentication.
 *
 * Endpoint: POST /api/internal/dialplan/sendmail
 *
 * Asterisk dialplan usage:
 *   Set(MAIL_RESULT=${CURL(http://127.0.0.1:5010/api/internal/dialplan/sendmail,
 *     to=email&subject=Subj&text=Body&callerid=${CALLERID(num)}&exten=${EXTEN}&uniqueid=${UNIQUEID})})
 */
@Controller('internal/dialplan')
export class DialplanNotifyController {
  private readonly logger = new Logger(DialplanNotifyController.name);
  private readonly apiKey: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Post('sendmail')
  @HttpCode(200)
  async sendMail(
    @Headers('x-api-key') headerKey: string,
    @Body() body: SendNotificationDto & { api_key?: string },
  ) {
    // Validate internal API key (from header or POST body)
    const providedKey = headerKey || body.api_key;
    if (this.apiKey && providedKey !== this.apiKey) {
      this.logger.warn(`Unauthorized dialplan sendmail attempt`);
      throw new UnauthorizedException('Invalid API key');
    }

    if (!body.to) {
      return { success: false, error: 'Missing "to" field' };
    }

    this.logger.log(`📨 Dialplan sendmail request: to=${body.to}, subject=${body.subject || '(default)'}`);

    // Remove api_key before passing to mailer
    const { api_key: _, ...mailDto } = body;
    return this.mailerService.sendNotification(mailDto);
  }
}
