import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserLevel } from '@krasterisk/shared';
import { parseExpectedRevision } from '../ai-agents/ai-agents.service';
import { RobotConfigService } from './robot-config.service';
import { SaveRobotDto } from './dto/save-robot.dto';

type Request = { user: { sub: number; vpbx_user_uid: number } };

@Controller('ai-voice/robots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserLevel.ADMIN)
export class RobotConfigController {
  constructor(private readonly robots: RobotConfigService) {}

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
}
