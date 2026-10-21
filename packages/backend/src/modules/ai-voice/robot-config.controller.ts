import { BadRequestException, Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserLevel } from '@krasterisk/shared';
import { parseExpectedRevision } from '../ai-agents/ai-agents.service';
import { RobotConfigService } from './robot-config.service';
import { RobotPlaygroundService } from './robot-playground.service';
import { SaveRobotDto } from './dto/save-robot.dto';
import type { EngineMessage } from './conversation-engine';

type Request = { user: { sub: number; vpbx_user_uid: number } };

@Controller('ai-voice/robots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserLevel.ADMIN)
export class RobotConfigController {
  constructor(
    private readonly robots: RobotConfigService,
    private readonly playground: RobotPlaygroundService,
  ) {}

  @Get('templates') templates() { return this.playground.templates(); }
  @Post('from-template') fromTemplate(@Body() body: { id: string }) { return this.playground.fromTemplate(body.id); }
  @Post('playground')
  playDraft(@Req() req: Request, @Body() body: PlaygroundBody) {
    if (!body.config) throw new BadRequestException({ code: 'invalid_robot_configuration' });
    return this.playground.run(req.user.vpbx_user_uid, { ...body, config: body.config });
  }

  @Get() list(@Req() req: Request) { return this.robots.list(req.user.vpbx_user_uid); }
  @Get(':uid') get(@Req() req: Request, @Param('uid', ParseIntPipe) uid: number) {
    return this.robots.get(req.user.vpbx_user_uid, uid);
  }
  @Post() create(@Req() req: Request, @Body() body: SaveRobotDto) {
    return this.robots.save(req.user.vpbx_user_uid, req.user.sub, body);
  }
  @Put(':uid') save(@Req() req: Request, @Param('uid', ParseIntPipe) uid: number,
    @Headers('if-match') revision: string, @Body() body: SaveRobotDto) {
    return this.robots.save(req.user.vpbx_user_uid, req.user.sub, body, uid, parseExpectedRevision(revision));
  }
  @Get(':uid/versions') versions(@Req() req: Request, @Param('uid', ParseIntPipe) uid: number) {
    return this.robots.listVersions(req.user.vpbx_user_uid, uid);
  }
  @Post(':uid/rollback') rollback(@Req() req: Request, @Param('uid', ParseIntPipe) uid: number, @Body() body: { versionId: string }) {
    return this.robots.rollback(req.user.vpbx_user_uid, req.user.sub, uid, body.versionId);
  }
  @Post(':uid/playground')
  play(@Req() req: Request, @Param('uid', ParseIntPipe) uid: number, @Body() body: PlaygroundBody) {
    return this.playSaved(req, uid, body);
  }

  private async playSaved(req: Request, uid: number, body: PlaygroundBody) {
    const robot = await this.robots.get(req.user.vpbx_user_uid, uid);
    return this.playground.run(req.user.vpbx_user_uid, { ...body, config: body.config ?? robot.config });
  }
}

interface PlaygroundBody {
  config?: SaveRobotDto;
  history?: EngineMessage[];
  userText: string;
  variables?: Record<string, string>;
}
