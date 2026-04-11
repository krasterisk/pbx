import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './user.model';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async findByLogin(login: string): Promise<User | null> {
    return this.userModel.findOne({ where: { login } });
  }

  async findById(id: number, vpbxUserUid?: number): Promise<User | null> {
    const whereClause: any = { uniqueid: id };
    if (vpbxUserUid) {
      whereClause.vpbx_user_uid = vpbxUserUid;
    }
    return this.userModel.findOne({
      where: whereClause,
      attributes: { exclude: ['passwd'] },
    });
  }

  async findAll(vpbxUserUid: number): Promise<User[]> {
    return this.userModel.findAll({
      where: { vpbx_user_uid: vpbxUserUid },
      attributes: { exclude: ['passwd'] },
      order: [['name', 'ASC']],
    });
  }

  async create(data: {
    login: string;
    name: string;
    password?: string;
    passwd?: string;
    email?: string;
    level?: number;
    role?: number;
    exten?: string;
    vpbx_user_uid?: number;
  }): Promise<User> {
    const newPassword = data.password || data.passwd;
    const hashedPassword = newPassword ? crypto.createHash('md5').update(newPassword).digest('hex') : '';
    return this.userModel.create({
      login: data.login,
      name: data.name,
      passwd: hashedPassword,
      email: data.email || '',
      level: data.level || 2,
      role: data.role || 0,
      exten: data.exten || '',
      vpbx_user_uid: data.vpbx_user_uid || 0,
    });
  }

  async update(id: number, vpbxUserUid: number, data: Partial<{
    login: string;
    name: string;
    password?: string;
    passwd?: string;
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
    vpbx_user_uid: number;
  }>): Promise<User | null> {
    const updateData: any = { ...data };
    
    // Front-end could send 'password' or 'passwd'
    const newPassword = data.password || data.passwd;
    
    if (newPassword) {
      updateData.passwd = crypto.createHash('md5').update(newPassword).digest('hex');
      delete updateData.password;
    } else {
      // If empty string is passed to passwd, delete it so we don't override with empty
      delete updateData.passwd;
      delete updateData.password;
    }
    
    await this.userModel.update(updateData, { where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
    return this.findById(id);
  }

  async delete(id: number, vpbxUserUid: number): Promise<void> {
    await this.userModel.destroy({ where: { uniqueid: id, vpbx_user_uid: vpbxUserUid } });
  }
}
