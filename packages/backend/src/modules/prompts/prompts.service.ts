import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import type { Response } from 'express';
import type { IPrompt, IPromptTtsMeta, PromptSourceType } from '@krasterisk/shared';
import { Prompt } from './prompt.model';
import { AmiService } from '../ami/ami.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  contentTypeForFile,
  promptAudioCandidates,
  resolveUnderDir,
  sanitizePromptFilename,
} from './prompts-audio.util';
import {
  deleteTtsMetaFile,
  readTtsMetaFile,
  resolveTtsMetaPath,
  writeTtsMetaFile,
} from './prompt-tts-meta.util';

export interface PromptCreateData {
  filename: string;
  comment: string;
  description?: string;
  tts?: IPromptTtsMeta;
}

export interface PromptUpdateData {
  comment?: string;
  description?: string;
  tts?: IPromptTtsMeta;
}

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  constructor(
    @InjectModel(Prompt) private promptModel: typeof Prompt,
    private readonly amiService: AmiService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  private async getRecordsBasePath(): Promise<string> {
    const cfg = await this.systemSettings.getServerConfigRaw();
    return cfg.records_base_path || '/usr/records';
  }

  private async getSoundsDir(userUid: number): Promise<string> {
    const base = await this.getRecordsBasePath();
    return path.resolve(base, String(userUid), 'sounds');
  }

  async resolvePromptAudioFile(
    userUid: number,
    filename: string,
  ): Promise<{ filePath: string; contentType: string } | null> {
    const soundsDir = await this.getSoundsDir(userUid);
    for (const candidate of promptAudioCandidates(filename)) {
      const filePath = resolveUnderDir(soundsDir, candidate);
      if (!filePath) continue;
      try {
        await fs.access(filePath);
        return { filePath, contentType: contentTypeForFile(filePath) };
      } catch {
        // try next extension
      }
    }
    return null;
  }

  async savePromptAudio(
    userUid: number,
    filename: string,
    data: Buffer,
    preferredExt?: string,
  ): Promise<void> {
    const safe = sanitizePromptFilename(filename);
    if (!safe) {
      throw new BadRequestException('Invalid prompt filename');
    }

    const soundsDir = await this.getSoundsDir(userUid);
    await fs.mkdir(soundsDir, { recursive: true });

    const ext = preferredExt?.startsWith('.')
      ? preferredExt.toLowerCase()
      : path.extname(safe) || '.wav';
    const baseName = path.extname(safe) ? path.parse(safe).name : safe;
    const targetName = `${baseName}${ext}`;
    const filePath = resolveUnderDir(soundsDir, targetName);
    if (!filePath) {
      throw new BadRequestException('Invalid prompt filename');
    }

    await fs.writeFile(filePath, data);
    this.logger.log(`Saved prompt audio: ${filePath}`);
  }

  async streamPromptAudio(userUid: number, prompt: Prompt, res: Response): Promise<void> {
    const resolved = await this.resolvePromptAudioFile(userUid, prompt.filename);
    if (!resolved) {
      throw new NotFoundException('Audio file not found');
    }

    const stat = await fs.stat(resolved.filePath);
    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(resolved.filePath)}"`);
    res.setHeader('Content-Length', String(stat.size));
    res.status(200);

    const stream = createReadStream(resolved.filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }

  async loadTtsMeta(userUid: number, filename: string): Promise<IPromptTtsMeta | null> {
    const soundsDir = await this.getSoundsDir(userUid);
    const metaPath = resolveTtsMetaPath(soundsDir, filename);
    if (!metaPath) return null;
    return readTtsMetaFile(metaPath);
  }

  async saveTtsMeta(userUid: number, filename: string, meta: IPromptTtsMeta): Promise<void> {
    const soundsDir = await this.getSoundsDir(userUid);
    await fs.mkdir(soundsDir, { recursive: true });
    const metaPath = resolveTtsMetaPath(soundsDir, filename);
    if (!metaPath) {
      throw new BadRequestException('Invalid prompt filename');
    }
    await writeTtsMetaFile(metaPath, meta);
  }

  async removeTtsMeta(userUid: number, filename: string): Promise<void> {
    const soundsDir = await this.getSoundsDir(userUid);
    const metaPath = resolveTtsMetaPath(soundsDir, filename);
    if (metaPath) {
      await deleteTtsMetaFile(metaPath);
    }
  }

  async toPublicPrompt(prompt: Prompt, userUid: number): Promise<IPrompt> {
    const tts = await this.loadTtsMeta(userUid, prompt.filename);
    const source_type: PromptSourceType = tts ? 'tts' : 'file';
    return {
      uid: prompt.uid,
      filename: prompt.filename,
      comment: prompt.comment,
      description: prompt.description,
      user_uid: prompt.user_uid,
      source_type,
      tts,
    };
  }

  async findAll(userUid: number): Promise<IPrompt[]> {
    const rows = await this.promptModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
    return Promise.all(rows.map((row) => this.toPublicPrompt(row, userUid)));
  }

  async findOneRow(uid: number, userUid: number): Promise<Prompt> {
    const prompt = await this.promptModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!prompt) throw new NotFoundException('Prompt not found');
    return prompt;
  }

  async findOne(uid: number, userUid: number): Promise<IPrompt> {
    return this.toPublicPrompt(await this.findOneRow(uid, userUid), userUid);
  }

  generateFilename(userUid: number): string {
    const timestamp = Date.now();
    return `prompt_${userUid}_${timestamp}`;
  }

  async create(data: PromptCreateData, userUid: number): Promise<IPrompt> {
    const row = await this.promptModel.create({
      filename: data.filename,
      comment: data.comment || '',
      description: data.description || '',
      user_uid: userUid,
    } as any);

    if (data.tts) {
      await this.saveTtsMeta(userUid, data.filename, data.tts);
    }

    return this.toPublicPrompt(row, userUid);
  }

  async update(
    uid: number,
    data: PromptUpdateData,
    userUid: number,
    resynthesize?: (filename: string, meta: IPromptTtsMeta) => Promise<void>,
  ): Promise<IPrompt> {
    const prompt = await this.findOneRow(uid, userUid);
    const existingTts = await this.loadTtsMeta(userUid, prompt.filename);
    const dbPatch: { comment?: string; description?: string } = {};

    if (data.comment !== undefined) {
      const comment = data.comment.trim();
      if (!comment) {
        throw new BadRequestException('Название записи обязательно');
      }
      dbPatch.comment = comment;
    }

    if (data.description !== undefined) {
      dbPatch.description = data.description.trim();
    }

    if (data.tts) {
      if (!existingTts) {
        throw new BadRequestException('TTS settings apply only to synthesized recordings');
      }
      if (!data.tts.text?.trim() || !data.tts.engine_uid) {
        throw new BadRequestException('TTS text and engine are required');
      }
      const meta: IPromptTtsMeta = {
        text: data.tts.text.trim(),
        engine_uid: data.tts.engine_uid,
        settings: data.tts.settings,
      };
      if (resynthesize) {
        await resynthesize(prompt.filename, meta);
      }
      await this.saveTtsMeta(userUid, prompt.filename, meta);
    }

    if (Object.keys(dbPatch).length > 0) {
      await prompt.update(dbPatch);
    }

    return this.toPublicPrompt(prompt, userUid);
  }

  async remove(uid: number, userUid: number): Promise<{ filename: string }> {
    const prompt = await this.findOneRow(uid, userUid);
    const { filename } = prompt;
    await this.removeTtsMeta(userUid, filename);
    await prompt.destroy();
    return { filename };
  }

  async recordByPhone(
    exten: string,
    filename: string,
    userUid: number,
  ): Promise<void> {
    try {
      await this.amiService.action({
        action: 'Originate',
        channel: exten,
        callerid: 'Record',
        context: 'record_dial',
        exten: 'start',
        priority: '1',
        variable: `FILENAME=${filename},VPBX_UID=${userUid}`,
        async: 'true',
      });
      this.logger.log(`Recording initiated: exten=${exten}, file=${filename}`);
    } catch (err) {
      this.logger.error(`Failed to originate recording: ${err}`);
      throw new BadRequestException('Failed to initiate recording call');
    }
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.promptModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }
}
