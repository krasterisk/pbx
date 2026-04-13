import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { TtsEngine } from './tts-engine.model';

@Injectable()
export class TtsEnginesService {
  private readonly logger = new Logger(TtsEnginesService.name);

  constructor(
    @InjectModel(TtsEngine) private ttsEngineModel: typeof TtsEngine,
  ) {}

  async findAll(userUid: number): Promise<TtsEngine[]> {
    return this.ttsEngineModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<TtsEngine> {
    const engine = await this.ttsEngineModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!engine) throw new NotFoundException('TTS Engine not found');
    return engine;
  }

  async create(data: Partial<TtsEngine>, userUid: number): Promise<TtsEngine> {
    return this.ttsEngineModel.create({
      ...data,
      user_uid: userUid,
    } as any);
  }

  async update(uid: number, data: Partial<TtsEngine>, userUid: number): Promise<TtsEngine> {
    const engine = await this.findOne(uid, userUid);
    await engine.update(data);
    return engine;
  }

  async remove(uid: number, userUid: number): Promise<void> {
    const engine = await this.findOne(uid, userUid);
    await engine.destroy();
  }

  /**
   * Mask the token in API responses to prevent leakage.
   */
  maskToken(engine: TtsEngine): any {
    const json = engine.toJSON();
    if (json.token) {
      json.token = json.token.substring(0, 8) + '***';
    }
    return json;
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.ttsEngineModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }
}
