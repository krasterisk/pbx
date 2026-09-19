import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { SpeechAnalyticsService, assertUuid } from './speech-analytics.service';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller('v1/speech-analytics')
export class SpeechAnalyticsPublicController {
  constructor(private readonly analytics: SpeechAnalyticsService) {}

  private integration(request: Authed) {
    if (request.tenantContext.principalKind !== 'integration') {
      throw new ForbiddenException({ code: 'integration_key_required' });
    }
    return request.tenantContext;
  }

  @Get('capabilities')
  capabilities() {
    return this.analytics.capabilities();
  }

  @Post('uploads')
  @HttpCode(201)
  upload(@Req() request: Authed, @Body() body: { projectId: string; expectedBytes?: number }) {
    assertUuid(body.projectId);
    return this.analytics.allocateUpload(this.integration(request), body.projectId, body.expectedBytes);
  }

  @Put('uploads/:id/content')
  content(@Req() request: Authed, @Param('id') id: string, @Body() body: { bytesBase64: string }) {
    assertUuid(id);
    return this.analytics.putUploadContent(this.integration(request), id, Buffer.from(body.bytesBase64, 'base64'));
  }

  @Post('uploads/:id/complete')
  complete(@Req() request: Authed, @Param('id') id: string, @Body() body: { checksum?: string }) {
    assertUuid(id);
    return this.analytics.completeUpload(this.integration(request), id, body.checksum);
  }

  @Get('uploads/:id')
  getUpload(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getUpload(this.integration(request), id);
  }

  @Post('analysis-runs')
  @HttpCode(202)
  run(@Req() request: Authed, @Headers('idempotency-key') idempotencyKey: string, @Body() body: {
    projectId: string; assetId: string; externalCallId: string; sourcePart?: string;
    metadata?: Record<string, unknown>;
  }) {
    assertUuid(body.projectId);
    assertUuid(body.assetId);
    if (!body.externalCallId) {
      throw new ForbiddenException({ code: 'external_call_id_required' });
    }
    return this.analytics.createRun(this.integration(request), { ...body, idempotencyKey });
  }

  @Get('analysis-runs/:id')
  getRun(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(this.integration(request), id, 'analytics:read');
  }

  @Get('analysis-runs/:id/result')
  result(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(this.integration(request), id, 'analytics:read');
  }

  @Get('analysis-runs/:id/transcript')
  transcript(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(this.integration(request), id, 'analytics:transcript');
  }

  @Get('analysis-runs/:id/audio')
  audio(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getRun(this.integration(request), id, 'analytics:audio');
  }

  @Post('analysis-runs/:id/cancel')
  cancel(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.cancelRun(this.integration(request), id);
  }

  @Get('recordings')
  recordings(@Req() request: Authed, @Query('projectId') projectId: string) {
    assertUuid(projectId);
    return this.analytics.listRecordings(this.integration(request), projectId);
  }
}
