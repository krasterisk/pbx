import { BadRequestException, Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialAiPrivacyService } from './autodial-ai-privacy.service';

@Controller('autodial/ai-privacy')
@RequiresModule('autodial')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AutodialAiPrivacyController {
  constructor(private readonly privacy: AutodialAiPrivacyService) {}
  @Get() get(@Req() req: { user: { vpbx_user_uid: number } }) { return this.privacy.get(req.user.vpbx_user_uid); }
  @Put() set(@Req() req: { user: { vpbx_user_uid: number; sub: number; level: number } }, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || typeof (body as any).allow_personal_data !== 'boolean')
      throw new BadRequestException('allow_personal_data boolean required');
    return this.privacy.set(req.user.vpbx_user_uid, req.user.sub, req.user.level, (body as any).allow_personal_data);
  }
}
