import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { NumberList } from './number-list.model';

@Injectable()
export class NumbersService {
  constructor(
    @InjectModel(NumberList) private readonly numberListModel: typeof NumberList,
  ) {}

  async findAll(): Promise<NumberList[]> {
    return this.numberListModel.findAll();
  }

  async findById(id: number): Promise<NumberList | null> {
    return this.numberListModel.findByPk(id);
  }

  async create(data: Partial<NumberList>): Promise<NumberList> {
    return this.numberListModel.create(data as any);
  }

  async update(id: number, data: Partial<NumberList>): Promise<NumberList | null> {
    const item = await this.numberListModel.findByPk(id);
    if (!item) return null;
    return item.update(data);
  }

  async delete(id: number): Promise<boolean> {
    const deleted = await this.numberListModel.destroy({ where: { id } });
    return deleted > 0;
  }

  async bulkDelete(ids: number[]): Promise<number> {
    return this.numberListModel.destroy({ where: { id: ids } });
  }
}
