import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { ProductResourceAuthorization } from '../integration-credentials/product-resource.authorization';
import { assertSafeWebhookUrl } from './webhook-security';
import { AiWebhookEndpoint } from './webhook.models';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller('speech-analytics/webhooks')
export class IntegrationDeliveryController {
  constructor(
    @InjectModel(AiWebhookEndpoint) private readonly endpoints: typeof AiWebhookEndpoint,
    private readonly resources: ProductResourceAuthorization,
  ) {}

  @Get()
  async list(@Req() request: Authed) {
    if (request.tenantContext.principalKind !== 'user') {
      throw new ForbiddenException({ code: 'tenant_admin_required' });
    }
    return this.endpoints.findAll({
      where: { tenant_uid: request.tenantContext.tenantUid },
      attributes: ['id', 'project_id', 'destination_url', 'status', 'key_version', 'revision'],
    });
  }

  @Post()
  async create(@Req() request: Authed, @Body() body: { projectId: string; url: string }) {
    if (request.tenantContext.principalKind !== 'user') {
      throw new ForbiddenException({ code: 'tenant_admin_required' });
    }
    await this.resources.authorize(request.tenantContext, {
      product: 'speech_analytics', action: 'grant', resourceKind: 'project', resourceId: body.projectId,
    });
    assertSafeWebhookUrl(body.url);
    const now = new Date();
    return this.endpoints.create({
      id: randomUUID(), tenant_uid: request.tenantContext.tenantUid,
      principal_id: request.tenantContext.principalId, project_id: body.projectId,
      destination_url: body.url, secret_ref: `secret:${randomUUID()}`, key_version: 1,
      previous_secret_ref: null, status: 'active', revision: 1, created_at: now, updated_at: now,
    });
  }

  @Put(':id/revoke')
  async revoke(@Req() request: Authed, @Param('id') id: string) {
    if (request.tenantContext.principalKind !== 'user') {
      throw new ForbiddenException({ code: 'tenant_admin_required' });
    }
    const endpoint = await this.endpoints.findOne({
      where: { tenant_uid: request.tenantContext.tenantUid, id },
    });
    if (!endpoint) return { status: 'revoked' };
    endpoint.status = 'revoked';
    endpoint.updated_at = new Date();
    await endpoint.save();
    return { status: 'revoked' };
  }
}
