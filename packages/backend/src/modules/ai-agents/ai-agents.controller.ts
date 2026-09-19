import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards, ParseIntPipe, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiAgentsService } from './ai-agents.service';
import { AiProvidersService } from './ai-providers.service';
import { AiToolsetsService } from './ai-toolsets.service';
import { AiAgentInventoryService } from './ai-agent-inventory.service';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';
import { CreateAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';
import { CreateAiToolsetDto, UpdateAiToolsetDto } from './dto/ai-toolset.dto';
import { publicProvider } from '../ai-connectivity/provider-public';

const ADMIN_LEVELS = new Set([0, 1]); // SUPERADMIN, ADMIN

function assertAdmin(user: any): void {
  if (!ADMIN_LEVELS.has(Number(user?.level))) {
    throw new ForbiddenException('Admin access required for AI Agents management');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('ai-agents')
export class AiAgentsController {
  constructor(
    private readonly agents: AiAgentsService,
    private readonly providers: AiProvidersService,
    private readonly toolsets: AiToolsetsService,
    private readonly inventory: AiAgentInventoryService,
  ) {}

  // ─── Agents ─────────────────────────────────────────────

  @Get()
  list(@Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.findAll(req.user.vpbx_user_uid);
  }

  @Get('inventory')
  listInventory(
    @Query('limit') limit: string | undefined,
    @Query('afterUid') afterUid: string | undefined,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    if ((limit !== undefined && !/^[1-9]\d*$/.test(limit))
      || (afterUid !== undefined && !/^(0|[1-9]\d*)$/.test(afterUid))) {
      throw new BadRequestException({ code: 'agent_inventory_page_invalid' });
    }
    return this.inventory.listPageForTenant(
      req.user.vpbx_user_uid,
      limit === undefined ? 100 : Number(limit),
      afterUid === undefined ? 0 : Number(afterUid),
    );
  }

  @Get('inventory/report')
  migrationReport(
    @Query('maxRows') maxRows: string | undefined,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    if (maxRows !== undefined && !/^[1-9]\d*$/.test(maxRows)) {
      throw new BadRequestException({ code: 'agent_inventory_report_limit_invalid' });
    }
    return this.inventory.reportLegacyForTenant(
      req.user.vpbx_user_uid, maxRows === undefined ? 1000 : Number(maxRows),
    );
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.findOne(id, req.user.vpbx_user_uid);
  }

  @Get(':id/readiness')
  readiness(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.checkReadiness(id, req.user.vpbx_user_uid);
  }

  @Post()
  create(@Body() dto: CreateAiAgentDto, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.create(dto, req.user.vpbx_user_uid);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiAgentDto,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    return this.agents.update(id, dto, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.remove(id, req.user.vpbx_user_uid);
  }

  // ─── Providers (sub-route) ──────────────────────────────

  @Get('providers/list')
  async listProviders(@Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return (await this.providers.findAll(req.user.vpbx_user_uid)).map(publicProvider);
  }

  @Post('providers')
  async createProvider(@Body() dto: CreateAiProviderDto, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return publicProvider(await this.providers.create(dto, req.user.vpbx_user_uid));
  }

  @Put('providers/:id')
  async updateProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiProviderDto,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    return publicProvider(await this.providers.update(id, dto, req.user.vpbx_user_uid));
  }

  @Delete('providers/:id')
  removeProvider(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.providers.remove(id, req.user.vpbx_user_uid);
  }

  // ─── Toolsets (sub-route) ───────────────────────────────

  @Get('toolsets/list')
  listToolsets(@Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.toolsets.findAll(req.user.vpbx_user_uid);
  }

  @Post('toolsets')
  createToolset(@Body() dto: CreateAiToolsetDto, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.toolsets.create(dto, req.user.vpbx_user_uid);
  }

  @Put('toolsets/:id')
  updateToolset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiToolsetDto,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    return this.toolsets.update(id, dto, req.user.vpbx_user_uid);
  }

  @Delete('toolsets/:id')
  removeToolset(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.toolsets.remove(id, req.user.vpbx_user_uid);
  }
}
