import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoicemailService } from './voicemail.service';

@UseGuards(JwtAuthGuard)
@Controller('voicemail')
export class VoicemailController {
  constructor(private readonly service: VoicemailService) {}

  @Get()
  list(@Req() req: { user?: { vpbx_user_uid: number } }, @Query() _query: Record<string, unknown>) {
    void _query;
    return this.service.list(req.user!.vpbx_user_uid);
  }
}
