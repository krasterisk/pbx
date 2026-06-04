import {
  Controller,
  Get,
  Query,
  HttpCode,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IvrsService } from './ivrs.service';
import { IvrTtsService } from './ivr-tts.service';
import { IvrTtsCacheService } from './ivr-tts-cache.service';
import { normalizeIvrPrompts } from './ivr-prompts.util';
import type { IIvrPhrase } from '@krasterisk/shared';

/**
 * Internal endpoints for Asterisk dialplan (CURL).
 * GET /api/internal/ivr/play-phrase
 */
@Controller('internal/ivr')
export class IvrsInternalController {
  private readonly logger = new Logger(IvrsInternalController.name);
  private readonly apiKey: string;

  constructor(
    private readonly ivrsService: IvrsService,
    private readonly ivrTtsService: IvrTtsService,
    private readonly ttsCache: IvrTtsCacheService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('DIALPLAN_API_KEY') || '';
  }

  @Get('play-phrase')
  @HttpCode(200)
  async playPhrase(
    @Query('ivr_uid') ivrUidStr: string,
    @Query('phrase_index') phraseIndexStr: string,
    @Query('vpbx_user_uid') vpbxUserUidStr: string,
    @Query('uniqueid') uniqueid: string,
    @Query('api_key') queryApiKey: string,
  ): Promise<string> {
    if (this.apiKey && queryApiKey !== this.apiKey) {
      this.logger.warn('Unauthorized IVR TTS play-phrase attempt');
      throw new UnauthorizedException('Invalid API key');
    }

    const ivrUid = parseInt(ivrUidStr, 10);
    const phraseIndex = parseInt(phraseIndexStr, 10);
    const vpbxUserUid = parseInt(vpbxUserUidStr, 10);

    if (!ivrUid || isNaN(phraseIndex) || !vpbxUserUid) {
      return '0';
    }

    try {
      const ivr = await this.ivrsService.findOne(ivrUid, vpbxUserUid);
      const phrases = normalizeIvrPrompts(ivr.prompts) as IIvrPhrase[];
      const phrase = phrases[phraseIndex];

      if (!phrase || phrase.kind !== 'tts') {
        this.logger.warn(`play-phrase: invalid phrase index ${phraseIndex} for ivr ${ivrUid}`);
        return '0';
      }

      const engine = await this.ivrTtsService.loadEngine(phrase.engine_uid, vpbxUserUid);
      const wav = await this.ivrTtsService.synthesizeToBuffer(engine, phrase.text, phrase.settings);

      const cacheKey = IvrTtsCacheService.buildCacheKey({
        ivrUid,
        phraseIndex,
        text: phrase.text,
        engine_uid: phrase.engine_uid,
        settings: phrase.settings,
        uniqueid: uniqueid || '',
      });

      const filePath = this.ttsCache.writeWav(vpbxUserUid, cacheKey, wav);
      return filePath;
    } catch (err: any) {
      this.logger.error(`play-phrase failed: ${err.message}`);
      return '0';
    }
  }
}
