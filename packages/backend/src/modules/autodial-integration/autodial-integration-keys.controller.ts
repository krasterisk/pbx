import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialIntegrationKeyService } from './autodial-integration-key.service';

@ApiTags('Autodial integration keys')
@ApiBearerAuth()
@Controller('autodial/integration-keys')
@RequiresModule('autodial')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AutodialIntegrationKeysController {
  constructor(private readonly keys: AutodialIntegrationKeyService) {}
  @Get() list(@Req() req: any) { return this.keys.list(req.user.vpbx_user_uid, req.user.level); }
  @Post()
  @ApiOperation({ summary: 'Admin browser JWT only; returns the new integration token exactly once' })
  @ApiBody({ schema: { type: 'object', required: ['label', 'scopes', 'expires_at'], additionalProperties: false, properties: {
    label: { type: 'string', minLength: 1, maxLength: 120 }, expires_at: { type: 'string', format: 'date-time' },
    scopes: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', enum: ['autodial:read', 'autodial:contacts:write', 'autodial:imports:write', 'autodial:dnc:write', 'autodial:proposals:write', 'autodial:webhooks:write'] } },
  } } })
  create(@Req() req: any, @Body() body: unknown) { return this.keys.create(req.user.vpbx_user_uid, req.user.sub, req.user.level, body); }
  @Delete(':uid') revoke(@Req() req: any, @Param('uid') uid: string) { return this.keys.revoke(req.user.vpbx_user_uid, req.user.level, uid); }
}
