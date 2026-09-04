import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { IsInt } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { AgentUsageService } from './agent-usage.service';

class UpdateDefaultModelDto {
  @IsInt()
  providerUid: number;
}

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

  @ApiOperation({ summary: 'Per-tenant proposal funnel (platform admin)' })
  @Get('funnel')
  async getFunnel(@Query('from') from: string, @Query('to') to: string) {
    return this.usage.queryProposalFunnel(new Date(from), new Date(to));
  }

  @ApiOperation({ summary: 'Per-tenant tool invocation counts (platform admin)' })
  @Get('errors')
  async getErrors(@Query('from') from: string, @Query('to') to: string) {
    return this.usage.queryToolErrors(new Date(from), new Date(to));
  }

  @ApiOperation({ summary: 'Platform default LLM provider (D-07)' })
  @Get('default-model')
  async getDefaultModel() {
    return this.usage.getDefaultModel();
  }

  @ApiOperation({ summary: 'Save platform default LLM provider (D-07)' })
  @Put('default-model')
  async setDefaultModel(@Body() dto: UpdateDefaultModelDto) {
    return this.usage.setDefaultModel(dto.providerUid);
  }
}
