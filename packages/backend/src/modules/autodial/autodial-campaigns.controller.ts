import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialDncService } from './autodial-dnc.service';
import {
  CreateAutodialCampaignDto,
  CreateAutodialDncDto,
  StartAutodialCampaignDto,
  UpdateAutodialCampaignDto,
} from './dto/autodial-campaign.dto';

type AuthedRequest = Request & { user: { vpbx_user_uid: number } };

@UseGuards(JwtAuthGuard, ModuleAccessGuard)
@RequiresModule('autodial')
@Controller('autodial')
export class AutodialCampaignsController {
  constructor(
    private readonly campaigns: AutodialCampaignsService,
    private readonly dnc: AutodialDncService,
  ) {}

  @Get('campaigns')
  findAll(@Req() req: AuthedRequest) {
    return this.campaigns.findAll(req.user.vpbx_user_uid);
  }

  @Post('campaigns')
  create(@Req() req: AuthedRequest, @Body() body: CreateAutodialCampaignDto) {
    return this.campaigns.create(req.user.vpbx_user_uid, body);
  }

  @Get('campaigns/:uid')
  findOne(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.findOne(req.user.vpbx_user_uid, uid);
  }

  @Put('campaigns/:uid')
  update(
    @Req() req: AuthedRequest,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: UpdateAutodialCampaignDto,
  ) {
    return this.campaigns.update(req.user.vpbx_user_uid, uid, body);
  }

  @Delete('campaigns/:uid')
  async remove(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.campaigns.remove(req.user.vpbx_user_uid, uid);
    return { deleted: true };
  }

  @Post('campaigns/:uid/start')
  start(
    @Req() req: AuthedRequest,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: StartAutodialCampaignDto,
  ) {
    return this.campaigns.start(req.user.vpbx_user_uid, uid, body ?? {});
  }

  @Post('campaigns/:uid/pause')
  pause(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.pause(req.user.vpbx_user_uid, uid);
  }

  @Post('campaigns/:uid/resume')
  resume(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.resume(req.user.vpbx_user_uid, uid);
  }

  @Post('campaigns/:uid/stop')
  stop(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.stop(req.user.vpbx_user_uid, uid);
  }

  // ── DNC ───────────────────────────────────────────────────────────

  @Get('dnc')
  listDnc(@Req() req: AuthedRequest) {
    return this.dnc.findAll(req.user.vpbx_user_uid);
  }

  @Post('dnc')
  createDnc(@Req() req: AuthedRequest, @Body() body: CreateAutodialDncDto) {
    return this.dnc.create(req.user.vpbx_user_uid, body);
  }

  @Delete('dnc/:uid')
  async removeDnc(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.dnc.remove(req.user.vpbx_user_uid, uid);
    return { deleted: true };
  }
}
