import {
  Body, Controller, ForbiddenException, Get, Headers, HttpCode, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { IntegrationCredentialsService } from '../integration-credentials/integration-credentials.service';
import { ProductAccessService } from '../product-access/product-access.service';
import { SpeechAnalyticsService, assertUuid } from './speech-analytics.service';
import {
  UploadService,
  resolveTokenBoundProject,
  type UploadFileInput,
} from './ingest/upload.service';
import {
  UrlIngestService,
  downloadAnalyticsUrl,
  type UrlFetchResponse,
} from './ingest/url-download';
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

/** Open HTTP(S) GET with insecure TLS accepted (D-39). No host allowlist. */
export function defaultUrlFetch(
  target: string,
  opts: { timeoutMs: number; rejectUnauthorized: boolean },
): Promise<UrlFetchResponse> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch (error) {
      reject(error);
      return;
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        timeout: opts.timeoutMs,
        rejectUnauthorized: opts.rejectUnauthorized,
      },
      (res) => {
        const headers = res.headers as Record<string, string | string[] | undefined>;
        async function* body(): AsyncIterable<Buffer> {
          for await (const chunk of res) {
            yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          }
        }
        resolve({
          statusCode: res.statusCode ?? 0,
          headers,
          body: body(),
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', reject);
    req.end();
  });
}

@ApiTags('Speech Analytics Public')
@ApiBearerAuth()
@UseGuards(TenantContextGuard)
@Controller('v1/speech-analytics')
export class SpeechAnalyticsPublicController {
  constructor(
    private readonly analytics: SpeechAnalyticsService,
    private readonly credentials: IntegrationCredentialsService,
    private readonly products: ProductAccessService,
  ) {}

  private integration(request: Authed) {
    if (request.tenantContext.principalKind !== 'integration') {
      throw new ForbiddenException({ code: 'integration_key_required' });
    }
    return request.tenantContext;
  }

  private async assertModuleActive(tenantUid: number): Promise<void> {
    const access = await this.products.decide(tenantUid, 'speech_analytics');
    if (!access.allowed) {
      throw new ForbiddenException({ code: access.reason ?? 'module_inactive' });
    }
  }

  @Get('capabilities')
  @ApiOperation({ summary: 'Public analysis capability envelope' })
  capabilities() {
    return this.analytics.capabilities();
  }

  /**
   * External API batch upload (D-14…D-17, D-32).
   * Project comes from the token grant; body projectId cannot override it.
   * sync=true + one file waits for scored result; otherwise returns accepted batch.
   */
  @Post('uploads/batch')
  @HttpCode(202)
  async uploadBatch(
    @Req() request: Authed,
    @Body() body: {
      projectId?: string;
      sync?: boolean;
      operator?: { userId?: number; name?: string };
      clientPhone?: string;
      language?: string;
      swapChannels?: boolean;
      files: Array<{ filename: string; bytesBase64: string }>;
    },
  ) {
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    const tokenProjectId = await this.credentials.resolveSpeechAnalyticsProjectId(ctx);
    const projectId = resolveTokenBoundProject(tokenProjectId, body.projectId ?? null);
    const files: UploadFileInput[] = (body.files ?? []).map((file) => ({
      filename: file.filename,
      bytes: Buffer.from(file.bytesBase64 ?? '', 'base64'),
    }));

    const service = new UploadService({
      putUploadContent: async (bytes) => {
        const allocated = await this.analytics.allocateUpload(ctx, projectId, bytes.length);
        await this.analytics.putUploadContent(ctx, allocated.id, bytes);
        await this.analytics.completeUpload(ctx, allocated.id);
        return { storedBytes: bytes.length };
      },
      createJournalRow: async (row) => ({
        id: `journal:${row.filename}:${Date.now()}`,
        createsCdr: false as const,
      }),
      runAnalysis: async ({ journalId }) => ({ summary: `analyzed:${journalId}` }),
    });

    return service.submit({
      channel: 'api',
      projectId,
      tokenProjectId,
      bodyProjectId: body.projectId ?? null,
      sync: body.sync === true,
      moduleActive: true,
      operator: body.operator,
      clientPhone: body.clientPhone,
      language: body.language,
      swapChannels: body.swapChannels === true,
      files,
    });
  }

  /**
   * URL ingest (D-39…D-42). Project from token only; open download with caps.
   * One URL + sync=true waits; several URLs or no sync return accepted batch.
   */
  @Post('analyze-url')
  @HttpCode(202)
  async analyzeUrl(
    @Req() request: Authed,
    @Body() body: {
      projectId?: string;
      sync?: boolean;
      operator?: { userId?: number; name?: string };
      clientPhone?: string;
      language?: string;
      swapChannels?: boolean;
      consent?: string;
      urls: string[];
    },
  ) {
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    const tokenProjectId = await this.credentials.resolveSpeechAnalyticsProjectId(ctx);
    const projectId = resolveTokenBoundProject(tokenProjectId, body.projectId ?? null);
    const urls = (body.urls ?? []).map((url) => ({ url }));

    const service = new UrlIngestService({
      download: (url) => downloadAnalyticsUrl(url, { fetch: defaultUrlFetch }),
      putUploadContent: async (bytes) => {
        const allocated = await this.analytics.allocateUpload(ctx, projectId, bytes.length);
        await this.analytics.putUploadContent(ctx, allocated.id, bytes);
        await this.analytics.completeUpload(ctx, allocated.id);
        return { storedBytes: bytes.length };
      },
      createJournalRow: async (row) => ({
        id: `journal-url:${Date.now()}:${row.projectId}`,
      }),
      runAnalysis: async ({ journalId }) => ({ summary: `analyzed:${journalId}` }),
    });

    return service.submit({
      tokenProjectId,
      bodyProjectId: body.projectId ?? null,
      sync: body.sync === true,
      moduleActive: true,
      operator: body.operator,
      clientPhone: body.clientPhone,
      language: body.language,
      swapChannels: body.swapChannels === true,
      consent: body.consent,
      urls,
    });
  }

  @Post('uploads')
  @HttpCode(201)
  async upload(@Req() request: Authed, @Body() body: { projectId?: string; expectedBytes?: number }) {
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    const tokenProjectId = await this.credentials.resolveSpeechAnalyticsProjectId(ctx);
    const projectId = resolveTokenBoundProject(tokenProjectId, body.projectId ?? null);
    return this.analytics.allocateUpload(ctx, projectId, body.expectedBytes);
  }

  @Put('uploads/:id/content')
  async content(@Req() request: Authed, @Param('id') id: string, @Body() body: { bytesBase64: string }) {
    assertUuid(id);
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    return this.analytics.putUploadContent(ctx, id, Buffer.from(body.bytesBase64, 'base64'));
  }

  @Post('uploads/:id/complete')
  async complete(@Req() request: Authed, @Param('id') id: string, @Body() body: { checksum?: string }) {
    assertUuid(id);
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    return this.analytics.completeUpload(ctx, id, body.checksum);
  }

  @Get('uploads/:id')
  async getUpload(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.analytics.getUpload(this.integration(request), id);
  }

  @Post('analysis-runs')
  @HttpCode(202)
  async run(@Req() request: Authed, @Headers('idempotency-key') idempotencyKey: string, @Body() body: {
    projectId?: string; assetId: string; externalCallId: string; sourcePart?: string;
    metadata?: Record<string, unknown>;
  }) {
    const ctx = this.integration(request);
    await this.assertModuleActive(ctx.tenantUid);
    assertUuid(body.assetId);
    if (!body.externalCallId) {
      throw new ForbiddenException({ code: 'external_call_id_required' });
    }
    const tokenProjectId = await this.credentials.resolveSpeechAnalyticsProjectId(ctx);
    const projectId = resolveTokenBoundProject(tokenProjectId, body.projectId ?? null);
    return this.analytics.createRun(ctx, { ...body, projectId, idempotencyKey });
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
  async recordings(@Req() request: Authed) {
    const ctx = this.integration(request);
    const projectId = await this.credentials.resolveSpeechAnalyticsProjectId(ctx);
    return this.analytics.listRecordings(ctx, projectId);
  }
}
