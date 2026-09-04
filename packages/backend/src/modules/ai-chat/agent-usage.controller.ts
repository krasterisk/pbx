import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { AgentUsageService } from './agent-usage.service';

/**
 * Platform-administrator usage endpoints (D-07 / D-08).
 * A tenant-role caller is rejected by SuperAdminGuard on every route.
 */
@ApiTags('AI Chat Usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('ai-chat/usage')
export class AgentUsageController {
  constructor(private readonly usage: AgentUsageService) {}

  @ApiOperation({ summary: 'Per-tenant token totals and spend (platform admin)' })
  @Get()
  async getUsage(@Query('from') from: string, @Query('to') to: string) {
    return this.usage.queryTenantUsage(new Date(from), new Date(to));
  }
}
