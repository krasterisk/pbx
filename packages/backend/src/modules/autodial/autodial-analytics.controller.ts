import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialAnalyticsService } from './autodial-analytics.service';
import { AutodialReportSelectionService } from './autodial-report-selection.service';
@Controller('autodial/reports')
@RequiresModule('autodial')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AutodialAnalyticsController {
  constructor(private readonly analytics: AutodialAnalyticsService, private readonly selections: AutodialReportSelectionService) {}
  @Post('breakdown') breakdown(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.analytics.breakdown(req.user.vpbx_user_uid, body); }
  @Post('selection') selection(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.analytics.detail(req.user.vpbx_user_uid, body); }
  @Post('selection/preview') preview(@Req() req: { user: { vpbx_user_uid: number } }, @Body() body: unknown) { return this.selections.preview(req.user.vpbx_user_uid, body); }
  @Post('selection/base') createBase(@Req() req: { user: { vpbx_user_uid: number; level: number } }, @Body() body: unknown) {
    return this.selections.createBase(req.user.vpbx_user_uid, req.user.level, body);
  }
}
