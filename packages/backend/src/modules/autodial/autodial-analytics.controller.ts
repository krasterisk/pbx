import { Body, Controller, ForbiddenException, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialAnalyticsService } from './autodial-analytics.service';
import { AutodialReportSelectionService } from './autodial-report-selection.service';
import { AutodialUiCommandService } from './autodial-ui-command.service';
import { AutodialBasesService } from './autodial-bases.service';
@Controller('autodial/reports')
@RequiresModule('autodial')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AutodialAnalyticsController {
  constructor(private readonly analytics: AutodialAnalyticsService, private readonly selections: AutodialReportSelectionService,
    private readonly commands: AutodialUiCommandService, private readonly bases: AutodialBasesService) {}
  @Post('breakdown') breakdown(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.analytics.breakdown(req.user.vpbx_user_uid, body); }
  @Post('selection') selection(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.analytics.detail(req.user.vpbx_user_uid, body); }
  @Post('selection/preview') preview(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.selections.preview(req.user.vpbx_user_uid, body); }
  @Post('selection/base') async createBase(@Req() req: { user: { vpbx_user_uid: number; level: number; sub?: number } },
    @Body() body: unknown, @Headers('idempotency-key') key?: string) {
    if (![0, 1, 3].includes(req.user.level)) throw new ForbiddenException({ code: 'AC_WRITE_FORBIDDEN' });
    if (key !== undefined) {
      const uid = await this.commands.run(req.user.vpbx_user_uid, req.user.sub, key, 'create_base', body,
        (transaction) => this.selections.createBase(req.user.vpbx_user_uid, req.user.level, body, transaction));
      return this.bases.findOne(req.user.vpbx_user_uid, uid);
    }
    return this.selections.createBase(req.user.vpbx_user_uid, req.user.level, body);
  }
}
