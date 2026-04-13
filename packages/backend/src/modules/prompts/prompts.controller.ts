import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Req, Res, UploadedFile,
  UseInterceptors, ParseIntPipe, StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PromptsService } from './prompts.service';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

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
    @Body('moh') moh: string,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const filename = this.promptsService.generateFilename(userUid);

    // TODO: Phase 3 — convert file with sox/ffmpeg, upload via SFTP
    // For now, save metadata to DB
    const prompt = await this.promptsService.create(
      { filename, comment: comment || file.originalname, moh: moh || '' },
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
      { filename, comment: comment || `Recording ${filename}` },
      userUid,
    );

    return { message: 'Recording initiated', filename };
  }

  /**
   * Synthesize speech via a configured TTS engine.
   * TODO: Implement in Phase 6 when TTS engines are ready.
   */
  @Post('synthesize')
  async synthesize(
    @Body('text') text: string,
    @Body('engineId') engineId: number,
    @Body('comment') comment: string,
    @Req() req: any,
  ) {
    if (!text || !engineId) {
      throw new BadRequestException('Text and engineId are required');
    }

    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const filename = this.promptsService.generateFilename(userUid);

    // TODO: Phase 6 — call TTS engine API, convert result, upload via SFTP
    const prompt = await this.promptsService.create(
      { filename, comment: comment || `TTS: ${text.substring(0, 50)}` },
      userUid,
    );

    return prompt;
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
    const prompt = await this.promptsService.findOne(id, userUid);

    // TODO: SFTP download → pipe to res
    // For now, return a placeholder
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `inline; filename="${prompt.filename}.wav"`);
    res.status(200).send(''); // placeholder
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { comment?: string; moh?: string },
    @Req() req: any,
  ) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.update(id, body, userUid);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    const { filename, moh } = await this.promptsService.remove(id, userUid);

    // TODO: Phase 3 — delete file from Asterisk via SFTP
    // TODO: If moh was set, also remove from MOH directory and call ami moh reload

    return { message: 'Prompt deleted', filename };
  }

  @Post('bulk/delete')
  async bulkDelete(@Body() body: { ids: number[] }, @Req() req: any) {
    const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
    return this.promptsService.bulkRemove(body.ids, userUid);
  }
}
