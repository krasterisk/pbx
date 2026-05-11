import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcAiToolset } from './models/ai-toolset.model';
import { CreateAiToolsetDto, UpdateAiToolsetDto } from './dto/ai-toolset.dto';

@Injectable()
export class AiToolsetsService {
  constructor(
    @InjectModel(CcAiToolset) private readonly model: typeof CcAiToolset,
  ) {}

  findAll(userUid: number) {
    return this.model.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: number, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Toolset not found');
    return row;
  }

  create(dto: CreateAiToolsetDto, userUid: number) {
    return this.model.create({
      name: dto.name,
      description: dto.description || '',
      tools: dto.tools || [],
      user_uid: userUid,
    });
  }

  async update(id: number, dto: UpdateAiToolsetDto, userUid: number) {
    const row = await this.findOne(id, userUid);
    await row.update(dto);
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.findOne(id, userUid);
    await row.destroy();
    return { success: true };
  }
}
