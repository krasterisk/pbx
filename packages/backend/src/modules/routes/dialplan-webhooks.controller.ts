import { Controller, Post, Body, Query, Get, HttpCode, Logger, UnauthorizedException, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DialplanWebhooksService } from './dialplan-webhooks.service';

/**
 * Internal endpoints for Asterisk dialplan webhook integration.
 * Called via CURL() from Asterisk dialplan — no JWT auth.
 * Uses shared API key (DIALPLAN_API_KEY env) for basic authentication.
 *
 * All endpoints live under /api/internal/dialplan/
 *
 * Asterisk dialplan usage examples:
 *
 *   Custom webhook (DIALTO):
 *     Set(__DIALTO=${CURL(http://127.0.0.1:5010/api/internal/dialplan/custom-webhook,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&user_uid=42)})
 *
 *   Before dial:
 *     Set(WH_BD_RESULT=${CURL(http://127.0.0.1:5010/api/internal/dialplan/before-dial,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&exten=${EXTEN}&user_uid=42)})
 *
 *   On answer (via [krsk-on-answer] subroutine):
 *     Set(CURL_OA=${CURL(http://127.0.0.1:5010/api/internal/dialplan/on-answer,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&member=${DIALEDPEERNUMBER}&source=dial&user_uid=42)})
 *
 *   On hangup (via [krsk-hangup-handler] subroutine):
 *     Set(CURL_HH=${CURL(http://127.0.0.1:5010/api/internal/dialplan/on-hangup,
 *       route_uid=${HH_ROUTE_UID}&uniqueid=${UNIQUEID}&clid=${CALLERID(num)}&duration=${CDR(billsec)}&disposition=${CDR(disposition)}&record_path=${CDR(record)}&user_uid=42)})
 */
@Controller('internal/dialplan')
export class DialplanWebhooksController {
  private readonly logger = new Logger(DialplanWebhooksController.name);
  private readonly apiKey: string;

  constructor(
    private readonly webhooksService: DialplanWebhooksService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('DIALPLAN_API_KEY') || '';
  }

  // ---------------------------------------------------------------------------
  // Custom webhook — synchronous, returns responsible extension (plain text)
  // Asterisk: Set(__DIALTO=${CURL(...)})
  // ---------------------------------------------------------------------------
  @Post('custom-webhook')
  @HttpCode(200)
  async customWebhook(
    @Headers('x-api-key') headerKey: string,
    @Body() body: Record<string, string>,
  ): Promise<string> {
    this.validateKey(headerKey || body.api_key);
    const { route_uid, uniqueid, clid, user_uid } = body;
    if (!route_uid || !user_uid) return '';

    return this.webhooksService.handleCustomWebhook({ route_uid, uniqueid, clid, user_uid });
  }

  // ---------------------------------------------------------------------------
  // Before dial — synchronous, CRM registers incoming call
  // ---------------------------------------------------------------------------
  @Post('before-dial')
  @HttpCode(200)
  async beforeDial(
    @Headers('x-api-key') headerKey: string,
    @Body() body: Record<string, string>,
  ): Promise<string> {
    this.validateKey(headerKey || body.api_key);
    const { route_uid, uniqueid, clid, exten, user_uid } = body;
    if (!route_uid || !user_uid) return 'ok';

    await this.webhooksService.handleBeforeDial({ route_uid, uniqueid, clid, exten: exten || '', user_uid });
    return 'ok';
  }

  // ---------------------------------------------------------------------------
  // On answer — Asterisk gets "ok" immediately, CRM delivery is async with retry
  // Called from [krsk-on-answer] subroutine (Dial U() option)
  // ---------------------------------------------------------------------------
  @Post('on-answer')
  @HttpCode(200)
  async onAnswer(
    @Headers('x-api-key') headerKey: string,
    @Body() body: Record<string, string>,
  ): Promise<string> {
    this.validateKey(headerKey || body.api_key);
    const { route_uid, uniqueid, clid, member, source, user_uid } = body;
    if (!route_uid || !user_uid) return 'ok';

    // Do not await — fire and forget, Asterisk must not be blocked
    void this.webhooksService.handleOnAnswer({ route_uid, uniqueid, clid, member: member || '', source: source || 'dial', user_uid });
    return 'ok';
  }

  // ---------------------------------------------------------------------------
  // On hangup — Asterisk gets "ok" immediately, delivery is async with retry
  // Called from [krsk-hangup-handler] — MP3 is guaranteed ready at this point
  // ---------------------------------------------------------------------------
  @Post('on-hangup')
  @HttpCode(200)
  async onHangup(
    @Headers('x-api-key') headerKey: string,
    @Body() body: Record<string, string>,
  ): Promise<string> {
    this.validateKey(headerKey || body.api_key);
    const { route_uid, uniqueid, clid, duration, disposition, record_path, user_uid } = body;
    if (!route_uid || !user_uid) return 'ok';

    void this.webhooksService.handleOnHangup({
      route_uid, uniqueid, clid,
      duration: duration || '0',
      disposition: disposition || 'UNKNOWN',
      record_path: record_path || '',
      user_uid,
    });
    return 'ok';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  private validateKey(provided?: string): void {
    if (this.apiKey && provided !== this.apiKey) {
      this.logger.warn('Unauthorized internal dialplan request');
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
