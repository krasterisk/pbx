import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { SttEngine } from './stt-engine.model';

@Injectable()
export class SttEnginesService {
  private readonly logger = new Logger(SttEnginesService.name);

  constructor(
    @InjectModel(SttEngine) private sttEngineModel: typeof SttEngine,
  ) {}

  async findAll(userUid: number): Promise<SttEngine[]> {
    return this.sttEngineModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
  }

  async findOne(uid: number, userUid: number): Promise<SttEngine> {
    const engine = await this.sttEngineModel.findOne({
      where: { uid, user_uid: userUid },
    });
    if (!engine) throw new NotFoundException('STT Engine not found');
    return engine;
  }

  async create(data: Partial<SttEngine>, userUid: number): Promise<SttEngine> {
    return this.sttEngineModel.create({
      ...data,
      user_uid: userUid,
    } as any);
  }

  async update(uid: number, data: Partial<SttEngine>, userUid: number): Promise<SttEngine> {
    const engine = await this.findOne(uid, userUid);
    await engine.update(data);
    return engine;
  }

  async remove(uid: number, userUid: number): Promise<void> {
    const engine = await this.findOne(uid, userUid);
    await engine.destroy();
  }

  maskToken(engine: SttEngine): any {
    const json = engine.toJSON();
    if (json.token) {
      json.token = json.token.substring(0, 8) + '***';
    }
    return json;
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.sttEngineModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }
}
