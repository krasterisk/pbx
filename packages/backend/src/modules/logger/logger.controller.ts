import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserLevel } from '../users/user.model';

@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserLevel.ADMIN)
export class LoggerController {
  constructor(private readonly loggerService: LoggerService) {}

  /**
   * GET /api/audit-log
   * Tenant-scoped action log with filters and pagination.
   * Query: page, limit, action, entity_type, status, dateFrom, dateTo
   */
  @Get()
  async getLogs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.loggerService.getLogs(req.user.vpbx_user_uid, {
      page: page ? Number(page) : 1,
      limit: limit ? Math.min(Number(limit), 200) : 50,
      action: action || undefined,
      entity_type: entity_type || undefined,
      status: (status as 'success' | 'error') || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  /**
   * GET /api/audit-log/stats
   * Returns KPI: total, today, errors — for the current tenant.
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    return this.loggerService.getStats(req.user.vpbx_user_uid);
  }
}
