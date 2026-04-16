import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, UseGuards,
  ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { VoiceRobotsService } from './voice-robots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Voice Robots CRUD Controller.
 *
 * Endpoints:
 *   GET    /voice-robots                           — List all robots (tenant-scoped)
 *   POST   /voice-robots                           — Create robot
 *   PUT    /voice-robots/:uid                      — Update robot
 *   DELETE /voice-robots/:uid                      — Delete robot
 *   GET    /voice-robots/:id/keyword-groups        — Get groups for a robot
 *   POST   /voice-robots/:id/keyword-groups        — Create keyword group
 *   PUT    /voice-robots/keyword-groups/:id        — Update keyword group
 *   DELETE /voice-robots/keyword-groups/:id        — Delete keyword group
 *   GET    /voice-robots/keyword-groups/:id/keywords — Get keywords for group
 *   POST   /voice-robots/keyword-groups/:id/keywords — Create keyword
 *   PUT    /voice-robots/keywords/:uid             — Update keyword
 *   DELETE /voice-robots/keywords/:uid             — Delete keyword
 *   GET    /voice-robots/:id/logs                  — Get logs for a robot
 */
@Controller('voice-robots')
@UseGuards(JwtAuthGuard)
export class VoiceRobotsController {
  constructor(private readonly voiceRobotsService: VoiceRobotsService) {}

  // ─── Robot CRUD ────────────────────────────────────────

  @Get()
  async findAll(@Request() req: any) {
    return this.voiceRobotsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':uid')
  async findOne(
    @Request() req: any,
    @Param('uid', ParseIntPipe) uid: number,
  ) {
    return this.voiceRobotsService.findOne(req.user.vpbx_user_uid, uid);
  }

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    return this.voiceRobotsService.createRobot(req.user.vpbx_user_uid, body);
  }

  @Put(':uid')
  async update(
    @Request() req: any,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: any,
  ) {
    return this.voiceRobotsService.updateRobot(req.user.vpbx_user_uid, uid, body);
  }

  @Delete(':uid')
  @HttpCode(204)
  async delete(
    @Request() req: any,
    @Param('uid', ParseIntPipe) uid: number,
  ) {
    await this.voiceRobotsService.deleteRobot(req.user.vpbx_user_uid, uid);
  }

  // ─── Keyword Groups CRUD ──────────────────────────────

  @Get(':id/keyword-groups')
  async getKeywordGroups(
    @Request() req: any,
    @Param('id', ParseIntPipe) robotId: number,
  ) {
    return this.voiceRobotsService.getKeywordGroups(req.user.vpbx_user_uid, robotId);
  }

  @Post(':id/keyword-groups')
  async createKeywordGroup(
    @Request() req: any,
    @Param('id', ParseIntPipe) robotId: number,
    @Body() body: any,
  ) {
    return this.voiceRobotsService.createKeywordGroup(req.user.vpbx_user_uid, robotId, body);
  }

  @Put('keyword-groups/:id')
  async updateKeywordGroup(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.voiceRobotsService.updateKeywordGroup(req.user.vpbx_user_uid, id, body);
  }

  @Delete('keyword-groups/:id')
  @HttpCode(204)
  async deleteKeywordGroup(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.voiceRobotsService.deleteKeywordGroup(req.user.vpbx_user_uid, id);
  }

  // ─── Keywords CRUD ────────────────────────────────────

  @Get('keyword-groups/:id/keywords')
  async getKeywords(
    @Request() req: any,
    @Param('id', ParseIntPipe) groupId: number,
  ) {
    return this.voiceRobotsService.getKeywords(req.user.vpbx_user_uid, groupId);
  }

  @Post('keyword-groups/:id/keywords')
  async createKeyword(
    @Request() req: any,
    @Param('id', ParseIntPipe) groupId: number,
    @Body() body: any,
  ) {
    return this.voiceRobotsService.createKeyword(req.user.vpbx_user_uid, groupId, body);
  }

  @Put('keywords/:uid')
  async updateKeyword(
    @Request() req: any,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() body: any,
  ) {
    return this.voiceRobotsService.updateKeyword(req.user.vpbx_user_uid, uid, body);
  }

  @Delete('keywords/:uid')
  @HttpCode(204)
  async deleteKeyword(
    @Request() req: any,
    @Param('uid', ParseIntPipe) uid: number,
  ) {
    await this.voiceRobotsService.deleteKeyword(req.user.vpbx_user_uid, uid);
  }

  // ─── Logs ─────────────────────────────────────────────

  @Get(':id/logs')
  async getLogs(
    @Request() req: any,
    @Param('id', ParseIntPipe) robotId: number,
  ) {
    return this.voiceRobotsService.getLogs(req.user.vpbx_user_uid, robotId);
  }

  // ─── Test Match (debugging) ────────────────────────────

  /**
   * POST /voice-robots/:id/test-match
   *
   * Test keyword matching against a robot's keywords without making a real call.
   * Useful for debugging and testing from the UI.
   *
   * Body: { text: string }
   * Returns: { match: MatchResult | null, allKeywords: number, elapsed_ms: number }
   */
  @Post(':id/test-match')
  async testMatch(
    @Request() req: any,
    @Param('id', ParseIntPipe) robotId: number,
    @Body() body: { text: string },
  ) {
    return this.voiceRobotsService.testMatch(
      req.user.vpbx_user_uid,
      robotId,
      body.text,
    );
  }
}
