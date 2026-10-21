import { Controller, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialWriteGuard } from './autodial-write.guard';
import { AutodialUiCommandService } from './autodial-ui-command.service';

@UseGuards(JwtAuthGuard, ModuleAccessGuard, AutodialWriteGuard)
@RequiresModule('autodial')
@Controller('autodial/commands')
export class AutodialUiCommandsController {
  constructor(private readonly commands: AutodialUiCommandService) {}

  @Get(':key')
  @Header('Cache-Control', 'no-store')
  status(@Req() req: { user: { vpbx_user_uid: number; sub: number } }, @Param('key') key: string) {
    return this.commands.status(req.user.vpbx_user_uid, req.user.sub, key);
  }
}
