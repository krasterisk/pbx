import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Role } from './role.model';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role) private readonly roleModel: typeof Role,
  ) {}

  async findAll(vpbxUserUid: number): Promise<Role[]> {
    return this.roleModel.findAll({ where: { user_uid: vpbxUserUid }});
  }

  async findById(id: number, vpbxUserUid: number): Promise<Role | null> {
    return this.roleModel.findOne({ where: { id, user_uid: vpbxUserUid } });
  }

  async create(data: Partial<Role>): Promise<Role> {
    return this.roleModel.create(data as any);
  }

  async update(id: number, vpbxUserUid: number, data: Partial<Role>): Promise<Role | null> {
    const role = await this.roleModel.findOne({ where: { id, user_uid: vpbxUserUid } });
    if (!role) return null;
    return role.update(data);
  }

  async delete(id: number, vpbxUserUid: number): Promise<boolean> {
    const deleted = await this.roleModel.destroy({ where: { id, user_uid: vpbxUserUid } });
    return deleted > 0;
  }

  async bulkDelete(ids: number[], vpbxUserUid: number): Promise<number> {
    return this.roleModel.destroy({ where: { id: ids, user_uid: vpbxUserUid } });
  }
}
