import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import {
  TenantContextGuard, type TenantContextRequest,
} from '../integration-credentials/tenant-context.guard';
import { StandaloneCapabilitiesService } from './standalone-capabilities.service';

type AuthenticatedRequest = TenantContextRequest & {
  tenantContext: NonNullable<TenantContextRequest['tenantContext']>;
};

@Controller('v1/identity')
@UseGuards(TenantContextGuard)
export class StandaloneCapabilitiesController {
  constructor(private readonly capabilities: StandaloneCapabilitiesService) {}

  @Get('self')
  @Header('Cache-Control', 'no-store')
  self(@Req() request: AuthenticatedRequest) {
    const { tenantUid, principalKind, principalId } = request.tenantContext;
    return { tenantUid, principalKind, principalId };
  }

  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  capabilitiesFor(@Req() request: AuthenticatedRequest) {
    return this.capabilities.forContext(request.tenantContext);
  }
}
