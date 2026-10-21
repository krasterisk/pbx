import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ModuleAccessGuard } from '../cloud-admin/module-access.guard';
import { RequiresModule } from '../cloud-admin/requires-module.decorator';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialDncService } from './autodial-dnc.service';
import { AutodialDiagnosisService } from './autodial-diagnosis.service';
import { AutodialPreflightService } from './autodial-preflight.service';
import { AutodialWriteGuard } from './autodial-write.guard';
import { AutodialTestCallService } from './autodial-test-call.service';
import { AutodialPreviewService } from './autodial-preview.service';
import { AutodialUiCommandService } from './autodial-ui-command.service';
import {
  CreateAutodialCampaignDto,
  AutodialSchedulePreviewDto,
  CreateAutodialDncDto,
  StartAutodialCampaignDto,
  UpdateAutodialCampaignDto,
} from './dto/autodial-campaign.dto';

type AuthedRequest = Request & { user: { vpbx_user_uid: number; sub: number } };

@UseGuards(JwtAuthGuard, ModuleAccessGuard, AutodialWriteGuard)
@RequiresModule('autodial')
@Controller('autodial')
export class AutodialCampaignsController {
  constructor(
    private readonly campaigns: AutodialCampaignsService,
    private readonly dnc: AutodialDncService,
    private readonly diagnosis: AutodialDiagnosisService,
    private readonly preflight: AutodialPreflightService,
    private readonly testCalls: AutodialTestCallService,
    private readonly preview: AutodialPreviewService,
    private readonly commands: AutodialUiCommandService,
  ) {}

  @Get('capabilities')
  capabilities(@Req() req: AuthedRequest) { return this.preflight.capabilities(req.user.vpbx_user_uid); }

  @Get('campaigns/:uid/diagnosis')
  diagnose(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.diagnosis.diagnose(req.user.vpbx_user_uid, uid);
  }

  @Get('campaigns/:uid/preflight')
  check(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.preflight.check(req.user.vpbx_user_uid, uid);
  }

  @Get('campaigns/:uid/tour-preview')
  previewTour(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Query('include_dispositions') selection: unknown, @Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'private, no-store');
    return this.campaigns.previewTour(req.user.vpbx_user_uid, uid, selection);
  }

  @Get('campaigns')
  findAll(@Req() req: AuthedRequest) {
    return this.campaigns.findAll(req.user.vpbx_user_uid);
  }

  @Post('preflight-draft')
  checkDraft(@Req() req: AuthedRequest, @Body() body: CreateAutodialCampaignDto) {
    return this.preflight.checkDraft(req.user.vpbx_user_uid, body);
  }

  @Post('schedule-preview')
  schedulePreview(@Body() body: AutodialSchedulePreviewDto) {
    return this.preflight.previewSchedule(body);
  }

  @Post('campaigns/:uid/test-call')
  testCall(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number, @Body() body: unknown) {
    return this.testCalls.call(req.user.vpbx_user_uid, req.user.sub, uid, body);
  }

  @Get('campaigns/:uid/latest-test-call')
  latestTestCall(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    return this.testCalls.latest(req.user.vpbx_user_uid, req.user.sub, uid);
  }

  @Get('campaigns/:uid/test-calls/:testUid')
  testCallStatus(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Param('testUid') testUid: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.testCalls.status(req.user.vpbx_user_uid, req.user.sub, uid, testUid);
  }

  @Get('campaigns/:uid/test-call-command')
  reconcileTestCall(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Query('key') key: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.testCalls.reconcile(req.user.vpbx_user_uid, req.user.sub, uid, key);
  }

  @Get('campaigns/:uid/scenario-preview')
  scenarioPreview(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number, @Query('contact_uid') contactUid?: string) {
    const contact = contactUid === undefined ? undefined : Number(contactUid);
    if (contact !== undefined && (!Number.isSafeInteger(contact) || contact <= 0)) throw new BadRequestException({ code: 'AC_CONTACT_NOT_FOUND' });
    return this.preview.preview(req.user.vpbx_user_uid, uid, contact);
  }

  @Get('campaigns/:uid/scenario-preview/:contact_uid/:step_id/audio')
  async previewAudio(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number, @Param('step_id') stepId: string, @Res() res: Response) {
    const wav = await this.preview.audio(req.user.vpbx_user_uid, uid, contactUid, stepId);
    res.setHeader('Content-Type', 'audio/wav'); res.setHeader('Cache-Control', 'no-store'); res.send(wav);
  }

  @Post('campaigns')
  async create(@Req() req: AuthedRequest, @Body() body: CreateAutodialCampaignDto, @Headers('idempotency-key') key?: string) {
    if (key !== undefined) {
      const uid = await this.commands.run(req.user.vpbx_user_uid, req.user.sub, key, 'create_campaign', body,
        (transaction) => this.campaigns.createInTransaction(req.user.vpbx_user_uid, body, transaction, req.user.sub));
      return this.campaigns.completeCreation(req.user.vpbx_user_uid, uid);
    }
    return this.campaigns.create(req.user.vpbx_user_uid, body, req.user.sub);
  }

  @Get('campaigns/:uid')
  findOne(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.findOne(req.user.vpbx_user_uid, uid);
  }

  @Get('campaigns/:uid/contacts')
  contacts(
    @Req() req: AuthedRequest,
    @Param('uid', ParseIntPipe) uid: number,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('q') q?: string,
    @Query('disposition') disposition?: string,
  ) {
    return this.campaigns.listContacts(req.user.vpbx_user_uid, uid, {
      page: Number(page ?? 1), pageSize: Number(pageSize ?? 25), q, disposition,
    });
  }

  @Get('campaigns/:uid/journal')
  journal(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number, @Query('before') before?: string) {
    return this.campaigns.journal(req.user.vpbx_user_uid, uid, before ? Number(before) : undefined);
  }

  @Post('campaigns/:uid/contacts/:contact_uid/task-action')
  taskAction(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number,
    @Param('contact_uid', ParseIntPipe) contactUid: number, @Body() body: unknown) {
    return this.campaigns.changeContactTask(req.user.vpbx_user_uid, uid, contactUid, body, req.user.sub);
  }

  @Put('campaigns/:uid')
  update(
    @Req() req: AuthedRequest,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: UpdateAutodialCampaignDto,
  ) {
    return this.campaigns.update(req.user.vpbx_user_uid, uid, body, req.user.sub);
  }

  @Delete('campaigns/:uid')
  async remove(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.campaigns.remove(req.user.vpbx_user_uid, uid);
    return { deleted: true };
  }

  @Post('campaigns/:uid/start')
  async start(
    @Req() req: AuthedRequest,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: StartAutodialCampaignDto,
  ) {
    await this.preflight.assertReady(req.user.vpbx_user_uid, uid);
    return this.campaigns.start(req.user.vpbx_user_uid, uid, body ?? {}, req.user.sub);
  }

  @Post('campaigns/:uid/pause')
  pause(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.pause(req.user.vpbx_user_uid, uid, req.user.sub);
  }

  @Post('campaigns/:uid/resume')
  async resume(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.preflight.assertReady(req.user.vpbx_user_uid, uid);
    return this.campaigns.resume(req.user.vpbx_user_uid, uid, req.user.sub);
  }

  @Post('campaigns/:uid/stop')
  stop(@Req() req: AuthedRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.campaigns.stop(req.user.vpbx_user_uid, uid, req.user.sub);
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
