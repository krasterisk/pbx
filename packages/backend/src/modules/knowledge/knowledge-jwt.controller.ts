import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { TenantContextGuard, type TenantContextRequest } from '../integration-credentials/tenant-context.guard';
import { KnowledgeService } from './knowledge.service';

type Authed = TenantContextRequest & { tenantContext: NonNullable<TenantContextRequest['tenantContext']> };

@UseGuards(TenantContextGuard)
@Controller('ai-knowledge')
export class KnowledgeJwtController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list(@Req() request: Authed) {
    return this.knowledge.list(request.tenantContext);
  }

  @Post()
  create(@Req() request: Authed, @Body() body: { name: string }) {
    return this.knowledge.createBase(request.tenantContext, body.name);
  }

  @Post('preview')
  preview(@Body() body: { mime: string; text: string }) {
    return this.knowledge.ingestPreview(body.mime, body.text);
  }

  @Post('search')
  search(@Body() body: { query: string; chunks: Array<{ id: string; text: string; allowed: boolean }> }) {
    return this.knowledge.search(body.query, body.chunks);
  }
}
