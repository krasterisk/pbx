import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialReportsService, type AutodialReportRange } from './autodial-reports.service';
import { AutodialExportAuthGuard } from './autodial-export-auth.guard';

type AuthedRequest = Request & { user: { vpbx_user_uid: number } };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('autodial')
@Controller('autodial')
export class AutodialReportsController {
  constructor(private readonly reports: AutodialReportsService) {}

  @Get('monitor')
  monitor(@Req() req: AuthedRequest) {
    return this.reports.liveStats(req.user.vpbx_user_uid);
  }

  @Get('reports/summary')
  summary(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('campaigns') campaigns?: string,
  ) {
    return this.reports.summary(req.user.vpbx_user_uid, this.range(from, to, campaigns));
  }

  @Get('reports/context')
  async context(@Req() req: AuthedRequest) {
    return { timezone: await this.reports.reportingTimezone(req.user.vpbx_user_uid), detail_limit: 50000,
      definitions_version: 'autodial-supervisor-1', client_fields_source: 'current_card', identity_verification: 'not_collected' };
  }

  @Get('reports/daily')
  daily(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('campaigns') campaigns?: string,
  ) {
    return this.reports.daily(req.user.vpbx_user_uid, this.range(from, to, campaigns));
  }

  @Get('reports/detail')
  detail(
    @Req() req: AuthedRequest,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('campaigns') campaigns?: string,
  ) {
    return this.reports.detail(req.user.vpbx_user_uid, this.range(from, to, campaigns));
  }

  @Get('reports/export')
  @UseGuards(AutodialExportAuthGuard)
  async export(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('kind') kind: string,
    @Query('format') format: string,
    @Query('campaigns') campaigns?: string,
  ): Promise<void> {
    const range = this.range(from, to, campaigns);
    const fmt = format === 'xlsx' ? 'xlsx' : 'csv';
    const result =
      kind === 'detail'
        ? await this.reports.exportDetail(req.user.vpbx_user_uid, range, fmt)
        : await this.reports.exportSummary(req.user.vpbx_user_uid, range, fmt);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.body);
  }

  private range(from: string, to: string, campaigns?: string): AutodialReportRange {
    if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
      throw new BadRequestException({
        code: 'AC_REPORT_RANGE',
        message: 'from/to must be YYYY-MM-DD',
      });
    }
    if (from > to) {
      throw new BadRequestException({
        code: 'AC_REPORT_RANGE',
        message: 'from must not be later than to',
      });
    }
    const campaignUids = (campaigns ?? '')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    return { from, to, campaignUids: campaignUids.length ? campaignUids : undefined };
  }
}
