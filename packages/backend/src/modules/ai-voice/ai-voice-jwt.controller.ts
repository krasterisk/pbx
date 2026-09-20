import {
  Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { AiVoiceService, assertUuid } from './ai-voice.service';
import { AiSipService } from './sip.service';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller(['ai-voice', 'v1/ai-voice'])
export class AiVoiceJwtController {
  constructor(
    private readonly voice: AiVoiceService,
    private readonly sip: AiSipService,
  ) {}

  @Get('capabilities')
  capabilities() {
    return this.voice.capabilities();
  }

  @Get('deployments')
  list(@Req() request: Authed) {
    return this.voice.listDeployments(request.tenantContext);
  }

  @Post('agents/:uid/publish')
  publish(@Req() request: Authed, @Param('uid') uid: string, @Body() body: { operationKey: string }) {
    return this.voice.publish(request.tenantContext, Number(uid), body.operationKey);
  }

  @Post('deployments')
  @HttpCode(201)
  create(@Req() request: Authed, @Body() body: {
    agentUid: number; kind: 'internal' | 'browser_test' | 'external_sip'; versionId?: string;
  }) {
    return this.voice.createDeployment(request.tenantContext, body);
  }

  @Put('deployments/:id/ready')
  ready(@Req() request: Authed, @Param('id') id: string, @Body() body: { ready: boolean }) {
    assertUuid(id);
    return this.voice.setReady(request.tenantContext, id, body.ready === true);
  }

  @Post('deployments/:id/browser-ticket')
  browserTicket(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.voice.browserTestTicket(request.tenantContext, id);
  }

  @Post('tickets')
  issue(@Req() request: Authed, @Body() body: {
    nodeId: string; channelUniqueid: string; deploymentId: string;
  }) {
    assertUuid(body.deploymentId);
    return this.voice.issueNodeTicket(request.tenantContext, body);
  }

  @Post('admissions')
  admit(@Req() request: Authed, @Headers('idempotency-key') _key: string, @Body() body: {
    ticketId: string; nodeId: string; channelUniqueid: string; deploymentId: string;
    ingressKind: 'native' | 'browser_test' | 'autodial'; ingressKey: string;
  }) {
    assertUuid(body.ticketId);
    assertUuid(body.deploymentId);
    return this.voice.admit(request.tenantContext, body);
  }

  @Get('sessions')
  sessions(@Req() request: Authed, @Query('deploymentId') deploymentId?: string) {
    if (deploymentId) assertUuid(deploymentId);
    return this.voice.listSessions(request.tenantContext, deploymentId);
  }

  @Get('sessions/:id')
  timeline(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.voice.sessionTimeline(request.tenantContext, id);
  }

  @Get('sip-connections')
  sipConnections(@Req() request: Authed) {
    return this.sip.listConnections(request.tenantContext);
  }

  @Post('sip-connections')
  createSip(@Req() request: Authed, @Body() body: { name: string; transport: 'udp' | 'tcp' | 'tls' }) {
    return this.sip.createConnection(request.tenantContext, body);
  }

  @Post('sip-connections/:id/secret')
  sipSecret(@Req() request: Authed, @Param('id') id: string) {
    assertUuid(id);
    return this.sip.showSecretOnce(request.tenantContext, id);
  }

  @Post('invocations')
  @HttpCode(202)
  invoke(@Req() request: Authed, @Headers('idempotency-key') _key: string, @Body() body: {
    deploymentId: string; externalCallId: string; destinationRef: string; payload?: unknown;
  }) {
    assertUuid(body.deploymentId);
    return this.sip.invoke(request.tenantContext, {
      ...body, payload: body.payload ?? body,
    });
  }

  @Post('drain')
  drain(@Req() request: Authed) {
    return this.voice.drainTenant(request.tenantContext);
  }
}
