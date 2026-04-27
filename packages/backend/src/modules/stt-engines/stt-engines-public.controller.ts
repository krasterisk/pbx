import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SttEnginesService } from './stt-engines.service';

/**
 * Public (no-auth) STT Engines controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 */
@Controller('public/stt-engines')
export class SttEnginesPublicController {
  private readonly userUid: number;

  constructor(
    private readonly sttEnginesService: SttEnginesService,
    private readonly configService: ConfigService,
  ) {
    this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
  }

  @Get()
  async findAll() {
    const engines = await this.sttEnginesService.findAll(this.userUid);
    return engines.map(e => this.sttEnginesService.maskToken(e));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const engine = await this.sttEnginesService.findOne(id, this.userUid);
    return this.sttEnginesService.maskToken(engine);
  }

  @Post()
  async create(@Body() body: any) {
    return this.sttEnginesService.create(body, this.userUid);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.sttEnginesService.update(id, body, this.userUid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sttEnginesService.remove(id, this.userUid);
    return { message: 'STT Engine deleted' };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }) {
    return this.sttEnginesService.bulkRemove(body.ids, this.userUid);
  }
}
