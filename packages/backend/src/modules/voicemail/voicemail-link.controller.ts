import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { VoicemailLinkGuard } from './voicemail-link.guard';
import { VoicemailService } from './voicemail.service';

/**
 * Token-only play route (D-59). No JwtAuthGuard — VoicemailLinkGuard is the sole auth.
 * Do not route through cdr-public.controller.
 */
@UseGuards(VoicemailLinkGuard)
@Controller('voicemail')
export class VoicemailLinkController {
  constructor(private readonly service: VoicemailService) {}

  @Get('play')
  play(
    @Req() req: Request & { user?: { vpbx_user_uid: number } },
    @Res() res: Response,
    @Query('token') token: string,
  ) {
    return this.service.streamByPlayToken(token, req.user!.vpbx_user_uid, req, res);
  }
}
