import { Controller, Get, Query, HttpCode, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PhonebooksService } from './phonebooks.service';

/**
 * Internal endpoint for Asterisk dialplan phonebook lookups.
 * Called via CURL() from Asterisk — no JWT auth, uses API key.
 *
 * Endpoint: GET /api/internal/dialplan/phonebook-lookup
 *
 * Asterisk dialplan usage:
 *   Set(PB_RAW=${CURL(http://127.0.0.1:5010/api/internal/dialplan/phonebook-lookup
 *     ?number=${URIENCODE(${CALLERID(num)})}&phonebook_uid=5&api_key=xxx)})
 *
 * Response: plain text, pipe-delimited
 *   Match:   "1|key1|val1|key2|val2|..."
 *   No match: "0"
 */
@Controller('internal/dialplan')
export class PhonebookLookupController {
  private readonly logger = new Logger(PhonebookLookupController.name);
  private readonly apiKey: string;

  constructor(
    private readonly phonebooksService: PhonebooksService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Get('phonebook-lookup')
  @HttpCode(200)
  async lookup(
    @Query('number') number: string,
    @Query('phonebook_uid') phonebookUid: string,
    @Query('api_key') queryApiKey: string,
  ): Promise<string> {
    // Validate API key
    if (this.apiKey && queryApiKey !== this.apiKey) {
      this.logger.warn(`Unauthorized phonebook lookup attempt`);
      throw new UnauthorizedException('Invalid API key');
    }

    if (!number || !phonebookUid) {
      return '0';
    }

    const uid = parseInt(phonebookUid, 10);
    if (isNaN(uid)) return '0';

    return this.phonebooksService.lookupNumber(uid, number);
  }
}
