import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProvisionTemplate } from './provision-template.model';

@Injectable()
export class ProvisionTemplatesService {
  constructor(
    @InjectModel(ProvisionTemplate) private templateModel: typeof ProvisionTemplate,
  ) {}

  async findAll(userUid: number) {
    return this.templateModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'ASC']],
    });
  }

  async create(data: Partial<ProvisionTemplate>, userUid: number) {
    return this.templateModel.create({
      ...data,
      user_uid: userUid,
    });
  }

  async update(uid: number, data: Partial<ProvisionTemplate>, userUid: number) {
    await this.templateModel.update(data, {
      where: { uid, user_uid: userUid }
    });
    return this.templateModel.findOne({ where: { uid } });
  }

  async remove(uid: number, userUid: number) {
    await this.templateModel.destroy({
      where: { uid, user_uid: userUid }
    });
  }

  async bulkRemove(uids: number[], userUid: number): Promise<{ deleted: number }> {
    const deleted = await this.templateModel.destroy({
      where: { uid: uids, user_uid: userUid },
    });
    return { deleted };
  }
}
