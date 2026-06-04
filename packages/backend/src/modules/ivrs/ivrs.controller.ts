import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IvrsService } from './ivrs.service';
import { IvrTtsService } from './ivr-tts.service';
import { Ivr } from './ivr.model';
import { IvrTtsPreviewDto } from './dto/ivr-tts-preview.dto';

@Controller('ivrs')
@UseGuards(JwtAuthGuard)
export class IvrsController {
  constructor(
    private readonly ivrsService: IvrsService,
    private readonly ivrTtsService: IvrTtsService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.ivrsService.findAll(req.user.vpbx_user_uid);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ivrsService.findOne(id, req.user.vpbx_user_uid);
  }

  @Post()
  async create(@Body() createDto: Partial<Ivr>, @Req() req: any) {
    return this.ivrsService.create(createDto, req.user.vpbx_user_uid);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: Partial<Ivr>, @Req() req: any) {
    return this.ivrsService.update(id, updateDto, req.user.vpbx_user_uid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.ivrsService.remove(id, req.user.vpbx_user_uid);
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    return this.ivrsService.bulkRemove(body.ids, req.user.vpbx_user_uid);
  }

  @Post('tts-preview')
  async ttsPreview(
    @Body() dto: IvrTtsPreviewDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const vpbxUserUid: number = req.user.vpbx_user_uid;
    try {
      const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, vpbxUserUid);
      const wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', String(wav.length));
      res.send(wav);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'TTS preview failed');
    }
  }
}
