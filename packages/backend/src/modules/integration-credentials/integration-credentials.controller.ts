import {
  Body, Controller, Get, Header, HttpCode, HttpStatus, Param,
  Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IntegrationCredentialsService } from './integration-credentials.service';
import { IntegrationKeyRateLimiter } from './integration-key-rate-limiter';
import { TenantContextGuard, type TenantContextRequest } from './tenant-context.guard';
import {
  CreateIntegrationBody, IntegrationListQuery, ReplaceIntegrationGrantsBody,
  RotateIntegrationBody,
} from './integration-credentials.dto';

type AuthenticatedRequest = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@ApiTags('AI Integrations')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'Invalid request or client-supplied tenant context' })
@ApiResponse({ status: 401, description: 'Missing, malformed, expired or revoked credential' })
@ApiResponse({ status: 403, description: 'Tenant admin or product permission required' })
@ApiResponse({ status: 404, description: 'Principal or tenant-bound resource not found' })
@ApiResponse({ status: 429, description: 'Integration key authentication rate limited' })
@ApiResponse({ status: 503, description: 'Credential authentication temporarily unavailable' })
@UseGuards(TenantContextGuard)
@Controller('v1/integrations')
export class IntegrationCredentialsController {
  constructor(
    private readonly credentials: IntegrationCredentialsService,
    private readonly limiter: IntegrationKeyRateLimiter,
  ) {}

  @Get('self/capabilities')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Integration key capabilities for its own principal' })
  @ApiResponse({ status: 200, description: 'Sanitized grants and readiness state' })
  @ApiResponse({ status: 403, description: 'Integration key required' })
  self(@Req() request: AuthenticatedRequest) {
    return this.credentials.selfCapabilities(request.tenantContext);
  }

  @Get()
  @ApiOperation({ summary: 'List tenant integration principals (tenant admin)' })
  @ApiResponse({ status: 200, description: 'Cursor page of safe principal metadata' })
  async list(@Req() request: AuthenticatedRequest, @Query() query: IntegrationListQuery) {
    await this.limiter.consumeManagement(request.tenantContext);
    return this.credentials.list(request.tenantContext, query.limit ?? 50, query.cursor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Create tenant integration key; token shown once' })
  @ApiResponse({ status: 201, description: 'New one-time token or token:null on replay' })
  @ApiResponse({ status: 409, description: 'Operation ID conflict' })
  async create(@Req() request: AuthenticatedRequest, @Body() body: CreateIntegrationBody) {
    await this.limiter.consumeManagement(request.tenantContext);
    return this.credentials.create(request.tenantContext, {
      label: body.label, product: body.product, operationId: body.operationId,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
  }

  @Put(':id/grants')
  @ApiOperation({ summary: 'Replace grants with expected permission revision' })
  @ApiResponse({ status: 200, description: 'New permission revision' })
  @ApiResponse({ status: 409, description: 'Stale permission revision' })
  async grants(@Req() request: AuthenticatedRequest, @Param('id') id: string,
    @Body() body: ReplaceIntegrationGrantsBody) {
    await this.limiter.consumeManagement(request.tenantContext);
    const permissionRevision = await this.credentials.replaceGrants(
      request.tenantContext, id, body.expectedRevision, body.grants,
    );
    return { permissionRevision };
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Rotate key without overlap; token shown once' })
  @ApiResponse({ status: 201, description: 'New one-time token or token:null on replay' })
  @ApiResponse({ status: 409, description: 'Stale generation or operation conflict' })
  async rotate(@Req() request: AuthenticatedRequest, @Param('id') id: string,
    @Body() body: RotateIntegrationBody) {
    await this.limiter.consumeManagement(request.tenantContext);
    return this.credentials.rotate(request.tenantContext, id,
      body.expectedGeneration, body.operationId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable all credentials for a principal' })
  @ApiResponse({ status: 204, description: 'Disabled or already disabled' })
  async revoke(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    await this.limiter.consumeManagement(request.tenantContext);
    await this.credentials.disable(request.tenantContext, id);
  }
}
