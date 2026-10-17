/**
 * Call Center reports REST API (D-33 / D-34 backend).
 *
 * Supervisor-gated. Tenant from JWT (`req.user.vpbx_user_uid`), never query/body.
 * PDF export is client-side (07-18) — format=pdf → 400.
 */
import {
  BadRequestException,
  Controller,
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
import { ExportReportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { isCcReportId } from './callcenter-reports.types';
import { buildReportCsv } from './exporters/csv-exporter';
import { buildReportXlsx } from './exporters/xlsx-exporter';
import { assertSupervisor } from '../callcenter-rbac.util';
import { CallCenterAccessListService } from '../callcenter-access-list.service';
import { UserLevel } from '../../users/user.model';
import type { ReportAccess, ReportQuery } from './callcenter-reports.types';

type ReportUser = { level: number; sub: number; vpbx_user_uid: number };

@UseGuards(JwtAuthGuard)
@Controller('callcenter/reports')
export class CallCenterReportsController {
  constructor(
    private readonly reportsService: CallCenterReportsService,
    private readonly accessList: CallCenterAccessListService,
  ) {}

  /** ADMIN sees the tenant. A supervisor is limited to the access list (empty list = everyone). */
  private async scopeQuery(user: ReportUser, query: ReportQuery): Promise<ReportQuery> {
    if (user.level === UserLevel.SUPERADMIN || user.level === UserLevel.ADMIN) return query;
    const scope = await this.accessList.resolveScope(user.vpbx_user_uid, user.sub);
    const access: ReportAccess = {
      operatorUserIds: scope.operators ? [...scope.operators] : null,
      queues: scope.queues ? [...scope.queues] : null,
    };
    return { ...query, access };
  }

  @Get(':reportId')
  async getReport(
    @Req() req: Request & { user: ReportUser },
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
  ) {
    assertSupervisor(req.user);
    if (!isCcReportId(reportId)) {
      throw new BadRequestException(`Unknown reportId "${reportId}"`);
    }
    return this.reportsService.runReport(reportId, req.user.vpbx_user_uid, await this.scopeQuery(req.user, query));
  }

  @Get(':reportId/export')
  async exportReport(
    @Req() req: Request & { user: ReportUser },
    @Param('reportId') reportId: string,
    @Query() query: ExportReportQueryDto,
    @Res() res: Response,
  ) {
    assertSupervisor(req.user);
    if (!isCcReportId(reportId)) {
      throw new BadRequestException(`Unknown reportId "${reportId}"`);
    }
    const fmt = query.format;
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
      await this.scopeQuery(req.user, query),
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
      const body = buildReportCsv(result.columns, exportRows, result.timezone);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${baseName}.csv"`,
      );
      return res.send(body);
    }

    const buffer = await buildReportXlsx(reportId, result.columns, exportRows, result.timezone);
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
