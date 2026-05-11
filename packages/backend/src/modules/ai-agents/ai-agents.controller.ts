import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Req, UseGuards, ParseIntPipe, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiAgentsService } from './ai-agents.service';
import { AiProvidersService } from './ai-providers.service';
import { AiToolsetsService } from './ai-toolsets.service';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';
import { CreateAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';
import { CreateAiToolsetDto, UpdateAiToolsetDto } from './dto/ai-toolset.dto';

const ADMIN_LEVEL = 1;

function assertAdmin(user: any): void {
  // Krasterisk role levels: 1 = admin, 2 = operator, 3 = supervisor
  if (user.level !== ADMIN_LEVEL) {
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
  ) {}

  // ─── Agents ─────────────────────────────────────────────

  @Get()
  list(@Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.agents.findOne(id, req.user.vpbx_user_uid);
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
  listProviders(@Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.providers.findAll(req.user.vpbx_user_uid);
  }

  @Post('providers')
  createProvider(@Body() dto: CreateAiProviderDto, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.providers.create(dto, req.user.vpbx_user_uid);
  }

  @Put('providers/:id')
  updateProvider(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAiProviderDto,
    @Req() req: Request & { user: any },
  ) {
    assertAdmin(req.user);
    return this.providers.update(id, dto, req.user.vpbx_user_uid);
  }

  @Delete('providers/:id')
  removeProvider(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.providers.remove(id, req.user.vpbx_user_uid);
  }

  @Post('providers/:id/clone')
  cloneProvider(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertAdmin(req.user);
    return this.providers.cloneTemplate(id, req.user.vpbx_user_uid);
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
