import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, ParseIntPipe,
} from '@nestjs/common';
import { SttEnginesService } from './stt-engines.service';

@Controller('stt-engines')
export class SttEnginesController {
  constructor(private readonly sttEnginesService: SttEnginesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    const engines = await this.sttEnginesService.findAll(userUid);
    return engines.map(e => this.sttEnginesService.maskToken(e));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    const engine = await this.sttEnginesService.findOne(id, userUid);
    return this.sttEnginesService.maskToken(engine);
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    return this.sttEnginesService.create(body, userUid);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    const userUid = req.user.vpbx_user_uid;
    return this.sttEnginesService.update(id, body, userUid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    await this.sttEnginesService.remove(id, userUid);
    return { message: 'STT Engine deleted' };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const userUid = req.user.vpbx_user_uid;
    return this.sttEnginesService.bulkRemove(body.ids, userUid);
  }
}
