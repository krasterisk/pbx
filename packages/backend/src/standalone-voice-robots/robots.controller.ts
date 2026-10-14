import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode, UseGuards, Req,
} from '@nestjs/common';
import { VoiceRobotsService } from '../modules/voice-robots/voice-robots.service';
import { StandaloneRobotGuard, robotTenant } from './access';
import type { StandaloneRobotRequest } from './access';

/** IDs/ownership come from the authenticated route, never editable client payloads. */
function editableBody(body: Record<string, unknown>) {
  const data = { ...body };
  for (const key of ['uid', 'user_uid', 'vpbx_user_uid', 'robot_id', 'group_id']) delete data[key];
  return data;
}

/** Tenant is established exclusively by the authenticated loopback PHP bridge. */
@UseGuards(StandaloneRobotGuard)
@Controller('public/voice-robots')
export class StandaloneRobotsController {
  constructor(private readonly voiceRobotsService: VoiceRobotsService) {}

  // ─── Robot CRUD ────────────────────────────────────────

  @Get()
  async findAll(@Req() req: StandaloneRobotRequest) {
    return this.voiceRobotsService.findAll(robotTenant(req));
  }

  // ─── CDR (Call Detail Records) ────────────────────────
  // IMPORTANT: CDR routes MUST be declared before :uid to avoid param collision

  @Get('cdr')
  async findAllCdr(@Req() req: StandaloneRobotRequest,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('robotId') robotId?: string,
    @Query('disposition') disposition?: string,
    @Query('callerId') callerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.voiceRobotsService.findAllCdr(robotTenant(req), {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      robotId: robotId ? parseInt(robotId, 10) : undefined,
      disposition, callerId, dateFrom, dateTo, search, tag,
    });
  }

  @Get('cdr/stats')
  async getCdrStats(@Req() req: StandaloneRobotRequest, @Query('robotId') robotId?: string) {
    return this.voiceRobotsService.getCdrStats(
      robotTenant(req),
      robotId ? parseInt(robotId, 10) : undefined,
    );
  }

  @Get('cdr/tags')
  async getCdrTags(@Req() req: StandaloneRobotRequest) {
    return this.voiceRobotsService.getDistinctTags(robotTenant(req));
  }

  @Get('cdr/export')
  async exportCdr(@Req() req: StandaloneRobotRequest,
    @Query('disposition') disposition?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.voiceRobotsService.findAllCdr(robotTenant(req), {
      limit: 10000,
      offset: 0,
      disposition, dateFrom, dateTo, search, tag,
    });
  }

  @Get('cdr/:id')
  async findOneCdr(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number) {
    return this.voiceRobotsService.findOneCdr(robotTenant(req), id);
  }

  @Get('cdr/:id/detail')
  async getCdrDetail(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number) {
    return this.voiceRobotsService.getCdrWithLogs(robotTenant(req), id);
  }

  // ─── Robot by ID ───────────────────────────────────────

  @Get(':uid')
  async findOne(@Req() req: StandaloneRobotRequest, @Param('uid', ParseIntPipe) uid: number) {
    return this.voiceRobotsService.findOne(robotTenant(req), uid);
  }

  @Post()
  async create(@Req() req: StandaloneRobotRequest, @Body() body: any) {
    return this.voiceRobotsService.createRobot(robotTenant(req), editableBody(body));
  }

  @Put(':uid')
  async update(@Req() req: StandaloneRobotRequest, @Param('uid', ParseIntPipe) uid: number, @Body() body: any) {
    return this.voiceRobotsService.updateRobot(robotTenant(req), uid, editableBody(body));
  }

  @Delete(':uid')
  @HttpCode(204)
  async delete(@Req() req: StandaloneRobotRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.voiceRobotsService.deleteRobot(robotTenant(req), uid);
  }

  // ─── Keyword Groups CRUD ──────────────────────────────

  @Get(':id/keyword-groups')
  async getKeywordGroups(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getKeywordGroups(robotTenant(req), robotId);
  }

  @Post(':id/keyword-groups')
  async createKeywordGroup(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number, @Body() body: any) {
    return this.voiceRobotsService.createKeywordGroup(robotTenant(req), robotId, editableBody(body));
  }

  @Put('keyword-groups/:id')
  async updateKeywordGroup(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.voiceRobotsService.updateKeywordGroup(robotTenant(req), id, editableBody(body));
  }

  @Delete('keyword-groups/:id')
  @HttpCode(204)
  async deleteKeywordGroup(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number) {
    await this.voiceRobotsService.deleteKeywordGroup(robotTenant(req), id);
  }

  // ─── Keywords CRUD ────────────────────────────────────

  @Get('keyword-groups/:id/keywords')
  async getKeywords(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) groupId: number) {
    return this.voiceRobotsService.getKeywords(robotTenant(req), groupId);
  }

  @Post('keyword-groups/:id/keywords')
  async createKeyword(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) groupId: number, @Body() body: any) {
    return this.voiceRobotsService.createKeyword(robotTenant(req), groupId, editableBody(body));
  }

  @Put('keywords/:uid')
  async updateKeyword(@Req() req: StandaloneRobotRequest, @Param('uid', ParseIntPipe) uid: number, @Body() body: any) {
    return this.voiceRobotsService.updateKeyword(robotTenant(req), uid, editableBody(body));
  }

  @Delete('keywords/:uid')
  @HttpCode(204)
  async deleteKeyword(@Req() req: StandaloneRobotRequest, @Param('uid', ParseIntPipe) uid: number) {
    await this.voiceRobotsService.deleteKeyword(robotTenant(req), uid);
  }

  // ─── Logs ─────────────────────────────────────────────

  @Get(':id/logs')
  async getLogs(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getLogs(robotTenant(req), robotId);
  }

  // ─── Data Lists CRUD ──────────────────────────────────

  @Get(':id/data-lists')
  async getDataLists(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getDataLists(robotTenant(req), robotId);
  }

  @Post(':id/data-lists')
  async createDataList(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number, @Body() body: any) {
    return this.voiceRobotsService.createDataList(robotTenant(req), robotId, editableBody(body));
  }

  @Put('data-lists/:id')
  async updateDataList(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.voiceRobotsService.updateDataList(robotTenant(req), id, editableBody(body));
  }

  @Delete('data-lists/:id')
  @HttpCode(204)
  async deleteDataList(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) id: number) {
    await this.voiceRobotsService.deleteDataList(robotTenant(req), id);
  }

  @Post('data-lists/:id/test-search')
  async testDataListSearch(@Req() req: StandaloneRobotRequest,
    @Param('id', ParseIntPipe) listId: number,
    @Body() body: { query: string; returnField: string },
  ) {
    return this.voiceRobotsService.testDataListSearch(robotTenant(req), listId, body.query, body.returnField);
  }

  @Post(':id/test-match')
  async testMatch(@Req() req: StandaloneRobotRequest, @Param('id', ParseIntPipe) robotId: number, @Body() body: { text: string }) {
    return this.voiceRobotsService.testMatch(robotTenant(req), robotId, body.text);
  }
}
