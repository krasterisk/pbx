import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, ParseIntPipe,
} from '@nestjs/common';
import { TtsEnginesService } from './tts-engines.service';

@Controller('tts-engines')
export class TtsEnginesController {
  constructor(private readonly ttsEnginesService: TtsEnginesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const engines = await this.ttsEnginesService.findAll(userUid);
    return engines.map(e => this.ttsEnginesService.maskToken(e));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const engine = await this.ttsEnginesService.findOne(id, userUid);
    return this.ttsEnginesService.maskToken(engine);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.ttsEnginesService.create(body, userUid);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.ttsEnginesService.update(id, body, userUid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    await this.ttsEnginesService.remove(id, userUid);
    return { message: 'TTS Engine deleted' };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.ttsEnginesService.bulkRemove(body.ids, userUid);
  }
}
