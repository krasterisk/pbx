import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoiceRobotsService } from './voice-robots.service';

/**
 * Public (no-auth) Voice Robots controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 *
 * All endpoints mirror the JWT-protected VoiceRobotsController,
 * but without @UseGuards(JwtAuthGuard) and with a fixed user_uid.
 */
@Controller('public/voice-robots')
export class VoiceRobotsPublicController {
  private readonly userUid: number;

  constructor(
    private readonly voiceRobotsService: VoiceRobotsService,
    private readonly configService: ConfigService,
  ) {
    this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
  }

  // ─── Robot CRUD ────────────────────────────────────────

  @Get()
  async findAll() {
    return this.voiceRobotsService.findAll(this.userUid);
  }

  // ─── CDR (Call Detail Records) ────────────────────────
  // IMPORTANT: CDR routes MUST be declared before :uid to avoid param collision

  @Get('cdr')
  async findAllCdr(
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
    return this.voiceRobotsService.findAllCdr(this.userUid, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      robotId: robotId ? parseInt(robotId, 10) : undefined,
      disposition, callerId, dateFrom, dateTo, search, tag,
    });
  }

  @Get('cdr/stats')
  async getCdrStats(@Query('robotId') robotId?: string) {
    return this.voiceRobotsService.getCdrStats(
      this.userUid,
      robotId ? parseInt(robotId, 10) : undefined,
    );
  }

  @Get('cdr/tags')
  async getCdrTags() {
    return this.voiceRobotsService.getDistinctTags(this.userUid);
  }

  @Get('cdr/export')
  async exportCdr(
    @Query('disposition') disposition?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
  ) {
    return this.voiceRobotsService.findAllCdr(this.userUid, {
      limit: 10000,
      offset: 0,
      disposition, dateFrom, dateTo, search, tag,
    });
  }

  @Get('cdr/:id')
  async findOneCdr(@Param('id', ParseIntPipe) id: number) {
    return this.voiceRobotsService.findOneCdr(this.userUid, id);
  }

  @Get('cdr/:id/detail')
  async getCdrDetail(@Param('id', ParseIntPipe) id: number) {
    return this.voiceRobotsService.getCdrWithLogs(this.userUid, id);
  }

  // ─── Robot by ID ───────────────────────────────────────

  @Get(':uid')
  async findOne(@Param('uid', ParseIntPipe) uid: number) {
    return this.voiceRobotsService.findOne(this.userUid, uid);
  }

  @Post()
  async create(@Body() body: any) {
    return this.voiceRobotsService.createRobot(this.userUid, body);
  }

  @Put(':uid')
  async update(@Param('uid', ParseIntPipe) uid: number, @Body() body: any) {
    return this.voiceRobotsService.updateRobot(this.userUid, uid, body);
  }

  @Delete(':uid')
  @HttpCode(204)
  async delete(@Param('uid', ParseIntPipe) uid: number) {
    await this.voiceRobotsService.deleteRobot(this.userUid, uid);
  }

  // ─── Keyword Groups CRUD ──────────────────────────────

  @Get(':id/keyword-groups')
  async getKeywordGroups(@Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getKeywordGroups(this.userUid, robotId);
  }

  @Post(':id/keyword-groups')
  async createKeywordGroup(@Param('id', ParseIntPipe) robotId: number, @Body() body: any) {
    return this.voiceRobotsService.createKeywordGroup(this.userUid, robotId, body);
  }

  @Put('keyword-groups/:id')
  async updateKeywordGroup(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.voiceRobotsService.updateKeywordGroup(this.userUid, id, body);
  }

  @Delete('keyword-groups/:id')
  @HttpCode(204)
  async deleteKeywordGroup(@Param('id', ParseIntPipe) id: number) {
    await this.voiceRobotsService.deleteKeywordGroup(this.userUid, id);
  }

  // ─── Keywords CRUD ────────────────────────────────────

  @Get('keyword-groups/:id/keywords')
  async getKeywords(@Param('id', ParseIntPipe) groupId: number) {
    return this.voiceRobotsService.getKeywords(this.userUid, groupId);
  }

  @Post('keyword-groups/:id/keywords')
  async createKeyword(@Param('id', ParseIntPipe) groupId: number, @Body() body: any) {
    return this.voiceRobotsService.createKeyword(this.userUid, groupId, body);
  }

  @Put('keywords/:uid')
  async updateKeyword(@Param('uid', ParseIntPipe) uid: number, @Body() body: any) {
    return this.voiceRobotsService.updateKeyword(this.userUid, uid, body);
  }

  @Delete('keywords/:uid')
  @HttpCode(204)
  async deleteKeyword(@Param('uid', ParseIntPipe) uid: number) {
    await this.voiceRobotsService.deleteKeyword(this.userUid, uid);
  }

  // ─── Logs ─────────────────────────────────────────────

  @Get(':id/logs')
  async getLogs(@Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getLogs(this.userUid, robotId);
  }

  // ─── Data Lists CRUD ──────────────────────────────────

  @Get(':id/data-lists')
  async getDataLists(@Param('id', ParseIntPipe) robotId: number) {
    return this.voiceRobotsService.getDataLists(this.userUid, robotId);
  }

  @Post(':id/data-lists')
  async createDataList(@Param('id', ParseIntPipe) robotId: number, @Body() body: any) {
    return this.voiceRobotsService.createDataList(this.userUid, robotId, body);
  }

  @Put('data-lists/:id')
  async updateDataList(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.voiceRobotsService.updateDataList(this.userUid, id, body);
  }

  @Delete('data-lists/:id')
  @HttpCode(204)
  async deleteDataList(@Param('id', ParseIntPipe) id: number) {
    await this.voiceRobotsService.deleteDataList(this.userUid, id);
  }

  @Post('data-lists/:id/test-search')
  async testDataListSearch(
    @Param('id', ParseIntPipe) listId: number,
    @Body() body: { query: string; returnField: string },
  ) {
    return this.voiceRobotsService.testDataListSearch(this.userUid, listId, body.query, body.returnField);
  }

  @Post(':id/test-match')
  async testMatch(@Param('id', ParseIntPipe) robotId: number, @Body() body: { text: string }) {
    return this.voiceRobotsService.testMatch(this.userUid, robotId, body.text);
  }
}
