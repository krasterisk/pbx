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
import { CallCenterMetricsService } from './callcenter-metrics.service';
import {
  AgentLoginDto, AgentPauseDto, AgentUnpauseDto, AgentHangupDto,
  TransferDto, SupervisorSpyDto, SupervisorForceActionDto,
  SupervisorQueueActionDto, SupervisorQueuePenaltyDto, SupervisorForceLogoutDto,
  SupervisorRedirectCallDto, SupervisorHangupCallDto,
  CreatePauseReasonDto, UpdatePauseReasonDto,
  PickCallDto, MarkMissedCalledBackDto, WrapupExtendDto,
} from './dto/callcenter.dto';
import { PeerSpyDto } from './dto/callcenter-permissions.dto';
import {
  ParkCallDto, RetrieveParkedCallDto, ConferenceAddDto,
  ZombieResetDto, WarmTransferQueueDto, ClickToCallDto,
} from './dto/callcenter-callcontrol.dto';
import { MissedCallActionDto } from './dto/callcenter-missed.dto';
import { DirectoryQueryDto } from './dto/callcenter-directory.dto';

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
  constructor(
    private readonly ccService: CallCenterService,
    private readonly metricsService: CallCenterMetricsService,
  ) {}

  // ─── Queue Metrics ──────────────────────────────────────

  @Get('metrics/queues')
  getQueueMetrics(@Req() req: Request & { user: any }) {
    return this.metricsService.getTenantQueueMetrics(req.user.vpbx_user_uid);
  }

  // ─── Agent Actions ──────────────────────────────────────

  @Post('agent/login')
  agentLogin(@Body() dto: AgentLoginDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentLogin(
      dto.interface,
      dto.queues || [],
      req.user.vpbx_user_uid,
      req.user.sub,
    );
  }

  /** Active shift snapshot — used to restore operator panel after refresh. */
  @Get('agent/me')
  agentMe(@Req() req: Request & { user: any }) {
    return this.ccService.getAgentMe(req.user.vpbx_user_uid, req.user.sub);
  }

  /** Own dual shift/day answered·made·missed KPI counters (D-11/D-12) — status bar. */
  @Get('agent/kpi')
  getAgentKpi(@Req() req: Request & { user: any }) {
    return this.ccService.getAgentKpi(req.user.vpbx_user_uid, req.user.sub);
  }

  @Get('agent/queues-kpi')
  getAgentQueuesKpi(@Req() req: Request & { user: any }) {
    return this.ccService.getAgentQueuesKpi(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/logout')
  agentLogout(@Req() req: Request & { user: any }) {
    return this.ccService.agentLogout(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/pause')
  agentPause(@Body() dto: AgentPauseDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentPause(req.user.vpbx_user_uid, req.user.sub, dto.reason, dto.queue);
  }

  @Post('agent/unpause')
  agentUnpause(@Body() dto: AgentUnpauseDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentUnpause(req.user.vpbx_user_uid, req.user.sub, dto.queue);
  }

  @Post('agent/hangup')
  agentHangup(@Body() dto: AgentHangupDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentHangup(req.user.vpbx_user_uid, req.user.sub, dto.channel);
  }

  @Post('agent/hold')
  agentHold(@Req() req: Request & { user: any }) {
    return this.ccService.agentHold(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/unhold')
  agentUnhold(@Req() req: Request & { user: any }) {
    return this.ccService.agentUnhold(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/transfer')
  agentTransfer(@Body() dto: TransferDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentTransfer(dto, req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/wrapup-done')
  agentWrapupDone(@Req() req: Request & { user: any }) {
    return this.ccService.agentWrapupDone(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/wrapup-extend')
  agentWrapupExtend(@Body() dto: WrapupExtendDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentWrapupExtend(req.user.vpbx_user_uid, req.user.sub, dto.seconds);
  }

  @Post('agent/pick-call')
  agentPickCall(@Body() dto: PickCallDto, @Req() req: Request & { user: any }) {
    return this.ccService.agentPickCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
  }

  /**
   * Coworker↔coworker ChanSpy — permission-gated in CallCenterService.peerSpy,
   * not by assertSupervisor (a supervisor is only additionally allowed by their
   * own broader queue membership, not a blanket bypass). Ids always from JWT.
   */
  @Post('agent/peer-spy')
  peerSpy(@Body() dto: PeerSpyDto, @Req() req: Request & { user: any }) {
    return this.ccService.peerSpy(
      req.user.sub,
      dto.targetInterface,
      dto.mode,
      req.user.vpbx_user_uid,
    );
  }

  // ─── Call Control (D-27/D-28/D-29/D-33) ────────────────
  // All ids come from the JWT (req.user) only — never a client-supplied
  // userUid — same convention as every agent/* route above. Ownership and
  // tenant checks live server-side in CallCenterService.

  @Post('agent/park')
  parkCall(@Body() dto: ParkCallDto, @Req() req: Request & { user: any }) {
    return this.ccService.parkCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/retrieve-parked')
  retrieveParkedCall(@Body() dto: RetrieveParkedCallDto, @Req() req: Request & { user: any }) {
    return this.ccService.retrieveParkedCall(dto.parkingSpace, req.user.vpbx_user_uid, req.user.sub);
  }

  /** Tenant-wide parking lot listing for ParkedCallsIndicator (D-28, 09-10). */
  @Get('agent/parked-calls')
  getParkedCalls(@Req() req: Request & { user: any }) {
    return this.ccService.getParkedCalls(req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/conference-add')
  addToConference(@Body() dto: ConferenceAddDto, @Req() req: Request & { user: any }) {
    return this.ccService.addToConference(dto.uniqueid, dto.target, req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/zombie-reset')
  resetZombieCall(@Body() dto: ZombieResetDto, @Req() req: Request & { user: any }) {
    return this.ccService.resetZombieCall(dto.uniqueid, req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/warm-transfer-queue')
  warmTransferToQueue(@Body() dto: WarmTransferQueueDto, @Req() req: Request & { user: any }) {
    return this.ccService.warmTransferToQueue(dto.uniqueid, dto.queue, req.user.vpbx_user_uid, req.user.sub);
  }

  @Post('agent/click-to-call')
  clickToCall(@Body() dto: ClickToCallDto, @Req() req: Request & { user: any }) {
    return this.ccService.clickToCall(dto.target, req.user.vpbx_user_uid, req.user.sub);
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
      req.user.sub,
    );
  }

  @Post('missed-calls/:id/called-back')
  markMissedCalledBack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkMissedCalledBackDto,
    @Req() req: Request & { user: any },
  ) {
    return this.ccService.markMissedCalled(id, dto.note, req.user.vpbx_user_uid, req.user.sub);
  }

  /** Number-grouped worklist: personal-vs-queue-missed, attemptCount/lastAttemptAt (D-16/D-19). */
  @Get('agent/missed/grouped')
  getMissedCallsGrouped(@Req() req: Request & { user: any }) {
    return this.ccService.getMissedCallsGrouped(req.user.vpbx_user_uid);
  }

  /** Claims a queue-missed (shared-pool) number group for the operator (D-19). */
  @Post('agent/missed/claim')
  claimMissedCall(@Body() dto: MissedCallActionDto, @Req() req: Request & { user: any }) {
    return this.ccService.claimMissedCall(req.user.vpbx_user_uid, req.user.sub, dto.callerIdNum);
  }

  /** Operator callback with the >5s success rule (D-18) — ids come from the JWT only. */
  @Post('agent/missed/callback')
  callbackMissedCall(@Body() dto: MissedCallActionDto, @Req() req: Request & { user: any }) {
    return this.ccService.callbackMissedCall(req.user.vpbx_user_uid, req.user.sub, dto.callerIdNum);
  }

  /** Unified all-direction call history for the operator's own shift/day (D-34/D-35). */
  @Get('agent/history')
  getOperatorCallHistory(
    @Query('period') period: string | undefined,
    @Req() req: Request & { user: any },
  ) {
    return this.ccService.getOperatorCallHistory(
      req.user.vpbx_user_uid,
      req.user.sub,
      period === 'shift' ? 'shift' : 'day',
    );
  }

  /** Unified transfer directory: endpoints + queues + call groups (D-36). */
  @Get('agent/directory')
  getTransferDirectory(@Query() query: DirectoryQueryDto, @Req() req: Request & { user: any }) {
    return this.ccService.getTransferDirectory(req.user.vpbx_user_uid, query.search);
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
      req.user.sub,
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

  @Post('supervisor/queue-penalty')
  supervisorQueuePenalty(@Body() dto: SupervisorQueuePenaltyDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorQueuePenalty(
      dto.agentInterface,
      dto.queue,
      dto.penalty,
      req.user.vpbx_user_uid,
    );
  }

  @Post('supervisor/force-logout')
  supervisorForceLogout(@Body() dto: SupervisorForceLogoutDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorForceLogout(dto.agentInterface, req.user.vpbx_user_uid);
  }

  @Post('supervisor/redirect-call')
  supervisorRedirectCall(@Body() dto: SupervisorRedirectCallDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorRedirectCall(
      dto.uniqueid,
      dto.target,
      req.user.vpbx_user_uid,
    );
  }

  @Post('supervisor/hangup-call')
  supervisorHangupCall(@Body() dto: SupervisorHangupCallDto, @Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.ccService.supervisorHangupCall(dto.uniqueid, req.user.vpbx_user_uid);
  }

  @Get('supervisor/agent-detail')
  getAgentDetail(
    @Query('interface') iface: string,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.ccService.getAgentDetail(iface, req.user.vpbx_user_uid);
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
