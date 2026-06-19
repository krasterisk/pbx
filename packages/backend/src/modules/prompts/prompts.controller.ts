import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, Res, UploadedFile,
  UseInterceptors, ParseIntPipe, StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import { PromptsService } from './prompts.service';
import { IvrTtsService } from '../ivrs/ivr-tts.service';
import type { IPromptTtsMeta } from '@krasterisk/shared';
import { PromptSynthesizeDto, PromptTtsPreviewDto } from './dto/prompt-tts.dto';
import { PromptUpdateDto } from './dto/prompt-update.dto';

@Controller('prompts')
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly ivrTtsService: IvrTtsService,
  ) {}

  @Get()
  async findAll(@Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.findAll(userUid);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.findOne(id, userUid);
  }

  /**
   * Upload a new audio prompt.
   * File is received via multipart form-data.
   * In production, this would:
   * 1. Convert to WAV 8kHz mono 16-bit via sox/ffmpeg
   * 2. Upload to Asterisk server via SFTP
   * 3. Save metadata to DB
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('audio/')) {
        cb(new BadRequestException('Only audio files are allowed'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('comment') comment: string,
    @Body('description') description: string,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const filename = this.promptsService.generateFilename(userUid);

    const ext = path.extname(file.originalname) || '.wav';
    await this.promptsService.savePromptAudio(userUid, filename, file.buffer, ext);

    const prompt = await this.promptsService.create(
      {
        filename,
        comment: comment || file.originalname,
        description: description || '',
      },
      userUid,
    );

    return prompt;
  }

  /**
   * Initiate a recording by calling an extension via AMI.
   */
  @Post('record')
  async record(
    @Body('exten') exten: string,
    @Body('comment') comment: string,
    @Body('description') description: string,
    @Req() req: any,
  ) {
    if (!exten) {
      throw new BadRequestException('Extension is required');
    }

    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const filename = this.promptsService.generateFilename(userUid);

    // Initiate AMI originate
    await this.promptsService.recordByPhone(exten, filename, userUid);

    // Create DB record
    await this.promptsService.create(
      {
        filename,
        comment: comment || `Recording ${filename}`,
        description: description || '',
      },
      userUid,
    );

    return { message: 'Recording initiated', filename };
  }

  @Post('tts-preview')
  async ttsPreview(
    @Body() dto: PromptTtsPreviewDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    try {
      const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, userUid);
      const wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', String(wav.length));
      res.send(wav);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'TTS preview failed');
    }
  }

  /**
   * Synthesize speech via a configured TTS engine and register a prompt record.
   * Audio file upload to Asterisk (SFTP) is deferred — metadata is persisted now.
   */
  @Post('synthesize')
  async synthesize(@Body() dto: PromptSynthesizeDto, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const comment = dto.comment?.trim();
    if (!comment) {
      throw new BadRequestException('Recording name is required');
    }

    let wav: Buffer;
    try {
      const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, userUid);
      wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
    } catch (err: any) {
      throw new BadRequestException(err.message || 'TTS synthesis failed');
    }

    const filename = this.promptsService.generateFilename(userUid);
    await this.promptsService.savePromptAudio(userUid, filename, wav, '.wav');

    const ttsMeta: IPromptTtsMeta = {
      text: dto.text.trim(),
      engine_uid: dto.engine_uid,
      settings: dto.settings,
    };

    return this.promptsService.create(
      {
        filename,
        comment,
        description: dto.description?.trim() || '',
        tts: ttsMeta,
      },
      userUid,
    );
  }

  /**
   * Stream audio file for browser playback.
   * TODO: Phase 3 — download from Asterisk via SFTP and pipe to response.
   */
  @Get(':id/stream')
  async stream(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const prompt = await this.promptsService.findOneRow(id, userUid);
    await this.promptsService.streamPromptAudio(userUid, prompt, res);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PromptUpdateDto,
    @Req() req: any,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.update(
      id,
      {
        comment: body.comment,
        description: body.description,
        tts: body.tts,
      },
      userUid,
      async (filename, meta) => {
        const engine = await this.ivrTtsService.loadEngine(meta.engine_uid, userUid);
        const wav = await this.ivrTtsService.synthesizeToBuffer(engine, meta.text, meta.settings);
        await this.promptsService.savePromptAudio(userUid, filename, wav, '.wav');
      },
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const { filename } = await this.promptsService.remove(id, userUid);
    // audio file on disk left for manual cleanup until SFTP lifecycle is implemented

    // TODO: Phase 3 — delete file from Asterisk via SFTP

    return { message: 'Prompt deleted', filename };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.bulkRemove(body.ids, userUid);
  }
}
