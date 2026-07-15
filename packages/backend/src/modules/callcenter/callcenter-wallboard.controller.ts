/**
 * CallCenter Wallboard Controller (D-26 display tokens + D-28 alert routing).
 *
 * Two auth branches (guards on methods, NOT class):
 * - DisplayTokenGuard on SSE — TV read-only wallboard without login
 * - JwtAuthGuard + assertSupervisor on token / alert-config management
 */
import {
  Controller, Get, Post, Put, Delete, Sse,
  Body, Param, Req, UseGuards, ParseIntPipe,
  ForbiddenException, MessageEvent, Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, map, merge, interval, startWith } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DisplayTokenGuard } from './guards/display-token.guard';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterWallboardService } from './callcenter-wallboard.service';
import { CreateDisplayTokenDto, UpdateAlertConfigDto } from './dto/wallboard.dto';

const SUPERVISOR_LEVEL = 3;
const SSE_HEARTBEAT_MS = 15_000;

function assertSupervisor(user: any): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@Controller('callcenter/wallboard')
export class CallCenterWallboardController {
  private readonly logger = new Logger(CallCenterWallboardController.name);

  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly wallboardService: CallCenterWallboardService,
  ) {}

  /**
   * SSE: GET /api/callcenter/wallboard/events?token=<opaque>
   * Read-only wallboard stream for TV — DisplayTokenGuard only (no mutations).
   */
  @UseGuards(DisplayTokenGuard)
  @Sse('events')
  events(@Req() req: Request & { user: any }): Observable<MessageEvent> {
    const userUid = req.user.vpbx_user_uid;
    this.logger.log(`Wallboard SSE opened: tenant ${userUid} (display token)`);

    const snapshot = this.stateService.getSnapshot(userUid);

    const ccEvents$ = this.stateService.getEventStream(userUid).pipe(
      startWith({
        type: 'fullSnapshot',
        userUid,
        data: snapshot,
      }),
      map(event => ({
        data: JSON.stringify(event.data),
        type: event.type,
        id: String(event.data?._eventId || Date.now()),
      })),
    );

    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map(() => ({
        data: '',
        type: 'heartbeat',
        id: undefined as any,
      })),
    );

    return merge(ccEvents$, heartbeat$);
  }

  @UseGuards(JwtAuthGuard)
  @Post('tokens')
  generate(
    @Body() dto: CreateDisplayTokenDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.wallboardService.generateToken(
      req.user.vpbx_user_uid,
      req.user.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('tokens')
  list(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.wallboardService.listTokens(req.user.vpbx_user_uid);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tokens/:uid')
  revoke(
    @Param('uid', ParseIntPipe) uid: number,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.wallboardService.revokeToken(req.user.vpbx_user_uid, uid);
  }

  @UseGuards(JwtAuthGuard)
  @Get('alert-config')
  getAlertConfig(@Req() req: Request & { user: any }) {
    assertSupervisor(req.user);
    return this.wallboardService.getAlertConfig(req.user.vpbx_user_uid);
  }

  @UseGuards(JwtAuthGuard)
  @Put('alert-config')
  updateAlertConfig(
    @Body() dto: UpdateAlertConfigDto,
    @Req() req: Request & { user: any },
  ) {
    assertSupervisor(req.user);
    return this.wallboardService.updateAlertConfig(req.user.vpbx_user_uid, dto);
  }
}
