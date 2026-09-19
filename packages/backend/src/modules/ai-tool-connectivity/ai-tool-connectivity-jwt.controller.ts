import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { AiToolConnectivityService } from './ai-tool-connectivity.service';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller('ai-tools')
export class AiToolConnectivityJwtController {
  constructor(private readonly tools: AiToolConnectivityService) {}

  @Get()
  list(@Req() request: Authed) {
    return this.tools.list(request.tenantContext);
  }

  @Post()
  create(@Req() request: Authed, @Body() body: { name: string; kind: string; destination: string }) {
    return this.tools.create(request.tenantContext, body);
  }

  @Post('probe')
  probe(@Body() body: { simulated?: boolean }) {
    return this.tools.probe(body.simulated !== false);
  }
}
