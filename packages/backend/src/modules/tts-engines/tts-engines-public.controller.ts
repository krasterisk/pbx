import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsEnginesService } from './tts-engines.service';

/**
 * Public (no-auth) TTS Engines controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 */
@Controller('public/tts-engines')
export class TtsEnginesPublicController {
  private readonly userUid: number;

  constructor(
    private readonly ttsEnginesService: TtsEnginesService,
    private readonly configService: ConfigService,
  ) {
    this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
  }

  @Get()
  async findAll() {
    const engines = await this.ttsEnginesService.findAll(this.userUid);
    return engines.map(e => this.ttsEnginesService.maskToken(e));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const engine = await this.ttsEnginesService.findOne(id, this.userUid);
    return this.ttsEnginesService.maskToken(engine);
  }

  @Post()
  async create(@Body() body: any) {
    return this.ttsEnginesService.create(body, this.userUid);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.ttsEnginesService.update(id, body, this.userUid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.ttsEnginesService.remove(id, this.userUid);
    return { message: 'TTS Engine deleted' };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }) {
    return this.ttsEnginesService.bulkRemove(body.ids, this.userUid);
  }
}
