/**
 * CallCenter REST Controller.
 *
 * Handles operator and supervisor actions via REST POST endpoints.
 * All state-changing actions (login, pause, transfer) go through here.
 * Real-time events are pushed via SSE (CallCenterSseController).
 *
 * Access control:
 * - Agent endpoints: any authenticated user (level >= 2)
 * - Supervisor endpoints: level >= 3 only
 * - Pause reasons CRUD: level >= 3
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req, UseGuards, ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterService } from './callcenter.service';
import {
  AgentLoginDto, AgentPauseDto, AgentUnpauseDto, AgentHangupDto,
  TransferDto, SupervisorSpyDto, SupervisorForceActionDto,
  SupervisorQueueActionDto, CreatePauseReasonDto, UpdatePauseReasonDto,
  PickCallDto, MarkMissedCalledBackDto,
} from './dto/callcenter.dto';

// ─── Helpers ──────────────────────────────────────────────

/** Minimum user level for supervisor actions */
const SUPERVISOR_LEVEL = 3;

function assertSupervisor(user: any): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

// ─── Controller ────────────────────────────────────────────

@UseGuards(JwtAuthGuard)
@Controller('callcenter')
export class CallCenterController {
  constructor(private readonly ccService: CallCenterService) {}

  // ─── Agent Actions ──────────────────────────────────────

  @Post('agent/login')
  agentLogin(@Body() dto: AgentLoginDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentLogin(
      dto.interface,
      dto.queues || [],
      req.user.vpbx_user_uid,
      req.user.id,
    );
  }

  @Post('agent/logout')
  agentLogout(@Req() req: Request & { user: any }) {
    return this.ccService.agentLogout(req.user.vpbx_user_uid, req.user.id);
  }

  @Post('agent/pause')
  agentPause(@Body() dto: AgentPauseDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentPause(req.user.vpbx_user_uid, req.user.id, dto.reason, dto.queue);
  }

  @Post('agent/unpause')
  agentUnpause(@Body() dto: AgentUnpauseDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentUnpause(req.user.vpbx_user_uid, req.user.id, dto.queue);
  }

  @Post('agent/hangup')
  agentHangup(@Body() dto: AgentHangupDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentHangup(req.user.vpbx_user_uid, req.user.id, dto.channel);
  }

  @Post('agent/hold')
  agentHold(@Req() req: Request & { user: any }) {
    return this.ccService.agentHold(req.user.vpbx_user_uid, req.user.id);
  }

  @Post('agent/unhold')
  agentUnhold(@Req() req: Request & { user: any }) {
    return this.ccService.agentUnhold(req.user.vpbx_user_uid, req.user.id);
  }

  @Post('agent/transfer')
  agentTransfer(@Body() dto: TransferDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentTransfer(dto, req.user.vpbx_user_uid, req.user.id);
  }

  @Post('agent/wrapup-done')
  agentWrapupDone(@Req() req: Request & { user: any }) {
    return this.ccService.agentWrapupDone(req.user.vpbx_user_uid, req.user.id);
  }

  @Post('agent/pick-call')
  agentPickCall(@Body() dto: PickCallDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentPickCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.id);
  }

  // ─── Missed Calls ─────────────────────────────────────

  @Get('missed-calls')
  getMissedCalls(
    @Query('includeHandled') includeHandled: string | undefined,
    @Req() req: Request & { user: any },
  ) {
    return this.ccService.getMissedCalls(
      req.user.vpbx_user_uid,
      includeHandled === '1' || includeHandled === 'true',
    );
  }

  @Post('missed-calls/:id/called-back')
  markMissedCalledBack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkMissedCalledBackDto,
    @Req() req: Request & { user: any },
  ) {
    return this.ccService.markMissedCalled(id, dto.note, req.user.vpbx_user_uid, req.user.id);
  }

  // ─── Client Card (sidebar lookup) ─────────────────────

  @Get('client-lookup')
  clientLookup(@Query('number') number: string, @Req() req: Request & { user: any }) {
    return this.ccService.lookupClient(number || '', req.user.vpbx_user_uid);
  }

  // ─── Supervisor Actions (level >= 3) ───────────────────

  @Post('supervisor/spy')
  supervisorSpy(@Body() dto: SupervisorSpyDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorSpy(
      dto.agentInterface,
      dto.mode || 'spy',
      req.user.vpbx_user_uid,
      req.user.id,
    );
  }

  @Post('supervisor/force-pause')
  supervisorForcePause(@Body() dto: SupervisorForceActionDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorForcePause(dto.agentInterface, dto.reason, req.user.vpbx_user_uid);
  }

  @Post('supervisor/force-unpause')
  supervisorForceUnpause(@Body() dto: SupervisorForceActionDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorForceUnpause(dto.agentInterface, req.user.vpbx_user_uid);
  }

  @Post('supervisor/queue-add')
  supervisorQueueAdd(@Body() dto: SupervisorQueueActionDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorQueueAdd(dto.agentInterface, dto.queue, dto.penalty, req.user.vpbx_user_uid);
  }

  @Post('supervisor/queue-remove')
  supervisorQueueRemove(@Body() dto: SupervisorQueueActionDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorQueueRemove(dto.agentInterface, dto.queue, req.user.vpbx_user_uid);
  }

  // ─── Pause Reasons CRUD (level >= 3) ───────────────────

  @Get('pause-reasons')
  getPauseReasons(@Req() req: Request & { user: any }) {
    return this.ccService.getPauseReasons(req.user.vpbx_user_uid);
  }

  @Post('pause-reasons')
  createPauseReason(@Body() dto: CreatePauseReasonDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.createPauseReason(dto, req.user.vpbx_user_uid);
  }

  @Put('pause-reasons/:id')
  updatePauseReason(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePauseReasonDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.ccService.updatePauseReason(id, dto, req.user.vpbx_user_uid);
  }

  @Delete('pause-reasons/:id')
  deletePauseReason(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.deletePauseReason(id, req.user.vpbx_user_uid);
  }
}
