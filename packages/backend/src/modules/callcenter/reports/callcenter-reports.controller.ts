/**
 * Call Center reports REST API (D-33 / D-34 backend).
 *
 * Supervisor-gated. Tenant from JWT (`req.user.vpbx_user_uid`), never query/body.
 * PDF export is client-side (07-18) — format=pdf → 400.
 */
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CallCenterReportsService } from './callcenter-reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { isCcReportId } from './callcenter-reports.types';
import { buildReportCsv } from './exporters/csv-exporter';
import { buildReportXlsx } from './exporters/xlsx-exporter';

const SUPERVISOR_LEVEL = 3;

function assertSupervisor(user: { level: number }): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter/reports')
export class CallCenterReportsController {
  constructor(private readonly reportsService: CallCenterReportsService) {}

  @Get(':reportId')
  async getReport(
    @Req() req: Request & { user: { level: number; vpbx_user_uid: number } },
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
  ) {
    assertSupervisor(req.user);
    if (!isCcReportId(reportId)) {
      throw new BadRequestException(`Unknown reportId "${reportId}"`);
    }
    return this.reportsService.runReport(reportId, req.user.vpbx_user_uid, query);
  }

  @Get(':reportId/export')
  async exportReport(
    @Req() req: Request & { user: { level: number; vpbx_user_uid: number } },
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
    @Query('format') format: string,
    @Res() res: Response,
  ) {
    assertSupervisor(req.user);
    if (!isCcReportId(reportId)) {
      throw new BadRequestException(`Unknown reportId "${reportId}"`);
    }
    const fmt = (format || '').toLowerCase();
    if (fmt === 'pdf') {
      throw new BadRequestException(
        'PDF генерируется на клиенте (07-18). Используйте format=csv или format=xlsx.',
      );
    }
    if (fmt !== 'csv' && fmt !== 'xlsx') {
      throw new BadRequestException('format must be csv or xlsx');
    }

    const result = await this.reportsService.runReport(
      reportId,
      req.user.vpbx_user_uid,
      query,
    );
    const dateStamp = new Date().toISOString().slice(0, 10);
    const baseName = `cc_${reportId}_${dateStamp}`;

    // Flatten nested segment rows for export (agent-timeline)
    const exportRows = result.rows.map((row) => {
      if (
        row &&
        typeof row === 'object' &&
        'segments' in row &&
        Array.isArray((row as { segments: unknown }).segments)
      ) {
        const r = row as { agentInterface?: string; segments: unknown[] };
        return {
          agentInterface: r.agentInterface ?? '',
          segments: r.segments,
        };
      }
      return row as Record<string, unknown>;
    });

    if (fmt === 'csv') {
      const body = buildReportCsv(result.columns, exportRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${baseName}.csv"`,
      );
      return res.send(body);
    }

    const buffer = await buildReportXlsx(reportId, result.columns, exportRows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseName}.xlsx"`,
    );
    return res.send(buffer);
  }
}
