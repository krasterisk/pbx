import { Controller,Get,Query,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayloadUser } from '../auth/auth.service';
import { DashboardService } from './dashboard.service';
import { parseDashboardQuery } from './dashboard-query';
@ApiTags('PBX Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service:DashboardService) {}
  @Get('overview') overview(@Req() req:{user:JwtPayloadUser},@Query() query:Record<string,unknown>) { return this.service.overview(req.user,parseDashboardQuery(query)); }
  @Get('calls') calls(@Req() req:{user:JwtPayloadUser},@Query() query:Record<string,unknown>) { return this.service.calls(req.user,parseDashboardQuery(query)); }
  @Get('endpoints') endpoints(@Req() req:{user:JwtPayloadUser},@Query() query:Record<string,unknown>) { return this.service.inventory(req.user,'endpoints',parseDashboardQuery(query)); }
  @Get('trunks') trunks(@Req() req:{user:JwtPayloadUser},@Query() query:Record<string,unknown>) { return this.service.inventory(req.user,'trunks',parseDashboardQuery(query)); }
  @Get('system') system(@Req() req:{user:JwtPayloadUser},@Query('nodeId') nodeId?:string,@Query('range') range?:string) { return this.service.systemDetail(req.user,nodeId,range); }
}
