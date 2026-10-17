import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutodialApiScope, AutodialIntegrationKeyGuard } from '../autodial-integration/autodial-integration-key.guard';
import type { AutodialKeyActor } from '../autodial-integration/autodial-integration-key.service';
import { AutodialCrmService, autodialCrmBulkSchema, autodialCrmDncSchema, autodialCrmImportSchema } from './autodial-crm.service';
import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialWebhooksService } from './autodial-webhooks.service';

@ApiTags('Autodial CRM')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Invalid, expired or revoked key; issuer/module access is checked on every request.' })
@ApiResponse({ status: 403, description: 'Required autodial scope is missing.' })
@ApiResponse({ status: 429, description: '60 requests/minute per key. Retry in the next minute.' })
@ApiResponse({ status: 409, description: 'Revision conflict or reused Idempotency-Key with different content.' })
@Controller('autodial/api/v1')
@UseGuards(AutodialIntegrationKeyGuard)
export class AutodialCrmController {
  constructor(private readonly crm: AutodialCrmService, private readonly bases: AutodialBasesService, private readonly webhooks: AutodialWebhooksService) {}
  @Get('bases') @AutodialApiScope('autodial:read')
  @ApiOperation({ summary: 'List owned customer bases and their field schema' })
  listBases(@Req() req: { user: AutodialKeyActor }) { return this.bases.findAll(req.user.vpbx_user_uid); }
  @Get('bases/:baseUid/contacts') @AutodialApiScope('autodial:read')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'page_size', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  contacts(@Req() req: { user: AutodialKeyActor }, @Param('baseUid', ParseIntPipe) baseUid: number,
    @Query('page') page?: string, @Query('page_size') pageSize?: string, @Query('q') q?: string) {
    return this.bases.listContacts(req.user.vpbx_user_uid, baseUid, { page: Number(page ?? 1), pageSize: Number(pageSize ?? 50), q });
  }
  @Post('bases/:baseUid/contacts/bulk') @AutodialApiScope('autodial:contacts:write')
  @ApiOperation({ summary: 'Atomically upsert up to 100 customers by external_id; no calls or tasks are created' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: z.toJSONSchema(autodialCrmBulkSchema, { target: 'openapi-3.0' }) as SchemaObject })
  bulk(@Req() req: { user: AutodialKeyActor }, @Param('baseUid', ParseIntPipe) baseUid: number,
    @Headers('idempotency-key') key: string, @Body() body: unknown) { return this.crm.upsert(req.user, baseUid, key, body); }
  @Post('bases/:baseUid/imports') @HttpCode(202) @AutodialApiScope('autodial:imports:write')
  @ApiOperation({ summary: 'Queue a durable CSV/XLSX append import; replace is not accepted' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ schema: z.toJSONSchema(autodialCrmImportSchema, { target: 'openapi-3.0' }) as SchemaObject })
  enqueue(@Req() req: { user: AutodialKeyActor }, @Param('baseUid', ParseIntPipe) baseUid: number,
    @Headers('idempotency-key') key: string, @Body() body: unknown) { return this.crm.enqueueImport(req.user, baseUid, key, body); }
  @Get('imports/:uid') @AutodialApiScope('autodial:read')
  @ApiOperation({ summary: 'Read an import job belonging to this API key; payload is never returned' })
  job(@Req() req: { user: AutodialKeyActor }, @Param('uid') uid: string) { return this.crm.job(req.user, uid); }
  @Get('bases/:baseUid/results') @AutodialApiScope('autodial:read')
  @ApiOperation({ summary: 'Read the latest 1000 attempts for an exact external_id within one owned base' })
  @ApiQuery({ name: 'external_id', required: true, type: String })
  results(@Req() req: { user: AutodialKeyActor }, @Param('baseUid', ParseIntPipe) baseUid: number,
    @Query('external_id') externalId: string) { return this.crm.results(req.user, baseUid, externalId); }
  @Post('dnc/bulk') @AutodialApiScope('autodial:dnc:write')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Add up to 100 normalized DNC numbers atomically; never shortens an existing ban' })
  @ApiBody({ schema: z.toJSONSchema(autodialCrmDncSchema, { target: 'openapi-3.0' }) as SchemaObject })
  dnc(@Req() req: { user: AutodialKeyActor }, @Headers('idempotency-key') key: string, @Body() body: unknown) { return this.crm.dncBulk(req.user, key, body); }
  @Get('webhooks') @AutodialApiScope('autodial:read')
  hooks(@Req() req: { user: AutodialKeyActor }) { return this.webhooks.list(req.user); }
  @Post('webhooks') @AutodialApiScope('autodial:webhooks:write')
  @ApiOperation({ summary: 'Subscribe to attempt completion events; signing secret is returned only once' })
  @ApiBody({ schema: { type: 'object', required: ['url'], additionalProperties: false, properties: { url: { type: 'string', format: 'uri', maxLength: 2048 } } } })
  createHook(@Req() req: { user: AutodialKeyActor }, @Body() body: unknown) { return this.webhooks.create(req.user, body); }
  @Delete('webhooks/:uid') @AutodialApiScope('autodial:webhooks:write')
  disableHook(@Req() req: { user: AutodialKeyActor }, @Param('uid') uid: string) { return this.webhooks.disable(req.user, uid); }
  @Get('webhooks/:uid/deliveries') @AutodialApiScope('autodial:read')
  deliveryLog(@Req() req: { user: AutodialKeyActor }, @Param('uid') uid: string) { return this.webhooks.deliveries(req.user, uid); }
}
