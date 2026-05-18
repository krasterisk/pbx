import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CdrService } from './cdr.service';

/**
 * Public CDR recording stream for standalone v3 iframe (no JWT).
 * Tenant: DEFAULT_VPBX_USER_UID from env (same as other public/* controllers).
 */
@Controller('public/reports/cdr')
export class CdrPublicController {
  private readonly vpbxUserUid: number;

  constructor(
    private readonly cdrService: CdrService,
    configService: ConfigService,
  ) {
    this.vpbxUserUid = Number(configService.get('DEFAULT_VPBX_USER_UID', '0'));
  }

  @Get('recording/:uniqueid')
  @Header('Content-Type', 'text/html; charset=utf-8')
  playRecordingPage(@Param('uniqueid') uniqueid: string, @Res() res: Response) {
    const streamSrc = this.cdrService.recordingPlayStreamPath(uniqueid, 'public');
    res.send(this.cdrService.renderRecordingPlayerHtml(streamSrc));
  }

  @Get('recording/:uniqueid/play')
  playRecording(@Param('uniqueid') uniqueid: string, @Res() res: Response) {
    return this.cdrService.streamRecording(this.vpbxUserUid, uniqueid, res);
  }
}
