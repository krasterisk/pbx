import { Controller, Get, Query } from '@nestjs/common';
import { AgentUsageService } from './agent-usage.service';

/**
 * Platform-administrator usage endpoints (D-07 / D-08). Guards land in GREEN.
 */
@Controller('ai-chat/usage')
export class AgentUsageController {
  constructor(private readonly usage: AgentUsageService) {}

  @Get()
  async getUsage(@Query('from') from: string, @Query('to') to: string) {
    return this.usage.queryTenantUsage(new Date(from), new Date(to));
  }
}
