import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Role } from './role.model';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role) private readonly roleModel: typeof Role,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleModel.findAll();
  }

  async findById(id: number): Promise<Role | null> {
    return this.roleModel.findByPk(id);
  }

  async create(data: Partial<Role>): Promise<Role> {
    return this.roleModel.create(data as any);
  }

  async update(id: number, data: Partial<Role>): Promise<Role | null> {
    const role = await this.roleModel.findByPk(id);
    if (!role) return null;
    return role.update(data);
  }

  async delete(id: number): Promise<boolean> {
    const deleted = await this.roleModel.destroy({ where: { id } });
    return deleted > 0;
  }

  async bulkDelete(ids: number[]): Promise<number> {
    return this.roleModel.destroy({ where: { id: ids } });
  }
}
