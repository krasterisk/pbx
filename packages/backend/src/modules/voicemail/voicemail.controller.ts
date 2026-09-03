import { Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoicemailService } from './voicemail.service';

@UseGuards(JwtAuthGuard)
@Controller('voicemail')
export class VoicemailController {
  constructor(private readonly service: VoicemailService) {}

  private viewer(req: { user?: { vpbx_user_uid: number; sub: number } }) {
    return {
      tenantId: req.user!.vpbx_user_uid,
      userId: req.user!.sub as number,
    };
  }

  @Get()
  list(@Req() req: { user?: { vpbx_user_uid: number } }, @Query() _query: Record<string, unknown>) {
    void _query;
    return this.service.list(req.user!.vpbx_user_uid);
  }

  @Get(':uniqueid/play')
  play(
    @Req() req: Request & { user?: { vpbx_user_uid: number; sub: number } },
    @Param('uniqueid') uniqueid: string,
    @Res() res: Response,
  ) {
    const { tenantId, userId } = this.viewer(req);
    return this.service.streamByUniqueid(tenantId, uniqueid, res, req, userId);
  }

  @Post(':uniqueid/retry-stt')
  retryStt(
    @Req() req: { user?: { vpbx_user_uid: number; sub: number } },
    @Param('uniqueid') uniqueid: string,
  ) {
    const { tenantId, userId } = this.viewer(req);
    return this.service.retryStt(tenantId, uniqueid, userId);
  }

  @Get(':uniqueid')
  getByUniqueid(
    @Req() req: { user?: { vpbx_user_uid: number; sub: number } },
    @Param('uniqueid') uniqueid: string,
  ) {
    const { tenantId, userId } = this.viewer(req);
    return this.service.findByUniqueid(tenantId, uniqueid, userId);
  }
}
