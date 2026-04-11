import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NumberList } from './number-list.model';

@Injectable()
export class NumbersService {
  constructor(
    @InjectModel(NumberList) private readonly numberListModel: typeof NumberList,
  ) {}

  async findAll(vpbxUserUid: number): Promise<NumberList[]> {
    return this.numberListModel.findAll({ where: { vpbx_user_uid: vpbxUserUid }});
  }

  async findById(id: number, vpbxUserUid: number): Promise<NumberList | null> {
    return this.numberListModel.findOne({ where: { id, vpbx_user_uid: vpbxUserUid } });
  }

  async create(data: Partial<NumberList>): Promise<NumberList> {
    return this.numberListModel.create(data as any);
  }

  async update(id: number, vpbxUserUid: number, data: Partial<NumberList>): Promise<NumberList | null> {
    const item = await this.numberListModel.findOne({ where: { id, vpbx_user_uid: vpbxUserUid } });
    if (!item) return null;
    return item.update(data);
  }

  async delete(id: number, vpbxUserUid: number): Promise<boolean> {
    const deleted = await this.numberListModel.destroy({ where: { id, vpbx_user_uid: vpbxUserUid } });
    return deleted > 0;
  }

  async bulkDelete(ids: number[], vpbxUserUid: number): Promise<number> {
    return this.numberListModel.destroy({ where: { id: ids, vpbx_user_uid: vpbxUserUid } });
  }
}
