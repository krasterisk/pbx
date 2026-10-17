import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialMonitorService } from './autodial-monitor.service';
@Controller('autodial/monitor-health')
@RequiresModule('autodial')
@UseGuards(JwtAuthGuard, ModuleAccessGuard)
export class AutodialMonitorController {
  constructor(private readonly monitor: AutodialMonitorService) {}
  @Get() health(@Req() req: { user: { vpbx_user_uid: number } }) { return this.monitor.health(req.user.vpbx_user_uid); }
}
