import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async findByLogin(login: string): Promise<User | null> {
    return this.userModel.findOne({ where: { login } });
  }

  async findById(id: number): Promise<User | null> {
    return this.userModel.findByPk(id, {
      attributes: { exclude: ['passwd'] },
    });
  }

  async findAll(): Promise<User[]> {
    return this.userModel.findAll({
      attributes: { exclude: ['passwd'] },
      order: [['name', 'ASC']],
    });
  }

  async create(data: {
    login: string;
    name: string;
    password: string;
    email?: string;
    level?: number;
    role?: number;
    exten?: string;
  }): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userModel.create({
      login: data.login,
      name: data.name,
      passwd: hashedPassword,
      email: data.email || '',
      level: data.level || 2,
      role: data.role || 0,
      exten: data.exten || '',
    });
  }

  async update(id: number, data: Partial<{
    login: string;
    name: string;
    password: string;
    email: string;
    level: number;
    role: number;
    exten: string;
    permit_extens: string;
    numbers_id: number;
    listbook_edit: number;
    oper_chanspy: number;
    outbound_posttime: number;
    suspension_time: number;
    inactive_time: number;
  }>): Promise<User | null> {
    const updateData: any = { ...data };
    if (data.password) {
      updateData.passwd = await bcrypt.hash(data.password, 10);
      delete updateData.password;
    }
    await this.userModel.update(updateData, { where: { uniqueid: id } });
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.userModel.destroy({ where: { uniqueid: id } });
  }
}
