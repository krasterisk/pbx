import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DialplanDryRunService } from './dialplan-dry-run.service';
import { DryRunRequestDto, DryRunResultDto } from './dto/dry-run.dto';

@UseGuards(JwtAuthGuard)
@Controller('dialplan')
export class DialplanDryRunController {
  constructor(private readonly dryRunService: DialplanDryRunService) {}

  @Post('dry-run')
  run(@Body() body: DryRunRequestDto, @Req() req: { user: { vpbx_user_uid: number } }): Promise<DryRunResultDto> {
    return this.dryRunService.run(req.user.vpbx_user_uid, body);
  }
}
